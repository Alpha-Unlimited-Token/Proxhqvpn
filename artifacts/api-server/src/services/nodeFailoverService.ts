// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { publishPlatformEvent } from "../lib/event-bus";
import { selectBestVpnNode } from "./nodeRoutingService";

export async function findFailoverNode(input: {
  failedNodeId: string;
  preferredRegion?: string | null;
}) {
  const candidate = await selectBestVpnNode({
    preferredRegion: input.preferredRegion,
    excludeNodeIds: [input.failedNodeId],
  });

  if (!candidate) {
    await publishPlatformEvent({
      type: "node.failover.unavailable",
      subject: input.failedNodeId,
      severity: "critical",
      payload: input,
    });

    return null;
  }

  const nodeId = String(
    candidate.node.id ?? candidate.node.nodeId ?? candidate.node.node_id,
  );

  await publishPlatformEvent({
    type: "node.failover.selected",
    subject: input.failedNodeId,
    severity: "warn",
    payload: {
      failedNodeId: input.failedNodeId,
      replacementNodeId: nodeId,
      score: candidate.health.score,
      region: candidate.region,
    },
  });

  return candidate;
}
