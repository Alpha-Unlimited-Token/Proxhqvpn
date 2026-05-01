import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, sentMessagesTable, eventsTable, hostsTable } from "@workspace/db";
import { serializeDates } from "../../lib/serialize";

const router: IRouter = Router();

router.get("/messages/:hostId", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const rows = await db.select().from(sentMessagesTable).where(eq(sentMessagesTable.hostId, hostId)).orderBy(desc(sentMessagesTable.sentAt)).limit(50);
  res.json(rows.map(r => serializeDates(r)));
});

router.post("/messages/:hostId/send", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const { title, body, iconType = "info", buttonType = "ok" } = req.body;
  if (!body) { res.status(400).json({ error: "body required" }); return; }
  const [msg] = await db.insert(sentMessagesTable).values({ hostId, title: title ?? "Message", body, iconType, buttonType, status: "sent" }).returning();
  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, hostId));
  await db.insert(eventsTable).values({ hostId, hostIp: host?.ip ?? null, hostLabel: host?.label ?? null, category: "Chat", action: "Message sent", details: `Popup sent: "${title ?? "Message"}"`, severity: "info" });
  res.status(201).json(serializeDates(msg));
});

export default router;
