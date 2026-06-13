// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function createGdprRequest(input: {
  userId?: string | null;
  email?: string | null;
  requestType: "access" | "delete" | "export" | "rectify";
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO privacy_requests
      (id, user_id, email, request_type, regulation, metadata)
    VALUES
      (${id}, ${input.userId ?? null}, ${input.email ?? null}, ${input.requestType}, 'GDPR', ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  return { id };
}

export async function completePrivacyRequest(requestId: string) {
  await db.execute(sql`
    UPDATE privacy_requests
    SET status = 'completed',
        completed_at = NOW()
    WHERE id = ${requestId}
  `);

  return { ok: true };
}
