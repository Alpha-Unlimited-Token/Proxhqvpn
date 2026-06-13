// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Device Trust Engine — expanded ZTNA posture scoring & device management
//   GET  /api/device-trust/summary    — aggregate trust stats
//   GET  /api/device-trust/devices    — all ZTNA-enrolled devices
//   POST /api/device-trust/evaluate   — evaluate device signals → score + decision
//   POST /api/device-trust/devices/:fp/update-state — manually override trust state

import { Router, type Request, type Response } from "express";
import { evaluateDeviceTrust, type DeviceSignals } from "../lib/device-trust";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { bus } from "../lib/service-bus";

const router = Router();

router.get("/summary", async (_req: Request, res: Response) => {
  try {
    const rows = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE trust_state = 'trusted')  AS trusted,
        COUNT(*) FILTER (WHERE trust_state = 'blocked')  AS blocked,
        COUNT(*) FILTER (WHERE trust_state = 'pending')  AS pending,
        COUNT(*) FILTER (WHERE trust_state = 'limited')  AS limited,
        COUNT(*) FILTER (WHERE trust_state = 'revoked')  AS revoked,
        COUNT(*)                                          AS total,
        ROUND(AVG(posture_score))                         AS avg_score
      FROM ztna_devices
    `);
    const r = rows.rows?.[0] ?? {};
    res.json({
      trusted:  Number(r.trusted  ?? 0),
      blocked:  Number(r.blocked  ?? 0),
      pending:  Number(r.pending  ?? 0),
      limited:  Number(r.limited  ?? 0),
      revoked:  Number(r.revoked  ?? 0),
      total:    Number(r.total    ?? 0),
      avgScore: r.avg_score != null ? Number(r.avg_score) : null,
    });
  } catch { res.json({ trusted: 0, blocked: 0, pending: 0, limited: 0, revoked: 0, total: 0, avgScore: null }); }
});

router.get("/devices", async (req: Request, res: Response) => {
  try {
    const limit  = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 200);
    const state  = req.query.state as string | undefined;
    const query  = state
      ? sql`SELECT * FROM ztna_devices WHERE trust_state = ${state} ORDER BY last_seen_at DESC NULLS LAST LIMIT ${limit}`
      : sql`SELECT * FROM ztna_devices ORDER BY last_seen_at DESC NULLS LAST LIMIT ${limit}`;
    const rows = await db.execute(query);
    res.json({ devices: rows.rows ?? [], total: (rows.rows ?? []).length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post("/evaluate", (req: Request, res: Response) => {
  const signals: DeviceSignals = {
    os:               req.body.os               ?? "unknown",
    diskEncrypted:    Boolean(req.body.diskEncrypted    ?? false),
    firewallEnabled:  Boolean(req.body.firewallEnabled  ?? false),
    edrHealthy:       Boolean(req.body.edrHealthy       ?? false),
    jailbrokenOrRooted: Boolean(req.body.jailbrokenOrRooted ?? false),
    lastPatchAgeDays: Number(req.body.lastPatchAgeDays  ?? 90),
    certificateValid: Boolean(req.body.certificateValid ?? false),
    ipReputation:     (req.body.ipReputation as "good" | "unknown" | "bad") ?? "unknown",
  };

  const decision = evaluateDeviceTrust(signals);

  bus.publish("ztna.posture_check", { signals, decision, source: "manual_ui" }, "device-trust-api");
  if (!decision.allow) bus.publish("ztna.deny", { reason: decision.reasons, score: decision.score }, "device-trust-api");

  res.json({ signals, ...decision });
});

router.post("/devices/:fp/update-state", async (req: Request, res: Response) => {
  const { fp } = req.params;
  const { state } = req.body;
  const allowed = ["trusted", "blocked", "pending", "limited", "revoked"];
  if (!allowed.includes(state)) return res.status(400).json({ error: "Invalid trust_state" });
  try {
    await db.execute(sql`
      UPDATE ztna_devices SET trust_state = ${state} WHERE fingerprint = ${fp}
    `);
    bus.publish("ztna.posture_check", { fingerprint: fp, newState: state, source: "admin_override" }, "device-trust-api");
    res.json({ ok: true, fingerprint: fp, newState: state });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
