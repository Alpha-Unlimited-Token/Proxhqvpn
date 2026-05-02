// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { userWgConfigsTable, nodesTable, usersTable, wgPeerCommandsTable } from "@workspace/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

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

  const [config] = await db.insert(userWgConfigsTable).values({
    userId,
    nodeId: body.nodeId,
    clientPrivateKey: privateKey,
    clientPublicKey: publicKey,
    assignedIp,
  }).returning();

  await db.insert(wgPeerCommandsTable).values({
    configId: config.id,
    nodeId: body.nodeId,
    userId,
    clientPublicKey: publicKey,
    assignedIp,
    status: "pending",
  });

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

  const endpoint = node.publicIp
    ? `${node.publicIp}:${node.listenPort}`
    : `# SET_SERVER_PUBLIC_IP:${node.listenPort}`;

  // Use existing stored PSK or generate a new one on first download.
  // Storing the PSK allows rotation via POST /rotate-psk/:id without full re-provisioning.
  // Per WireGuard paper §5.4: PSK provides post-quantum resistance by mixing a 256-bit
  // symmetric key into the Noise handshake, defeating harvest-now/decrypt-later attacks.
  let psk = cfg.pskKey;
  if (!psk) {
    psk = crypto.randomBytes(32).toString("base64");
    await db
      .update(userWgConfigsTable)
      .set({ pskKey: psk, pskRotatedAt: new Date() })
      .where(eq(userWgConfigsTable.id, cfg.id));
  }

  const configText = `[Interface]
PrivateKey = ${cfg.clientPrivateKey}
Address = ${cfg.assignedIp}/24
DNS = 1.1.1.1, 1.0.0.1

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

  await db
    .update(userWgConfigsTable)
    .set({ pskKey: newPsk, pskRotatedAt: rotatedAt })
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

export default router;
