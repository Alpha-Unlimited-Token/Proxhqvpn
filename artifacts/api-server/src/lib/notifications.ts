// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Centralized notification insertion helper — used by workers and route handlers.

import { db } from "@workspace/db";
import { notificationsTable } from "@workspace/db";
import { logger } from "./logger";
import { broadcastToUser } from "./sse-event-bus";

export type NotificationCategory = "payment" | "security" | "vpn" | "system" | "compliance";

export interface InsertNotificationOpts {
  userId:    string;
  type:      string;
  title:     string;
  body:      string;
  category?: NotificationCategory;
  data?:     Record<string, unknown>;
}

/**
 * Insert a notification and SSE-push it to the user if they are connected.
 * Never throws — all errors are logged and swallowed so callers never fail
 * just because a notification couldn't be written.
 */
export async function insertNotification(opts: InsertNotificationOpts): Promise<void> {
  try {
    const [row] = await db
      .insert(notificationsTable)
      .values({
        userId:   opts.userId,
        type:     opts.type,
        title:    opts.title,
        body:     opts.body,
        category: opts.category ?? "system",
        data:     opts.data ?? {},
      } as typeof notificationsTable.$inferInsert)
      .returning({ id: notificationsTable.id });

    // Push to any open SSE connections for this user
    broadcastToUser(opts.userId, {
      type:    "notification",
      payload: {
        id:       row?.id,
        type:     opts.type,
        title:    opts.title,
        body:     opts.body,
        category: opts.category ?? "system",
        data:     opts.data ?? {},
      },
    });
  } catch (err) {
    logger.error({ err, type: opts.type, userId: opts.userId }, "[notifications] Failed to insert notification");
  }
}

/**
 * Broadcast a security notification to ALL admin users currently connected via SSE.
 * Does NOT write to the DB — use insertNotification() for per-user persistence.
 */
export function broadcastAdminSecurityNotification(opts: {
  type:     string;
  title:    string;
  body:     string;
  severity: "low" | "medium" | "high" | "critical";
  data?:    Record<string, unknown>;
}): void {
  const { broadcastSecurityEvent } = require("./sse-event-bus") as typeof import("./sse-event-bus");
  broadcastSecurityEvent({
    type:      opts.type,
    severity:  opts.severity,
    payload:   { title: opts.title, body: opts.body, ...(opts.data ?? {}) },
    adminOnly: true,
  });
}
