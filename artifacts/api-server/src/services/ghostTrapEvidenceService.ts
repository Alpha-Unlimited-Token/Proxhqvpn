// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Trap Evidence Service — chain-of-custody evidence bundle generation.
import { db } from "@workspace/db";
import {
  ghostTrapEvidenceTable,
  ghostTrapProbesTable,
  ghostTrapLoopSessionsTable,
  ghostTrapBeaconsTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";
import { recordEvent } from "./ghostTrapEventService";

export async function exportEvidenceBundle(userId: string, subjectIp: string, notes?: string) {
  const probes = await db
    .select()
    .from(ghostTrapProbesTable)
    .where(eq(ghostTrapProbesTable.attackerIp, subjectIp))
    .orderBy(desc(ghostTrapProbesTable.probedAt))
    .limit(500);

  const sessions = await db
    .select()
    .from(ghostTrapLoopSessionsTable)
    .where(eq(ghostTrapLoopSessionsTable.attackerIp, subjectIp))
    .orderBy(desc(ghostTrapLoopSessionsTable.createdAt))
    .limit(100);

  const beacons = await db
    .select()
    .from(ghostTrapBeaconsTable)
    .where(eq(ghostTrapBeaconsTable.attackerIp, subjectIp))
    .orderBy(desc(ghostTrapBeaconsTable.firedAt))
    .limit(100);

  const bundle = {
    exportedAt:  new Date().toISOString(),
    exportedBy:  userId,
    subjectIp,
    platform:    "ProxhqVPN Ghost Trap — Alpha Unlimited Technologies LLC",
    probeCount:  probes.length,
    sessionCount: sessions.length,
    beaconCount: beacons.length,
    probes:      probes.map(p => ({
      probeId:    p.probeId,
      method:     p.method,
      endpoint:   p.endpoint,
      probeType:  p.probeType,
      attackVector: p.attackVector,
      tarpitMs:   p.tarpitMs,
      autoBlocked: p.autoBlocked,
      vpnDetected: p.vpnDetected,
      torDetected: p.torDetected,
      geoCountry:  p.geoCountry,
      geoCity:     p.geoCity,
      geoIsp:      p.geoIsp,
      geoAsn:      p.geoAsn,
      probedAt:    p.probedAt,
    })),
    sessions:    sessions.map(s => ({
      sessionId:  s.sessionId,
      stage:      s.stageLabel,
      loopCount:  s.loopCount,
      totalTarpitMs: s.totalTarpitMs,
      geoCountry: s.geoCountry,
      geoIsp:     s.geoIsp,
      isActive:   s.isActive,
      createdAt:  s.createdAt,
      lastSeenAt: s.lastSeenAt,
    })),
    beacons:     beacons.map(b => ({
      beaconId:   b.beaconId,
      firedAt:    b.firedAt,
      firedFromIp: b.firedFromIp,
      firedUa:    b.firedUa,
    })),
    notes,
  };

  const bundleJson = JSON.stringify(bundle, null, 2);
  const sha256 = crypto.createHash("sha256").update(bundleJson).digest("hex");
  const evidenceId = `EVD-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;

  const [row] = await db
    .insert(ghostTrapEvidenceTable)
    .values({
      evidenceId,
      userId,
      subjectIp,
      evidenceType: "full_bundle",
      format:       "json",
      bundleJson,
      probeCount:   probes.length,
      sessionCount: sessions.length,
      sha256,
      notes:        notes ?? null,
    })
    .returning();

  await recordEvent({
    userId,
    eventType:  "evidence_export",
    severity:   "info",
    sourceIp:   subjectIp,
    summary:    `Evidence bundle exported for ${subjectIp} (${probes.length} probes, ${sessions.length} sessions)`,
    detailJson: { evidenceId, sha256, probeCount: probes.length, sessionCount: sessions.length },
  });

  return { ...row!, bundle };
}

export async function listEvidence(userId: string, limit = 50) {
  return db
    .select({
      evidenceId:   ghostTrapEvidenceTable.evidenceId,
      subjectIp:    ghostTrapEvidenceTable.subjectIp,
      evidenceType: ghostTrapEvidenceTable.evidenceType,
      format:       ghostTrapEvidenceTable.format,
      probeCount:   ghostTrapEvidenceTable.probeCount,
      sessionCount: ghostTrapEvidenceTable.sessionCount,
      sha256:       ghostTrapEvidenceTable.sha256,
      notes:        ghostTrapEvidenceTable.notes,
      exportedAt:   ghostTrapEvidenceTable.exportedAt,
    })
    .from(ghostTrapEvidenceTable)
    .where(eq(ghostTrapEvidenceTable.userId, userId))
    .orderBy(desc(ghostTrapEvidenceTable.exportedAt))
    .limit(limit);
}

export async function getEvidenceBundle(evidenceId: string, userId: string) {
  const [row] = await db
    .select()
    .from(ghostTrapEvidenceTable)
    .where(eq(ghostTrapEvidenceTable.evidenceId, evidenceId))
    .limit(1);
  if (!row || row.userId !== userId) return null;
  return row;
}
