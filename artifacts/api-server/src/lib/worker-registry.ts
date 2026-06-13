// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { logger } from "./logger";
import { acquireClusterLock } from "./clusterLock";

export type WorkerDefinition = {
  name: string;
  intervalMs: number;
  enabled?: () => boolean;
  clusterSingleton?: boolean;
  run: () => Promise<void>;
};

const workers: WorkerDefinition[] = [];

export function registerWorker(worker: WorkerDefinition) {
  workers.push(worker);
}

export function startRegisteredWorkers() {
  for (const worker of workers) {
    if (worker.enabled && !worker.enabled()) {
      logger.info({ worker: worker.name }, "Worker disabled");
      continue;
    }

    const runOnce = async () => {
      try {
        if (worker.clusterSingleton) {
          const acquired = await acquireClusterLock({
            key: `worker:${worker.name}`,
            ttlMs: Math.max(worker.intervalMs * 2, 60_000),
          });

          if (!acquired) return;
        }

        await worker.run();
      } catch (err) {
        logger.error({ err, worker: worker.name }, "Worker failed");
      }
    };

    void runOnce();
    setInterval(() => void runOnce(), worker.intervalMs);

    logger.info(
      { worker: worker.name, intervalMs: worker.intervalMs },
      "Worker started",
    );
  }
}
