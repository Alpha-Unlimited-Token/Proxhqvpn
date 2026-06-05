// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Trap — Active honeypot + counter-intelligence engine.
// Public lure endpoints: detect injection type, feed poisoned data, tarpit connections,
// auto-block repeat offenders, inject tracking beacons, collect attacker fingerprint,
// enrich with geo/WHOIS, and generate law-enforcement authority reports.
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  ghostTrapProbesTable, ghostTrapConfigTable, ghostTrapBeaconsTable,
  blockedIpsTable, trappedAttackersTable, silkWebTable,
} from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

// ─── 1×1 transparent GIF bytes ───────────────────────────────────────────────
const PIXEL_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"
);

// ─── Helpers ──────────────────────────────────────────────────────────────────
const tarpit = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getConfig() {
  const rows = await db.select().from(ghostTrapConfigTable).limit(1);
  if (rows.length) return rows[0];
  const [cfg] = await db.insert(ghostTrapConfigTable).values({}).returning();
  return cfg;
}

function getIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim()
    || req.socket?.remoteAddress || req.ip || "unknown";
}

// Detect injection type + extract matched vector
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
  for (const [re, label] of SQL) {
    if (re.test(s)) return { type: "sql_injection", vector: label };
  }

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
  for (const [re, label] of XSS) {
    if (re.test(s)) return { type: "xss", vector: label };
  }

  const CMD: [RegExp, string][] = [
    [/;\s*(ls|cat|id|whoami|pwd|wget|curl)\b/i, "shell command injection"],
    [/\|\s*(ls|cat|id|whoami|pwd)\b/i,          "pipe injection"],
    [/&&\s*(ls|cat|id|whoami)/i,                "chain injection"],
    [/\$\([^)]+\)/,                             "command substitution $()"],
    [/`[^`]+`/,                                 "backtick injection"],
    [/curl\s+http/i,                            "curl SSRF"],
    [/nslookup\s+/i,                            "nslookup OOB"],
  ];
  for (const [re, label] of CMD) {
    if (re.test(s)) return { type: "cmd_injection", vector: label };
  }

  const PATH: [RegExp, string][] = [
    [/\.\.(\/|%2f)/i,   "path traversal ../"],
    [/\/etc\/passwd/i,  "/etc/passwd"],
    [/\/proc\/self/i,   "/proc/self"],
    [/\bboot\.ini\b/i,  "boot.ini"],
    [/win\.ini/i,       "win.ini"],
  ];
  for (const [re, label] of PATH) {
    if (re.test(s)) return { type: "path_traversal", vector: label };
  }

  return null;
}

// ─── Geo enrichment — async, fire-and-forget ──────────────────────────────────
async function enrichGeo(probeId: string, ip: string) {
  // Skip private/loopback IPs
  if (!ip || ip.startsWith("10.") || ip.startsWith("192.168.") || ip.startsWith("127.") || ip === "::1") return;
  try {
    const res = await fetch(`https://ipwhois.app/json/${ip}?objects=ip,isp,org,country,city,timezone,asn`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return;
    const d = await res.json() as Record<string, string>;
    await db.update(ghostTrapProbesTable).set({
      geoCountry:  d.country  ?? null,
      geoCity:     d.city     ?? null,
      geoIsp:      d.isp      ?? null,
      geoOrg:      d.org      ?? null,
      geoAsn:      d.asn      ?? null,
      geoTimezone: d.timezone ?? null,
    }).where(eq(ghostTrapProbesTable.probeId, probeId));
  } catch { /* best-effort only */ }
}

// ─── Poisoned response builder (injects beacon tracking) ─────────────────────
function buildFakeResponse(
  endpoint: string, attackType: string, beaconId: string, beaconBase: string
): { body: unknown; contentType: string } {
  const pixelUrl = `${beaconBase}/beacon/${beaconId}`;
  const jsUrl    = `${beaconBase}/beacon/${beaconId}/js`;

  // HTML wrapper for endpoints that might render in a browser
  const withBeaconHtml = (inner: string) =>
    `${inner}\n<!-- <img src="${pixelUrl}" width="1" height="1" style="display:none"> -->\n<script src="${jsUrl}"></script>`;

  if (endpoint.includes("login") || endpoint.includes("auth")) {
    return {
      body: {
        success: true,
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6InN1cGVyYWRtaW4iLCJpYXQiOjE3MTcwMDAwMDB9.PROXHQ_GHOST_TRAP",
        user: { id: 1, username: "admin", email: "admin@internal.corp", role: "superadmin", last_login: "2026-06-04T09:12:00Z" },
        session: crypto.randomBytes(16).toString("hex"),
        db_host: "10.0.0.5:3306",
        env: "production",
        monitoring_webhook: pixelUrl,   // ← attacker may probe this webhook "to test"
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
        total: 3,
        db_version: "MySQL 5.7.39-log",
        query_time: "0.0042s",
      },
      contentType: "application/json",
    };
  }

  if (endpoint.includes(".env") || endpoint.includes("config")) {
    const adminTok = "gt_" + crypto.randomBytes(8).toString("hex");
    return {
      body: [
        "APP_ENV=production",
        "DB_HOST=10.0.0.5",
        "DB_USER=root",
        "DB_PASS=Sup3rS3cr3tProd2024!",
        "DB_NAME=app_production",
        "STRIPE_SECRET=sk_live_GHOSTTRAP_FAKE_KEY_PROXHQ",
        "JWT_SECRET=GhostTrap_Fake_JWT_Secret_ProxhqVPN",
        `ADMIN_TOKEN=${adminTok}`,
        "AWS_ACCESS_KEY_ID=AKIA_GHOSTTRAP_FAKE_KEY",
        "AWS_SECRET_ACCESS_KEY=GhostTrapFakeSecret+proxhqvpn+trap",
        `MONITORING_URL=${pixelUrl}`,   // ← beacon embedded as monitoring URL
        `ANALYTICS_ENDPOINT=${jsUrl}`,
      ].join("\n"),
      contentType: "text/plain",
    };
  }

  if (endpoint.includes("wp-admin") || endpoint.includes("admin")) {
    return {
      body: {
        status: "ok", version: "AdminPanel v2.1", uptime: "14d 7h",
        users_online: 3,
        db: { host: "localhost", name: "app_db", user: "root", version: "MySQL 5.7.39" },
        server: { os: "Ubuntu 22.04", php: "8.1.2", memory: "512M" },
        last_backup: "2026-06-04T03:00:00Z",
        health_check: pixelUrl,   // ← embedded as a "health check" endpoint
      },
      contentType: "application/json",
    };
  }

  if (endpoint.includes("backup") || endpoint.includes(".sql")) {
    return {
      body: withBeaconHtml([
        "-- MySQL dump 10.13  Distrib 5.7.39",
        "-- Host: localhost    Database: app_production",
        "-- Server version\t5.7.39-log",
        "/*!40101 SET NAMES utf8 */;",
        "CREATE TABLE `users` (`id` int(11) NOT NULL AUTO_INCREMENT, `username` varchar(255), `password` varchar(255), PRIMARY KEY (`id`));",
        "INSERT INTO `users` VALUES (1,'admin','$2b$12$GTFakeAdminHashProxhqVPN'),(2,'jsmith','$2b$12$GTFakeUserHashProxhqVPN');",
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
async function handleProbe(req: Request, res: Response, endpointName: string) {
  const cfg = await getConfig();
  if (!cfg.enabled) { res.status(503).end(); return; }

  const ip  = getIp(req);
  const ua  = (req.headers["user-agent"] ?? "").substring(0, 512);
  const rawPayload = JSON.stringify({
    query: req.query, body: req.body,
    path: req.path, headers: { "content-type": req.headers["content-type"] },
  }).substring(0, 4096);

  const allData  = rawPayload + " " + req.path;
  const attack   = detectAttack(allData);
  const probeType = attack?.type ?? (
    req.path.includes(".env") ? "recon" :
    req.path.includes("wp-") ? "recon" :
    req.method === "POST" ? "auth_brute" : "recon"
  );

  const tarpitMs = cfg.tarpitMinMs + Math.floor(Math.random() * (cfg.tarpitMaxMs - cfg.tarpitMinMs));
  await tarpit(tarpitMs);

  const beaconId = crypto.randomUUID();
  // Beacon base URL — use the request's own host so it's always reachable
  const proto = req.headers["x-forwarded-proto"] ?? "https";
  const host  = req.headers["x-forwarded-host"] ?? req.headers.host ?? "";
  const beaconBase = `${proto}://${host}/api/ghost-trap`;

  const fake     = buildFakeResponse(endpointName, probeType, beaconId, beaconBase);
  const fakeJson = (typeof fake.body === "string" ? fake.body : JSON.stringify(fake.body)).substring(0, 2048);

  const probeId = crypto.randomUUID();
  await db.insert(ghostTrapProbesTable).values({
    probeId, attackerIp: ip, attackerUa: ua,
    method: req.method, endpoint: endpointName,
    rawPayload, probeType, attackVector: attack?.vector ?? null,
    fakeResponse: fakeJson, tarpitMs,
    beaconId,
    referer:      (req.headers.referer ?? "").substring(0, 512),
    probeHeaders: JSON.stringify(req.headers).substring(0, 1024),
  }).catch(() => {});

  // Async geo enrichment — doesn't block the response
  enrichGeo(probeId, ip).catch(() => {});

  // Count probes from this IP
  const [ipCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ghostTrapProbesTable)
    .where(eq(ghostTrapProbesTable.attackerIp, ip));
  const count = ipCount?.count ?? 1;

  // Auto-block
  if (count >= cfg.autoBlockAfter) {
    const exists = await db.select().from(blockedIpsTable)
      .where(eq(blockedIpsTable.ip, ip)).limit(1);
    if (!exists.length) {
      await db.insert(blockedIpsTable).values({
        ip, reason: `Ghost Trap: ${count} probes (${probeType})`,
        blockedAt: new Date(), permanent: false,
      }).catch(() => {});
      await db.update(ghostTrapProbesTable).set({ autoBlocked: true })
        .where(eq(ghostTrapProbesTable.probeId, probeId)).catch(() => {});
    }
  }

  // Silk-trap
  if (count >= cfg.silkTrapAfter) {
    const alreadyTrapped = await db.select().from(trappedAttackersTable)
      .where(eq(trappedAttackersTable.ip, ip)).limit(1);
    if (!alreadyTrapped.length) {
      const webRows = await db.select().from(silkWebTable).limit(1);
      if (webRows.length) {
        await db.insert(trappedAttackersTable).values({
          ip, fingerprint: `GHOST_TRAP|IP:${ip}|UA:${ua.substring(0, 80)}|PROBES:${count}`,
          nodeId: 1, honeypotPort: 443,
          probeType: `ghost_trap_${probeType}`,
          dataCollected: JSON.stringify({ probeCount: count, lastVector: attack?.vector, endpoint: endpointName, beaconId }),
          sqlmapStatus: "idle", trappedAt: new Date(),
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

// ─── Ghost Beacon — pixel + JS fingerprint collector ─────────────────────────
// These are PUBLIC so the attacker's browser/tooling hits them directly.

// 1×1 GIF pixel beacon
router.get("/beacon/:beaconId", async (req, res) => {
  const { beaconId } = req.params;
  const firedFromIp = getIp(req);
  const firedUa     = (req.headers["user-agent"] ?? "").substring(0, 512);

  // Log beacon fire
  await db.insert(ghostTrapBeaconsTable).values({
    beaconId, probeId: beaconId, // probeId linked by beaconId
    attackerIp: firedFromIp, firedFromIp,
    firedUa, firedHeaders: JSON.stringify(req.headers).substring(0, 1024),
  }).catch(() => {});

  // Mark probe as beacon-fired
  await db.update(ghostTrapProbesTable)
    .set({ beaconFired: true, beaconFiredAt: new Date() })
    .where(eq(ghostTrapProbesTable.beaconId, beaconId))
    .catch(() => {});

  res.setHeader("Content-Type", "image/gif");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Powered-By", "Apache/2.4.54");
  res.status(200).send(PIXEL_GIF);
});

// JS beacon — collects additional browser fingerprint (lang, screen size, timezone)
router.get("/beacon/:beaconId/js", async (req, res) => {
  const { beaconId } = req.params;
  const beaconCallbackPath = req.path.replace("/js", "/cb");
  // Return a tiny JS snippet that POSTs fingerprint data back
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

// JS beacon callback — stores browser fingerprint from attacker
router.post("/beacon/:beaconId/cb", async (req, res) => {
  const { beaconId } = req.params;
  const { l, s, z, p, c } = req.body as Record<string, string>;
  await db.update(ghostTrapBeaconsTable).set({
    browserLang: l ?? null,
    screenSize:  s ?? null,
    timezone:    z ?? null,
  }).where(eq(ghostTrapBeaconsTable.beaconId, beaconId)).catch(() => {});
  await db.update(ghostTrapProbesTable).set({
    beaconFired: true, beaconFiredAt: new Date(),
  }).where(eq(ghostTrapProbesTable.beaconId, beaconId)).catch(() => {});
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH-PROTECTED DASHBOARD ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════════

router.get("/probes", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 200, 500);
  const probes = await db.select().from(ghostTrapProbesTable)
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
  }).from(ghostTrapProbesTable);
  res.json({ probes, stats });
});

router.get("/config", async (_req, res) => {
  res.json(await getConfig());
});

router.post("/config", async (req, res) => {
  const cfg = await getConfig();
  const {
    enabled, tarpitMinMs, tarpitMaxMs,
    autoBlockAfter, silkTrapAfter, fakeSiteName, fakeDbVersion,
  } = req.body as Partial<typeof cfg>;
  const [updated] = await db.update(ghostTrapConfigTable)
    .set({
      ...(enabled !== undefined      && { enabled: Boolean(enabled) }),
      ...(tarpitMinMs !== undefined  && { tarpitMinMs: Number(tarpitMinMs) }),
      ...(tarpitMaxMs !== undefined  && { tarpitMaxMs: Number(tarpitMaxMs) }),
      ...(autoBlockAfter !== undefined && { autoBlockAfter: Number(autoBlockAfter) }),
      ...(silkTrapAfter !== undefined  && { silkTrapAfter: Number(silkTrapAfter) }),
      ...(fakeSiteName && { fakeSiteName }),
      ...(fakeDbVersion && { fakeDbVersion }),
      updatedAt: new Date(),
    })
    .where(eq(ghostTrapConfigTable.id, cfg.id))
    .returning();
  res.json(updated);
});

// WHOIS / geo enrichment for a specific IP (on-demand)
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

// Authority Report — formatted for law enforcement handover
router.get("/report/:ip", async (req, res) => {
  const { ip } = req.params;
  const download = req.query.download === "1";

  const probes = await db.select().from(ghostTrapProbesTable)
    .where(eq(ghostTrapProbesTable.attackerIp, ip))
    .orderBy(ghostTrapProbesTable.probedAt);

  const beacons = await db.select().from(ghostTrapBeaconsTable)
    .where(eq(ghostTrapBeaconsTable.attackerIp, ip))
    .orderBy(ghostTrapBeaconsTable.firedAt);

  if (!probes.length) return res.status(404).json({ error: "No probes found for this IP" });

  const first = probes[0];
  const last  = probes[probes.length - 1];
  const reportId = "GT-" + Date.now().toString(36).toUpperCase();
  const now = new Date().toISOString();

  const geo = first.geoCountry ? [
    `  IP Address:    ${ip}`,
    `  ISP / Org:     ${first.geoIsp ?? "—"} / ${first.geoOrg ?? "—"}`,
    `  ASN:           ${first.geoAsn ?? "—"}`,
    `  Country:       ${first.geoCountry ?? "—"}`,
    `  City:          ${first.geoCity ?? "—"}`,
    `  Timezone:      ${first.geoTimezone ?? "—"}`,
  ].join("\n") : `  IP Address:    ${ip}\n  Geo data:      Not yet enriched — check WHOIS tab`;

  const timeline = probes.map((p, i) =>
    `  #${String(i + 1).padStart(3, "0")}  ${p.probedAt.toISOString()}  ${p.method.padEnd(5)} /${p.endpoint.padEnd(24)} [${p.probeType}]${p.attackVector ? `  → "${p.attackVector}"` : ""}${p.beaconFired ? "  🔥 BEACON FIRED" : ""}`
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
    "ATTACKER PROFILE",
    "━━━━━━━━━━━━━━━━",
    geo,
    "",
    "ATTACK SUMMARY",
    "━━━━━━━━━━━━━━",
    `  Total probes:   ${probes.length}`,
    `  Beacon fires:   ${beacons.length}`,
    `  First probe:    ${first.probedAt.toISOString()}`,
    `  Last probe:     ${last.probedAt.toISOString()}`,
    `  Attack types:   ${attackTypes.join(", ")}`,
    `  Attack vectors: ${uniqueVectors.join(" | ") || "none detected"}`,
    `  Auto-blocked:   ${probes.some(p => p.autoBlocked) ? "YES" : "NO"}`,
    `  Silk-trapped:   ${probes.some(p => p.silkTrapped) ? "YES" : "NO"}`,
    "",
    "ATTACKER USER AGENTS",
    "━━━━━━━━━━━━━━━━━━━━",
    ...[...new Set(probes.map(p => p.attackerUa).filter(Boolean))].map(ua => `  ${ua}`),
    "",
    "PROBE TIMELINE",
    "━━━━━━━━━━━━━━",
    timeline,
    "",
    "GHOST BEACON CONFIRMATION",
    "━━━━━━━━━━━━━━━━━━━━━━━━━",
    "  Beacons are tracking pixels and JS callbacks embedded in our poisoned",
    "  responses. A beacon fire confirms the attacker actively used the data",
    "  we served — providing additional forensic evidence of intent.",
    "",
    beaconSection,
    "",
    "LEGAL DECLARATION",
    "━━━━━━━━━━━━━━━━━",
    "  All data in this report was collected from unsolicited connection",
    "  attempts made to servers owned and operated by:",
    "",
    "    Alpha Unlimited Technologies LLC",
    "    ProxhqVPN Platform",
    "",
    "  The IP address listed above initiated unauthorized probing of our",
    "  security infrastructure. All collection methodology complies with",
    "  applicable computer fraud and abuse statutes. This report may be",
    "  furnished to law enforcement as evidence of unauthorized access",
    "  attempts under 18 U.S.C. § 1030 (CFAA) and equivalent statutes.",
    "",
    `  Report generated by Ghost Trap v2.0 on ${now}`,
    "  © Alpha Unlimited Technologies LLC. All rights reserved.",
    "═══════════════════════════════════════════════════════════════════════════",
  ].join("\n");

  if (download) {
    res.setHeader("Content-Disposition", `attachment; filename="proxhqvpn-incident-${ip.replace(/[.:]/g, "_")}-${reportId}.txt"`);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
  } else {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
  }
  res.send(report);
});

router.delete("/probes", async (_req, res) => {
  await db.delete(ghostTrapBeaconsTable);
  await db.delete(ghostTrapProbesTable);
  res.json({ ok: true });
});

export default router;
