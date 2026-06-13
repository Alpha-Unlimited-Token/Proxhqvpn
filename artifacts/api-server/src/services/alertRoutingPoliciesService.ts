import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";
import { writeAuditEvent } from "../repositories/auditRepository";

export type AlertRoutingPoliciesServiceInput = {
  tenantId?: string | null;
  userId?: string | null;
  subject?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createAlertRoutingPolicies(
  input: AlertRoutingPoliciesServiceInput,
) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO patch_209_alert_routing_policies
      (id, tenant_id, user_id, subject, metadata, created_by)
    VALUES
      (${id}, ${input.tenantId ?? null}, ${input.userId ?? null}, ${input.subject ?? null}, ${JSON.stringify(input.metadata ?? {})}::jsonb, ${input.createdBy ?? null})
  `);

  await publishPlatformEvent({
    type: "patch.209.alert-routing-policies.created",
    actor: input.createdBy ?? input.userId ?? undefined,
    subject: input.subject ?? id,
    severity: "info",
    payload: { id, patch: 209, title: "Alert routing policies" },
  });

  await writeAuditEvent({
    actor: input.createdBy ?? input.userId ?? "system",
    action: "patch.209.alert-routing-policies.created",
    resource: "alert-routing-policies",
    result: "allow",
    metadata: { id, ...input.metadata },
  });

  return { id };
}

export async function listAlertRoutingPolicies(
  input: { tenantId?: string | null; userId?: string | null; limit?: number } = {},
) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM patch_209_alert_routing_policies
    WHERE (${input.tenantId ?? null} IS NULL OR tenant_id = ${input.tenantId ?? null})
      AND (${input.userId ?? null} IS NULL OR user_id = ${input.userId ?? null})
    ORDER BY created_at DESC
    LIMIT ${input.limit ?? 100}
  `);

  return result.rows ?? [];
}
