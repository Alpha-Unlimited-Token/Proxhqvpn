// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { signWithManagedKey } from "./hardwareKeyService";

export async function createBuildAttestation(input: {
  buildId: string;
  commitSha?: string | null;
  artifactSha256: string;
  attestation: Record<string, unknown>;
}) {
  const id = randomUUID();

  const signed = await signWithManagedKey({
    payload: JSON.stringify({
      buildId: input.buildId,
      commitSha: input.commitSha ?? null,
      artifactSha256: input.artifactSha256,
      attestation: input.attestation,
    }),
  });

  await db.execute(sql`
    INSERT INTO build_attestations
      (id, build_id, commit_sha, artifact_sha256, attestation, signature)
    VALUES
      (${id}, ${input.buildId}, ${input.commitSha ?? null}, ${input.artifactSha256}, ${JSON.stringify(input.attestation)}::jsonb, ${signed.signature})
  `);

  return { id, signature: signed.signature };
}
