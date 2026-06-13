import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";
import { writeAuditEvent } from "../repositories/auditRepository";

export type VpnSessionLedgerServiceInput = {
  tenantId?: string | null;
  userId?: string | null;
  subject?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
};

export async function createVpnSessionLedger(
  input: VpnSessionLedgerServiceInput,
) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO patch_190_vpn_session_ledger
      (id, tenant_id, user_id, subject, metadata, created_by)
    VALUES
      (${id}, ${input.tenantId ?? null}, ${input.userId ?? null}, ${input.subject ?? null}, ${JSON.stringify(input.metadata ?? {})}::jsonb, ${input.createdBy ?? null})
  `);

  await publishPlatformEvent({
    type: "patch.190.vpn-session-ledger.created",
    actor: input.createdBy ?? input.userId ?? undefined,
    subject: input.subject ?? id,
    severity: "info",
    payload: { id, patch: 190, title: "VPN session ledger" },
  });

  await writeAuditEvent({
    actor: input.createdBy ?? input.userId ?? "system",
    action: "patch.190.vpn-session-ledger.created",
    resource: "vpn-session-ledger",
    result: "allow",
    metadata: { id, ...input.metadata },
  });

  return { id };
}

export async function listVpnSessionLedger(
  input: { tenantId?: string | null; userId?: string | null; limit?: number } = {},
) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM patch_190_vpn_session_ledger
    WHERE (${input.tenantId ?? null} IS NULL OR tenant_id = ${input.tenantId ?? null})
      AND (${input.userId ?? null} IS NULL OR user_id = ${input.userId ?? null})
    ORDER BY created_at DESC
    LIMIT ${input.limit ?? 100}
  `);

  return result.rows ?? [];
}
