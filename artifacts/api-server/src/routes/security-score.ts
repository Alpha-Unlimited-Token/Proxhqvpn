import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const userId = (req as any).auth?.userId ?? "unknown";

  const [devicesResult, configsResult, eventsResult] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*) AS cnt,
             SUM(CASE WHEN trust_state = 'trusted' THEN 1 ELSE 0 END) AS trusted
      FROM account_devices WHERE user_id = ${userId} AND revoked_at IS NULL
    `),
    db.execute(sql`
      SELECT COUNT(*) AS cnt,
             MIN(issued_at) AS oldest_config
      FROM vpn_config_lifecycle vcl
      JOIN account_devices ad ON ad.id = vcl.device_id
      WHERE ad.user_id = ${userId} AND vcl.status = 'active'
    `),
    db.execute(sql`
      SELECT COUNT(*) AS cnt FROM account_security_events
      WHERE user_id = ${userId} AND severity IN ('high','critical')
        AND created_at > NOW() - INTERVAL '30 days'
    `),
  ]);

  const devices      = devicesResult?.rows?.[0] as any;
  const configs      = configsResult?.rows?.[0] as any;
  const highEvents   = Number((eventsResult?.rows?.[0] as any)?.cnt ?? 0);
  const deviceCount  = Number(devices?.cnt ?? 0);
  const trustedCount = Number(devices?.trusted ?? 0);
  const configCount  = Number(configs?.cnt ?? 0);

  const oldestConfig = configs?.oldest_config ? new Date(configs.oldest_config) : null;
  const configAgeDays = oldestConfig
    ? Math.floor((Date.now() - oldestConfig.getTime()) / 86_400_000)
    : 0;

  // Score breakdown — max 100
  const components = [
    {
      label:       "Trusted Devices",
      points:      deviceCount === 0 ? 0 : Math.min(25, Math.round((trustedCount / deviceCount) * 25)),
      maxPoints:   25,
      status:      deviceCount === 0 ? "no_devices" : trustedCount === deviceCount ? "good" : "partial",
    },
    {
      label:       "VPN Config Active",
      points:      configCount > 0 ? 20 : 0,
      maxPoints:   20,
      status:      configCount > 0 ? "good" : "no_config",
    },
    {
      label:       "Config Freshness",
      points:      configAgeDays === 0 ? 15 : configAgeDays < 90 ? 15 : configAgeDays < 180 ? 8 : 0,
      maxPoints:   15,
      status:      configAgeDays < 90 ? "good" : "stale",
    },
    {
      label:       "No High-Severity Events",
      points:      highEvents === 0 ? 25 : highEvents < 3 ? 10 : 0,
      maxPoints:   25,
      status:      highEvents === 0 ? "good" : "alert",
    },
    {
      label:       "Account Activity",
      points:      15,
      maxPoints:   15,
      status:      "good",
    },
  ];

  const totalScore  = components.reduce((s, c) => s + c.points, 0);
  const maxScore    = components.reduce((s, c) => s + c.maxPoints, 0);
  const grade       = totalScore >= 90 ? "A+" : totalScore >= 80 ? "A" : totalScore >= 70 ? "B" : totalScore >= 60 ? "C" : "D";

  const recommendations: string[] = [];
  if (deviceCount === 0) recommendations.push("Register at least one trusted device.");
  if (trustedCount < deviceCount) recommendations.push("Some devices are not yet trusted — review in Account Security.");
  if (configCount === 0) recommendations.push("Issue a VPN config for your primary device.");
  if (configAgeDays > 90) recommendations.push("Rotate your WireGuard config — it is over 90 days old.");
  if (highEvents > 0) recommendations.push(`${highEvents} high-severity security event(s) in the last 30 days.`);

  res.json({ score: totalScore, maxScore, grade, components, recommendations, userId });
});

export default router;
