// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { getAuth } from "@clerk/express";

const router = Router();

interface MeshDevice {
  id: string;
  name: string;
  vpnIp: string;
  publicKey: string;
  os: string;
  status: "online" | "offline";
  isOwn: boolean;
  allowTrafficRouting: boolean;
  lastSeen: string;
  addedAt: string;
}

interface MeshInvite {
  code: string;
  createdAt: string;
  expiresAt: string;
  used: boolean;
}

const devicesStore = new Map<string, MeshDevice[]>();
const inviteStore  = new Map<string, MeshInvite[]>();
const VPN_SUBNET   = "100.64.";

function uid(req: any): string {
  return (getAuth(req) as any)?.userId || "anon";
}

function randomVpnIp(): string {
  const b = Math.floor(Math.random() * 254) + 1;
  const c = Math.floor(Math.random() * 254) + 1;
  return `${VPN_SUBNET}${b}.${c}`;
}

function randomPubKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  return Array.from({ length: 44 }, () => chars[Math.floor(Math.random() * chars.length)]).join("") + "=";
}

function ensureOwnDevice(userId: string): MeshDevice[] {
  let devices = devicesStore.get(userId) ?? [];
  if (!devices.some(d => d.isOwn)) {
    devices.push({
      id: `dev_own_${userId.slice(0, 8)}`,
      name: "This Device",
      vpnIp: randomVpnIp(),
      publicKey: randomPubKey(),
      os: "Web",
      status: "online",
      isOwn: true,
      allowTrafficRouting: false,
      lastSeen: new Date().toISOString(),
      addedAt: new Date().toISOString(),
    });
    devicesStore.set(userId, devices);
  }
  return devices;
}

router.get("/devices", (req, res) => {
  const devices = ensureOwnDevice(uid(req));
  res.json({ devices });
});

router.post("/device", (req, res) => {
  const { name, os = "Unknown" } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  const userId = uid(req);
  const devices = ensureOwnDevice(userId);
  if (devices.length >= 60) return res.status(409).json({ error: "Maximum 60 devices reached" });

  const device: MeshDevice = {
    id: `dev_${Date.now().toString(36)}`,
    name: String(name).slice(0, 50),
    vpnIp: randomVpnIp(),
    publicKey: randomPubKey(),
    os: String(os).slice(0, 30),
    status: Math.random() > 0.3 ? "online" : "offline",
    isOwn: false,
    allowTrafficRouting: false,
    lastSeen: new Date(Date.now() - Math.random() * 3600000).toISOString(),
    addedAt: new Date().toISOString(),
  };
  devices.push(device);
  devicesStore.set(userId, devices);
  res.json({ ok: true, device });
});

router.delete("/device/:id", (req, res) => {
  const userId = uid(req);
  const devices = ensureOwnDevice(userId);
  const target = devices.find(d => d.id === req.params.id);
  if (!target) return res.status(404).json({ error: "Device not found" });
  if (target.isOwn) return res.status(400).json({ error: "Cannot remove own device from meshnet" });
  devicesStore.set(userId, devices.filter(d => d.id !== req.params.id));
  res.json({ ok: true });
});

router.put("/device/:id/routing", (req, res) => {
  const userId = uid(req);
  const devices = ensureOwnDevice(userId);
  const device = devices.find(d => d.id === req.params.id);
  if (!device) return res.status(404).json({ error: "Device not found" });
  device.allowTrafficRouting = !!req.body.allow;
  devicesStore.set(userId, devices);
  res.json({ ok: true, device });
});

router.post("/invite", (req, res) => {
  const userId = uid(req);
  const invites = inviteStore.get(userId) ?? [];
  const code = Buffer.from(`${userId}:${Date.now()}`).toString("base64url").slice(0, 16).toUpperCase();
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000);
  const invite: MeshInvite = {
    code,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
    used: false,
  };
  invites.push(invite);
  inviteStore.set(userId, invites);
  res.json({ ok: true, invite, link: `https://proxhqvpn.com/meshnet/join/${code}` });
});

router.get("/invites", (req, res) => {
  const invites = inviteStore.get(uid(req)) ?? [];
  res.json({ invites });
});

export default router;
