// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import crypto, { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { addInvestigationTimelineEvent } from "./investigationTimelineService";

export function hashEvidenceBuffer(buffer: Buffer | string) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

export async function addCaseEvidence(input: {
  caseId: string;
  timelineId?: string | null;
  evidenceType: string;
  title: string;
  content?: string | Buffer;
  sha256?: string;
  storageUri?: string | null;
  metadata?: Record<string, unknown>;
  addedBy?: string | null;
}) {
  const id = randomUUID();
  const sha256 =
    input.sha256 ??
    hashEvidenceBuffer(input.content ?? JSON.stringify(input.metadata ?? {}));

  await db.execute(sql`
    INSERT INTO case_evidence
      (id, case_id, evidence_type, title, sha256, storage_uri, metadata, added_by)
    VALUES
      (${id}, ${input.caseId}, ${input.evidenceType}, ${input.title}, ${sha256}, ${input.storageUri ?? null}, ${JSON.stringify(input.metadata ?? {})}::jsonb, ${input.addedBy ?? null})
  `);

  if (input.timelineId) {
    await addInvestigationTimelineEvent({
      timelineId: input.timelineId,
      eventType: "evidence.added",
      title: input.title,
      metadata: {
        evidenceId: id,
        evidenceType: input.evidenceType,
        sha256,
      },
    });
  }

  return { id, sha256 };
}

export async function listCaseEvidence(caseId: string) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM case_evidence
    WHERE case_id = ${caseId}
    ORDER BY created_at DESC
  `);

  return result.rows ?? [];
}
