// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function createTenant(input: {
  name: string;
  slug: string;
  createdBy: string;
}) {
  const tenantId = randomUUID();
  const membershipId = randomUUID();

  await db.execute(sql`
    INSERT INTO tenants (id, name, slug)
    VALUES (${tenantId}, ${input.name}, ${input.slug})
  `);

  await db.execute(sql`
    INSERT INTO tenant_memberships (id, tenant_id, user_id, role)
    VALUES (${membershipId}, ${tenantId}, ${input.createdBy}, 'owner')
  `);

  return { tenantId };
}

export async function getUserTenants(userId: string) {
  const result: any = await db.execute(sql`
    SELECT t.*, tm.role
    FROM tenants t
    JOIN tenant_memberships tm ON tm.tenant_id = t.id
    WHERE tm.user_id = ${userId}
      AND tm.status = 'active'
      AND t.status = 'active'
    ORDER BY t.created_at DESC
  `);

  return result.rows ?? [];
}
