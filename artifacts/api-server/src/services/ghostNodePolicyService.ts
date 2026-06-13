// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Node Policy Service — per-node deception policy CRUD and push.
import { db } from "@workspace/db";
import { ghostNodePoliciesTable, ghostNodesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import crypto from "crypto";

export async function getActivePolicy(ghostNodeId: number) {
  const [row] = await db
    .select()
    .from(ghostNodePoliciesTable)
    .where(eq(ghostNodePoliciesTable.ghostNodeId, ghostNodeId))
    .orderBy(desc(ghostNodePoliciesTable.policyVersion))
    .limit(1);
  return row ?? null;
}

export async function createPolicy(ghostNodeId: number, createdBy: string, opts: {
  decoyBanners?: Record<string, string>[];
  portMappings?: Record<number, string>;
  isolationMode?: "full" | "partial" | "monitor_only";
  allowTarpitting?: boolean;
  allowBeacons?: boolean;
  tarpitMaxMs?: number;
  rateLimit?: number;
  autoBlockThreshold?: number;
  siemFanout?: boolean;
  logLevel?: "minimal" | "standard" | "verbose";
}) {
  const existing = await getActivePolicy(ghostNodeId);
  const version  = (existing?.policyVersion ?? 0) + 1;

  const banners  = opts.decoyBanners ? JSON.stringify(opts.decoyBanners) : null;
  const ports    = opts.portMappings ? JSON.stringify(opts.portMappings) : null;

  const payload  = { version, ghostNodeId, ...opts, decoyBanners: banners, portMappings: ports };
  const hash     = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);

  const [row] = await db
    .insert(ghostNodePoliciesTable)
    .values({
      ghostNodeId,
      policyVersion:      version,
      decoyBanners:       banners,
      portMappings:       ports,
      isolationMode:      opts.isolationMode      ?? "full",
      allowTarpitting:    opts.allowTarpitting    ?? true,
      allowBeacons:       opts.allowBeacons       ?? true,
      tarpitMaxMs:        opts.tarpitMaxMs        ?? 30000,
      rateLimit:          opts.rateLimit          ?? 30,
      autoBlockThreshold: opts.autoBlockThreshold ?? 10,
      siemFanout:         opts.siemFanout         ?? true,
      logLevel:           opts.logLevel           ?? "standard",
      policyHash:         hash,
      createdBy,
    })
    .returning();

  // Mark older policies inactive
  if (existing) {
    await db
      .update(ghostNodePoliciesTable)
      .set({ active: false })
      .where(eq(ghostNodePoliciesTable.id, existing.id));
  }

  return row!;
}

export async function markPolicyPushed(policyId: number) {
  const [row] = await db
    .update(ghostNodePoliciesTable)
    .set({ pushedAt: new Date() })
    .where(eq(ghostNodePoliciesTable.id, policyId))
    .returning();
  return row ?? null;
}
