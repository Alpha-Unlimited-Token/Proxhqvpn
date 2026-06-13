// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";

export async function registerDeploymentEnvironment(input: {
  name: string;
  color: "blue" | "green";
  version: string;
  status?: "active" | "standby" | "draining" | "failed";
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO deployment_environments
      (id, name, color, version, status)
    VALUES
      (${id}, ${input.name}, ${input.color}, ${input.version}, ${input.status ?? "standby"})
    ON CONFLICT (name)
    DO UPDATE SET
      color = EXCLUDED.color,
      version = EXCLUDED.version,
      status = EXCLUDED.status,
      updated_at = NOW()
  `);

  return { id };
}

export async function promoteDeploymentEnvironment(name: string) {
  await db.execute(sql`
    UPDATE deployment_environments
    SET status = CASE WHEN name = ${name} THEN 'active' ELSE 'standby' END,
        updated_at = NOW()
  `);

  await publishPlatformEvent({
    type: "deployment.promoted",
    subject: name,
    severity: "warn",
    payload: { strategy: "blue_green" },
  });

  return { ok: true };
}
