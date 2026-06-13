// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { generateProductionReadinessScorecard } from "./productionReadinessScorecardService";
import { assessComplianceFramework } from "./complianceEngineService";

export async function scorePlatformMaturity() {
  const readiness = await generateProductionReadinessScorecard();

  const soc2 = await assessComplianceFramework("SOC2").catch(() => null);
  const iso = await assessComplianceFramework("ISO27001").catch(() => null);

  const complianceScore =
    ((soc2?.score ?? 0) + (iso?.score ?? 0)) /
    Math.max(1, (soc2?.maxScore ?? 0) + (iso?.maxScore ?? 0));

  const maturityPercent = Math.round(
    readiness.percent * 0.65 + complianceScore * 100 * 0.35,
  );

  return {
    generatedAt: new Date().toISOString(),
    maturityPercent,
    level:
      maturityPercent >= 90
        ? "elite"
        : maturityPercent >= 75
          ? "enterprise_ready"
          : maturityPercent >= 55
            ? "growth_ready"
            : "needs_foundation",
    readiness,
    compliance: {
      soc2,
      iso27001: iso,
    },
  };
}
