// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Revokes ZTNA device posture records that have exceeded their TTL.
// Patch 9 — ZTNA posture expiry enforcement.
// Requires migration 302_ztna_posture_expiry.sql to add expiresAt column.
import { registerWorker } from "../lib/worker-registry";
import { db } from "@workspace/db";
import { ztnaDevicesTable } from "@workspace/db";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { shipSecurityEvent } from "../lib/siem";

registerWorker({
  name: "ztna-posture-expiry-worker",
  intervalMs: 2 * 60_000, // every 2 minutes
  enabled: () => process.env.PROXHQ_ENABLE_ZTNA_EXPIRY !== "0",
  async run() {
    try {
      const expired = await db
        .update(ztnaDevicesTable)
        .set({ revoked: true })
        .where(
          and(
            eq(ztnaDevicesTable.revoked, false),
            isNotNull((ztnaDevicesTable as any).expiresAt),
            lt((ztnaDevicesTable as any).expiresAt, sql`NOW()`),
          ),
        )
        .returning({
          id: ztnaDevicesTable.id,
          userId: ztnaDevicesTable.userId,
          certFingerprint: ztnaDevicesTable.certFingerprint,
        });

      for (const device of expired) {
        logger.info({ deviceId: device.id, userId: device.userId }, "ZTNA posture expired — device revoked");
        await shipSecurityEvent({
          actor: "system",
          action: "ztna.posture_expired",
          resource: `device:${device.certFingerprint}`,
          result: "deny",
          severity: "medium",
          metadata: { deviceId: device.id, userId: device.userId },
        });
      }
    } catch {
      // Column may not exist yet — silently skip until migration is applied
    }
  },
});
