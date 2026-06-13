// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Deception Engine — ADMIN / SECURITY_ADMIN / NETWORK_ADMIN ONLY.
// Regular subscribers (role: "user") and support staff see NONE of this.
//
// What this does:
//  • Serves fake service banners (SSH / HTTP / FTP / SMTP / Telnet) that look
//    like real vulnerable services to attract and fingerprint attackers.
//  • Tarpits connections (intentional delays to waste attacker resources).
//  • Passively captures full attacker fingerprint: IP, headers, OS guess,
//    ASN, geo, timing, request body, any credential attempts, scan tool signatures.
//  • Stores every event in deception_events table (admin-only read).
//  • Canary token endpoints that register a hit the instant they are touched.
//
// NOTHING here executes code on remote systems. This is purely defensive.

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { appendAuditEvent } from "../lib/audit-chain";
import { shipSecurityEvent } from "../lib/siem";
import { requireRbac } from "../middlewares/requireRbac";
import { deceptionEventsTable, deceptionBannersTable } from "@workspace/db/schema";
import { desc, eq, and, gte, sql } from "drizzle-orm";
import { randomUUID } from "crypto";
import https from "https";
import http from "http";

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAttackerIp(req: Request): string {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return (Array.isArray(xff) ? xff[0] : xff).split(",")[0].trim();
  return req.socket.remoteAddress ?? "unknown";
}

/** Guess OS from TTL heuristics (TTL seen in x-real-ip or cf-connecting-ip context is HTTP-layer only;
 *  for HTTP honeypots we infer from User-Agent and Accept-Language instead). */
function inferOs(ua: string, ttlHint?: number): string {
  const u = (ua ?? "").toLowerCase();
  if (u.includes("windows nt 10"))   return "Windows 10/11";
  if (u.includes("windows nt 6.1"))  return "Windows 7";
  if (u.includes("windows nt 6.3"))  return "Windows 8.1";
  if (u.includes("windows"))         return "Windows (unknown version)";
  if (u.includes("iphone") || u.includes("ipad")) return "iOS";
  if (u.includes("android"))         return "Android";
  if (u.includes("mac os x"))        return "macOS";
  if (u.includes("linux") && u.includes("x86_64")) return "Linux x86_64";
  if (u.includes("linux"))           return "Linux";
  if (u.includes("curl"))            return "Linux/curl (scripted)";
  if (u.includes("python"))          return "Python script";
  if (u.includes("go-http-client"))  return "Go script";
  if (u.includes("masscan"))         return "Masscan (scanner)";
  if (u.includes("zgrab"))           return "ZGrab (scanner)";
  if (u.includes("shodan"))          return "Shodan crawler";
  if (u.includes("censys"))          return "Censys crawler";
  if (ttlHint !== undefined) {
    if (ttlHint <= 64)  return "Linux/Unix (TTL≤64)";
    if (ttlHint <= 128) return "Windows (TTL≤128)";
    if (ttlHint <= 255) return "Network device (TTL≤255)";
  }
  return "Unknown";
}

/** Detect scanner/tool signatures in headers and UA */
function detectScanPatterns(req: Request): string[] {
  const ua    = (req.headers["user-agent"] ?? "").toLowerCase();
  const hdrs  = JSON.stringify(req.headers).toLowerCase();
  const tags: string[] = [];
  if (ua.includes("masscan"))     tags.push("masscan");
  if (ua.includes("zgrab"))       tags.push("zgrab");
  if (ua.includes("shodan"))      tags.push("shodan-crawler");
  if (ua.includes("censys"))      tags.push("censys-crawler");
  if (ua.includes("nmap"))        tags.push("nmap");
  if (ua.includes("nikto"))       tags.push("nikto");
  if (ua.includes("sqlmap"))      tags.push("sqlmap");
  if (ua.includes("dirbuster") || ua.includes("gobuster") || ua.includes("ffuf")) tags.push("dir-bruteforce");
  if (ua.includes("nuclei"))      tags.push("nuclei-scanner");
  if (ua.includes("metasploit"))  tags.push("metasploit");
  if (ua.includes("hydra"))       tags.push("hydra-bruteforce");
  if (ua.includes("python-requests")) tags.push("python-script");
  if (ua.includes("go-http"))     tags.push("go-script");
  if (ua.includes("curl/"))       tags.push("curl-script");
  if (hdrs.includes("x-scanner") || hdrs.includes("x-scan-memo")) tags.push("explicit-scanner-header");
  // WordPress/CMS scanning
  if (req.url?.includes("wp-login") || req.url?.includes("wp-admin")) tags.push("wordpress-scan");
  if (req.url?.includes(".env") || req.url?.includes("config.php")) tags.push("config-exposure-scan");
  if (req.url?.includes("phpmyadmin") || req.url?.includes("pma/"))  tags.push("phpmyadmin-scan");
  if (req.url?.includes("/admin") || req.url?.includes("/administrator")) tags.push("admin-panel-scan");
  if (req.url?.includes("actuator") || req.url?.includes("spring")) tags.push("spring-actuator-scan");
  return tags;
}

/** Calculate threat score 0-100 */
function calcThreatScore(tags: string[], ua: string, path: string): number {
  let score = 20; // baseline — any honeypot hit is suspicious
  const highRisk = ["masscan", "zgrab", "shodan-crawler", "censys-crawler", "nmap", "nikto", "sqlmap",
    "metasploit", "hydra-bruteforce", "nuclei-scanner"];
  const medRisk  = ["dir-bruteforce", "python-script", "go-script", "wordpress-scan",
    "config-exposure-scan", "phpmyadmin-scan", "spring-actuator-scan", "admin-panel-scan"];
  for (const t of tags) {
    if (highRisk.includes(t)) score += 30;
    else if (medRisk.includes(t)) score += 15;
    else score += 5;
  }
  // Path-based boosts
  if (path?.includes("passwd") || path?.includes("shadow") || path?.includes("etc/")) score += 20;
  if (path?.includes("shell") || path?.includes("cmd") || path?.includes("exec"))     score += 25;
  return Math.min(score, 100);
}

/** Passive ASN / geo lookup via ip-api.com (free tier, no key required) */
async function geoLookup(ip: string): Promise<{
  asn: string | null; asnOrg: string | null; country: string | null;
  city: string | null; isp: string | null; isProxy: boolean; hostName: string | null;
}> {
  const empty = { asn: null, asnOrg: null, country: null, city: null, isp: null, isProxy: false, hostName: null };
  if (!ip || ip === "unknown" || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) return empty;
  return new Promise(resolve => {
    const url = `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,as,org,country,city,isp,proxy,hosting,query,reverse`;
    const timer = setTimeout(() => resolve(empty), 5000);
    const req = http.get(url, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", c => { body += c; });
      res.on("end", () => {
        clearTimeout(timer);
        try {
          const d = JSON.parse(body);
          if (d.status !== "success") return resolve(empty);
          resolve({
            asn:      d.as ?? null,
            asnOrg:   d.org ?? null,
            country:  d.country ?? null,
            city:     d.city ?? null,
            isp:      d.isp ?? null,
            isProxy:  !!(d.proxy || d.hosting),
            hostName: d.reverse ?? null,
          });
        } catch { resolve(empty); }
      });
      res.on("error", () => { clearTimeout(timer); resolve(empty); });
    });
    req.on("error", () => { clearTimeout(timer); resolve(empty); });
  });
}

/** Check if IP is a known Tor exit node (via dan.me.uk text list) */
async function isTorExit(ip: string): Promise<boolean> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(false), 4000);
    const req = https.get(`https://check.torproject.org/exit-addresses`, res => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", c => { if (body.length < 200000) body += c; });
      res.on("end", () => { clearTimeout(timer); resolve(body.includes(ip)); });
      res.on("error", () => { clearTimeout(timer); resolve(false); });
    });
    req.on("error", () => { clearTimeout(timer); resolve(false); });
  });
}

/** Capture any credential strings from login-looking POST bodies */
function extractCreds(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const credKeys = ["username", "user", "login", "email", "password", "pass", "pwd",
    "pma_username", "pma_password", "j_username", "j_password", "admin_user", "admin_pass"];
  const found: Record<string, string> = {};
  for (const k of credKeys) {
    if (b[k] !== undefined && b[k] !== null && String(b[k]).length < 200) {
      found[k] = String(b[k]);
    }
  }
  return Object.keys(found).length > 0 ? JSON.stringify(found) : null;
}

/** Get the correct fake banner for a service type from DB (cached for 60s) */
let bannerCache: Map<string, { content: string; headersJson: string | null; delayMs: number }> = new Map();
let bannerCacheTs = 0;

async function getBanner(serviceType: string): Promise<{ content: string; headers: Record<string, string>; delayMs: number } | null> {
  const now = Date.now();
  if (now - bannerCacheTs > 60000) {
    const rows = await db.select().from(deceptionBannersTable).where(eq(deceptionBannersTable.isActive, true));
    bannerCache.clear();
    for (const r of rows) bannerCache.set(r.serviceType, { content: r.bannerContent, headersJson: r.headersJson, delayMs: r.delayMs ?? 0 });
    bannerCacheTs = now;
  }
  const b = bannerCache.get(serviceType);
  if (!b) return null;
  let headers: Record<string, string> = {};
  try { if (b.headersJson) headers = JSON.parse(b.headersJson); } catch {}
  return { content: b.content, headers, delayMs: b.delayMs };
}

/** Core event recorder — logs everything to DB, runs geo/Tor in parallel */
async function recordAttack(req: Request, serviceType: string, extra: {
  fakeBannerServed?: string;
  tarpitMs?: number;
  capturedCreds?: string | null;
} = {}): Promise<void> {
  const ip       = getAttackerIp(req);
  const ua       = String(req.headers["user-agent"] ?? "");
  const tags     = detectScanPatterns(req);
  const body     = req.body;
  const bodyStr  = body ? (typeof body === "string" ? body : JSON.stringify(body)).slice(0, 4096) : null;
  const payloadHex = bodyStr ? Buffer.from(bodyStr).toString("hex").slice(0, 2048) : null;
  const score    = calcThreatScore(tags, ua, req.path);

  const [geo, tor] = await Promise.all([
    geoLookup(ip),
    isTorExit(ip).catch(() => false),
  ]);

  const event = {
    sessionId:        randomUUID(),
    attackerIp:       ip,
    attackerPort:     String(req.socket.remotePort ?? ""),
    honeypotService:  serviceType,
    honeypotEndpoint: req.originalUrl,
    requestMethod:    req.method,
    requestPath:      req.path,
    requestHeaders:   JSON.stringify(req.headers),
    requestBody:      bodyStr,
    userAgent:        ua,
    referer:          String(req.headers["referer"] ?? req.headers["referrer"] ?? ""),
    acceptLanguage:   String(req.headers["accept-language"] ?? ""),
    asn:              geo.asn,
    asnOrg:           geo.asnOrg,
    country:          geo.country,
    city:             geo.city,
    isp:              geo.isp,
    osFingerprint:    inferOs(ua),
    isTorExit:        tor,
    isVpn:            geo.isProxy,
    threatScore:      score,
    fakeBannerServed: extra.fakeBannerServed ?? null,
    tarpitDurationMs: extra.tarpitMs ?? null,
    payloadHex,
    capturedCreds:    extra.capturedCreds ?? extractCreds(body),
    scanPatterns:     tags.length > 0 ? JSON.stringify(tags) : null,
    tags:             tags.length > 0 ? JSON.stringify(tags) : null,
  };

  await db.insert(deceptionEventsTable).values(event).catch(() => {});
}

/** Apply tarpit delay — chunks a slow response to tie up attacker connection */
function tarpit(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, Math.min(ms, 8000)));
}

// ══════════════════════════════════════════════════════════════════════════════
// HONEYPOT ENDPOINTS — each looks like a real vulnerable service
// ══════════════════════════════════════════════════════════════════════════════

// Generic HTTP honeypot — catches all paths under /trap/...
router.all("/trap/*path", async (req: Request, res: Response) => {
  const banner = await getBanner("http");
  const creds  = extractCreds(req.body);
  await tarpit(banner?.delayMs ?? 600);
  await recordAttack(req, "http", {
    fakeBannerServed: "apache-legacy",
    tarpitMs:         banner?.delayMs ?? 600,
    capturedCreds:    creds,
  });
  if (banner) {
    Object.entries(banner.headers).forEach(([k, v]) => res.setHeader(k, v));
  }
  res.status(200).send(banner?.content ?? "<html><body>Server Error</body></html>");
});

// SSH banner endpoint (simulates SSH service responding over HTTP for scanners)
router.all("/trap-ssh", async (req: Request, res: Response) => {
  const banner = await getBanner("ssh");
  await tarpit(banner?.delayMs ?? 1200);
  await recordAttack(req, "ssh", { fakeBannerServed: "openssh-7.4", tarpitMs: banner?.delayMs ?? 1200 });
  res.setHeader("Content-Type", "text/plain");
  res.status(200).send(banner?.content ?? "SSH-2.0-OpenSSH_7.4\r\nProtocol mismatch.\r\n");
});

// FTP banner endpoint
router.all("/trap-ftp", async (req: Request, res: Response) => {
  const banner = await getBanner("ftp");
  await tarpit(banner?.delayMs ?? 600);
  await recordAttack(req, "ftp", { fakeBannerServed: "vsftpd-2.3.4", tarpitMs: banner?.delayMs ?? 600 });
  res.setHeader("Content-Type", "text/plain");
  res.status(200).send(banner?.content ?? "220 (vsFTPd 2.3.4)\r\n");
});

// SMTP banner endpoint
router.all("/trap-smtp", async (req: Request, res: Response) => {
  const banner = await getBanner("smtp");
  await tarpit(banner?.delayMs ?? 1000);
  await recordAttack(req, "smtp", { fakeBannerServed: "sendmail-8.14", tarpitMs: banner?.delayMs ?? 1000 });
  res.setHeader("Content-Type", "text/plain");
  res.status(200).send(banner?.content ?? "220 mail.internal.local ESMTP Sendmail 8.14.7\r\n");
});

// phpMyAdmin fake login (high-value credential trap)
router.all("/trap-pma", async (req: Request, res: Response) => {
  const banner = await getBanner("http");
  const creds  = extractCreds(req.body);
  await tarpit(300);
  await recordAttack(req, "http", {
    fakeBannerServed: "phpmyadmin-login",
    tarpitMs: 300,
    capturedCreds: creds,
  });
  res.setHeader("Server", "Apache/2.4.18 (Ubuntu)");
  res.setHeader("X-Powered-By", "PHP/5.6.40");
  res.setHeader("Set-Cookie", `phpMyAdmin=trap_${randomUUID().slice(0, 8)}; path=/; HttpOnly`);
  res.status(200).send(`<!DOCTYPE html><html><head><title>phpMyAdmin</title>
    <style>body{background:#f5f5f5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}
    .box{background:#fff;padding:30px;border:1px solid #ccc;width:320px}h1{font-size:18px;margin-bottom:15px}
    input{width:100%;margin:5px 0;padding:6px;border:1px solid #ccc;box-sizing:border-box}
    button{width:100%;padding:8px;background:#3d6db5;color:#fff;border:none;cursor:pointer}</style></head>
    <body><div class="box"><h1>phpMyAdmin</h1>
    <form method="POST"><input type="text" name="pma_username" placeholder="Username"/>
    <input type="password" name="pma_password" placeholder="Password"/>
    <input type="hidden" name="token" value="${randomUUID().slice(0, 16)}"/>
    <button type="submit">Go</button></form></div></body></html>`);
});

// Admin panel credential trap
router.all("/trap-admin", async (req: Request, res: Response) => {
  const creds = extractCreds(req.body);
  await tarpit(400);
  await recordAttack(req, "http", { fakeBannerServed: "admin-panel", tarpitMs: 400, capturedCreds: creds });
  res.setHeader("Server", "Microsoft-IIS/6.0");
  res.setHeader("X-Powered-By", "ASP.NET");
  res.status(200).send(`<!DOCTYPE html><html><head><title>Admin Login</title>
    <style>body{background:#1a1a2e;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}
    .box{background:#16213e;padding:30px;border:1px solid #0f3460;width:300px;color:#eee}h2{text-align:center;color:#e94560}
    input{width:100%;margin:6px 0;padding:8px;background:#0f3460;border:1px solid #e94560;color:#eee;box-sizing:border-box}
    button{width:100%;padding:10px;background:#e94560;color:#fff;border:none;cursor:pointer}</style></head>
    <body><div class="box"><h2>⚙ Admin Portal</h2>
    <form method="POST"><input type="text" name="username" placeholder="Username" autocomplete="off"/>
    <input type="password" name="password" placeholder="Password"/>
    <input type="hidden" name="_csrf" value="${randomUUID()}"/>
    <button type="submit">Login</button></form></div></body></html>`);
});

// WordPress login trap
router.all("/trap-wp", async (req: Request, res: Response) => {
  const creds = extractCreds(req.body);
  await tarpit(350);
  await recordAttack(req, "http", { fakeBannerServed: "wordpress-login", tarpitMs: 350, capturedCreds: creds });
  res.setHeader("Server", "Apache/2.4.52 (Ubuntu)");
  res.setHeader("X-Powered-By", "PHP/8.0.30");
  res.status(200).send(`<!DOCTYPE html><html><head><title>Log In &lsaquo; WordPress Site &#8212; WordPress</title>
    <style>body{background:#f0f0f1;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;margin:0}
    #login{width:320px;margin:100px auto;padding:26px}#login h1 a{display:block;text-align:center;font-size:20px;
    text-decoration:none;color:#1d2327;margin-bottom:20px}.input{width:100%;padding:8px;margin:4px 0;border:1px solid #8c8f94;box-sizing:border-box}
    .button-primary{background:#2271b1;color:#fff;border:none;padding:10px 20px;cursor:pointer;width:100%}</style></head>
    <body><div id="login"><h1><a>WordPress</a></h1>
    <form method="POST"><p><label>Username or Email<input class="input" type="text" name="log" autocomplete="username"/></label></p>
    <p><label>Password<input class="input" type="password" name="pwd" autocomplete="current-password"/></label></p>
    <input type="hidden" name="wp-submit" value="Log+In"/>
    <input type="hidden" name="redirect_to" value="/wp-admin/"/>
    <input type="hidden" name="testcookie" value="1"/>
    <p class="submit"><button type="submit" class="button-primary">Log In</button></p>
    </form></div></body></html>`);
});

// ── Canary token endpoint — instant notification when touched ────────────────
router.all("/canary/:token", async (req: Request, res: Response) => {
  await recordAttack(req, "canary", { fakeBannerServed: `canary-${req.params.token}` });
  res.status(200).send(""); // silent 200 — attacker sees nothing unusual
});

// ══════════════════════════════════════════════════════════════════════════════
// ADMIN-ONLY DATA API — requires requireAdmin middleware applied at index.ts
// ══════════════════════════════════════════════════════════════════════════════

// GET /api/deception/events — list events, newest first
router.get("/events", async (req: Request, res: Response) => {
  const limit  = Math.min(Number(req.query.limit  ?? 100), 500);
  const offset = Number(req.query.offset ?? 0);
  const ip     = req.query.ip   as string | undefined;
  const svc    = req.query.service as string | undefined;
  const minScore = req.query.minScore ? Number(req.query.minScore) : undefined;

  let q = db.select().from(deceptionEventsTable).$dynamic();
  if (ip)        q = q.where(eq(deceptionEventsTable.attackerIp, ip));
  if (svc)       q = q.where(eq(deceptionEventsTable.honeypotService, svc));
  if (minScore !== undefined) q = q.where(gte(deceptionEventsTable.threatScore, minScore));

  const events = await q.orderBy(desc(deceptionEventsTable.sessionStart)).limit(limit).offset(offset);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(deceptionEventsTable);
  res.json({ events, total, limit, offset });
});

// GET /api/deception/events/:id — single event detail
router.get("/events/:id", async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  const [event] = await db.select().from(deceptionEventsTable).where(eq(deceptionEventsTable.id, id));
  if (!event) return res.status(404).json({ error: "Not found" });
  res.json(event);
});

// GET /api/deception/stats — aggregate stats for dashboard
router.get("/stats", async (req: Request, res: Response) => {
  const [totals] = await db.select({
    total:     sql<number>`count(*)::int`,
    highThreat:sql<number>`count(*) filter (where threat_score >= 70)::int`,
    withCreds: sql<number>`count(*) filter (where captured_creds is not null)::int`,
    torCount:  sql<number>`count(*) filter (where is_tor_exit = true)::int`,
    vpnCount:  sql<number>`count(*) filter (where is_vpn = true)::int`,
    avgScore:  sql<number>`round(avg(threat_score))::int`,
  }).from(deceptionEventsTable);

  const topIps = await db
    .select({ ip: deceptionEventsTable.attackerIp, count: sql<number>`count(*)::int`, maxScore: sql<number>`max(threat_score)::int` })
    .from(deceptionEventsTable)
    .groupBy(deceptionEventsTable.attackerIp)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  const byService = await db
    .select({ service: deceptionEventsTable.honeypotService, count: sql<number>`count(*)::int` })
    .from(deceptionEventsTable)
    .groupBy(deceptionEventsTable.honeypotService)
    .orderBy(desc(sql`count(*)`));

  const byCountry = await db
    .select({ country: deceptionEventsTable.country, count: sql<number>`count(*)::int` })
    .from(deceptionEventsTable)
    .where(sql`country is not null`)
    .groupBy(deceptionEventsTable.country)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  const recent = await db
    .select()
    .from(deceptionEventsTable)
    .orderBy(desc(deceptionEventsTable.sessionStart))
    .limit(5);

  const scanTools = await db
    .select({ patterns: deceptionEventsTable.scanPatterns, count: sql<number>`count(*)::int` })
    .from(deceptionEventsTable)
    .where(sql`scan_patterns is not null`)
    .groupBy(deceptionEventsTable.scanPatterns)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  res.json({ totals, topIps, byService, byCountry, recent, scanTools });
});

// GET /api/deception/banners — list available fake banners
router.get("/banners", async (_req: Request, res: Response) => {
  const banners = await db.select().from(deceptionBannersTable).orderBy(deceptionBannersTable.serviceType);
  res.json(banners);
});

// POST /api/deception/banners — create custom banner
router.post("/banners", requireRbac("deception_admin"), async (req: Request, res: Response) => {
  const schema = z.object({
    name:          z.string().min(1).max(100),
    serviceType:   z.enum(["http", "ssh", "ftp", "smtp", "telnet", "rdp", "generic"]),
    bannerContent: z.string().min(1).max(20000),
    headersJson:   z.string().optional(),
    delayMs:       z.number().int().min(0).max(10000).optional(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const [banner] = await db.insert(deceptionBannersTable).values({
    name:          p.data.name,
    serviceType:   p.data.serviceType,
    bannerContent: p.data.bannerContent,
    headersJson:   p.data.headersJson ?? null,
    delayMs:       p.data.delayMs ?? 0,
    isActive:      true,
  }).returning();
  bannerCacheTs = 0; // bust cache
  const _actorDec = (req as any).auth?.userId ?? "system";
  appendAuditEvent({ actor: _actorDec, action: "deception_banner.create", resource: `deception_banner:${banner.id}`, metadata: { name: banner.name, serviceType: banner.serviceType } });
  void shipSecurityEvent({ actor: _actorDec, action: "deception_banner.create", resource: `deception_banner:${banner.id}`, result: "allow", metadata: { name: banner.name } });
  res.json(banner);
});

// PATCH /api/deception/banners/:id — toggle active / update delay
router.patch("/banners/:id", requireRbac("deception_admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  const schema = z.object({
    isActive:  z.boolean().optional(),
    delayMs:   z.number().int().min(0).max(10000).optional(),
    bannerContent: z.string().min(1).max(20000).optional(),
    headersJson:   z.string().optional(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  const [updated] = await db.update(deceptionBannersTable)
    .set({ ...p.data })
    .where(eq(deceptionBannersTable.id, id))
    .returning();
  bannerCacheTs = 0;
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

// DELETE /api/deception/events/:id — purge a single event
router.delete("/events/:id", requireRbac("deception_admin"), async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid ID" });
  await db.delete(deceptionEventsTable).where(eq(deceptionEventsTable.id, id));
  res.json({ ok: true });
});

// POST /api/deception/events/purge — bulk purge by IP or all
router.post("/events/purge", requireRbac("deception_admin"), async (req: Request, res: Response) => {
  const schema = z.object({
    ip:  z.string().optional(),
    all: z.boolean().optional(),
  });
  const p = schema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: p.error.flatten() });
  if (p.data.all) {
    await db.delete(deceptionEventsTable);
    return res.json({ ok: true, purged: "all" });
  }
  if (p.data.ip) {
    await db.delete(deceptionEventsTable).where(eq(deceptionEventsTable.attackerIp, p.data.ip));
    return res.json({ ok: true, purged: p.data.ip });
  }
  res.status(400).json({ error: "Specify ip or all:true" });
});

export default router;
