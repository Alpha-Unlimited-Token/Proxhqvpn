// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, systemInfoTable } from "@workspace/db";
import { serializeDates } from "../../lib/serialize";

const router: IRouter = Router();

router.get("/system-info/:hostId", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const rows = await db.select().from(systemInfoTable)
    .where(eq(systemInfoTable.hostId, hostId))
    .orderBy(systemInfoTable.lastUpdated)
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "No system info — deploy the Omega agent to collect real data" }); return;
  }
  res.json(serializeDates(rows[0]));
});

// Refresh: returns existing data only. Real updates come via the agent's /omega-agent/sysinfo push.
router.post("/system-info/:hostId/refresh", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const rows = await db.select().from(systemInfoTable)
    .where(eq(systemInfoTable.hostId, hostId))
    .limit(1);
  if (rows.length === 0) {
    res.status(404).json({ error: "No system info — deploy the Omega agent to collect real data" }); return;
  }
  res.json(serializeDates(rows[0]));
});

export default router;
