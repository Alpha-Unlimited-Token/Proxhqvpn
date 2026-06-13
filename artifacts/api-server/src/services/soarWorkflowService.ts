// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";

export async function createSoarWorkflow(input: {
  name: string;
  triggerType: string;
  steps: Array<Record<string, unknown>>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO soar_workflows (id, name, trigger_type, steps)
    VALUES (${id}, ${input.name}, ${input.triggerType}, ${JSON.stringify(input.steps)}::jsonb)
  `);

  return { id };
}

export async function runSoarWorkflowsForEvent(event: {
  id: string;
  type: string;
  payload?: Record<string, unknown>;
}) {
  const result: any = await db.execute(sql`
    SELECT * FROM soar_workflows
    WHERE enabled = TRUE AND trigger_type = ${event.type}
  `);

  const runs = [];

  for (const workflow of result.rows ?? []) {
    const runId = randomUUID();

    await db.execute(sql`
      INSERT INTO soar_workflow_runs
        (id, workflow_id, trigger_event_id, context)
      VALUES
        (${runId}, ${workflow.id}, ${event.id}, ${JSON.stringify({
          event,
          steps: workflow.steps,
        })}::jsonb)
    `);

    await publishPlatformEvent({
      type: "soar.workflow.started",
      subject: runId,
      severity: "info",
      payload: { workflowId: workflow.id, triggerEventId: event.id },
    });

    runs.push({ runId, workflowId: workflow.id });
  }

  return { runs };
}
