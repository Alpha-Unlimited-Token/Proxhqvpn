// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, hostsTable, eventsTable } from "@workspace/db";
import {
  CreateHostBody,
  UpdateHostBody,
  GetHostParams,
  GetHostResponse,
  UpdateHostParams,
  UpdateHostResponse,
  DeleteHostParams,
  PingHostParams,
  PingHostResponse,
  ListHostsResponse,
} from "@workspace/omega-api-zod";
import { serializeDates, serializeDateArray } from "../../lib/serialize";

const router: IRouter = Router();

router.get("/hosts", async (_req, res): Promise<void> => {
  const hosts = await db.select().from(hostsTable).orderBy(hostsTable.createdAt);
  res.json(ListHostsResponse.parse(serializeDateArray(hosts)));
});

router.post("/hosts", async (req, res): Promise<void> => {
  const parsed = CreateHostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [host] = await db.insert(hostsTable).values({ ...parsed.data, status: "unknown", updatedAt: new Date() }).returning();
  res.status(201).json(GetHostResponse.parse(serializeDates(host)));
});

router.get("/hosts/:id", async (req, res): Promise<void> => {
  const params = GetHostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, params.data.id));
  if (!host) { res.status(404).json({ error: "Host not found" }); return; }
  res.json(GetHostResponse.parse(serializeDates(host)));
});

router.patch("/hosts/:id", async (req, res): Promise<void> => {
  const params = UpdateHostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const parsed = UpdateHostBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const [host] = await db.update(hostsTable).set({ ...parsed.data, updatedAt: new Date() }).where(eq(hostsTable.id, params.data.id)).returning();
  if (!host) { res.status(404).json({ error: "Host not found" }); return; }
  res.json(UpdateHostResponse.parse(serializeDates(host)));
});

router.delete("/hosts/:id", async (req, res): Promise<void> => {
  const params = DeleteHostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [host] = await db.delete(hostsTable).where(eq(hostsTable.id, params.data.id)).returning();
  if (!host) { res.status(404).json({ error: "Host not found" }); return; }
  res.sendStatus(204);
});

router.post("/hosts/:id/ping", async (req, res): Promise<void> => {
  const params = PingHostParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: params.error.message }); return; }
  const [host] = await db.select().from(hostsTable).where(eq(hostsTable.id, params.data.id));
  if (!host) { res.status(404).json({ error: "Host not found" }); return; }
  const simLatency = Math.floor(Math.random() * 80) + 10;
  const simOnline = Math.random() > 0.2;
  const status = simOnline ? "online" : "offline";
  const latencyMs = simOnline ? simLatency : null;
  const now = new Date().toISOString();
  await db.update(hostsTable).set({ status, latencyMs, lastSeen: simOnline ? now : host.lastSeen, updatedAt: new Date() }).where(eq(hostsTable.id, params.data.id));
  res.json(PingHostResponse.parse({ hostId: host.id, ip: host.ip, status, latencyMs, timestamp: now }));
});

export default router;
