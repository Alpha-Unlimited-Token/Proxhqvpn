// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, remoteCommandsTable, eventsTable, hostsTable } from "@workspace/db";
import { serializeDates } from "../../lib/serialize";

const router: IRouter = Router();

const VALID_COMMANDS = [
  "open_url", "find_files", "flip_screen", "set_resolution",
  "screensaver", "restart_windows", "shutdown_windows",
  "set_volume", "set_time", "set_date", "win_colors",
  "print_text", "set_mouse_speed",
];

const RESULT_MAP: Record<string, string> = {
  open_url: "URL opened in browser",
  find_files: "File search initiated",
  flip_screen: "Screen flipped",
  set_resolution: "Resolution changed",
  screensaver: "Screen saver activated",
  restart_windows: "Restart initiated",
  shutdown_windows: "Shutdown initiated",
  set_volume: "Volume adjusted",
  set_time: "System time updated",
  set_date: "System date updated",
  win_colors: "Windows colors changed",
  print_text: "Print job sent",
  set_mouse_speed: "Mouse speed set",
};

router.get("/remote-commands/:hostId", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const rows = await db.select().from(remoteCommandsTable).where(eq(remoteCommandsTable.hostId, hostId)).orderBy(desc(remoteCommandsTable.executedAt)).limit(100);
  res.json(rows.map(r => serializeDates(r)));
});

router.post("/remote-commands/:hostId/execute", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const { commandType, params = "" } = req.body;
  if (!commandType || !VALID_COMMANDS.includes(commandType)) { res.status(400).json({ error: "Invalid commandType" }); return; }
  const [cmd] = await db.insert(remoteCommandsTable).values({ hostId, commandType, params: typeof params === "string" ? params : JSON.stringify(params), status: "executed", result: RESULT_MAP[commandType] ?? "Command sent" }).returning();
  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, hostId));
  await db.insert(eventsTable).values({ hostId, hostIp: host?.ip ?? null, hostLabel: host?.label ?? null, category: "System", action: `Remote command: ${commandType}`, details: params ? `Params: ${typeof params === "string" ? params : JSON.stringify(params)}` : RESULT_MAP[commandType], severity: commandType.includes("restart") || commandType.includes("shutdown") ? "warn" : "info" });
  res.json(serializeDates(cmd));
});

export default router;
