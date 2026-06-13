// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function createSamlConnection(input: {
  tenantId: string;
  name: string;
  entityId: string;
  ssoUrl: string;
  certificate: string;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO saml_connections
      (id, tenant_id, name, entity_id, sso_url, certificate)
    VALUES
      (${id}, ${input.tenantId}, ${input.name}, ${input.entityId}, ${input.ssoUrl}, ${input.certificate})
  `);

  return { id };
}

export async function listSamlConnections(tenantId: string) {
  const result: any = await db.execute(sql`
    SELECT id, tenant_id, name, entity_id, sso_url, enabled, metadata, created_at
    FROM saml_connections
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at DESC
  `);

  return result.rows ?? [];
}
