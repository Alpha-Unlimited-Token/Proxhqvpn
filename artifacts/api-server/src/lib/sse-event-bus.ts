// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// SSE Event Bus — real-time security event push to authenticated dashboard clients.
// Uses Server-Sent Events (works through proxies, no extra library required).

import type { Response } from "express";
import { logger } from "./logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export type SseEventSeverity = "low" | "medium" | "high" | "critical";

export interface SecurityBroadcast {
  type:       string;
  severity:   SseEventSeverity;
  payload:    unknown;
  adminOnly:  boolean;
}

interface SseClient {
  connectionId: string;
  userId:       string;
  isAdmin:      boolean;
  res:          Response;
  connectedAt:  number;
  heartbeat:    ReturnType<typeof setInterval>;
}

// ── In-process client registry ────────────────────────────────────────────────

const clients = new Map<string, SseClient>();

export function registerSseClient(
  connectionId: string,
  userId:       string,
  isAdmin:      boolean,
  res:          Response,
): void {
  res.setHeader("Content-Type",       "text/event-stream");
  res.setHeader("Cache-Control",      "no-cache, no-transform");
  res.setHeader("Connection",         "keep-alive");
  res.setHeader("X-Accel-Buffering",  "no");
  res.flushHeaders();

  // Heartbeat comment every 25s keeps the connection alive through all proxies
  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { /* client already gone */ }
  }, 25_000);

  // Send initial connected event
  const connectData = JSON.stringify({ type: "connected", connectionId, ts: new Date().toISOString() });
  res.write(`event: connected\ndata: ${connectData}\n\n`);

  clients.set(connectionId, { connectionId, userId, isAdmin, res, connectedAt: Date.now(), heartbeat });

  logger.info({ connectionId, userId, isAdmin, totalClients: clients.size }, "[SSE] Client connected");

  res.on("close", () => {
    clearInterval(heartbeat);
    clients.delete(connectionId);
    logger.info({ connectionId, totalClients: clients.size }, "[SSE] Client disconnected");
  });
}

export function broadcastSecurityEvent(event: SecurityBroadcast): void {
  if (clients.size === 0) return;

  const data = JSON.stringify({ ...event, ts: new Date().toISOString() });
  const dead: string[] = [];

  for (const [id, client] of clients) {
    if (event.adminOnly && !client.isAdmin) continue;
    try {
      client.res.write(`event: security\ndata: ${data}\n\n`);
    } catch {
      dead.push(id);
    }
  }

  // Clean up any dead connections that didn't fire the close event
  for (const id of dead) {
    const c = clients.get(id);
    if (c) clearInterval(c.heartbeat);
    clients.delete(id);
  }
}

export function broadcastToUser(userId: string, event: { type: string; payload: unknown }): void {
  const data = JSON.stringify({ ...event, ts: new Date().toISOString() });
  for (const [, client] of clients) {
    if (client.userId !== userId) continue;
    try {
      client.res.write(`event: user\ndata: ${data}\n\n`);
    } catch { /* ignore */ }
  }
}

export function getSseClientCount(): number {
  return clients.size;
}
