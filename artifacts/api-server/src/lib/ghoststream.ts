// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// GhostStream™ — Adversarial Traffic Metamorphosis Engine.
// Manages cover profile assignment, rotation, and shape-directive generation
// for per-user WireGuard tunnels.

import crypto from "crypto";
import { db } from "@workspace/db";
import { ghoststreamProfilesTable, ghoststreamSessionsTable } from "@workspace/db/schema";
import { eq, and, lt } from "drizzle-orm";
import { logger } from "./logger";
import { appendAuditEvent } from "./audit-chain";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GhostStreamProfile {
  id:               string;
  name:             string;
  sizeCdf:          number[];
  iatCdf:           number[];
  burstMinPackets:  number;
  burstMaxPackets:  number;
  burstGapMinMs:    number;
  burstGapMaxMs:    number;
  dummyPps:         number;
  holdMinS:         number;
  holdMaxS:         number;
}

// 16-byte shape directive embedded in WireGuard payload.
// Format (all little-endian):
//   [0:1]  profile_index (2 bytes)
//   [2:3]  hold_remaining_s (2 bytes)
//   [4:5]  dummy_pps_x10 (2 bytes)
//   [6:7]  jitter_budget_ms (2 bytes)
//   [8:9]  pad_target_bytes (2 bytes)
//   [10]   entropy_mode (1 byte) — 0=PRNG 1=CSPRNG 2=keystream
//   [11:15] session_nonce (5 bytes)
export interface ShapeDirective {
  profileIndex:   number;
  holdRemainingS: number;
  dummyPpsX10:    number;
  jitterBudgetMs: number;
  padTargetBytes: number;
  entropyMode:    0 | 1 | 2;
  sessionNonce:   Buffer;
}

// ── Profile cache ─────────────────────────────────────────────────────────────

let _cachedProfiles: GhostStreamProfile[] | null = null;
let _cacheExpiry = 0;

async function getProfiles(): Promise<GhostStreamProfile[]> {
  if (_cachedProfiles && Date.now() < _cacheExpiry) return _cachedProfiles;
  const rows = await db
    .select()
    .from(ghoststreamProfilesTable)
    .where(eq(ghoststreamProfilesTable.enabled, true));
  _cachedProfiles = rows.map(r => ({
    id:              r.id,
    name:            r.name,
    sizeCdf:         (r.sizeCdf as unknown as number[]) ?? [],
    iatCdf:          (r.iatCdf as unknown as number[]) ?? [],
    burstMinPackets: r.burstMinPackets,
    burstMaxPackets: r.burstMaxPackets,
    burstGapMinMs:   r.burstGapMinMs,
    burstGapMaxMs:   r.burstGapMaxMs,
    dummyPps:        r.dummyPps ?? 0.5,
    holdMinS:        r.holdMinS,
    holdMaxS:        r.holdMaxS,
  }));
  _cacheExpiry = Date.now() + 60_000;
  return _cachedProfiles;
}

// ── Profile rotation ──────────────────────────────────────────────────────────

function selectNextProfile(
  profiles:  GhostStreamProfile[],
  currentId: string,
): { profile: GhostStreamProfile; holdS: number } {
  const candidates = profiles.filter(p => p.id !== currentId);
  const pool = candidates.length > 0 ? candidates : profiles;
  const idx = crypto.randomBytes(2).readUInt16BE(0) % pool.length;
  const p = pool[idx]!;
  const holdRange = p.holdMaxS - p.holdMinS + 1;
  const holdS = p.holdMinS + (crypto.randomBytes(2).readUInt16BE(0) % holdRange);
  return { profile: p, holdS };
}

function buildDirective(
  profiles:     GhostStreamProfile[],
  profile:      GhostStreamProfile,
  holdS:        number,
): ShapeDirective {
  const profileIndex = profiles.findIndex(p => p.id === profile.id);
  const rand1 = crypto.randomBytes(2).readUInt16BE(0) / 65535;
  const sizeIdx = profile.sizeCdf.findIndex(v => v >= rand1);
  const padTargetBytes = Math.round(40 + ((sizeIdx >= 0 ? sizeIdx : 0) / 19) * 1460);
  return {
    profileIndex:   profileIndex >= 0 ? profileIndex : 0,
    holdRemainingS: holdS,
    dummyPpsX10:    Math.round((profile.dummyPps ?? 0.5) * 10),
    jitterBudgetMs: 8,
    padTargetBytes,
    entropyMode:    2,
    sessionNonce:   crypto.randomBytes(5),
  };
}

/**
 * Initialize or rotate a GhostStream session for a user's active WireGuard config.
 * Returns the ShapeDirective to embed in the next WireGuard packet.
 */
export async function rotateGhostStreamProfile(
  userId:   string,
  configId: number,
): Promise<ShapeDirective> {
  const profiles = await getProfiles();
  if (profiles.length === 0) {
    throw new Error("[GhostStream] No profiles configured — seed ghoststream_profiles table");
  }

  const [existing] = await db
    .select({ currentProfile: ghoststreamSessionsTable.currentProfile })
    .from(ghoststreamSessionsTable)
    .where(
      and(
        eq(ghoststreamSessionsTable.userId, userId),
        eq(ghoststreamSessionsTable.configId, configId),
      )
    );

  const currentId = existing?.currentProfile ?? "";
  const { profile, holdS } = selectNextProfile(profiles, currentId);
  const profileUntil = new Date(Date.now() + holdS * 1000);
  const sessionKey   = crypto.randomBytes(32).toString("hex");

  await db
    .insert(ghoststreamSessionsTable)
    .values({
      userId,
      configId,
      currentProfile:  profile.id,
      profileUntil,
      sessionKey,
      morphingEnabled: true,
    })
    .onConflictDoUpdate({
      target: [ghoststreamSessionsTable.userId, ghoststreamSessionsTable.configId],
      set: {
        currentProfile: profile.id,
        profileUntil,
        sessionKey,
      },
    });

  appendAuditEvent({
    actor:    userId,
    action:   "ghoststream.profile_rotated",
    resource: `wg_config:${configId}`,
    result:   "allow",
    metadata: { profile: profile.name, holdS },
  });

  logger.info({ userId, configId, profile: profile.name, holdS }, "[GhostStream] Profile rotated");
  return buildDirective(profiles, profile, holdS);
}

/**
 * Get the current active directive for a user's config.
 * Returns null if no session exists or morphing is disabled.
 */
export async function getActiveDirective(
  userId:   string,
  configId: number,
): Promise<ShapeDirective | null> {
  const [session] = await db
    .select()
    .from(ghoststreamSessionsTable)
    .where(
      and(
        eq(ghoststreamSessionsTable.userId, userId),
        eq(ghoststreamSessionsTable.configId, configId),
        eq(ghoststreamSessionsTable.morphingEnabled, true),
      )
    );

  if (!session) return null;

  if (new Date(session.profileUntil) < new Date()) {
    return rotateGhostStreamProfile(userId, configId);
  }

  const profiles = await getProfiles();
  const profileIndex = profiles.findIndex(p => p.id === session.currentProfile);
  const profile = profiles[profileIndex >= 0 ? profileIndex : 0] ?? profiles[0]!;
  const remainingS = Math.max(
    0,
    Math.round((new Date(session.profileUntil).getTime() - Date.now()) / 1000),
  );
  return buildDirective(profiles, profile, remainingS);
}

/**
 * Find all expired GhostStream sessions (for the rotation worker).
 */
export async function getExpiredSessions(): Promise<Array<{ userId: string; configId: number }>> {
  return db
    .select({
      userId:   ghoststreamSessionsTable.userId,
      configId: ghoststreamSessionsTable.configId,
    })
    .from(ghoststreamSessionsTable)
    .where(
      and(
        lt(ghoststreamSessionsTable.profileUntil, new Date()),
        eq(ghoststreamSessionsTable.morphingEnabled, true),
      )
    );
}

/**
 * Serialize a ShapeDirective into 16 bytes for embedding in WireGuard payload.
 */
export function encodeShapeDirective(d: ShapeDirective): Buffer {
  const buf = Buffer.alloc(16);
  buf.writeUInt16LE(d.profileIndex,    0);
  buf.writeUInt16LE(d.holdRemainingS,  2);
  buf.writeUInt16LE(d.dummyPpsX10,     4);
  buf.writeUInt16LE(d.jitterBudgetMs,  6);
  buf.writeUInt16LE(d.padTargetBytes,  8);
  buf.writeUInt8(d.entropyMode,        10);
  d.sessionNonce.copy(buf, 11);
  return buf;
}

/**
 * Parse 16 bytes back into a ShapeDirective.
 */
export function decodeShapeDirective(buf: Buffer): ShapeDirective {
  return {
    profileIndex:   buf.readUInt16LE(0),
    holdRemainingS: buf.readUInt16LE(2),
    dummyPpsX10:    buf.readUInt16LE(4),
    jitterBudgetMs: buf.readUInt16LE(6),
    padTargetBytes: buf.readUInt16LE(8),
    entropyMode:    buf.readUInt8(10) as 0 | 1 | 2,
    sessionNonce:   buf.subarray(11, 16),
  };
}
