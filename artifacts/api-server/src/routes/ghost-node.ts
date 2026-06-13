// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Node — decoy VPN infrastructure management.
// All write/admin routes require ghost_node_admin RBAC action.
// Ghost Trap Rules CRUD included here.
import { Router } from "express";
import { db } from "@workspace/db";
import {
  ghostNodesTable, ghostNodeEventsTable, ghostNodeRoutesTable,
  ghostTrapRulesTable, vultrNodeDeceptionStateTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod";
import { appendAuditEvent } from "../lib/audit-chain";
import { shipSecurityEvent } from "../lib/siem";
import { requireRbac } from "../middlewares/requireRbac";
import { listInstances, regionLabel } from "../lib/vultr-client";
import { getAuth } from "@clerk/express";

const router = Router();

// ── P6-C: Per-IP lure rate limiter ───────────────────────────────────────────
// Prevents a single attacker IP from flooding ghost node event ingestion.
// Defaults: 30 events / IP / 60s. Override via GHOST_EVENT_IP_RATE env var.
const IP_EVENT_MAX    = parseInt(process.env.GHOST_EVENT_IP_RATE ?? "30", 10);
const IP_EVENT_WIN_MS = 60_000;
const ipEventBucket   = new Map<string, { count: number; windowStart: number }>();

function checkIpEventRate(ip: string): boolean {
  const now = Date.now();
  const entry = ipEventBucket.get(ip);
  if (!entry || now - entry.windowStart > IP_EVENT_WIN_MS) {
    ipEventBucket.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= IP_EVENT_MAX) return false;
  entry.count++;
  return true;
}

// Prune stale bucket entries every 5 minutes to avoid unbounded growth.
setInterval(() => {
  const cutoff = Date.now() - IP_EVENT_WIN_MS * 2;
  for (const [ip, entry] of ipEventBucket) {
    if (entry.windowStart < cutoff) ipEventBucket.delete(ip);
  }
}, 5 * 60_000).unref();

// ── List ghost nodes ─────────────────────────────────────────────────────────
router.get("/", requireRbac("ghost_node_admin"), async (req, res) => {
  const nodes = await db.select().from(ghostNodesTable).orderBy(desc(ghostNodesTable.createdAt));
  return res.json({ nodes });
});

// ── Get single ghost node ─────────────────────────────────────────────────────
router.get("/:id", requireRbac("ghost_node_admin"), async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [node] = await db.select().from(ghostNodesTable).where(eq(ghostNodesTable.id, id));
  if (!node) return res.status(404).json({ error: "Ghost node not found" });
  const events = await db.select().from(ghostNodeEventsTable)
    .where(eq(ghostNodeEventsTable.ghostNodeId, id))
    .orderBy(desc(ghostNodeEventsTable.createdAt))
    .limit(50);
  return res.json({ node, events });
});

// ── Create ghost node ─────────────────────────────────────────────────────────
const CreateSchema = z.object({
  name:           z.string().min(1).max(80),
  region:         z.string().min(1).max(30),
  publicIp:       z.string().ip(),
  decoyIp:        z.string().ip().optional(),
  listenPort:     z.number().int().min(1024).max(65535).optional(),
  decoyPublicKey: z.string().max(200).optional(),
  isolationLevel: z.enum(["full", "partial"]).optional(),
  notes:          z.string().max(1000).optional(),
});

router.post("/", requireRbac("ghost_node_admin"), async (req, res) => {
  const { userId } = getAuth(req);
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const d = parsed.data;

  const [node] = await db.insert(ghostNodesTable).values({
    name:           d.name,
    region:         d.region,
    publicIp:       d.publicIp,
    decoyIp:        d.decoyIp,
    listenPort:     d.listenPort ?? 51820,
    decoyPublicKey: d.decoyPublicKey,
    isolationLevel: d.isolationLevel ?? "full",
    notes:          d.notes,
    status:         "active",
    enabledAt:      new Date(),
    createdBy:      userId ?? "unknown",
  }).returning();

  appendAuditEvent({
    actor:    userId ?? "system",
    action:   "ghost_node.create",
    resource: `ghost_node:${node.id}`,
    metadata: { name: d.name, region: d.region, publicIp: d.publicIp },
  });
  void shipSecurityEvent({ actor: userId ?? "system", action: "ghost_node.create", resource: `ghost_node:${node.id}`, result: "allow", metadata: { name: d.name, region: d.region } });

  return res.status(201).json({ ok: true, node });
});

// ── Update ghost node ─────────────────────────────────────────────────────────
const PatchSchema = z.object({
  name:           z.string().min(1).max(80).optional(),
  decoyIp:        z.string().ip().optional(),
  listenPort:     z.number().int().min(1024).max(65535).optional(),
  decoyPublicKey: z.string().max(200).optional(),
  isolationLevel: z.enum(["full", "partial"]).optional(),
  notes:          z.string().max(1000).optional(),
  status:         z.enum(["active", "quarantined", "disabled"]).optional(),
});

router.patch("/:id", requireRbac("ghost_node_admin"), async (req, res) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const parsed = PatchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const updates: Record<string, unknown> = { ...parsed.data, updatedAt: new Date() };
  if (parsed.data.status === "quarantined") updates.quarantinedAt = new Date();
  if (parsed.data.status === "disabled")   updates.disabledAt = new Date();
  if (parsed.data.status === "active")     updates.enabledAt = new Date();

  const [node] = await db.update(ghostNodesTable).set(updates).where(eq(ghostNodesTable.id, id)).returning();
  if (!node) return res.status(404).json({ error: "Ghost node not found" });

  appendAuditEvent({ actor: userId ?? "system", action: "ghost_node.update", resource: `ghost_node:${id}`, metadata: parsed.data });
  return res.json({ ok: true, node });
});

// ── Delete ghost node ─────────────────────────────────────────────────────────
router.delete("/:id", requireRbac("ghost_node_admin"), async (req, res) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db.delete(ghostNodesTable).where(eq(ghostNodesTable.id, id));
  appendAuditEvent({ actor: userId ?? "system", action: "ghost_node.delete", resource: `ghost_node:${id}`, metadata: {} });
  return res.json({ ok: true });
});

// ── Quarantine a ghost node (shortcut) ───────────────────────────────────────
router.post("/:id/quarantine", requireRbac("ghost_node_admin"), async (req, res) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [node] = await db.update(ghostNodesTable).set({
    status: "quarantined", quarantinedAt: new Date(), updatedAt: new Date(),
  }).where(eq(ghostNodesTable.id, id)).returning();
  if (!node) return res.status(404).json({ error: "Ghost node not found" });
  appendAuditEvent({ actor: userId ?? "system", action: "ghost_node.quarantine", resource: `ghost_node:${id}`, metadata: {} });
  void shipSecurityEvent({ actor: userId ?? "system", action: "ghost_node.quarantine", resource: `ghost_node:${id}`, result: "allow", severity: "medium", metadata: { name: node.name } });
  return res.json({ ok: true, node });
});

// ── Ingest event for a ghost node (daemon callback) ───────────────────────────
// PSK bypass: this is called by node daemons, not browser clients.
// Auth: same PSK pattern as daemon-inbound (verified in the calling middleware layer).
router.post("/:id/event", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { eventType = "probe", sourceIp, sourcePort, rawPayload, geoCountry, geoCity, geoAsn, severity = "info" } = req.body as Record<string, unknown>;
  if (!sourceIp || typeof sourceIp !== "string") return res.status(400).json({ error: "sourceIp required" });

  // P6-C: Per-source-IP rate limiting — drop floods from a single attacker.
  if (!checkIpEventRate(sourceIp)) {
    return res.status(429).json({ error: "Event rate limit exceeded for this source IP" });
  }

  const [event] = await db.insert(ghostNodeEventsTable).values({
    ghostNodeId: id,
    eventType: String(eventType),
    sourceIp: String(sourceIp),
    sourcePort: typeof sourcePort === "number" ? sourcePort : undefined,
    rawPayload: rawPayload ? String(rawPayload).substring(0, 2000) : undefined,
    geoCountry: geoCountry ? String(geoCountry) : undefined,
    geoCity: geoCity ? String(geoCity) : undefined,
    geoAsn: geoAsn ? String(geoAsn) : undefined,
    severity: String(severity),
  }).returning();

  return res.status(201).json({ ok: true, event });
});

// ── P6-B: Evidence export — full JSON bundle download ────────────────────────
router.get("/:id/evidence.json", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [node] = await db.select().from(ghostNodesTable).where(eq(ghostNodesTable.id, id));
  if (!node) return res.status(404).json({ error: "Ghost node not found" });

  const events = await db.select().from(ghostNodeEventsTable)
    .where(eq(ghostNodeEventsTable.ghostNodeId, id))
    .orderBy(desc(ghostNodeEventsTable.createdAt))
    .limit(5000);

  const routes = await db.select().from(ghostNodeRoutesTable)
    .where(eq(ghostNodeRoutesTable.ghostNodeId, id));

  const bundle = {
    exportedAt:  new Date().toISOString(),
    exportedBy:  "ProxhqVPN Ghost Node Evidence Export v1",
    node: {
      id:           node.id,
      name:         node.name,
      region:       node.region,
      publicIp:     node.publicIp,
      decoyIp:      node.decoyIp,
      listenPort:   node.listenPort,
      isolationLevel: node.isolationLevel,
      status:       node.status,
      createdAt:    node.createdAt,
    },
    routes,
    eventCount:  events.length,
    events,
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="ghost-node-${id}-evidence-${Date.now()}.json"`,
  );
  return res.json(bundle);
});

// ── List events for a ghost node ─────────────────────────────────────────────
router.get("/:id/events", async (req, res) => {
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const limit = Math.min(parseInt(String(req.query.limit ?? "100")), 500);
  const events = await db.select().from(ghostNodeEventsTable)
    .where(eq(ghostNodeEventsTable.ghostNodeId, id))
    .orderBy(desc(ghostNodeEventsTable.createdAt))
    .limit(limit);
  return res.json({ events });
});

// ── Ghost Trap Rules ──────────────────────────────────────────────────────────

router.get("/rules/list", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const rules = await db.select().from(ghostTrapRulesTable)
    .where(eq(ghostTrapRulesTable.userId, userId))
    .orderBy(desc(ghostTrapRulesTable.priority));
  return res.json({ rules });
});

const RuleSchema = z.object({
  ruleType:    z.enum(["path_pattern", "ua_pattern", "header_pattern", "ip_cidr"]),
  pattern:     z.string().min(1).max(500),
  action:      z.enum(["log", "tarpit", "block", "silk_trap"]).optional(),
  priority:    z.number().int().min(0).max(100).optional(),
  description: z.string().max(300).optional(),
});

router.post("/rules", requireRbac("ghost_node_admin"), async (req, res) => {
  const { userId } = getAuth(req);
  const parsed = RuleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const [rule] = await db.insert(ghostTrapRulesTable).values({
    userId: userId!,
    ruleType:    parsed.data.ruleType,
    pattern:     parsed.data.pattern,
    action:      parsed.data.action ?? "log",
    priority:    parsed.data.priority ?? 50,
    description: parsed.data.description,
  }).returning();
  return res.status(201).json({ ok: true, rule });
});

router.patch("/rules/:id", requireRbac("ghost_node_admin"), async (req, res) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const { enabled, action, priority, description } = req.body as Record<string, unknown>;
  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof enabled === "boolean") updates.enabled = enabled;
  if (action) updates.action = action;
  if (typeof priority === "number") updates.priority = priority;
  if (description) updates.description = description;
  const [rule] = await db.update(ghostTrapRulesTable)
    .set(updates)
    .where(and(eq(ghostTrapRulesTable.id, id), eq(ghostTrapRulesTable.userId, userId!)))
    .returning();
  if (!rule) return res.status(404).json({ error: "Rule not found" });
  return res.json({ ok: true, rule });
});

router.delete("/rules/:id", requireRbac("ghost_node_admin"), async (req, res) => {
  const { userId } = getAuth(req);
  const id = parseInt(req.params.id as string, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db.delete(ghostTrapRulesTable)
    .where(and(eq(ghostTrapRulesTable.id, id), eq(ghostTrapRulesTable.userId, userId!)));
  return res.json({ ok: true });
});

// ── Vultr sync ───────────────────────────────────────────────────────────────
router.get("/vultr/instances", requireRbac("nodes:vultr_sync"), async (_req, res) => {
  try {
    const instances = await listInstances();
    const enriched = instances.map(i => ({
      id:          i.id,
      label:       i.label || i.hostname,
      region:      i.region,
      regionLabel: regionLabel(i.region),
      ip:          i.main_ip,
      status:      i.status,
      powerStatus: i.power_status,
      plan:        i.plan,
      vcpus:       i.vcpu_count,
      ramMb:       i.ram,
      diskGb:      i.disk,
      dateCreated: i.date_created,
      tags:        i.tags,
    }));
    return res.json({ ok: true, count: enriched.length, instances: enriched });
  } catch (err: any) {
    return res.status(500).json({ error: err.message ?? "Vultr API error" });
  }
});

// ── P5-A: POST /vultr/sync — upsert Vultr instances into ghost_nodes ─────────
// Fetches live Vultr instance list and ensures each has a corresponding ghost
// node entry (deduped by publicIp). Tracks deception state in
// vultr_node_deception_state. Requires ghost_node_admin RBAC.
router.post("/vultr/sync", requireRbac("ghost_node_admin"), async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  let instances: Awaited<ReturnType<typeof listInstances>>;
  try {
    instances = await listInstances();
  } catch (err: any) {
    return res.status(502).json({ error: `Vultr API error: ${err.message ?? "unknown"}` });
  }

  const created: number[] = [];
  const updated: number[] = [];

  for (const i of instances) {
    const ip = i.main_ip;
    if (!ip || ip === "0.0.0.0") continue;

    const nodeName = i.label || i.hostname || `vultr-${i.region}-${i.id.slice(-6)}`;

    // Find existing ghost node by publicIp
    const [existing] = await db.select({ id: ghostNodesTable.id })
      .from(ghostNodesTable)
      .where(eq(ghostNodesTable.publicIp, ip))
      .limit(1);

    let ghostNodeId: number;
    if (existing) {
      await db.update(ghostNodesTable)
        .set({ name: nodeName, region: i.region, updatedAt: new Date() })
        .where(eq(ghostNodesTable.id, existing.id));
      ghostNodeId = existing.id;
      updated.push(ghostNodeId);
    } else {
      const [created_node] = await db.insert(ghostNodesTable).values({
        name:           nodeName,
        region:         i.region,
        publicIp:       ip,
        status:         i.status === "active" ? "active" : "disabled",
        isolationLevel: "full",
        createdBy:      userId,
      }).returning({ id: ghostNodesTable.id });
      ghostNodeId = created_node.id;
      created.push(ghostNodeId);
    }

    // Upsert deception state record
    const [stateExisting] = await db.select({ id: vultrNodeDeceptionStateTable.id })
      .from(vultrNodeDeceptionStateTable)
      .where(eq(vultrNodeDeceptionStateTable.vultrInstanceId, i.id))
      .limit(1);

    if (stateExisting) {
      await db.update(vultrNodeDeceptionStateTable)
        .set({ ghostNodeId, lastPolicyPush: new Date() })
        .where(eq(vultrNodeDeceptionStateTable.id, stateExisting.id));
    } else {
      await db.insert(vultrNodeDeceptionStateTable).values({
        vultrInstanceId: i.id,
        ghostNodeId,
        decoyEnabled: false,
      });
    }
  }

  appendAuditEvent({
    actor: userId,
    action: "ghost_nodes.vultr_sync",
    resource: "ghost_nodes",
    metadata: { total: instances.length, created: created.length, updated: updated.length },
  });

  return res.json({
    ok:      true,
    total:   instances.length,
    created: created.length,
    updated: updated.length,
  });
});

export default router;
