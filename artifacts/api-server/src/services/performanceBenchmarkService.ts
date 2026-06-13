// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function recordPerformanceBenchmark(input: {
  benchmarkName: string;
  target: string;
  result: Record<string, unknown>;
  score: number;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO performance_benchmark_runs
      (id, benchmark_name, target, result, score)
    VALUES
      (${id}, ${input.benchmarkName}, ${input.target}, ${JSON.stringify(input.result)}::jsonb, ${input.score})
  `);

  return { id };
}

export async function listRecentBenchmarks(limit = 50) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM performance_benchmark_runs
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  return result.rows ?? [];
}
