// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { publishPlatformEvent } from "../lib/event-bus";
import {
  listDeviceLifecycleEvents,
  recordDeviceLifecycleEvent,
} from "../repositories/deviceLifecycleRepository";

export async function registerDeviceActivated(input: {
  userId: string;
  deviceId: string;
  metadata?: Record<string, unknown>;
}) {
  const event = await recordDeviceLifecycleEvent({
    userId: input.userId,
    deviceId: input.deviceId,
    eventType: "device.activated",
    status: "active",
    metadata: input.metadata,
  });

  await publishPlatformEvent({
    type: "device.activated",
    actor: input.userId,
    subject: input.deviceId,
    severity: "info",
    payload: { eventId: event.id, ...input.metadata },
  });

  return event;
}

export async function registerDeviceRevoked(input: {
  userId: string;
  deviceId: string;
  reason?: string;
}) {
  const event = await recordDeviceLifecycleEvent({
    userId: input.userId,
    deviceId: input.deviceId,
    eventType: "device.revoked",
    status: "revoked",
    metadata: { reason: input.reason ?? null },
  });

  await publishPlatformEvent({
    type: "device.revoked",
    actor: input.userId,
    subject: input.deviceId,
    severity: "warn",
    payload: { eventId: event.id, reason: input.reason ?? null },
  });

  return event;
}

export async function getDeviceLifecycleTimeline(input: {
  userId: string;
  deviceId: string;
}) {
  return listDeviceLifecycleEvents({
    userId: input.userId,
    deviceId: input.deviceId,
    limit: 100,
  });
}
