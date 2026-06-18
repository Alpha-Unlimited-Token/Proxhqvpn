// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { nodesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

const PSK = process.env.DAEMON_PSK;

function checkPsk(req: Request, res: Response): boolean {
  if (!PSK) { res.status(500).json({ error: "DAEMON_PSK not configured" }); return false; }
  const header = String(req.headers["x-daemon-psk"] ?? "");
  // Timing-safe comparison — prevents character-by-character oracle attacks
  if (header.length !== PSK.length) { res.status(401).json({ error: "Invalid PSK" }); return false; }
  const provided = Buffer.from(header);
  const expected = Buffer.from(PSK);
  if (!crypto.timingSafeEqual(provided, expected)) { res.status(401).json({ error: "Invalid PSK" }); return false; }
  return true;
}

/**
 * POST /api/node-provision
 * Called by the setup script running on a new VPN server.
 * Creates a node record, returns the assigned node ID and VPN subnet.
 */
router.post("/", async (req: Request, res: Response) => {
  if (!checkPsk(req, res)) return;

  const { publicKey, publicIp, region = "Unknown" } = req.body;
  if (!publicKey || !publicIp) {
    return res.status(400).json({ error: "publicKey and publicIp are required" });
  }

  // Check if this IP is already registered
  const existing = await db.select().from(nodesTable).where(eq(nodesTable.ipAddress, publicIp));
  if (existing.length > 0) {
    const node = existing[0];
    // Update the public key in case it changed
    await db.update(nodesTable)
      .set({ publicKey, publicIp, lastSeen: new Date() })
      .where(eq(nodesTable.id, node.id));
    const nodeVpnIp = `10.${Math.floor(node.id / 255)}.${node.id % 255}.1`;
    return res.json({
      nodeId: node.id,
      serverVpnIp: nodeVpnIp,
      vpnSubnet: `${nodeVpnIp.replace(".1", ".0")}/24`,
      listenPort: 51820,
      message: "Node already registered — updated",
    });
  }

  // Insert new node
  const [node] = await db.insert(nodesTable).values({
    name: `ProxhqVPN-${region.replace(/[^a-z0-9]/gi, "-")}-Node`,
    layer: "outer",
    hopIndex: 1,
    region,
    ipAddress: publicIp,
    publicKey,
    privateKey: "",          // private key stays on the server, never sent to us
    listenPort: 51820,
    status: "active",
    publicIp,
    hasBeacon: true,
    hasSpider: true,
    hasWorm: true,
  }).returning();

  // Derive a VPN subnet from the node ID: 10.(id/255).(id%255).0/24
  // e.g., id=62 → 10.0.62.0/24, server gets 10.0.62.1
  const nodeVpnIp = `10.${Math.floor(node.id / 255)}.${node.id % 255}.1`;

  res.json({
    nodeId: node.id,
    serverVpnIp: nodeVpnIp,
    vpnSubnet: `${nodeVpnIp.replace(".1", ".0")}/24`,
    listenPort: 51820,
    message: "Node registered successfully",
  });
});

/**
 * GET /api/node-provision/status/:nodeId
 * Quick check that a node is provisioned.
 */
router.get("/status/:nodeId", async (req: Request, res: Response) => {
  if (!checkPsk(req, res)) return;
  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, parseInt(String(req.params.nodeId))));
  if (!node) return res.status(404).json({ error: "Node not found" });
  res.json({ nodeId: node.id, region: node.region, status: node.status, ipAddress: node.ipAddress });
});

export default router;
