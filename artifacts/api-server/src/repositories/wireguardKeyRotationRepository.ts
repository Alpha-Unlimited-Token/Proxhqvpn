// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function recordWireGuardKeyRotation(input: {
  userId: string;
  deviceId: string;
  oldFingerprint?: string | null;
  newFingerprint: string;
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO wireguard_key_rotations
      (id, user_id, device_id, old_fingerprint, new_fingerprint, metadata)
    VALUES
      (${id}, ${input.userId}, ${input.deviceId}, ${input.oldFingerprint ?? null}, ${input.newFingerprint}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  return { id };
}
