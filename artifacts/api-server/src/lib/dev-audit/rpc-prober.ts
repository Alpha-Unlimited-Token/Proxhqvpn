// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * External RPC Endpoint Prober
 * Makes real JSON-RPC calls to a target endpoint and reports exactly what
 * an attacker would discover: which methods respond, what data leaks, whether
 * authentication is enforced, and whether rate-limiting exists.
 */

export interface RpcMethodResult {
  method: string;
  category: "dangerous" | "info-leak" | "operational" | "internal";
  exposed: boolean;
  requiresAuth: boolean;
  responseTime: number;
  result: unknown;
  rawError?: string;
  risk: string;
  impact: string;
}

export interface RpcProbeResult {
  endpoint: string;
  reachable: boolean;
  serverBanner?: string;
  tlsEnabled: boolean;
  corsOrigin?: string;
  corsAllowAll: boolean;
  rateLimit?: { detected: boolean; header?: string; limit?: string };
  methods: RpcMethodResult[];
  criticalExposures: string[];
  totalExposed: number;
  riskScore: number;
  probeTimeMs: number;
}

interface MethodDef {
  method: string;
  params: unknown[];
  category: RpcMethodResult["category"];
  risk: string;
  impact: string;
}

const PROBE_METHODS: MethodDef[] = [
  {
    method: "eth_accounts",
    params: [],
    category: "dangerous",
    risk: "Returns all accounts managed by the node. On a non-hardened node, exposes real wallet addresses.",
    impact: "Attacker learns the wallet addresses under management, enabling targeted phishing and balance scanning.",
  },
  {
    method: "personal_listAccounts",
    params: [],
    category: "dangerous",
    risk: "Geth personal API — lists all accounts including unlocked ones. Should never be exposed publicly.",
    impact: "Exposes full list of managed accounts. Combined with personal_unlockAccount, enables direct fund theft.",
  },
  {
    method: "eth_coinbase",
    params: [],
    category: "info-leak",
    risk: "Returns the address receiving mining/staking rewards — reveals the operator's primary address.",
    impact: "Reveals operator wallet address, a target for phishing and direct attack.",
  },
  {
    method: "eth_mining",
    params: [],
    category: "operational",
    risk: "Returns whether the node is actively mining/validating.",
    impact: "Infrastructure intelligence — confirms this is a validator node, a high-value target.",
  },
  {
    method: "net_peerCount",
    params: [],
    category: "info-leak",
    risk: "Reveals how many peers this node has — network topology intelligence.",
    impact: "Low peer count means an isolated node that can be eclipse-attacked more easily.",
  },
  {
    method: "web3_clientVersion",
    params: [],
    category: "info-leak",
    risk: "Returns the exact client software and version (e.g. 'Geth/v1.13.4-stable/linux-amd64/go1.21.3').",
    impact: "Version disclosure enables targeted CVE exploitation against the specific client build.",
  },
  {
    method: "txpool_content",
    params: [],
    category: "dangerous",
    risk: "Returns all pending and queued transactions in the mempool — complete transaction queue visibility.",
    impact: "Attacker can front-run pending transactions, manipulate gas prices, or extract private transaction data.",
  },
  {
    method: "txpool_inspect",
    params: [],
    category: "dangerous",
    risk: "Returns a summary of all pending transactions — reveals nonces and destinations.",
    impact: "Transaction queue visibility enables front-running and nonce-squatting attacks.",
  },
  {
    method: "txpool_status",
    params: [],
    category: "operational",
    risk: "Returns mempool size — infrastructure intelligence.",
    impact: "Low-severity on its own but confirms txpool API namespace is accessible.",
  },
  {
    method: "eth_sendRawTransaction",
    params: ["0x00"],
    category: "dangerous",
    risk: "If this endpoint accepts sendRawTransaction requests without authentication, any attacker can attempt to broadcast transactions.",
    impact: "While a malformed tx will be rejected, confirming this method is accessible means an attacker with a valid signed tx can broadcast it directly through your infrastructure.",
  },
  {
    method: "debug_traceTransaction",
    params: ["0x0000000000000000000000000000000000000000000000000000000000000000"],
    category: "dangerous",
    risk: "Geth debug namespace — enables full EVM trace replay of any transaction. Should never be exposed.",
    impact: "Enables internal transaction tracing, revealing private logic and state changes in contracts.",
  },
  {
    method: "debug_dumpBlock",
    params: ["latest"],
    category: "dangerous",
    risk: "Dumps full block state including all account states — massive data leak.",
    impact: "Exposes full account state for all addresses in a block. Severe data leak.",
  },
  {
    method: "admin_peers",
    params: [],
    category: "internal",
    risk: "Geth admin namespace — lists all connected peer nodes with their enodes and IPs.",
    impact: "Reveals the full network topology, enabling targeted peer eclipse attacks.",
  },
  {
    method: "admin_nodeInfo",
    params: [],
    category: "internal",
    risk: "Returns the node's enode URL and network configuration.",
    impact: "Exposes the node's identity, enabling direct network-level attacks.",
  },
  {
    method: "eth_blockNumber",
    params: [],
    category: "operational",
    risk: "Returns the current block number — confirms the node is synced and operational.",
    impact: "Low risk on its own, but confirms this is an active Ethereum node.",
  },
  {
    method: "eth_gasPrice",
    params: [],
    category: "operational",
    risk: "Returns the current gas price estimate.",
    impact: "Infrastructure intelligence. Useful for attackers calibrating transaction costs.",
  },
  {
    method: "eth_syncing",
    params: [],
    category: "operational",
    risk: "Returns whether the node is still syncing — a syncing node has reduced security.",
    impact: "A syncing node is behind and may have stale state — easier to manipulate.",
  },
  {
    method: "parity_netPeers",
    params: [],
    category: "internal",
    risk: "OpenEthereum/Parity peer list — exposes peer topology.",
    impact: "Network topology leak enabling targeted peer attacks.",
  },
  {
    method: "parity_allAccountsInfo",
    params: [],
    category: "dangerous",
    risk: "Parity-specific — lists all account metadata including names and meta.",
    impact: "Severe: exposes all account information managed by the node.",
  },
];

async function rpcCall(
  endpoint: string,
  method: string,
  params: unknown[],
  timeoutMs = 8000
): Promise<{ result: unknown; error?: string; responseTime: number; status?: number }> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    const responseTime = Date.now() - start;
    const body = await resp.json() as Record<string, unknown>;
    if (body.error) {
      return { result: null, error: String((body.error as Record<string, unknown>)?.message ?? body.error), responseTime, status: resp.status };
    }
    return { result: body.result, responseTime, status: resp.status };
  } catch (err: unknown) {
    return {
      result: null,
      error: err instanceof Error ? err.message : "Network error",
      responseTime: Date.now() - start,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function probeRpcEndpoint(endpoint: string): Promise<RpcProbeResult> {
  const start = Date.now();
  const url = new URL(endpoint);
  const tlsEnabled = url.protocol === "https:";

  // Connectivity check
  let reachable = false;
  let serverBanner: string | undefined;
  let corsOrigin: string | undefined;
  let corsAllowAll = false;
  let rateLimit: RpcProbeResult["rateLimit"] = { detected: false };

  try {
    const headResp = await fetch(endpoint, {
      method: "OPTIONS",
      headers: {
        "Origin": "https://evil-attacker.com",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type",
      },
      signal: AbortSignal.timeout(6000),
    });
    reachable = true;
    serverBanner = headResp.headers.get("server") ?? headResp.headers.get("x-powered-by") ?? undefined;
    corsOrigin = headResp.headers.get("access-control-allow-origin") ?? undefined;
    corsAllowAll = corsOrigin === "*";

    const rlHeader = headResp.headers.get("x-ratelimit-limit") ?? headResp.headers.get("ratelimit-limit") ?? headResp.headers.get("x-rate-limit-limit");
    if (rlHeader) {
      rateLimit = { detected: true, header: "x-ratelimit-limit", limit: rlHeader };
    }
  } catch {
    // Try a basic JSON-RPC call to check reachability
    const pingResult = await rpcCall(endpoint, "eth_blockNumber", []);
    reachable = pingResult.result !== undefined || (pingResult.error !== undefined && !pingResult.error.includes("Network error"));
  }

  if (!reachable) {
    return {
      endpoint, reachable: false, tlsEnabled, corsAllowAll,
      methods: [], criticalExposures: ["Endpoint unreachable — verify URL and network access"],
      totalExposed: 0, riskScore: 0, probeTimeMs: Date.now() - start,
    };
  }

  // Probe all methods in batches of 4 for speed
  const methods: RpcMethodResult[] = [];
  const batchSize = 4;
  for (let i = 0; i < PROBE_METHODS.length; i += batchSize) {
    const batch = PROBE_METHODS.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (def) => {
        const { result, error, responseTime } = await rpcCall(endpoint, def.method, def.params);
        const exposed = result !== null && result !== undefined && !error?.includes("Method not found") && !error?.includes("method not found") && !error?.includes("does not exist") && !error?.includes("not supported") && !error?.includes("unauthorized") && !error?.includes("Unauthorized");
        const requiresAuth = !!error?.toLowerCase().includes("unauthorized") || !!error?.toLowerCase().includes("forbidden") || !!error?.toLowerCase().includes("authentication");
        return {
          method: def.method,
          category: def.category,
          exposed,
          requiresAuth,
          responseTime,
          result: exposed ? result : undefined,
          rawError: error,
          risk: def.risk,
          impact: def.impact,
        } satisfies RpcMethodResult;
      })
    );
    methods.push(...results);
  }

  const criticalExposures: string[] = [];
  if (!tlsEnabled) criticalExposures.push("No TLS — all traffic is plaintext and interceptable");
  if (corsAllowAll) criticalExposures.push("CORS wildcard (*) — any website can make authenticated RPC calls");
  for (const m of methods) {
    if (m.exposed && m.category === "dangerous") {
      criticalExposures.push(`${m.method} is publicly accessible without authentication`);
    }
  }
  if (!rateLimit.detected) {
    criticalExposures.push("No rate-limiting headers detected — endpoint is vulnerable to brute-force");
  }

  const exposed = methods.filter(m => m.exposed);
  const dangerousExposed = exposed.filter(m => m.category === "dangerous").length;
  const infoLeakExposed = exposed.filter(m => m.category === "info-leak").length;
  const internalExposed = exposed.filter(m => m.category === "internal").length;
  const riskScore = Math.min(100,
    (tlsEnabled ? 0 : 20) +
    (corsAllowAll ? 15 : 0) +
    (rateLimit.detected ? 0 : 10) +
    dangerousExposed * 12 +
    internalExposed * 8 +
    infoLeakExposed * 4
  );

  return {
    endpoint, reachable, serverBanner, tlsEnabled, corsOrigin, corsAllowAll, rateLimit,
    methods, criticalExposures, totalExposed: exposed.length, riskScore,
    probeTimeMs: Date.now() - start,
  };
}
