// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";

export async function createStaticIpAssignment(input: {
  userId: string;
  ipAddress: string;
  deviceId?: string | null;
  assignmentType: "dedicated" | "reserved" | "manual";
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO static_ip_assignments
      (id, user_id, device_id, ip_address, assignment_type, metadata)
    VALUES
      (${id}, ${input.userId}, ${input.deviceId ?? null}, ${input.ipAddress}, ${input.assignmentType}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  await publishPlatformEvent({
    type: "static_ip.assigned",
    actor: input.userId,
    subject: input.deviceId ?? input.ipAddress,
    severity: "info",
    payload: {
      assignmentId: id,
      ipAddress: input.ipAddress,
      assignmentType: input.assignmentType,
    },
  });

  return { id };
}

export async function listStaticIpAssignments(userId: string) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM static_ip_assignments
    WHERE user_id = ${userId}
      AND status = 'active'
    ORDER BY created_at DESC
  `);

  return result.rows ?? [];
}

export async function revokeStaticIpAssignment(input: {
  assignmentId: string;
  userId: string;
  reason?: string;
}) {
  await db.execute(sql`
    UPDATE static_ip_assignments
    SET status = 'revoked',
        revoked_at = NOW(),
        metadata = metadata || ${JSON.stringify({ revokeReason: input.reason ?? null })}::jsonb
    WHERE id = ${input.assignmentId}
      AND user_id = ${input.userId}
  `);

  await publishPlatformEvent({
    type: "static_ip.revoked",
    actor: input.userId,
    subject: input.assignmentId,
    severity: "warn",
    payload: { reason: input.reason ?? null },
  });

  return { ok: true };
}
