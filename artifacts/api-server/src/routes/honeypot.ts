// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { appendAuditEvent } from "../lib/audit-chain";
import { shipSecurityEvent } from "../lib/siem";
import { requireRbac } from "../middlewares/requireRbac";
import {
  honeypotNodesTable,
  honeypotAttackersTable,
  honeypotSessionsTable,
  honeypotCommandsTable,
  honeypotFilesTable,
  honeypotIocsTable,
  honeypotAlertsTable,
} from "@workspace/db";
import { eq, desc, asc, and, sql, isNull, count, or } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

const router = Router();

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get("/stats", async (req, res) => {
  const [nodeStats] = await db
    .select({ total: count(), active: sql<number>`count(*) filter (where ${honeypotNodesTable.status} = 'active')` })
    .from(honeypotNodesTable);

  const [attackerStats] = await db.select({ total: count() }).from(honeypotAttackersTable);
  const [sessionStats] = await db.select({ total: count() }).from(honeypotSessionsTable);
  const [commandStats] = await db.select({ total: count() }).from(honeypotCommandsTable);
  const [fileStats] = await db.select({ total: count() }).from(honeypotFilesTable);
  const [alertStats] = await db
    .select({ total: count() })
    .from(honeypotAlertsTable)
    .where(eq(honeypotAlertsTable.acknowledged, false));

  // Sessions per day (last 14 days)
  const sessionsByDay = await db.execute<{ date: string; count: number }>(
    sql`SELECT DATE(started_at)::text as date, COUNT(*)::int as count
        FROM honeypot_sessions
        WHERE started_at >= NOW() - INTERVAL '14 days'
        GROUP BY DATE(started_at)
        ORDER BY date ASC`
  );

  // Top countries
  const topCountries = await db.execute<{ country: string; count: number }>(
    sql`SELECT COALESCE(country, 'Unknown') as country, COUNT(*)::int as count
        FROM honeypot_attackers
        GROUP BY country
        ORDER BY count DESC
        LIMIT 10`
  );

  // Recent sessions with attacker join
  const recentSessions = await db
    .select()
    .from(honeypotSessionsTable)
    .leftJoin(honeypotAttackersTable, eq(honeypotSessionsTable.attackerId, honeypotAttackersTable.id))
    .leftJoin(honeypotNodesTable, eq(honeypotSessionsTable.nodeId, honeypotNodesTable.id))
    .orderBy(desc(honeypotSessionsTable.startedAt))
    .limit(10);

  res.json({
    totalNodes: Number(nodeStats?.total ?? 0),
    activeNodes: Number(nodeStats?.active ?? 0),
    totalAttackers: Number(attackerStats?.total ?? 0),
    totalSessions: Number(sessionStats?.total ?? 0),
    totalCommands: Number(commandStats?.total ?? 0),
    totalFiles: Number(fileStats?.total ?? 0),
    unacknowledgedAlerts: Number(alertStats?.total ?? 0),
    sessionsByDay: sessionsByDay.rows.map((r) => ({ date: r.date, count: Number(r.count) })),
    topCountries: topCountries.rows.map((r) => ({ country: r.country, count: Number(r.count) })),
    recentSessions: recentSessions.map((row) => ({
      ...row.honeypot_sessions,
      attacker: row.honeypot_attackers ?? undefined,
      node: row.honeypot_nodes ?? undefined,
    })),
  });
});

// ── Nodes ─────────────────────────────────────────────────────────────────────
router.get("/nodes", async (_req, res) => {
  const nodes = await db.select().from(honeypotNodesTable).orderBy(desc(honeypotNodesTable.createdAt));
  res.json(nodes);
});

router.post("/nodes", requireRbac("honeypot_admin"), async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535).default(22),
    protocol: z.string().default("ssh"),
    location: z.string().optional(),
    country: z.string().optional(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    psk: z.string().optional(),
  });
  const body = schema.parse(req.body);
  const pskHash = body.psk ? crypto.createHash("sha256").update(body.psk).digest("hex") : null;
  const [node] = await db
    .insert(honeypotNodesTable)
    .values({
      name: body.name,
      host: body.host,
      port: body.port,
      protocol: body.protocol,
      location: body.location ?? null,
      country: body.country ?? null,
      lat: body.lat ?? null,
      lon: body.lon ?? null,
      pskHash,
    })
    .returning();
  const _actorHp = getAuth(req as any).userId ?? "system";
  appendAuditEvent({ actor: _actorHp, action: "honeypot_node.create", resource: `honeypot_node:${node.id}`, metadata: { name: node.name, host: node.host } });
  void shipSecurityEvent({ actor: _actorHp, action: "honeypot_node.create", resource: `honeypot_node:${node.id}`, result: "allow", metadata: { name: node.name } });
  res.status(201).json(node);
});

router.patch("/nodes/:id", requireRbac("honeypot_admin"), async (req, res) => {
  const id = Number(req.params.id);
  const schema = z.object({
    name: z.string().optional(),
    status: z.enum(["active", "inactive", "maintenance"]).optional(),
    location: z.string().optional(),
  });
  const body = schema.parse(req.body);
  const [node] = await db
    .update(honeypotNodesTable)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(honeypotNodesTable.id, id))
    .returning();
  if (!node) return res.status(404).json({ error: "Not found" });
  res.json(node);
});

router.delete("/nodes/:id", requireRbac("honeypot_admin"), async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(honeypotNodesTable).where(eq(honeypotNodesTable.id, id));
  res.status(204).end();
});

// ── Attackers ─────────────────────────────────────────────────────────────────
router.get("/attackers", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const [{ total }] = await db.select({ total: count() }).from(honeypotAttackersTable);
  const attackers = await db
    .select()
    .from(honeypotAttackersTable)
    .orderBy(desc(honeypotAttackersTable.lastSeenAt))
    .limit(limit)
    .offset(offset);
  res.json({ attackers, total: Number(total) });
});

router.get("/attackers/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [attacker] = await db.select().from(honeypotAttackersTable).where(eq(honeypotAttackersTable.id, id));
  if (!attacker) return res.status(404).json({ error: "Not found" });
  res.json(attacker);
});

// ── Sessions ──────────────────────────────────────────────────────────────────
router.get("/sessions", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const attackerId = req.query.attackerId ? Number(req.query.attackerId) : undefined;
  const nodeId = req.query.nodeId ? Number(req.query.nodeId) : undefined;

  const conditions = [];
  if (attackerId) conditions.push(eq(honeypotSessionsTable.attackerId, attackerId));
  if (nodeId) conditions.push(eq(honeypotSessionsTable.nodeId, nodeId));
  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: count() })
    .from(honeypotSessionsTable)
    .where(whereClause);

  const rows = await db
    .select()
    .from(honeypotSessionsTable)
    .leftJoin(honeypotAttackersTable, eq(honeypotSessionsTable.attackerId, honeypotAttackersTable.id))
    .leftJoin(honeypotNodesTable, eq(honeypotSessionsTable.nodeId, honeypotNodesTable.id))
    .where(whereClause)
    .orderBy(desc(honeypotSessionsTable.startedAt))
    .limit(limit)
    .offset(offset);

  const sessions = rows.map((r) => ({
    ...r.honeypot_sessions,
    attacker: r.honeypot_attackers ?? undefined,
    node: r.honeypot_nodes ?? undefined,
  }));

  res.json({ sessions, total: Number(total) });
});

router.get("/sessions/:id", async (req, res) => {
  const id = Number(req.params.id);
  const [row] = await db
    .select()
    .from(honeypotSessionsTable)
    .leftJoin(honeypotAttackersTable, eq(honeypotSessionsTable.attackerId, honeypotAttackersTable.id))
    .leftJoin(honeypotNodesTable, eq(honeypotSessionsTable.nodeId, honeypotNodesTable.id))
    .where(eq(honeypotSessionsTable.id, id));
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({
    ...row.honeypot_sessions,
    attacker: row.honeypot_attackers ?? undefined,
    node: row.honeypot_nodes ?? undefined,
  });
});

// ── Commands ──────────────────────────────────────────────────────────────────
router.get("/commands", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 100), 500);
  const offset = Number(req.query.offset ?? 0);
  const sessionId = req.query.sessionId ? Number(req.query.sessionId) : undefined;

  const whereClause = sessionId ? eq(honeypotCommandsTable.sessionId, sessionId) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(honeypotCommandsTable).where(whereClause);
  const commands = await db
    .select()
    .from(honeypotCommandsTable)
    .where(whereClause)
    .orderBy(desc(honeypotCommandsTable.capturedAt))
    .limit(limit)
    .offset(offset);

  res.json({ commands, total: Number(total) });
});

// ── Files ─────────────────────────────────────────────────────────────────────
router.get("/files", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const offset = Number(req.query.offset ?? 0);
  const [{ total }] = await db.select({ total: count() }).from(honeypotFilesTable);
  const files = await db
    .select()
    .from(honeypotFilesTable)
    .orderBy(desc(honeypotFilesTable.capturedAt))
    .limit(limit)
    .offset(offset);
  res.json({ files, total: Number(total) });
});

// ── IOCs ──────────────────────────────────────────────────────────────────────
router.get("/iocs", async (req, res) => {
  const type = req.query.type as string | undefined;
  const whereClause = type ? eq(honeypotIocsTable.type, type) : undefined;
  const iocs = await db.select().from(honeypotIocsTable).where(whereClause).orderBy(desc(honeypotIocsTable.lastSeenAt));
  res.json(iocs);
});

router.post("/iocs", requireRbac("honeypot_admin"), async (req, res) => {
  const schema = z.object({
    type: z.string().min(1),
    value: z.string().min(1),
    description: z.string().optional(),
    confidence: z.number().int().min(0).max(100).default(80),
    tags: z.array(z.string()).default([]),
  });
  const body = schema.parse(req.body);
  const [ioc] = await db.insert(honeypotIocsTable).values({ ...body, tags: body.tags }).returning();
  res.status(201).json(ioc);
});

router.delete("/iocs/:id", requireRbac("honeypot_admin"), async (req, res) => {
  const id = Number(req.params.id);
  await db.delete(honeypotIocsTable).where(eq(honeypotIocsTable.id, id));
  res.status(204).end();
});

// ── Alerts ────────────────────────────────────────────────────────────────────
router.get("/alerts", async (req, res) => {
  const acknowledged = req.query.acknowledged === "true" ? true : req.query.acknowledged === "false" ? false : undefined;
  const whereClause = acknowledged !== undefined ? eq(honeypotAlertsTable.acknowledged, acknowledged) : undefined;
  const alerts = await db
    .select()
    .from(honeypotAlertsTable)
    .where(whereClause)
    .orderBy(desc(honeypotAlertsTable.createdAt));
  res.json(alerts);
});

router.post("/alerts/:id/acknowledge", requireRbac("honeypot_admin"), async (req, res) => {
  const id = Number(req.params.id);
  const { userId } = getAuth(req);
  const [alert] = await db
    .update(honeypotAlertsTable)
    .set({ acknowledged: true, acknowledgedAt: new Date(), acknowledgedBy: userId ?? "system" })
    .where(eq(honeypotAlertsTable.id, id))
    .returning();
  if (!alert) return res.status(404).json({ error: "Not found" });
  res.json(alert);
});

// ── Ingest (called by relay agents on honeypot nodes) ─────────────────────────
// PSK-authenticated — no Clerk session required (handled by PSK header check)
router.post("/ingest", async (req, res) => {
  const schema = z.object({
    events: z.array(
      z.object({
        source: z.string(),
        nodeName: z.string(),
        eventType: z.string(),
        protocol: z.string().default("ssh"),
        timestamp: z.string().optional(),
        srcIp: z.string(),
        srcPort: z.number().optional(),
        destPort: z.number().optional(),
        username: z.string().optional(),
        password: z.string().optional(),
        sessionId: z.string().optional(),
        command: z.string().optional(),
        fileUrl: z.string().optional(),
        fileSha256: z.string().optional(),
        filename: z.string().optional(),
        clientVersion: z.string().optional(),
        duration: z.number().optional(),
        success: z.boolean().optional(),
        alertSignature: z.string().optional(),
        alertCategory: z.string().optional(),
        alertSeverity: z.number().optional(),
        mitreTechnique: z.string().optional(),
        raw: z.record(z.unknown()).optional(),
      })
    ),
  });

  const { events } = schema.parse(req.body);
  let accepted = 0;

  for (const ev of events) {
    try {
      // Find or get the node
      let [node] = await db
        .select({ id: honeypotNodesTable.id })
        .from(honeypotNodesTable)
        .where(eq(honeypotNodesTable.name, ev.nodeName));

      if (!node) {
        const [n] = await db
          .insert(honeypotNodesTable)
          .values({ name: ev.nodeName, host: ev.srcIp, protocol: ev.protocol })
          .onConflictDoNothing()
          .returning({ id: honeypotNodesTable.id });
        node = n;
      }

      if (node) {
        await db
          .update(honeypotNodesTable)
          .set({ lastSeenAt: new Date(), updatedAt: new Date() })
          .where(eq(honeypotNodesTable.id, node.id));
      }

      // Upsert attacker
      if (ev.srcIp) {
        await db
          .insert(honeypotAttackersTable)
          .values({ ipAddress: ev.srcIp })
          .onConflictDoNothing();

        // Update last seen
        await db
          .update(honeypotAttackersTable)
          .set({ lastSeenAt: new Date() })
          .where(eq(honeypotAttackersTable.ipAddress, ev.srcIp));

        // Add username/password to attacker arrays
        if (ev.username || ev.password) {
          const [attacker] = await db
            .select()
            .from(honeypotAttackersTable)
            .where(eq(honeypotAttackersTable.ipAddress, ev.srcIp));

          if (attacker) {
            const usernames = Array.from(new Set([...(attacker.usernames ?? []), ...(ev.username ? [ev.username] : [])]));
            const passwords = Array.from(new Set([...(attacker.passwords ?? []), ...(ev.password ? [ev.password] : [])]));
            await db
              .update(honeypotAttackersTable)
              .set({ usernames, passwords })
              .where(eq(honeypotAttackersTable.id, attacker.id));

            // Create IOC for the IP
            await db
              .insert(honeypotIocsTable)
              .values({
                type: "ip",
                value: ev.srcIp,
                description: `Honeypot attacker from ${ev.source}`,
                source: "honeypot-ingest",
                confidence: 90,
                attackerId: attacker.id,
              })
              .onConflictDoNothing();
          }
        }

        // Handle session_start
        if (ev.eventType === "session_start" || ev.eventType === "login_attempt") {
          const [attacker] = await db
            .select({ id: honeypotAttackersTable.id })
            .from(honeypotAttackersTable)
            .where(eq(honeypotAttackersTable.ipAddress, ev.srcIp));

          if (attacker && node) {
            await db.insert(honeypotSessionsTable).values({
              nodeId: node.id,
              attackerId: attacker.id,
              protocol: ev.protocol,
              srcPort: ev.srcPort ?? null,
              destPort: ev.destPort ?? 22,
              username: ev.username ?? null,
              password: ev.password ?? null,
              clientVersion: ev.clientVersion ?? null,
              outcome: ev.eventType === "login_attempt" && ev.success === false ? "login_failed" : "captured",
            });

            // Increment counters
            await db.execute(sql`
              UPDATE honeypot_nodes SET total_sessions = total_sessions + 1 WHERE id = ${node.id};
              UPDATE honeypot_attackers SET session_count = session_count + 1 WHERE id = ${attacker.id};
            `);
          }
        }

        // Handle commands
        if (ev.eventType === "command" && ev.command) {
          const MALICIOUS_PATTERNS = [
            /curl|wget|python|perl|bash|sh |chmod|base64|\/tmp\/|nc |netcat|masscan|nmap|iptables/,
            /\/etc\/passwd|\/etc\/shadow|\.ssh\/|authorized_keys|known_hosts/,
            /botnet|miner|cryptominer|c2|cnc|backdoor|rootkit/i,
          ];
          const isMalicious = MALICIOUS_PATTERNS.some((p) => p.test(ev.command!));

          const [attacker] = await db
            .select({ id: honeypotAttackersTable.id })
            .from(honeypotAttackersTable)
            .where(eq(honeypotAttackersTable.ipAddress, ev.srcIp));

          await db.insert(honeypotCommandsTable).values({
            attackerId: attacker?.id ?? null,
            command: ev.command,
            isMalicious,
            mitreTechnique: ev.mitreTechnique ?? null,
            capturedAt: ev.timestamp ? new Date(ev.timestamp) : new Date(),
          });

          if (attacker) {
            await db.execute(sql`
              UPDATE honeypot_attackers SET command_count = command_count + 1 WHERE id = ${attacker.id}
            `);
          }

          // Auto-generate alert for malicious commands
          if (isMalicious && attacker) {
            await db.insert(honeypotAlertsTable).values({
              nodeId: node?.id ?? null,
              attackerId: attacker.id,
              severity: "high",
              alertType: "malicious_command",
              title: `Malicious command detected from ${ev.srcIp}`,
              description: `Command: ${ev.command.substring(0, 200)}`,
            });
          }
        }

        // Handle file downloads
        if (ev.eventType === "file_download" && ev.filename) {
          const [attacker] = await db
            .select({ id: honeypotAttackersTable.id })
            .from(honeypotAttackersTable)
            .where(eq(honeypotAttackersTable.ipAddress, ev.srcIp));

          await db.insert(honeypotFilesTable).values({
            attackerId: attacker?.id ?? null,
            filename: ev.filename,
            url: ev.fileUrl ?? null,
            sha256: ev.fileSha256 ?? null,
            isMalware: true,
            capturedAt: ev.timestamp ? new Date(ev.timestamp) : new Date(),
          });

          if (ev.fileSha256) {
            await db
              .insert(honeypotIocsTable)
              .values({
                type: "sha256",
                value: ev.fileSha256,
                description: `Malware payload: ${ev.filename}`,
                source: "honeypot-ingest",
                confidence: 95,
                attackerId: attacker?.id ?? null,
              })
              .onConflictDoNothing();
          }
        }

        // Handle IDS alerts
        if (ev.eventType === "ids_alert" && ev.alertSignature) {
          const severity = ev.alertSeverity === 1 ? "critical" : ev.alertSeverity === 2 ? "high" : ev.alertSeverity === 3 ? "medium" : "low";
          const [attacker] = await db
            .select({ id: honeypotAttackersTable.id })
            .from(honeypotAttackersTable)
            .where(eq(honeypotAttackersTable.ipAddress, ev.srcIp));

          await db.insert(honeypotAlertsTable).values({
            nodeId: node?.id ?? null,
            attackerId: attacker?.id ?? null,
            severity,
            alertType: "ids_alert",
            title: ev.alertSignature,
            description: `Category: ${ev.alertCategory ?? "unknown"} | MITRE: ${ev.mitreTechnique ?? "unknown"}`,
            metadata: { signature: ev.alertSignature, category: ev.alertCategory, severity: ev.alertSeverity },
          });
        }
      }

      accepted++;
    } catch {
      // Non-fatal per event
    }
  }

  res.json({ accepted });
});

export default router;
