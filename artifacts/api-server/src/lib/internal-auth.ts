import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { appendAuditEvent } from "./audit-chain";

function isLoopback(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
}

export function internalSecretBypass(req: Request, res: Response, next: NextFunction) {
  const internalSecret = req.headers["x-internal-secret"];
  const sessionSecret = process.env.SESSION_SECRET ?? "";
  const ip = req.ip ?? req.socket.remoteAddress ?? "unknown";

  if (!internalSecret) return next();
  if (typeof internalSecret !== "string" || sessionSecret.length < 32) {
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
  if (internalSecret.length !== sessionSecret.length) return res.status(401).json({ error: "Invalid internal auth" });
  const ok = crypto.timingSafeEqual(Buffer.from(internalSecret), Buffer.from(sessionSecret));
  if (!ok) return res.status(401).json({ error: "Invalid internal auth" });

  (req as any).internalBypass = true;
  appendAuditEvent({ actor: ip, action: "internal_bypass_used", resource: req.path, result: "allow" });
  next();
}
