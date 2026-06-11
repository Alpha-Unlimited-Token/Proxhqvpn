// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, windowsListTable, eventsTable, hostsTable } from "@workspace/db";
import { serializeDateArray } from "../../lib/serialize";

const router: IRouter = Router();

router.get("/windows/:hostId", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const rows = await db.select().from(windowsListTable)
    .where(and(eq(windowsListTable.hostId, hostId), eq(windowsListTable.isClosed, false)))
    .orderBy(windowsListTable.isActive);
  res.json(serializeDateArray(rows));
});

router.delete("/windows/:hostId/:handle", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  const handle = req.params.handle;
  if (isNaN(hostId) || !handle || handle.length > 256 || !/^[\w\-.:]+$/.test(handle)) {
    res.status(400).json({ error: "Invalid params" }); return;
  }
  const [win] = await db.select().from(windowsListTable)
    .where(and(eq(windowsListTable.hostId, hostId), eq(windowsListTable.windowHandle, handle)));
  if (!win) { res.status(404).json({ error: "Window not found" }); return; }
  await db.update(windowsListTable).set({ isClosed: true })
    .where(and(eq(windowsListTable.hostId, hostId), eq(windowsListTable.windowHandle, handle)));
  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, hostId));
  await db.insert(eventsTable).values({
    hostId,
    hostIp: host?.ip ?? null,
    hostLabel: host?.label ?? null,
    category: "System",
    action: "Frame/window closed",
    details: `Closed: ${win.title}`,
    severity: "info",
  });
  res.json({ success: true, handle, title: win.title });
});

export default router;
