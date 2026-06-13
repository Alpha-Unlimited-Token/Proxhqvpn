// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Continuous Validation Framework — admin API routes.
// Admin only: requireCapability enforced by admin route group.
// All manual scan execution gets additional criticalRateLimit.
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { getAuth } from "@clerk/express";
import { highRiskRateLimit, criticalRateLimit } from "../middlewares/riskRateLimit";
import { appendAuditEvent } from "../lib/audit-chain";
import { shipSecurityEvent } from "../lib/siem";
import {
  createValidationTarget, listValidationTargets, getValidationTarget, updateValidationTarget,
} from "../services/validationTargetService";
import {
  createValidationRun, completeValidationRun, failValidationRun,
  listValidationRuns, getValidationRun, summarizeValidationRuns,
} from "../services/validationRunService";
import { listOpenValidationFindings, resolveValidationFinding } from "../services/validationFindingService";
import { generateScorecard } from "../services/validationScorecardService";
import { getRunner } from "../services/validationRunnerRegistry";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

// ── Targets ───────────────────────────────────────────────────────────────────

router.get("/targets", async (_req: Request, res: Response) => {
  const targets = await listValidationTargets();
  res.json({ targets });
});

router.post("/targets", async (req: Request, res: Response) => {
  const schema = z.object({
    name:                 z.string().min(1).max(200),
    target_type:          z.enum(["web","api","vpn_node","wireguard","container","repository","dns","tls","synthetic"]),
    url:                  z.string().url().optional(),
    host:                 z.string().optional(),
    port:                 z.number().int().min(1).max(65535).optional(),
    region:               z.string().optional(),
    environment:          z.string().optional(),
    owned_by:             z.string().optional(),
    allow_security_scans: z.boolean().optional(),
    allow_load_tests:     z.boolean().optional(),
    metadata:             z.record(z.unknown()).optional(),
  });
  const body = schema.parse(req.body);
  const target = await createValidationTarget(body as any);
  const { userId } = getAuth(req);
  appendAuditEvent({ actor: userId ?? "system", action: "validation_target.create", resource: `validation_target:${target.id}`, metadata: { name: target.name } });
  res.status(201).json(target);
});

// ── Runs ──────────────────────────────────────────────────────────────────────

router.get("/runs", async (req: Request, res: Response) => {
  const runs = await listValidationRuns({
    runType: req.query.run_type as string | undefined,
    status:  req.query.status  as string | undefined,
    limit:   req.query.limit   ? Number(req.query.limit) : undefined,
  });
  const summary = await summarizeValidationRuns();
  res.json({ runs, summary });
});

router.get("/runs/:id", async (req: Request, res: Response) => {
  const run = await getValidationRun(req.params.id);
  if (!run) return res.status(404).json({ error: "Not found" });
  res.json(run);
});

router.post("/runs", criticalRateLimit, async (req: Request, res: Response) => {
  const schema = z.object({
    targetId: z.string().uuid(),
    runType:  z.enum(["zap","trivy","semgrep","dependency","tls","headers","uptime","wireguard","node_health","k6","synthetic","custom"]),
  });
  const body     = schema.parse(req.body);
  const { userId } = getAuth(req);
  const target   = await getValidationTarget(body.targetId);
  if (!target) return res.status(404).json({ error: "Target not found" });

  const run = await createValidationRun({
    targetId:    body.targetId,
    runType:     body.runType,
    toolName:    body.runType,
    commitSha:   process.env.GIT_COMMIT ?? undefined,
    environment: process.env.NODE_ENV ?? "development",
  });

  appendAuditEvent({ actor: userId ?? "system", action: "validation_run.manual_trigger", resource: `validation_run:${run.id}`, metadata: { runType: body.runType, targetId: body.targetId } });
  void shipSecurityEvent({ actor: userId ?? "system", action: "validation_run.manual_trigger", resource: `validation_run:${run.id}`, result: "allow" });

  // Execute runner in background — respond with queued run immediately
  setImmediate(async () => {
    try {
      const runner  = getRunner(body.runType);
      const outcome = await runner(target);
      await completeValidationRun({
        runId:     run.id,
        status:    outcome.status,
        score:     outcome.score,
        maxScore:  outcome.maxScore,
        summary:   outcome.message,
        rawOutput: outcome.rawOutput,
        findings:  outcome.findings as any[],
        metadata:  { toolVersion: outcome.toolVersion },
      });
    } catch (err: any) {
      await failValidationRun(run.id, err.message).catch(() => { /* ignore */ });
    }
  });

  res.status(202).json({ runId: run.id, status: "queued", message: "Validation run queued — poll /runs/:id for results" });
});

// ── Findings ──────────────────────────────────────────────────────────────────

router.get("/findings", async (req: Request, res: Response) => {
  const findings = await listOpenValidationFindings({
    severity: req.query.severity as string | undefined,
    limit:    req.query.limit ? Number(req.query.limit) : undefined,
  });
  res.json({ findings, total: findings.length });
});

router.post("/findings/:id/resolve", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  await resolveValidationFinding(req.params.id);
  appendAuditEvent({ actor: userId ?? "system", action: "validation_finding.resolve", resource: `validation_finding:${req.params.id}` });
  res.json({ ok: true });
});

// ── Scorecard ─────────────────────────────────────────────────────────────────

router.get("/scorecard", highRiskRateLimit, async (_req: Request, res: Response) => {
  const scorecard = await generateScorecard();
  res.json(scorecard);
});

// ── Trust snapshot history ────────────────────────────────────────────────────

router.get("/trust-snapshot", async (req: Request, res: Response) => {
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const result = await db.execute(sql`
    SELECT * FROM validation_trust_snapshots ORDER BY created_at DESC LIMIT ${limit}
  `).catch(() => ({ rows: [] }));
  res.json({ snapshots: (result as { rows: unknown[] }).rows });
});

// ── Schedules ─────────────────────────────────────────────────────────────────

router.post("/schedules", async (req: Request, res: Response) => {
  const schema = z.object({
    targetId:         z.string().uuid(),
    runType:          z.enum(["zap","trivy","semgrep","dependency","tls","headers","uptime","wireguard","node_health","k6","synthetic","custom"]),
    intervalMinutes:  z.number().int().min(1).max(1440).optional(),
    cronExpression:   z.string().optional(),
    enabled:          z.boolean().default(true),
  });
  const body = schema.parse(req.body);
  const { userId } = getAuth(req);

  const nextRunAt = new Date(Date.now() + (body.intervalMinutes ?? 60) * 60_000).toISOString();
  const id = crypto.randomUUID();

  await db.execute(sql`
    INSERT INTO validation_schedules (id, target_id, run_type, interval_minutes, cron_expression, enabled, next_run_at)
    VALUES (${id}::uuid, ${body.targetId}::uuid, ${body.runType},
            ${body.intervalMinutes ?? null}, ${body.cronExpression ?? null},
            ${body.enabled}, ${nextRunAt})
  `);

  appendAuditEvent({ actor: userId ?? "system", action: "validation_schedule.create", resource: `validation_schedule:${id}`, metadata: body });
  res.status(201).json({ id, ...body, next_run_at: nextRunAt });
});

export default router;
