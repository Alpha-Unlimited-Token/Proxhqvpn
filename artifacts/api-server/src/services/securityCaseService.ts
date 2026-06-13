// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { createInvestigationTimeline } from "./investigationTimelineService";
import { publishPlatformEvent, PlatformEventSeverity } from "../lib/event-bus";

function toEventSeverity(
  s?: "low" | "medium" | "high" | "critical",
): PlatformEventSeverity {
  switch (s) {
    case "critical":
      return "critical";
    case "high":
      return "error";
    case "medium":
      return "warn";
    default:
      return "info";
  }
}

export async function createSecurityCase(input: {
  title: string;
  severity?: "low" | "medium" | "high" | "critical";
  subject?: string | null;
  assignedTo?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();
  const timeline = await createInvestigationTimeline({
    subject: input.subject ?? id,
    title: input.title,
    createdBy: input.createdBy,
  });

  await db.execute(sql`
    INSERT INTO security_cases
      (id, title, severity, subject, assigned_to, timeline_id, metadata, created_by)
    VALUES
      (${id}, ${input.title}, ${input.severity ?? "medium"}, ${input.subject ?? null}, ${input.assignedTo ?? null}, ${timeline.id}, ${JSON.stringify(input.metadata ?? {})}::jsonb, ${input.createdBy ?? null})
  `);

  await publishPlatformEvent({
    type: "security.case.created",
    actor: input.createdBy ?? undefined,
    subject: input.subject ?? id,
    severity: toEventSeverity(input.severity),
    payload: { caseId: id, timelineId: timeline.id },
  });

  return { id, timelineId: timeline.id };
}

export async function updateSecurityCaseStatus(input: {
  caseId: string;
  status: "open" | "investigating" | "contained" | "closed";
}) {
  await db.execute(sql`
    UPDATE security_cases
    SET status = ${input.status},
        updated_at = NOW(),
        closed_at = CASE WHEN ${input.status} = 'closed' THEN NOW() ELSE closed_at END
    WHERE id = ${input.caseId}
  `);

  return { ok: true };
}

export async function listSecurityCases(limit = 100) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM security_cases
    ORDER BY updated_at DESC
    LIMIT ${limit}
  `);

  return result.rows ?? [];
}
