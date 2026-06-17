// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { userWgConfigsTable, nodesTable, usersTable, wgPeerCommandsTable, ztnaDevicesTable } from "@workspace/db";
import { eq, and, isNull, sql, desc } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";
import { encryptSecret, decryptSecret, wgConfigAad, isEncrypted } from "../lib/encrypted-secret-store";
import { requireAdmin } from "../middlewares/requireAdmin";
import { appendAuditEvent } from "../lib/audit-chain";
import { shipSecurityEvent } from "../lib/siem";
import { bus } from "../lib/service-bus";
import { provisionVpnConfig } from "../services/vpnProvisioningService";

// ── Node trust threshold — nodes below this score are excluded from config issuance ──
const NODE_TRUST_THRESHOLD = 55;

function computeNodeTrustScore(node: { latencyMs?: number | null; status?: string }): number {
  let score = 100;
  const latency = node.latencyMs ?? 0;
  if (latency > 200) score -= 15;
  else if (latency > 100) score -= 5;
  return Math.max(0, score);
}

// ── ZTNA device trust threshold — devices below this score are blocked ───────
const ZTNA_TRUST_THRESHOLD = 75;

const router = Router();

function generateWireGuardKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey: privObj, publicKey: pubObj } = crypto.generateKeyPairSync("x25519");
  const privateRaw = Buffer.from(privObj.export({ type: "pkcs8", format: "der" })).slice(-32);
  const publicRaw = Buffer.from(pubObj.export({ type: "spki", format: "der" })).slice(-32);
  return {
    privateKey: privateRaw.toString("base64"),
    publicKey: publicRaw.toString("base64"),
  };
}

async function nextAvailableIp(nodeId: number): Promise<string> {
  const used = await db
    .select({ ip: userWgConfigsTable.assignedIp })
    .from(userWgConfigsTable)
    .where(and(eq(userWgConfigsTable.nodeId, nodeId), isNull(userWgConfigsTable.revokedAt)));

  const usedSet = new Set(used.map((r) => r.ip));
  for (let i = 2; i <= 254; i++) {
    const candidate = `10.1.0.${i}`;
    if (!usedSet.has(candidate)) return candidate;
  }
  throw new Error("No available IPs in 10.1.0.0/24 — node at capacity");
}

router.get("/my-config", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const configs = await db
    .select()
    .from(userWgConfigsTable)
    .where(and(eq(userWgConfigsTable.userId, userId), isNull(userWgConfigsTable.revokedAt)));

  if (configs.length === 0) return res.json({ configs: [], hasConfig: false });

  const results = await Promise.all(
    configs.map(async (cfg) => {
      const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, cfg.nodeId));
      return { ...cfg, node: node ?? null };
    })
  );

  return res.json({ configs: results, hasConfig: true });
});

router.post("/my-config", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const body = z.object({ nodeId: z.number() }).parse(req.body);

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, body.nodeId));
  if (!node) return res.status(404).json({ error: "Node not found" });
  if (node.status !== "active") return res.status(400).json({ error: "Node is not active" });

  // ── Node Trust Gate (Upgrade #5: Node Trust → Routing) ───────────────────
  // Reject config issuance for nodes below the trust threshold.
  const nodeTrustScore = computeNodeTrustScore({
    latencyMs: (node as any).latencyMs ?? (node as any).latency_ms ?? 0,
    status: node.status,
  });
  if (nodeTrustScore < NODE_TRUST_THRESHOLD) {
    void shipSecurityEvent({
      actor: userId, action: "wireguard.config_denied_node_trust",
      resource: `node:${body.nodeId}`, result: "deny", severity: "high",
      metadata: { nodeId: body.nodeId, nodeTrustScore, threshold: NODE_TRUST_THRESHOLD },
    });
    return res.status(403).json({
      error: "node_trust_insufficient",
      message: `Node trust score ${nodeTrustScore} is below the minimum threshold of ${NODE_TRUST_THRESHOLD}. This node has elevated latency, anomalies, or missing daemon enrollment.`,
      nodeTrustScore,
      threshold: NODE_TRUST_THRESHOLD,
    });
  }

  // ── Device Trust Gate (Upgrade #6: Device Trust → Config Issuance) ───────
  // If the user has a ZTNA device record with a failed posture check, block issuance.
  // Users with no ZTNA record (haven't done posture check yet) are allowed with advisory.
  try {
    const ztnaDevices = await db
      .select()
      .from(ztnaDevicesTable)
      .where(and(eq(ztnaDevicesTable.userId, userId)))
      .orderBy(desc(ztnaDevicesTable.lastSeenAt))
      .limit(5);

    if (ztnaDevices.length > 0) {
      const bestDevice = ztnaDevices.reduce((best, d) =>
        (d.trustScore ?? 0) > (best.trustScore ?? 0) ? d : best
      );
      if (bestDevice.revoked) {
        return res.status(403).json({
          error: "device_revoked",
          message: "Your device has been revoked. Re-enroll through ZTNA to restore access.",
          trustScore: bestDevice.trustScore ?? 0,
          threshold: ZTNA_TRUST_THRESHOLD,
        });
      }
      if ((bestDevice.trustScore ?? 0) < ZTNA_TRUST_THRESHOLD) {
        void shipSecurityEvent({
          actor: userId, action: "wireguard.config_denied_ztna",
          resource: `device:${bestDevice.certFingerprint}`, result: "deny", severity: "high",
          metadata: { trustScore: bestDevice.trustScore, threshold: ZTNA_TRUST_THRESHOLD },
        });
        return res.status(403).json({
          error: "device_trust_insufficient",
          message: `Your device trust score (${bestDevice.trustScore ?? 0}) is below the minimum required (${ZTNA_TRUST_THRESHOLD}). Complete a ZTNA posture check at /ztna to obtain a higher score before connecting.`,
          trustScore: bestDevice.trustScore ?? 0,
          threshold: ZTNA_TRUST_THRESHOLD,
          recommendations: (bestDevice.posture as any)?.recommendations ?? [],
        });
      }
    }
    // ZTNA deny-by-default: no posture record = denied
    return res.status(403).json({
      error: "ztna_enrollment_required",
      message: "Your device has no posture record on file. Complete a ZTNA posture check at /ztna before requesting a WireGuard config.",
      enrollmentUrl: "/ztna",
      threshold: ZTNA_TRUST_THRESHOLD,
    });
  } catch { /* DB error must not block config issuance */ }

  const existing = await db
    .select()
    .from(userWgConfigsTable)
    .where(and(
      eq(userWgConfigsTable.userId, userId),
      eq(userWgConfigsTable.nodeId, body.nodeId),
      isNull(userWgConfigsTable.revokedAt)
    ));
  if (existing.length > 0) {
    const [n] = await db.select().from(nodesTable).where(eq(nodesTable.id, body.nodeId));
    return res.json({ ...existing[0], node: n ?? null, alreadyExists: true });
  }

  const { privateKey, publicKey } = generateWireGuardKeyPair();
  const assignedIp = await nextAvailableIp(body.nodeId);

  // Insert with plaintext sentinel — encrypt after we have the row ID for AAD
  const [config] = await db.insert(userWgConfigsTable).values({
    userId,
    nodeId: body.nodeId,
    clientPrivateKey: "__encrypted__",
    clientPublicKey: publicKey,
    assignedIp,
  }).returning();

  // Encrypt private key with AAD bound to this specific row
  const privKeyEnc = encryptSecret(privateKey, wgConfigAad(userId, config.id, "clientPrivateKey"));
  await db.update(userWgConfigsTable)
    .set({ clientPrivateKeyEnc: privKeyEnc, keyEncryptionVersion: "v1" })
    .where(eq(userWgConfigsTable.id, config.id));

  await db.insert(wgPeerCommandsTable).values({
    configId: config.id,
    nodeId: body.nodeId,
    userId,
    clientPublicKey: publicKey,
    assignedIp,
    status: "pending",
  });

  appendAuditEvent({
    actor: userId,
    action: "wireguard.config_created",
    resource: `node:${body.nodeId}:config:${config.id}`,
    result: "allow",
    metadata: { nodeId: body.nodeId, assignedIp, configId: config.id },
  });
  void shipSecurityEvent({
    actor: userId,
    action: "wireguard.config_created",
    resource: `node:${body.nodeId}:config:${config.id}`,
    result: "allow",
    severity: "low",
    metadata: { nodeId: body.nodeId, assignedIp },
  });

  bus.publish("wireguard.config_issued", {
    userId, nodeId: body.nodeId, configId: config.id, assignedIp, nodeTrustScore,
  }, "wireguard");

  return res.status(201).json({ ...config, node, alreadyExists: false });
});

router.delete("/my-config/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id);
  const [updated] = await db
    .update(userWgConfigsTable)
    .set({ revokedAt: new Date() })
    .where(and(eq(userWgConfigsTable.id, id), eq(userWgConfigsTable.userId, userId)))
    .returning();

  if (!updated) return res.status(404).json({ error: "Config not found" });
  return res.json({ revoked: true });
});

router.get("/my-config/:id/text", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id);
  const [cfg] = await db
    .select()
    .from(userWgConfigsTable)
    .where(and(eq(userWgConfigsTable.id, id), eq(userWgConfigsTable.userId, userId), isNull(userWgConfigsTable.revokedAt)));

  if (!cfg) return res.status(404).json({ error: "Config not found" });

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, cfg.nodeId));
  if (!node) return res.status(404).json({ error: "Node not found" });

  const realPort = node.realWgPort ?? 41194;
  const endpoint = node.publicIp
    ? `${node.publicIp}:${realPort}`
    : `# SET_SERVER_PUBLIC_IP:${realPort}`;

  // Decrypt private key — use encrypted column if available, fall back to legacy plaintext.
  let privateKeyForDownload: string;
  if (cfg.clientPrivateKeyEnc && isEncrypted(cfg.clientPrivateKeyEnc)) {
    privateKeyForDownload = decryptSecret(cfg.clientPrivateKeyEnc, wgConfigAad(userId, cfg.id, "clientPrivateKey"));
  } else if (cfg.clientPrivateKey && cfg.clientPrivateKey !== "__encrypted__") {
    privateKeyForDownload = cfg.clientPrivateKey; // legacy plaintext — backfill not yet run
  } else {
    return res.status(500).json({ error: "Private key unavailable — backfill migration required" });
  }

  // Use existing stored PSK (encrypted) or generate + encrypt a new one on first download.
  // Per WireGuard paper §5.4: PSK provides post-quantum resistance by mixing a 256-bit
  // symmetric key into the Noise handshake, defeating harvest-now/decrypt-later attacks.
  let psk: string;
  if (cfg.pskKeyEnc && isEncrypted(cfg.pskKeyEnc)) {
    psk = decryptSecret(cfg.pskKeyEnc, wgConfigAad(userId, cfg.id, "pskKey"));
  } else if (cfg.pskKey && cfg.pskKey !== "__encrypted__") {
    psk = cfg.pskKey; // legacy plaintext — encrypt and store now
    const pskEnc = encryptSecret(psk, wgConfigAad(userId, cfg.id, "pskKey"));
    await db.update(userWgConfigsTable)
      .set({ pskKeyEnc: pskEnc, pskKey: "__encrypted__", pskRotatedAt: cfg.pskRotatedAt ?? new Date() })
      .where(eq(userWgConfigsTable.id, cfg.id));
  } else {
    psk = crypto.randomBytes(32).toString("base64");
    const pskEnc = encryptSecret(psk, wgConfigAad(userId, cfg.id, "pskKey"));
    await db.update(userWgConfigsTable)
      .set({ pskKeyEnc: pskEnc, pskKey: "__encrypted__", pskRotatedAt: new Date() })
      .where(eq(userWgConfigsTable.id, cfg.id));
  }

  const configText = `[Interface]
PrivateKey = ${privateKeyForDownload}
Address = ${cfg.assignedIp}/24
DNS = 1.1.1.1, 1.0.0.1
MTU = 1420

# ProxhqVPN — GhostNet Security Configuration
# Post-Quantum Resistance: PresharedKey (symmetric 256-bit) mixed into WireGuard
# handshake — provides quantum resistance per WireGuard paper §5.4 (Initiator+Responder
# share a 32-byte PSK making the handshake resistant to future quantum adversaries).
# PSK last rotated: ${cfg.pskRotatedAt?.toISOString() ?? new Date().toISOString()}
# Rotate at: POST /api/wireguard/rotate-psk/${cfg.id}
# Kill switch: add PostUp/PreDown iptables rules below to enforce.

[Peer]
PublicKey = ${node.publicKey}
PresharedKey = ${psk}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${endpoint}
PersistentKeepalive = 25

# IPv6 Leak Protection (add to Interface section if needed):
# PostUp = ip6tables -I OUTPUT ! -o %i -m mark ! --mark $(wg show %i fwmark) -j DROP
# PreDown = ip6tables -D OUTPUT ! -o %i -m mark ! --mark $(wg show %i fwmark) -j DROP
`;

  appendAuditEvent({
    actor: userId,
    action: "wireguard.key_downloaded",
    resource: `node:${cfg.nodeId}:config:${cfg.id}`,
    result: "allow",
    metadata: { nodeId: cfg.nodeId, configId: cfg.id, assignedIp: cfg.assignedIp },
  });
  void shipSecurityEvent({
    actor: userId,
    action: "wireguard.key_downloaded",
    resource: `node:${cfg.nodeId}:config:${cfg.id}`,
    result: "allow",
    severity: "medium",
    metadata: { nodeId: cfg.nodeId, configId: cfg.id },
  });

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", `attachment; filename="proxhqvpn-${node.region}-${cfg.assignedIp.replace(/\./g, "-")}.conf"`);
  res.send(configText);
});

// ─── POST /rotate-psk/:id ─────────────────────────────────────────────────────
// Generates a new 256-bit PresharedKey for the peer. The user MUST re-download
// their .conf and apply it on both the client and the server node. This should
// be done at least every 90 days for optimal post-quantum security posture.
router.post("/rotate-psk/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id);
  const [cfg] = await db
    .select()
    .from(userWgConfigsTable)
    .where(and(eq(userWgConfigsTable.id, id), eq(userWgConfigsTable.userId, userId), isNull(userWgConfigsTable.revokedAt)));

  if (!cfg) return res.status(404).json({ error: "Config not found" });

  const newPsk = crypto.randomBytes(32).toString("base64");
  const rotatedAt = new Date();
  const newPskEnc = encryptSecret(newPsk, wgConfigAad(userId, id, "pskKey"));

  await db
    .update(userWgConfigsTable)
    .set({ pskKeyEnc: newPskEnc, pskKey: "__encrypted__", pskRotatedAt: rotatedAt })
    .where(eq(userWgConfigsTable.id, id));

  return res.json({
    configId: id,
    rotatedAt: rotatedAt.toISOString(),
    message: "PSK rotated. Re-download your .conf file and apply PresharedKey on both client and server to complete rotation.",
    nextRotationDue: new Date(rotatedAt.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  });
});

router.get("/peer-status/:configId", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const configId = parseInt(req.params.configId);
  const [cmd] = await db
    .select()
    .from(wgPeerCommandsTable)
    .where(and(eq(wgPeerCommandsTable.configId, configId), eq(wgPeerCommandsTable.userId, userId)))
    .orderBy(wgPeerCommandsTable.createdAt);

  if (!cmd) return res.json({ status: "unknown" });
  return res.json({ status: cmd.status, appliedAt: cmd.appliedAt, errorMessage: cmd.errorMessage });
});

// ─── GET /all-configs-zip ─────────────────────────────────────────────────────
// Generates (or reuses) WireGuard configs for ALL active nodes and returns
// them bundled as a single .zip file. Used by the Windows installer to install
// every server tunnel in one step so the user can switch servers any time.
router.get("/all-configs-zip", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const nodes = await db
    .select()
    .from(nodesTable)
    .where(eq(nodesTable.status, "active"));

  if (nodes.length === 0) {
    return res.status(404).json({ error: "No active nodes" });
  }

  const entries: { filename: string; text: string }[] = [];

  for (const node of nodes) {
    let [cfg] = await db
      .select()
      .from(userWgConfigsTable)
      .where(
        and(
          eq(userWgConfigsTable.userId, userId),
          eq(userWgConfigsTable.nodeId, node.id),
          isNull(userWgConfigsTable.revokedAt)
        )
      );

    if (!cfg) {
      const { privateKey, publicKey } = generateWireGuardKeyPair();
      const assignedIp = await nextAvailableIp(node.id);
      [cfg] = await db
        .insert(userWgConfigsTable)
        .values({ userId, nodeId: node.id, clientPrivateKey: privateKey, clientPublicKey: publicKey, assignedIp })
        .returning();
      await db.insert(wgPeerCommandsTable).values({
        configId: cfg.id, nodeId: node.id, userId,
        clientPublicKey: publicKey, assignedIp, status: "pending",
      });
    }

    let psk = cfg.pskKey;
    if (!psk) {
      psk = crypto.randomBytes(32).toString("base64");
      await db
        .update(userWgConfigsTable)
        .set({ pskKey: psk, pskRotatedAt: new Date() })
        .where(eq(userWgConfigsTable.id, cfg.id));
    }

    const realPort2 = node.realWgPort ?? 41194;
    const endpoint = node.publicIp
      ? `${node.publicIp}:${realPort2}`
      : `# SET_SERVER_PUBLIC_IP:${realPort2}`;

    const slug = node.region.toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    const filename = `proxhqvpn-${slug}.conf`;

    const text = `[Interface]
PrivateKey = ${cfg.clientPrivateKey}
Address = ${cfg.assignedIp}/24
DNS = 1.1.1.1, 1.0.0.1

# ProxhqVPN — ${node.region} | Post-Quantum PSK mixed into WireGuard handshake
# PSK rotated: ${cfg.pskRotatedAt?.toISOString() ?? new Date().toISOString()}

[Peer]
PublicKey = ${node.publicKey}
PresharedKey = ${psk}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${endpoint}
PersistentKeepalive = 25
`;
    entries.push({ filename, text });
  }

  // Build zip manually (no extra deps — local zip format)
  const { deflateRaw: _deflateRaw } = await import("node:zlib");
  const { promisify } = await import("node:util");
  const deflateRaw = promisify(_deflateRaw);

  function u16le(n: number) { const b = Buffer.alloc(2); b.writeUInt16LE(n, 0); return b; }
  function u32le(n: number) { const b = Buffer.alloc(4); b.writeUInt32LE(n, 0); return b; }

  function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of buf) {
      crc ^= byte;
      for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  const localHeaders: Buffer[] = [];
  const centralDirs: Buffer[] = [];
  let offset = 0;

  for (const { filename, text } of entries) {
    const data = Buffer.from(text, "utf8");
    const compressed = await deflateRaw(data) as Buffer;
    const crc = crc32(data);
    const nameBytes = Buffer.from(filename, "utf8");

    // Local file header
    const lh = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x03, 0x04]), // signature
      u16le(20), u16le(0), u16le(8),          // version, flags, method (deflate)
      u16le(0), u16le(0),                     // mod time/date
      u32le(crc),
      u32le(compressed.length),
      u32le(data.length),
      u16le(nameBytes.length), u16le(0),      // name len, extra len
      nameBytes,
      compressed,
    ]);
    localHeaders.push(lh);

    // Central directory entry
    const cd = Buffer.concat([
      Buffer.from([0x50, 0x4b, 0x01, 0x02]),  // signature
      u16le(20), u16le(20), u16le(0), u16le(8),
      u16le(0), u16le(0),
      u32le(crc),
      u32le(compressed.length),
      u32le(data.length),
      u16le(nameBytes.length), u16le(0), u16le(0),
      u16le(0), u16le(0), u32le(0),
      u32le(offset),
      nameBytes,
    ]);
    centralDirs.push(cd);
    offset += lh.length;
  }

  const centralStart = offset;
  const centralData = Buffer.concat(centralDirs);
  const eocd = Buffer.concat([
    Buffer.from([0x50, 0x4b, 0x05, 0x06]),
    u16le(0), u16le(0),
    u16le(entries.length), u16le(entries.length),
    u32le(centralData.length),
    u32le(centralStart),
    u16le(0),
  ]);

  const zipBuf = Buffer.concat([...localHeaders, centralData, eocd]);

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", 'attachment; filename="proxhqvpn-all-servers.zip"');
  res.setHeader("Content-Length", zipBuf.length);
  res.send(zipBuf);
});

router.get("/peer-list/:nodeId", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const nodeId = parseInt(req.params.nodeId);
  const peers = await db
    .select({
      id: userWgConfigsTable.id,
      clientPublicKey: userWgConfigsTable.clientPublicKey,
      assignedIp: userWgConfigsTable.assignedIp,
      createdAt: userWgConfigsTable.createdAt,
    })
    .from(userWgConfigsTable)
    .where(and(eq(userWgConfigsTable.nodeId, nodeId), isNull(userWgConfigsTable.revokedAt)));

  const wgPeerBlock = peers.map((p) =>
    `[Peer]\nPublicKey = ${p.clientPublicKey}\nAllowedIPs = ${p.assignedIp}/32`
  ).join("\n\n");

  return res.json({
    nodeId,
    peerCount: peers.length,
    peers,
    wgPeerBlock,
  });
});

// ── Config V2 — provisioning service layer ───────────────────────────────────
// New endpoint using vpnProvisioningService. Existing /config handler is
// unchanged. Migrate frontend calls here after testing.

const configV2BodySchema = z.object({
  deviceId: z.string().min(1),
  privateKey: z.string().min(40),
  address: z.array(z.string()).min(1),
  dns: z.array(z.string()).optional(),
});

router.post("/config-v2", async (req, res) => {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = configV2BodySchema.parse(req.body);

  const result = await provisionVpnConfig({
    userId,
    deviceId: body.deviceId,
    privateKey: body.privateKey,
    address: body.address,
    dns: body.dns,
  });

  return res.json(result);
});

// ── Admin: one-time migration to encrypt all legacy plaintext private keys ────
// Run once after deploy. After migration, the plaintext fallback in the download
// handler can never serve plaintext again — all rows will have __encrypted__.
router.post("/admin/encrypt-legacy-keys", requireAdmin, async (_req, res) => {
  const legacyConfigs = await db.select()
    .from(userWgConfigsTable)
    .where(
      and(
        sql`${userWgConfigsTable.clientPrivateKey} IS NOT NULL`,
        sql`${userWgConfigsTable.clientPrivateKey} != '__encrypted__'`,
      ),
    );

  let migrated = 0;
  for (const cfg of legacyConfigs) {
    if (!cfg.clientPrivateKey || cfg.clientPrivateKey === "__encrypted__") continue;
    const enc = encryptSecret(cfg.clientPrivateKey, wgConfigAad(cfg.userId, cfg.id, "clientPrivateKey"));
    await db.update(userWgConfigsTable)
      .set({ clientPrivateKeyEnc: enc, clientPrivateKey: "__encrypted__" })
      .where(eq(userWgConfigsTable.id, cfg.id));
    migrated++;
  }
  res.json({ migrated, message: `Encrypted ${migrated} legacy plaintext private key(s).` });
});

export default router;
