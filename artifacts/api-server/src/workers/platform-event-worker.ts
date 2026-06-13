// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import {
  listUnprocessedPlatformEvents,
  markPlatformEventProcessed,
} from "../lib/event-bus";
import { logger } from "../lib/logger";
import { registerWorker } from "../lib/worker-registry";

async function processEvent(event: any) {
  logger.info(
    {
      eventId: event.id,
      type: event.type,
      severity: event.severity,
    },
    "Processing platform event",
  );

  await markPlatformEventProcessed(event.id);
}

registerWorker({
  name: "platform-event-worker",
  intervalMs: 5_000,
  enabled: () => process.env.PROXHQ_ENABLE_PLATFORM_EVENT_WORKER !== "0",
  async run() {
    const events = await listUnprocessedPlatformEvents(100);

    for (const event of events) {
      await processEvent(event);
    }
  },
});
