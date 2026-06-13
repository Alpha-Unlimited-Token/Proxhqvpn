// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { registerWorker } from "../lib/worker-registry";
import { applyDueMaintenanceWindows } from "../services/nodeMaintenanceService";
import { logger } from "../lib/logger";

registerWorker({
  name: "node-maintenance-worker",
  intervalMs: 60_000,
  enabled: () => process.env.PROXHQ_ENABLE_NODE_MAINTENANCE_WORKER !== "0",
  async run() {
    const result = await applyDueMaintenanceWindows();
    logger.info(result, "Node maintenance windows processed");
  },
});
