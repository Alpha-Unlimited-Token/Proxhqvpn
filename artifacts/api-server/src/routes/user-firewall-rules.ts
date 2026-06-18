// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Per-user persistent firewall rules — full CRUD + nftables sync.
//
// Every rule is stored in Postgres so it survives:
//   • Server reboots
//   • User logoff / VPN disconnect
//   • API server restarts
//   • nftables flushes
//
// On every change (create/update/delete/toggle) the nftables-sync lib
// is called to atomically reload just the user-rules nft table.

import { Router, type Request, type Response } from "express";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import { db, userFirewallRulesTable, devicesTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireRbac } from "../middlewares/requireRbac";
import { appendAuditEvent } from "../lib/audit-chain";
import { syncUserFirewallRules } from "../lib/nftables-sync";

const router = Router();

function uid(req: Request): string {
  return (getAuth(req) as any).userId ?? "";
}

// ── Validation schemas ────────────────────────────────────────────────────────

const CreateRuleSchema = z.object({
  label:        z.string().min(1).max(100),
  protocol:     z.enum(["tcp", "udp", "both"]).default("tcp"),
  direction:    z.enum(["inbound", "outbound", "both"]).default("inbound"),
  action:       z.enum(["allow", "block"]).default("allow"),
  externalPort: z.number().int().min(1).max(65535),
  internalPort: z.number().int().min(1).max(65535).optional(),
  sourceIp:     z.string().max(50).optional(),
  tunnelIp:     z.string().max(50).optional(),
  notes:        z.string().max(500).optional(),
  enabled:      z.boolean().default(true),
});

const UpdateRuleSchema = CreateRuleSchema.partial().extend({
  enabled: z.boolean().optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Resolve the user's first active device tunnel IP if not supplied */
async function resolveTunnelIp(userId: string, supplied?: string | null): Promise<string | null> {
  if (supplied) return supplied;
  const [dev] = await db
    .select({ assignedIp: devicesTable.assignedIp })
    .from(devicesTable)
    .where(and(eq(devicesTable.userId, userId), eq(devicesTable.status, "active")))
    .orderBy(devicesTable.createdAt)
    .limit(1);
  return dev?.assignedIp ?? null;
}

// ── GET /api/firewall/user-rules ──────────────────────────────────────────────
// Returns all of the calling user's persistent firewall rules.
router.get("/", async (req: Request, res: Response) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const rules = await db
    .select()
    .from(userFirewallRulesTable)
    .where(eq(userFirewallRulesTable.userId, userId))
    .orderBy(desc(userFirewallRulesTable.createdAt));

  return res.json({ rules, total: rules.length });
});

// ── GET /api/firewall/user-rules/all — admin: all users' rules ────────────────
router.get("/all", requireRbac("admin:write"), async (req: Request, res: Response) => {
  const rules = await db
    .select()
    .from(userFirewallRulesTable)
    .orderBy(desc(userFirewallRulesTable.createdAt));
  return res.json({ rules, total: rules.length });
});

// ── GET /api/firewall/user-rules/activity — blocked inbound attempts ──────────
// Returns a feed of recent blocked/matched events for the user's rules.
// In production this would parse the nftables log (journald "PROXHQ_DROP:" prefix).
// Here we return the per-rule hit counts and last-hit timestamps from DB.
router.get("/activity", async (req: Request, res: Response) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const rules = await db
    .select({
      id:           userFirewallRulesTable.id,
      label:        userFirewallRulesTable.label,
      protocol:     userFirewallRulesTable.protocol,
      direction:    userFirewallRulesTable.direction,
      action:       userFirewallRulesTable.action,
      externalPort: userFirewallRulesTable.externalPort,
      tunnelIp:     userFirewallRulesTable.tunnelIp,
      hitCount:     userFirewallRulesTable.hitCount,
      lastHitAt:    userFirewallRulesTable.lastHitAt,
      enabled:      userFirewallRulesTable.enabled,
    })
    .from(userFirewallRulesTable)
    .where(and(
      eq(userFirewallRulesTable.userId, userId),
      sql`${userFirewallRulesTable.hitCount} > 0`,
    ))
    .orderBy(desc(userFirewallRulesTable.lastHitAt));

  return res.json({ activity: rules });
});

// ── POST /api/firewall/user-rules — create a persistent rule ─────────────────
router.post("/", async (req: Request, res: Response) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = CreateRuleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const d = parsed.data;

  // Auto-resolve tunnel IP from the user's device if not supplied
  const tunnelIp = await resolveTunnelIp(userId, d.tunnelIp);

  const [rule] = await db
    .insert(userFirewallRulesTable)
    .values({
      userId,
      label:        d.label,
      protocol:     d.protocol,
      direction:    d.direction,
      action:       d.action,
      externalPort: d.externalPort,
      internalPort: d.internalPort,
      sourceIp:     d.sourceIp,
      tunnelIp:     tunnelIp ?? undefined,
      notes:        d.notes,
      enabled:      d.enabled,
      synced:       false,
    })
    .returning();

  appendAuditEvent({
    actor:    userId,
    action:   "firewall.rule_create",
    resource: `user_firewall_rule:${rule!.id}`,
    metadata: { label: d.label, port: d.externalPort, action: d.action },
  });

  // Sync to nftables immediately — rule takes effect right now
  const syncResult = await syncUserFirewallRules();

  return res.status(201).json({ ok: true, rule, sync: syncResult });
});

// ── PATCH /api/firewall/user-rules/:id — update or toggle a rule ─────────────
router.patch("/:id", async (req: Request, res: Response) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const ruleId = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(ruleId)) return res.status(400).json({ error: "Invalid rule ID" });

  // Verify ownership
  const [existing] = await db
    .select()
    .from(userFirewallRulesTable)
    .where(and(eq(userFirewallRulesTable.id, ruleId), eq(userFirewallRulesTable.userId, userId)))
    .limit(1);

  if (!existing) return res.status(404).json({ error: "Rule not found" });

  const parsed = UpdateRuleSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const d = parsed.data;
  const tunnelIp = d.tunnelIp !== undefined
    ? (d.tunnelIp ?? existing.tunnelIp)
    : existing.tunnelIp;

  const [updated] = await db
    .update(userFirewallRulesTable)
    .set({
      ...d,
      tunnelIp,
      synced:    false,
      updatedAt: new Date(),
    })
    .where(eq(userFirewallRulesTable.id, ruleId))
    .returning();

  appendAuditEvent({
    actor:    userId,
    action:   "firewall.rule_update",
    resource: `user_firewall_rule:${ruleId}`,
    metadata: d,
  });

  const syncResult = await syncUserFirewallRules();
  return res.json({ ok: true, rule: updated, sync: syncResult });
});

// ── DELETE /api/firewall/user-rules/:id — permanently remove a rule ───────────
router.delete("/:id", async (req: Request, res: Response) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const ruleId = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(ruleId)) return res.status(400).json({ error: "Invalid rule ID" });

  const [existing] = await db
    .select({ id: userFirewallRulesTable.id, label: userFirewallRulesTable.label })
    .from(userFirewallRulesTable)
    .where(and(eq(userFirewallRulesTable.id, ruleId), eq(userFirewallRulesTable.userId, userId)))
    .limit(1);

  if (!existing) return res.status(404).json({ error: "Rule not found" });

  await db
    .delete(userFirewallRulesTable)
    .where(eq(userFirewallRulesTable.id, ruleId));

  appendAuditEvent({
    actor:    userId,
    action:   "firewall.rule_delete",
    resource: `user_firewall_rule:${ruleId}`,
    metadata: { label: existing.label },
  });

  const syncResult = await syncUserFirewallRules();
  return res.json({ ok: true, deletedId: ruleId, sync: syncResult });
});

// ── POST /api/firewall/user-rules/:id/toggle — flip enabled on/off ─────────────
router.post("/:id/toggle", async (req: Request, res: Response) => {
  const userId = uid(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const ruleId = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(ruleId)) return res.status(400).json({ error: "Invalid rule ID" });

  const [existing] = await db
    .select()
    .from(userFirewallRulesTable)
    .where(and(eq(userFirewallRulesTable.id, ruleId), eq(userFirewallRulesTable.userId, userId)))
    .limit(1);

  if (!existing) return res.status(404).json({ error: "Rule not found" });

  const newEnabled = !existing.enabled;
  const [updated] = await db
    .update(userFirewallRulesTable)
    .set({ enabled: newEnabled, synced: false, updatedAt: new Date() })
    .where(eq(userFirewallRulesTable.id, ruleId))
    .returning();

  appendAuditEvent({
    actor:    userId,
    action:   newEnabled ? "firewall.rule_enable" : "firewall.rule_disable",
    resource: `user_firewall_rule:${ruleId}`,
    metadata: { label: existing.label },
  });

  const syncResult = await syncUserFirewallRules();
  return res.json({ ok: true, rule: updated, sync: syncResult });
});

// ── POST /api/firewall/user-rules/sync — force full nftables rebuild ──────────
// Called by admins or the boot systemd service. Rebuilds nftables from DB.
router.post("/sync", requireRbac("admin:write"), async (req: Request, res: Response) => {
  const result = await syncUserFirewallRules();
  appendAuditEvent({
    actor:    uid(req),
    action:   "firewall.nftables_sync",
    resource: "nftables:user_rules",
    metadata: result,
  });
  return res.json(result);
});

// ── POST /api/firewall/user-rules/:id/hit — record a rule match (internal) ────
// Called by the log-parser worker when it sees a matching entry in journald.
router.post("/:id/hit", requireRbac("admin:write"), async (req: Request, res: Response) => {
  const ruleId = parseInt(String(req.params["id"] ?? ""), 10);
  if (isNaN(ruleId)) return res.status(400).json({ error: "Invalid rule ID" });

  await db
    .update(userFirewallRulesTable)
    .set({
      hitCount:  sql`${userFirewallRulesTable.hitCount} + 1`,
      lastHitAt: new Date(),
    })
    .where(eq(userFirewallRulesTable.id, ruleId));

  return res.json({ ok: true });
});

export default router;
