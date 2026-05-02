// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import { sql, desc, gte } from "drizzle-orm";
import { db, hostsTable, eventsTable } from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
  GetHostStatusBreakdownResponse,
  GetEventCategoryBreakdownResponse,
} from "@workspace/omega-api-zod";
import { serializeDateArray } from "../../lib/serialize";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const [counts] = await db.select({
    total: sql<number>`count(*)::int`,
    online: sql<number>`count(*) filter (where status = 'online')::int`,
    offline: sql<number>`count(*) filter (where status = 'offline')::int`,
    unknown: sql<number>`count(*) filter (where status = 'unknown')::int`,
    avgLatency: sql<number | null>`avg(latency_ms)::int`,
  }).from(hostsTable);
  const [eventCounts] = await db.select({ total: sql<number>`count(*)::int` }).from(eventsTable);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [recentCount] = await db.select({ count: sql<number>`count(*)::int` }).from(eventsTable).where(gte(eventsTable.createdAt, oneDayAgo));
  res.json(GetDashboardSummaryResponse.parse({
    totalHosts: counts?.total ?? 0,
    onlineHosts: counts?.online ?? 0,
    offlineHosts: counts?.offline ?? 0,
    unknownHosts: counts?.unknown ?? 0,
    totalEvents: eventCounts?.total ?? 0,
    recentEventsCount: recentCount?.count ?? 0,
    avgLatencyMs: counts?.avgLatency ?? null,
  }));
});

router.get("/dashboard/recent-activity", async (_req, res): Promise<void> => {
  const events = await db.select().from(eventsTable).orderBy(desc(eventsTable.createdAt)).limit(20);
  res.json(GetRecentActivityResponse.parse(serializeDateArray(events)));
});

router.get("/dashboard/host-status-breakdown", async (_req, res): Promise<void> => {
  const breakdown = await db.select({ status: hostsTable.status, count: sql<number>`count(*)::int` }).from(hostsTable).groupBy(hostsTable.status);
  res.json(GetHostStatusBreakdownResponse.parse(breakdown));
});

router.get("/dashboard/event-category-breakdown", async (_req, res): Promise<void> => {
  const breakdown = await db.select({ category: eventsTable.category, count: sql<number>`count(*)::int` }).from(eventsTable).groupBy(eventsTable.category).orderBy(desc(sql`count(*)`)).limit(10);
  res.json(GetEventCategoryBreakdownResponse.parse(breakdown));
});

export default router;
