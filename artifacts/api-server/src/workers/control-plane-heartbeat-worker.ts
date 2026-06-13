// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { registerWorker } from "../lib/worker-registry";
import { heartbeatControlPlaneInstance } from "../services/controlPlaneClusterService";

registerWorker({
  name: "control-plane-heartbeat",
  intervalMs: 30_000,
  enabled: () => process.env.PROXHQ_ENABLE_CLUSTER_HEARTBEAT !== "0",
  async run() {
    await heartbeatControlPlaneInstance();
  },
});
