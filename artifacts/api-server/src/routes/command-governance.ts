import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { classifyCommandRisk, requiredApprovalCount } from "../lib/command-risk";

const router = Router();

const commandSchema = z.object({
  type: z.string().min(3).max(80),
  payload: z.record(z.unknown()).default({}),
  targetScope: z.record(z.unknown()).default({}),
});

router.post("/request", async (req: Request, res: Response) => {
  const body = commandSchema.parse(req.body);
  const userId = (req as any).auth?.userId ?? "unknown";
  const risk = classifyCommandRisk(body);
  const approvalsRequired = requiredApprovalCount(risk);
  const status = approvalsRequired > 0 ? "pending_approval" : "queued";

  const rows = await db.execute(sql`
    INSERT INTO command_jobs (requested_by, command_type, risk_level, status, target_scope, request_payload)
    VALUES (${userId}, ${body.type}, ${risk}, ${status}, ${JSON.stringify(body.targetScope)}::jsonb, ${JSON.stringify(body.payload)}::jsonb)
    RETURNING id, requested_by, command_type, risk_level, status, created_at
  `);

  res.status(202).json({ job: rows.rows[0], approvalsRequired });
});

router.get("/jobs", async (req: Request, res: Response) => {
  const userId = (req as any).auth?.userId ?? "unknown";
  const rows = await db.execute(sql`
    SELECT id, requested_by, command_type, risk_level, status, output_summary, created_at, updated_at
    FROM command_jobs
    WHERE requested_by = ${userId}
    ORDER BY created_at DESC LIMIT 50
  `);
  res.json({ jobs: rows.rows });
});

router.post("/:jobId/approve", async (req: Request, res: Response) => {
  const userId = (req as any).auth?.userId ?? "unknown";
  const { jobId } = req.params;

  const job = await db.execute(sql`SELECT id, risk_level, status FROM command_jobs WHERE id = ${jobId}`);
  if (!job.rows[0]) return res.status(404).json({ error: "Job not found." });
  if ((job.rows[0] as any).status !== "pending_approval") {
    return res.status(409).json({ error: "Job is not awaiting approval." });
  }

  await db.execute(sql`
    INSERT INTO command_approvals (job_id, approver_user_id, decision)
    VALUES (${jobId}, ${userId}, 'approved')
    ON CONFLICT (job_id, approver_user_id) DO NOTHING
  `);

  const approvals = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM command_approvals WHERE job_id = ${jobId} AND decision = 'approved'
  `);
  const approvalCount = Number((approvals.rows[0] as any).cnt);
  const required = requiredApprovalCount((job.rows[0] as any).risk_level as any);

  if (approvalCount >= required) {
    await db.execute(sql`UPDATE command_jobs SET status = 'queued', updated_at = now() WHERE id = ${jobId}`);
  }

  res.json({ ok: true, jobId, approvalCount, required });
});

router.post("/:jobId/deny", async (req: Request, res: Response) => {
  const userId = (req as any).auth?.userId ?? "unknown";
  const { jobId } = req.params;
  const { reason } = z.object({ reason: z.string().max(500).optional() }).parse(req.body);

  await db.execute(sql`
    INSERT INTO command_approvals (job_id, approver_user_id, decision, reason)
    VALUES (${jobId}, ${userId}, 'denied', ${reason ?? null})
    ON CONFLICT (job_id, approver_user_id) DO UPDATE SET decision = 'denied', reason = EXCLUDED.reason
  `);
  await db.execute(sql`UPDATE command_jobs SET status = 'denied', updated_at = now() WHERE id = ${jobId}`);

  res.json({ ok: true, jobId, status: "denied" });
});

router.post("/:jobId/rollback", async (req: Request, res: Response) => {
  const { jobId } = req.params;
  const job = await db.execute(sql`SELECT id, status, rollback_payload FROM command_jobs WHERE id = ${jobId}`);
  if (!job.rows[0]) return res.status(404).json({ error: "Job not found." });
  if (!(job.rows[0] as any).rollback_payload) {
    return res.status(409).json({ error: "No rollback payload available." });
  }
  await db.execute(sql`UPDATE command_jobs SET status = 'rolled_back', updated_at = now() WHERE id = ${jobId}`);
  res.json({ ok: true, jobId, status: "rolled_back" });
});

export default router;
