import type { Request, Response, NextFunction } from "express";

export function productionSecurityProfile(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV !== "production") return next();

  const origin  = req.headers.origin;
  const allowed = (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  if (origin && allowed.length > 0 && !allowed.includes(origin)) {
    return res.status(403).json({ error: "Origin not allowed in production" });
  }

  // Internal-secret header must never come from a browser-origin request
  if (req.headers["x-internal-secret"] && origin) {
    return res.status(403).json({ error: "Internal authentication is not accepted from browser-origin requests" });
  }

  res.setHeader("X-Production-Security-Profile", "strict");
  next();
}
