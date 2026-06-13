// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { evaluateDetectionRules } from "./detectionRuleService";

export async function createDetectionTest(input: {
  ruleId?: string | null;
  name: string;
  eventSample: Record<string, unknown>;
  expectedMatch: boolean;
}) {
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO detection_tests
      (id, rule_id, name, event_sample, expected_match)
    VALUES
      (${id}, ${input.ruleId ?? null}, ${input.name}, ${JSON.stringify(input.eventSample)}::jsonb, ${input.expectedMatch})
  `);

  return { id };
}

export async function runDetectionTest(testId: string) {
  const result: any = await db.execute(sql`
    SELECT * FROM detection_tests WHERE id = ${testId} LIMIT 1
  `);

  const test = result.rows?.[0];
  if (!test) throw new Error("Detection test not found");

  const matches = await evaluateDetectionRules({
    id: `test:${test.id}`,
    type: test.event_sample.type,
    subject: test.event_sample.subject,
    payload: test.event_sample.payload ?? {},
  });

  const matched = matches.length > 0;
  const passed = matched === test.expected_match;

  await db.execute(sql`
    UPDATE detection_tests
    SET last_result = ${passed},
        last_run_at = NOW()
    WHERE id = ${testId}
  `);

  return {
    testId,
    expectedMatch: test.expected_match,
    matched,
    passed,
    matchCount: matches.length,
  };
}

export async function runAllDetectionTests() {
  const result: any = await db.execute(sql`
    SELECT id FROM detection_tests ORDER BY created_at ASC
  `);

  const tests = [];

  for (const row of result.rows ?? []) {
    tests.push(await runDetectionTest(row.id));
  }

  return {
    total: tests.length,
    passed: tests.filter((test) => test.passed).length,
    failed: tests.filter((test) => !test.passed).length,
    tests,
  };
}
