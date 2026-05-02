// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, screenshotsTable, eventsTable, hostsTable } from "@workspace/db";
import { serializeDateArray, serializeDates } from "../../lib/serialize";

const router: IRouter = Router();

router.get("/screenshots/:hostId", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const shots = await db.select().from(screenshotsTable).where(eq(screenshotsTable.hostId, hostId)).orderBy(desc(screenshotsTable.createdAt)).limit(50);
  res.json(serializeDateArray(shots));
});

router.post("/screenshots/:hostId/capture", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, hostId));
  if (!host) { res.status(404).json({ error: "Host not found" }); return; }
  const sizeKb = Math.floor(Math.random() * 800) + 200;
  const [shot] = await db.insert(screenshotsTable).values({ hostId, label: req.body?.label ?? "Desktop", widthPx: 1920, heightPx: 1080, sizeKb }).returning();
  await db.insert(eventsTable).values({ hostId, hostIp: host.ip, hostLabel: host.label, category: "Screen", action: "Screen captured", details: `Full desktop screenshot saved (${sizeKb}kb)`, severity: "info" });
  res.status(201).json(serializeDates(shot));
});

export default router;
