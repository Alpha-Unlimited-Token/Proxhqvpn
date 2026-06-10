// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Drift Monitor — detect + auto-remediate config drift.
// Upgrade #8: Drift Auto-Remediation.
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import {
  detectDrift, summarizeDrift, remediateAll, remediateDrift,
  registerRemediationHandler, type DriftResult,
} from "../lib/drift-detector";
import { bus } from "../lib/service-bus";

const router = Router();

// ── Register auto-remediation handlers ───────────────────────────────────────

registerRemediationHandler("node_credentials", async (result: DriftResult) => {
  // Soft remediation: flag un-enrolled nodes for re-enrollment
  await db.execute(sql`
    UPDATE nodes SET status = 'enrollment_required'
    WHERE status = 'active'
    AND id::text NOT IN (SELECT node_id FROM node_daemon_credentials)
  `);
  bus.publish("drift.remediated", { component: "node_credentials" }, "drift-monitor");
  return {
    component: result.component,
    status:    "applied",
    action:    "Flagged un-enrolled active nodes as enrollment_required",
    timestamp: new Date().toISOString(),
  };
});

registerRemediationHandler("device_config_parity", async (result: DriftResult) => {
  // Revoke orphaned VPN configs for removed/revoked devices
  await db.execute(sql`
    UPDATE user_wg_configs SET revoked_at = NOW()
    WHERE revoked_at IS NULL
    AND user_id NOT IN (
      SELECT user_id FROM account_devices
      WHERE trust_state = 'trusted' AND revoked_at IS NULL
    )
  `);
  bus.publish("drift.remediated", { component: "device_config_parity" }, "drift-monitor");
  return {
    component: result.component,
    status:    "applied",
    action:    "Revoked orphaned WireGuard configs for untrusted/removed devices",
    timestamp: new Date().toISOString(),
  };
});

// ── GET /api/drift-monitor/check ─────────────────────────────────────────────
router.get("/check", async (_req: Request, res: Response) => {
  const results = [];

  // 1. Firewall policy drift
  try {
    const fwRows = await db.execute(sql`
      SELECT version, policy FROM firewall_policy_versions
      ORDER BY version DESC LIMIT 2
    `);
    const versions = fwRows?.rows ?? [];
    if (versions.length >= 2) {
      results.push(detectDrift("firewall_policy", (versions[1] as any).policy, (versions[0] as any).policy));
    } else {
      results.push({ drifted: false, component: "firewall_policy", expectedHash: "-", actualHash: "-", detectedAt: new Date().toISOString(), remediable: false });
    }
  } catch {
    results.push({ drifted: false, component: "firewall_policy", expectedHash: "-", actualHash: "-", detectedAt: new Date().toISOString(), remediable: false });
  }

  // 2. Node enrollment drift
  try {
    const nodesResult = await db.execute(sql`SELECT COUNT(*) AS cnt FROM nodes WHERE status = 'active'`);
    const credsResult = await db.execute(sql`SELECT COUNT(*) AS cnt FROM node_daemon_credentials`);
    const nodeCount  = Number((nodesResult?.rows?.[0] as any)?.cnt ?? 0);
    const credCount  = Number((credsResult?.rows?.[0] as any)?.cnt ?? 0);
    results.push(detectDrift("node_credentials", { enrolled: nodeCount }, { enrolled: credCount }));
  } catch {
    results.push({ drifted: false, component: "node_credentials", expectedHash: "-", actualHash: "-", detectedAt: new Date().toISOString(), remediable: false });
  }

  // 3. Device/config parity
  try {
    const devResult = await db.execute(sql`SELECT COUNT(*) AS cnt FROM account_devices WHERE trust_state = 'trusted' AND revoked_at IS NULL`);
    const cfgResult = await db.execute(sql`SELECT COUNT(*) AS cnt FROM vpn_config_lifecycle WHERE status = 'active'`);
    const devCount = Number((devResult?.rows?.[0] as any)?.cnt ?? 0);
    const cfgCount = Number((cfgResult?.rows?.[0] as any)?.cnt ?? 0);
    const drifted  = Math.abs(devCount - cfgCount) > 5;
    results.push({ drifted, component: "device_config_parity", expectedHash: String(devCount), actualHash: String(cfgCount), detectedAt: new Date().toISOString(), remediable: true, remediationHint: "Revoke orphaned configs for removed devices", severity: "low" as const });
  } catch {
    results.push({ drifted: false, component: "device_config_parity", expectedHash: "-", actualHash: "-", detectedAt: new Date().toISOString(), remediable: false });
  }

  // 4. ZTNA device trust drift — check for revoked-but-active devices
  try {
    const revokedActive = await db.execute(sql`
      SELECT COUNT(*) AS cnt FROM ztna_devices WHERE revoked = true AND last_seen_at > NOW() - INTERVAL '1 hour'
    `);
    const cnt = Number((revokedActive?.rows?.[0] as any)?.cnt ?? 0);
    results.push({ drifted: cnt > 0, component: "ztna_policy", expectedHash: "0_revoked_active", actualHash: String(cnt), detectedAt: new Date().toISOString(), remediable: false, severity: cnt > 0 ? "high" as const : undefined, remediationHint: "Audit ZTNA device list — revoked devices still connecting" });
  } catch {
    results.push({ drifted: false, component: "ztna_policy", expectedHash: "-", actualHash: "-", detectedAt: new Date().toISOString(), remediable: false });
  }

  res.json(summarizeDrift(results as any));
});

// ── POST /api/drift-monitor/remediate ────────────────────────────────────────
// Upgrade #8: trigger auto-remediation for all remediable drifted components
router.post("/remediate", async (_req: Request, res: Response) => {
  const checkResults = [];

  try {
    const nodesResult = await db.execute(sql`SELECT COUNT(*) AS cnt FROM nodes WHERE status = 'active'`);
    const credsResult = await db.execute(sql`SELECT COUNT(*) AS cnt FROM node_daemon_credentials`);
    checkResults.push(detectDrift("node_credentials",
      { enrolled: Number((nodesResult?.rows?.[0] as any)?.cnt ?? 0) },
      { enrolled: Number((credsResult?.rows?.[0] as any)?.cnt ?? 0) }
    ));
  } catch {
    checkResults.push({ drifted: false, component: "node_credentials", expectedHash: "-", actualHash: "-", detectedAt: new Date().toISOString() });
  }

  try {
    const devResult = await db.execute(sql`SELECT COUNT(*) AS cnt FROM account_devices WHERE trust_state = 'trusted' AND revoked_at IS NULL`);
    const cfgResult = await db.execute(sql`SELECT COUNT(*) AS cnt FROM vpn_config_lifecycle WHERE status = 'active'`);
    const devCount = Number((devResult?.rows?.[0] as any)?.cnt ?? 0);
    const cfgCount = Number((cfgResult?.rows?.[0] as any)?.cnt ?? 0);
    checkResults.push({ drifted: Math.abs(devCount - cfgCount) > 5, component: "device_config_parity", expectedHash: String(devCount), actualHash: String(cfgCount), detectedAt: new Date().toISOString(), remediable: true });
  } catch {
    checkResults.push({ drifted: false, component: "device_config_parity", expectedHash: "-", actualHash: "-", detectedAt: new Date().toISOString() });
  }

  const summary = summarizeDrift(checkResults as any);
  const reports = await remediateAll(summary);

  res.json({
    attempted: reports.length,
    applied:   reports.filter(r => r.status === "applied").length,
    skipped:   reports.filter(r => r.status === "skipped").length,
    failed:    reports.filter(r => r.status === "failed").length,
    manualRequired: reports.filter(r => r.status === "manual_required").length,
    reports,
    timestamp: new Date().toISOString(),
  });
});

// ── POST /api/drift-monitor/remediate/:component ─────────────────────────────
router.post("/remediate/:component", async (req: Request, res: Response) => {
  const component = String(req.params.component);
  const result: DriftResult = {
    drifted:     true,
    component,
    expectedHash: "-",
    actualHash:   "-",
    detectedAt:   new Date().toISOString(),
    remediable:   true,
  };
  const report = await remediateDrift(result);
  res.json(report);
});

export default router;
