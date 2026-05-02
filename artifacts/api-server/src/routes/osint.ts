// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response } from "express";
import dns from "dns/promises";
import https from "https";
import http from "http";
import tls from "tls";
import { URL } from "url";

const router = Router();

function fetchHead(urlStr: string, timeoutMs = 6000): Promise<{ status: number; headers: Record<string, string> } | null> {
  return new Promise(resolve => {
    try {
      const parsed = new URL(urlStr);
      const mod = parsed.protocol === "https:" ? https : http;
      const req = mod.request(
        {
          host: parsed.hostname,
          path: parsed.pathname || "/",
          port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
          method: "HEAD",
          headers: { "User-Agent": "Mozilla/5.0 ProxhqVPN-OSINT/1.0" },
          timeout: timeoutMs,
          rejectUnauthorized: false,
        },
        res => {
          const headers: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            if (typeof v === "string") headers[k.toLowerCase()] = v;
            else if (Array.isArray(v)) headers[k.toLowerCase()] = v[0];
          }
          res.destroy();
          resolve({ status: res.statusCode || 0, headers });
        }
      );
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
      req.end();
    } catch {
      resolve(null);
    }
  });
}

function getTlsCert(hostname: string): Promise<{
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  daysLeft: number;
  protocol: string;
  sans: string[];
} | null> {
  return new Promise(resolve => {
    try {
      const sock = tls.connect({ host: hostname, port: 443, rejectUnauthorized: false, timeout: 6000 }, () => {
        const cert = sock.getPeerCertificate(true);
        const protocol = sock.getProtocol() || "unknown";
        if (!cert || !cert.subject) { sock.destroy(); return resolve(null); }
        const validTo = cert.valid_to ? new Date(cert.valid_to) : new Date(0);
        const daysLeft = Math.floor((validTo.getTime() - Date.now()) / 86_400_000);
        const sans: string[] = [];
        if (cert.subjectaltname) {
          cert.subjectaltname.split(",").forEach(s => {
            const m = s.trim().match(/DNS:(.+)/);
            if (m) sans.push(m[1]);
          });
        }
        sock.destroy();
        resolve({
          subject: (cert.subject?.CN as string | undefined) || hostname,
          issuer: ((cert.issuer?.O || cert.issuer?.CN) as string | undefined) || "unknown",
          validFrom: cert.valid_from || "",
          validTo: cert.valid_to || "",
          daysLeft,
          protocol,
          sans,
        });
      });
      sock.on("error", () => resolve(null));
      sock.on("timeout", () => { sock.destroy(); resolve(null); });
    } catch {
      resolve(null);
    }
  });
}

router.post("/lookup", async (req: Request, res: Response) => {
  let { target } = req.body as { target: string };
  if (!target) return res.status(400).json({ error: "target required" });

  target = target.trim().replace(/^https?:\/\//, "").replace(/\/.*/, "").toLowerCase();

  if (target === "localhost" || target.startsWith("127.") || target.startsWith("192.168.") || target.startsWith("10.")) {
    return res.status(400).json({ error: "Private/internal targets not allowed" });
  }

  const result: Record<string, unknown> = { target, timestamp: new Date().toISOString() };

  const tasks = await Promise.allSettled([
    dns.resolve4(target).catch(() => [] as string[]),
    dns.resolve6(target).catch(() => [] as string[]),
    dns.resolveMx(target).catch(() => []),
    dns.resolveTxt(target).catch(() => []),
    dns.resolveNs(target).catch(() => [] as string[]),
    dns.resolveCname(target).catch(() => [] as string[]),
    dns.reverse(target).catch(() => [] as string[]),
    fetchHead(`https://${target}`),
    getTlsCert(target),
  ]);

  const [ipv4, ipv6, mx, txt, ns, cname, reverse, httpHead, tlsCert] = tasks.map(r =>
    r.status === "fulfilled" ? r.value : null
  );

  result.dns = {
    a: ipv4 || [],
    aaaa: ipv6 || [],
    mx: Array.isArray(mx) ? mx.map((m: any) => ({ exchange: m.exchange, priority: m.priority })) : [],
    txt: Array.isArray(txt) ? txt.flat() : [],
    ns: ns || [],
    cname: cname || [],
    ptr: reverse || [],
  };

  if (httpHead) {
    result.http = {
      status: (httpHead as any).status,
      server: (httpHead as any).headers?.server || null,
      poweredBy: (httpHead as any).headers?.["x-powered-by"] || null,
      contentType: (httpHead as any).headers?.["content-type"] || null,
      via: (httpHead as any).headers?.["via"] || null,
      cdn: detectCdn((httpHead as any).headers || {}),
      hasHsts: !!(httpHead as any).headers?.["strict-transport-security"],
      hasCsp: !!(httpHead as any).headers?.["content-security-policy"],
      hasCors: !!(httpHead as any).headers?.["access-control-allow-origin"],
    };
  }

  if (tlsCert) {
    result.tls = tlsCert;
  }

  const ipList: string[] = Array.isArray(ipv4) && (ipv4 as unknown[]).length > 0 ? (ipv4 as string[]) : [];
  if (ipList.length > 0) {
    result.ip = {
      primary: ipList[0],
      all: ipList,
      asn: inferAsn(ipList[0]),
      isCloudflare: ipList.some(isCloudflareIp),
      isAws: ipList.some(ip => isAwsIp(ip)),
    };
  }

  const txtRecords = Array.isArray(txt) ? (txt as string[][]).flat() : [];
  result.email = {
    mxCount: Array.isArray(mx) ? mx.length : 0,
    hasDkim: txtRecords.some(t => t.includes("v=DKIM1")),
    hasDmarc: false,
    hasSpf: txtRecords.some(t => t.includes("v=spf1")),
  };

  try {
    const dmarcRecords = await dns.resolveTxt(`_dmarc.${target}`).catch(() => []);
    result.email = { ...(result.email as Record<string, unknown>), hasDmarc: (dmarcRecords as string[][]).flat().some(t => t.includes("v=DMARC1")) };
  } catch {}

  result.exposure = {
    emailSecurity: buildEmailSecurity(result.email as Record<string, boolean>),
    tlsRisk: buildTlsRisk(tlsCert),
    headerRisk: buildHeaderRisk(httpHead ? (httpHead as any).headers : {}),
    subdomainsInCert: tlsCert && Array.isArray((tlsCert as any).sans) ? (tlsCert as any).sans : [],
  };

  res.json(result);
});

function detectCdn(headers: Record<string, string>): string | null {
  const cf = headers["cf-ray"] || headers["cf-cache-status"];
  if (cf) return "Cloudflare";
  const f = headers["x-served-by"] || headers["x-fastly-request-id"];
  if (f) return "Fastly";
  const ak = headers["x-akamai-transformed"] || headers["x-check-cacheable"];
  if (ak) return "Akamai";
  const via = headers["via"] || "";
  if (via.includes("CloudFront")) return "AWS CloudFront";
  if (via.includes("Varnish") || via.includes("nginx")) return via.includes("Varnish") ? "Varnish" : "nginx";
  return null;
}

function inferAsn(ip: string): string {
  if (!ip) return "Unknown";
  const oct = ip.split(".").map(Number);
  if (oct[0] === 172 && oct[1] >= 16 && oct[1] <= 31) return "RFC1918 Private";
  if ((oct[0] === 104 && oct[1] >= 16 && oct[1] <= 31) || (oct[0] === 172 && oct[1] >= 64 && oct[1] <= 71)) return "AS13335 Cloudflare";
  if (oct[0] === 54 || oct[0] === 52 || (oct[0] === 3 && oct[1] < 128)) return "AS14618 Amazon AWS";
  if (oct[0] === 34 || oct[0] === 35) return "AS15169 Google Cloud";
  if (oct[0] === 40 || oct[0] === 13) return "AS8075 Microsoft Azure";
  return "Unknown ASN";
}

function isCloudflareIp(ip: string): boolean {
  const oct = ip.split(".").map(Number);
  return (oct[0] === 104 && oct[1] >= 16 && oct[1] <= 31) || (oct[0] === 172 && oct[1] >= 64 && oct[1] <= 71);
}

function isAwsIp(ip: string): boolean {
  const oct = ip.split(".").map(Number);
  return oct[0] === 54 || oct[0] === 52 || (oct[0] === 3 && oct[1] < 128);
}

function buildEmailSecurity(email: Record<string, boolean>) {
  const score = (email.hasDkim ? 33 : 0) + (email.hasDmarc ? 34 : 0) + (email.hasSpf ? 33 : 0);
  return { score, hasDkim: email.hasDkim, hasDmarc: email.hasDmarc, hasSpf: email.hasSpf };
}

function buildTlsRisk(cert: unknown) {
  if (!cert) return { risk: "high", reason: "TLS certificate not found or unreachable" };
  const c = cert as { daysLeft: number; protocol: string };
  if (c.daysLeft <= 0) return { risk: "critical", reason: "Certificate expired" };
  if (c.daysLeft <= 30) return { risk: "high", reason: `Certificate expires in ${c.daysLeft} days` };
  if (/TLSv1$|TLSv1\.0|TLSv1\.1|SSL/.test(c.protocol)) return { risk: "high", reason: `Outdated TLS: ${c.protocol}` };
  return { risk: "low", reason: `Valid certificate, ${c.daysLeft} days remaining, ${c.protocol}` };
}

function buildHeaderRisk(headers: Record<string, string>) {
  const missing = [];
  if (!headers["strict-transport-security"]) missing.push("HSTS");
  if (!headers["content-security-policy"]) missing.push("CSP");
  if (!headers["x-frame-options"]) missing.push("X-Frame-Options");
  if (!headers["x-content-type-options"]) missing.push("X-Content-Type-Options");
  const corsWild = headers["access-control-allow-origin"] === "*";
  return {
    risk: missing.length >= 3 ? "high" : missing.length >= 1 ? "medium" : "low",
    missingHeaders: missing,
    corsWildcard: corsWild,
  };
}

export default router;
