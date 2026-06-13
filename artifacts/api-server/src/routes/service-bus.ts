// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Service Bus monitoring API
//   GET  /api/service-bus/stats          — channel throughput counters
//   GET  /api/service-bus/recent         — recent events (limit=100, channel= filter)
//   GET  /api/service-bus/health         — overall bus health summary
//   POST /api/service-bus/publish        — manual test publish (admin only)

import { Router, type Request, type Response } from "express";
import { bus, type EventChannel } from "../lib/service-bus";

const router = Router();

const CHANNEL_GROUPS: Record<string, EventChannel[]> = {
  "Security Events":   ["beacon.alert", "firewall.block", "ghost_trace.anomaly", "ghost_chain.kill_chain", "canary.triggered", "threat_intel.ioc_match"],
  "Access Control":    ["ztna.posture_check", "ztna.deny", "session.login", "session.logout"],
  "Infrastructure":    ["firewall.rule_change", "wireguard.config_issued", "wireguard.config_revoked", "node.trust_change", "node.status_change"],
  "Platform":          ["drift.detected", "drift.remediated", "siem.event", "audit.chain_entry"],
};

router.get("/stats", (_req: Request, res: Response) => {
  const stats = bus.getStats();
  const totalEvents = Object.values(stats).reduce((a, b) => a + b, 0);
  const activeChannels = Object.values(stats).filter(n => n > 0).length;

  const grouped = Object.entries(CHANNEL_GROUPS).map(([group, channels]) => ({
    group,
    channels: channels.map(ch => ({ channel: ch, count: stats[ch] ?? 0 })),
    total: channels.reduce((a, ch) => a + (stats[ch] ?? 0), 0),
  }));

  res.json({
    raw: stats,
    grouped,
    totalEvents,
    activeChannels,
    totalChannels: Object.keys(stats).length,
    timestamp: new Date().toISOString(),
  });
});

router.get("/recent", (req: Request, res: Response) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "100"), 10) || 100, 500);
  const channel = req.query.channel as EventChannel | undefined;
  const events = bus.getRecent(limit, channel);
  res.json({ events, count: events.length, timestamp: new Date().toISOString() });
});

router.get("/health", (_req: Request, res: Response) => {
  const stats  = bus.getStats();
  const recent = bus.getRecent(50);
  const totalEvents = Object.values(stats).reduce((a, b) => a + b, 0);
  const activeChannels = Object.values(stats).filter(n => n > 0).length;

  const now = Date.now();
  const last5min = recent.filter(e => now - new Date(e.timestamp).getTime() < 5 * 60 * 1000);
  const threatChannels: EventChannel[] = ["beacon.alert", "firewall.block", "ghost_trace.anomaly", "ghost_chain.kill_chain", "canary.triggered"];
  const recentThreats = last5min.filter(e => threatChannels.includes(e.channel)).length;

  const health: "healthy" | "degraded" | "alert" =
    recentThreats > 10 ? "alert" :
    activeChannels === 0 && totalEvents === 0 ? "degraded" :
    "healthy";

  res.json({
    health,
    totalEvents,
    activeChannels,
    recentThreats,
    last5minEvents: last5min.length,
    timestamp: new Date().toISOString(),
  });
});

router.post("/publish", (req: Request, res: Response) => {
  const { channel = "siem.event" as EventChannel, payload = { test: true }, source = "manual-ui" } = req.body ?? {};
  bus.publish(channel as EventChannel, payload, String(source));
  res.json({ published: true, channel, source, timestamp: new Date().toISOString() });
});

export default router;
