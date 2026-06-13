import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";
import { writeAuditEvent } from "../repositories/auditRepository";

export type AutoTriageRulesServiceInput = {
  tenantId?: string | null;
  userId?: string | null;
  subject?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createAutoTriageRules(
  input: AutoTriageRulesServiceInput,
) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO patch_233_auto_triage_rules
      (id, tenant_id, user_id, subject, metadata, created_by)
    VALUES
      (${id}, ${input.tenantId ?? null}, ${input.userId ?? null}, ${input.subject ?? null}, ${JSON.stringify(input.metadata ?? {})}::jsonb, ${input.createdBy ?? null})
  `);

  await publishPlatformEvent({
    type: "patch.233.auto-triage-rules.created",
    actor: input.createdBy ?? input.userId ?? undefined,
    subject: input.subject ?? id,
    severity: "info",
    payload: { id, patch: 233, title: "Auto-triage rules" },
  });

  await writeAuditEvent({
    actor: input.createdBy ?? input.userId ?? "system",
    action: "patch.233.auto-triage-rules.created",
    resource: "auto-triage-rules",
    result: "allow",
    metadata: { id, ...input.metadata },
  });

  return { id };
}

export async function listAutoTriageRules(
  input: { tenantId?: string | null; userId?: string | null; limit?: number } = {},
) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM patch_233_auto_triage_rules
    WHERE (${input.tenantId ?? null} IS NULL OR tenant_id = ${input.tenantId ?? null})
      AND (${input.userId ?? null} IS NULL OR user_id = ${input.userId ?? null})
    ORDER BY created_at DESC
    LIMIT ${input.limit ?? 100}
  `);

  return result.rows ?? [];
}
