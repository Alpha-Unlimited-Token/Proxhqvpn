// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";
import { quarantineNode } from "./nodeQuarantineService";
import { registerDeviceRevoked } from "./deviceLifecycleService";

export async function containTarget(input: {
  targetType: "node" | "device" | "user";
  targetId: string;
  actionType: "quarantine" | "revoke_device" | "flag_user";
  reason: string;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();

  if (input.targetType === "node" && input.actionType === "quarantine") {
    await quarantineNode({
      nodeId: input.targetId,
      reason: input.reason,
      metadata: input.metadata,
    });
  }

  if (input.targetType === "device" && input.actionType === "revoke_device") {
    await registerDeviceRevoked({
      userId: String(input.metadata?.userId ?? "unknown"),
      deviceId: input.targetId,
      reason: input.reason,
    });
  }

  await db.execute(sql`
    INSERT INTO containment_actions
      (id, target_type, target_id, action_type, reason, metadata, created_by)
    VALUES
      (${id}, ${input.targetType}, ${input.targetId}, ${input.actionType}, ${input.reason}, ${JSON.stringify(input.metadata ?? {})}::jsonb, ${input.createdBy ?? null})
  `);

  await publishPlatformEvent({
    type: "containment.action.executed",
    subject: input.targetId,
    severity: "critical",
    payload: {
      containmentId: id,
      targetType: input.targetType,
      actionType: input.actionType,
      reason: input.reason,
    },
  });

  return { id };
}
