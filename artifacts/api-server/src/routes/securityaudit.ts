// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import fetch from "node-fetch";
import crypto from "crypto";
import tls from "tls";

const router = Router();

// ─── SSL/TLS Certificate Inspector ───────────────────────────────────────────
router.post("/cert-inspect", async (req, res) => {
  const { host, port = 443 } = req.body as { host?: string; port?: number };
  if (!host) return res.status(400).json({ error: "host is required" });

  const startMs = Date.now();
  try {
    const cert = await new Promise<tls.PeerCertificate>((resolve, reject) => {
      const sock = tls.connect(
        { host, port: Number(port), rejectUnauthorized: false, servername: host },
        () => {
          const c = sock.getPeerCertificate(true);
          sock.destroy();
          resolve(c);
        }
      );
      sock.setTimeout(8000);
      sock.on("timeout", () => reject(new Error("Timeout")));
      sock.on("error", reject);
    });

    const now = Date.now();
    const validFrom   = cert.valid_from  ? new Date(cert.valid_from).getTime()  : 0;
    const validTo     = cert.valid_to    ? new Date(cert.valid_to).getTime()    : 0;
    const daysLeft    = Math.floor((validTo - now) / 86_400_000);
    const isExpired   = daysLeft < 0;
    const isExpiringSoon = daysLeft >= 0 && daysLeft < 30;
    const fingerprint = (cert as any).fingerprint256 ?? (cert as any).fingerprint ?? "unknown";

    const subjectAltNames: string[] = [];
    if ((cert as any).subjectaltname) {
      for (const part of (cert as any).subjectaltname.split(",")) {
        const m = part.trim().match(/^DNS:(.+)/);
        if (m) subjectAltNames.push(m[1]);
      }
    }

    const issues: string[] = [];
    if (isExpired)        issues.push("CRITICAL: Certificate has expired.");
    if (isExpiringSoon)   issues.push(`WARNING: Certificate expires in ${daysLeft} days.`);
    if (cert.subject?.CN?.includes("*") && subjectAltNames.length === 0)
      issues.push("INFO: Wildcard cert with no SANs — may fail strict clients.");
    if (cert.issuer?.CN === cert.subject?.CN)
      issues.push("INFO: Self-signed certificate.");

    res.json({
      host, port,
      subject:   cert.subject,
      issuer:    cert.issuer,
      validFrom: cert.valid_from,
      validTo:   cert.valid_to,
      daysLeft,
      isExpired,
      isExpiringSoon,
      fingerprint,
      subjectAltNames,
      serialNumber:   (cert as any).serialNumber,
      signatureAlgorithm: (cert as any).sigalg ?? "unknown",
      bits:           (cert as any).bits ?? null,
      issues,
      status:         isExpired ? "expired" : isExpiringSoon ? "expiring" : "valid",
      durationMs:     Date.now() - startMs,
      inspectedAt:    new Date().toISOString(),
    });
  } catch (err: any) {
    res.json({ host, port, error: err.message, inspectedAt: new Date().toISOString() });
  }
});

// ─── HTTP Security Headers Inspector ─────────────────────────────────────────
router.post("/headers-inspect", async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) return res.status(400).json({ error: "url required" });

  const startMs = Date.now();
  try {
    const resp = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": "ProxhqVPN-SecurityAudit/3.0" },
    });

    const headers: Record<string, string> = {};
    resp.headers.forEach((v, k) => { headers[k] = v; });

    const checks: { header: string; present: boolean; value?: string; severity: "critical"|"high"|"medium"|"low"; recommendation: string }[] = [
      {
        header: "Strict-Transport-Security",
        present: !!headers["strict-transport-security"],
        value: headers["strict-transport-security"],
        severity: "high",
        recommendation: "Add: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
      },
      {
        header: "Content-Security-Policy",
        present: !!headers["content-security-policy"],
        value: headers["content-security-policy"],
        severity: "high",
        recommendation: "Add CSP to prevent XSS: Content-Security-Policy: default-src 'self'",
      },
      {
        header: "X-Frame-Options",
        present: !!headers["x-frame-options"],
        value: headers["x-frame-options"],
        severity: "medium",
        recommendation: "Add: X-Frame-Options: DENY to prevent clickjacking",
      },
      {
        header: "X-Content-Type-Options",
        present: !!headers["x-content-type-options"],
        value: headers["x-content-type-options"],
        severity: "medium",
        recommendation: "Add: X-Content-Type-Options: nosniff",
      },
      {
        header: "Referrer-Policy",
        present: !!headers["referrer-policy"],
        value: headers["referrer-policy"],
        severity: "low",
        recommendation: "Add: Referrer-Policy: no-referrer or strict-origin-when-cross-origin",
      },
      {
        header: "Permissions-Policy",
        present: !!headers["permissions-policy"],
        value: headers["permissions-policy"],
        severity: "low",
        recommendation: "Add: Permissions-Policy: camera=(), microphone=(), geolocation=()",
      },
      {
        header: "X-XSS-Protection",
        present: !!headers["x-xss-protection"],
        value: headers["x-xss-protection"],
        severity: "low",
        recommendation: "Add: X-XSS-Protection: 1; mode=block (legacy browsers)",
      },
    ];

    const missing = checks.filter(c => !c.present);
    const score = Math.round((checks.filter(c => c.present).length / checks.length) * 100);

    res.json({
      url,
      status: resp.status,
      finalUrl: resp.url,
      allHeaders: headers,
      securityHeaders: checks,
      missingCount: missing.length,
      score,
      grade: score >= 90 ? "A" : score >= 75 ? "B" : score >= 50 ? "C" : "F",
      criticalMissing: missing.filter(c => c.severity === "critical" || c.severity === "high"),
      durationMs: Date.now() - startMs,
      inspectedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    res.json({ url, error: err.message, inspectedAt: new Date().toISOString() });
  }
});

// ─── ProxhqVPN self-audit ──────────────────────────────────────────────────────
router.get("/self-audit", (_req, res) => {
  const findings: { category: string; severity: "critical"|"high"|"medium"|"low"|"info"; title: string; description: string; remediation: string }[] = [
    {
      category: "Authentication",
      severity: "high",
      title: "No authentication on API endpoints",
      description: "All /api/* endpoints are publicly accessible without credentials. This is intentional for the standalone self-hosted deployment model but should be secured behind a network boundary or VPN.",
      remediation: "Deploy behind WireGuard VPN access, or enable the API_KEY env var to require bearer token auth on all requests.",
    },
    {
      category: "Authorization",
      severity: "medium",
      title: "Terminal route allows OS command execution",
      description: "The /api/terminal/exec endpoint executes shell commands. GhostMode bypasses the allowlist. This is a privileged feature.",
      remediation: "Enable API_KEY auth. Only expose ProxhqVPN on a private network. The terminal is designed for trusted admin use only.",
    },
    {
      category: "Data Protection",
      severity: "low",
      title: "WireGuard private keys stored in database",
      description: "Node private keys are stored in the database in plaintext. This is required for config generation but should be secured.",
      remediation: "Encrypt the database file at rest using SQLCipher (standalone) or column-level encryption (PostgreSQL).",
    },
    {
      category: "Transport",
      severity: "medium",
      title: "HTTP-only (no TLS) in standalone mode",
      description: "The standalone server listens on plain HTTP by default. Traffic between client browser and ProxhqVPN server is unencrypted.",
      remediation: "Use HTTPS by placing a reverse proxy (nginx/caddy) with TLS in front, or use the WireGuard tunnel to access the management UI.",
    },
    {
      category: "Rate Limiting",
      severity: "low",
      title: "Rate limiting is IP-based (bypassable with proxies)",
      description: "The current rate limiter uses client IP. Attackers behind VPNs/proxies can rotate IPs to bypass limits.",
      remediation: "Add per-session or API-key based rate limiting in addition to IP-based limits.",
    },
    {
      category: "SQL Injection",
      severity: "info",
      title: "Local DB protected against SQL injection",
      description: "The local DB query endpoint strips comments, enforces SELECT-only, and uses parameterized queries where possible.",
      remediation: "No action needed. External DB queries use the pg driver's parameterized query interface.",
    },
    {
      category: "CSP",
      severity: "low",
      title: "Inline scripts allowed in CSP",
      description: "The Content-Security-Policy allows 'unsafe-inline' for scripts (required by Vite). This slightly weakens XSS protection.",
      remediation: "Use nonce-based CSP in production deployments. Vite supports nonce injection in build mode.",
    },
    {
      category: "Secrets",
      severity: "medium",
      title: "Session secret should be set via environment variable",
      description: "If SESSION_SECRET is not set, a randomly generated value is used per-restart, invalidating all sessions.",
      remediation: "Set SESSION_SECRET to a 64-character random hex string in your .env or system environment.",
    },
  ];

  const bySeverity = (s: string) => findings.filter(f => f.severity === s);

  res.json({
    findings,
    summary: {
      critical: bySeverity("critical").length,
      high:     bySeverity("high").length,
      medium:   bySeverity("medium").length,
      low:      bySeverity("low").length,
      info:     bySeverity("info").length,
      total:    findings.length,
    },
    overallRisk: "MEDIUM",
    auditedAt: new Date().toISOString(),
    version: "ProxhqVPN v3.0",
    note: "This is a self-hosted security research platform. It is intended to be deployed on a private network or accessed only via VPN.",
  });
});

// ─── WHOIS lookup ────────────────────────────────────────────────────────────
router.post("/whois", async (req, res) => {
  const { target } = req.body as { target?: string };
  if (!target) return res.status(400).json({ error: "target required" });

  try {
    const { stdout } = await (async () => {
      const { exec } = await import("child_process");
      const { promisify } = await import("util");
      return promisify(exec)(`whois ${target.replace(/[^a-zA-Z0-9.\-]/g, "")}`, { timeout: 10000 });
    })();
    res.json({ target, result: stdout, queriedAt: new Date().toISOString() });
  } catch (err: any) {
    // Fallback: use RDAP
    try {
      const rdap = await fetch(`https://rdap.org/domain/${target}`, { signal: AbortSignal.timeout(8000) });
      const data = await rdap.json() as any;
      res.json({ target, result: JSON.stringify(data, null, 2), source: "rdap.org", queriedAt: new Date().toISOString() });
    } catch {
      res.json({ target, error: err.message, queriedAt: new Date().toISOString() });
    }
  }
});

export default router;
