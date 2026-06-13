// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Continuous validation worker — runs due validation schedules every minute.
// Enabled by PROXHQ_ENABLE_CONTINUOUS_VALIDATION=1
import { registerWorker } from "../lib/worker-registry";
import { logger } from "../lib/logger";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { createValidationRun, completeValidationRun, failValidationRun } from "../services/validationRunService";
import { getValidationTarget, assertTargetAllowed } from "../services/validationTargetService";
import { bulkCreateValidationFindings } from "../services/validationFindingService";
import { getRunner } from "../services/validationRunnerRegistry";
import { publishPlatformEvent } from "../lib/event-bus";

registerWorker({
  name:              "continuous-validation-worker",
  intervalMs:        60_000,
  clusterSingleton:  true,
  enabled:           () => process.env.PROXHQ_ENABLE_CONTINUOUS_VALIDATION === "1",

  async run() {
    const now = new Date().toISOString();

    const result = await db.execute(sql`
      SELECT id, target_id, run_type
      FROM validation_schedules
      WHERE enabled = TRUE
        AND (next_run_at IS NULL OR next_run_at <= NOW())
      LIMIT 10
    `).catch(() => ({ rows: [] }));

    const schedules = (result as { rows: Array<{ id: string; target_id: string; run_type: string }> }).rows;
    if (schedules.length === 0) return;

    logger.info({ count: schedules.length }, "[continuous-validation] Processing due schedules");

    for (const schedule of schedules) {
      // Advance next_run_at immediately to prevent double-execution
      await db.execute(sql`
        UPDATE validation_schedules
        SET last_run_at = NOW(),
            next_run_at = NOW() + INTERVAL '1 minute' * COALESCE(interval_minutes, 60)
        WHERE id = ${schedule.id}::uuid
      `).catch(() => { /* non-fatal */ });

      const target = schedule.target_id ? await getValidationTarget(schedule.target_id) : null;
      if (!target) {
        logger.warn({ scheduleId: schedule.id }, "[continuous-validation] Target not found, skipping");
        continue;
      }

      let runId: string | null = null;
      try {
        assertTargetAllowed(target, schedule.run_type);

        const run = await createValidationRun({
          targetId:    target.id,
          runType:     schedule.run_type,
          toolName:    schedule.run_type,
          environment: process.env.NODE_ENV ?? "development",
        });
        runId = run.id;

        const runner  = getRunner(schedule.run_type);
        const outcome = await runner(target);

        await completeValidationRun({
          runId,
          status:    outcome.status === "error" ? "error" : outcome.status,
          score:     outcome.score,
          maxScore:  outcome.maxScore,
          severity:  outcome.status === "failed" ? "high" : outcome.status === "warning" ? "medium" : "info",
          summary:   outcome.message,
          rawOutput: outcome.rawOutput,
          findings:  outcome.findings as any[],
          metadata:  { toolVersion: outcome.toolVersion },
        });

        if (outcome.findings && outcome.findings.length > 0) {
          await bulkCreateValidationFindings(
            outcome.findings.map(f => ({
              runId:       runId ?? undefined,
              targetId:    target.id,
              title:       f.title,
              severity:    (f.severity as any) ?? "info",
              description: (f as any).description,
              evidence:    { raw: f },
            })),
          );
        }

        await publishPlatformEvent({
          type:     "validation.run.completed",
          actor:    "continuous-validation-worker",
          subject:  `${target.name}:${schedule.run_type}`,
          severity: outcome.status === "failed" ? "error" : "info",
          payload:  { runId, targetId: target.id, runType: schedule.run_type, status: outcome.status, score: outcome.score },
        });

        logger.info({ runId, target: target.name, runType: schedule.run_type, status: outcome.status }, "[continuous-validation] Run complete");

      } catch (err: any) {
        logger.error({ err, scheduleId: schedule.id, target: target.name }, "[continuous-validation] Run failed");
        if (runId) await failValidationRun(runId, err.message ?? "Unknown error").catch(() => { /* ignore */ });
      }
    }
  },
});
