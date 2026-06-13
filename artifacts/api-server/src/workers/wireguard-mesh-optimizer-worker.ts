// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { registerWorker } from "../lib/worker-registry";
import { optimizeWireGuardMesh } from "../services/wireguardMeshOptimizerService";
import { logger } from "../lib/logger";

registerWorker({
  name: "wireguard-mesh-optimizer",
  intervalMs: 10 * 60_000,
  enabled: () => process.env.PROXHQ_ENABLE_WG_MESH_OPTIMIZER !== "0",
  async run() {
    const result = await optimizeWireGuardMesh();
    logger.info(
      { nodeCount: result.nodes.length },
      "WireGuard mesh optimization completed",
    );
  },
});
