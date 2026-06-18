// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// X-1: Signed outbound webhooks for user-facing alerts (canary, dark web, beacon).

import crypto from "crypto";
import { db } from "@workspace/db";
import { userAlertWebhooksTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";

export interface UserWebhookPayload {
  event:  string;
  ts:     string;
  userId: string;
  data:   Record<string, unknown>;
}

/**
 * Deliver a signed webhook payload to a single endpoint.
 * Returns true on success, false after 3 failed attempts.
 */
export async function fireUserWebhook(
  webhookUrl:    string,
  signingSecret: string,
  payload:       UserWebhookPayload,
): Promise<boolean> {
  const body      = JSON.stringify(payload);
  const signature = crypto
    .createHmac("sha256", signingSecret)
    .update(body)
    .digest("hex");

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const resp = await fetch(webhookUrl, {
        method:  "POST",
        headers: {
          "content-type":          "application/json",
          "x-proxhqvpn-signature": `sha256=${signature}`,
          "x-proxhqvpn-event":     payload.event,
          "user-agent":            "ProxhqVPN-Webhook/1.0",
        },
        body,
        signal: AbortSignal.timeout(5000),
      });
      if (resp.ok) return true;
      logger.warn({ status: resp.status, url: webhookUrl, attempt }, "[user-webhook] Delivery failed");
    } catch (err) {
      logger.warn({ err, url: webhookUrl, attempt }, "[user-webhook] Delivery threw");
    }
    if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
  }
  return false;
}

/**
 * Fan out an alert event to all matching webhooks for a user.
 * Call this whenever canary.triggered, darkweb.breach, or beacon.alert fires.
 */
export async function dispatchUserAlertWebhooks(
  userId:    string,
  eventName: string,
  data:      Record<string, unknown>,
): Promise<void> {
  const webhooks = await db
    .select()
    .from(userAlertWebhooksTable)
    .where(eq(userAlertWebhooksTable.userId, userId));

  const payload: UserWebhookPayload = {
    event:  eventName,
    ts:     new Date().toISOString(),
    userId,
    data,
  };

  for (const wh of webhooks) {
    if (!wh.enabled) continue;
    const subscribedEvents = (wh.events as unknown as string[]) ?? [];
    if (!subscribedEvents.includes(eventName)) continue;

    const ok = await fireUserWebhook(wh.url, wh.secret, payload);
    if (ok) {
      await db
        .update(userAlertWebhooksTable)
        .set({
          lastFired: new Date(),
          fireCount: sql`${userAlertWebhooksTable.fireCount} + 1`,
        })
        .where(eq(userAlertWebhooksTable.id, wh.id));
    }
  }
}
