import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";
import { writeAuditEvent } from "../repositories/auditRepository";

export type WebauthnFido2AdminEnforcementServiceInput = {
  tenantId?: string | null;
  userId?: string | null;
  subject?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createWebauthnFido2AdminEnforcement(
  input: WebauthnFido2AdminEnforcementServiceInput,
) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO patch_151_webauthn_fido2_admin_enforcement
      (id, tenant_id, user_id, subject, metadata, created_by)
    VALUES
      (${id}, ${input.tenantId ?? null}, ${input.userId ?? null}, ${input.subject ?? null}, ${JSON.stringify(input.metadata ?? {})}::jsonb, ${input.createdBy ?? null})
  `);

  await publishPlatformEvent({
    type: "patch.151.webauthn-fido2-admin-enforcement.created",
    actor: input.createdBy ?? input.userId ?? undefined,
    subject: input.subject ?? id,
    severity: "info",
    payload: { id, patch: 151, title: "WebAuthn/FIDO2 admin enforcement" },
  });

  await writeAuditEvent({
    actor: input.createdBy ?? input.userId ?? "system",
    action: "patch.151.webauthn-fido2-admin-enforcement.created",
    resource: "webauthn-fido2-admin-enforcement",
    result: "allow",
    metadata: { id, ...input.metadata },
  });

  return { id };
}

export async function listWebauthnFido2AdminEnforcement(
  input: { tenantId?: string | null; userId?: string | null; limit?: number } = {},
) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM patch_151_webauthn_fido2_admin_enforcement
    WHERE (${input.tenantId ?? null} IS NULL OR tenant_id = ${input.tenantId ?? null})
      AND (${input.userId ?? null} IS NULL OR user_id = ${input.userId ?? null})
    ORDER BY created_at DESC
    LIMIT ${input.limit ?? 100}
  `);

  return result.rows ?? [];
}
