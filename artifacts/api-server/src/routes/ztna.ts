// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Zero Trust Network Access — device posture endpoint.
// Gap bridge: continuous device verification before granting VPN access.
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import { evaluateDeviceTrust } from "../lib/device-trust";
import { shipSecurityEvent } from "../lib/siem";
import { appendAuditEvent } from "../lib/audit-chain";
import { db } from "@workspace/db";
import { ztnaDevicesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const postureSchema = z.object({
  os:                 z.string().min(1).max(64),
  diskEncrypted:      z.boolean(),
  firewallEnabled:    z.boolean(),
  edrHealthy:         z.boolean(),
  jailbrokenOrRooted: z.boolean(),
  lastPatchAgeDays:   z.number().int().min(0).max(3650),
  certificateValid:   z.boolean(),
  ipReputation:       z.enum(["good", "unknown", "bad"]),
  certFingerprint:    z.string().optional(),
});

// ── POST /api/ztna/posture ─────────────────────────────────────────────────────
// Evaluates device trust signals and returns a score + allow/deny decision.
// Called by the VPN client before establishing a tunnel — deny blocks connection.
router.post("/posture", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = postureSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_device_posture", details: parsed.error.flatten() });
  }

  const signals = parsed.data;
  const decision = evaluateDeviceTrust(signals);

  const clientIp = req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()
    ?? req.socket.remoteAddress
    ?? "unknown";

  // Upsert device record with latest posture and trust score
  if (signals.certFingerprint) {
    try {
      const existing = await db.select().from(ztnaDevicesTable)
        .where(eq(ztnaDevicesTable.certFingerprint, signals.certFingerprint))
        .limit(1);

      if (existing.length > 0) {
        await db.update(ztnaDevicesTable)
          .set({
            trustScore: decision.score,
            posture: signals as any,
            lastSeenAt: new Date(),
            revoked: !decision.allow && signals.jailbrokenOrRooted ? true : existing[0].revoked,
          })
          .where(eq(ztnaDevicesTable.certFingerprint, signals.certFingerprint));
      } else {
        await db.insert(ztnaDevicesTable).values({
          userId,
          certFingerprint: signals.certFingerprint,
          trustScore: decision.score,
          posture: signals as any,
          lastSeenAt: new Date(),
        }).onConflictDoNothing();
      }
    } catch { /* DB error doesn't block posture response */ }
  }

  // Audit + SIEM
  const auditEntry = appendAuditEvent({
    actor: userId,
    action: "ztna.posture_check",
    resource: `device:${signals.certFingerprint ?? signals.os}`,
    metadata: { score: decision.score, allow: decision.allow, reasons: decision.reasons },
    ip: clientIp,
  });

  await shipSecurityEvent({
    actor: userId,
    action: "ztna.posture_check",
    resource: `device:${signals.certFingerprint ?? signals.os}`,
    result: decision.allow ? "allow" : "deny",
    ip: clientIp,
    metadata: { score: decision.score, reasons: decision.reasons },
    severity: decision.allow ? "low" : decision.score < 40 ? "critical" : "high",
  });

  return res.json({
    ...decision,
    auditHash: auditEntry.hash,
  });
});

// ── GET /api/ztna/device/:fingerprint ─────────────────────────────────────────
// Returns stored posture and trust score for a device certificate fingerprint.
router.get("/device/:fingerprint", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [device] = await db.select().from(ztnaDevicesTable)
    .where(eq(ztnaDevicesTable.certFingerprint, req.params.fingerprint))
    .limit(1);

  if (!device || device.userId !== userId) {
    return res.status(404).json({ error: "Device not found" });
  }

  return res.json(device);
});

export default router;
