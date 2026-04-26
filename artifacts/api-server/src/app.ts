/**
 * ProxhqVPN — API Server
 * Copyright © 2024–2026 ALPHA UNLIMITED TECHNOLOGIES LLC
 * All rights reserved. Unauthorized use, reproduction, or distribution is prohibited.
 */
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";

const app: Express = express();

// Stripe webhook MUST be registered before express.json() so it receives raw Buffer
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) return res.status(400).json({ error: "Missing stripe-signature" });
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err: any) {
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing error" });
    }
  }
);

const ALLOWED_ORIGINS: Array<string | RegExp> = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [
      "http://localhost",
      "http://localhost:3000",
      "http://localhost:5173",
      /\.replit\.dev$/,
      /\.repl\.co$/,
      /\.replit\.app$/,
    ];

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// Clerk proxy must be mounted before body parsers (proxies raw bytes)
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://clerk.accounts.dev", "https://*.clerk.accounts.dev"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://img.clerk.com", "https://*.clerk.com"],
        connectSrc: ["'self'", "https://clerk.accounts.dev", "https://*.clerk.accounts.dev", "https://api.clerk.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    noSniff: true,
    referrerPolicy: { policy: "no-referrer" },
  }),
);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      const allowed = ALLOWED_ORIGINS.some((o) =>
        typeof o === "string" ? o === origin : o.test(origin),
      );
      cb(null, allowed);
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    credentials: true,
    maxAge: 86400,
  }),
);

const globalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many requests." },
  skip: (req) => req.path === "/healthz",
});

const terminalLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Terminal rate limit: max 20 commands/minute." },
});

const sqlLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "SQL rate limit: max 30 queries/minute." },
});

const mutateLimiter = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Write rate limit exceeded." },
});

const ambassadorLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many ambassador requests — please wait a moment." },
});

app.use(globalLimiter);

app.use(express.json({ limit: "64kb", strict: true }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));
app.use(clerkMiddleware());

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.removeHeader("X-Powered-By");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Copyright", "Copyright 2024-2026 ALPHA UNLIMITED TECHNOLOGIES LLC. All rights reserved.");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
});

// ── Prototype Pollution Prevention ────────────────────────────────────────────
// Sanitizes __proto__, constructor.prototype from all parsed request bodies.
// Blocks the most common vector for prototype pollution attacks.
function sanitizeObject(obj: unknown, depth = 0): void {
  if (!obj || typeof obj !== "object" || depth > 10) return;
  const o = obj as Record<string, unknown>;
  for (const key of Object.keys(o)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      delete o[key];
      logger.warn({ key }, "Prototype pollution attempt blocked");
      continue;
    }
    if (typeof o[key] === "object") sanitizeObject(o[key], depth + 1);
  }
}
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === "object") sanitizeObject(req.body);
  next();
});

// ── WAF-Light: Inline Request Inspection ─────────────────────────────────────
// Blocks high-confidence attack signatures in query strings and path.
// Does NOT block legitimate security tools — only obvious unsolicited attacks.
const WAF_PATTERNS = [
  /\.\.[\/\\].*\.\.[\/\\]/,                          // LFI/path traversal chaining
  /<script[\s>]/i,                                    // XSS script tags
  /on(?:load|error|click|focus|mouseover)[\s=]/i,    // XSS event handlers
  /UNION[\s+/*]+(?:ALL\s+)?SELECT/i,                 // SQLi UNION
  /(?:EXEC|EXECUTE)[\s(]+(?:xp_|sp_)/i,              // MSSQL stored proc injection
  /;\s*DROP\s+TABLE/i,                               // SQL DROP TABLE
  /(?:eval|setTimeout|setInterval)\s*\(/i,            // JS eval injection
  /\$\{.*\}/,                                        // SSTI template expression
  /\{\{.*\}\}/,                                      // Jinja2/Handlebars SSTI
];
app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip Stripe webhook — raw buffer, not a user input path
  if (req.path === "/api/stripe/webhook") return next();
  // Skip OmniStrike/WAF tool routes — they intentionally carry payloads in their JSON body
  if (req.path.startsWith("/api/omnistrike") || req.path.startsWith("/api/waf")) return next();
  const toCheck = [req.path, req.url, JSON.stringify(req.query)].join(" ");
  for (const pattern of WAF_PATTERNS) {
    if (pattern.test(toCheck)) {
      logger.warn({ pattern: pattern.toString(), path: req.path, ip: req.ip }, "WAF: Blocked attack pattern");
      return res.status(403).json({ error: "Request blocked by security policy." });
    }
  }
  next();
});

// ── Path Traversal Hard Block ─────────────────────────────────────────────────
app.use((req: Request, res: Response, next: NextFunction) => {
  const raw = decodeURIComponent(req.path);
  if (raw.includes("..") || raw.includes("%00") || raw.includes("\0")) {
    logger.warn({ path: req.path, ip: req.ip }, "WAF: Path traversal/null-byte blocked");
    return res.status(400).json({ error: "Invalid request path." });
  }
  next();
});

// ── OmniStrike / Console rate limits ──────────────────────────────────────────
const omniLimiter = rateLimit({
  windowMs: 60_000, max: 5, standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Max 5 OmniStrike scans per minute." },
});
const consoleLimiter = rateLimit({
  windowMs: 60_000, max: 60, standardHeaders: "draft-7", legacyHeaders: false,
  message: { error: "Max 60 console commands per minute." },
});

app.use("/api/terminal",   terminalLimiter);
app.use("/api/omnistrike/scan", (req: Request, res: Response, next: NextFunction) => {
  if (req.method === "POST") return omniLimiter(req, res, next);
  next();
});
app.use("/api/omnistrike/console", consoleLimiter);
app.use("/api/sql", sqlLimiter);
app.use("/api/nodes", (req: Request, res: Response, next: NextFunction) => {
  if (["POST", "PUT", "DELETE"].includes(req.method)) return mutateLimiter(req, res, next);
  next();
});
app.use("/api/firewall", (req: Request, res: Response, next: NextFunction) => {
  if (["POST", "PUT", "DELETE"].includes(req.method)) return mutateLimiter(req, res, next);
  next();
});
// Strict rate limit on ambassador write operations to prevent abuse
app.use("/api/ambassadors/apply", ambassadorLimiter);
app.use("/api/ambassadors/record-referral", ambassadorLimiter);
app.use("/api/ambassadors/me/videos", (req: Request, res: Response, next: NextFunction) => {
  if (["POST", "DELETE"].includes(req.method)) return ambassadorLimiter(req, res, next);
  next();
});

app.use("/api", router);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err && typeof err === "object" && "name" in err && (err as any).name === "ZodError") {
    return res.status(400).json({ error: "Invalid input", details: (err as any).issues });
  }
  logger.error({ err }, "Unhandled error");
  res.status(500).json({ error: "Internal server error" });
});

export default app;
