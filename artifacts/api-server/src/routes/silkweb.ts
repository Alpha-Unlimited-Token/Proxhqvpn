// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { db } from "@workspace/db";
import { silkWebTable, silkRoutesTable, trappedAttackersTable, nodesTable, beaconAlertsTable, blockedIpsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import crypto from "crypto";
import { requireRbac } from "../middlewares/requireRbac";
import { requireLabTarget } from "../lib/lab-targets";

const router = Router();

async function ensureWeb() {
  const webs = await db.select().from(silkWebTable).orderBy(sql`created_at DESC`).limit(1);
  if (webs.length > 0) return webs[0];

  const nodes = await db.select().from(nodesTable);
  const genId = crypto.randomUUID().substring(0, 8).toUpperCase();
  const totalRoutes = Math.min(nodes.length * 2, 200);
  const deadEnds = Math.floor(totalRoutes * 0.4);

  const [web] = await db.insert(silkWebTable).values({
    generationId: genId,
    totalRoutes,
    deadEndRoutes: deadEnds,
    activeHighways: Math.floor(totalRoutes * 0.3),
    intersections: Math.floor(totalRoutes * 0.2),
    createdAt: new Date(),
  }).returning();

  let actualRouteCount = 0;
  if (nodes.length >= 2) {
    const routeValues = [];
    const routeTypes = ["highway", "decoy", "collapse_zone"];
    for (let i = 0; i < Math.min(totalRoutes, 50); i++) {
      const from = nodes[i % nodes.length];
      const to   = nodes[(i + 1 + Math.floor(i / nodes.length)) % nodes.length];
      if (from.id !== to.id) {
        routeValues.push({
          webId: web.id,
          fromNodeId: from.id,
          toNodeId: to.id,
          routeType: i < deadEnds ? "dead_end" : routeTypes[i % routeTypes.length],
          isActive: true,
        });
      }
    }
    if (routeValues.length > 0) {
      await db.insert(silkRoutesTable).values(routeValues);
      actualRouteCount = routeValues.length;
    }
  }

  if (actualRouteCount !== totalRoutes) {
    await db.update(silkWebTable).set({ totalRoutes: actualRouteCount }).where(eq(silkWebTable.id, web.id));
    web.totalRoutes = actualRouteCount;
  }

  return web;
}

router.get("/", async (req, res) => {
  const web = await ensureWeb();
  const routes = await db.select().from(silkRoutesTable).where(eq(silkRoutesTable.webId, web.id));
  res.json({ ...web, routes });
});

router.post("/collapse", async (req, res) => {
  await db.delete(silkRoutesTable);
  await db.delete(silkWebTable);

  const nodes = await db.select().from(nodesTable);
  const genId = crypto.randomUUID().substring(0, 8).toUpperCase();
  const totalRoutes = Math.min(nodes.length * 2, 200);
  const deadEnds = Math.floor(totalRoutes * 0.4);

  const [web] = await db.insert(silkWebTable).values({
    generationId: genId,
    totalRoutes,
    deadEndRoutes: deadEnds,
    activeHighways: Math.floor(totalRoutes * 0.35),
    intersections: Math.floor(totalRoutes * 0.25),
    lastCollapsedAt: new Date(),
    createdAt: new Date(),
  }).returning();

  let collapseRouteCount = 0;
  if (nodes.length >= 2) {
    const routeValues = [];
    const collapseTypes = ["highway", "decoy", "collapse_zone"];
    for (let i = 0; i < Math.min(totalRoutes, 50); i++) {
      const from = nodes[i % nodes.length];
      const to   = nodes[(i + 1 + Math.floor(i / nodes.length)) % nodes.length];
      if (from.id !== to.id) {
        routeValues.push({
          webId: web.id,
          fromNodeId: from.id,
          toNodeId: to.id,
          routeType: i < deadEnds ? "dead_end" : collapseTypes[i % collapseTypes.length],
          isActive: true,
        });
      }
    }
    if (routeValues.length > 0) {
      await db.insert(silkRoutesTable).values(routeValues);
      collapseRouteCount = routeValues.length;
    }
  }

  if (collapseRouteCount !== web.totalRoutes) {
    await db.update(silkWebTable).set({ totalRoutes: collapseRouteCount }).where(eq(silkWebTable.id, web.id));
    web.totalRoutes = collapseRouteCount;
  }

  const routes = await db.select().from(silkRoutesTable).where(eq(silkRoutesTable.webId, web.id));
  res.json({ ...web, routes });
});

router.get("/trapped", async (req, res) => {
  const attackers = await db.select().from(trappedAttackersTable).orderBy(sql`trapped_at DESC`);
  res.json({ attackers, total: attackers.length });
});

// Auto-trap an attacker from a beacon alert
router.post("/trap", async (req, res) => {
  const { ip, fingerprint, nodeId, honeypotPort, probeType } = req.body as {
    ip: string; fingerprint?: string; nodeId: number; honeypotPort?: number; probeType?: string;
  };
  if (!ip || !nodeId) return res.status(400).json({ error: "ip and nodeId required" });

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, nodeId));
  if (!node) return res.status(404).json({ error: "Node not found" });

  const web = await ensureWeb();
  const fp = fingerprint ?? `IP:${ip}|NODE:${node.name}|PORT:${honeypotPort ?? "?"} |TS:${Date.now()}`;

  const [trapped] = await db.insert(trappedAttackersTable).values({
    ip,
    fingerprint: fp,
    entryNodeId: nodeId,
    loopCount: 0,
    dataCollected: JSON.stringify({ honeypotPort, probeType, webId: web.id, nodeRegion: node.region }),
    honeypotPort: honeypotPort ?? null,
    probeType: probeType ?? "honeypot_connect",
    sqlmapStatus: "idle",
  }).returning();

  // Mark any beacon alerts from this IP as silkweb-trapped
  await db.update(beaconAlertsTable)
    .set({ silkWebTrapped: true })
    .where(sql`attacker_ip = ${ip}`);

  return res.status(201).json({ ok: true, trapped });
});

// ── DISABLED: nmap against a trapped attacker IP ─────────────────────────────
// Scanning attacker IPs (public internet) without authorization is illegal.
// Use Ghost Trap counter-intelligence (TCP probes to IPs that attacked you) instead.
const trappedPortscanJobs = new Map<string, { status: string; results: string | null; cmd: string; ip: string }>();

router.post("/trapped/:id/portscan", requireRbac("silkweb_exploit"), (req, res) => {
  res.status(451).json({
    error: "Disabled — nmap against attacker IPs is unauthorized computer access.",
    policy: "Port scanning requires authorized_lab_target=true and target_scope='internal_lab'. Use Ghost Trap /counter/port-scan for TCP probes against IPs that have attacked your trap (probe-log verified).",
    removedAt: "2026-06-13",
  });
});

router.get("/trapped/:id/portscan/:jobId", (req, res) => {
  const job = trappedPortscanJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json(job);
});

// ── DISABLED: SQLmap against trapped attacker IPs ────────────────────────────
// Running sqlmap against attacker IPs (public internet) is unauthorized computer access.
// Policy: silkweb exploit tools may only target internal authorized lab targets.
// Use /api/silkweb/scan/sqlmap with authorized_lab_target=true (lab-internal use only).
router.post("/trapped/:id/sqlmap", requireRbac("silkweb_exploit"), (req, res) => {
  res.status(451).json({
    error: "Disabled — outbound scanning against attacker IPs is unauthorized computer access.",
    policy: "SQLmap may only run against targets with authorized_lab_target=true and target_scope='internal_lab'. Attacker IPs are public internet targets and are outside the authorized lab scope.",
    alternative: "Use Ghost Trap evidence export to collect dossiers. File an abuse report via ARIN/RIPE using the attacker WHOIS data.",
    removedAt: "2026-06-13",
  });
});

// Get SQLmap results for a trapped attacker
router.get("/trapped/:id/sqlmap", async (req, res) => {
  const id = parseInt(req.params.id);
  const [attacker] = await db.select().from(trappedAttackersTable).where(eq(trappedAttackersTable.id, id));
  if (!attacker) return res.status(404).json({ error: "Not found" });
  return res.json({
    jobId: attacker.sqlmapJobId,
    status: attacker.sqlmapStatus,
    results: attacker.sqlmapResults,
    startedAt: attacker.sqlmapStartedAt,
    finishedAt: attacker.sqlmapFinishedAt,
  });
});

// Full dossier JSON for a trapped attacker
router.get("/trapped/:id/dossier", async (req, res) => {
  const id = parseInt(req.params.id);
  const [attacker] = await db.select().from(trappedAttackersTable).where(eq(trappedAttackersTable.id, id));
  if (!attacker) return res.status(404).json({ error: "Not found" });
  let dataCollected: Record<string, unknown> = {};
  try { dataCollected = JSON.parse(attacker.dataCollected ?? "{}"); } catch {}
  return res.json({
    id: attacker.id,
    ip: attacker.ip,
    fingerprint: attacker.fingerprint,
    entryNodeId: attacker.entryNodeId,
    loopCount: attacker.loopCount,
    trappedAt: attacker.trappedAt,
    honeypotPort: attacker.honeypotPort,
    probeType: attacker.probeType,
    sqlmapStatus: attacker.sqlmapStatus,
    sqlmapResults: attacker.sqlmapResults,
    sqlmapStartedAt: attacker.sqlmapStartedAt,
    sqlmapFinishedAt: attacker.sqlmapFinishedAt,
    dataCollected,
  });
});

// Download full dossier as a formatted text report
router.get("/trapped/:id/dossier/download", async (req, res) => {
  const id = parseInt(req.params.id);
  const [attacker] = await db.select().from(trappedAttackersTable).where(eq(trappedAttackersTable.id, id));
  if (!attacker) return res.status(404).json({ error: "Not found" });

  let dc: Record<string, unknown> = {};
  try { dc = JSON.parse(attacker.dataCollected ?? "{}"); } catch {}

  const now = new Date().toISOString();
  const caseRef = `SILK-${attacker.id}-${new Date(attacker.trappedAt ?? now).toISOString().slice(0, 10).replace(/-/g, "")}`;
  const wormCbs = Array.isArray(dc.wormCallbacks) ? (dc.wormCallbacks as string[]).join("\n  ") : "None detected";
  const bar = "═".repeat(60);
  const sep = "─".repeat(60);

  const lines = [
    bar,
    "  PROXHQVPN — THREAT INTELLIGENCE DOSSIER",
    "  Copyright © Alpha Unlimited Technologies LLC",
    "  CONFIDENTIAL — FOR LAW ENFORCEMENT / SECURITY USE",
    bar,
    "",
    `  Case Reference : ${caseRef}`,
    `  Subject IP     : ${attacker.ip}`,
    `  Generated      : ${now}`,
    "",
    bar,
    "  SECTION 1 — ATTACK VECTOR",
    sep,
    `  Attacker IP    : ${attacker.ip}`,
    `  Honeypot Port  : ${attacker.honeypotPort ?? "N/A"}`,
    `  Probe Type     : ${attacker.probeType ?? "N/A"}`,
    `  Entry Node ID  : ${attacker.entryNodeId}`,
    `  Node Region    : ${dc.nodeRegion ?? "Unknown"}`,
    `  Web Generation : ${dc.webId ?? "Unknown"}`,
    `  Trapped At     : ${attacker.trappedAt}`,
    `  Loop Count     : ${attacker.loopCount}`,
    "",
    bar,
    "  SECTION 2 — TECHNICAL FINGERPRINT",
    sep,
    `  ${attacker.fingerprint}`,
    "",
    bar,
    "  SECTION 3 — RAW ATTACK PAYLOAD",
    sep,
    dc.rawRequest ? `${dc.rawRequest}` : "  Not captured",
    "",
    bar,
    "  SECTION 4 — SERVICE BANNER",
    sep,
    dc.banner ? `  ${dc.banner}` : "  Not captured",
    "",
    bar,
    "  SECTION 5 — WORM CALLBACK INDICATORS",
    sep,
    `  ${wormCbs}`,
    "",
    bar,
    "  SECTION 6 — AUTOMATED VULNERABILITY SCAN (SQLmap)",
    sep,
    `  Status   : ${attacker.sqlmapStatus ?? "idle"}`,
    `  Started  : ${attacker.sqlmapStartedAt ?? "N/A"}`,
    `  Finished : ${attacker.sqlmapFinishedAt ?? "N/A"}`,
    "",
    "  Results:",
    attacker.sqlmapResults ? attacker.sqlmapResults : "  No results available",
    "",
    bar,
    "  END OF DOSSIER — PROXHQVPN SILKWEB INTELLIGENCE SYSTEM",
    bar,
    "",
  ];

  const safeIp = attacker.ip.replace(/[:.]/g, "-");
  res.setHeader("Content-Disposition", `attachment; filename="dossier-${safeIp}-${caseRef}.txt"`);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.send(lines.join("\n"));
});

// ── Direct IP scan endpoints (no trapped-attacker record needed) ─────────────
// Used by the Beacon Alerts page to scan any raw IP directly.

const directSqlmapJobs = new Map<string, { status: string; results: string | null }>();
const directPortscanJobs = new Map<string, { status: string; results: string | null; cmd: string; ip: string }>();

// ── DISABLED: Unauthenticated nmap against any IP ────────────────────────────
// Previously this ran with no auth gate. Now requires silkweb_exploit RBAC and
// must target an authorized internal lab target only — not attacker/public IPs.
router.post("/scan/portscan", requireRbac("silkweb_exploit"), (req, res) => {
  res.status(451).json({
    error: "Disabled — unauthorized scan against public IPs.",
    policy: "Port scanning must target authorized internal lab targets only (authorized_lab_target=true, target_scope='internal_lab'). Pass labTargetId in the request body to use a registered lab target.",
    removedAt: "2026-06-13",
  });
});

router.get("/scan/portscan/:jobId", (req, res) => {
  const job = directPortscanJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json(job);
});

// ── DISABLED: SQLmap against any IP (direct scan) ────────────────────────────
// Policy: SQLmap and all outbound exploit tools are prohibited against public IPs.
// Register an internal lab target via /api/lab-targets and pass its ID instead.
router.post("/scan/sqlmap", requireRbac("silkweb_exploit"), (req, res) => {
  res.status(451).json({
    error: "Disabled — outbound SQLmap against public IPs is prohibited.",
    policy: "All SQLmap, os-cmd, and file-read tools require authorized_lab_target=true with target_scope='internal_lab'. Public internet scanning is unauthorized computer access.",
    guidance: "Register an authorized internal lab target at /api/lab-targets then submit labTargetId.",
    removedAt: "2026-06-13",
  });
});

router.get("/scan/sqlmap/:jobId", (req, res) => {
  const job = directSqlmapJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json(job);
});

// ── Full exploitation console endpoints ────────────────────────────────────

// In-memory job stores for custom commands
const customSqlmapJobs = new Map<string, { status: string; results: string | null; cmd: string }>();
const fileReadJobs     = new Map<string, { status: string; results: string | null; path: string }>();
const osCmdJobs        = new Map<string, { status: string; results: string | null; cmd: string }>();

// ── DISABLED: Custom SQLmap against trapped attacker ─────────────────────────
router.post("/trapped/:id/sqlmap-custom", requireRbac("silkweb_exploit"), (req, res) => {
  res.status(451).json({
    error: "Disabled — outbound exploitation against attacker IPs is prohibited.",
    policy: "Custom SQLmap flags may only target authorized internal lab targets (authorized_lab_target=true, target_scope='internal_lab'). Attacker IPs are public internet addresses.",
    removedAt: "2026-06-13",
  });
});

router.get("/trapped/:id/sqlmap-custom/:jobId", (req, res) => {
  const job = customSqlmapJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json(job);
});

// ── DISABLED: Remote file read via SQLmap --file-read ────────────────────────
// Attempting to read files on systems you do not own is unauthorized access.
router.post("/trapped/:id/file-read", requireRbac("silkweb_exploit"), (req, res) => {
  res.status(451).json({
    error: "Disabled — remote file-read on attacker systems is unauthorized computer access.",
    policy: "File-read capabilities may only target authorized internal lab targets. Attacker systems are not authorized targets under any circumstances.",
    removedAt: "2026-06-13",
  });
});

router.get("/trapped/:id/file-read/:jobId", (req, res) => {
  const job = fileReadJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json(job);
});

// ── DISABLED: Remote OS command execution via SQLmap --os-cmd ────────────────
// Remote OS command execution on systems you do not own is a criminal offense.
router.post("/trapped/:id/os-cmd", requireRbac("silkweb_exploit"), (req, res) => {
  res.status(451).json({
    error: "Disabled — remote OS command execution on attacker systems is a criminal offense under CFAA/CMA.",
    policy: "OS command execution may only target authorized internal lab targets with authorized_lab_target=true and target_scope='internal_lab'.",
    removedAt: "2026-06-13",
  });
});

router.get("/trapped/:id/os-cmd/:jobId", (req, res) => {
  const job = osCmdJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json(job);
});

// Get all worm callbacks + intelligence for control panel
router.get("/trapped/:id/control-data", async (req, res) => {
  const id = parseInt(req.params.id);
  const [attacker] = await db.select().from(trappedAttackersTable).where(eq(trappedAttackersTable.id, id));
  if (!attacker) return res.status(404).json({ error: "Trapped attacker not found" });

  let collected: Record<string, unknown> = {};
  try { collected = JSON.parse(attacker.dataCollected ?? "{}"); } catch { /* */ }

  return res.json({
    ip:           attacker.ip,
    fingerprint:  attacker.fingerprint,
    honeypotPort: attacker.honeypotPort,
    probeType:    attacker.probeType,
    trappedAt:    attacker.trappedAt,
    loopCount:    attacker.loopCount,
    sqlmapStatus: attacker.sqlmapStatus,
    sqlmapResults: attacker.sqlmapResults,
    wormCallbacks:      (collected.wormCallbacks as unknown[]) ?? [],
    banner:              collected.banner ?? null,
    rawRequest:          collected.rawRequest ?? null,
    nodeRegion:          collected.nodeRegion ?? null,
    autoExploitStatus:   (collected.autoExploitStatus as string | null) ?? null,
    autoExploitIp:       (collected.autoExploitIp as string | null) ?? null,
    autoExploitJobId:    (collected.autoExploitJobId as string | null) ?? null,
    autoExploitStartedAt:(collected.autoExploitStartedAt as string | null) ?? null,
    autoExploitFinishedAt:(collected.autoExploitFinishedAt as string | null) ?? null,
    autoExploitNmap:     (collected.autoExploitNmap as string | null) ?? null,
    autoExploitSqlmap:   (collected.autoExploitSqlmap as string | null) ?? null,
  });
});

// Delete a trapped attacker entry
router.delete("/trapped/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [deleted] = await db.delete(trappedAttackersTable).where(eq(trappedAttackersTable.id, id)).returning();
  if (!deleted) return res.status(404).json({ error: "Not found" });
  return res.json({ ok: true });
});

// Block a trapped attacker's IP — adds to firewall blocked-IPs table
router.post("/trapped/:id/block-ip", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [attacker] = await db.select().from(trappedAttackersTable).where(eq(trappedAttackersTable.id, id));
  if (!attacker) return res.status(404).json({ error: "Not found" });
  // Upsert into blockedIpsTable (ignore if already blocked)
  const existing = await db.select().from(blockedIpsTable).where(eq(blockedIpsTable.ip, attacker.ip)).limit(1);
  if (existing.length > 0) return res.json({ ok: true, alreadyBlocked: true, ip: attacker.ip });
  const [blocked] = await db.insert(blockedIpsTable).values({
    ip: attacker.ip,
    reason: `Silk Web Trap — manually blocked (entry #${id})`,
    autoBlocked: true,
    hitCount: 1,
    blockedAt: new Date(),
  }).returning();
  return res.json({ ok: true, blocked, ip: attacker.ip });
});

// Allow (unblock) a trapped attacker's IP — removes from firewall blocked-IPs
router.post("/trapped/:id/allow-ip", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [attacker] = await db.select().from(trappedAttackersTable).where(eq(trappedAttackersTable.id, id));
  if (!attacker) return res.status(404).json({ error: "Not found" });
  await db.delete(blockedIpsTable).where(eq(blockedIpsTable.ip, attacker.ip));
  return res.json({ ok: true, ip: attacker.ip });
});

// Live stats for homepage
router.get("/stats", async (req, res) => {
  const [nodeCount] = await db.select({ count: sql<number>`count(*)::int` }).from(nodesTable).where(eq(nodesTable.status, "active"));
  const [trapCount] = await db.select({ count: sql<number>`count(*)::int` }).from(trappedAttackersTable);
  const [webData]   = await db.select().from(silkWebTable).orderBy(desc(silkWebTable.createdAt)).limit(1);
  const sqlmapJobs  = await db.select({ count: sql<number>`count(*)::int` }).from(trappedAttackersTable).where(sql`sqlmap_status IN ('complete','running')`);
  return res.json({
    activeNodes: nodeCount?.count ?? 0,
    trappedAttackers: trapCount?.count ?? 0,
    silkRoutes: webData?.totalRoutes ?? 0,
    honeypotNodes: webData?.totalRoutes ?? 0,
    sqlmapJobs: sqlmapJobs[0]?.count ?? 0,
  });
});

export default router;
