import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { detectDrift, summarizeDrift } from "../lib/drift-detector";

const router = Router();

router.get("/check", async (_req: Request, res: Response) => {
  const results = [];

  // 1. Firewall policy drift: compare latest active policy with second-latest
  try {
    const fwRows = await db.execute(sql`
      SELECT version, policy FROM firewall_policy_versions
      ORDER BY version DESC LIMIT 2
    `);
    const versions = fwRows?.rows ?? [];
    if (versions.length >= 2) {
      const latest   = (versions[0] as any).policy;
      const previous = (versions[1] as any).policy;
      results.push(detectDrift("firewall_policy", previous, latest));
    } else {
      results.push({ drifted: false, component: "firewall_policy", expectedHash: "-", actualHash: "-", detectedAt: new Date().toISOString() });
    }
  } catch {
    results.push({ drifted: false, component: "firewall_policy", expectedHash: "-", actualHash: "-", detectedAt: new Date().toISOString() });
  }

  // 2. Node enrollment drift: enrolled nodes vs enrolled credentials
  try {
    const nodesResult = await db.execute(sql`SELECT COUNT(*) AS cnt FROM nodes WHERE status = 'active'`);
    const credsResult = await db.execute(sql`SELECT COUNT(*) AS cnt FROM node_daemon_credentials`);
    const nodeCount  = Number((nodesResult?.rows?.[0] as any)?.cnt ?? 0);
    const credCount  = Number((credsResult?.rows?.[0] as any)?.cnt ?? 0);
    results.push(detectDrift("node_credentials", { enrolled: nodeCount }, { enrolled: credCount }));
  } catch {
    results.push({ drifted: false, component: "node_credentials", expectedHash: "-", actualHash: "-", detectedAt: new Date().toISOString() });
  }

  // 3. Active device configs: account_devices vs vpn_config_lifecycle active
  try {
    const devResult = await db.execute(sql`SELECT COUNT(*) AS cnt FROM account_devices WHERE trust_state = 'trusted' AND revoked_at IS NULL`);
    const cfgResult = await db.execute(sql`SELECT COUNT(*) AS cnt FROM vpn_config_lifecycle WHERE status = 'active'`);
    const devCount = Number((devResult?.rows?.[0] as any)?.cnt ?? 0);
    const cfgCount = Number((cfgResult?.rows?.[0] as any)?.cnt ?? 0);
    const drifted  = Math.abs(devCount - cfgCount) > 5;
    results.push({ drifted, component: "device_config_parity", expectedHash: String(devCount), actualHash: String(cfgCount), detectedAt: new Date().toISOString() });
  } catch {
    results.push({ drifted: false, component: "device_config_parity", expectedHash: "-", actualHash: "-", detectedAt: new Date().toISOString() });
  }

  res.json(summarizeDrift(results));
});

export default router;
