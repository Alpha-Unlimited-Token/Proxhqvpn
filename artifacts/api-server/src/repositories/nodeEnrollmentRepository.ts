// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { sql } from "drizzle-orm";
import { db } from "@workspace/db";

export async function insertNodeEnrollmentToken(input: {
  tokenHash: string;
  createdBy: string;
  region: string | null;
  expiresAt: Date;
}) {
  return db.execute(
    sql`INSERT INTO node_enrollment_tokens (token_hash, created_by, region, expires_at)
        VALUES (${input.tokenHash}, ${input.createdBy}, ${input.region}, ${input.expiresAt.toISOString()})`,
  );
}
