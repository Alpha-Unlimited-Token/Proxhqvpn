// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { and, eq, lt, sql } from "drizzle-orm";
import { db, vpngateNodeSessionsTable } from "@workspace/db";

export async function findStaleNodeSessions(cutoff: Date) {
  return db
    .select()
    .from(vpngateNodeSessionsTable)
    .where(
      and(
        sql`status IN ('pending_connect', 'pending_disconnect')`,
        lt(vpngateNodeSessionsTable.updatedAt, cutoff),
      ),
    );
}

export async function markNodeSessionError(input: {
  sessionId: string;
  errorMessage: string;
}) {
  return db
    .update(vpngateNodeSessionsTable)
    .set({
      status: "error",
      errorMessage: input.errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(vpngateNodeSessionsTable.id, input.sessionId));
}
