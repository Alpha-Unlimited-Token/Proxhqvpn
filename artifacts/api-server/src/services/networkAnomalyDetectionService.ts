// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.

export function detectNetworkAnomalies(metrics: {
  bandwidth: number;
  packetsPerSecond: number;
  latencyMs: number;
}) {
  const anomalies: string[] = [];

  if (metrics.latencyMs > 500)
    anomalies.push("high_latency");

  if (metrics.bandwidth > 10_000_000_000)
    anomalies.push("bandwidth_spike");

  if (metrics.packetsPerSecond > 2_000_000)
    anomalies.push("packet_flood");

  return {
    anomalyDetected: anomalies.length > 0,
    anomalies,
  };
}
