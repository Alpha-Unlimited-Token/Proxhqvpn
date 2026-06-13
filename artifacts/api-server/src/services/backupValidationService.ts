// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import crypto, { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function recordBackupValidation(input: {
  backupUri: string;
  content?: string | Buffer;
  status: "passed" | "failed";
  details?: Record<string, unknown>;
}) {
  const id = randomUUID();
  const checksum = input.content
    ? crypto.createHash("sha256").update(input.content).digest("hex")
    : null;

  await db.execute(sql`
    INSERT INTO backup_validation_runs
      (id, backup_uri, status, checksum, details, completed_at)
    VALUES
      (${id}, ${input.backupUri}, ${input.status}, ${checksum}, ${JSON.stringify(input.details ?? {})}::jsonb, NOW())
  `);

  return { id, checksum };
}
