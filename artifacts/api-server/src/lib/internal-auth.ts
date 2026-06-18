import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { appendAuditEvent } from "./audit-chain";

function isLoopback(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

// INTERNAL_SECRET is the correct env var for inter-service auth.
// SESSION_SECRET is for session cookie signing only — do not conflate the two.
// Falls back to SESSION_SECRET with a deprecation warning for backward compat.
function getInternalSecret(): string {
  if (process.env.INTERNAL_SECRET) return process.env.INTERNAL_SECRET;
  if (process.env.SESSION_SECRET) {
    // Log once per process start — avoid spamming per-request
    if (!(getInternalSecret as any)._warned) {
      (getInternalSecret as any)._warned = true;
      import("./logger").then(({ logger }) =>
        logger.warn("INTERNAL_SECRET not set — falling back to SESSION_SECRET. Set INTERNAL_SECRET to separate concerns."),
      );
    }
    return process.env.SESSION_SECRET;
  }
  return "";
}

export function internalSecretBypass(req: Request, res: Response, next: NextFunction) {
  const header = req.headers["x-internal-secret"];
  const secret = getInternalSecret();
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

  if (!header) return next();
  if (typeof header !== "string" || secret.length < 32) {
    return res.status(401).json({ error: "Invalid internal auth" });
  }
  // In production, only accept internal bypass from loopback addresses
  if (process.env.NODE_ENV === "production" && !isLoopback(ip)) {
    appendAuditEvent({ actor: ip, action: "internal_bypass_denied", resource: req.path, result: "deny", metadata: { reason: "non_loopback" } });
    return res.status(403).json({ error: "Internal auth requires mTLS/private service identity in production" });
  }
  // Reject if request has a browser Origin header (prevents CSRF exploitation)
  if (req.headers.origin) {
    return res.status(403).json({ error: "Internal authentication is not accepted from browser-origin requests" });
  }
  if (header.length !== secret.length) return res.status(401).json({ error: "Invalid internal auth" });
  const ok = crypto.timingSafeEqual(Buffer.from(header), Buffer.from(secret));
  if (!ok) return res.status(401).json({ error: "Invalid internal auth" });

  (req as any).internalBypass = true;
  appendAuditEvent({ actor: ip, action: "internal_bypass_used", resource: req.path, result: "allow" });
  next();
}
