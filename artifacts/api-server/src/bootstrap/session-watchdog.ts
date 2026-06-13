// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { and, eq, lt, sql } from "drizzle-orm";
import { db, vpngateNodeSessionsTable } from "@workspace/db";
import { logger } from "../lib/logger";

async function timeoutStaleSessions(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000);

    const stale = await db
      .select()
      .from(vpngateNodeSessionsTable)
      .where(
        and(
          sql`status IN ('pending_connect', 'pending_disconnect')`,
          lt(vpngateNodeSessionsTable.updatedAt, cutoff),
        ),
      );

    for (const session of stale) {
      await db
        .update(vpngateNodeSessionsTable)
        .set({
          status: "error",
          errorMessage:
            "Node daemon not responding. Ensure proxhqd.py is running on the node server with DAEMON_PSK configured and can reach this API.",
          updatedAt: new Date(),
        })
        .where(eq(vpngateNodeSessionsTable.id, session.id));

      logger.warn(
        { sessionId: session.id, nodeId: session.nodeId },
        "Double-hop session timed out",
      );
    }
  } catch (err) {
    logger.warn({ err }, "Session watchdog error");
  }
}

export function startSessionWatchdog(): void {
  if (process.env.PROXHQ_ENABLE_SESSION_WATCHDOG === "0") {
    logger.info("Session watchdog disabled");
    return;
  }

  void timeoutStaleSessions();
  setInterval(() => void timeoutStaleSessions(), 30_000);

  logger.info("Session watchdog started");
}
