// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import crypto, { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export function hashLicenseKey(key: string) {
  return crypto.createHash("sha256").update(key, "utf8").digest("hex");
}

export async function createLicense(input: {
  tenantId?: string | null;
  userId?: string | null;
  licenseKey: string;
  plan: string;
  seatLimit?: number | null;
  expiresAt?: Date | null;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO licenses
      (id, tenant_id, user_id, license_key_hash, plan, seat_limit, expires_at)
    VALUES
      (${id}, ${input.tenantId ?? null}, ${input.userId ?? null}, ${hashLicenseKey(input.licenseKey)}, ${input.plan}, ${input.seatLimit ?? null}, ${input.expiresAt?.toISOString() ?? null})
  `);

  return { id };
}

export async function verifyLicenseKey(licenseKey: string) {
  const hash = hashLicenseKey(licenseKey);

  const result: any = await db.execute(sql`
    SELECT *
    FROM licenses
    WHERE license_key_hash = ${hash}
      AND status = 'active'
      AND (expires_at IS NULL OR expires_at > NOW())
    LIMIT 1
  `);

  return result.rows?.[0] ?? null;
}
