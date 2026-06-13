// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { db } from "@workspace/db";
import { wireguardConfigFingerprintsTable } from "@workspace/db/schema";

export type SaveWireGuardConfigFingerprintInput = {
  userId: string;
  deviceId: string;
  fingerprint: string;
  peerCount: number;
};

export async function saveWireGuardConfigFingerprint(
  input: SaveWireGuardConfigFingerprintInput,
) {
  return db.insert(wireguardConfigFingerprintsTable).values({
    userId: input.userId,
    deviceId: input.deviceId,
    fingerprint: input.fingerprint,
    peerCount: input.peerCount,
  });
}
