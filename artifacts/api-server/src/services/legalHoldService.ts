// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";

export async function createLegalHold(input: {
  tenantId?: string | null;
  subject: string;
  reason: string;
  createdBy?: string | null;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO legal_holds
      (id, tenant_id, subject, reason, created_by)
    VALUES
      (${id}, ${input.tenantId ?? null}, ${input.subject}, ${input.reason}, ${input.createdBy ?? null})
  `);

  await publishPlatformEvent({
    type: "legal_hold.created",
    actor: input.createdBy ?? undefined,
    subject: input.subject,
    severity: "warn",
    payload: { legalHoldId: id, reason: input.reason },
  });

  return { id };
}

export async function releaseLegalHold(input: {
  legalHoldId: string;
  releasedBy?: string | null;
}) {
  await db.execute(sql`
    UPDATE legal_holds
    SET status = 'released',
        released_at = NOW()
    WHERE id = ${input.legalHoldId}
  `);

  return { ok: true };
}

export async function subjectHasActiveLegalHold(subject: string) {
  const result: any = await db.execute(sql`
    SELECT id
    FROM legal_holds
    WHERE subject = ${subject}
      AND status = 'active'
    LIMIT 1
  `);

  return !!result.rows?.[0];
}
