// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import crypto, { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function createAuditExport(input: {
  tenantId?: string | null;
  requestedBy: string;
  exportType: "audit_chain" | "security_events" | "access";
  limit?: number;
}) {
  const limit = input.limit ?? 10000;

  const result: any =
    input.exportType === "audit_chain"
      ? await db.execute(sql`SELECT * FROM audit_chain ORDER BY id DESC LIMIT ${limit}`)
      : input.exportType === "security_events"
        ? await db.execute(sql`SELECT * FROM security_events ORDER BY created_at DESC LIMIT ${limit}`)
        : await db.execute(sql`SELECT * FROM platform_events ORDER BY created_at DESC LIMIT ${limit}`);

  const rows = result.rows ?? [];
  const content = JSON.stringify(rows);
  const sha256 = crypto.createHash("sha256").update(content).digest("hex");
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO audit_exports
      (id, tenant_id, requested_by, export_type, row_count, sha256)
    VALUES
      (${id}, ${input.tenantId ?? null}, ${input.requestedBy}, ${input.exportType}, ${rows.length}, ${sha256})
  `);

  return { id, rowCount: rows.length, sha256, rows };
}
