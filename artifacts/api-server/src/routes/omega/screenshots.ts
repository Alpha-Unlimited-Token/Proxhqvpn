// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, screenshotsTable, eventsTable, hostsTable, remoteCommandsTable } from "@workspace/db";
import { serializeDateArray, serializeDates } from "../../lib/serialize";
import { screenshotData } from "../../lib/omega-store";

const router: IRouter = Router();

router.get("/screenshots/:hostId", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const shots = await db.select().from(screenshotsTable)
    .where(eq(screenshotsTable.hostId, hostId))
    .orderBy(desc(screenshotsTable.createdAt))
    .limit(50);
  // Annotate with whether image data is available
  const result = serializeDateArray(shots).map((s: any) => ({
    ...s,
    hasData: screenshotData.has(s.id),
  }));
  res.json(result);
});

// Serve actual image data for a screenshot
router.get("/screenshots/data/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const dataUrl = screenshotData.get(id);
  if (!dataUrl) { res.status(404).json({ error: "No image data available — agent has not sent a screenshot yet" }); return; }
  // Parse data URL: data:image/jpeg;base64,<data>
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) { res.status(500).json({ error: "Invalid image data" }); return; }
  const buf = Buffer.from(match[2], "base64");
  res.setHeader("Content-Type", match[1]);
  res.setHeader("Cache-Control", "private, max-age=60");
  res.send(buf);
});

// Queue a screenshot command for the agent (replaces fake capture)
router.post("/screenshots/:hostId/capture", async (req, res): Promise<void> => {
  const hostId = parseInt(req.params.hostId, 10);
  if (isNaN(hostId)) { res.status(400).json({ error: "Invalid hostId" }); return; }
  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, hostId));
  if (!host) { res.status(404).json({ error: "Host not found" }); return; }

  if (host.status !== "online") {
    res.status(409).json({ error: "Host is not online — deploy the Omega agent first" }); return;
  }

  // Queue a take_screenshot command; agent will send back the image
  const [cmd] = await db.insert(remoteCommandsTable).values({
    hostId,
    commandType: "take_screenshot",
    params: req.body?.label ?? "Page",
    status: "pending",
    result: "",
    executedAt: new Date(),
  }).returning();

  await db.insert(eventsTable).values({
    hostId,
    hostIp: host.ip,
    hostLabel: host.label,
    category: "Screen",
    action: "Screenshot requested",
    details: "Queued take_screenshot command for agent",
    severity: "info",
  });

  res.status(202).json({ queued: true, commandId: cmd.id, message: "Screenshot command queued — agent will send image on next poll" });
});

export default router;
