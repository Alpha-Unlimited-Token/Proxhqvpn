// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function createStatusIncident(input: {
  title: string;
  impact?: "minor" | "major" | "critical";
  summary?: string | null;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO status_incidents
      (id, title, impact, summary)
    VALUES
      (${id}, ${input.title}, ${input.impact ?? "minor"}, ${input.summary ?? null})
  `);

  return { id };
}

export async function listPublicStatus() {
  const components: any = await db.execute(sql`
    SELECT * FROM status_components ORDER BY name ASC
  `);

  const incidents: any = await db.execute(sql`
    SELECT * FROM status_incidents
    WHERE resolved_at IS NULL
    ORDER BY started_at DESC
  `);

  return {
    generatedAt: new Date().toISOString(),
    components: components.rows ?? [],
    incidents: incidents.rows ?? [],
  };
}
