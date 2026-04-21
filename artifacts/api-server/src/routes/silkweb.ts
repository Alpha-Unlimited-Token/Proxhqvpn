import { Router } from "express";
import { db } from "@workspace/db";
import { silkWebTable, silkRoutesTable, trappedAttackersTable, nodesTable, beaconAlertsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import crypto from "crypto";
import { exec } from "child_process";

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
    for (let i = 0; i < Math.min(totalRoutes, 50); i++) {
      const from = nodes[Math.floor(Math.random() * nodes.length)];
      const to = nodes[Math.floor(Math.random() * nodes.length)];
      if (from.id !== to.id) {
        const routeTypes = ["highway", "dead_end", "decoy", "collapse_zone"];
        routeValues.push({
          webId: web.id,
          fromNodeId: from.id,
          toNodeId: to.id,
          routeType: i < deadEnds ? "dead_end" : routeTypes[Math.floor(Math.random() * routeTypes.length)],
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
    for (let i = 0; i < Math.min(totalRoutes, 50); i++) {
      const from = nodes[Math.floor(Math.random() * nodes.length)];
      const to = nodes[Math.floor(Math.random() * nodes.length)];
      if (from.id !== to.id) {
        routeValues.push({
          webId: web.id,
          fromNodeId: from.id,
          toNodeId: to.id,
          routeType: i < deadEnds ? "dead_end" : ["highway", "decoy", "collapse_zone"][Math.floor(Math.random() * 3)],
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

// Port scan a trapped attacker using nmap
router.post("/trapped/:id/portscan", async (req, res) => {
  const id = parseInt(req.params.id);
  const [attacker] = await db.select().from(trappedAttackersTable).where(eq(trappedAttackersTable.id, id));
  if (!attacker) return res.status(404).json({ error: "Trapped attacker not found" });

  const { ports = "1-10000", flags = "-sV -T4" } = req.body as { ports?: string; flags?: string };

  // Sanitize inputs
  const safePorts = ports.replace(/[^0-9\-,]/g, "").substring(0, 50);
  const safeFlags = flags.replace(/[^a-zA-Z0-9 \-]/g, "").substring(0, 80);

  const cmd = `nmap ${safeFlags} -p ${safePorts} ${attacker.ip}`;

  exec(cmd, { timeout: 90000 }, (err, stdout, stderr) => {
    const output = [stdout, stderr].filter(Boolean).join("\n").substring(0, 8000);
    res.json({
      ok: true,
      ip: attacker.ip,
      cmd,
      output: output || (err ? err.message : "No output"),
      exitCode: err ? (err as any).code ?? 1 : 0,
    });
  });
});

// Launch SQLmap against a trapped attacker
router.post("/trapped/:id/sqlmap", async (req, res) => {
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
    honeypotNodes: 4,
    sqlmapJobs: sqlmapJobs[0]?.count ?? 0,
  });
});

export default router;
