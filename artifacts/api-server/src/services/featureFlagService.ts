// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import crypto from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

function bucket(subject: string, key: string) {
  const hash = crypto.createHash("sha256").update(`${key}:${subject}`).digest("hex");
  return parseInt(hash.slice(0, 8), 16) % 100;
}

export async function setFeatureFlag(input: {
  key: string;
  enabled: boolean;
  rolloutPercent?: number;
  rules?: Record<string, unknown>;
}) {
  await db.execute(sql`
    INSERT INTO feature_flags
      (key, enabled, rollout_percent, rules)
    VALUES
      (${input.key}, ${input.enabled}, ${input.rolloutPercent ?? 0}, ${JSON.stringify(input.rules ?? {})}::jsonb)
    ON CONFLICT (key)
    DO UPDATE SET
      enabled = EXCLUDED.enabled,
      rollout_percent = EXCLUDED.rollout_percent,
      rules = EXCLUDED.rules,
      updated_at = NOW()
  `);

  return { ok: true };
}

export async function isFeatureEnabled(key: string, subject = "anonymous") {
  const result: any = await db.execute(sql`
    SELECT * FROM feature_flags
    WHERE key = ${key}
    LIMIT 1
  `);

  const flag = result.rows?.[0];
  if (!flag || !flag.enabled) return false;

  return bucket(subject, key) < Number(flag.rollout_percent ?? 0) || Number(flag.rollout_percent) === 100;
}
