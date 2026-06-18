// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { clerkMiddleware } from "@clerk/express";
import { logger } from "./lib/logger";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { productionSecurityProfile } from "./middlewares/productionSecurityProfile";
import { requireAuth } from "./routes/_auth";

function parseOrigins(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const app = express();

const allowedOrigins = parseOrigins(process.env.SECURITY_API_ALLOWED_ORIGINS);

if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  throw new Error(
    "SECURITY_API_ALLOWED_ORIGINS is required for security-api production",
  );
}

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, false);

      if (allowedOrigins.includes(origin)) {
        return cb(null, true);
      }

      logger.warn({ origin }, "Blocked security-api CORS origin");
      return cb(new Error("CORS origin not allowed"));
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

app.use(clerkMiddleware());
app.use(productionSecurityProfile);

app.get("/api/healthz", (_req, res) => {
  res.json({
    ok: true,
    service: "security-api",
  });
});

app.use("/api", requireAuth);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
