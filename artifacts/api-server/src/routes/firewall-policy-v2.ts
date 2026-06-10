import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { compileFirewallPolicy, findRuleConflicts, type FirewallPolicyRule } from "../lib/firewall-policy-engine";
import { simulateFirewallPolicy, DEFAULT_TRAFFIC_SAMPLES } from "../lib/firewall-simulator";
import { governCommand } from "../lib/command-governance-core";
import { appendAuditEvent } from "../lib/audit-chain";

const router = Router();

const RuleSchema = z.object({
  id:          z.string().min(1).max(80),
  priority:    z.number().int().min(0).max(9999),
  action:      z.enum(["allow", "deny"]),
  direction:   z.enum(["inbound", "outbound"]),
  protocol:    z.enum(["tcp", "udp", "icmp", "any"]),
  source:      z.string().optional(),
  destination: z.string().optional(),
  port:        z.union([z.number(), z.string()]).optional(),
  description: z.string().optional(),
});

// POST /api/firewall-v2/simulate  — compile + simulate without deploying
router.post("/simulate", async (req: Request, res: Response) => {
  const body = z.object({
    rules:   z.array(RuleSchema),
    samples: z.array(z.any()).optional(),
  }).parse(req.body ?? {});

  const rules     = body.rules as FirewallPolicyRule[];
  const samples   = body.samples ?? DEFAULT_TRAFFIC_SAMPLES;
  const conflicts = findRuleConflicts(rules);
  const compiled  = compileFirewallPolicy(rules);
  const simulation = simulateFirewallPolicy(rules, samples as any);

  res.json({ conflicts, warnings: compiled.warnings, simulation, compiledPreview: compiled });
});

// POST /api/firewall-v2/deploy  — run governance check then compile
router.post("/deploy", async (req: Request, res: Response) => {
  const actorId = (req as any).auth?.userId ?? "unknown";
  const body = z.object({
    rules:   z.array(RuleSchema),
    samples: z.array(z.any()).optional(),
    reason:  z.string().max(500).optional(),
  }).parse(req.body ?? {});

  const rules     = body.rules as FirewallPolicyRule[];
  const samples   = body.samples ?? DEFAULT_TRAFFIC_SAMPLES;
  const conflicts = findRuleConflicts(rules);
  if (conflicts.length) return res.status(409).json({ error: "Policy conflicts detected", conflicts });

  const simulation = simulateFirewallPolicy(rules, samples as any);
  const risk = simulation.riskScore >= 50 ? "critical" : "high";
  const gov  = await governCommand({
    actorId,
    action: "firewall.deploy",
    target: "global-policy",
    risk,
    reason: body.reason,
    metadata: { riskScore: simulation.riskScore, criticalBlocked: simulation.criticalBlocked.length },
  });

  if (gov.decision !== "allow") {
    return res.status(202).json({ status: gov.decision, commandId: gov.id, simulation });
  }

  const compiled = compileFirewallPolicy(rules);

  // Persist versioned policy
  await db.execute(sql`
    UPDATE firewall_policy_versions SET active = false WHERE active = true
  `);
  const versionRow = await db.execute(sql`
    INSERT INTO firewall_policy_versions (version, policy, compiled, simulation, deployed_by)
    VALUES (
      (SELECT COALESCE(MAX(version), 0) + 1 FROM firewall_policy_versions),
      ${JSON.stringify(rules)}::jsonb,
      ${JSON.stringify(compiled)}::jsonb,
      ${JSON.stringify(simulation)}::jsonb,
      ${actorId}
    )
    RETURNING id, version
  `);

  appendAuditEvent({ actor: actorId, action: "firewall_policy_deployed", resource: "firewall_policy_versions", result: "allow", metadata: { commandId: gov.id, version: (versionRow?.rows?.[0] as any)?.version, riskScore: simulation.riskScore } });

  res.json({ status: "deployed", commandId: gov.id, compiled, version: (versionRow?.rows?.[0] as any)?.version });
});

// GET /api/firewall-v2/versions  — history of deployed policies
router.get("/versions", async (_req: Request, res: Response) => {
  const rows = await db.execute(sql`
    SELECT id, version, deployed_by, deployed_at, active
    FROM firewall_policy_versions ORDER BY version DESC LIMIT 20
  `);
  res.json({ versions: rows?.rows ?? [] });
});

// POST /api/firewall-v2/rollback/:versionId
router.post("/rollback/:versionId", async (req: Request, res: Response) => {
  const actorId = (req as any).auth?.userId ?? "unknown";
  const { versionId } = req.params;
  const gov = await governCommand({
    actorId, action: "firewall.rollback", target: String(versionId), risk: "high",
    reason: "admin-initiated rollback",
  });
  if (gov.decision !== "allow") {
    return res.status(202).json({ status: gov.decision, commandId: gov.id });
  }
  await db.execute(sql`UPDATE firewall_policy_versions SET active = false WHERE active = true`);
  await db.execute(sql`UPDATE firewall_policy_versions SET active = true  WHERE id = ${versionId}`);
  appendAuditEvent({ actor: actorId, action: "firewall_policy_rolled_back", resource: `firewall_policy_versions:${String(versionId)}`, result: "allow", metadata: { commandId: gov.id } });
  res.json({ ok: true, versionId, commandId: gov.id });
});

export default router;
