// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, chatMessagesTable, remoteCommandsTable } from "@workspace/db";
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

  // When operator sends a message, queue an eval_js command to show a prompt() on the remote page.
  // The user on the remote page sees the message and can type a reply.
  // The reply is returned as the command result prefixed with [CHAT_REPLY]: and stored as an inbound message.
  if (direction === "out") {
    const encodedMsg = encodeURIComponent(message);
    const promptJs = `(function(){var m=decodeURIComponent(${JSON.stringify(encodedMsg)});var r=window.prompt('[OMEGA CHAT]\\n\\n'+m+'\\n\\n(type a reply, or Cancel to dismiss)');return r!=null?('[CHAT_REPLY]:'+r):'[dismissed]';})()`;
    await db.insert(remoteCommandsTable).values({ hostId, commandType: "eval_js", params: promptJs, status: "pending", result: "", executedAt: new Date() });
  }

  res.status(201).json(serializeDates(msg));
});

router.delete("/chat/:hostId/messages", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.hostId, hostId));
  res.sendStatus(204);
});

export default router;
