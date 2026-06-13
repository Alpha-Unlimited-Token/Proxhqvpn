// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { writeAuditEvent } from "../repositories/auditRepository";
import { recordWireGuardKeyRotation } from "../repositories/wireguardKeyRotationRepository";

export async function registerWireGuardKeyRotation(input: {
  userId: string;
  deviceId: string;
  oldFingerprint?: string | null;
  newFingerprint: string;
}) {
  const event = await recordWireGuardKeyRotation(input);

  await writeAuditEvent({
    actor: input.userId,
    action: "wireguard.key.rotated",
    resource: `device:${input.deviceId}`,
    result: "allow",
    metadata: {
      rotationId: event.id,
      oldFingerprint: input.oldFingerprint ?? null,
      newFingerprint: input.newFingerprint,
    },
  });

  return event;
}
