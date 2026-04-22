import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { nodesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/stats", async (req: Request, res: Response) => {
  try {
    const nodes = await db.select({ id: nodesTable.id }).from(nodesTable)
      .where(eq(nodesTable.status, "active"));
    res.json({
      activeConnections: 0,
      totalBytesIn: 0,
      totalBytesOut: 0,
      packetsPerSecond: 0,
      blockedConnections: 0,
      activeNodes: nodes.length,
      threatAlerts: 0,
      peakBandwidthMbps: 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to load stats" });
  }
});

router.get("/flows", (_req: Request, res: Response) => {
  res.json([]);
});

router.get("/timeline", (_req: Request, res: Response) => {
  const timeline = Array.from({ length: 24 }, (_, h) => ({
    time: new Date(Date.now() - (23 - h) * 3_600_000).toISOString(),
    bytesIn: 0,
    bytesOut: 0,
    connections: 0,
    blocked: 0,
  }));
  res.json(timeline);
});

router.get("/protocols", (_req: Request, res: Response) => {
  res.json([]);
});

router.get("/countries", (_req: Request, res: Response) => {
  res.json([]);
});

export default router;
