// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Node Service — decoy VPN node lifecycle management.
import { db } from "@workspace/db";
import {
  ghostNodesTable,
  ghostNodeEventsTable,
  ghostNodeRoutesTable,
  vultrNodeDeceptionStateTable,
} from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import crypto from "crypto";

export async function listGhostNodes() {
  return db.select().from(ghostNodesTable).orderBy(desc(ghostNodesTable.createdAt));
}

export async function getGhostNode(id: number) {
  const [row] = await db
    .select()
    .from(ghostNodesTable)
    .where(eq(ghostNodesTable.id, id))
    .limit(1);
  return row ?? null;
}

export async function createGhostNode(opts: {
  name: string;
  region: string;
  publicIp: string;
  decoyIp?: string;
  listenPort?: number;
  decoyPublicKey?: string;
  isolationLevel?: "full" | "partial";
  notes?: string;
  createdBy: string;
}) {
  const [row] = await db
    .insert(ghostNodesTable)
    .values({
      name:           opts.name,
      region:         opts.region,
      publicIp:       opts.publicIp,
      decoyIp:        opts.decoyIp ?? null,
      listenPort:     opts.listenPort ?? 51820,
      decoyPublicKey: opts.decoyPublicKey ?? null,
      isolationLevel: opts.isolationLevel ?? "full",
      notes:          opts.notes ?? null,
      createdBy:      opts.createdBy,
    })
    .returning();
  return row!;
}

export async function enableGhostNode(id: number) {
  const [row] = await db
    .update(ghostNodesTable)
    .set({ status: "active", enabledAt: new Date(), disabledAt: null, updatedAt: new Date() })
    .where(eq(ghostNodesTable.id, id))
    .returning();
  return row ?? null;
}

export async function disableGhostNode(id: number) {
  const [row] = await db
    .update(ghostNodesTable)
    .set({ status: "disabled", disabledAt: new Date(), updatedAt: new Date() })
    .where(eq(ghostNodesTable.id, id))
    .returning();
  return row ?? null;
}

export async function quarantineGhostNode(id: number) {
  const [row] = await db
    .update(ghostNodesTable)
    .set({ status: "quarantined", quarantinedAt: new Date(), updatedAt: new Date() })
    .where(eq(ghostNodesTable.id, id))
    .returning();
  return row ?? null;
}

export async function recordNodeEvent(ghostNodeId: number, opts: {
  eventType: "probe" | "handshake_attempt" | "port_scan" | "wg_init" | "policy_push" | "quarantine";
  sourceIp: string;
  sourcePort?: number;
  rawPayload?: string;
  geoCountry?: string;
  geoCity?: string;
  geoAsn?: string;
  severity?: "info" | "warn" | "critical";
}) {
  const [row] = await db
    .insert(ghostNodeEventsTable)
    .values({
      ghostNodeId,
      eventType:  opts.eventType,
      sourceIp:   opts.sourceIp,
      sourcePort: opts.sourcePort ?? null,
      rawPayload: opts.rawPayload ?? null,
      geoCountry: opts.geoCountry ?? null,
      geoCity:    opts.geoCity ?? null,
      geoAsn:     opts.geoAsn ?? null,
      severity:   opts.severity ?? "info",
    })
    .returning();
  return row!;
}

export async function getNodeEvents(ghostNodeId: number, limit = 100) {
  return db
    .select()
    .from(ghostNodeEventsTable)
    .where(eq(ghostNodeEventsTable.ghostNodeId, ghostNodeId))
    .orderBy(desc(ghostNodeEventsTable.createdAt))
    .limit(limit);
}
