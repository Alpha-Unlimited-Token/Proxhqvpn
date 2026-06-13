// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import crypto from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);

  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }

  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(obj[key])}`)
    .join(",")}}`;
}

function hashAuditRecord(record: any): string {
  const payload = {
    actor: record.actor,
    action: record.action,
    resource: record.resource,
    result: record.result,
    ip: record.ip,
    metadata: record.metadata ?? {},
    previousHash: record.previous_hash ?? null,
    createdAt: record.created_at?.toISOString?.() ?? String(record.created_at),
  };

  return crypto
    .createHash("sha3-256")
    .update(canonicalJson(payload))
    .digest("hex");
}

export type VerifyAuditChainResult =
  | {
      ok: true;
      checkedCount: number;
      firstBrokenId: null;
    }
  | {
      ok: false;
      checkedCount: number;
      firstBrokenId: string;
      reason: string;
      expectedPreviousHash?: string | null;
      actualPreviousHash?: string | null;
      expectedHash?: string;
      actualHash?: string;
    };

export async function verifyAuditChain(
  limit = 10_000,
): Promise<VerifyAuditChainResult> {
  const result: any = await db.execute(sql`
    SELECT *
    FROM audit_chain
    ORDER BY id ASC
    LIMIT ${limit}
  `);

  const rows = result.rows ?? [];
  let previousHash: string | null = null;

  for (const row of rows) {
    if ((row.previous_hash ?? null) !== previousHash) {
      return {
        ok: false,
        checkedCount: rows.indexOf(row),
        firstBrokenId: String(row.id),
        reason: "previous_hash_mismatch",
        expectedPreviousHash: previousHash,
        actualPreviousHash: row.previous_hash ?? null,
      };
    }

    const computedHash = hashAuditRecord(row);

    if (row.hash !== computedHash) {
      return {
        ok: false,
        checkedCount: rows.indexOf(row),
        firstBrokenId: String(row.id),
        reason: "hash_mismatch",
        expectedHash: computedHash,
        actualHash: row.hash,
      };
    }

    previousHash = row.hash;
  }

  return {
    ok: true,
    checkedCount: rows.length,
    firstBrokenId: null,
  };
}

export async function persistAuditChainVerification(
  result: VerifyAuditChainResult,
) {
  await db.execute(sql`
    INSERT INTO audit_chain_verifications
      (checked_count, first_broken_id, ok, details)
    VALUES
      (${result.checkedCount}, ${result.firstBrokenId}, ${result.ok}, ${JSON.stringify(result)}::jsonb)
  `);
}
