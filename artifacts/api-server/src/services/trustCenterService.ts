// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function publishTrustCenterDocument(input: {
  title: string;
  documentType: "soc2" | "iso27001" | "privacy" | "security" | "subprocessor";
  storageUri?: string | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO trust_center_documents
      (id, title, document_type, storage_uri, summary, metadata)
    VALUES
      (${id}, ${input.title}, ${input.documentType}, ${input.storageUri ?? null}, ${input.summary ?? null}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  return { id };
}

export async function listPublishedTrustCenterDocuments() {
  const result: any = await db.execute(sql`
    SELECT id, title, document_type, summary, published_at
    FROM trust_center_documents
    WHERE status = 'published'
    ORDER BY published_at DESC
  `);

  return result.rows ?? [];
}
