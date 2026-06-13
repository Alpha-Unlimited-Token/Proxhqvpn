// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { devicesTable, nodesTable } from "@workspace/db/schema";
import { eq, isNotNull, and } from "drizzle-orm";
import { z } from "zod";
import { bus } from "../lib/service-bus";

const router = Router();

function allocateIp(usedIps: string[]): string {
  for (let i = 2; i <= 254; i++) {
    const candidate = `10.8.0.${i}`;
    if (!usedIps.includes(candidate)) return candidate;
  }
  return `10.8.0.2`;
}

router.get("/", async (_req, res) => {
  const devices = await db.select().from(devicesTable).orderBy(devicesTable.createdAt);
  res.json(devices);
});

router.post("/", async (req, res) => {
  const body = z.object({
    name: z.string().min(1).max(64),
    type: z.enum(["windows","macos","linux","ios","android","android-tv","fire-tv","apple-tv","smart-tv","router","browser","other"]).default("other"),
    publicKey: z.string().optional(),
  }).safeParse(req.body);

  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const { userId } = getAuth(req);
  const existing = await db.select({ ip: devicesTable.assignedIp }).from(devicesTable);
  const usedIps = existing.map(r => r.ip);
  const assignedIp = allocateIp(usedIps);

  const [device] = await db.insert(devicesTable).values({
    userId: userId ?? null,
    name: body.data.name,
    type: body.data.type,
    publicKey: body.data.publicKey ?? null,
    assignedIp,
  }).returning();

  bus.publish("wireguard.config_issued", {
    event: "device_added",
    deviceId: device.id,
    name: device.name,
    type: device.type,
    assignedIp,
    userId: userId ?? null,
  }, "devices");

  res.status(201).json(device);
});

router.get("/:id/config", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const { userId } = getAuth(req);
  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, id));
  if (!device) return res.status(404).json({ error: "Device not found" });
  if (device.userId && device.userId !== userId) return res.status(403).json({ error: "Forbidden" });

  // Pull a real active node with a valid public IP and WireGuard key
  const activeNodes = await db
    .select()
    .from(nodesTable)
    .where(isNotNull(nodesTable.publicIp));

  const node = activeNodes.find(n =>
    n.publicKey && n.publicKey !== "PENDING_UPDATE" && n.publicIp
  ) ?? activeNodes[0];

  const serverPublicKey = node?.publicKey ?? "PENDING_SERVER_KEY";
  const serverEndpoint  = node?.publicIp
    ? `${node.publicIp}:${node.listenPort ?? 51820}`
    : "PENDING_SERVER_IP:51820";
  const serverName      = node?.name ?? "ProxhqVPN Server";

  const clientConfig = `[Interface]
# Device: ${device.name}
PrivateKey = <PASTE_YOUR_PRIVATE_KEY_HERE>
Address = ${device.assignedIp}/24
DNS = 1.1.1.1, 1.0.0.1

[Peer]
# ${serverName}
PublicKey = ${serverPublicKey}
AllowedIPs = ${device.allowedIps}
Endpoint = ${serverEndpoint}
PersistentKeepalive = 25`;

  const serverPeerSnippet = device.publicKey ? `[Peer]
# ${device.name}
PublicKey = ${device.publicKey}
AllowedIPs = ${device.assignedIp}/32` : "# Provide your device public key first";

  res.json({ clientConfig, serverPeerSnippet, assignedIp: device.assignedIp });
});

router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const { userId } = getAuth(req);
  const [existing] = await db.select().from(devicesTable).where(eq(devicesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Device not found" });
  if (existing.userId && existing.userId !== userId) return res.status(403).json({ error: "Forbidden" });

  const body = z.object({
    name: z.string().min(1).max(64).optional(),
    publicKey: z.string().optional(),
    status: z.enum(["active","inactive","blocked"]).optional(),
  }).safeParse(req.body);

  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const [updated] = await db.update(devicesTable)
    .set({ ...body.data })
    .where(eq(devicesTable.id, id))
    .returning();

  if (!updated) return res.status(404).json({ error: "Device not found" });

  bus.publish("node.status_change", {
    event: "device_updated",
    deviceId: id,
    changes: body.data,
    userId: userId ?? null,
  }, "devices");

  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const { userId } = getAuth(req);
  const [existing] = await db.select().from(devicesTable).where(eq(devicesTable.id, id));
  if (!existing) return res.status(404).json({ error: "Device not found" });
  if (existing.userId && existing.userId !== userId) return res.status(403).json({ error: "Forbidden" });

  const [deleted] = await db.delete(devicesTable).where(and(eq(devicesTable.id, id), eq(devicesTable.userId, userId!))).returning();
  if (!deleted) return res.status(404).json({ error: "Device not found" });

  bus.publish("wireguard.config_revoked", {
    event: "device_removed",
    deviceId: id,
    name: existing.name,
    assignedIp: existing.assignedIp,
    userId: userId ?? null,
  }, "devices");

  res.json({ ok: true });
});

export default router;
