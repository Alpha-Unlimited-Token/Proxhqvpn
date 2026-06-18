// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Periodically verifies the last N audit-chain entries for hash continuity + HMAC integrity.
// Patch 10 — verifyChain() automated scheduling.
import { registerWorker } from "../lib/worker-registry";
import { db } from "@workspace/db";
import { auditLogAppendOnlyTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { verifyChain, type ChainEntry } from "../lib/audit-chain";
import { logger } from "../lib/logger";
import { shipSecurityEvent } from "../lib/siem";

const VERIFY_WINDOW = 200; // verify last 200 entries on each run

registerWorker({
  name: "audit-chain-integrity-worker",
  intervalMs: 10 * 60_000, // every 10 minutes
  enabled: () => process.env.PROXHQ_ENABLE_AUDIT_CHAIN_INTEGRITY !== "0",
  async run() {
    const rows = await db
      .select()
      .from(auditLogAppendOnlyTable)
      .orderBy(desc(auditLogAppendOnlyTable.seq))
      .limit(VERIFY_WINDOW);

    if (rows.length === 0) return;

    // Rows are newest-first — reverse to oldest-first for chain verification
    const entries: ChainEntry[] = rows.reverse().map((r) => ({
      ts: r.createdAt.toISOString(),
      seq: r.seq,
      prevHash: r.prevHash,
      hash: r.hash,
      sig: r.signature,
      event: {
        actor: r.actor,
        action: r.action,
        resource: r.resource,
        result: r.result as ChainEntry["event"]["result"],
        ip: r.ip ?? undefined,
        metadata: r.metadata,
      },
    }));

    // Use the prevHash of the oldest entry as genesis for this window
    const windowGenesis = entries[0].prevHash;
    const result = verifyChain(entries, windowGenesis);

    if (!result.valid) {
      logger.error(
        { firstBadIndex: result.firstBadIndex, reason: result.reason, windowSize: entries.length },
        "CRITICAL: Audit chain integrity violation detected",
      );
      await shipSecurityEvent({
        actor: "system",
        action: "audit_chain.integrity_violation",
        resource: "audit_log_append_only",
        result: "error",
        severity: "critical",
        metadata: { firstBadIndex: result.firstBadIndex, reason: result.reason, windowSize: entries.length },
      });
    } else {
      logger.info({ windowSize: entries.length }, "Audit chain integrity verified");
    }
  },
});
