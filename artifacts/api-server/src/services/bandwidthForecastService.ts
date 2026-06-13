// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { getNodeConnectionStats } from "../repositories/connectionAnalyticsRepository";
import { saveBandwidthForecast } from "../repositories/bandwidthForecastRepository";

export async function forecastNodeBandwidth(input: {
  nodeId: string;
  windowMinutes?: number;
}) {
  const windowMinutes = input.windowMinutes ?? 60;
  const stats = await getNodeConnectionStats(input.nodeId, windowMinutes);

  const bytesIn = Number(stats.bytes_in ?? 0);
  const bytesOut = Number(stats.bytes_out ?? 0);
  const observedBytes = bytesIn + bytesOut;

  const forecastBytes = observedBytes;
  const confidence = observedBytes > 0 ? 0.55 : 0.15;

  await saveBandwidthForecast({
    nodeId: input.nodeId,
    windowMinutes,
    observedBytes,
    forecastBytes,
    confidence,
    metadata: { method: "baseline_same_window" },
  });

  return {
    nodeId: input.nodeId,
    windowMinutes,
    observedBytes,
    forecastBytes,
    confidence,
  };
}
