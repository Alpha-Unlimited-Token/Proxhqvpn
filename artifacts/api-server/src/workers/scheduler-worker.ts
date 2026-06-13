// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { claimDueTasks, completeTask, failTask } from "../lib/scheduler";
import { publishPlatformEvent } from "../lib/event-bus";
import { logger } from "../lib/logger";
import { registerWorker } from "../lib/worker-registry";

registerWorker({
  name: "scheduler-worker",
  intervalMs: 10_000,
  enabled: () => process.env.PROXHQ_ENABLE_SCHEDULER_WORKER !== "0",
  async run() {
    const tasks = await claimDueTasks(25);

    for (const task of tasks) {
      try {
        await publishPlatformEvent({
          type: `scheduled.${task.task_type}`,
          subject: task.id,
          severity: "info",
          payload: task.payload ?? {},
        });

        await completeTask(task.id);
      } catch (err: any) {
        logger.error({ err, taskId: task.id }, "Scheduled task failed");
        await failTask(task, err?.message ?? "Scheduled task failed");
      }
    }
  },
});
