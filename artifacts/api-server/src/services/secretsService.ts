// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function registerSecretReference(input: {
  name: string;
  provider?: "env" | "vault" | "aws" | "gcp" | "azure";
  reference: string;
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO secret_references
      (id, name, provider, reference, metadata)
    VALUES
      (${id}, ${input.name}, ${input.provider ?? "env"}, ${input.reference}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
    ON CONFLICT (name)
    DO UPDATE SET
      provider = EXCLUDED.provider,
      reference = EXCLUDED.reference,
      metadata = EXCLUDED.metadata
  `);

  return { id };
}

export async function resolveSecret(name: string) {
  const result: any = await db.execute(sql`
    SELECT * FROM secret_references
    WHERE name = ${name}
    LIMIT 1
  `);

  const ref = result.rows?.[0];
  if (!ref) return null;

  if (ref.provider === "env") {
    return process.env[ref.reference] ?? null;
  }

  throw new Error(`Secret provider not implemented yet: ${ref.provider}`);
}
