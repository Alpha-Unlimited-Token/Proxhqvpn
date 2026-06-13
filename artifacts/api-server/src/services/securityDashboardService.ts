// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { listOpenSecurityAlerts } from "./alertPrioritizationService";

export async function getSecurityDashboardSnapshot() {
  const counts: any = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM security_events WHERE created_at >= NOW() - INTERVAL '24 hours') AS security_events_24h,
      (SELECT COUNT(*)::int FROM security_alerts WHERE status = 'open') AS open_alerts,
      (SELECT COUNT(*)::int FROM security_cases WHERE status <> 'closed') AS open_cases,
      (SELECT COUNT(*)::int FROM threat_intel_indicators) AS indicators,
      (SELECT COUNT(*)::int FROM ioc_correlations WHERE created_at >= NOW() - INTERVAL '24 hours') AS ioc_matches_24h
  `);

  const topAlerts = await listOpenSecurityAlerts(10);

  return {
    generatedAt: new Date().toISOString(),
    counts: counts.rows?.[0] ?? {},
    topAlerts,
  };
}
