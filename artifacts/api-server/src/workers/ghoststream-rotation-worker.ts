// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// GhostStream™ profile rotation worker — rotates expired sessions proactively.
import { registerWorker } from "../lib/worker-registry";
import { getExpiredSessions, rotateGhostStreamProfile } from "../lib/ghoststream";
import { logger } from "../lib/logger";

registerWorker({
  name:             "ghoststream-rotation",
  intervalMs:       30_000,
  clusterSingleton: true,
  enabled:          () => process.env.PROXHQ_ENABLE_GHOSTSTREAM !== "0",

  async run(): Promise<void> {
    const expired = await getExpiredSessions();

    for (const session of expired) {
      try {
        await rotateGhostStreamProfile(session.userId, session.configId);
      } catch (err) {
        logger.warn({ err, userId: session.userId, configId: session.configId }, "[GhostStream] Rotation failed");
      }
    }

    if (expired.length > 0) {
      logger.info({ rotated: expired.length }, "[GhostStream] Profiles rotated");
    }
  },
});
