// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { evaluateAllActiveNodes } from "../services/nodeLifecycleService";
import { logger } from "../lib/logger";
import { registerWorker } from "../lib/worker-registry";

registerWorker({
  name: "node-lifecycle-worker-v2",
  intervalMs: 60_000,
  enabled: () => process.env.PROXHQ_ENABLE_NODE_LIFECYCLE_V2 !== "0",
  async run() {
    const results = await evaluateAllActiveNodes();

    logger.info(
      { evaluated: results.length },
      "Node lifecycle evaluation completed",
    );
  },
});
