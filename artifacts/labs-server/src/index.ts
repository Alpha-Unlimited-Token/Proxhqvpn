// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Labs API Server — isolated deployment boundary.

import express from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { pino } from "pino";
import { clerkMiddleware } from "@clerk/express";
import rateLimit from "express-rate-limit";

const PORT = parseInt(process.env.PORT ?? "9090", 10);
const CORS_ORIGIN = /\.replit\.dev$|\.replit\.app$|^http:\/\/localhost/;

const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

const app = express();

// ── Security headers ───────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false,
}));

// ── CORS — stricter than main api-server ────────────────────────────────────
app.use((req, res, next) => {
  const origin = req.headers.origin ?? "";
  if (CORS_ORIGIN.test(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Proxhq-Audit-Session");
  }
  if (req.method === "OPTIONS") { res.sendStatus(204); return; }
  next();
});

// ── Request logging ────────────────────────────────────────────────────────
app.use(pinoHttp({ logger }));

// ── Body parsing ───────────────────────────────────────────────────────────
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));

// ── Clerk auth middleware ──────────────────────────────────────────────────
app.use(clerkMiddleware());

// ── Labs boundary identification header ───────────────────────────────────
app.use((_req, res, next) => {
  res.setHeader("X-Proxhq-Service", "labs-server");
  res.setHeader("X-Proxhq-Labs-Boundary", "isolated");
  next();
});

// ── Health check — public ─────────────────────────────────────────────────
app.get("/api/labs/healthz", (_req, res) => {
  res.json({ status: "ok", service: "labs-server", timestamp: new Date().toISOString() });
});

// ── Global labs rate limit — 30 req/min per IP ────────────────────────────
const labsLimiter = rateLimit({
  windowMs: 60_000,
  max:      30,
  message:  { error: "Labs rate limit exceeded — 30 requests/min." },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ── Per-route limits ───────────────────────────────────────────────────────
const toolLimiter = rateLimit({
  windowMs: 60_000,
  max:      5,
  message:  { error: "Tool rate limit exceeded — 5 requests/min per tool." },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ── Service auth guard ─────────────────────────────────────────────────────

// ── All routes require Clerk admin ────────────────────────────────────────

// ── Route mounting ────────────────────────────────────────────────────────

// ── Error handler ─────────────────────────────────────────────────────────
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const e = err as Error;
  logger.error({ err: e }, "labs-server unhandled error");
  res.status(500).json({ error: "Internal error", message: e.message ?? "Unknown error" });
});

app.listen(PORT, () => {
  logger.info({ port: PORT }, "Labs API Server listening");
});

export default app;
