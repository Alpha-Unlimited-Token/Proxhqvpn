// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { recoverTunnel } from "./tunnelRecoveryService";
import { quarantineNode } from "./nodeQuarantineService";

export async function performSelfHealing(input: {
  nodeId: string;
  failureType: string;
}) {
  switch (input.failureType) {
    case "latency":
      return recoverTunnel({
        userId: "system",
        failedNodeId: input.nodeId,
        reason: "latency_failure",
      });

    case "compromised":
      return quarantineNode({
        nodeId: input.nodeId,
        reason: "automated_compromise_response",
      });

    default:
      return {
        status: "ignored",
      };
  }
}
