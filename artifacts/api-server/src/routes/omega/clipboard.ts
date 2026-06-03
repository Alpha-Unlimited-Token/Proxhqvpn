// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, clipboardTable, eventsTable, hostsTable, remoteCommandsTable } from "@workspace/db";
import { serializeDates } from "../../lib/serialize";

const router: IRouter = Router();

router.get("/clipboard/:hostId", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const rows = await db.select().from(clipboardTable).where(eq(clipboardTable.hostId, hostId)).orderBy(desc(clipboardTable.capturedAt)).limit(20);
  res.json(rows.map(r => serializeDates(r)));
});

router.post("/clipboard/:hostId/set", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const { content } = req.body;
  if (typeof content !== "string") { res.status(400).json({ error: "content required" }); return; }
  const [entry] = await db.insert(clipboardTable).values({ hostId, content, contentType: "text" }).returning();
  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, hostId));
  await db.insert(eventsTable).values({ hostId, hostIp: host?.ip ?? null, hostLabel: host?.label ?? null, category: "System", action: "Clipboard updated", details: `Set clipboard content (${content.length} chars)`, severity: "info" });
  // Queue a set_clipboard command so the agent actually writes the clipboard on the remote page
  await db.insert(remoteCommandsTable).values({ hostId, commandType: "set_clipboard", params: content, status: "pending", result: "", executedAt: new Date() });
  res.json(serializeDates(entry));
});

export default router;
