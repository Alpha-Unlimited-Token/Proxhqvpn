// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { verifyAuditChain } from "../lib/audit-chain-verifier";
import { getGlobalVpnControlPlaneSnapshot } from "./globalVpnControlPlaneService";
import { generateSecurityOperationsReport } from "./securityReportingService";

export async function generateProductionReadinessScorecard() {
  const [audit, vpn, security] = await Promise.all([
    verifyAuditChain(5000),
    getGlobalVpnControlPlaneSnapshot(),
    generateSecurityOperationsReport({ days: 7 }),
  ]);

  const checks = [
    {
      name: "audit_chain_valid",
      passed: audit.ok,
      weight: 25,
    },
    {
      name: "vpn_has_healthy_nodes",
      passed: vpn.healthy > 0,
      weight: 25,
    },
    {
      name: "vpn_no_major_offline_ratio",
      passed: vpn.totalNodes === 0 ? false : vpn.offline / vpn.totalNodes < 0.25,
      weight: 20,
    },
    {
      name: "security_reporting_available",
      passed: !!security.metrics,
      weight: 15,
    },
    {
      name: "production_env_guard_enabled",
      passed: process.env.NODE_ENV === "production" || process.env.NODE_ENV === "test",
      weight: 15,
    },
  ];

  const maxScore = checks.reduce((sum, check) => sum + check.weight, 0);
  const score = checks
    .filter((check) => check.passed)
    .reduce((sum, check) => sum + check.weight, 0);

  return {
    generatedAt: new Date().toISOString(),
    score,
    maxScore,
    percent: Math.round((score / maxScore) * 100),
    status:
      score / maxScore >= 0.9
        ? "ready"
        : score / maxScore >= 0.75
          ? "needs_review"
          : "not_ready",
    checks,
  };
}
