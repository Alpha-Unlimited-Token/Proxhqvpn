// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// F-6: Proper registered worker for expired blocked-IP cleanup (replaces inline setInterval).
import { registerWorker } from "../lib/worker-registry";
import { db } from "@workspace/db";
import { blockedIpsTable, terminalJobsTable } from "@workspace/db/schema";
import { lt, isNotNull, and } from "drizzle-orm";
import { logger } from "../lib/logger";

registerWorker({
  name:             "blocked-ip-cleanup",
  intervalMs:       5 * 60_000,
  clusterSingleton: true,

  async run(): Promise<void> {
    const now = new Date();

    // Purge expired blocked IPs (entries with an expiry set)
    const deletedIps = await db
      .delete(blockedIpsTable)
      .where(and(lt(blockedIpsTable.expiresAt, now), isNotNull(blockedIpsTable.expiresAt)))
      .returning({ ip: blockedIpsTable.ip });

    if (deletedIps.length > 0) {
      logger.info({ purged: deletedIps.length }, "[blocked-ip-cleanup] Purged expired IP blocks");
    }

    // Purge expired terminal job records (C-1 companion cleanup)
    const deletedJobs = await db
      .delete(terminalJobsTable)
      .where(lt(terminalJobsTable.expiresAt, now))
      .returning({ id: terminalJobsTable.id });

    if (deletedJobs.length > 0) {
      logger.info({ purged: deletedJobs.length }, "[blocked-ip-cleanup] Purged expired terminal jobs");
    }
  },
});
