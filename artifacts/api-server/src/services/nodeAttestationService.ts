// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import crypto, { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";
import { quarantineNode } from "./nodeQuarantineService";

function fingerprintPayload(payload: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(payload))
    .digest("hex");
}

export async function recordNodeAttestation(input: {
  nodeId: string;
  attestationType: string;
  result: "pass" | "fail" | "unknown";
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();
  const fingerprint = fingerprintPayload(input.metadata ?? {});

  await db.execute(sql`
    INSERT INTO node_attestations
      (id, node_id, attestation_type, fingerprint, result, metadata)
    VALUES
      (${id}, ${input.nodeId}, ${input.attestationType}, ${fingerprint}, ${input.result}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  await publishPlatformEvent({
    type: `node.attestation.${input.result}`,
    subject: input.nodeId,
    severity: input.result === "fail" ? "critical" : "info",
    payload: { id, attestationType: input.attestationType },
  });

  if (input.result === "fail") {
    await quarantineNode({
      nodeId: input.nodeId,
      reason: `Failed attestation: ${input.attestationType}`,
      metadata: { attestationId: id },
    });
  }

  return { id, fingerprint };
}
