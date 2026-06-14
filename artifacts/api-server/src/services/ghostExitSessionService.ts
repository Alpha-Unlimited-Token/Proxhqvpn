// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Exit Session Service — lifecycle management for ephemeral ghost exit nodes.
//
// Privacy model:
//   STORED in DB: session ID, userId, region, exit IP (ghost node's IP), WG server pubkey,
//                 WG client pubkey, encrypted WG client privkey, session PSK, Vultr instance ID,
//                 status, probe count, timestamps.
//   NEVER STORED: user's real IP, traffic content, DNS queries visited,
//                 WireGuard server private key (exists only in node RAM + Vultr user-data).
//   ON DESTROY:   Vultr instance deleted → RAM cleared → WG server privkey irrecoverably gone.
//                 Vultr wipes disk on reallocation. Only DB session metadata remains.

import crypto from "crypto";
import { db } from "@workspace/db";
import { ghostExitSessionsTable, ghostNodesTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { createInstance, destroyInstance } from "../lib/vultr-client";
import { generateGhostExitUserData } from "../lib/ghostExitNodeUserData";
import { encryptSecret, decryptSecret } from "../lib/encrypted-secret-store";
import { logger } from "../lib/logger";

const WG_CLIENT_IP   = "10.99.0.2";
const WG_LISTEN_PORT = 51820;

// ── WireGuard key generation (pure Node.js — no wg binary required) ──────────
// X25519 PKCS8 DER layout: 16-byte header + 32-byte raw key
// X25519 SPKI  DER layout: 12-byte header + 32-byte raw key
function genWgKeypair(): { privKey: string; pubKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("x25519");
  const privDer = privateKey.export({ type: "pkcs8", format: "der" }) as Buffer;
  const pubDer  = publicKey.export({ type: "spki",  format: "der" }) as Buffer;
  return {
    privKey: privDer.slice(16).toString("base64"),
    pubKey:  pubDer.slice(12).toString("base64"),
  };
}

// ── Callback base URL for Vultr node → ProxhqVPN registration ────────────────
function getCallbackBaseUrl(): string {
  const domains = process.env["REPLIT_DOMAINS"];
  if (domains) {
    const primary = domains.split(",")[0]!.trim();
    return `https://${primary}`;
  }
  return process.env["PROXHQ_API_URL"] ?? "https://localhost:8080";
}

// ── Build WireGuard .conf for the client ─────────────────────────────────────
export function buildWgClientConfig(opts: {
  clientPrivKey:  string;
  serverPubKey:   string;
  clientIp:       string;
  exitIp:         string | null;
  region:         string;
  sessionId:      string;
  listenPort?:    number;
}): string {
  const endpoint = opts.exitIp
    ? `${opts.exitIp}:${opts.listenPort ?? WG_LISTEN_PORT}`
    : "PENDING — node still provisioning, check back in ~60s";

  return [
    "[Interface]",
    `PrivateKey = ${opts.clientPrivKey}`,
    `Address = ${opts.clientIp}/32`,
    "DNS = 1.1.1.1, 1.0.0.1",
    "",
    `[Peer]`,
    `# ProxhqVPN Ghost Exit Node — ${opts.region.toUpperCase()}`,
    `# Session: ${opts.sessionId}`,
    `# RAM-only node — all keys wiped on disconnect`,
    `PublicKey = ${opts.serverPubKey}`,
    `Endpoint = ${endpoint}`,
    "AllowedIPs = 0.0.0.0/0, ::/0",
    "PersistentKeepalive = 25",
    "",
  ].join("\n");
}

// ── Provision a new ghost exit session ───────────────────────────────────────
export interface ProvisionResult {
  sessionId:       string;
  status:          string;
  region:          string;
  wgConfig:        string;   // complete WireGuard .conf (client privkey included once)
  estimatedReadySecs: number;
}

export async function provisionGhostExitSession(opts: {
  userId: string;
  region: string;
}): Promise<ProvisionResult> {
  const serverKeys  = genWgKeypair();
  const clientKeys  = genWgKeypair();
  const sessionPsk  = crypto.randomBytes(32).toString("hex");

  // Insert session to get UUID
  const [session] = await db.insert(ghostExitSessionsTable).values({
    userId:         opts.userId,
    region:         opts.region,
    wgServerPubkey: serverKeys.pubKey,
    wgClientPubkey: clientKeys.pubKey,
    wgClientIp:     WG_CLIENT_IP,
    sessionPsk,
    status:         "provisioning",
  }).returning();

  const sessionId = session.id;

  // Encrypt client private key with AAD bound to this session
  const clientPrivkeyEnc = encryptSecret(
    clientKeys.privKey,
    `ghost_exit_sessions:${opts.userId}:${sessionId}:wgClientPrivkey`,
  );
  await db.update(ghostExitSessionsTable)
    .set({ wgClientPrivkeyEnc: clientPrivkeyEnc })
    .where(eq(ghostExitSessionsTable.id, sessionId));

  // Build Vultr user-data script with real session ID
  const userData = generateGhostExitUserData({
    sessionId,
    sessionPsk,
    wgServerPrivKey: serverKeys.privKey,
    wgClientPubKey:  clientKeys.pubKey,
    wgClientIp:      WG_CLIENT_IP,
    callbackBaseUrl: getCallbackBaseUrl(),
    listenPort:      WG_LISTEN_PORT,
  });

  // Provision Vultr instance
  try {
    const instance = await createInstance({
      region:   opts.region,
      label:    `proxhq-ghost-exit-${sessionId.slice(0, 8)}`,
      hostname: `ghost-${sessionId.slice(0, 8)}`,
      userData,
      tags:     ["proxhq-ghost-exit", `session-${sessionId.slice(0, 8)}`],
    });
    await db.update(ghostExitSessionsTable)
      .set({ vultrInstanceId: instance.id })
      .where(eq(ghostExitSessionsTable.id, sessionId));
    logger.info({ sessionId, vultrInstanceId: instance.id, region: opts.region }, "[GhostExit] Vultr instance provisioned");
  } catch (err: any) {
    await db.update(ghostExitSessionsTable)
      .set({ status: "error" })
      .where(eq(ghostExitSessionsTable.id, sessionId));
    logger.error({ err: err.message, sessionId }, "[GhostExit] Vultr provision failed");
    throw new Error(`Vultr provisioning failed: ${err.message ?? "unknown"}`);
  }

  const wgConfig = buildWgClientConfig({
    clientPrivKey: clientKeys.privKey,
    serverPubKey:  serverKeys.pubKey,
    clientIp:      WG_CLIENT_IP,
    exitIp:        null,
    region:        opts.region,
    sessionId,
  });

  return { sessionId, status: "provisioning", region: opts.region, wgConfig, estimatedReadySecs: 75 };
}

// ── Node registration callback (called by the Vultr node itself) ──────────────
export async function registerNodeCallback(
  sessionId: string,
  psk: string,
  exitIp: string,
  serverPubkey: string,
): Promise<{ ok: boolean; reason?: string }> {
  const [session] = await db.select()
    .from(ghostExitSessionsTable)
    .where(eq(ghostExitSessionsTable.id, sessionId))
    .limit(1);
  if (!session) return { ok: false, reason: "session_not_found" };

  // Timing-safe PSK comparison
  const expected = Buffer.from(session.sessionPsk ?? "", "utf8");
  const given    = Buffer.from(psk, "utf8");
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return { ok: false, reason: "invalid_psk" };
  }

  if (session.status === "destroyed" || session.status === "error") {
    return { ok: false, reason: "session_ended" };
  }

  await db.update(ghostExitSessionsTable)
    .set({ exitIp, wgServerPubkey: serverPubkey, status: "ready", readyAt: new Date() })
    .where(eq(ghostExitSessionsTable.id, sessionId));

  logger.info({ sessionId, exitIp }, "[GhostExit] Node registered — session ready");
  return { ok: true };
}

// ── Get session with decrypted WG config ─────────────────────────────────────
export async function getSessionConfig(sessionId: string, userId: string): Promise<{
  session: typeof ghostExitSessionsTable.$inferSelect;
  wgConfig: string | null;
} | null> {
  const [session] = await db.select()
    .from(ghostExitSessionsTable)
    .where(and(eq(ghostExitSessionsTable.id, sessionId), eq(ghostExitSessionsTable.userId, userId)))
    .limit(1);
  if (!session) return null;

  let wgConfig: string | null = null;
  if (session.wgClientPrivkeyEnc && session.wgServerPubkey) {
    try {
      const clientPrivKey = decryptSecret(
        session.wgClientPrivkeyEnc,
        `ghost_exit_sessions:${userId}:${sessionId}:wgClientPrivkey`,
      );
      wgConfig = buildWgClientConfig({
        clientPrivKey,
        serverPubKey:  session.wgServerPubkey,
        clientIp:      session.wgClientIp ?? WG_CLIENT_IP,
        exitIp:        session.exitIp,
        region:        session.region,
        sessionId,
      });
    } catch {
      wgConfig = null;
    }
  }

  return { session, wgConfig };
}

// ── List sessions for a user ──────────────────────────────────────────────────
export async function listSessionsForUser(userId: string) {
  return db.select({
    id:             ghostExitSessionsTable.id,
    region:         ghostExitSessionsTable.region,
    exitIp:         ghostExitSessionsTable.exitIp,
    status:         ghostExitSessionsTable.status,
    probeCount:     ghostExitSessionsTable.probeCount,
    provisionedAt:  ghostExitSessionsTable.provisionedAt,
    readyAt:        ghostExitSessionsTable.readyAt,
    connectedAt:    ghostExitSessionsTable.connectedAt,
    endedAt:        ghostExitSessionsTable.endedAt,
    destroyedAt:    ghostExitSessionsTable.destroyedAt,
    burnReason:     ghostExitSessionsTable.burnReason,
  })
    .from(ghostExitSessionsTable)
    .where(eq(ghostExitSessionsTable.userId, userId))
    .orderBy(desc(ghostExitSessionsTable.provisionedAt))
    .limit(30);
}

// ── Destroy a session (disconnect) ───────────────────────────────────────────
export async function destroyExitSession(
  sessionId: string,
  userId: string,
  reason: string = "disconnect",
): Promise<void> {
  const [session] = await db.select()
    .from(ghostExitSessionsTable)
    .where(and(eq(ghostExitSessionsTable.id, sessionId), eq(ghostExitSessionsTable.userId, userId)))
    .limit(1);
  if (!session) throw new Error("Session not found or access denied");
  if (session.status === "destroyed") return;

  if (session.vultrInstanceId) {
    try {
      await destroyInstance(session.vultrInstanceId);
      logger.info({ sessionId, vultrInstanceId: session.vultrInstanceId }, "[GhostExit] Vultr instance destroyed — RAM cleared");
    } catch (err: any) {
      logger.warn({ err: err.message, sessionId }, "[GhostExit] Vultr destroy failed (marking session destroyed anyway)");
    }
  }

  await db.update(ghostExitSessionsTable)
    .set({ status: "destroyed", burnReason: reason, endedAt: new Date(), destroyedAt: new Date() })
    .where(eq(ghostExitSessionsTable.id, sessionId));
}

// ── Burn IP and reprovision in same region ────────────────────────────────────
export async function burnAndReprovision(
  sessionId: string,
  userId: string,
): Promise<ProvisionResult> {
  const [existing] = await db.select({ region: ghostExitSessionsTable.region })
    .from(ghostExitSessionsTable)
    .where(and(eq(ghostExitSessionsTable.id, sessionId), eq(ghostExitSessionsTable.userId, userId)))
    .limit(1);
  if (!existing) throw new Error("Session not found");

  await destroyExitSession(sessionId, userId, "burned");
  return provisionGhostExitSession({ userId, region: existing.region });
}

// ── Increment probe count (called from ghost node event ingestion) ────────────
export async function incrementProbeCount(sessionId: string): Promise<void> {
  await db.update(ghostExitSessionsTable)
    .set({ probeCount: sql`${ghostExitSessionsTable.probeCount} + 1` })
    .where(eq(ghostExitSessionsTable.id, sessionId));
}
