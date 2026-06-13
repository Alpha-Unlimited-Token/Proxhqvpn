// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { generateSecurityOperationsReport } from "./securityReportingService";
import { getGlobalVpnControlPlaneSnapshot } from "./globalVpnControlPlaneService";

export async function generateExecutiveSummary(input: {
  days?: number;
}) {
  const [security, vpn] = await Promise.all([
    generateSecurityOperationsReport({ days: input.days ?? 30 }),
    getGlobalVpnControlPlaneSnapshot(),
  ]);

  const openAlerts = Number(security.metrics.open_alerts ?? 0);
  const offlineNodes = Number(vpn.offline ?? 0);

  return {
    generatedAt: new Date().toISOString(),
    periodDays: input.days ?? 30,
    health:
      openAlerts > 20 || offlineNodes > 3
        ? "needs_attention"
        : "stable",
    security,
    vpn: {
      totalNodes: vpn.totalNodes,
      healthy: vpn.healthy,
      degraded: vpn.degraded,
      offline: vpn.offline,
      regions: vpn.regions,
    },
  };
}
