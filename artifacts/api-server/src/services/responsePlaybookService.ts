// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function createResponsePlaybook(input: {
  name: string;
  description?: string | null;
  severity?: "low" | "medium" | "high" | "critical";
  actions: Array<Record<string, unknown>>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO response_playbooks
      (id, name, description, severity, actions)
    VALUES
      (${id}, ${input.name}, ${input.description ?? null}, ${input.severity ?? "medium"}, ${JSON.stringify(input.actions)}::jsonb)
  `);

  return { id };
}

export async function listEnabledResponsePlaybooks() {
  const result: any = await db.execute(sql`
    SELECT * FROM response_playbooks
    WHERE enabled = TRUE
    ORDER BY severity DESC, created_at DESC
  `);

  return result.rows ?? [];
}
