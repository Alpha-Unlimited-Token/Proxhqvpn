import { Router, type Request, type Response } from "express";
import { z } from "zod";
import crypto from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();

function fingerprintHash(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

router.get("/summary", async (req: Request, res: Response) => {
  const userId = (req as any).auth?.userId ?? "unknown";

  const [devicesRes, configsRes, eventsRes] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*) AS cnt FROM account_devices
      WHERE user_id = ${userId} AND trust_state NOT IN ('revoked','blocked') AND revoked_at IS NULL
    `),
    db.execute(sql`
      SELECT COUNT(*) AS cnt FROM vpn_config_lifecycle vcl
      JOIN account_devices ad ON ad.id = vcl.device_id
      WHERE ad.user_id = ${userId} AND vcl.status = 'active'
    `),
    db.execute(sql`
      SELECT event_type, severity, created_at FROM account_security_events
      WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 10
    `),
  ]);

  const activeDevices = Number((devicesRes.rows[0] as any).cnt);
  const activeVpnConfigs = Number((configsRes.rows[0] as any).cnt);
  const recentSecurityEvents = eventsRes.rows;

  const recommendations: string[] = [];
  if (activeDevices === 0) recommendations.push("Register your first device to get a VPN config.");
  if (activeVpnConfigs === 0) recommendations.push("Issue a VPN config for an active device.");
  if (activeDevices > 5) recommendations.push("Review and revoke unused devices.");
  recommendations.push("Rotate your WireGuard key every 90 days.");

  res.json({ userId, activeDevices, activeVpnConfigs, recentSecurityEvents, recommendedActions: recommendations });
});

router.get("/devices", async (req: Request, res: Response) => {
  const userId = (req as any).auth?.userId ?? "unknown";
  const rows = await db.execute(sql`
    SELECT id, display_name, platform, trust_state, last_seen_at, created_at
    FROM account_devices WHERE user_id = ${userId} AND revoked_at IS NULL
    ORDER BY created_at DESC
  `);
  res.json({ devices: rows.rows });
});

router.post("/devices", async (req: Request, res: Response) => {
  const body = z.object({
    displayName: z.string().min(2).max(80),
    platform: z.string().max(40).optional(),
    fingerprint: z.string().min(16).max(512),
  }).parse(req.body);

  const userId = (req as any).auth?.userId ?? "unknown";
  const fHash = fingerprintHash(body.fingerprint);

  const rows = await db.execute(sql`
    INSERT INTO account_devices (user_id, display_name, platform, device_fingerprint_hash, trust_state)
    VALUES (${userId}, ${body.displayName}, ${body.platform ?? null}, ${fHash}, 'pending')
    ON CONFLICT (user_id, device_fingerprint_hash) DO UPDATE
      SET display_name = EXCLUDED.display_name, trust_state = 'pending'
    RETURNING id, display_name, platform, trust_state, created_at
  `);

  await db.execute(sql`
    INSERT INTO account_security_events (user_id, event_type, severity, metadata)
    VALUES (${userId}, 'device_registered', 'info', ${JSON.stringify({ displayName: body.displayName })}::jsonb)
  `);

  res.status(201).json(rows.rows[0]);
});

router.post("/devices/:deviceId/revoke", async (req: Request, res: Response) => {
  const userId = (req as any).auth?.userId ?? "unknown";
  const { deviceId } = req.params;

  const device = await db.execute(sql`
    SELECT id FROM account_devices WHERE id = ${deviceId} AND user_id = ${userId}
  `);
  if (!device.rows[0]) return res.status(404).json({ error: "Device not found." });

  await db.execute(sql`
    UPDATE account_devices SET trust_state = 'revoked', revoked_at = now() WHERE id = ${deviceId}
  `);
  await db.execute(sql`
    UPDATE vpn_config_lifecycle SET status = 'revoked', revoked_at = now(), revoke_reason = 'device_revoked'
    WHERE device_id = ${deviceId} AND status = 'active'
  `);
  await db.execute(sql`
    INSERT INTO account_security_events (user_id, event_type, severity, metadata)
    VALUES (${userId}, 'device_revoked', 'medium', ${JSON.stringify({ deviceId })}::jsonb)
  `);

  res.json({ ok: true, deviceId, revoked: true });
});

router.post("/vpn-configs/:configId/rotate", async (req: Request, res: Response) => {
  const userId = (req as any).auth?.userId ?? "unknown";
  const { configId } = req.params;

  const cfg = await db.execute(sql`
    SELECT vcl.id FROM vpn_config_lifecycle vcl
    JOIN account_devices ad ON ad.id = vcl.device_id
    WHERE vcl.id = ${configId} AND ad.user_id = ${userId} AND vcl.status = 'active'
  `);
  if (!cfg.rows[0]) return res.status(404).json({ error: "VPN config not found or not active." });

  await db.execute(sql`
    UPDATE vpn_config_lifecycle SET status = 'rotating', rotated_at = now() WHERE id = ${configId}
  `);
  await db.execute(sql`
    INSERT INTO account_security_events (user_id, event_type, severity, metadata)
    VALUES (${userId}, 'vpn_key_rotate_queued', 'info', ${JSON.stringify({ configId })}::jsonb)
  `);

  res.json({ ok: true, configId, status: "rotation_queued" });
});

export default router;
