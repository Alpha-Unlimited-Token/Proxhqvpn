// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function createBillingAccount(input: {
  tenantId?: string | null;
  userId?: string | null;
  providerCustomerId?: string | null;
  billingEmail?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO billing_accounts
      (id, tenant_id, user_id, provider_customer_id, billing_email, metadata)
    VALUES
      (${id}, ${input.tenantId ?? null}, ${input.userId ?? null}, ${input.providerCustomerId ?? null}, ${input.billingEmail ?? null}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  return { id };
}

export async function getBillingAccountByUser(userId: string) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM billing_accounts
    WHERE user_id = ${userId}
      AND status = 'active'
    ORDER BY created_at DESC
    LIMIT 1
  `);

  return result.rows?.[0] ?? null;
}
