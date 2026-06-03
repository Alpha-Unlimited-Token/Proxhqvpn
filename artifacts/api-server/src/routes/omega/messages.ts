// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, sentMessagesTable, eventsTable, hostsTable, remoteCommandsTable } from "@workspace/db";
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

  // Queue an agent command to display the popup as an overlay on the remote page
  const iconEmoji = iconType === "error" ? "❌" : iconType === "warn" ? "⚠️" : iconType === "question" ? "❓" : "ℹ️";
  const safeTitle = String(title ?? "Message").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const safeBody = String(body).replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const overlayHtml = `<div onclick="event.stopPropagation()" style="background:#0d1117;border:2px solid #30363d;border-radius:12px;padding:32px;max-width:440px;width:90%;text-align:center;font-family:system-ui,sans-serif;box-shadow:0 0 60px rgba(0,0,0,.8);">
<div style="font-size:40px;margin-bottom:12px;">${iconEmoji}</div>
<h3 style="color:#e6edf3;margin:0 0 12px;font-size:18px;font-weight:600;">${safeTitle}</h3>
<p style="color:#8b949e;margin:0 0 24px;font-size:14px;line-height:1.6;">${safeBody}</p>
<div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;">
<button onclick="this.closest('[data-omega-overlay]').remove()" style="background:#238636;border:none;color:#fff;padding:10px 28px;border-radius:6px;cursor:pointer;font-weight:600;font-size:14px;">OK</button>
</div>
<p style="color:#484f58;font-size:11px;margin-top:16px;">Alpha Unlimited Technologies — Omega Agent</p>
</div>`;
  await db.insert(remoteCommandsTable).values({ hostId, commandType: "show_overlay", params: overlayHtml, status: "pending", result: "", executedAt: new Date() });

  res.status(201).json(serializeDates(msg));
});

export default router;
