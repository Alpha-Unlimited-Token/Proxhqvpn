// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Trap Service — core probe/config orchestration.
import { db } from "@workspace/db";
import {
  ghostTrapProbesTable,
  ghostTrapConfigTable,
  ghostTrapLoopSessionsTable,
  ghostTrapEventsTable,
  ghostBlockedSourcesTable,
} from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import crypto from "crypto";

export async function getOrCreateConfig(userId: string) {
  const [existing] = await db
    .select()
    .from(ghostTrapConfigTable)
    .where(eq(ghostTrapConfigTable.userId, userId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(ghostTrapConfigTable)
    .values({ userId, userToken: crypto.randomBytes(16).toString("hex") })
    .returning();
  return created!;
}

export async function getProbeStats(userId: string) {
  const rows = await db
    .select()
    .from(ghostTrapProbesTable)
    .where(eq(ghostTrapProbesTable.userId, userId))
    .orderBy(desc(ghostTrapProbesTable.probedAt))
    .limit(500);

  const total      = rows.length;
  const uniqueIps  = new Set(rows.map(r => r.attackerIp)).size;
  const sqlCount   = rows.filter(r => r.probeType === "sql_injection").length;
  const xssCount   = rows.filter(r => r.probeType === "xss").length;
  const cmdCount   = rows.filter(r => r.probeType === "cmd_injection").length;
  const blocked    = rows.filter(r => r.autoBlocked).length;
  const silked     = rows.filter(r => r.silkTrapped).length;
  const beacons    = rows.filter(r => r.beaconFired).length;
  const vpnCount   = rows.filter(r => r.vpnDetected).length;
  const avgTarpit  = rows.length > 0
    ? Math.round(rows.reduce((acc, r) => acc + r.tarpitMs, 0) / rows.length)
    : 0;

  return { total, uniqueIps, sqlCount, xssCount, cmdCount, blocked, silkTrapped: silked, beaconFires: beacons, avgTarpit, vpnCount };
}

export async function getActiveSessions(userId: string) {
  return db
    .select()
    .from(ghostTrapLoopSessionsTable)
    .where(eq(ghostTrapLoopSessionsTable.attackerIp, sql`ANY(
      SELECT attacker_ip FROM ghost_trap_probes WHERE user_id = ${userId}
    )`))
    .orderBy(desc(ghostTrapLoopSessionsTable.lastSeenAt))
    .limit(100);
}

export async function isSourceBlocked(ip: string): Promise<boolean> {
  const rows = await db
    .select({ id: ghostBlockedSourcesTable.id })
    .from(ghostBlockedSourcesTable)
    .where(eq(ghostBlockedSourcesTable.sourceIp, ip))
    .limit(1);
  return rows.length > 0 && rows[0]!.id > 0;
}
