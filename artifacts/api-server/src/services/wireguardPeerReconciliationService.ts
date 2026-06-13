// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { getAvailableVpnNodes } from "./nodeService";
import { publishPlatformEvent } from "../lib/event-bus";
import { validateWireGuardPublicKey } from "./wireguardConfigService";

export async function reconcileWireGuardPeers() {
  const nodes = await getAvailableVpnNodes();

  const invalidNodes = (nodes as any[]).filter((node) => {
    const publicKey =
      node.publicKey ?? node.public_key ?? node.wireguardPublicKey;
    return !publicKey || !validateWireGuardPublicKey(String(publicKey));
  });

  if (invalidNodes.length > 0) {
    await publishPlatformEvent({
      type: "wireguard.peers.invalid_nodes_detected",
      severity: "warn",
      payload: {
        count: invalidNodes.length,
        nodeIds: invalidNodes.map(
          (node) => node.id ?? node.nodeId ?? node.node_id,
        ),
      },
    });
  }

  return {
    totalNodes: nodes.length,
    invalidNodes: invalidNodes.length,
    ok: invalidNodes.length === 0,
  };
}
