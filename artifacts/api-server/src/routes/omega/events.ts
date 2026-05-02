// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, eventsTable, hostsTable } from "@workspace/db";
import { CreateEventBody, ListEventsQueryParams, ListEventsResponse } from "@workspace/omega-api-zod";
import { serializeDateArray, serializeDates } from "../../lib/serialize";

const router: IRouter = Router();

router.get("/events", async (req, res): Promise<void> => {
  const params = ListEventsQueryParams.safeParse(req.query);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  let query = db.select().from(eventsTable).$dynamic();
  if (params.data.hostId) query = query.where(eq(eventsTable.hostId, params.data.hostId));
  const limit = params.data.limit ?? 100;
  const events = await query.orderBy(desc(eventsTable.createdAt)).limit(limit);
  res.json(ListEventsResponse.parse(serializeDateArray(events)));
});

router.post("/events", async (req, res): Promise<void> => {
  const parsed = CreateEventBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  let hostIp: string | null = null;
  let hostLabel: string | null = null;
  if (parsed.data.hostId) {
    const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, parsed.data.hostId));
    if (host) { hostIp = host.ip; hostLabel = host.label; }
  }
  const [event] = await db.insert(eventsTable).values({ ...parsed.data, hostIp, hostLabel }).returning();
  res.status(201).json(serializeDates(event));
});

export default router;
