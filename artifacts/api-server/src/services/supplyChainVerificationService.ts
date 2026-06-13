// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import crypto, { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export function sha256Artifact(content: string | Buffer) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

export async function registerSupplyChainArtifact(input: {
  artifactName: string;
  artifactType: "package" | "container" | "binary" | "script" | "config";
  version?: string | null;
  content?: string | Buffer;
  sha256?: string;
  sourceUri?: string | null;
  verified?: boolean;
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();
  const sha256 = input.sha256 ?? sha256Artifact(input.content ?? "");

  await db.execute(sql`
    INSERT INTO supply_chain_artifacts
      (id, artifact_name, artifact_type, version, sha256, source_uri, verified, metadata)
    VALUES
      (${id}, ${input.artifactName}, ${input.artifactType}, ${input.version ?? null}, ${sha256}, ${input.sourceUri ?? null}, ${input.verified ?? false}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  return { id, sha256 };
}

export async function verifyArtifactHash(input: {
  expectedSha256: string;
  content: string | Buffer;
}) {
  const actualSha256 = sha256Artifact(input.content);

  return {
    ok: actualSha256 === input.expectedSha256,
    expectedSha256: input.expectedSha256,
    actualSha256,
  };
}
