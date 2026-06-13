// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function setPlatformConfig(input: {
  key: string;
  value: unknown;
  scope?: string;
  updatedBy?: string | null;
}) {
  await db.execute(sql`
    INSERT INTO platform_config
      (key, value, scope, updated_by)
    VALUES
      (${input.key}, ${JSON.stringify(input.value)}::jsonb, ${input.scope ?? "global"}, ${input.updatedBy ?? null})
    ON CONFLICT (key)
    DO UPDATE SET
      value = EXCLUDED.value,
      scope = EXCLUDED.scope,
      updated_by = EXCLUDED.updated_by,
      updated_at = NOW()
  `);

  return { ok: true };
}

export async function getPlatformConfig<T = unknown>(key: string): Promise<T | null> {
  const result: any = await db.execute(sql`
    SELECT value FROM platform_config
    WHERE key = ${key}
    LIMIT 1
  `);

  return result.rows?.[0]?.value ?? null;
}
