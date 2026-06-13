// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { verifyAuditChain } from "../lib/audit-chain-verifier";
import { getGlobalVpnControlPlaneSnapshot } from "./globalVpnControlPlaneService";
import { scorePlatformMaturity } from "./platformMaturityService";

export async function runContinuousSelfAudit() {
  const findings: Array<{
    code: string;
    severity: "low" | "medium" | "high" | "critical";
    message: string;
  }> = [];

  const audit = await verifyAuditChain(5000);
  if (!audit.ok) {
    findings.push({
      code: "AUDIT_CHAIN_INVALID",
      severity: "critical",
      message: "Audit chain verification failed.",
    });
  }

  const vpn = await getGlobalVpnControlPlaneSnapshot();
  if (vpn.totalNodes === 0 || vpn.healthy === 0) {
    findings.push({
      code: "NO_HEALTHY_VPN_NODES",
      severity: "critical",
      message: "No healthy VPN nodes are currently available.",
    });
  }

  const maturity = await scorePlatformMaturity();
  if (maturity.maturityPercent < 75) {
    findings.push({
      code: "MATURITY_BELOW_ENTERPRISE_THRESHOLD",
      severity: "medium",
      message: "Platform maturity score is below enterprise-ready threshold.",
    });
  }

  const maxScore = 100;
  const penalty = findings.reduce((sum, finding) => {
    if (finding.severity === "critical") return sum + 35;
    if (finding.severity === "high") return sum + 20;
    if (finding.severity === "medium") return sum + 10;
    return sum + 5;
  }, 0);

  const score = Math.max(0, maxScore - penalty);
  const id = randomUUID();

  await db.execute(sql`
    INSERT INTO self_audit_runs
      (id, status, score, max_score, findings)
    VALUES
      (${id}, ${findings.length ? "completed_with_findings" : "completed"}, ${score}, ${maxScore}, ${JSON.stringify(findings)}::jsonb)
  `);

  return {
    id,
    score,
    maxScore,
    status: findings.length ? "completed_with_findings" : "completed",
    findings,
  };
}
