// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { registerWorker } from "../lib/worker-registry";
import { reconcileWireGuardPeers } from "../services/wireguardPeerReconciliationService";
import { logger } from "../lib/logger";

registerWorker({
  name: "wireguard-peer-reconciliation",
  intervalMs: 5 * 60_000,
  enabled: () => process.env.PROXHQ_ENABLE_WG_RECONCILIATION !== "0",
  async run() {
    const result = await reconcileWireGuardPeers();
    logger.info(result, "WireGuard peer reconciliation completed");
  },
});
