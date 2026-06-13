// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function createRbacRole(input: {
  tenantId?: string | null;
  name: string;
  description?: string | null;
  permissions: string[];
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO rbac_roles
      (id, tenant_id, name, description, permissions)
    VALUES
      (${id}, ${input.tenantId ?? null}, ${input.name}, ${input.description ?? null}, ${JSON.stringify(input.permissions)}::jsonb)
  `);

  return { id };
}

export async function assignRbacRole(input: {
  tenantId?: string | null;
  userId: string;
  roleId: string;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO rbac_assignments
      (id, tenant_id, user_id, role_id)
    VALUES
      (${id}, ${input.tenantId ?? null}, ${input.userId}, ${input.roleId})
    ON CONFLICT DO NOTHING
  `);

  return { id };
}

export async function getUserPermissions(input: {
  tenantId?: string | null;
  userId: string;
}) {
  const result: any = await db.execute(sql`
    SELECT r.permissions
    FROM rbac_assignments a
    JOIN rbac_roles r ON r.id = a.role_id
    WHERE a.user_id = ${input.userId}
      AND (
        (${input.tenantId ?? null} IS NULL AND a.tenant_id IS NULL)
        OR a.tenant_id = ${input.tenantId ?? null}
      )
  `);

  const permissions = new Set<string>();

  for (const row of result.rows ?? []) {
    for (const permission of row.permissions ?? []) {
      permissions.add(String(permission));
    }
  }

  return [...permissions];
}
