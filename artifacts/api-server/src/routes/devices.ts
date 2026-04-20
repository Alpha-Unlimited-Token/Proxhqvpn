import { Router } from "express";
import { db } from "@workspace/db";
import { devicesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { execSync } from "child_process";

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

  const existing = await db.select({ ip: devicesTable.assignedIp }).from(devicesTable);
  const usedIps = existing.map(r => r.ip);
  const assignedIp = allocateIp(usedIps);

  const [device] = await db.insert(devicesTable).values({
    name: body.data.name,
    type: body.data.type,
    publicKey: body.data.publicKey ?? null,
    assignedIp,
  }).returning();

  res.status(201).json(device);
});

router.get("/:id/config", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [device] = await db.select().from(devicesTable).where(eq(devicesTable.id, id));
  if (!device) return res.status(404).json({ error: "Device not found" });

  let serverPublicKey = "PROXHQ_SERVER_PUBLIC_KEY";
  let serverEndpoint = "YOUR_SERVER_IP:51820";
  let serverDns = "1.1.1.1";

  try {
    const wgOut = execSync("wg show all public-key 2>/dev/null", { encoding: "utf8", timeout: 3000 }).trim();
    const firstKey = wgOut.split("\n").find(l => l.trim().length > 10);
    if (firstKey) {
      const parts = firstKey.trim().split(/\s+/);
      if (parts[1]) serverPublicKey = parts[1];
    }
  } catch { /* wg not available */ }

  const clientConfig = `[Interface]
# Device: ${device.name}
PrivateKey = <PASTE_YOUR_PRIVATE_KEY_HERE>
Address = ${device.assignedIp}/24
DNS = ${serverDns}

[Peer]
# PROXHQ Server
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
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [deleted] = await db.delete(devicesTable).where(eq(devicesTable.id, id)).returning();
  if (!deleted) return res.status(404).json({ error: "Device not found" });
  res.json({ ok: true });
});

export default router;
