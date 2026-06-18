// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
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
import fs from "fs";
import path from "path";
import router from "./routes";
import { blockTemporaryProductionRoutes } from "./lib/route-governance";
import { productionSecurityProfile } from "./middlewares/productionSecurityProfile";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { internalSecretBypass } from "./lib/internal-auth";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";
import { tenantContext } from "./middlewares/tenantContext";
import { db, daemonIpBansTable } from "@workspace/db";

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
  : (() => {
      if (process.env.NODE_ENV === "production") {
        logger.warn("ALLOWED_ORIGINS not set in production — using Replit domain allowlist only. Set ALLOWED_ORIGINS to restrict further.");
      }
      return [
        /\.replit\.dev$/,
        /\.repl\.co$/,
        /\.replit\.app$/,
      ];
    })();

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
        scriptSrc: ["'self'", "https://clerk.accounts.dev", "https://challenges.cloudflare.com"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https://img.clerk.com", "https://*.clerk.com"],
        connectSrc: ["'self'", "https://clerk.accounts.dev", "https://api.clerk.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"],
        upgradeInsecureRequests: [],
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
  skip: (req) => req.path === "/healthz",
  message: { error: "Too many requests." },
});

// Dedicated daemon rate limiter — generous enough for real nodes (check-ins every 30s = 2/min per node)
// but protects against DoS on the unauthenticated daemon-inbound path.
const daemonLimiter = rateLimit({
  windowMs: 60_000,
  max: 500,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Daemon rate limit exceeded." },
});

const terminalLimiter = rateLimit({
  windowMs: 60_000,
  max: 10, // Halved — compensates for in-memory store resetting on restart
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Terminal rate limit: max 10 commands/minute." },
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
app.use(tenantContext);

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.removeHeader("X-Powered-By");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Copyright", "Copyright 2024-2026 ALPHA UNLIMITED TECHNOLOGIES LLC. All rights reserved.");
  res.setHeader("X-Permitted-Cross-Domain-Policies", "none");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  // Permissions-Policy: explicitly disable browser features that have no place in a VPN dashboard
  res.setHeader(
    "Permissions-Policy",
    [
      "geolocation=()",
      "camera=()",
      "microphone=()",
      "payment=()",
      "usb=()",
      "bluetooth=()",
      "magnetometer=()",
      "accelerometer=()",
      "gyroscope=()",
      "interest-cohort=()",
    ].join(", "),
  );
  next();
});

// ── Prototype Pollution Prevention ────────────────────────────────────────────
// Sanitizes __proto__, constructor.prototype from all parsed request bodies.
// Blocks the most common vector for prototype pollution attacks.
function sanitizeObject(obj: unknown, depth = 0): void {
  if (!obj || typeof obj !== "object" || depth > 10) return;
  // Only recurse into plain objects — skip Arrays, Dates, Buffers, etc.
  if (Array.isArray(obj)) {
    for (const item of obj) sanitizeObject(item, depth + 1);
    return;
  }
  if (Object.getPrototypeOf(obj) !== Object.prototype) return;
  const o = obj as Record<string, unknown>;
  for (const key of Object.keys(o)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      delete o[key];
      logger.warn({ key }, "Prototype pollution attempt blocked");
      continue;
    }
    if (o[key] !== null && typeof o[key] === "object") sanitizeObject(o[key], depth + 1);
  }
}
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (req.body && typeof req.body === "object") sanitizeObject(req.body);
  next();
});

// ── IP Auto-Ban: brute-force protection for daemon key endpoints only ─────────
// IMPORTANT: this ban is SCOPED TO /api/daemon-inbound/* only.
// Applying it globally would lock out browser users whose Clerk session
// hasn't loaded yet (normal 401s from /api/me) — causing the paywall to
// show for admin users who have no subscription in the DB.
//
// Architecture: in-memory Map is the hot-path (synchronous check); the
// daemon_ip_bans DB table is the durable backing store so bans survive
// process restarts. Writes are fire-and-forget (non-blocking on the request path).
const ipFailures = new Map<string, { count: number; since: number; bannedUntil: number }>();
const BAN_THRESHOLD = 10;
const BAN_WINDOW_MS = 5 * 60_000;   // 5 minutes
const BAN_DURATION_MS = 30 * 60_000; // 30 minutes

function getClientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

// Persist the current in-memory state for an IP to the DB (fire-and-forget).
function persistDaemonBan(ip: string, rec: { count: number; since: number; bannedUntil: number }): void {
  const now = Date.now();
  db.insert(daemonIpBansTable)
    .values({ ip, failureCount: rec.count, windowStart: rec.since, bannedUntil: rec.bannedUntil, updatedAt: now })
    .onConflictDoUpdate({
      target: daemonIpBansTable.ip,
      set: { failureCount: rec.count, windowStart: rec.since, bannedUntil: rec.bannedUntil, updatedAt: now },
    })
    .catch((err: unknown) => logger.warn({ err, ip }, "[daemon-ban] Failed to persist ban record to DB"));
}

// On startup: load any still-active ban records from DB into the in-memory Map.
// Expired records are ignored; they will be cleaned up by the next write.
export async function loadDaemonBansFromDb(): Promise<void> {
  try {
    const rows = await db.select().from(daemonIpBansTable);
    const now = Date.now();
    for (const row of rows) {
      // Only restore bans that are still active or windows that are still open
      if (row.bannedUntil > now || (row.windowStart + BAN_WINDOW_MS) > now) {
        ipFailures.set(row.ip, {
          count:       row.failureCount,
          since:       row.windowStart,
          bannedUntil: row.bannedUntil,
        });
      }
    }
    logger.info({ loaded: ipFailures.size }, "[daemon-ban] Restored active ban records from DB");
  } catch (err) {
    logger.warn({ err }, "[daemon-ban] Could not load ban records from DB — starting with empty Map");
  }
}

// Daemon-inbound ban middleware — applied only to /api/daemon-inbound routes below.
// Not exported as a global middleware so normal Clerk 401s never count toward the threshold.
export function daemonIpBanMiddleware(req: Request, res: Response, next: NextFunction) {
  const ip = getClientIp(req);
  const rec = ipFailures.get(ip);
  if (rec && rec.bannedUntil > Date.now()) {
    const mins = Math.ceil((rec.bannedUntil - Date.now()) / 60_000);
    return res.status(429).json({ error: `Access suspended due to repeated failures. Retry in ${mins} min.` });
  }
  res.on("finish", () => {
    if (res.statusCode === 401) {
      const now = Date.now();
      const existing = ipFailures.get(ip) ?? { count: 0, since: now, bannedUntil: 0 };
      if (now - existing.since > BAN_WINDOW_MS) { existing.count = 0; existing.since = now; }
      existing.count++;
      if (existing.count >= BAN_THRESHOLD) {
        existing.bannedUntil = now + BAN_DURATION_MS;
        logger.warn({ ip, count: existing.count }, "[security] IP auto-banned for repeated daemon auth failures");
      }
      ipFailures.set(ip, existing);
      // Persist asynchronously so the response is never delayed
      persistDaemonBan(ip, existing);
    }
  });
  next();
}

// ── WAF-Light: Inline Request Inspection ─────────────────────────────────────
// Blocks high-confidence attack signatures in query strings and path.
// URL-decodes twice to catch double-encoded bypass attempts.
// Does NOT block legitimate security tools — only obvious unsolicited attacks.
const WAF_PATTERNS: [RegExp, string][] = [
  [/\.\.[\/\\].*\.\.[\/\\]/, "LFI path traversal chaining"],
  [/<script[\s>]/i, "XSS script tag"],
  [/on(?:load|error|click|focus|mouseover|onerror)[\s=]/i, "XSS event handler"],
  [/UNION[\s+/*]+(?:ALL\s+)?SELECT/i, "SQL UNION injection"],
  [/(?:EXEC|EXECUTE)[\s(]+(?:xp_|sp_)/i, "MSSQL stored proc injection"],
  [/;\s*DROP\s+TABLE/i, "SQL DROP TABLE injection"],
  [/(?:eval|setTimeout|setInterval)\s*\(/i, "JS eval injection"],
  [/\$\{[^}]{0,200}\}/, "SSTI template expression"],
  [/\{\{[^}]{0,200}\}\}/, "Jinja2/Handlebars SSTI"],
  [/%27|%22.*(?:OR|AND|UNION|SELECT|DROP)/i, "URL-encoded SQLi"],
  [/(?:\/etc\/passwd|\/etc\/shadow|\/proc\/self\/environ)/i, "LFI sensitive file"],
  [/(?:system\s*\(|popen\s*\(|passthru\s*\()/i, "PHP RCE function"],
  [/(?:\bwget\b|\bcurl\b)\s+http.*\|\s*(?:bash|sh)/i, "Dropper pattern"],
];

app.use((req: Request, res: Response, next: NextFunction) => {
  // Skip Stripe webhook — raw buffer, not a user input path
  if (req.path === "/api/stripe/webhook") return next();
  // Skip WAF tool routes — they intentionally carry payloads in their JSON body
  if (req.path.startsWith("/api/waf")) return next();

  // Decode once and twice to catch single and double URL-encoding bypasses
  let decoded = req.url;
  try { decoded = decodeURIComponent(req.url); } catch {}
  let decodedTwice = decoded;
  try { decodedTwice = decodeURIComponent(decoded); } catch {}

  const toCheck = [req.path, req.url, decoded, decodedTwice, JSON.stringify(req.query)].join(" ");
  for (const [pattern, label] of WAF_PATTERNS) {
    if (pattern.test(toCheck)) {
      logger.warn({ label, path: req.path, ip: getClientIp(req) }, `WAF: Blocked — ${label}`);
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

app.use("/api/terminal",        terminalLimiter);
app.use("/api/daemon-inbound",  daemonLimiter);
app.use("/api/sql", sqlLimiter);
app.use("/api/node-provision",  mutateLimiter);
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

// Block temporary/dev download routes in production unless opt-in env var is set
app.use(blockTemporaryProductionRoutes);

// Production security profile: strict origin check + prevent browser-origin internal auth
app.use(productionSecurityProfile);

// Internal service bypass: validates X-Internal-Secret and sets req.internalBypass
// Loopback-only in production (mTLS-ready); requireAuth in routes checks the flag.
app.use(internalSecretBypass);

app.use("/api", router);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
