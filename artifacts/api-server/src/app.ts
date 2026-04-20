import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

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

app.use(globalLimiter);

app.use(express.json({ limit: "64kb", strict: true }));
app.use(express.urlencoded({ extended: false, limit: "16kb" }));
app.use(clerkMiddleware());

app.use((_req: Request, res: Response, next: NextFunction) => {
  res.removeHeader("X-Powered-By");
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.use("/api/terminal", terminalLimiter);
app.use("/api/sql", sqlLimiter);
app.use("/api/nodes", (req: Request, res: Response, next: NextFunction) => {
  if (["POST", "PUT", "DELETE"].includes(req.method)) return mutateLimiter(req, res, next);
  next();
});
app.use("/api/firewall", (req: Request, res: Response, next: NextFunction) => {
  if (["POST", "PUT", "DELETE"].includes(req.method)) return mutateLimiter(req, res, next);
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
