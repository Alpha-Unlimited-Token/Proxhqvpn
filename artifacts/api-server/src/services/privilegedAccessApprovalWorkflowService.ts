import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";
import { writeAuditEvent } from "../repositories/auditRepository";

export type PrivilegedAccessApprovalWorkflowServiceInput = {
  tenantId?: string | null;
  userId?: string | null;
  subject?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createPrivilegedAccessApprovalWorkflow(
  input: PrivilegedAccessApprovalWorkflowServiceInput,
) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO patch_158_privileged_access_approval_workflow
      (id, tenant_id, user_id, subject, metadata, created_by)
    VALUES
      (${id}, ${input.tenantId ?? null}, ${input.userId ?? null}, ${input.subject ?? null}, ${JSON.stringify(input.metadata ?? {})}::jsonb, ${input.createdBy ?? null})
  `);

  await publishPlatformEvent({
    type: "patch.158.privileged-access-approval-workflow.created",
    actor: input.createdBy ?? input.userId ?? undefined,
    subject: input.subject ?? id,
    severity: "info",
    payload: { id, patch: 158, title: "Privileged access approval workflow" },
  });

  await writeAuditEvent({
    actor: input.createdBy ?? input.userId ?? "system",
    action: "patch.158.privileged-access-approval-workflow.created",
    resource: "privileged-access-approval-workflow",
    result: "allow",
    metadata: { id, ...input.metadata },
  });

  return { id };
}

export async function listPrivilegedAccessApprovalWorkflow(
  input: { tenantId?: string | null; userId?: string | null; limit?: number } = {},
) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM patch_158_privileged_access_approval_workflow
    WHERE (${input.tenantId ?? null} IS NULL OR tenant_id = ${input.tenantId ?? null})
      AND (${input.userId ?? null} IS NULL OR user_id = ${input.userId ?? null})
    ORDER BY created_at DESC
    LIMIT ${input.limit ?? 100}
  `);

  return result.rows ?? [];
}
