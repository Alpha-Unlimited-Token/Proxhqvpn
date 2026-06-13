// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { getNodeConnectionStats } from "../repositories/connectionAnalyticsRepository";

export async function forecastNodeCapacity(nodeId: string) {
  const stats = await getNodeConnectionStats(nodeId, 1440);

  const traffic =
    Number(stats.bytes_in ?? 0) +
    Number(stats.bytes_out ?? 0);

  const projected = Math.round(traffic * 1.15);

  return {
    nodeId,
    observedTraffic: traffic,
    projectedTraffic: projected,
    confidence: 0.65,
  };
}
