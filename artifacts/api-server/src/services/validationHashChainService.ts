// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// SHA3-256 hash chain for continuous validation runs.
// Every validation result is chained so tampering is detectable.
import crypto from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.keys(v).sort().reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = v[key];
        return acc;
      }, {});
    }
    return v;
  });
}

export function hashValidationRun(payload: {
  runId: string;
  targetId: string | null;
  runType: string;
  toolName: string;
  status: string;
  score: number;
  startedAt: string;
  summary: string | null;
  previousHash: string;
}): string {
  const canonical = canonicalJson(payload);
  try {
    return crypto.createHash("sha3-256").update(canonical, "utf8").digest("hex");
  } catch {
    return crypto.createHash("sha256").update(canonical, "utf8").digest("hex");
  }
}

export async function getLatestValidationHash(): Promise<string> {
  const rows = await db.execute(sql`
    SELECT result_hash FROM validation_runs
    ORDER BY started_at DESC
    LIMIT 1
  `).catch(() => ({ rows: [] }));

  const r = (rows as { rows: { result_hash?: string }[] }).rows[0];
  return r?.result_hash ?? "GENESIS";
}

export async function createValidationHash(input: {
  runId: string;
  targetId: string | null;
  runType: string;
  toolName: string;
  status: string;
  score: number;
  startedAt: string;
  summary: string | null;
}): Promise<{ hash: string; previousHash: string }> {
  const previousHash = await getLatestValidationHash();
  const hash = hashValidationRun({ ...input, previousHash });
  return { hash, previousHash };
}
