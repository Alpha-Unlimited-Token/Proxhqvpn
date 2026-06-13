// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { logger } from "./logger";

export type WorkerDefinition = {
  name: string;
  intervalMs: number;
  enabled?: () => boolean;
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
