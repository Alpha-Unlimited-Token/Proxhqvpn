// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { listUnprocessedPlatformEvents } from "../lib/event-bus";

const router = Router();

router.get("/events", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const timer = setInterval(async () => {
    const events = await listUnprocessedPlatformEvents(25);

    res.write(`event: platform-events\n`);
    res.write(`data: ${JSON.stringify({ events })}\n\n`);
  }, 5000);

  req.on("close", () => clearInterval(timer));
});

export default router;
