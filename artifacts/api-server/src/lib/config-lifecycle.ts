import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { appendAuditEvent } from "./audit-chain";

export type ConfigLifecycleState =
  | "created" | "downloaded" | "activated"
  | "rotated" | "revoked" | "deleted";

export async function recordConfigState(args: {
  configId: string;
  userId: string;
  deviceId: string;
  state: ConfigLifecycleState;
  metadata?: Record<string, unknown>;
}) {
  await db.execute(sql`
    INSERT INTO vpn_config_lifecycle_events (config_id, user_id, device_id, state, metadata, created_at)
    VALUES (${args.configId}, ${args.userId}, ${args.deviceId}, ${args.state},
            ${JSON.stringify(args.metadata ?? {})}::jsonb, NOW())
  `);
  appendAuditEvent({ actor: args.userId, action: "vpn_config_lifecycle", resource: `config:${args.configId}`, metadata: args });
}

export async function assertConfigIssuanceAllowed(args: { userId: string; deviceId: string }) {
  const deviceResult = await db.execute(sql`
    SELECT trust_state, revoked_at FROM account_devices
    WHERE id = ${args.deviceId} AND user_id = ${args.userId}
    LIMIT 1
  `);
  const device = deviceResult?.rows?.[0] as any;
  if (!device) throw new Error("Device not registered. Register this device first.");
  if (device.revoked_at) throw new Error("Device has been revoked.");
  if (device.trust_state === "blocked") throw new Error("Device is blocked.");

  // Check for active VPN config count vs limit (max 10 per user)
  const countResult = await db.execute(sql`
    SELECT COUNT(*) AS cnt FROM vpn_config_lifecycle vcl
    JOIN account_devices ad ON ad.id = vcl.device_id
    WHERE ad.user_id = ${args.userId} AND vcl.status = 'active'
  `);
  const active = Number((countResult?.rows?.[0] as any)?.cnt ?? 0);
  if (active >= 10) throw new Error("Active VPN config limit (10) reached. Revoke an existing config first.");

  return true;
}

export async function getConfigLifecycleHistory(userId: string, limit = 50) {
  const result = await db.execute(sql`
    SELECT e.config_id, e.device_id, e.state, e.metadata, e.created_at,
           ad.display_name AS device_name, ad.platform
    FROM vpn_config_lifecycle_events e
    LEFT JOIN account_devices ad ON ad.id = e.device_id
    WHERE e.user_id = ${userId}
    ORDER BY e.created_at DESC
    LIMIT ${limit}
  `);
  return result?.rows ?? [];
}
