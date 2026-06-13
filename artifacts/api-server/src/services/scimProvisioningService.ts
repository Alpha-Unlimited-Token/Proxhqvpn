// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";

export async function upsertScimIdentity(input: {
  tenantId: string;
  externalId: string;
  email: string;
  displayName?: string | null;
  active?: boolean;
  raw?: Record<string, unknown>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO scim_identities
      (id, tenant_id, external_id, email, display_name, active, raw)
    VALUES
      (${id}, ${input.tenantId}, ${input.externalId}, ${input.email}, ${input.displayName ?? null}, ${input.active ?? true}, ${JSON.stringify(input.raw ?? {})}::jsonb)
    ON CONFLICT (tenant_id, external_id)
    DO UPDATE SET
      email = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      active = EXCLUDED.active,
      raw = EXCLUDED.raw,
      updated_at = NOW()
  `);

  await publishPlatformEvent({
    type: "scim.identity.upserted",
    subject: input.email,
    severity: "info",
    payload: {
      tenantId: input.tenantId,
      externalId: input.externalId,
      active: input.active ?? true,
    },
  });

  return { ok: true };
}

export async function deactivateScimIdentity(input: {
  tenantId: string;
  externalId: string;
}) {
  await db.execute(sql`
    UPDATE scim_identities
    SET active = FALSE,
        updated_at = NOW()
    WHERE tenant_id = ${input.tenantId}
      AND external_id = ${input.externalId}
  `);

  return { ok: true };
}
