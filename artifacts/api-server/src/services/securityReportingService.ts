// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

export async function generateSecurityOperationsReport(input: {
  days?: number;
}) {
  const days = input.days ?? 7;

  const result: any = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM security_events WHERE created_at >= NOW() - (${days} || ' days')::interval) AS security_events,
      (SELECT COUNT(*)::int FROM security_alerts WHERE created_at >= NOW() - (${days} || ' days')::interval) AS alerts_created,
      (SELECT COUNT(*)::int FROM security_cases WHERE created_at >= NOW() - (${days} || ' days')::interval) AS cases_created,
      (SELECT COUNT(*)::int FROM ioc_correlations WHERE created_at >= NOW() - (${days} || ' days')::interval) AS ioc_matches,
      (SELECT COUNT(*)::int FROM containment_actions WHERE created_at >= NOW() - (${days} || ' days')::interval) AS containment_actions
  `);

  return {
    generatedAt: new Date().toISOString(),
    periodDays: days,
    metrics: result.rows?.[0] ?? {},
  };
}
