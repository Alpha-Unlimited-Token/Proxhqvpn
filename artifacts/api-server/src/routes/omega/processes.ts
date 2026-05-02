// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, processesTable, eventsTable, hostsTable } from "@workspace/db";
import { serializeDateArray } from "../../lib/serialize";

const router: IRouter = Router();

router.get("/processes/:hostId", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const procs = await db.select().from(processesTable).where(and(eq(processesTable.hostId, hostId), eq(processesTable.status, "running"))).orderBy(processesTable.name);
  res.json(serializeDateArray(procs));
});

router.post("/processes/:hostId/seed", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const samples = [
    { pid: 1, name: "System", cpuPct: 0.1, memMb: 12.5 },
    { pid: 4, name: "smss.exe", cpuPct: 0.0, memMb: 0.5 },
    { pid: 512, name: "csrss.exe", cpuPct: 0.2, memMb: 3.2 },
    { pid: 1024, name: "winlogon.exe", cpuPct: 0.1, memMb: 5.8 },
    { pid: 2048, name: "explorer.exe", cpuPct: 1.2, memMb: 62.4 },
    { pid: 4096, name: "chrome.exe", cpuPct: 8.5, memMb: 312.0 },
    { pid: 8192, name: "svchost.exe", cpuPct: 0.5, memMb: 28.0 },
  ];
  await db.delete(processesTable).where(eq(processesTable.hostId, hostId));
  const rows = await db.insert(processesTable).values(samples.map(s => ({ hostId, ...s, status: "running" }))).returning();
  res.json(rows);
});

router.delete("/processes/:hostId/:pid", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  const pid = parseInt(req.params.pid, 10);
  if (isNaN(hostId) || isNaN(pid)) { res.status(400).json({ error: "Invalid params" }); return; }
  const [proc] = await db.select().from(processesTable).where(and(eq(processesTable.hostId, hostId), eq(processesTable.pid, pid)));
  if (!proc) { res.status(404).json({ error: "Process not found" }); return; }
  await db.update(processesTable).set({ status: "killed" }).where(and(eq(processesTable.hostId, hostId), eq(processesTable.pid, pid)));
  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, hostId));
  await db.insert(eventsTable).values({ hostId, hostIp: host?.ip ?? null, hostLabel: host?.label ?? null, category: "Process", action: "Process terminated", details: `Terminated: ${proc.name} (PID ${pid})`, severity: "warn" });
  res.json({ success: true, pid, name: proc.name });
});

export default router;
