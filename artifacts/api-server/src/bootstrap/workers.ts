// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { startCryptoPoller } from "../lib/cryptoPoller";
import { startNodeLifecycleEngine } from "../lib/node-lifecycle-engine";
import { logger } from "../lib/logger";
import "../workers/platform-event-worker";
import "../workers/scheduler-worker";
import "../workers/node-lifecycle-worker";
import "../workers/wireguard-peer-reconciliation-worker";
import "../workers/node-maintenance-worker";
import "../workers/self-healing-worker";
import "../workers/wireguard-mesh-optimizer-worker";
import "../workers/control-plane-heartbeat-worker";
import "../workers/continuous-validation-worker";
import "../workers/node-offline-alert-worker";
import "../workers/audit-chain-integrity-worker";
import "../workers/canary-token-cleanup-worker";
import "../workers/ztna-posture-expiry-worker";
import { startRegisteredWorkers } from "../lib/worker-registry";

export function startRuntimeWorkers(): void {
  if (process.env.PROXHQ_ENABLE_CRYPTO_POLLER !== "0") {
    startCryptoPoller(60_000);
    logger.info("Crypto payment poller started");
  }

  if (process.env.PROXHQ_ENABLE_NODE_LIFECYCLE !== "0") {
    startNodeLifecycleEngine();
    logger.info("Node lifecycle engine started");
  }

  if (process.env.PROXHQ_ENABLE_REGISTERED_WORKERS !== "0") {
    startRegisteredWorkers();
  }
}
