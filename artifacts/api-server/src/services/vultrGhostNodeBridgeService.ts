// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Vultr Ghost Node Bridge Service — syncs Vultr instances with Ghost Node registry.
// Reads Vultr API (VULTR_API_KEY env var) and correlates with ghost_nodes table.
import { db } from "@workspace/db";
import { ghostNodesTable, vultrNodeDeceptionStateTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

const VULTR_API_BASE = "https://api.vultr.com/v2";

interface VultrInstance {
  id: string;
  label: string;
  region: string;
  main_ip: string;
  status: string;
  power_status: string;
  tag: string;
  plan: string;
}

async function fetchVultrInstances(apiKey: string): Promise<VultrInstance[]> {
  const resp = await fetch(`${VULTR_API_BASE}/instances?per_page=100`, {
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) throw new Error(`Vultr API error: ${resp.status} ${resp.statusText}`);
  const data = await resp.json() as { instances?: VultrInstance[] };
  return data.instances ?? [];
}

export async function syncVultrInstances(): Promise<{
  instances: VultrInstance[];
  matched: number;
  unmatched: number;
}> {
  const apiKey = process.env["VULTR_API_KEY"];
  if (!apiKey) {
    throw new Error("VULTR_API_KEY environment variable not set.");
  }

  const instances = await fetchVultrInstances(apiKey);
  const ghostNodes = await db.select().from(ghostNodesTable);

  let matched = 0;
  let unmatched = 0;

  for (const inst of instances) {
    const matchingNode = ghostNodes.find(n => n.publicIp === inst.main_ip);
    if (matchingNode) {
      matched++;
      const existing = await db
        .select()
        .from(vultrNodeDeceptionStateTable)
        .where(eq(vultrNodeDeceptionStateTable.ghostNodeId, matchingNode.id))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(vultrNodeDeceptionStateTable).values({
          vultrInstanceId: inst.id,
          nodeId:          null,
          ghostNodeId:     matchingNode.id,
          decoyEnabled:    false,
        });
      } else {
        await db
          .update(vultrNodeDeceptionStateTable)
          .set({ vultrInstanceId: inst.id })
          .where(eq(vultrNodeDeceptionStateTable.id, existing[0]!.id));
      }
    } else {
      unmatched++;
    }
  }

  logger.info({ matched, unmatched, total: instances.length }, "[VultrBridge] Sync complete");
  return { instances, matched, unmatched };
}

export async function getDeceptionCapableInstances(): Promise<{
  instance: VultrInstance;
  ghostNodeId: number | null;
  decoyEnabled: boolean;
}[]> {
  const apiKey = process.env["VULTR_API_KEY"];
  if (!apiKey) throw new Error("VULTR_API_KEY not set.");

  const [instances, states] = await Promise.all([
    fetchVultrInstances(apiKey),
    db.select().from(vultrNodeDeceptionStateTable),
  ]);

  return instances.map(inst => {
    const state = states.find(s => s.vultrInstanceId === inst.id);
    return {
      instance:    inst,
      ghostNodeId: state?.ghostNodeId ?? null,
      decoyEnabled: state?.decoyEnabled ?? false,
    };
  });
}
