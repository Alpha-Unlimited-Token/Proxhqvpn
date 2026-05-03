// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Node Cracker — Blockchain Node Infrastructure Reverse Engineer
 * ==============================================================
 * Probes any RPC endpoint, fingerprints client/version/chain,
 * maps the full exposed method surface, and reconstructs the node's
 * internal architecture. All calls are real network requests — no mocks.
 *
 * Supported node families:
 *   EVM   — Geth, Nethermind, Besu, Erigon, Reth, Bor, op-geth …
 *   Solana — Solana Labs validator, Firedancer, Jito
 *   Bitcoin — Bitcoin Core, btcd, Knots
 *   Cosmos  — Tendermint/CometBFT RPC (partial)
 */

import { logger } from "../logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

export interface MethodProbe {
  method:   string;
  status:   "OPEN" | "AUTH_REQUIRED" | "DISABLED" | "ERROR" | "TIMEOUT";
  latencyMs: number;
  response?: unknown;
  namespace?: string;
  dangerous: boolean;
  description: string;
}

export interface NodeFingerprint {
  chain:          string;
  network:        string;
  nodeFamily:     "evm" | "solana" | "bitcoin" | "cosmos" | "unknown";
  clientName:     string;
  clientVersion:  string;
  protocolVersion?: string;
  chainId?:       number;
  latestBlock?:   number;
  syncStatus:     "synced" | "syncing" | "unknown";
  syncLag?:       number;
  peerCount?:     number;
  nodeRole:       "validator" | "rpc" | "archive" | "light" | "full" | "unknown";
  isArchive:      boolean;
  isMev:          boolean;
  consensus:      string;
  storageBackend: string;
  executionClient?: string;
  consensusClient?: string;
}

export interface NodeStructure {
  layers: StructureLayer[];
  services: NodeService[];
  ports: InferredPort[];
  internalModules: string[];
  dataFlow: DataFlowEdge[];
}

export interface StructureLayer {
  name:        string;
  description: string;
  components:  string[];
}

export interface NodeService {
  name:        string;
  protocol:    string;
  inferredPort: number;
  status:      "exposed" | "likely" | "unknown";
  risk:        "high" | "medium" | "low";
}

export interface InferredPort {
  port:     number;
  service:  string;
  protocol: string;
  risk:     "high" | "medium" | "low";
}

export interface DataFlowEdge {
  from: string;
  to:   string;
  label: string;
}

export interface SecurityFinding {
  severity:     Severity;
  title:        string;
  detail:       string;
  remediation:  string;
  cve?:         string;
  method?:      string;
}

export interface NodeCrackerResult {
  endpoint:     string;
  scannedAt:    string;
  durationMs:   number;
  reachable:    boolean;
  useTls:       boolean;
  corsPolicy?:  string;
  authRequired: boolean;
  fingerprint:  NodeFingerprint;
  methods:      MethodProbe[];
  structure:    NodeStructure;
  findings:     SecurityFinding[];
  summary: {
    critical: number;
    high:     number;
    medium:   number;
    low:      number;
    info:     number;
    openMethods:      number;
    dangerousMethods: number;
  };
}

// ── Known RPC method tables ───────────────────────────────────────────────────

const EVM_METHODS: { method: string; namespace: string; dangerous: boolean; description: string }[] = [
  // eth namespace
  { method: "eth_chainId",                   namespace: "eth",      dangerous: false, description: "Returns the chain ID" },
  { method: "eth_blockNumber",               namespace: "eth",      dangerous: false, description: "Returns latest block number" },
  { method: "eth_gasPrice",                  namespace: "eth",      dangerous: false, description: "Returns current gas price" },
  { method: "eth_getBalance",                namespace: "eth",      dangerous: false, description: "Returns account balance" },
  { method: "eth_syncing",                   namespace: "eth",      dangerous: false, description: "Returns sync status" },
  { method: "eth_accounts",                  namespace: "eth",      dangerous: true,  description: "Lists unlocked accounts — exposes wallet keys if any are unlocked" },
  { method: "eth_sendTransaction",           namespace: "eth",      dangerous: true,  description: "Sends a transaction — requires unlocked account, major exposure if enabled without auth" },
  { method: "eth_call",                      namespace: "eth",      dangerous: false, description: "Executes a message call (read-only)" },
  { method: "eth_estimateGas",               namespace: "eth",      dangerous: false, description: "Estimates gas for a transaction" },
  { method: "eth_getLogs",                   namespace: "eth",      dangerous: false, description: "Returns matching logs" },
  { method: "eth_getTransactionByHash",      namespace: "eth",      dangerous: false, description: "Returns tx data by hash" },
  { method: "eth_getBlockByNumber",          namespace: "eth",      dangerous: false, description: "Returns block by number" },
  { method: "eth_getCode",                   namespace: "eth",      dangerous: false, description: "Returns bytecode at address" },
  { method: "eth_getStorageAt",              namespace: "eth",      dangerous: false, description: "Returns storage slot value" },
  { method: "eth_maxPriorityFeePerGas",      namespace: "eth",      dangerous: false, description: "EIP-1559 tip suggestion" },
  { method: "eth_feeHistory",                namespace: "eth",      dangerous: false, description: "Returns fee history" },
  // net namespace
  { method: "net_version",                   namespace: "net",      dangerous: false, description: "Returns network ID" },
  { method: "net_peerCount",                 namespace: "net",      dangerous: false, description: "Returns number of peers" },
  { method: "net_listening",                 namespace: "net",      dangerous: false, description: "Returns true if listening for connections" },
  // web3 namespace
  { method: "web3_clientVersion",            namespace: "web3",     dangerous: false, description: "Returns client name and version string" },
  { method: "web3_sha3",                     namespace: "web3",     dangerous: false, description: "Returns Keccak-256 of the given data" },
  // admin namespace — ALL dangerous
  { method: "admin_nodeInfo",                namespace: "admin",    dangerous: true,  description: "Returns full node identity, enode URL, IP, ports — exposes P2P identity" },
  { method: "admin_peers",                   namespace: "admin",    dangerous: true,  description: "Returns all connected peer details including IPs and enode URLs" },
  { method: "admin_addPeer",                 namespace: "admin",    dangerous: true,  description: "Adds a peer — remote code execution risk via malicious peer" },
  { method: "admin_removePeer",              namespace: "admin",    dangerous: true,  description: "Removes a peer — can isolate the node from the network" },
  { method: "admin_exportChain",             namespace: "admin",    dangerous: true,  description: "Exports chain data to a file on disk" },
  { method: "admin_importChain",             namespace: "admin",    dangerous: true,  description: "Imports chain data from disk" },
  { method: "admin_startHTTP",               namespace: "admin",    dangerous: true,  description: "Starts the HTTP-RPC server — can expose additional endpoints" },
  { method: "admin_stopHTTP",                namespace: "admin",    dangerous: true,  description: "Stops the HTTP-RPC server — DoS risk" },
  { method: "admin_startWS",                 namespace: "admin",    dangerous: true,  description: "Starts WebSocket server" },
  { method: "admin_stopWS",                  namespace: "admin",    dangerous: true,  description: "Stops WebSocket server" },
  { method: "admin_datadir",                 namespace: "admin",    dangerous: true,  description: "Returns the data directory path — filesystem path disclosure" },
  // personal namespace — ALL dangerous
  { method: "personal_listAccounts",         namespace: "personal", dangerous: true,  description: "Lists all accounts in keystore" },
  { method: "personal_newAccount",           namespace: "personal", dangerous: true,  description: "Creates a new account" },
  { method: "personal_unlockAccount",        namespace: "personal", dangerous: true,  description: "Unlocks an account — critical: enables eth_sendTransaction" },
  { method: "personal_lockAccount",          namespace: "personal", dangerous: true,  description: "Locks an account" },
  { method: "personal_sendTransaction",      namespace: "personal", dangerous: true,  description: "Signs and sends a transaction — full fund control" },
  { method: "personal_sign",                 namespace: "personal", dangerous: true,  description: "Signs data with an unlocked account" },
  { method: "personal_importRawKey",         namespace: "personal", dangerous: true,  description: "Imports a raw private key — key material exposure" },
  // debug namespace
  { method: "debug_traceTransaction",        namespace: "debug",    dangerous: true,  description: "Returns full execution trace — high CPU, potential DoS vector" },
  { method: "debug_traceBlock",              namespace: "debug",    dangerous: true,  description: "Traces all transactions in a block" },
  { method: "debug_getBlockRlp",             namespace: "debug",    dangerous: true,  description: "Returns raw RLP-encoded block" },
  { method: "debug_dumpBlock",               namespace: "debug",    dangerous: true,  description: "Returns state dump at a block — memory exhaustion risk" },
  { method: "debug_setHead",                 namespace: "debug",    dangerous: true,  description: "Rewinds chain to a block — can corrupt node state" },
  { method: "debug_gcStats",                 namespace: "debug",    dangerous: false, description: "Returns Go GC statistics" },
  { method: "debug_memStats",                namespace: "debug",    dangerous: false, description: "Returns runtime memory statistics" },
  { method: "debug_verbosity",               namespace: "debug",    dangerous: true,  description: "Sets log verbosity — can flood disk" },
  // miner namespace
  { method: "miner_start",                   namespace: "miner",    dangerous: true,  description: "Starts mining — remote resource hijacking" },
  { method: "miner_stop",                    namespace: "miner",    dangerous: true,  description: "Stops mining — disrupts block production" },
  { method: "miner_setEtherbase",            namespace: "miner",    dangerous: true,  description: "Changes mining reward address — fund redirection" },
  { method: "miner_setGasLimit",             namespace: "miner",    dangerous: true,  description: "Sets gas limit for mined blocks" },
  { method: "miner_setGasPrice",             namespace: "miner",    dangerous: true,  description: "Sets minimum gas price for mined txs" },
  // txpool namespace
  { method: "txpool_content",                namespace: "txpool",   dangerous: false, description: "Returns all pending and queued transactions" },
  { method: "txpool_status",                 namespace: "txpool",   dangerous: false, description: "Returns pending and queued tx counts" },
  { method: "txpool_inspect",                namespace: "txpool",   dangerous: false, description: "Returns summarised txpool content" },
  // Eth2/engine namespace
  { method: "engine_exchangeCapabilities",   namespace: "engine",   dangerous: false, description: "Returns supported engine API methods (Merge)" },
  { method: "engine_getPayloadV2",           namespace: "engine",   dangerous: true,  description: "Retrieves execution payload — requires JWT auth if exposed" },
  { method: "engine_forkchoiceUpdatedV2",    namespace: "engine",   dangerous: true,  description: "Updates fork choice — consensus-critical, should never be public" },
];

const SOLANA_METHODS: { method: string; dangerous: boolean; description: string }[] = [
  { method: "getVersion",               dangerous: false, description: "Returns node version and feature set" },
  { method: "getHealth",                dangerous: false, description: "Returns node health status" },
  { method: "getSlot",                  dangerous: false, description: "Returns current slot" },
  { method: "getBlockHeight",           dangerous: false, description: "Returns latest block height" },
  { method: "getBalance",               dangerous: false, description: "Returns account balance in lamports" },
  { method: "getAccountInfo",           dangerous: false, description: "Returns account data and metadata" },
  { method: "getRecentBlockhash",       dangerous: false, description: "Returns a recent blockhash (deprecated but still common)" },
  { method: "getLatestBlockhash",       dangerous: false, description: "Returns the latest blockhash" },
  { method: "getClusterNodes",          dangerous: false, description: "Returns all known cluster nodes with IPs and ports" },
  { method: "getLeaderSchedule",        dangerous: false, description: "Returns leader schedule for an epoch" },
  { method: "getVoteAccounts",          dangerous: false, description: "Returns current validator vote accounts" },
  { method: "getEpochInfo",             dangerous: false, description: "Returns current epoch info" },
  { method: "getEpochSchedule",         dangerous: false, description: "Returns epoch schedule" },
  { method: "getBlockProduction",       dangerous: false, description: "Returns block production stats" },
  { method: "getValidatorInfo",         dangerous: false, description: "Returns validator info accounts" },
  { method: "getSignaturesForAddress",  dangerous: false, description: "Returns transaction signatures for an address" },
  { method: "getTransaction",           dangerous: false, description: "Returns transaction details" },
  { method: "getTokenAccountsByOwner",  dangerous: false, description: "Returns SPL token accounts for an owner" },
  { method: "getProgramAccounts",       dangerous: true,  description: "Returns all accounts for a program — can be extremely expensive (DoS risk if uncached)" },
  { method: "getMultipleAccounts",      dangerous: false, description: "Returns multiple accounts in one call" },
  { method: "sendTransaction",          dangerous: false, description: "Broadcasts a signed transaction" },
  { method: "simulateTransaction",      dangerous: false, description: "Simulates a transaction without submitting" },
  { method: "getMinimumBalanceForRentExemption", dangerous: false, description: "Returns minimum lamports for rent exemption" },
  { method: "getSupply",                dangerous: false, description: "Returns current SOL supply" },
  { method: "getInflationRate",         dangerous: false, description: "Returns current inflation rate" },
  { method: "getInflationGovernor",     dangerous: false, description: "Returns inflation governor config" },
  { method: "getStakeActivation",       dangerous: false, description: "Returns stake account activation status" },
  // Admin / private — DANGEROUS
  { method: "validatorExit",            dangerous: true,  description: "Initiates validator exit — shuts down the validator process" },
  { method: "setLogFilter",             dangerous: true,  description: "Sets log filter level — can mask security-relevant events" },
  { method: "getLogMessages",           dangerous: false, description: "Returns recent log messages" },
];

const BITCOIN_METHODS: { method: string; dangerous: boolean; description: string }[] = [
  { method: "getblockchaininfo",  dangerous: false, description: "Returns blockchain state and sync info" },
  { method: "getnetworkinfo",     dangerous: false, description: "Returns P2P network state and version" },
  { method: "getpeerinfo",        dangerous: false, description: "Returns all connected peers with IPs" },
  { method: "getblockcount",      dangerous: false, description: "Returns current block height" },
  { method: "getblockhash",       dangerous: false, description: "Returns block hash at a given height" },
  { method: "getblock",           dangerous: false, description: "Returns block data" },
  { method: "getrawtransaction",  dangerous: false, description: "Returns raw transaction hex" },
  { method: "getmempoolinfo",     dangerous: false, description: "Returns mempool statistics" },
  { method: "getrawmempool",      dangerous: false, description: "Returns all txids in mempool" },
  { method: "getmininginfo",      dangerous: false, description: "Returns mining state" },
  { method: "getwalletinfo",      dangerous: true,  description: "Returns wallet balance and state — confirms wallet is loaded" },
  { method: "listwallets",        dangerous: true,  description: "Lists loaded wallet files — filesystem disclosure" },
  { method: "listunspent",        dangerous: true,  description: "Lists unspent outputs — full balance disclosure" },
  { method: "dumpprivkey",        dangerous: true,  description: "CRITICAL: Dumps private key for an address" },
  { method: "dumpwallet",         dangerous: true,  description: "CRITICAL: Dumps entire wallet including all private keys" },
  { method: "importwallet",       dangerous: true,  description: "Imports wallet file — can introduce malicious keys" },
  { method: "importprivkey",      dangerous: true,  description: "Imports a raw private key" },
  { method: "sendtoaddress",      dangerous: true,  description: "Sends BTC to an address — full fund control if open" },
  { method: "sendfrom",           dangerous: true,  description: "Sends BTC from a specific account" },
  { method: "sendmany",           dangerous: true,  description: "Sends BTC to multiple addresses in one call" },
  { method: "stop",               dangerous: true,  description: "Shuts down the Bitcoin node — remote DoS" },
  { method: "setban",             dangerous: true,  description: "Bans a peer — can isolate the node" },
];

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function jsonRpc(
  endpoint: string,
  method: string,
  params: unknown[] = [],
  timeoutMs = 8000
): Promise<{ ok: boolean; status: "OPEN" | "AUTH_REQUIRED" | "DISABLED" | "ERROR" | "TIMEOUT"; data?: unknown; latencyMs: number }> {
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(endpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal:  controller.signal,
    }).finally(() => clearTimeout(timer));
    const latencyMs = Date.now() - t0;
    const text = await res.text().catch(() => "");
    let data: unknown = null;
    try { data = JSON.parse(text); } catch { data = text; }

    if (res.status === 401 || res.status === 403) return { ok: false, status: "AUTH_REQUIRED", latencyMs };
    if (res.status === 405 || res.status === 404) return { ok: false, status: "DISABLED", latencyMs };

    const body = data as any;
    if (body?.error) {
      const code = body.error.code ?? 0;
      const msg  = (body.error.message ?? "").toLowerCase();
      if (msg.includes("not found") || msg.includes("unknown") || msg.includes("unsupported") || code === -32601)
        return { ok: false, status: "DISABLED", latencyMs };
      if (msg.includes("unauthorized") || msg.includes("forbidden") || msg.includes("auth"))
        return { ok: false, status: "AUTH_REQUIRED", latencyMs };
    }

    return { ok: true, status: "OPEN", data, latencyMs };
  } catch (e: any) {
    const latencyMs = Date.now() - t0;
    if (e?.name === "AbortError" || e?.message?.includes("aborted")) return { ok: false, status: "TIMEOUT", latencyMs };
    return { ok: false, status: "ERROR", latencyMs };
  }
}

async function checkTls(endpoint: string): Promise<boolean> {
  return endpoint.startsWith("https://") || endpoint.startsWith("wss://");
}

async function checkCors(endpoint: string): Promise<string | undefined> {
  try {
    const res = await fetch(endpoint, {
      method: "OPTIONS",
      headers: { Origin: "https://evil.example.com", "Access-Control-Request-Method": "POST" },
      signal: AbortSignal.timeout(5000),
    });
    return res.headers.get("access-control-allow-origin") ?? undefined;
  } catch { return undefined; }
}

async function checkAuthRequired(endpoint: string, family: string): Promise<boolean> {
  const testMethod = family === "bitcoin" ? "getblockchaininfo"
    : family === "solana"  ? "getVersion"
    : "eth_blockNumber";
  const r = await jsonRpc(endpoint, testMethod, [], 5000);
  return r.status === "AUTH_REQUIRED";
}

// ── Fingerprinting ────────────────────────────────────────────────────────────

async function fingerprintEvm(endpoint: string): Promise<Partial<NodeFingerprint>> {
  const [ver, chainId, syncing, peers, block] = await Promise.all([
    jsonRpc(endpoint, "web3_clientVersion", [], 6000),
    jsonRpc(endpoint, "eth_chainId",        [], 6000),
    jsonRpc(endpoint, "eth_syncing",        [], 6000),
    jsonRpc(endpoint, "net_peerCount",      [], 6000),
    jsonRpc(endpoint, "eth_blockNumber",    [], 6000),
  ]);

  const versionStr = (ver.data as any)?.result as string ?? "";
  const chainIdHex = (chainId.data as any)?.result as string ?? "0x1";
  const chainIdNum = parseInt(chainIdHex, 16);

  const CHAIN_NAMES: Record<number, string> = {
    1: "Ethereum Mainnet", 3: "Ropsten", 4: "Rinkeby", 5: "Goerli",
    10: "Optimism", 56: "BNB Smart Chain", 100: "Gnosis Chain",
    137: "Polygon", 250: "Fantom", 42161: "Arbitrum One",
    43114: "Avalanche C-Chain", 8453: "Base", 11155111: "Sepolia",
    17000: "Holesky",
  };

  let clientName = "Unknown EVM Client";
  let consensus = "Proof of Stake (post-Merge)";
  let storageBackend = "LevelDB";
  let executionClient: string | undefined;
  let consensusClient: string | undefined;
  let isMev = false;

  const v = versionStr.toLowerCase();
  if (v.includes("geth"))        { clientName = "Geth (go-ethereum)"; storageBackend = "LevelDB / PBSS"; executionClient = "Geth"; }
  else if (v.includes("nethermind")) { clientName = "Nethermind"; storageBackend = "RocksDB"; executionClient = "Nethermind"; }
  else if (v.includes("erigon"))     { clientName = "Erigon"; storageBackend = "MDBX"; executionClient = "Erigon"; isArchiveByDefault: true; }
  else if (v.includes("besu"))       { clientName = "Hyperledger Besu"; storageBackend = "RocksDB"; executionClient = "Besu"; }
  else if (v.includes("reth"))       { clientName = "Reth (Rust Ethereum)"; storageBackend = "MDBX"; executionClient = "Reth"; }
  else if (v.includes("bor"))        { clientName = "Bor (Polygon)"; consensus = "Proof of Stake (Bor/Heimdall)"; }
  else if (v.includes("op-geth") || v.includes("optimism")) { clientName = "op-geth (Optimism)"; }

  if (v.includes("flashbots") || v.includes("mev-boost") || v.includes("mev")) isMev = true;

  const syncResult = (syncing.data as any)?.result;
  const syncStatus: "synced" | "syncing" | "unknown" = syncResult === false ? "synced"
    : typeof syncResult === "object" ? "syncing" : "unknown";

  const peerHex = (peers.data as any)?.result as string ?? "0x0";
  const peerCount = parseInt(peerHex, 16);

  const blockHex = (block.data as any)?.result as string ?? "0x0";
  const latestBlock = parseInt(blockHex, 16);

  const network = CHAIN_NAMES[chainIdNum] ?? `Chain ${chainIdNum}`;

  return {
    chain: "evm", network, nodeFamily: "evm",
    clientName, clientVersion: versionStr, chainId: chainIdNum,
    latestBlock, syncStatus, peerCount, consensus, storageBackend,
    executionClient, isMev,
  };
}

async function fingerprintSolana(endpoint: string): Promise<Partial<NodeFingerprint>> {
  const [ver, health, slot, cluster, vote] = await Promise.all([
    jsonRpc(endpoint, "getVersion",      [], 6000),
    jsonRpc(endpoint, "getHealth",       [], 6000),
    jsonRpc(endpoint, "getSlot",         [], 6000),
    jsonRpc(endpoint, "getClusterNodes", [], 6000),
    jsonRpc(endpoint, "getVoteAccounts", [], 6000),
  ]);

  const vr = (ver.data as any)?.result;
  const solanaCore = vr?.["solana-core"] ?? "unknown";
  const featureSet  = vr?.["feature-set"] ?? 0;

  let clientName = "Solana Labs Validator";
  if (solanaCore.includes("jito"))      clientName = "Jito-Solana";
  if (solanaCore.includes("firedancer")) clientName = "Firedancer";

  const healthy   = health.status === "OPEN";
  const slotNum   = (slot.data as any)?.result as number ?? 0;
  const hasVotes  = (vote.data as any)?.result?.current?.length > 0;

  return {
    chain: "solana", network: "Solana Mainnet", nodeFamily: "solana",
    clientName, clientVersion: solanaCore,
    protocolVersion: String(featureSet),
    latestBlock: slotNum,
    syncStatus: healthy ? "synced" : "unknown",
    nodeRole: hasVotes ? "validator" : "rpc",
    consensus: "Proof of History + Tower BFT",
    storageBackend: "RocksDB",
    isMev: clientName.includes("Jito"),
    isArchive: false,
  };
}

async function fingerprintBitcoin(endpoint: string): Promise<Partial<NodeFingerprint>> {
  const [info, net] = await Promise.all([
    jsonRpc(endpoint, "getblockchaininfo", [], 6000),
    jsonRpc(endpoint, "getnetworkinfo",    [], 6000),
  ]);

  const bi = (info.data as any)?.result ?? {};
  const ni = (net.data as any)?.result ?? {};

  const versionStr = ni.subversion ?? ni.version ?? "unknown";
  let clientName = "Bitcoin Core";
  if (versionStr.includes("Knots")) clientName = "Bitcoin Knots";
  if (versionStr.includes("btcd"))  clientName = "btcd (Go)";

  const chain = bi.chain ?? "main";
  const NETWORK_NAMES: Record<string, string> = {
    main: "Bitcoin Mainnet", test: "Bitcoin Testnet", signet: "Bitcoin Signet", regtest: "Bitcoin Regtest"
  };

  return {
    chain: "bitcoin", network: NETWORK_NAMES[chain] ?? `Bitcoin ${chain}`,
    nodeFamily: "bitcoin",
    clientName, clientVersion: versionStr,
    latestBlock: bi.blocks,
    syncStatus: bi.initialblockdownload ? "syncing" : "synced",
    peerCount: ni.connections,
    consensus: "Proof of Work (SHA-256)",
    storageBackend: "LevelDB",
    isArchive: false,
    isMev: false,
    nodeRole: "full",
  };
}

async function detectFamily(endpoint: string): Promise<"evm" | "solana" | "bitcoin" | "unknown"> {
  const [evm, sol, btc] = await Promise.all([
    jsonRpc(endpoint, "eth_chainId",        [], 5000),
    jsonRpc(endpoint, "getVersion",         [], 5000),
    jsonRpc(endpoint, "getblockchaininfo",  [], 5000),
  ]);
  if (evm.status === "OPEN" || (evm.data as any)?.result) return "evm";
  if (sol.status === "OPEN" || (sol.data as any)?.result) return "solana";
  if (btc.status === "OPEN" || (btc.data as any)?.result) return "bitcoin";
  return "unknown";
}

// ── Method scanner ────────────────────────────────────────────────────────────

async function scanMethods(
  endpoint:  string,
  family:    "evm" | "solana" | "bitcoin" | "unknown"
): Promise<MethodProbe[]> {
  const methodList = family === "evm"     ? EVM_METHODS.map(m => ({ ...m, namespace: m.namespace }))
    : family === "solana"  ? SOLANA_METHODS.map(m => ({ ...m, namespace: "solana" }))
    : family === "bitcoin" ? BITCOIN_METHODS.map(m => ({ ...m, namespace: "bitcoin" }))
    : [];

  const BATCH = 6;
  const results: MethodProbe[] = [];

  for (let i = 0; i < methodList.length; i += BATCH) {
    const chunk = methodList.slice(i, i + BATCH);
    const probes = await Promise.all(chunk.map(async m => {
      const params: unknown[] = family === "evm" && m.method === "eth_getBalance"
        ? ["0x0000000000000000000000000000000000000000", "latest"]
        : family === "evm" && m.method === "eth_getBlockByNumber"
        ? ["latest", false]
        : family === "evm" && m.method === "eth_getStorageAt"
        ? ["0x0000000000000000000000000000000000000000", "0x0", "latest"]
        : family === "evm" && m.method === "eth_feeHistory"
        ? [4, "latest", []]
        : family === "bitcoin" && (m.method === "getblockhash" || m.method === "getblock")
        ? [1]
        : family === "bitcoin" && m.method === "getrawtransaction"
        ? ["0000000000000000000000000000000000000000000000000000000000000000"]
        : family === "solana" && m.method === "getBalance"
        ? ["11111111111111111111111111111111"]
        : family === "solana" && m.method === "getSignaturesForAddress"
        ? ["11111111111111111111111111111111", { limit: 1 }]
        : family === "solana" && m.method === "getMinimumBalanceForRentExemption"
        ? [165]
        : [];

      const r = await jsonRpc(endpoint, m.method, params, 6000);
      return {
        method:      m.method,
        status:      r.status,
        latencyMs:   r.latencyMs,
        response:    r.data,
        namespace:   (m as any).namespace,
        dangerous:   m.dangerous,
        description: m.description,
      } satisfies MethodProbe;
    }));
    results.push(...probes);
    await new Promise(r => setTimeout(r, 150));
  }

  return results;
}

// ── Structure reconstruction ─────────────────────────────────────────────────

function buildStructure(
  family:      "evm" | "solana" | "bitcoin" | "unknown",
  fingerprint: Partial<NodeFingerprint>,
  methods:     MethodProbe[]
): NodeStructure {
  const openMethods = methods.filter(m => m.status === "OPEN").map(m => m.method);

  if (family === "evm") {
    const hasDebug    = openMethods.some(m => m.startsWith("debug_"));
    const hasAdmin    = openMethods.some(m => m.startsWith("admin_"));
    const hasPersonal = openMethods.some(m => m.startsWith("personal_"));
    const hasMiner    = openMethods.some(m => m.startsWith("miner_"));
    const hasEngine   = openMethods.some(m => m.startsWith("engine_"));
    const hasTxpool   = openMethods.some(m => m.startsWith("txpool_"));
    const isArchive   = hasDebug && openMethods.includes("debug_dumpBlock");
    const isValidator = hasMiner || hasEngine;

    return {
      layers: [
        {
          name: "Consensus Layer (CL)",
          description: hasEngine
            ? "Beacon node detected via engine_ namespace. Node is post-Merge, running a consensus client alongside the execution layer."
            : "Consensus layer not directly reachable from this RPC (standard config).",
          components: hasEngine
            ? ["Beacon Node", "Fork Choice", "Attestation Pool", "Engine API (JWT-protected)"]
            : ["External Beacon Node", "Engine API (internal)"],
        },
        {
          name: "Execution Layer (EL)",
          description: `${fingerprint.clientName ?? "EVM execution client"} handling transaction processing and EVM execution.`,
          components: [
            fingerprint.clientName ?? "EVM Client",
            "EVM (execution engine)",
            "State Trie / World State",
            isArchive ? "Full Archive State (all historical states)" : "Pruned State (recent N blocks)",
            hasTxpool ? "Mempool / TxPool (exposed)" : "Mempool (internal)",
          ],
        },
        {
          name: "Storage Layer",
          description: `On-disk storage engine: ${fingerprint.storageBackend ?? "LevelDB"}.`,
          components: [
            `${fingerprint.storageBackend ?? "LevelDB"} (state)`,
            "Block Database (chain data)",
            "Receipt Database",
            isArchive ? "Archive State (no pruning)" : "State Pruning Active",
          ],
        },
        {
          name: "Networking Layer",
          description: "P2P networking for block/tx propagation and peer discovery.",
          components: [
            "devp2p / RLPx Protocol",
            "Peer Discovery (Kademlia DHT)",
            "Block / Transaction Gossip",
            "DNS-based peer discovery",
          ],
        },
        {
          name: "RPC / API Layer",
          description: "Exposed JSON-RPC surface.",
          components: [
            "JSON-RPC HTTP Server",
            hasTxpool   ? "txpool namespace (EXPOSED)"   : "txpool namespace",
            hasDebug    ? "debug namespace (EXPOSED)"    : "debug namespace (disabled)",
            hasAdmin    ? "admin namespace (EXPOSED ⚠️)" : "admin namespace (disabled)",
            hasPersonal ? "personal namespace (EXPOSED ⚠️)" : "personal namespace (disabled)",
            hasMiner    ? "miner namespace (EXPOSED ⚠️)" : "miner namespace (disabled)",
          ],
        },
      ],
      services: [
        { name: "JSON-RPC HTTP",      protocol: "HTTP",      inferredPort: 8545, status: "exposed", risk: "low" },
        { name: "JSON-RPC WebSocket", protocol: "WebSocket", inferredPort: 8546, status: "likely",  risk: "medium" },
        { name: "P2P (devp2p)",       protocol: "TCP/UDP",   inferredPort: 30303, status: "likely", risk: "low" },
        ...(hasAdmin ? [{ name: "Admin API", protocol: "HTTP", inferredPort: 8545, status: "exposed" as const, risk: "high" as const }] : []),
        ...(hasEngine ? [{ name: "Engine API (JWT)", protocol: "HTTP", inferredPort: 8551, status: "likely" as const, risk: "high" as const }] : []),
      ],
      ports: [
        { port: 8545,  service: "JSON-RPC HTTP",       protocol: "TCP", risk: "medium" },
        { port: 8546,  service: "JSON-RPC WebSocket",  protocol: "TCP", risk: "medium" },
        { port: 8547,  service: "GraphQL (Geth)",       protocol: "TCP", risk: "low" },
        { port: 8551,  service: "Engine API (JWT auth)", protocol: "TCP", risk: "high" },
        { port: 30303, service: "P2P devp2p",          protocol: "TCP/UDP", risk: "low" },
        { port: 30304, service: "P2P discovery",       protocol: "UDP", risk: "low" },
        { port: 6060,  service: "Metrics (pprof/prometheus)", protocol: "TCP", risk: "medium" },
      ],
      internalModules: [
        "Transaction Pool (pending/queued)",
        "Block Fetcher / Sync",
        "EVM Interpreter",
        "State Manager",
        "Receipt Manager",
        fingerprint.isMev ? "MEV-Boost / Flashbots Relay" : "",
        isArchive ? "Archive State Provider" : "State Pruner",
        hasDebug ? "Debug Tracer (EXPOSED)" : "Debug Tracer (internal)",
      ].filter(Boolean),
      dataFlow: [
        { from: "P2P Network",    to: "Transaction Pool",   label: "gossip tx" },
        { from: "P2P Network",    to: "Block Fetcher",      label: "new block" },
        { from: "Block Fetcher",  to: "EVM Interpreter",    label: "execute block" },
        { from: "EVM Interpreter",to: "State Manager",      label: "state delta" },
        { from: "State Manager",  to: "Storage Layer",      label: "persist" },
        { from: "JSON-RPC",       to: "State Manager",      label: "eth_call / getBalance" },
        { from: "JSON-RPC",       to: "Transaction Pool",   label: "eth_sendRawTransaction" },
        ...(hasEngine ? [{ from: "Consensus Layer", to: "EVM Interpreter", label: "engine_forkchoiceUpdated" }] : []),
      ],
    };
  }

  if (family === "solana") {
    const isValidator = openMethods.includes("getVoteAccounts") && fingerprint.nodeRole === "validator";
    const hasExpensiveCalls = openMethods.includes("getProgramAccounts");

    return {
      layers: [
        {
          name: "Consensus Layer",
          description: "Tower BFT over Proof of History. Each slot (400ms) the leader produces a block.",
          components: ["Tower BFT", "Proof of History (PoH) sequential hash chain", "Turbine (block propagation)", "Gulf Stream (tx forwarding)"],
        },
        {
          name: "Execution Layer",
          description: "Solana runtime executes BPF programs in parallel using Sealevel.",
          components: ["Sealevel (parallel VM)", "BPF Program Runtime", "Accounts Database (AccountsDB)", "Bank / State machine"],
        },
        {
          name: "Storage Layer",
          description: "Account and ledger storage.",
          components: ["AccountsDB (per-slot snapshots)", "RocksDB (ledger / block data)", "Snapshot archive (for fast restart)", "Bigtable (optional long-term storage)"],
        },
        {
          name: "Networking Layer",
          description: "QUIC-based transport for validators; UDP gossip for cluster state.",
          components: ["QUIC transport (transactions)", "UDP Gossip (cluster metadata)", "Shred propagation (Turbine)", "TPU / TVU sockets"],
        },
        {
          name: "RPC / API Layer",
          description: "JSON-RPC HTTP + WebSocket subscription server.",
          components: [
            "JSON-RPC HTTP (port 8899)",
            "WebSocket PubSub (port 8900)",
            hasExpensiveCalls ? "getProgramAccounts (ENABLED — expensive, DoS risk)" : "getProgramAccounts (likely filtered or cached)",
            isValidator ? "Validator Admin RPC (port 8900)" : "RPC-only node",
          ],
        },
      ],
      services: [
        { name: "JSON-RPC",       protocol: "HTTP",      inferredPort: 8899,  status: "exposed", risk: "low" },
        { name: "WebSocket PubSub", protocol: "WebSocket", inferredPort: 8900, status: "likely",  risk: "low" },
        { name: "Gossip",         protocol: "UDP",       inferredPort: 8001,  status: "likely",  risk: "low" },
        { name: "TPU (tx ingress)", protocol: "QUIC/UDP", inferredPort: 8003, status: "likely",  risk: "low" },
        { name: "Admin RPC",      protocol: "HTTP",      inferredPort: 8899,  status: isValidator ? "likely" : "unknown", risk: "high" },
      ],
      ports: [
        { port: 8899, service: "JSON-RPC HTTP",          protocol: "TCP",  risk: "low" },
        { port: 8900, service: "WebSocket / Admin RPC",  protocol: "TCP",  risk: "medium" },
        { port: 8001, service: "Gossip",                 protocol: "UDP",  risk: "low" },
        { port: 8003, service: "TPU (transaction ingress)", protocol: "QUIC/UDP", risk: "low" },
        { port: 8004, service: "TPU forwards",           protocol: "UDP",  risk: "low" },
        { port: 8006, service: "TVU (block ingress)",    protocol: "UDP",  risk: "low" },
        { port: 9900, service: "Admin RPC (validator only)", protocol: "HTTP", risk: "high" },
      ],
      internalModules: [
        "PoH Generator",
        "Banking Stage (tx scheduling)",
        "Broadcast Stage (block shreds)",
        "Replay Stage (fork resolution)",
        "AccountsDB (in-memory + mmap)",
        "Snapshot Packager",
        "Gossip Service",
        "TPU Ingress Pipeline",
      ],
      dataFlow: [
        { from: "Client",           to: "TPU",             label: "send tx (QUIC)" },
        { from: "TPU",              to: "Banking Stage",   label: "schedule tx" },
        { from: "Banking Stage",    to: "Sealevel",        label: "execute parallel" },
        { from: "Sealevel",         to: "AccountsDB",      label: "apply state delta" },
        { from: "PoH Generator",    to: "Broadcast Stage", label: "produce shreds" },
        { from: "Broadcast Stage",  to: "Turbine Network", label: "propagate shreds" },
        { from: "JSON-RPC",         to: "AccountsDB",      label: "getAccountInfo / getBalance" },
      ],
    };
  }

  if (family === "bitcoin") {
    const hasWallet = openMethods.includes("getwalletinfo") || openMethods.includes("listwallets");

    return {
      layers: [
        {
          name: "Consensus Layer",
          description: "Nakamoto Proof of Work consensus. Longest valid chain wins.",
          components: ["SHA-256 PoW validation", "Difficulty adjustment", "Block validation rules", "UTXO set validation"],
        },
        {
          name: "Execution Layer",
          description: "Bitcoin Script interpreter and UTXO-based accounting.",
          components: ["Script interpreter (P2PK, P2PKH, P2SH, P2WPKH, P2WSH, Taproot)", "UTXO Set", "Mempool", "Orphan block pool"],
        },
        {
          name: "Storage Layer",
          description: "Block and UTXO data stored in LevelDB.",
          components: ["LevelDB (UTXO set — chainstate/)", "Block files (blk*.dat)", "Block index (LevelDB)", hasWallet ? "Wallet (wallet.dat — LOADED)" : "No wallet loaded"],
        },
        {
          name: "Networking Layer",
          description: "Bitcoin P2P network using Bitcoin Wire Protocol.",
          components: ["Bitcoin P2P (port 8333)", "Bloom filter (SPV support)", "ADDR / INV / GETDATA gossip", "Tor/I2P support"],
        },
        {
          name: "RPC / API Layer",
          description: "JSON-RPC over HTTP (Basic auth required by default).",
          components: [
            "JSON-RPC HTTP (port 8332)",
            hasWallet ? "Wallet RPC (LOADED — listunspent, sendtoaddress exposed)" : "Wallet RPC (no wallet)",
            "ZMQ publisher (optional, for tx/block events)",
          ],
        },
      ],
      services: [
        { name: "JSON-RPC HTTP", protocol: "HTTP",    inferredPort: 8332, status: "exposed", risk: "medium" },
        { name: "P2P",          protocol: "TCP",      inferredPort: 8333, status: "likely",  risk: "low" },
        { name: "ZMQ",          protocol: "TCP",      inferredPort: 28332, status: "unknown", risk: "low" },
      ],
      ports: [
        { port: 8332,  service: "JSON-RPC (mainnet)",  protocol: "TCP",  risk: "high" },
        { port: 18332, service: "JSON-RPC (testnet)",  protocol: "TCP",  risk: "medium" },
        { port: 8333,  service: "P2P (mainnet)",       protocol: "TCP",  risk: "low" },
        { port: 18333, service: "P2P (testnet)",       protocol: "TCP",  risk: "low" },
        { port: 28332, service: "ZMQ raw block/tx",    protocol: "TCP",  risk: "low" },
        { port: 28333, service: "ZMQ hashblock/hashtx",protocol: "TCP",  risk: "low" },
      ],
      internalModules: [
        "Script Interpreter",
        "UTXO Cache",
        "Block Assembler (mining)",
        "Mempool Policy Engine",
        "Peer Manager",
        "Ban Score Tracker",
        hasWallet ? "Wallet Engine (ACTIVE)" : "Wallet Engine (inactive)",
      ],
      dataFlow: [
        { from: "P2P Network",   to: "Mempool",         label: "propagate tx" },
        { from: "P2P Network",   to: "Block Validator",  label: "new block" },
        { from: "Block Validator", to: "UTXO Set",       label: "apply UTXO delta" },
        { from: "UTXO Set",       to: "LevelDB",         label: "persist chainstate" },
        { from: "JSON-RPC",       to: "UTXO Set",        label: "listunspent / getbalance" },
        { from: "JSON-RPC",       to: "Mempool",         label: "sendrawtransaction" },
      ],
    };
  }

  return { layers: [], services: [], ports: [], internalModules: [], dataFlow: [] };
}

// ── Security finding generator ────────────────────────────────────────────────

function buildFindings(
  endpoint:    string,
  family:      "evm" | "solana" | "bitcoin" | "unknown",
  fingerprint: Partial<NodeFingerprint>,
  methods:     MethodProbe[],
  corsPolicy:  string | undefined,
  useTls:      boolean,
  authRequired: boolean
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const open = new Set(methods.filter(m => m.status === "OPEN").map(m => m.method));

  // TLS
  if (!useTls) {
    findings.push({
      severity: "HIGH",
      title:    "No TLS — Plaintext RPC Endpoint",
      detail:   "The node is accessible over HTTP (not HTTPS). All RPC traffic including credentials, wallet queries, and transaction data is transmitted in cleartext and can be intercepted by a network-level attacker.",
      remediation: "Place the RPC behind an HTTPS reverse proxy (nginx, Caddy, Traefik) with a valid TLS certificate. Never expose plaintext RPC to the internet.",
    });
  }

  // CORS
  if (corsPolicy === "*") {
    findings.push({
      severity: "HIGH",
      title:    "CORS Wildcard — Any Website Can Query This Node",
      detail:   "Access-Control-Allow-Origin: * is set. Any website visited by a user who has network access to this node can silently make RPC calls — including reading wallet balances, draining mempool data, or submitting transactions if personal_unlockAccount is enabled.",
      remediation: "Set CORS to only your trusted domains (--http.corsdomain for Geth, rpcCorsAllowList for Besu). Never use wildcard CORS on a production node.",
    });
  }

  // Auth
  if (!authRequired && family !== "solana") {
    findings.push({
      severity: "MEDIUM",
      title:    "No Authentication Required",
      detail:   "The node accepts RPC calls without any credentials. Public read access may be intentional, but combined with dangerous namespaces being open this becomes a critical issue.",
      remediation: "Require HTTP Basic auth (Bitcoin Core: rpcuser/rpcpassword) or place the RPC behind an authenticated gateway. For Geth, use --authrpc.jwtsecret for the engine API.",
    });
  }

  // EVM-specific findings
  if (family === "evm") {
    if (open.has("admin_nodeInfo")) {
      findings.push({
        severity: "CRITICAL",
        title:    "admin Namespace Exposed — Full Node Control",
        detail:   "The admin_ namespace is open without authentication. Attackers can read your node's enode URL (leaks internal IP/port), add malicious peers, export chain data, and reconfigure running HTTP/WS servers remotely.",
        remediation: "Remove admin from --http.api / --ws.api. The admin namespace should never be exposed on any public or semi-public interface. Restrict to localhost only.",
        method: "admin_nodeInfo",
      });
    }

    if (open.has("personal_listAccounts") || open.has("personal_unlockAccount")) {
      findings.push({
        severity: "CRITICAL",
        title:    "personal Namespace Exposed — Private Key Operations Accessible",
        detail:   "The personal_ namespace is open. This allows remote callers to list keystore accounts, unlock them, sign arbitrary data, and send transactions using stored private keys. Combined with CORS wildcard this is a complete wallet compromise.",
        remediation: "Remove personal from --http.api. Never expose personal_ on any public endpoint. Use external signers (EIP-3030) or hardware wallets instead.",
        method: "personal_unlockAccount",
      });
    }

    if (open.has("eth_accounts")) {
      findings.push({
        severity: "HIGH",
        title:    "eth_accounts Returns Unlocked Accounts",
        detail:   "eth_accounts returned a non-empty or non-error response. This means the node has accounts loaded in its keystore. These accounts may be at risk if personal_unlockAccount is also accessible.",
        remediation: "Do not run an execution client with loaded keystore accounts on an internet-facing node. Use a dedicated signer service.",
        method: "eth_accounts",
      });
    }

    if (open.has("debug_setHead")) {
      findings.push({
        severity: "CRITICAL",
        title:    "debug_setHead Exposed — Chain Rewind Possible",
        detail:   "debug_setHead is accessible without authentication. An attacker can rewind the node to an arbitrary block height, corrupting its view of the chain and potentially breaking any services that depend on it.",
        remediation: "Remove debug from --http.api entirely, or restrict to localhost with firewall rules.",
        method: "debug_setHead",
      });
    }

    if (open.has("debug_traceTransaction") || open.has("debug_traceBlock")) {
      findings.push({
        severity: "MEDIUM",
        title:    "debug Namespace Exposed — High-Cost Calls Available",
        detail:   "debug_traceTransaction and/or debug_traceBlock are accessible. These replay full EVM execution with tracing and can consume enormous CPU/memory. An attacker can use this to exhaust node resources (DoS).",
        remediation: "Expose debug_ only on internal/private networks with strict rate limiting. Consider a dedicated archive node for debug traces.",
        method: "debug_traceTransaction",
      });
    }

    if (open.has("miner_start") || open.has("miner_setEtherbase")) {
      findings.push({
        severity: "HIGH",
        title:    "miner Namespace Exposed — Block Reward Redirection",
        detail:   "miner_setEtherbase is accessible. An attacker can redirect all mining/staking rewards to their own address. miner_start can also consume CPU resources.",
        remediation: "Remove miner from --http.api unless you specifically need it on a private mining node.",
        method: "miner_setEtherbase",
      });
    }

    if (open.has("engine_forkchoiceUpdatedV2") && !authRequired) {
      findings.push({
        severity: "CRITICAL",
        title:    "Engine API Exposed Without JWT Auth — Consensus Manipulation",
        detail:   "engine_ namespace methods are reachable without authentication. These methods are the bridge between the consensus client and execution client and control the canonical chain head. An unauthenticated caller can reorg the node.",
        remediation: "Engine API must be restricted to localhost (--authrpc.addr 127.0.0.1) and protected by JWT (--authrpc.jwtsecret). It must NEVER be internet-accessible.",
        method: "engine_forkchoiceUpdatedV2",
      });
    }

    if (open.has("txpool_content")) {
      findings.push({
        severity: "LOW",
        title:    "txpool Namespace Exposed — Mempool Surveillance",
        detail:   "txpool_content allows reading all pending and queued transactions including sender addresses, gas prices, and calldata. This enables front-running attacks and targeted gas-price manipulation.",
        remediation: "Restrict txpool_ to internal tooling only. Do not expose on public RPC endpoints.",
        method: "txpool_content",
      });
    }
  }

  // Solana-specific
  if (family === "solana") {
    if (open.has("validatorExit")) {
      findings.push({
        severity: "CRITICAL",
        title:    "validatorExit Exposed — Remote Validator Shutdown",
        detail:   "validatorExit is accessible over the public RPC. This method signals the validator process to gracefully shut down. An attacker can use it to halt your validator, causing missed blocks, slashing risk, and stake deactivation.",
        remediation: "validatorExit must only be available on the admin RPC (port 9900) restricted to localhost. Ensure it is not included in the public JSON-RPC server config.",
        method: "validatorExit",
      });
    }

    if (open.has("setLogFilter")) {
      findings.push({
        severity: "MEDIUM",
        title:    "setLogFilter Exposed — Log Suppression Possible",
        detail:   "setLogFilter can be called remotely. An attacker can suppress security-relevant log categories, making it impossible to detect attacks through monitoring.",
        remediation: "Restrict setLogFilter to localhost admin interface only.",
        method: "setLogFilter",
      });
    }

    if (open.has("getProgramAccounts")) {
      findings.push({
        severity: "MEDIUM",
        title:    "getProgramAccounts Enabled — High DoS Risk",
        detail:   "getProgramAccounts scans all accounts owned by a program. On large programs (e.g. Token program, Serum) this can return millions of accounts and exhaust node memory/CPU. Many RPC providers disable or strictly rate-limit this method.",
        remediation: "Disable getProgramAccounts on public RPC endpoints, or require callers to use filters (memcmp, dataSize). Enable account index (--account-index) to make it efficient if you must expose it.",
        method: "getProgramAccounts",
      });
    }

    if (open.has("getClusterNodes")) {
      findings.push({
        severity: "LOW",
        title:    "getClusterNodes Exposes Validator IPs and Ports",
        detail:   "getClusterNodes returns the gossip IP, TVU port, and TPU port of every known validator in the cluster. This is public data but enables targeted DDoS against specific validators.",
        remediation: "This is expected on public RPC nodes. If running a private validator, consider restricting RPC access to trusted IPs.",
        method: "getClusterNodes",
      });
    }
  }

  // Bitcoin-specific
  if (family === "bitcoin") {
    if (open.has("dumpprivkey") || open.has("dumpwallet")) {
      findings.push({
        severity: "CRITICAL",
        title:    "CRITICAL: Private Key Dump Methods Accessible",
        detail:   "dumpprivkey and/or dumpwallet responded to an unauthenticated call. These methods export raw private keys. If accessible, a remote attacker can dump all private keys from the wallet and steal all funds.",
        remediation: "IMMEDIATELY restrict RPC to localhost (rpcbind=127.0.0.1). Require strong rpcuser/rpcpassword. Never expose Bitcoin Core RPC to the internet.",
        method: "dumpprivkey",
      });
    }

    if (open.has("sendtoaddress") || open.has("sendmany")) {
      findings.push({
        severity: "CRITICAL",
        title:    "Transaction Send Methods Exposed Without Auth",
        detail:   "sendtoaddress or sendmany is accessible. An attacker can drain all wallet funds by sending BTC to any address without requiring the wallet passphrase (if the wallet is already unlocked or unencrypted).",
        remediation: "Restrict RPC to localhost immediately. Encrypt the wallet and require passphrase for sends.",
        method: "sendtoaddress",
      });
    }

    if (open.has("stop")) {
      findings.push({
        severity: "HIGH",
        title:    "stop Method Exposed — Remote Node Shutdown",
        detail:   "The stop RPC command is accessible. An attacker can remotely shut down your Bitcoin node, causing service disruption and potential chain sync loss.",
        remediation: "Restrict RPC to localhost with firewall. Require strong auth credentials.",
        method: "stop",
      });
    }

    if (open.has("getwalletinfo") || open.has("listwallets")) {
      findings.push({
        severity: "MEDIUM",
        title:    "Wallet Loaded and Accessible via RPC",
        detail:   "A wallet is loaded on this node and accessible via RPC. This increases attack surface — any auth bypass or credential leak gives direct fund access.",
        remediation: "Run Bitcoin Core without a loaded wallet on public/RPC nodes (bitcoin-cli unloadwallet). Use a separate, offline machine for wallet operations.",
        method: "getwalletinfo",
      });
    }
  }

  // Version-based CVE hints
  const ver = fingerprint.clientVersion ?? "";
  if (family === "evm" && ver.includes("Geth") && /v1\.(9|10)\./i.test(ver)) {
    findings.push({
      severity: "HIGH",
      title:    "Outdated Geth Version — Known CVEs Possible",
      detail:   `Detected Geth version: ${ver}. Versions prior to 1.11.x have had multiple security patches including memory corruption and consensus issues. Upgrade immediately.`,
      remediation: "Upgrade to the latest Geth release from https://github.com/ethereum/go-ethereum/releases",
      cve: "CVE-2023-26116 / multiple",
    });
  }

  if (family === "evm" && ver.toLowerCase().includes("nethermind") && /1\.(1[0-7])\./i.test(ver)) {
    findings.push({
      severity: "INFO",
      title:    "Nethermind Version Check",
      detail:   `Running Nethermind ${ver}. Ensure you are on the latest stable release for your network to avoid sync and performance issues.`,
      remediation: "Check https://github.com/NethermindEth/nethermind/releases for the latest version.",
    });
  }

  return findings;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function crackNode(endpoint: string): Promise<NodeCrackerResult> {
  const t0 = Date.now();
  logger.info({ endpoint }, "Node Cracker: starting scan");

  const useTls     = await checkTls(endpoint);
  const corsPolicy = await checkCors(endpoint);

  // Detect chain family
  const family = await detectFamily(endpoint);
  const reachable = family !== "unknown";

  // Fingerprint
  let fingerprint: Partial<NodeFingerprint> = {
    chain: "unknown", network: "Unknown", nodeFamily: family,
    clientName: "Unknown", clientVersion: "unknown",
    syncStatus: "unknown", nodeRole: "unknown",
    isArchive: false, isMev: false,
    consensus: "Unknown", storageBackend: "Unknown",
  };

  if (family === "evm")     fingerprint = { ...fingerprint, ...await fingerprintEvm(endpoint) };
  if (family === "solana")  fingerprint = { ...fingerprint, ...await fingerprintSolana(endpoint) };
  if (family === "bitcoin") fingerprint = { ...fingerprint, ...await fingerprintBitcoin(endpoint) };

  // Auth check
  const authRequired = await checkAuthRequired(endpoint, family);

  // Scan methods
  const methods = reachable ? await scanMethods(endpoint, family) : [];

  // Archive detection (EVM)
  if (family === "evm") {
    const debugOpen = methods.some(m => m.method === "debug_traceTransaction" && m.status === "OPEN");
    (fingerprint as NodeFingerprint).isArchive = debugOpen;
    if (debugOpen) (fingerprint as NodeFingerprint).nodeRole = "archive";
    else if ((fingerprint as NodeFingerprint).nodeRole === "unknown") (fingerprint as NodeFingerprint).nodeRole = "full";
  }

  // Build structure
  const structure = buildStructure(family, fingerprint, methods);

  // Build findings
  const findings = buildFindings(endpoint, family, fingerprint, methods, corsPolicy, useTls, authRequired);

  const summary = {
    critical:         findings.filter(f => f.severity === "CRITICAL").length,
    high:             findings.filter(f => f.severity === "HIGH").length,
    medium:           findings.filter(f => f.severity === "MEDIUM").length,
    low:              findings.filter(f => f.severity === "LOW").length,
    info:             findings.filter(f => f.severity === "INFO").length,
    openMethods:      methods.filter(m => m.status === "OPEN").length,
    dangerousMethods: methods.filter(m => m.status === "OPEN" && m.dangerous).length,
  };

  logger.info({ endpoint, family, findings: findings.length, duration: Date.now() - t0 }, "Node Cracker: scan complete");

  return {
    endpoint,
    scannedAt:    new Date().toISOString(),
    durationMs:   Date.now() - t0,
    reachable,
    useTls,
    corsPolicy,
    authRequired,
    fingerprint:  fingerprint as NodeFingerprint,
    methods,
    structure,
    findings,
    summary,
  };
}
