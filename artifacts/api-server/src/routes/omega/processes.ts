// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, processesTable, eventsTable, hostsTable } from "@workspace/db";
import { serializeDateArray } from "../../lib/serialize";

const router: IRouter = Router();

router.get("/processes/:hostId", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const procs = await db.select().from(processesTable)
    .where(and(eq(processesTable.hostId, hostId), eq(processesTable.status, "running")))
    .orderBy(processesTable.name);
  res.json(serializeDateArray(procs));
});

router.delete("/processes/:hostId/:pid", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  const pid = parseInt(req.params.pid, 10);
  if (isNaN(hostId) || isNaN(pid)) { res.status(400).json({ error: "Invalid params" }); return; }
  const [proc] = await db.select().from(processesTable)
    .where(and(eq(processesTable.hostId, hostId), eq(processesTable.pid, pid)));
  if (!proc) { res.status(404).json({ error: "Process not found" }); return; }
  await db.update(processesTable).set({ status: "killed" })
    .where(and(eq(processesTable.hostId, hostId), eq(processesTable.pid, pid)));
  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, hostId));
  await db.insert(eventsTable).values({
    hostId,
    hostIp: host?.ip ?? null,
    hostLabel: host?.label ?? null,
    category: "Process",
    action: "Process terminated",
    details: `Terminated: ${proc.name} (PID ${pid})`,
    severity: "warn",
  });
  res.json({ success: true, pid, name: proc.name });
});

export default router;
