// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Node Routing Service — WireGuard decoy route management.
import { db } from "@workspace/db";
import { ghostNodeRoutesTable, vultrNodeDeceptionStateTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import crypto from "crypto";

export async function getRoutesForNode(ghostNodeId: number) {
  return db
    .select()
    .from(ghostNodeRoutesTable)
    .where(eq(ghostNodeRoutesTable.ghostNodeId, ghostNodeId))
    .orderBy(desc(ghostNodeRoutesTable.createdAt));
}

export async function createRoute(ghostNodeId: number, opts: {
  realNodeId?: number;
  decoyInterface?: string;
  allowedIpRange: string;
  iptablesMarkId?: number;
  routingTable?: number;
}) {
  const hash = crypto.createHash("sha256")
    .update(`${ghostNodeId}:${opts.allowedIpRange}:${Date.now()}`)
    .digest("hex")
    .slice(0, 16);

  const [row] = await db
    .insert(ghostNodeRoutesTable)
    .values({
      ghostNodeId,
      realNodeId:     opts.realNodeId     ?? null,
      decoyInterface: opts.decoyInterface ?? "wg-ghost0",
      allowedIpRange: opts.allowedIpRange,
      iptablesMarkId: opts.iptablesMarkId ?? 99,
      routingTable:   opts.routingTable   ?? 100,
      policyHash:     hash,
    })
    .returning();
  return row!;
}

export async function activateRoute(routeId: number) {
  const [row] = await db
    .update(ghostNodeRoutesTable)
    .set({ active: true, pushedAt: new Date() })
    .where(eq(ghostNodeRoutesTable.id, routeId))
    .returning();
  return row ?? null;
}

export async function deactivateRoute(routeId: number) {
  const [row] = await db
    .update(ghostNodeRoutesTable)
    .set({ active: false })
    .where(eq(ghostNodeRoutesTable.id, routeId))
    .returning();
  return row ?? null;
}

export async function getVultrDeceptionState(ghostNodeId: number) {
  const [row] = await db
    .select()
    .from(vultrNodeDeceptionStateTable)
    .where(eq(vultrNodeDeceptionStateTable.ghostNodeId, ghostNodeId))
    .limit(1);
  return row ?? null;
}

export async function upsertVultrDeceptionState(ghostNodeId: number, opts: {
  vultrInstanceId?: string;
  nodeId?: number;
  decoyEnabled: boolean;
  decoyInterface?: string;
  policyHash?: string;
}) {
  const existing = await getVultrDeceptionState(ghostNodeId);
  if (existing) {
    const [row] = await db
      .update(vultrNodeDeceptionStateTable)
      .set({
        decoyEnabled:  opts.decoyEnabled,
        decoyInterface: opts.decoyInterface ?? existing.decoyInterface,
        policyHash:    opts.policyHash ?? existing.policyHash,
        lastPolicyPush: new Date(),
      })
      .where(eq(vultrNodeDeceptionStateTable.id, existing.id))
      .returning();
    return row!;
  }

  const [row] = await db
    .insert(vultrNodeDeceptionStateTable)
    .values({
      ghostNodeId,
      vultrInstanceId: opts.vultrInstanceId ?? null,
      nodeId:          opts.nodeId          ?? null,
      decoyEnabled:    opts.decoyEnabled,
      decoyInterface:  opts.decoyInterface  ?? "wg-ghost0",
      policyHash:      opts.policyHash      ?? null,
      lastPolicyPush:  new Date(),
    })
    .returning();
  return row!;
}
