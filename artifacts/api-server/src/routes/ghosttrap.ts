// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Trap — Active honeypot + counter-intelligence engine.
// Detects attacker IPs, source ports, hop chains (VPN/proxy traces), beacon tracking,
// geo/WHOIS enrichment, VPN/Tor node identification, and authority report generation.
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  ghostTrapProbesTable, ghostTrapConfigTable, ghostTrapBeaconsTable,
  blockedIpsTable, trappedAttackersTable, silkWebTable,
} from "@workspace/db";
import { eq, desc, sql, inArray, and, isNull } from "drizzle-orm";
import crypto from "crypto";
import dns from "dns/promises";

const router = Router();

// ─── 1×1 transparent GIF bytes ───────────────────────────────────────────────
const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"
);

// ─── Known VPN / proxy / datacenter ASN org name patterns ────────────────────
const VPN_ORG_PATTERNS = [
  /nordvpn/i, /expressvpn/i, /express vpn/i, /mullvad/i, /protonvpn/i, /proton vpn/i,
  /surfshark/i, /private internet access/i, /\bpia\b/i, /windscribe/i, /cyberghost/i,
  /ipvanish/i, /hidemyass/i, /hide\.me/i, /purevpn/i, /tunnelbear/i, /hotspot shield/i,
  /vyprvpn/i, /strongvpn/i, /ivacy/i, /zenmate/i, /torguard/i, /avast.*vpn/i,
  /norton.*vpn/i, /bitdefender.*vpn/i, /kaspersky.*vpn/i, /avira.*vpn/i,
  /pia s\.a/i, /air vpn/i, /perfect privacy/i, /astrill/i,
];
const DATACENTER_ORG_PATTERNS = [
  /amazon/i, /\baws\b/i, /google llc/i, /google cloud/i, /microsoft/i, /azure/i,
  /digitalocean/i, /linode/i, /akamai/i, /vultr/i, /ovh/i, /hetzner/i,
  /cloudflare/i, /fastly/i, /leaseweb/i, /choopa/i, /quadranet/i, /psychz/i,
  /serverius/i, /m247/i, /tzulo/i, /hostwinds/i, /datacamp/i, /serverstack/i,
  /cogent/i, /telia/i, /zenlayer/i,
];

// ─── Classify an IP's org/ISP string ─────────────────────────────────────────
function classifyOrg(isp: string, org: string): "vpn_exit" | "datacenter" | "residential" | "corporate" | "unknown" {
  const s = `${isp} ${org}`.toLowerCase();
  if (VPN_ORG_PATTERNS.some(p => p.test(s)))      return "vpn_exit";
  if (DATACENTER_ORG_PATTERNS.some(p => p.test(s))) return "datacenter";
  if (s.includes("university") || s.includes("college") || s.includes("school")) return "corporate";
  if (isp || org) return "residential";
  return "unknown";
}

// ─── Parse full hop chain from request headers ────────────────────────────────
// Returns ordered list: [original_client, ...proxies, our_server_sees]
function parseHopChain(req: Request): string[] {
  const hops: string[] = [];

  // Check all headers that can carry real/forwarded IPs
  const xff = req.headers["x-forwarded-for"];
  if (xff) {
    const ips = (Array.isArray(xff) ? xff.join(",") : xff)
      .split(",").map(s => s.trim()).filter(Boolean);
    hops.push(...ips);
  }

  // Additional forwarding headers — may reveal more hops
  const extras = [
    "x-real-ip", "x-originating-ip", "x-cluster-client-ip",
    "x-client-ip", "true-client-ip", "cf-connecting-ip",
    "fastly-client-ip", "x-forwarded", "forwarded-for", "x-coming-from",
  ];
  for (const h of extras) {
    const v = req.headers[h] as string | undefined;
    if (v) {
      const ip = v.split(",")[0]?.trim();
      if (ip && !hops.includes(ip)) hops.push(ip);
    }
  }

  // The socket-level IP (last visible hop to us)
  const socketIp = req.socket?.remoteAddress ?? "";
  if (socketIp && !hops.includes(socketIp)) hops.push(socketIp);

  // Deduplicate while preserving order
  return [...new Set(hops)].filter(ip => ip && ip !== "unknown");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const tarpit = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getConfig(userId: string, detectedIp?: string) {
  const rows = await db.select().from(ghostTrapConfigTable)
    .where(eq(ghostTrapConfigTable.userId, userId)).limit(1);
  if (rows.length) {
    // Back-fill IP if we now know it and didn't before
    if (detectedIp && !rows[0].userDetectedIp) {
      await db.update(ghostTrapConfigTable).set({ userDetectedIp: detectedIp })
        .where(eq(ghostTrapConfigTable.id, rows[0].id));
      return { ...rows[0], userDetectedIp: detectedIp };
    }
    return rows[0];
  }
  const token = crypto.randomBytes(24).toString("hex");
  const [cfg] = await db.insert(ghostTrapConfigTable)
    .values({ userId, userToken: token, userDetectedIp: detectedIp ?? null })
    .returning();
  return cfg;
}

function getIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim()
    || req.socket?.remoteAddress || req.ip || "unknown";
}

function getSourcePort(req: Request): number | null {
  return req.socket?.remotePort ?? null;
}

// ─── Attack detection ─────────────────────────────────────────────────────────
function detectAttack(data: string): { type: string; vector: string } | null {
  if (!data) return null;
  const s = data.toLowerCase();

  const SQL: [RegExp, string][] = [
    [/union\s+select/i,         "UNION SELECT"],
    [/'\s*or\s+['"]?\d/i,       "OR injection"],
    [/'\s*and\s+['"]?\d/i,      "AND injection"],
    [/;\s*(drop|delete|insert|update|truncate)\s/i, "destructive SQL"],
    [/\bsleep\s*\(\d/i,         "time-based blind (SLEEP)"],
    [/benchmark\s*\(\d/i,       "time-based blind (BENCHMARK)"],
    [/xp_cmdshell/i,            "xp_cmdshell"],
    [/load_file\s*\(/i,         "LOAD_FILE"],
    [/outfile\s+['"]/i,         "INTO OUTFILE"],
    [/information_schema/i,     "information_schema dump"],
    [/--\s*$/m,                 "SQL comment terminator"],
    [/\/\*.*\*\//,              "SQL block comment"],
    [/0x[0-9a-f]{4,}/i,         "hex encoding"],
    [/\bchar\s*\(\d/i,          "CHAR() encoding"],
  ];
  for (const [re, label] of SQL) if (re.test(s)) return { type: "sql_injection", vector: label };

  const XSS: [RegExp, string][] = [
    [/<script[\s>]/i,           "<script> tag"],
    [/javascript:/i,            "javascript: URI"],
    [/on\w+\s*=/i,              "event handler (on*)"],
    [/<img[^>]+src/i,           "<img> injection"],
    [/<svg[^>]*on\w+/i,         "SVG event injection"],
    [/\balert\s*\(/i,           "alert() call"],
    [/document\.cookie/i,       "cookie theft"],
    [/eval\s*\(/i,              "eval() call"],
  ];
  for (const [re, label] of XSS) if (re.test(s)) return { type: "xss", vector: label };

  const CMD: [RegExp, string][] = [
    [/;\s*(ls|cat|id|whoami|pwd|wget|curl)\b/i, "shell command injection"],
    [/\|\s*(ls|cat|id|whoami|pwd)\b/i,          "pipe injection"],
    [/&&\s*(ls|cat|id|whoami)/i,                "chain injection"],
    [/\$\([^)]+\)/,                             "command substitution $()"],
    [/`[^`]+`/,                                 "backtick injection"],
    [/curl\s+http/i,                            "curl SSRF"],
    [/nslookup\s+/i,                            "nslookup OOB"],
  ];
  for (const [re, label] of CMD) if (re.test(s)) return { type: "cmd_injection", vector: label };

  const PATH: [RegExp, string][] = [
    [/\.\.(\/|%2f)/i,   "path traversal ../"],
    [/\/etc\/passwd/i,  "/etc/passwd"],
    [/\/proc\/self/i,   "/proc/self"],
    [/\bboot\.ini\b/i,  "boot.ini"],
    [/win\.ini/i,       "win.ini"],
  ];
  for (const [re, label] of PATH) if (re.test(s)) return { type: "path_traversal", vector: label };

  return null;
}

// ─── Geo enrichment — async, fire-and-forget ──────────────────────────────────
async function enrichGeo(probeId: string, ip: string) {
  if (!ip || isPrivateIp(ip)) return;
  try {
    const res = await fetch(`https://ipwhois.app/json/${ip}?objects=ip,isp,org,country,city,timezone,asn`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return;
    const d = await res.json() as Record<string, string>;
    const nodeType = classifyOrg(d.isp ?? "", d.org ?? "");
    await db.update(ghostTrapProbesTable).set({
      geoCountry:  d.country  ?? null,
      geoCity:     d.city     ?? null,
      geoIsp:      d.isp      ?? null,
      geoOrg:      d.org      ?? null,
      geoAsn:      d.asn      ?? null,
      geoTimezone: d.timezone ?? null,
      vpnDetected: nodeType === "vpn_exit",
    }).where(eq(ghostTrapProbesTable.probeId, probeId));
  } catch { /* best-effort */ }
}

function isPrivateIp(ip: string): boolean {
  return ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("172.") ||
    ip.startsWith("127.") || ip === "::1" || ip === "localhost";
}

// ─── Poisoned response builder ────────────────────────────────────────────────
function buildFakeResponse(
  endpoint: string, attackType: string, beaconId: string, beaconBase: string
): { body: unknown; contentType: string } {
  const pixelUrl = `${beaconBase}/beacon/${beaconId}`;
  const jsUrl    = `${beaconBase}/beacon/${beaconId}/js`;

  const withBeaconHtml = (inner: string) =>
    `${inner}\n<!-- <img src="${pixelUrl}" width="1" height="1" style="display:none"> -->\n<script src="${jsUrl}"></script>`;

  if (endpoint.includes("login") || endpoint.includes("auth")) {
    return {
      body: {
        success: true,
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6InN1cGVyYWRtaW4iLCJpYXQiOjE3MTcwMDAwMDB9.PROXHQ_GHOST_TRAP",
        user: { id: 1, username: "admin", email: "admin@internal.corp", role: "superadmin", last_login: "2026-06-04T09:12:00Z" },
        session: crypto.randomBytes(16).toString("hex"),
        db_host: "10.0.0.5:3306", env: "production",
        monitoring_webhook: pixelUrl,
      },
      contentType: "application/json",
    };
  }
  if (endpoint.includes("user") || attackType === "sql_injection") {
    return {
      body: {
        rows: [
          { id: 1, username: "admin",     email: "admin@corp.local",   password_hash: "$2b$12$GTFakeAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", role: "superadmin", avatar: pixelUrl },
          { id: 2, username: "jsmith",    email: "j.smith@corp.local", password_hash: "$2b$12$GTFakeBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", role: "admin",      avatar: pixelUrl },
          { id: 3, username: "mwilliams", email: "m.w@corp.local",     password_hash: "$2b$12$GTFakeCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", role: "user",       avatar: pixelUrl },
        ],
        total: 3, db_version: "MySQL 5.7.39-log", query_time: "0.0042s",
      },
      contentType: "application/json",
    };
  }
  if (endpoint.includes(".env") || endpoint.includes("config")) {
    const adminTok = "gt_" + crypto.randomBytes(8).toString("hex");
    return {
      body: [
        "APP_ENV=production", "DB_HOST=10.0.0.5", "DB_USER=root",
        "DB_PASS=Sup3rS3cr3tProd2024!", "DB_NAME=app_production",
        "STRIPE_SECRET=sk_live_GHOSTTRAP_FAKE_KEY_PROXHQ",
        "JWT_SECRET=GhostTrap_Fake_JWT_Secret_ProxhqVPN",
        `ADMIN_TOKEN=${adminTok}`,
        "AWS_ACCESS_KEY_ID=AKIA_GHOSTTRAP_FAKE_KEY",
        "AWS_SECRET_ACCESS_KEY=GhostTrapFakeSecret+proxhqvpn+trap",
        `MONITORING_URL=${pixelUrl}`,
        `ANALYTICS_ENDPOINT=${jsUrl}`,
      ].join("\n"),
      contentType: "text/plain",
    };
  }
  if (endpoint.includes("wp-admin") || endpoint.includes("admin")) {
    return {
      body: {
        status: "ok", version: "AdminPanel v2.1", uptime: "14d 7h", users_online: 3,
        db: { host: "localhost", name: "app_db", user: "root", version: "MySQL 5.7.39" },
        server: { os: "Ubuntu 22.04", php: "8.1.2", memory: "512M" },
        last_backup: "2026-06-04T03:00:00Z", health_check: pixelUrl,
      },
      contentType: "application/json",
    };
  }
  if (endpoint.includes("backup") || endpoint.includes(".sql")) {
    return {
      body: withBeaconHtml([
        "-- MySQL dump 10.13  Distrib 5.7.39", "-- Host: localhost    Database: app_production",
        "/*!40101 SET NAMES utf8 */;",
        "CREATE TABLE `users` (`id` int(11) NOT NULL AUTO_INCREMENT, `username` varchar(255), PRIMARY KEY (`id`));",
        "INSERT INTO `users` VALUES (1,'admin','$2b$12$GTFakeAdminHash'),(2,'jsmith','$2b$12$GTFakeUserHash');",
      ].join("\n")),
      contentType: "text/plain",
    };
  }
  return {
    body: { ok: true, message: "OK", version: "1.0.4", server: "Apache/2.4.54", ping: pixelUrl },
    contentType: "application/json",
  };
}

// ─── Main probe handler ───────────────────────────────────────────────────────
async function handleProbe(req: Request, res: Response, endpointName: string, userId?: string) {
  const cfg = await getConfig(userId ?? "platform");
  if (!cfg.enabled) { res.status(503).end(); return; }

  const ip         = getIp(req);
  const sourcePort = getSourcePort(req);
  const ua         = (req.headers["user-agent"] ?? "").substring(0, 512);
  const hopChain   = parseHopChain(req);

  const rawPayload = JSON.stringify({
    query: req.query, body: req.body,
    path: req.path, headers: { "content-type": req.headers["content-type"] },
  }).substring(0, 4096);

  const allData   = rawPayload + " " + req.path;
  const attack    = detectAttack(allData);
  const probeType = attack?.type ?? (
    req.path.includes(".env") ? "recon" :
    req.path.includes("wp-") ? "recon" :
    req.method === "POST" ? "auth_brute" : "recon"
  );

  const tarpitMs = cfg.tarpitMinMs + Math.floor(Math.random() * (cfg.tarpitMaxMs - cfg.tarpitMinMs));
  await tarpit(tarpitMs);

  const beaconId   = crypto.randomUUID();
  const proto      = req.headers["x-forwarded-proto"] ?? "https";
  const host       = req.headers["x-forwarded-host"] ?? req.headers.host ?? "";
  const beaconBase = `${proto}://${host}/api/ghost-trap`;
  const fake       = buildFakeResponse(endpointName, probeType, beaconId, beaconBase);
  const fakeJson   = (typeof fake.body === "string" ? fake.body : JSON.stringify(fake.body)).substring(0, 2048);

  const probeId = crypto.randomUUID();
  await db.insert(ghostTrapProbesTable).values({
    probeId, attackerIp: ip, attackerPort: sourcePort, attackerUa: ua,
    method: req.method, endpoint: endpointName,
    rawPayload, probeType, attackVector: attack?.vector ?? null,
    fakeResponse: fakeJson, tarpitMs, beaconId,
    hopChain: hopChain.length > 1 ? JSON.stringify(hopChain) : null,
    referer:      (req.headers.referer ?? "").substring(0, 512),
    probeHeaders: JSON.stringify(req.headers).substring(0, 1024),
    userId:       userId ?? null,
  }).catch(() => {});

  // Async geo enrichment + VPN/Tor detection
  enrichGeo(probeId, ip).catch(() => {});

  const [ipCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ghostTrapProbesTable)
    .where(and(
      eq(ghostTrapProbesTable.attackerIp, ip),
      userId ? eq(ghostTrapProbesTable.userId, userId) : isNull(ghostTrapProbesTable.userId),
    ));
  const count = ipCount?.count ?? 1;

  if (count >= cfg.autoBlockAfter) {
    const exists = await db.select().from(blockedIpsTable)
      .where(eq(blockedIpsTable.ip, ip)).limit(1);
    if (!exists.length) {
      await db.insert(blockedIpsTable).values({
        ip, reason: `Ghost Trap: ${count} probes (${probeType})`, autoBlocked: true,
      }).catch(() => {});
      await db.update(ghostTrapProbesTable).set({ autoBlocked: true })
        .where(eq(ghostTrapProbesTable.probeId, probeId)).catch(() => {});
    }
  }

  if (count >= cfg.silkTrapAfter) {
    const alreadyTrapped = await db.select().from(trappedAttackersTable)
      .where(eq(trappedAttackersTable.ip, ip)).limit(1);
    if (!alreadyTrapped.length) {
      const webRows = await db.select().from(silkWebTable).limit(1);
      if (webRows.length) {
        await db.insert(trappedAttackersTable).values({
          ip, fingerprint: `GHOST_TRAP|IP:${ip}|PORT:${sourcePort ?? "?"}|UA:${ua.substring(0, 80)}|PROBES:${count}`,
          entryNodeId: 1, honeypotPort: 443,
          probeType: `ghost_trap_${probeType}`,
          dataCollected: JSON.stringify({ probeCount: count, lastVector: attack?.vector, endpoint: endpointName, beaconId, sourcePort, hopChain }),
          sqlmapStatus: "idle",
        }).catch(() => {});
        await db.update(ghostTrapProbesTable).set({ silkTrapped: true })
          .where(eq(ghostTrapProbesTable.probeId, probeId)).catch(() => {});
      }
    }
  }

  res.setHeader("Content-Type", fake.contentType);
  res.setHeader("X-Powered-By", "Apache/2.4.54");
  res.setHeader("Server", "Apache/2.4.54 (Ubuntu)");
  if (typeof fake.body === "string") res.status(200).send(fake.body);
  else res.status(200).json(fake.body);
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUBLIC LURE ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════
router.all("/lure/login",      (req, res) => handleProbe(req, res, "login"));
router.all("/lure/auth",       (req, res) => handleProbe(req, res, "auth"));
router.all("/lure/admin",      (req, res) => handleProbe(req, res, "admin"));
router.all("/lure/wp-admin",   (req, res) => handleProbe(req, res, "wp-admin"));
router.all("/lure/api/users",  (req, res) => handleProbe(req, res, "api/users"));
router.all("/lure/api/search", (req, res) => handleProbe(req, res, "api/search"));
router.all("/lure/api/data",   (req, res) => handleProbe(req, res, "api/data"));
router.get("/lure/.env",       (req, res) => handleProbe(req, res, ".env"));
router.get("/lure/config.php", (req, res) => handleProbe(req, res, "config.php"));
router.get("/lure/backup.sql", (req, res) => handleProbe(req, res, "backup.sql"));
router.all("/lure/{*path}",    (req, res) => handleProbe(req, res, req.path));

// ─── Beacon endpoints (PUBLIC) ────────────────────────────────────────────────
router.get("/beacon/:beaconId", async (req, res) => {
  const { beaconId } = req.params;
  const firedFromIp  = getIp(req);
  const firedUa      = (req.headers["user-agent"] ?? "").substring(0, 512);
  // Look up the userId from the originating probe so we can attribute the beacon correctly
  const probeRows = await db.select({ userId: ghostTrapProbesTable.userId })
    .from(ghostTrapProbesTable)
    .where(eq(ghostTrapProbesTable.beaconId, String(beaconId))).limit(1).catch(() => []);
  const beaconUserId = probeRows[0]?.userId ?? null;
  await db.insert(ghostTrapBeaconsTable).values({
    beaconId: String(beaconId), probeId: String(beaconId),
    attackerIp: firedFromIp, firedFromIp,
    firedUa, firedHeaders: JSON.stringify(req.headers).substring(0, 1024),
    userId: beaconUserId,
  }).catch(() => {});
  await db.update(ghostTrapProbesTable)
    .set({ beaconFired: true, beaconFiredAt: new Date() })
    .where(eq(ghostTrapProbesTable.beaconId, beaconId)).catch(() => {});
  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Powered-By", "Apache/2.4.54");
  res.status(200).send(PIXEL_GIF);
});

router.get("/beacon/:beaconId/js", async (req, res) => {
  const { beaconId } = req.params;
  res.setHeader("Content-Type", "application/javascript");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(`
(function(){
  try {
    var d = {
      l: navigator.language,
      s: screen.width + 'x' + screen.height,
      z: Intl.DateTimeFormat().resolvedOptions().timeZone,
      p: navigator.platform,
      c: navigator.hardwareConcurrency
    };
    fetch('${req.protocol}://${req.headers.host}/api/ghost-trap/beacon/${beaconId}/cb', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(d)
    }).catch(function(){});
  } catch(e){}
})();
`);
});

router.post("/beacon/:beaconId/cb", async (req, res) => {
  const { beaconId } = req.params;
  const { l, s, z } = req.body as Record<string, string>;
  await db.update(ghostTrapBeaconsTable).set({
    browserLang: l ?? null, screenSize: s ?? null, timezone: z ?? null,
  }).where(eq(ghostTrapBeaconsTable.beaconId, beaconId)).catch(() => {});
  await db.update(ghostTrapProbesTable).set({ beaconFired: true, beaconFiredAt: new Date() })
    .where(eq(ghostTrapProbesTable.beaconId, beaconId)).catch(() => {});
  res.json({ ok: true });
});

// ─── Per-user lure endpoints (PUBLIC — attributed via userToken in URL) ────────
// Each VPN user gets a unique URL like /api/ghost-trap/u/:token/lure/login
// Anyone hitting that URL is recorded as a probe against that specific user's account.
// Users share these URLs in honeypot files, fake configs, decoy pages, etc.
router.all("/u/:userToken/lure/{*path}", async (req, res) => {
  const userToken = String(req.params.userToken);
  const cfgRows = await db.select({ userId: ghostTrapConfigTable.userId })
    .from(ghostTrapConfigTable)
    .where(eq(ghostTrapConfigTable.userToken, userToken)).limit(1);
  if (!cfgRows.length) { res.status(404).end(); return; }
  const userId = cfgRows[0]!.userId;
  await handleProbe(req, res, req.path, userId);
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH-PROTECTED DASHBOARD ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/probes", async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const limit  = Math.min(Number(req.query.limit) || 200, 500);
  const probes = await db.select().from(ghostTrapProbesTable)
    .where(eq(ghostTrapProbesTable.userId, userId))
    .orderBy(desc(ghostTrapProbesTable.probedAt)).limit(limit);
  const [stats] = await db.select({
    total:       sql<number>`count(*)::int`,
    uniqueIps:   sql<number>`count(distinct attacker_ip)::int`,
    sqlCount:    sql<number>`count(*) filter (where probe_type = 'sql_injection')::int`,
    xssCount:    sql<number>`count(*) filter (where probe_type = 'xss')::int`,
    cmdCount:    sql<number>`count(*) filter (where probe_type = 'cmd_injection')::int`,
    blocked:     sql<number>`count(*) filter (where auto_blocked = true)::int`,
    silkTrapped: sql<number>`count(*) filter (where silk_trapped = true)::int`,
    beaconFires: sql<number>`count(*) filter (where beacon_fired = true)::int`,
    avgTarpit:   sql<number>`avg(tarpit_ms)::int`,
    vpnCount:    sql<number>`count(*) filter (where vpn_detected = true)::int`,
  }).from(ghostTrapProbesTable)
    .where(eq(ghostTrapProbesTable.userId, userId));
  res.json({ probes, stats });
});

router.get("/config", async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const rawIp = getIp(req);
  const detectedIp = !isPrivateIp(rawIp) ? rawIp : undefined;
  res.json(await getConfig(userId, detectedIp));
});

router.post("/config", async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const cfg = await getConfig(userId);
  const {
    enabled, tarpitMinMs, tarpitMaxMs, autoBlockAfter, silkTrapAfter,
    fakeSiteName, fakeDbVersion, deviceMode, userDomain,
  } = req.body as Record<string, unknown>;
  const [updated] = await db.update(ghostTrapConfigTable).set({
    ...(enabled !== undefined        && { enabled: Boolean(enabled) }),
    ...(tarpitMinMs !== undefined    && { tarpitMinMs: Number(tarpitMinMs) }),
    ...(tarpitMaxMs !== undefined    && { tarpitMaxMs: Number(tarpitMaxMs) }),
    ...(autoBlockAfter !== undefined && { autoBlockAfter: Number(autoBlockAfter) }),
    ...(silkTrapAfter !== undefined  && { silkTrapAfter: Number(silkTrapAfter) }),
    ...(fakeSiteName  !== undefined && fakeSiteName  !== null && { fakeSiteName: String(fakeSiteName) }),
    ...(fakeDbVersion !== undefined && fakeDbVersion !== null && { fakeDbVersion: String(fakeDbVersion) }),
    ...(typeof deviceMode === "string" && (deviceMode === "personal" || deviceMode === "server") && { deviceMode }),
    ...(userDomain !== undefined && { userDomain: userDomain === "" || userDomain === null ? null : String(userDomain) }),
    updatedAt: new Date(),
  }).where(eq(ghostTrapConfigTable.id, cfg.id)).returning();
  res.json(updated);
});

router.delete("/probes", async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  await db.delete(ghostTrapProbesTable).where(eq(ghostTrapProbesTable.userId, userId));
  await db.delete(ghostTrapBeaconsTable).where(eq(ghostTrapBeaconsTable.userId, userId));
  res.json({ ok: true });
});

// ─── WHOIS on-demand ──────────────────────────────────────────────────────────
router.get("/whois/:ip", async (req, res) => {
  const { ip } = req.params;
  try {
    const r = await fetch(`https://ipwhois.app/json/${encodeURIComponent(ip)}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return res.status(502).json({ error: "WHOIS lookup failed" });
    res.json(await r.json());
  } catch (e: any) {
    res.status(502).json({ error: e.message });
  }
});

// ─── VPN Backtrace Engine ─────────────────────────────────────────────────────
// For a given attacker IP, reconstruct the full hop chain, classify each node,
// attempt reverse DNS, detect VPN providers, and estimate real origin.
router.get("/backtrace/:ip", async (req, res) => {
  const { ip } = req.params;
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  // Gather all stored probes for this attacker to extract any XFF header chains
  const probes = await db.select({
    probeHeaders: ghostTrapProbesTable.probeHeaders,
    hopChain:     ghostTrapProbesTable.hopChain,
    attackerIp:   ghostTrapProbesTable.attackerIp,
    attackerPort: ghostTrapProbesTable.attackerPort,
    geoIsp:       ghostTrapProbesTable.geoIsp,
    geoOrg:       ghostTrapProbesTable.geoOrg,
    geoCountry:   ghostTrapProbesTable.geoCountry,
    geoCity:      ghostTrapProbesTable.geoCity,
    geoAsn:       ghostTrapProbesTable.geoAsn,
  }).from(ghostTrapProbesTable)
    .where(and(
      eq(ghostTrapProbesTable.attackerIp, String(ip)),
      eq(ghostTrapProbesTable.userId, userId),
    ))
    .orderBy(desc(ghostTrapProbesTable.probedAt))
    .limit(50);

  if (!probes.length) return res.status(404).json({ error: "No probes found for this IP" });

  // Collect all unique IPs from all stored hop chains
  const allHopIps = new Set<string>([ip]);
  for (const p of probes) {
    if (p.hopChain) {
      try {
        const chain = JSON.parse(p.hopChain) as string[];
        chain.forEach(h => allHopIps.add(h));
      } catch { /* ignore */ }
    }
    // Also parse from stored raw headers
    if (p.probeHeaders) {
      try {
        const hdrs = JSON.parse(p.probeHeaders) as Record<string, string>;
        const xff = hdrs["x-forwarded-for"] ?? "";
        xff.split(",").map(s => s.trim()).filter(Boolean).forEach(h => allHopIps.add(h));
        ["x-real-ip","true-client-ip","cf-connecting-ip","x-originating-ip"].forEach(h => {
          if (hdrs[h]) allHopIps.add(hdrs[h].split(",")[0]!.trim());
        });
      } catch { /* ignore */ }
    }
  }

  // Enrich each unique hop IP in parallel
  const hopIps = [...allHopIps].filter(h => h && h !== "unknown");
  const enriched = await Promise.all(hopIps.map(async (hopIp) => {
    const result: {
      ip: string;
      port: number | null;
      rdns: string | null;
      isp: string | null;
      org: string | null;
      country: string | null;
      city: string | null;
      asn: string | null;
      nodeType: string;
      vpnProvider: string | null;
      confidence: number;
      isPrivate: boolean;
    } = {
      ip: hopIp,
      port: hopIp === ip ? (probes[0]?.attackerPort ?? null) : null,
      rdns: null,
      isp: null, org: null, country: null, city: null, asn: null,
      nodeType: "unknown",
      vpnProvider: null,
      confidence: 0,
      isPrivate: isPrivateIp(hopIp),
    };

    if (result.isPrivate) {
      result.nodeType = "private_network";
      result.confidence = 99;
      return result;
    }

    // Use cached geo data for the main attacker IP if we have it
    if (hopIp === ip && probes[0]?.geoIsp) {
      result.isp     = probes[0].geoIsp;
      result.org     = probes[0].geoOrg ?? null;
      result.country = probes[0].geoCountry ?? null;
      result.city    = probes[0].geoCity ?? null;
      result.asn     = probes[0].geoAsn ?? null;
      result.nodeType = classifyOrg(result.isp ?? "", result.org ?? "");
    } else {
      // Fresh WHOIS lookup for hop IPs
      try {
        const r = await fetch(`https://ipwhois.app/json/${hopIp}?objects=isp,org,country,city,asn`, {
          signal: AbortSignal.timeout(5000),
        });
        if (r.ok) {
          const d = await r.json() as Record<string, string>;
          result.isp     = d.isp ?? null;
          result.org     = d.org ?? null;
          result.country = d.country ?? null;
          result.city    = d.city ?? null;
          result.asn     = d.asn ?? null;
          result.nodeType = classifyOrg(d.isp ?? "", d.org ?? "");
        }
      } catch { /* best effort */ }
    }

    // Reverse DNS (PTR record)
    try {
      const hostnames = await dns.reverse(hopIp);
      result.rdns = hostnames[0] ?? null;
      // rDNS can also confirm VPN — e.g. "exit.nordvpn.com"
      if (result.rdns && VPN_ORG_PATTERNS.some(p => p.test(result.rdns!))) {
        result.nodeType = "vpn_exit";
      }
    } catch { /* no PTR record */ }

    // Identify specific VPN provider
    const orgStr = `${result.isp ?? ""} ${result.org ?? ""} ${result.rdns ?? ""}`;
    const vpnMap: [RegExp, string][] = [
      [/nordvpn/i, "NordVPN"], [/expressvpn|express vpn/i, "ExpressVPN"],
      [/mullvad/i, "Mullvad VPN"], [/protonvpn|proton vpn/i, "ProtonVPN"],
      [/surfshark/i, "Surfshark"], [/private internet access|pia\b/i, "Private Internet Access"],
      [/windscribe/i, "Windscribe"], [/cyberghost/i, "CyberGhost"],
      [/ipvanish/i, "IPVanish"], [/hidemyass/i, "HideMyAss"],
      [/purevpn/i, "PureVPN"], [/tunnelbear/i, "TunnelBear"],
      [/hotspot shield/i, "Hotspot Shield"], [/vyprvpn/i, "VyprVPN"],
      [/strongvpn/i, "StrongVPN"], [/torguard/i, "TorGuard"],
      [/astrill/i, "Astrill"], [/perfect privacy/i, "Perfect Privacy"],
    ];
    for (const [re, name] of vpnMap) {
      if (re.test(orgStr)) { result.vpnProvider = name; result.nodeType = "vpn_exit"; break; }
    }

    // Confidence scoring
    if (result.nodeType === "vpn_exit")        result.confidence = result.vpnProvider ? 95 : 78;
    else if (result.nodeType === "datacenter") result.confidence = 85;
    else if (result.nodeType === "residential") result.confidence = 90;
    else if (result.nodeType === "corporate")   result.confidence = 80;
    else result.confidence = 40;

    return result;
  }));

  // Build the chain: leftmost = probable real origin, rightmost = us
  // Sort: private IPs first, then by nodeType (residential > corporate > vpn > datacenter)
  const typeOrder: Record<string, number> = {
    private_network: 0, residential: 1, corporate: 2, unknown: 3, vpn_exit: 4, datacenter: 5,
  };
  const sortedChain = [...enriched].sort((a, b) =>
    (typeOrder[a.nodeType] ?? 9) - (typeOrder[b.nodeType] ?? 9)
  );

  // Determine if VPN is confirmed in the chain
  const vpnNodes = enriched.filter(h => h.nodeType === "vpn_exit");
  const likelyRealOrigin = sortedChain[0];

  // Port sweep on the originating IP — check if common VPN ports are open
  // (purely informational — we attempt a quick TCP connect via fetch with a short timeout)
  const portHints: { port: number; service: string; likely: boolean }[] = [
    { port: 1194, service: "OpenVPN UDP/TCP",  likely: false },
    { port: 1197, service: "OpenVPN alt",      likely: false },
    { port: 443,  service: "WireGuard/SSL VPN",likely: false },
    { port: 51820,service: "WireGuard",        likely: false },
    { port: 500,  service: "IKEv2/IPSec",      likely: false },
    { port: 4500, service: "IPSec NAT-T",      likely: false },
    { port: 1080, service: "SOCKS5 proxy",     likely: false },
    { port: 8080, service: "HTTP proxy",       likely: false },
    { port: 3128, service: "Squid proxy",      likely: false },
    { port: 9050, service: "Tor SOCKS",        likely: false },
    { port: 9001, service: "Tor OR port",      likely: false },
  ];
  // Mark ports as likely based on node type
  if (vpnNodes.length > 0) {
    portHints.find(p => p.port === 1194)!.likely = true;
    portHints.find(p => p.port === 51820)!.likely = true;
    portHints.find(p => p.port === 443)!.likely = true;
  }

  res.json({
    targetIp:    ip,
    sourcePort:  probes[0]?.attackerPort ?? null,
    hopChain:    sortedChain,
    vpnDetected: vpnNodes.length > 0,
    vpnNodes,
    likelyRealOrigin,
    portHints,
    summary: buildTraceSummary(sortedChain, vpnNodes, ip),
    analysedAt: new Date().toISOString(),
  });
});

function buildTraceSummary(
  chain: Array<{ ip: string; nodeType: string; vpnProvider: string | null; country: string | null; city: string | null; isp: string | null; confidence: number }>,
  vpnNodes: typeof chain,
  targetIp: string
): string {
  if (!vpnNodes.length && chain.length === 1) {
    const n = chain[0]!;
    return `Direct connection from ${n.country ?? "unknown country"} — no VPN or proxy detected. IP ${targetIp} appears to be a ${n.nodeType} connection (${n.isp ?? "unknown ISP"}).`;
  }
  if (vpnNodes.length > 0) {
    const providerStr = vpnNodes.map(n => n.vpnProvider ?? `unknown VPN (${n.country ?? "?"})`).join(", ");
    const real = chain.find(n => n.nodeType === "residential" || n.nodeType === "corporate");
    if (real) {
      return `Attacker is routing through ${vpnNodes.length} VPN node(s): ${providerStr}. Probable real-world origin: ${real.city ?? "—"}, ${real.country ?? "unknown"} via ${real.isp ?? "unknown ISP"} — confidence ${real.confidence}%.`;
    }
    return `Attacker is routing through ${vpnNodes.length} VPN/proxy node(s): ${providerStr}. Real origin obscured — ${chain.length} hops identified. Law enforcement subpoena to ${providerStr} would be required to obtain real subscriber data.`;
  }
  return `${chain.length} hops traced. Attacker is routing through datacenter infrastructure — likely using a VPS or cloud-hosted attack tool. Provider: ${chain[0]?.isp ?? "unknown"}.`;
}

// ─── Authority Report ─────────────────────────────────────────────────────────
router.get("/report/:ip", async (req, res) => {
  const { ip }   = req.params;
  const download = req.query.download === "1";
  const userId   = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const probes = await db.select().from(ghostTrapProbesTable)
    .where(and(
      eq(ghostTrapProbesTable.attackerIp, String(ip)),
      eq(ghostTrapProbesTable.userId, userId),
    ))
    .orderBy(ghostTrapProbesTable.probedAt);
  const beacons = await db.select().from(ghostTrapBeaconsTable)
    .where(and(
      eq(ghostTrapBeaconsTable.attackerIp, String(ip)),
      eq(ghostTrapBeaconsTable.userId, userId),
    ))
    .orderBy(ghostTrapBeaconsTable.firedAt);

  if (!probes.length) return res.status(404).json({ error: "No probes found for this IP" });

  const first    = probes[0]!;
  const last     = probes[probes.length - 1]!;
  const reportId = "GT-" + Date.now().toString(36).toUpperCase();
  const now      = new Date().toISOString();

  const geoLines = first.geoCountry ? [
    `  IP Address:    ${ip}`,
    `  Source Port:   ${first.attackerPort ?? "Not captured (proxy/VPN masked port)"}`,
    `  ISP / Org:     ${first.geoIsp ?? "—"} / ${first.geoOrg ?? "—"}`,
    `  ASN:           ${first.geoAsn ?? "—"}`,
    `  Country:       ${first.geoCountry}`,
    `  City:          ${first.geoCity ?? "—"}`,
    `  Timezone:      ${first.geoTimezone ?? "—"}`,
    `  VPN Detected:  ${first.vpnDetected ? "YES — attacker routed through a VPN exit node" : "No VPN exit node detected at surface IP"}`,
    `  Tor Detected:  ${first.torDetected ? "YES — Tor exit node" : "No"}`,
  ].join("\n") : `  IP Address:    ${ip}\n  Source Port:   ${first.attackerPort ?? "—"}\n  Geo data:      Pending WHOIS enrichment`;

  const hopSection = first.hopChain ? (() => {
    try {
      const chain = JSON.parse(first.hopChain) as string[];
      return chain.map((h, i) => `  Hop ${i + 1}: ${h}`).join("\n");
    } catch { return "  No hop chain data."; }
  })() : "  Single-hop connection — no forwarding headers detected.";

  const timeline = probes.map((p, i) =>
    `  #${String(i + 1).padStart(3, "0")}  ${p.probedAt.toISOString()}  ${p.method.padEnd(5)} /${p.endpoint.padEnd(24)} [${p.probeType}]` +
    (p.attackVector ? `  → "${p.attackVector}"` : "") +
    (p.beaconFired ? "  🔥 BEACON CONFIRMED" : "") +
    (p.attackerPort ? `  (src-port:${p.attackerPort})` : "")
  ).join("\n");

  const beaconSection = beacons.length ? beacons.map(b =>
    `  Beacon ${b.beaconId.substring(0, 8)} fired at ${b.firedAt.toISOString()} from ${b.firedFromIp ?? ip}\n` +
    `    User-Agent: ${b.firedUa ?? "—"}\n` +
    (b.browserLang ? `    Browser:    Language=${b.browserLang}  Screen=${b.screenSize ?? "—"}  TZ=${b.timezone ?? "—"}\n` : "")
  ).join("\n") : "  No beacon fires recorded.";

  const uniqueVectors = [...new Set(probes.map(p => p.attackVector).filter(Boolean))];
  const attackTypes   = [...new Set(probes.map(p => p.probeType))];

  const report = [
    "═══════════════════════════════════════════════════════════════════════════",
    "  PROXHQVPN — GHOST TRAP SECURITY INCIDENT REPORT",
    `  Report ID:      ${reportId}`,
    `  Generated:      ${now}`,
    `  Classification: CONFIDENTIAL — PREPARED FOR LAW ENFORCEMENT USE`,
    "═══════════════════════════════════════════════════════════════════════════",
    "",
    "SECTION 1 — ATTACKER NETWORK PROFILE",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    geoLines,
    "",
    "SECTION 2 — CONNECTION HOP CHAIN (VPN/PROXY TRACE)",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    hopSection,
    "",
    "SECTION 3 — ATTACK SUMMARY",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━",
    `  First Probe:    ${first.probedAt.toISOString()}`,
    `  Last Probe:     ${last.probedAt.toISOString()}`,
    `  Total Probes:   ${probes.length}`,
    `  Attack Types:   ${attackTypes.join(", ")}`,
    `  Attack Vectors: ${uniqueVectors.join(" | ") || "None detected beyond endpoint access"}`,
    `  Auto-Blocked:   ${probes.some(p => p.autoBlocked) ? "YES" : "No"}`,
    `  Silk-Trapped:   ${probes.some(p => p.silkTrapped) ? "YES" : "No"}`,
    `  Beacon Fires:   ${beacons.length} (confirm attacker browser/tool retrieved poisoned data)`,
    "",
    "SECTION 4 — ATTACK TIMELINE",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    timeline,
    "",
    "SECTION 5 — BEACON FIRE CONFIRMATION",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    beaconSection,
    "",
    "SECTION 6 — LEGAL DECLARATION",
    "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
    "  This report is generated automatically by ProxhqVPN Ghost Trap, a lawfully",
    "  operated honeypot and counter-intelligence system operated by:",
    "  Alpha Unlimited Technologies LLC",
    "",
    "  The activity documented herein constitutes unauthorized access to computer",
    "  systems in violation of 18 U.S.C. § 1030 (Computer Fraud and Abuse Act),",
    "  and may additionally violate analogous statutes in the attacker's jurisdiction.",
    "",
    "  All data in this report was collected passively from inbound connection",
    "  attempts made by the above IP address to publicly accessible honeypot",
    "  endpoints operated by this system. No entrapment was employed.",
    "",
    "  If VPN or proxy hops are identified above, law enforcement may issue",
    "  subpoenas to the identified VPN providers to obtain subscriber identity",
    "  records corresponding to the connection timestamps listed in Section 4.",
    "",
    `  Signed: ProxhqVPN Ghost Trap Engine — Report ${reportId}`,
    `  © Alpha Unlimited Technologies LLC — ${now}`,
    "═══════════════════════════════════════════════════════════════════════════",
  ].join("\n");

  if (download) {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="proxhqvpn-incident-${ip.replace(/[.:]/g, "_")}.txt"`);
    return res.status(200).send(report);
  }
  res.json({ reportId, report, generatedAt: now });
});

export default router;
