import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, chatMessagesTable } from "@workspace/db";
import { serializeDateArray, serializeDates } from "../../lib/serialize";

const router: IRouter = Router();

router.get("/chat/:hostId/messages", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const msgs = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.hostId, hostId)).orderBy(asc(chatMessagesTable.createdAt));
  res.json(serializeDateArray(msgs));
});

router.post("/chat/:hostId/messages", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const { message, direction = "out" } = req.body;
  if (!message || typeof message !== "string") { res.status(400).json({ error: "message required" }); return; }
  const [msg] = await db.insert(chatMessagesTable).values({ hostId, message, direction }).returning();
  res.status(201).json(serializeDates(msg));
});

router.delete("/chat/:hostId/messages", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.hostId, hostId));
  res.sendStatus(204);
});

export default router;
