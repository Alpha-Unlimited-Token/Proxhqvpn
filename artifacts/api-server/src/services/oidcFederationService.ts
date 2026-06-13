// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function createOidcConnection(input: {
  tenantId: string;
  name: string;
  issuer: string;
  clientId: string;
  clientSecretRef?: string | null;
  scopes?: string[];
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO oidc_connections
      (id, tenant_id, name, issuer, client_id, client_secret_ref, scopes)
    VALUES
      (${id}, ${input.tenantId}, ${input.name}, ${input.issuer}, ${input.clientId}, ${input.clientSecretRef ?? null}, ${JSON.stringify(input.scopes ?? ["openid", "profile", "email"])}::jsonb)
  `);

  return { id };
}

export async function listOidcConnections(tenantId: string) {
  const result: any = await db.execute(sql`
    SELECT id, tenant_id, name, issuer, client_id, scopes, enabled, created_at
    FROM oidc_connections
    WHERE tenant_id = ${tenantId}
    ORDER BY created_at DESC
  `);

  return result.rows ?? [];
}
