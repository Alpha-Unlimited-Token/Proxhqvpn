// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Trap — Active honeypot engine.
// Public lure endpoints accept attacker probes, detect injection type,
// feed poisoned data, tarpit connections, and auto-block repeat offenders.
import { Router, Request, Response } from "express";
import { db } from "@workspace/db";
import {
  ghostTrapProbesTable, ghostTrapConfigTable,
  blockedIpsTable, trappedAttackersTable, silkWebTable,
} from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

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

// Detect injection type + extract the matched vector
function detectAttack(data: string): { type: string; vector: string } | null {
  if (!data) return null;
  const s = decodeURIComponent(data).toLowerCase();

  const sql_patterns: [RegExp, string][] = [
    [/union\s+select/i,          "UNION SELECT"],
    [/'\s*or\s+['"]?\d/i,        "OR injection"],
    [/'\s*and\s+['"]?\d/i,       "AND injection"],
    [/;\s*(drop|delete|insert|update|truncate)\s/i, "destructive SQL"],
    [/\bsleep\s*\(\d/i,          "time-based blind (SLEEP)"],
    [/benchmark\s*\(\d/i,        "time-based blind (BENCHMARK)"],
    [/xp_cmdshell/i,             "xp_cmdshell"],
    [/load_file\s*\(/i,          "LOAD_FILE"],
    [/outfile\s+['"]/i,          "INTO OUTFILE"],
    [/information_schema/i,      "information_schema dump"],
    [/--\s*$/m,                  "SQL comment terminator"],
    [/\/\*.*\*\//,               "SQL block comment"],
    [/\bchar\s*\(\d/i,           "CHAR() encoding"],
    [/0x[0-9a-f]{4,}/i,          "hex encoding"],
  ];
  for (const [re, label] of sql_patterns) {
    if (re.test(s)) return { type: "sql_injection", vector: label };
  }

  const xss_patterns: [RegExp, string][] = [
    [/<script[\s>]/i,           "<script> tag"],
    [/javascript:/i,            "javascript: URI"],
    [/on\w+\s*=/i,              "event handler (on*)"],
    [/<img[^>]+src/i,           "<img> injection"],
    [/<svg[^>]*on\w+/i,         "SVG event injection"],
    [/\balert\s*\(/i,           "alert() call"],
    [/document\.cookie/i,       "cookie theft"],
    [/eval\s*\(/i,              "eval() call"],
  ];
  for (const [re, label] of xss_patterns) {
    if (re.test(s)) return { type: "xss", vector: label };
  }

  const cmd_patterns: [RegExp, string][] = [
    [/;\s*(ls|cat|id|whoami|pwd|wget|curl)\b/i, "shell command injection"],
    [/\|\s*(ls|cat|id|whoami|pwd)\b/i,          "pipe injection"],
    [/&&\s*(ls|cat|id|whoami)/i,                "chain injection"],
    [/\$\([^)]+\)/,                             "command substitution $()"],
    [/`[^`]+`/,                                 "backtick injection"],
    [/\bping\s+-c/i,                            "ping -c (OOB)"],
    [/nslookup\s+/i,                            "nslookup (OOB)"],
    [/curl\s+http/i,                            "curl SSRF"],
  ];
  for (const [re, label] of cmd_patterns) {
    if (re.test(s)) return { type: "cmd_injection", vector: label };
  }

  const path_patterns: [RegExp, string][] = [
    [/\.\.(\/|%2f)/i,           "path traversal ../"],
    [/\/etc\/passwd/i,          "/etc/passwd"],
    [/\/proc\/self/i,           "/proc/self"],
    [/\bboot\.ini\b/i,          "boot.ini"],
    [/win\.ini/i,               "win.ini"],
  ];
  for (const [re, label] of path_patterns) {
    if (re.test(s)) return { type: "path_traversal", vector: label };
  }

  return null;
}

// Build convincing poisoned response based on endpoint + attack type
function buildFakeResponse(endpoint: string, attackType: string): { body: unknown; contentType: string } {
  if (endpoint.includes("login") || endpoint.includes("auth")) {
    return {
      body: {
        success: true,
        token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6ImFkbWluIiwicm9sZSI6InN1cGVyYWRtaW4iLCJpYXQiOjE3MTcwMDAwMDB9.PROXHQ_GHOST_TRAP",
        user: { id: 1, username: "admin", email: "admin@internal.corp", role: "superadmin", last_login: "2026-06-04T09:12:00Z" },
        session: crypto.randomBytes(16).toString("hex"),
        db_host: "10.0.0.5:3306",
        env: "production",
      },
      contentType: "application/json",
    };
  }
  if (endpoint.includes("user") || attackType === "sql_injection") {
    return {
      body: {
        rows: [
          { id: 1, username: "admin",      email: "admin@corp.local",    password_hash: "$2b$12$GhostTrapFakeHashAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", role: "superadmin", created: "2024-01-01" },
          { id: 2, username: "jsmith",     email: "j.smith@corp.local",  password_hash: "$2b$12$GhostTrapFakeHashBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB", role: "admin",      created: "2024-03-15" },
          { id: 3, username: "mwilliams", email: "m.w@corp.local",       password_hash: "$2b$12$GhostTrapFakeHashCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC", role: "user",       created: "2024-05-20" },
        ],
        total: 3,
        db_version: "MySQL 5.7.39-log",
        query_time: "0.0042s",
      },
      contentType: "application/json",
    };
  }
  if (endpoint.includes(".env") || endpoint.includes("config")) {
    return {
      body: [
        "APP_ENV=production",
        "DB_HOST=10.0.0.5",
        "DB_USER=root",
        "DB_PASS=Sup3rS3cr3tProd2024!",
        "DB_NAME=app_production",
        "STRIPE_SECRET=sk_live_GHOSTTRAP_FAKE_KEY_PROXHQ",
        "JWT_SECRET=GhostTrap_Fake_JWT_Secret_ProxhqVPN",
        "ADMIN_TOKEN=gt_fake_admin_token_proxhq_" + crypto.randomBytes(8).toString("hex"),
        "AWS_ACCESS_KEY_ID=AKIA_GHOSTTRAP_FAKE_KEY",
        "AWS_SECRET_ACCESS_KEY=GhostTrapFakeSecretKey+proxhqvpn+trap",
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
      },
      contentType: "application/json",
    };
  }
  // Default recon response
  return {
    body: { ok: true, message: "OK", version: "1.0.4", server: "Apache/2.4.54" },
    contentType: "application/json",
  };
}

async function handleProbe(req: Request, res: Response, endpointName: string) {
  const cfg = await getConfig();
  if (!cfg.enabled) { res.status(503).end(); return; }

  const ip = getIp(req);
  const ua = (req.headers["user-agent"] ?? "").substring(0, 512);
  const rawPayload = JSON.stringify({
    query: req.query, body: req.body, params: req.params,
    path: req.path, headers: { "content-type": req.headers["content-type"] },
  }).substring(0, 4096);

  // Detect attack in all input surfaces
  const allData = rawPayload + " " + req.path;
  const attack = detectAttack(allData);
  const probeType = attack?.type ?? (
    req.path.includes(".env") ? "recon" :
    req.path.includes("wp-") ? "recon" :
    req.method === "POST" ? "auth_brute" : "recon"
  );

  // Tarpit — slow down the attacker
  const tarpitMs = cfg.tarpitMinMs + Math.floor(Math.random() * (cfg.tarpitMaxMs - cfg.tarpitMinMs));
  await tarpit(tarpitMs);

  // Build poisoned response
  const fake = buildFakeResponse(endpointName, probeType);
  const fakeJson = JSON.stringify(fake.body).substring(0, 2048);

  // Save probe record
  const probeId = crypto.randomUUID();
  await db.insert(ghostTrapProbesTable).values({
    probeId, attackerIp: ip, attackerUa: ua,
    method: req.method, endpoint: endpointName,
    rawPayload, probeType, attackVector: attack?.vector ?? null,
    fakeResponse: fakeJson, tarpitMs,
    referer: (req.headers.referer ?? "").substring(0, 512),
    probeHeaders: JSON.stringify(req.headers).substring(0, 1024),
  }).catch(() => {});

  // Count probes from this IP
  const [ipCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(ghostTrapProbesTable)
    .where(eq(ghostTrapProbesTable.attackerIp, ip));
  const count = ipCount?.count ?? 1;

  let autoBlocked = false;
  let silkTrapped = false;

  // Auto-block after threshold
  if (count >= cfg.autoBlockAfter) {
    const exists = await db.select().from(blockedIpsTable).where(eq(blockedIpsTable.ip, ip)).limit(1);
    if (!exists.length) {
      await db.insert(blockedIpsTable).values({
        ip, reason: `Ghost Trap: ${count} probes (${probeType})`,
        blockedAt: new Date(), permanent: false,
      }).catch(() => {});
      autoBlocked = true;
    }
  }

  // Silk-trap after lower threshold
  if (count >= cfg.silkTrapAfter) {
    const alreadyTrapped = await db.select().from(trappedAttackersTable)
      .where(eq(trappedAttackersTable.ip, ip)).limit(1);
    if (!alreadyTrapped.length) {
      const webRows = await db.select().from(silkWebTable).limit(1);
      if (webRows.length) {
        await db.insert(trappedAttackersTable).values({
          ip, fingerprint: `GHOST_TRAP|IP:${ip}|UA:${ua.substring(0,80)}|PROBES:${count}`,
          nodeId: 1, honeypotPort: 443,
          probeType: `ghost_trap_${probeType}`,
          dataCollected: JSON.stringify({ probeCount: count, lastVector: attack?.vector, endpoint: endpointName }),
          sqlmapStatus: "idle",
          trappedAt: new Date(),
        }).catch(() => {});
        silkTrapped = true;
      }
    }
  }

  // Update probe with block/trap status
  await db.update(ghostTrapProbesTable)
    .set({ autoBlocked, silkTrapped })
    .where(eq(ghostTrapProbesTable.probeId, probeId))
    .catch(() => {});

  // Send poisoned response (never hint this is a trap)
  res.setHeader("Content-Type", fake.contentType);
  res.setHeader("X-Powered-By", "Apache/2.4.54");
  res.setHeader("Server", "Apache/2.4.54 (Ubuntu)");
  if (typeof fake.body === "string") {
    res.status(200).send(fake.body);
  } else {
    res.status(200).json(fake.body);
  }
}

// ─── Public lure endpoints (no auth — intentionally reachable by attackers) ──

router.all("/lure/login",       (req, res) => handleProbe(req, res, "login"));
router.all("/lure/auth",        (req, res) => handleProbe(req, res, "auth"));
router.all("/lure/admin",       (req, res) => handleProbe(req, res, "admin"));
router.all("/lure/wp-admin",    (req, res) => handleProbe(req, res, "wp-admin"));
router.all("/lure/api/users",   (req, res) => handleProbe(req, res, "api/users"));
router.all("/lure/api/search",  (req, res) => handleProbe(req, res, "api/search"));
router.all("/lure/api/data",    (req, res) => handleProbe(req, res, "api/data"));
router.get("/lure/.env",        (req, res) => handleProbe(req, res, ".env"));
router.get("/lure/config.php",  (req, res) => handleProbe(req, res, "config.php"));
router.get("/lure/backup.sql",  (req, res) => handleProbe(req, res, "backup.sql"));
router.all("/lure/{*path}",     (req, res) => handleProbe(req, res, req.path));

// ─── Auth-required dashboard endpoints ────────────────────────────────────────

router.get("/probes", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 500);
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
      ...(enabled !== undefined && { enabled: Boolean(enabled) }),
      ...(tarpitMinMs !== undefined && { tarpitMinMs: Number(tarpitMinMs) }),
      ...(tarpitMaxMs !== undefined && { tarpitMaxMs: Number(tarpitMaxMs) }),
      ...(autoBlockAfter !== undefined && { autoBlockAfter: Number(autoBlockAfter) }),
      ...(silkTrapAfter !== undefined && { silkTrapAfter: Number(silkTrapAfter) }),
      ...(fakeSiteName && { fakeSiteName }),
      ...(fakeDbVersion && { fakeDbVersion }),
      updatedAt: new Date(),
    })
    .where(eq(ghostTrapConfigTable.id, cfg.id))
    .returning();
  res.json(updated);
});

router.delete("/probes", async (_req, res) => {
  await db.delete(ghostTrapProbesTable);
  res.json({ ok: true });
});

export default router;
