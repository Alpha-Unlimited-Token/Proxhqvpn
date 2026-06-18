// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Deactivates canary tokens past their TTL (expiresAt column).
// Patch 11 — canary token TTL enforcement.
// Requires migration 302_canary_token_ttl.sql to add expiresAt column.
import { registerWorker } from "../lib/worker-registry";
import { db } from "@workspace/db";
import { canaryTokensTable } from "@workspace/db";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { logger } from "../lib/logger";

registerWorker({
  name: "canary-token-cleanup-worker",
  intervalMs: 5 * 60_000, // every 5 minutes
  enabled: () => process.env.PROXHQ_ENABLE_CANARY_CLEANUP !== "0",
  async run() {
    // Deactivate expired tokens (if the expiresAt column exists)
    try {
      const expired = await db
        .update(canaryTokensTable)
        .set({ active: false })
        .where(
          and(
            eq(canaryTokensTable.active, true),
            isNotNull((canaryTokensTable as any).expiresAt),
            lt((canaryTokensTable as any).expiresAt, sql`NOW()`),
          ),
        )
        .returning({ id: canaryTokensTable.id, tokenId: canaryTokensTable.tokenId });

      if (expired.length > 0) {
        logger.info({ count: expired.length }, "Expired canary tokens deactivated");
      }
    } catch {
      // Column may not exist yet — silently skip until migration is applied
    }
  },
});
