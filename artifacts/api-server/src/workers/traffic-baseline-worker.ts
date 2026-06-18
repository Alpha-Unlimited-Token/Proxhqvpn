// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// C-7: Hourly traffic baseline update — rolling EMA per node/metric for anomaly detection.
import { registerWorker } from "../lib/worker-registry";
import { db } from "@workspace/db";
import { networkTrafficBaselineTable, nodesTable, blockedIpsTable, beaconAlertsTable } from "@workspace/db/schema";
import { eq, and, gte, count, ne } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger";

registerWorker({
  name:             "traffic-baseline",
  intervalMs:       60 * 60_000,
  clusterSingleton: true,
  enabled:          () => process.env.PROXHQ_ENABLE_TRAFFIC_BASELINE !== "0",

  async run(): Promise<void> {
    const now      = new Date();
    const hoursSinceMonday = (now.getDay() === 0 ? 6 : now.getDay() - 1) * 24 + now.getHours();
    const hourOfWeek = Math.min(167, Math.max(0, hoursSinceMonday));
    const oneHourAgo = new Date(now.getTime() - 60 * 60_000);

    const activeNodes = await db
      .select({ id: nodesTable.id })
      .from(nodesTable)
      .where(ne(nodesTable.status, "inactive"));

    let updated = 0;

    for (const node of activeNodes) {
      // Metric: blocked_per_hour
      const [blockResult] = await db
        .select({ cnt: count() })
        .from(blockedIpsTable)
        .where(gte(blockedIpsTable.blockedAt, oneHourAgo));

      const [beaconResult] = await db
        .select({ cnt: count() })
        .from(beaconAlertsTable)
        .where(gte(beaconAlertsTable.detectedAt, oneHourAgo));

      const metrics: Array<{ metric: string; value: number }> = [
        { metric: "blocked_per_hour",  value: blockResult?.cnt  ?? 0 },
        { metric: "beacons_per_hour",  value: beaconResult?.cnt ?? 0 },
      ];

      for (const { metric, value } of metrics) {
        const [existing] = await db
          .select()
          .from(networkTrafficBaselineTable)
          .where(and(
            eq(networkTrafficBaselineTable.nodeId, node.id),
            eq(networkTrafficBaselineTable.metric, metric),
            eq(networkTrafficBaselineTable.hourOfWeek, hourOfWeek),
          ));

        if (existing) {
          // Exponential moving average: new = 0.9 * old + 0.1 * current
          const newBaseline = 0.9 * existing.baselineValue + 0.1 * value;
          const delta       = value - existing.baselineValue;
          const newStddev   = Math.sqrt(0.9 * existing.stddevValue ** 2 + 0.1 * delta ** 2);

          await db
            .update(networkTrafficBaselineTable)
            .set({
              baselineValue: newBaseline,
              stddevValue:   newStddev,
              sampleCount:   sql`${networkTrafficBaselineTable.sampleCount} + 1`,
              lastUpdated:   now,
            })
            .where(eq(networkTrafficBaselineTable.id, existing.id));

          // 3-sigma anomaly alert
          if (existing.sampleCount >= 7 && value > existing.baselineValue + 3 * existing.stddevValue) {
            logger.warn(
              { nodeId: node.id, metric, value, baseline: existing.baselineValue, stddev: existing.stddevValue },
              "[traffic-baseline] 3-sigma anomaly detected",
            );
          }
        } else {
          await db.insert(networkTrafficBaselineTable).values({
            nodeId:        node.id,
            metric,
            hourOfWeek,
            baselineValue: value,
            stddevValue:   0,
            sampleCount:   1,
          }).onConflictDoNothing();
        }

        updated++;
      }
    }

    logger.info({ nodes: activeNodes.length, metricsUpdated: updated }, "[traffic-baseline] Baseline update complete");
  },
});
