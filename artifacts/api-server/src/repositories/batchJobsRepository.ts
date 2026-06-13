// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { and, eq, notInArray } from "drizzle-orm";
import { db, batchScanJobsTable } from "@workspace/db";

export async function findActiveBatchJobBySourceName(sourceName: string) {
  const [active] = await db
    .select({ id: batchScanJobsTable.id })
    .from(batchScanJobsTable)
    .where(
      and(
        eq(batchScanJobsTable.sourceName, sourceName),
        notInArray(batchScanJobsTable.status, ["cancelled", "failed"]),
      ),
    )
    .limit(1);

  return active ?? null;
}
