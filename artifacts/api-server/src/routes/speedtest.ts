// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Speed Test — measures connection speed between client and this VPN node.
// No third party involved — all traffic stays between client and your node.

import { Router, type Request, type Response } from "express";
import { randomBytes } from "crypto";

const router = Router();

// GET /api/speedtest/ping — latency test
router.get("/ping", (_req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache");
  res.setHeader("X-Timestamp", Date.now().toString());
  res.json({ ts: Date.now(), pong: true });
});

// GET /api/speedtest/download/:size — download speed test (size in KB, max 100MB)
router.get("/download/:size", (req: Request, res: Response) => {
  const kb  = Math.min(parseInt(String(req.params["size"] ?? "1024"), 10), 102400);
  const buf = randomBytes(kb * 1024);
  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Content-Length", buf.length.toString());
  res.setHeader("Cache-Control", "no-store, no-cache");
  res.setHeader("X-Start-Time", Date.now().toString());
  res.end(buf);
});

// POST /api/speedtest/upload — upload speed test (receive and discard data)
router.post("/upload", (req: Request, res: Response) => {
  const start = Date.now();
  let bytes = 0;
  req.on("data", (chunk: Buffer) => { bytes += chunk.length; });
  req.on("end", () => {
    const elapsed = Date.now() - start;
    res.json({
      bytes,
      elapsed,
      mbps: ((bytes * 8) / (elapsed / 1000) / 1_000_000).toFixed(2),
    });
  });
});

// GET /api/speedtest/node-info
router.get("/node-info", (_req, res) => {
  res.json({
    nodeId:   process.env.NODE_ID ?? "unknown",
    region:   process.env.NODE_REGION ?? "unknown",
    location: process.env.NODE_LOCATION ?? "unknown",
  });
});

export default router;
