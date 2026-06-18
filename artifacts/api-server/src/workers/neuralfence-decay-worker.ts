// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// NeuralFence™ score decay worker — runs daily to recompute decayed scores.
// As events age, scores naturally drop. IPs that stop attacking are "forgiven" over ~30 days.
import { registerWorker } from "../lib/worker-registry";
import { db } from "@workspace/db";
import { neuralfenceNodesTable } from "@workspace/db/schema";
import { eq, gt } from "drizzle-orm";
import { recomputeScore } from "../lib/neuralfence";
import { logger } from "../lib/logger";

registerWorker({
  name:             "neuralfence-decay",
  intervalMs:       24 * 60 * 60_000,
  clusterSingleton: true,
  enabled:          () => process.env.PROXHQ_ENABLE_NEURALFENCE !== "0",

  async run(): Promise<void> {
    const activeNodes = await db
      .select({ ip: neuralfenceNodesTable.ip })
      .from(neuralfenceNodesTable)
      .where(gt(neuralfenceNodesTable.suspicionScore, 0));

    let downgraded = 0;
    for (const node of activeNodes) {
      try {
        const newScore = await recomputeScore(node.ip);
        const action   = newScore >= 100 ? "hard_block"
                       : newScore >= 75  ? "soft_block"
                       : newScore >= 50  ? "challenge"
                       : newScore >= 25  ? "rate_limit"
                       : "allow";

        await db
          .update(neuralfenceNodesTable)
          .set({
            suspicionScore:  newScore,
            action,
            scoreUpdatedAt:  new Date(),
            actionUpdatedAt: new Date(),
          })
          .where(eq(neuralfenceNodesTable.ip, node.ip));

        if (action === "allow") downgraded++;
      } catch (err) {
        logger.warn({ err, ip: node.ip }, "[NeuralFence] Decay computation failed for IP");
      }
    }

    logger.info({ processed: activeNodes.length, downgraded }, "[NeuralFence] Decay pass complete");
  },
});
