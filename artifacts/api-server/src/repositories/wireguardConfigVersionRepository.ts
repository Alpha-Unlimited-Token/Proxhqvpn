// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function getNextWireGuardConfigVersion(input: {
  userId: string;
  deviceId: string;
}) {
  const result: any = await db.execute(sql`
    SELECT COALESCE(MAX(version), 0) + 1 AS next_version
    FROM wireguard_config_versions
    WHERE user_id = ${input.userId}
      AND device_id = ${input.deviceId}
  `);

  return Number(result.rows?.[0]?.next_version ?? 1);
}

export async function saveWireGuardConfigVersion(input: {
  userId: string;
  deviceId: string;
  fingerprint: string;
  config: string;
  metadata?: Record<string, unknown>;
}) {
  const version = await getNextWireGuardConfigVersion(input);
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO wireguard_config_versions
      (id, user_id, device_id, version, fingerprint, config, metadata)
    VALUES
      (${id}, ${input.userId}, ${input.deviceId}, ${version}, ${input.fingerprint}, ${input.config}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  return { id, version };
}
