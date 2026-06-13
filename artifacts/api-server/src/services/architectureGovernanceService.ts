// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function recordArchitectureDecision(input: {
  title: string;
  status?: "proposed" | "accepted" | "deprecated" | "superseded";
  context?: string | null;
  decision: string;
  consequences?: string | null;
  owner?: string | null;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO architecture_decisions
      (id, title, status, context, decision, consequences, owner)
    VALUES
      (${id}, ${input.title}, ${input.status ?? "proposed"}, ${input.context ?? null}, ${input.decision}, ${input.consequences ?? null}, ${input.owner ?? null})
  `);

  return { id };
}

export async function listArchitectureDecisions() {
  const result: any = await db.execute(sql`
    SELECT *
    FROM architecture_decisions
    ORDER BY created_at DESC
  `);

  return result.rows ?? [];
}
