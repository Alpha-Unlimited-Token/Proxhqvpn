// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import {
  getNodeConnectionStats,
  recordVpnConnectionEvent,
} from "../repositories/connectionAnalyticsRepository";
import { publishPlatformEvent } from "../lib/event-bus";

export async function registerVpnConnectionEvent(input: {
  userId: string;
  deviceId?: string | null;
  nodeId?: string | null;
  eventType: "connect" | "disconnect" | "failover" | "error";
  region?: string | null;
  latencyMs?: number | null;
  bytesIn?: number | null;
  bytesOut?: number | null;
  metadata?: Record<string, unknown>;
}) {
  const event = await recordVpnConnectionEvent(input);

  await publishPlatformEvent({
    type: `vpn.connection.${input.eventType}`,
    actor: input.userId,
    subject: input.nodeId ?? input.deviceId ?? undefined,
    severity: input.eventType === "error" ? "warn" : "info",
    payload: { eventId: event.id, ...input.metadata },
  });

  return event;
}

export async function getNodeAnalyticsSnapshot(nodeId: string) {
  return getNodeConnectionStats(nodeId, 60);
}
