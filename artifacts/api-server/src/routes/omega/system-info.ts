import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, systemInfoTable } from "@workspace/db";
import { serializeDates } from "../../lib/serialize";

const router: IRouter = Router();

router.get("/system-info/:hostId", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const rows = await db.select().from(systemInfoTable).where(eq(systemInfoTable.hostId, hostId)).orderBy(systemInfoTable.lastUpdated).limit(1);
  if (rows.length === 0) { res.status(404).json({ error: "No system info found" }); return; }
  res.json(serializeDates(rows[0]));
});

router.post("/system-info/:hostId/refresh", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const existing = await db.select().from(systemInfoTable).where(eq(systemInfoTable.hostId, hostId)).limit(1);
  if (existing.length === 0) {
    const [row] = await db.insert(systemInfoTable).values({
      hostId,
      osName: "Windows", osVersion: "11 Pro", cpu: "Intel Core i7-12700", ramTotalMb: 16384, ramUsedMb: Math.random() * 8000 + 2000,
      username: "operator", computerName: `HOST-${hostId}`, uptimeSeconds: Math.floor(Math.random() * 86400),
      diskTotalGb: 512, diskUsedGb: Math.random() * 300 + 50, resolution: "1920x1080",
    }).returning();
    res.json(serializeDates(row));
    return;
  }
  await db.update(systemInfoTable).set({ lastUpdated: new Date(), ramUsedMb: Math.random() * 8000 + 2000 }).where(eq(systemInfoTable.hostId, hostId));
  const [updated] = await db.select().from(systemInfoTable).where(eq(systemInfoTable.hostId, hostId)).limit(1);
  res.json(serializeDates(updated));
});

export default router;
