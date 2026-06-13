// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import crypto, { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";
import { validateWireGuardPublicKey } from "./wireguardConfigService";

export function hashEnrollmentToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export async function claimNodeEnrollment(input: {
  token: string;
  nodeId: string;
  publicKey: string;
  publicIp?: string | null;
  region?: string | null;
  metadata?: Record<string, unknown>;
}) {
  if (!validateWireGuardPublicKey(input.publicKey)) {
    throw new Error("Invalid WireGuard public key");
  }

  const tokenHash = hashEnrollmentToken(input.token);
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO node_enrollment_claims
      (id, token_hash, node_id, public_key, public_ip, region, metadata)
    VALUES
      (${id}, ${tokenHash}, ${input.nodeId}, ${input.publicKey}, ${input.publicIp ?? null}, ${input.region ?? null}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  await publishPlatformEvent({
    type: "node.enrollment.claimed",
    subject: input.nodeId,
    severity: "info",
    payload: {
      claimId: id,
      publicIp: input.publicIp ?? null,
      region: input.region ?? null,
    },
  });

  return { id, tokenHash };
}
