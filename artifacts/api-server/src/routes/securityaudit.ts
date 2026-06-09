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
    // ── RESOLVED / PATCHED ────────────────────────────────────────────────────
    {
      category: "Authentication",
      severity: "info",
      title: "✅ All API routes protected by Clerk session auth",
      description: "Every /api/* route (except /api/healthz and /api/daemon-inbound/*) requires a valid Clerk session token enforced by requireAuth middleware. Unauthenticated requests receive 401.",
      remediation: "No action needed. Review daemon-inbound/* PSK enforcement separately.",
    },
    {
      category: "Data Protection",
      severity: "info",
      title: "✅ WireGuard client keys encrypted at rest (AES-256-GCM)",
      description: "User WireGuard private keys and PSKs are stored AES-256-GCM encrypted in the database using envelope encryption. Plaintext never persists — only encrypted ciphertext (clientPrivateKeyEnc, pskKeyEnc). Master key in PROXHQ_MASTER_KEY_B64 env var.",
      remediation: "No action needed. Run POST /api/wireguard/backfill-encryption to encrypt any legacy plaintext rows.",
    },
    {
      category: "Audit",
      severity: "info",
      title: "✅ Tamper-evident SHA3-256 audit chain active",
      description: "Security events are recorded in a SHA3-256 hash chain with HMAC-SHA512 per-entry signatures. The chain is append-only — any modification of past entries is detectable via verifyChain(). Audit HMAC key in AUDIT_HMAC_KEY_B64 env var.",
      remediation: "No action needed. Export and verify the chain periodically via GET /api/security-audit/audit-chain.",
    },
    {
      category: "Zero Trust",
      severity: "info",
      title: "✅ ZTNA device posture scoring deployed",
      description: "POST /api/ztna/posture evaluates 8 device signals (disk encryption, firewall, EDR, root/jailbreak, patch age, certificate, IP reputation) and produces a 0–100 trust score. Score < 75 = deny. Results persisted to ztna_devices table with per-decision audit + SIEM events.",
      remediation: "Enforce pre-tunnel posture check in the VPN client before activating WireGuard tunnels.",
    },

    // ── OPEN FINDINGS ─────────────────────────────────────────────────────────
    {
      category: "Zero Trust",
      severity: "high",
      title: "ZTNA posture check not yet enforced pre-tunnel",
      description: "The ZTNA posture API exists and scores devices correctly, but the VPN client does not currently require a passing posture check before generating a WireGuard config. A device with score < 75 (rooted, unpatched, invalid cert) can still obtain a config.",
      remediation: "Add a client-side posture check step before the 'Generate WireGuard Config' button in the mobile and web clients. Block config generation if allow=false.",
    },
    {
      category: "Authorization",
      severity: "medium",
      title: "RBAC roles defined but not yet applied to admin routes",
      description: "The 6-role RBAC model (owner/security_admin/network_admin/auditor/support/user) is implemented in lib/rbac.ts with requirePermission() helper, but the existing admin routes use coarse requireAdmin/requireAccess middleware instead. Fine-grained role enforcement is not yet in place.",
      remediation: "Wire requirePermission() to admin routes: audit export should require audit:export, user management should require admin:write, config changes should require vpn:write.",
    },
    {
      category: "Audit",
      severity: "medium",
      title: "Audit chain coverage incomplete — key routes not instrumented",
      description: "appendAuditEvent() is only called from /api/ztna/posture. High-value events (WireGuard config generation, key downloads, daemon wg-key delivery, admin user changes, firewall rule changes) are not yet recorded in the audit chain.",
      remediation: "Add appendAuditEvent() + shipSecurityEvent() calls to wireguard.ts (config gen + key download), daemon-inbound.ts (wg-key), admin-users.ts (role changes), and firewall.ts (rule changes).",
    },
    {
      category: "Authorization",
      severity: "medium",
      title: "Terminal route allows OS command execution",
      description: "The /api/terminal/exec endpoint executes shell commands on the server. ProxhqVPN Mode bypasses the command allowlist (all commands still logged). Break-glass token provides emergency access. This is a privileged admin feature.",
      remediation: "Restrict terminal access to owner/security_admin roles via RBAC. Ensure terminal is only accessible over an authenticated, rate-limited session.",
    },
    {
      category: "Transport",
      severity: "medium",
      title: "HTTP-only (no TLS) in standalone mode",
      description: "The standalone server listens on plain HTTP by default. Replit-hosted deployment uses HTTPS via the Replit proxy.",
      remediation: "For self-hosted standalone: place nginx/caddy TLS reverse proxy in front, or access the management UI over WireGuard tunnel only.",
    },
    {
      category: "Rate Limiting",
      severity: "low",
      title: "Rate limiting is IP-based (bypassable with proxies)",
      description: "The rate limiter uses client IP. Attackers behind rotating VPNs/proxies can partially bypass limits. Session-level limits are not implemented.",
      remediation: "Add per-session rate limiting using Clerk userId as the key on sensitive routes (key generation, posture check, terminal exec).",
    },
    {
      category: "SQL Injection",
      severity: "info",
      title: "✅ Local DB protected against SQL injection",
      description: "Local DB query endpoint enforces SELECT-only, strips comments, and uses the pg driver's parameterized query interface. External DB connections use parameterized queries throughout.",
      remediation: "No action needed.",
    },
    {
      category: "CSP",
      severity: "low",
      title: "Inline scripts allowed in CSP",
      description: "The Content-Security-Policy allows 'unsafe-inline' for scripts (required by Vite dev mode). This slightly weakens XSS protection in development.",
      remediation: "Use nonce-based CSP in production deployments. Vite supports nonce injection in build mode.",
    },
    {
      category: "Secrets",
      severity: "low",
      title: "Security env vars should be verified on startup",
      description: "PROXHQ_MASTER_KEY_B64, AUDIT_HMAC_KEY_B64, and BREAK_GLASS_TOKEN are required for full security. A missing or default-value key silently degrades security in development.",
      remediation: "Add a startup assertion that fails hard in production if these vars are missing or contain dev-placeholder values.",
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
