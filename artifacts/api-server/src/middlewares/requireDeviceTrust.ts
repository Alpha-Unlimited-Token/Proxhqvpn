// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Enforce ZTNA device trust before issuing any WireGuard config or key.
// Blocks config generation for devices with trust score < MIN_DEVICE_TRUST_SCORE.

import type { Request, Response, NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { ztnaDevicesTable } from "@workspace/db/schema";
import { and, eq, desc } from "drizzle-orm";

const MIN_TRUST_SCORE = Number(process.env.MIN_DEVICE_TRUST_SCORE ?? "75");

export async function requireDeviceTrust(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const fingerprint = String(
    req.headers["x-device-fingerprint"] ??
    req.body?.deviceFingerprint ??
    req.body?.fingerprint ??
    req.query?.fingerprint ??
    ""
  ).trim();

  if (!fingerprint) {
    res.status(403).json({
      error: "Device trust check required before VPN config issuance.",
      hint: "Submit a ZTNA posture check at POST /api/ztna/posture to register your device first.",
    });
    return;
  }

  const [device] = await db
    .select()
    .from(ztnaDevicesTable)
    .where(
      and(
        eq(ztnaDevicesTable.userId, userId),
        eq(ztnaDevicesTable.certFingerprint, fingerprint)
      )
    )
    .orderBy(desc(ztnaDevicesTable.lastSeenAt))
    .limit(1);

  if (!device) {
    res.status(403).json({
      error: "No device posture record found for this fingerprint.",
      hint: "Run a posture check at POST /api/ztna/posture first.",
    });
    return;
  }

  if (device.revoked) {
    res.status(403).json({ error: "Device has been revoked and cannot obtain VPN configs." });
    return;
  }

  if (device.trustScore < MIN_TRUST_SCORE) {
    res.status(403).json({
      error: "Device trust score too low for VPN config issuance.",
      requiredScore: MIN_TRUST_SCORE,
      currentScore: device.trustScore,
      hint: "Improve device posture (enable disk encryption, firewall, EDR) and re-run POST /api/ztna/posture.",
    });
    return;
  }

  (req as any).trustedDeviceFingerprint = fingerprint;
  (req as any).trustedDeviceTrustScore = device.trustScore;
  next();
}
