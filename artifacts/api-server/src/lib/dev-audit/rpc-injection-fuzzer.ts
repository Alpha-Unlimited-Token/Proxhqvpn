// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * JSON-RPC Injection Fuzzer
 * ==========================
 * The blockchain equivalent of SQLmap — no SQL databases are exposed on
 * JSON-RPC nodes, but the attack surface is analogous:
 *
 * VECTOR 1 — METHOD INJECTION / ADMIN METHOD ENUMERATION
 *   Nodes should whitelist only public methods. Many misconfigured nodes
 *   expose admin_*, debug_*, txpool_*, miner_*, personal_* namespaces.
 *
 * VECTOR 2 — PARAMETER TYPE CONFUSION / JSON INJECTION
 *   Sending malformed types (null, oversized strings, negative numbers,
 *   unicode null bytes, nested objects) where scalars are expected.
 *   A vulnerable node may crash, leak stack traces, or return internal state.
 *
 * VECTOR 3 — BATCH REQUEST ABUSE
 *   JSON-RPC supports batch arrays. Sending 100+ requests in one array can:
 *   - Cause DoS (OOM, CPU spike)
 *   - Bypass per-request rate limiting
 *   - Leak timing information
 *
 * VECTOR 4 — BLOCK NUMBER OVERFLOW / BOUNDARY INJECTION
 *   Sending MAX_UINT256, negative values, "latest"+1, "pending" with
 *   eth_getBlockByNumber to probe overflow handling and state leakage.
 *
 * VECTOR 5 — ETH_CALL CALLDATA INJECTION
 *   Sending oversized calldata, known-bad selectors, reentrancy patterns,
 *   and zero-address targets to probe how the node handles bad EVM inputs.
 *
 * VECTOR 6 — RESPONSE / INFO LEAKAGE
 *   Methods that should be restricted: eth_accounts, eth_sign, personal_sign,
 *   net_version disclosure, eth_syncing state leakage.
 *
 * All probes make real HTTP calls — no simulated results.
 */

const DEFAULT_TIMEOUT = 8000;

export interface RpcProbe {
  id:          string;
  vector:      string;
  method:      string;
  params:      unknown[];
  description: string;
}

export interface RpcProbeResult {
  probe:       RpcProbe;
  statusCode:  number | null;
  responseMs:  number;
  raw:         string;
  error:       string | null;
  finding:     RpcFinding | null;
}

export interface RpcFinding {
  severity:  "critical" | "high" | "medium" | "low" | "info";
  title:     string;
  detail:    string;
  evidence:  string;
}

export interface RpcFuzzResult {
  endpoint:      string;
  probesRun:     number;
  findings:      RpcFinding[];
  probeResults:  RpcProbeResult[];
  riskScore:     number;
  scanTimeMs:    number;
}

// ── Probe Catalogue ───────────────────────────────────────────────────────────

// 1. Admin / restricted method enumeration
const ADMIN_METHODS: RpcProbe[] = [
  { id:"adm-01", vector:"Admin Methods", method:"admin_nodeInfo",               params:[],               description:"Exposes node identity, IP, enode URL, protocols" },
  { id:"adm-02", vector:"Admin Methods", method:"admin_peers",                  params:[],               description:"Lists all connected peers with IPs and node IDs" },
  { id:"adm-03", vector:"Admin Methods", method:"admin_addPeer",                params:["enode://test@127.0.0.1:30303"], description:"Allows attacker to inject peers" },
  { id:"adm-04", vector:"Admin Methods", method:"admin_datadir",                params:[],               description:"Exposes node's filesystem data directory" },
  { id:"adm-05", vector:"Admin Methods", method:"debug_traceTransaction",       params:["0x"+("a".repeat(64)), {}], description:"Full EVM trace — CPU/memory exhaustion + state leak" },
  { id:"adm-06", vector:"Admin Methods", method:"debug_dumpBlock",              params:["latest"],       description:"Dumps entire block state — massive info leak" },
  { id:"adm-07", vector:"Admin Methods", method:"debug_getModifiedAccountsInRange", params:["0x1","0x2"], description:"State diff — account leakage" },
  { id:"adm-08", vector:"Admin Methods", method:"debug_storageRangeAt",         params:["0x"+("0".repeat(64)),"0x0","0x"+("0".repeat(40)),"0x"+("0".repeat(64)),"0x64"], description:"Storage dump attack" },
  { id:"adm-09", vector:"Admin Methods", method:"txpool_content",               params:[],               description:"Exposes all pending transactions with sender data" },
  { id:"adm-10", vector:"Admin Methods", method:"txpool_inspect",               params:[],               description:"Structured pending tx list" },
  { id:"adm-11", vector:"Admin Methods", method:"txpool_status",                params:[],               description:"Queue sizes (info leak)" },
  { id:"adm-12", vector:"Admin Methods", method:"miner_start",                  params:[1],              description:"Attempts to start mining on a node" },
  { id:"adm-13", vector:"Admin Methods", method:"miner_stop",                   params:[],               description:"Halts mining" },
  { id:"adm-14", vector:"Admin Methods", method:"miner_setEtherbase",           params:["0x"+("0".repeat(40))], description:"Redirects mining rewards" },
  { id:"adm-15", vector:"Admin Methods", method:"personal_listAccounts",        params:[],               description:"Lists all wallet accounts stored on the node" },
  { id:"adm-16", vector:"Admin Methods", method:"personal_unlockAccount",       params:["0x"+("0".repeat(40)),"",0], description:"Attempts to unlock node wallet" },
  { id:"adm-17", vector:"Admin Methods", method:"personal_sendTransaction",     params:[{from:"0x"+("0".repeat(40)),to:"0x"+("0".repeat(40)),value:"0x0"},""], description:"Attempts to send tx from unlocked account" },
  { id:"adm-18", vector:"Admin Methods", method:"eth_accounts",                 params:[],               description:"Lists accounts managed by this node" },
  { id:"adm-19", vector:"Admin Methods", method:"eth_sign",                     params:["0x"+("0".repeat(40)),"0x68656c6c6f"], description:"Attempts to sign arbitrary data" },
  { id:"adm-20", vector:"Admin Methods", method:"clique_getSnapshot",           params:["latest"],       description:"PoA clique consensus data — validator list exposure" },
];

// 2. Parameter type confusion / injection
const INJECTION_PROBES: RpcProbe[] = [
  { id:"inj-01", vector:"Parameter Injection", method:"eth_getBalance",     params:[null, "latest"],                    description:"Null address injection" },
  { id:"inj-02", vector:"Parameter Injection", method:"eth_getBalance",     params:["UNION SELECT * FROM accounts--", "latest"], description:"SQL-style injection in address field" },
  { id:"inj-03", vector:"Parameter Injection", method:"eth_getBalance",     params:["0x" + "g".repeat(40), "latest"],  description:"Invalid hex characters in address" },
  { id:"inj-04", vector:"Parameter Injection", method:"eth_getBalance",     params:["0x" + "0".repeat(1000), "latest"], description:"Oversized address (1000 chars)" },
  { id:"inj-05", vector:"Parameter Injection", method:"eth_getBalance",     params:[{"$ne": null}, "latest"],           description:"NoSQL operator injection" },
  { id:"inj-06", vector:"Parameter Injection", method:"eth_getBalance",     params:["\x00\x00\x00\x00", "latest"],      description:"Null byte injection" },
  { id:"inj-07", vector:"Parameter Injection", method:"eth_getBlockByNumber", params:[-1, false],                       description:"Negative block number" },
  { id:"inj-08", vector:"Parameter Injection", method:"eth_getBlockByNumber", params:["0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff", false], description:"MAX_UINT256 block number overflow" },
  { id:"inj-09", vector:"Parameter Injection", method:"eth_getBlockByNumber", params:["0x" + "f".repeat(64), true],    description:"Overflow + full transaction objects" },
  { id:"inj-10", vector:"Parameter Injection", method:"eth_getTransactionCount", params:["0x"+("0".repeat(40)), -1],   description:"Negative block offset" },
  { id:"inj-11", vector:"Parameter Injection", method:"eth_call",           params:[{"to":null, "data":"0x"}, "latest"], description:"Null to-address in eth_call" },
  { id:"inj-12", vector:"Parameter Injection", method:"eth_call",           params:[{"to":"0x"+("0".repeat(40)), "data":"0x" + "ff".repeat(1024)}, "latest"], description:"Oversized calldata (2KB) — memory exhaustion probe" },
  { id:"inj-13", vector:"Parameter Injection", method:"eth_call",           params:[{"to":"0x"+("0".repeat(40)), "data":"0x" + "ff".repeat(32000)}, "latest"], description:"Massive calldata (64KB) — DoS probe" },
  { id:"inj-14", vector:"Parameter Injection", method:"eth_getLogs",        params:[{"fromBlock":"0x0","toBlock":"latest","topics":[null,null,null,null]}], description:"Unbounded log range — resource exhaustion" },
  { id:"inj-15", vector:"Parameter Injection", method:"eth_getLogs",        params:[{"fromBlock":"0x0","toBlock":"latest"}],  description:"Full-chain log dump — DoS + info leak" },
  { id:"inj-16", vector:"Parameter Injection", method:"eth_getStorageAt",   params:["0x"+("0".repeat(40)), "0x" + "f".repeat(64), "latest"], description:"MAX slot storage read" },
  { id:"inj-17", vector:"Parameter Injection", method:"eth_estimateGas",    params:[{"to":"0x"+("0".repeat(40)), "gas":"0x" + "f".repeat(16)}], description:"MAX gas estimation" },
];

// 3. Batch request abuse
function makeBatch(size: number): unknown[] {
  return Array.from({ length: size }, (_, i) => ({
    jsonrpc: "2.0", id: i + 1,
    method: "eth_blockNumber", params: [],
  }));
}

// 4. Info leakage probes
const INFO_PROBES: RpcProbe[] = [
  { id:"inf-01", vector:"Info Leakage", method:"net_version",        params:[],     description:"Chain/network ID disclosure" },
  { id:"inf-02", vector:"Info Leakage", method:"net_peerCount",      params:[],     description:"Number of peers (topology info)" },
  { id:"inf-03", vector:"Info Leakage", method:"net_listening",      params:[],     description:"Node connectivity status" },
  { id:"inf-04", vector:"Info Leakage", method:"web3_clientVersion", params:[],     description:"Full node client version string (fingerprint for known CVEs)" },
  { id:"inf-05", vector:"Info Leakage", method:"web3_sha3",          params:["0x" + "41".repeat(100)], description:"Hashing oracle — confirms node is live and processing" },
  { id:"inf-06", vector:"Info Leakage", method:"eth_syncing",        params:[],     description:"Sync state — reveals node is behind and vulnerable during catch-up" },
  { id:"inf-07", vector:"Info Leakage", method:"eth_coinbase",       params:[],     description:"Mining address of node" },
  { id:"inf-08", vector:"Info Leakage", method:"eth_mining",         params:[],     description:"Whether node is mining" },
  { id:"inf-09", vector:"Info Leakage", method:"eth_hashrate",       params:[],     description:"Mining hashrate" },
  { id:"inf-10", vector:"Info Leakage", method:"eth_getWork",        params:[],     description:"Current mining work — hash + seed + boundary" },
];

// ── Core HTTP prober ──────────────────────────────────────────────────────────

async function sendRpcProbe(
  endpoint: string,
  probe: RpcProbe,
  timeout = DEFAULT_TIMEOUT
): Promise<RpcProbeResult> {
  const t0 = Date.now();
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id:      1,
    method:  probe.method,
    params:  probe.params,
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const resp = await fetch(endpoint, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal:  controller.signal,
    });
    clearTimeout(timer);

    const responseMs = Date.now() - t0;
    let raw = "";
    try { raw = await resp.text(); } catch { raw = "(unreadable body)"; }

    const finding = classifyResponse(probe, resp.status, raw, responseMs);
    return { probe, statusCode: resp.status, responseMs, raw: raw.slice(0, 1200), error: null, finding };
  } catch (err) {
    const responseMs = Date.now() - t0;
    const errMsg = err instanceof Error ? err.message : String(err);
    const isTimeout = errMsg.includes("abort") || errMsg.includes("timeout");
    return {
      probe,
      statusCode: null,
      responseMs,
      raw: "",
      error: isTimeout ? "TIMEOUT" : errMsg,
      finding: isTimeout ? null : null,
    };
  }
}

// ── Response Classifier ───────────────────────────────────────────────────────

function classifyResponse(
  probe: RpcProbe,
  status: number,
  body: string,
  responseMs: number
): RpcFinding | null {

  let parsed: Record<string, unknown> | null = null;
  try { parsed = JSON.parse(body); } catch { /* not JSON */ }

  const hasResult  = parsed !== null && "result" in parsed && parsed["result"] !== null && parsed["result"] !== false;
  const hasError   = parsed !== null && "error"  in parsed;
  const errorCode  = hasError ? (parsed!["error"] as Record<string,unknown>)?.code : null;
  const errorMsg   = hasError ? String((parsed!["error"] as Record<string,unknown>)?.message ?? "") : "";
  const bodyLower  = body.toLowerCase();

  // ── Admin method exposed ──────────────────────────────────────────────────
  if (probe.vector === "Admin Methods" && hasResult) {
    let severity: RpcFinding["severity"] = "high";
    let title = `Restricted method exposed: ${probe.method}`;
    let detail = probe.description;

    if (probe.method.startsWith("personal_")) {
      severity = "critical";
      title = `CRITICAL — ${probe.method} accessible: wallet management exposed`;
      detail = `The ${probe.method} method allows remote callers to manage node-stored wallets. An attacker can enumerate, unlock, and drain accounts.`;
    } else if (probe.method.startsWith("admin_")) {
      severity = "critical";
      title = `CRITICAL — ${probe.method}: node admin API exposed`;
      detail = `The admin namespace is fully accessible. Attackers can enumerate peers, inject peer connections, read data directory paths, and perform node takeover.`;
    } else if (probe.method.startsWith("miner_")) {
      severity = "critical";
      title = `CRITICAL — ${probe.method}: miner control API exposed`;
      detail = `The miner namespace allows redirecting mining rewards, starting/stopping mining, and modifying consensus participation.`;
    } else if (probe.method.startsWith("debug_")) {
      severity = "high";
      title = `HIGH — ${probe.method}: debug API exposed (DoS + info leak)`;
      detail = `Debug methods can dump full block state, trace transactions with full EVM execution, and exhaust node memory. Should be firewalled entirely.`;
    } else if (probe.method === "txpool_content") {
      severity = "high";
      title = `HIGH — txpool_content: pending transaction leak`;
      detail = `Full pending transaction pool is publicly readable. Attackers can front-run transactions, identify targets, and extract gas price strategies.`;
    } else if (probe.method === "eth_accounts" || probe.method === "eth_sign") {
      severity = "critical";
      title = `CRITICAL — ${probe.method}: node wallet exposed`;
      detail = `The node has wallet accounts accessible via RPC. eth_sign can be used to sign arbitrary data without further auth.`;
    }

    return {
      severity, title, detail,
      evidence: body.slice(0, 400),
    };
  }

  // ── Parameter injection landed (non-error response to malformed input) ────
  if (probe.vector === "Parameter Injection" && hasResult) {
    if (probe.id === "inj-07" || probe.id === "inj-08" || probe.id === "inj-09") {
      return {
        severity: "high",
        title: `Block number boundary accepted: ${probe.method}`,
        detail: `The node accepted a ${probe.id === "inj-07" ? "negative" : "MAX_UINT256"} block number without error. This can indicate overflow handling bugs or undefined behaviour in the consensus engine.`,
        evidence: body.slice(0, 300),
      };
    }
    if (probe.id === "inj-12" || probe.id === "inj-13") {
      return {
        severity: probe.id === "inj-13" ? "high" : "medium",
        title: `Oversized calldata accepted: ${probe.id === "inj-13" ? "64KB" : "2KB"} payload processed`,
        detail: `The node returned a result for an oversized calldata payload. This can indicate missing input size limits, which can be abused for DoS by exhausting EVM memory.`,
        evidence: body.slice(0, 300),
      };
    }
    if (probe.id === "inj-14" || probe.id === "inj-15") {
      return {
        severity: "high",
        title: `Unbounded log query accepted — full-chain log dump possible`,
        detail: `eth_getLogs with fromBlock=0x0 and toBlock=latest returned data. Full-chain log scanning can exhaust node I/O and memory. Rate limiting or block range caps are not enforced.`,
        evidence: body.slice(0, 300),
      };
    }
    if (probe.id === "inj-05") {
      return {
        severity: "medium",
        title: `NoSQL-style operator injection: node processed object as address parameter`,
        detail: `An object ({"$ne": null}) was accepted where a string address was expected. A correctly hardened node should reject this with a type error at the RPC layer.`,
        evidence: body.slice(0, 300),
      };
    }
    if (probe.id === "inj-02") {
      return {
        severity: "medium",
        title: `SQL-style injection string accepted by address parser`,
        detail: `The string "UNION SELECT * FROM accounts--" was passed as an address and the node returned a result rather than a type error. No SQL is executed but this indicates absent input validation.`,
        evidence: body.slice(0, 300),
      };
    }
  }

  // ── Stack trace / internal error leakage in error body ────────────────────
  if (bodyLower.includes("at ") && bodyLower.includes("node_modules") && bodyLower.includes("error")) {
    return {
      severity: "medium",
      title: `Stack trace leaked in RPC error response`,
      detail: `The node returned a JavaScript/Go stack trace in its JSON-RPC error body. This discloses internal file paths, framework versions, and call stacks useful for exploit development.`,
      evidence: body.slice(0, 400),
    };
  }

  // ── Version string disclosure ─────────────────────────────────────────────
  if (probe.method === "web3_clientVersion" && hasResult) {
    const version = String(parsed?.["result"] ?? "");
    // Check for known-vulnerable version patterns
    const isOldGeth  = /Geth\/v1\.(9|10|11|12)\./i.test(version);
    const isOldNethermind = /Nethermind\/v1\.(1[0-5])\./i.test(version);
    const severity: RpcFinding["severity"] = isOldGeth || isOldNethermind ? "high" : "info";
    return {
      severity,
      title: `Node client version fingerprinted: ${version.slice(0, 80)}`,
      detail: isOldGeth
        ? `Old Geth version detected (${version}). Geth versions prior to v1.13 have known CVEs including the eth/66 protocol DoS (CVE-2023-40591) and snap sync state issues.`
        : isOldNethermind
        ? `Old Nethermind version detected. Check NethermindEth/nethermind GitHub advisories for your specific version.`
        : `Client version is public. Use this string to look up version-specific CVEs in NVD and client GitHub security advisories.`,
      evidence: version,
    };
  }

  // ── Sync state disclosure ─────────────────────────────────────────────────
  if (probe.method === "eth_syncing" && hasResult && typeof parsed?.["result"] === "object" && parsed?.["result"] !== false) {
    return {
      severity: "low",
      title: `Node is actively syncing — temporarily elevated attack surface`,
      detail: `Syncing nodes have partially verified state. Some attack vectors (like state root manipulation) are more effective during sync. The sync progress data also reveals the node fell behind, indicating possible availability issues.`,
      evidence: body.slice(0, 300),
    };
  }

  // ── Slow response (timing-based DoS signal) ───────────────────────────────
  if (responseMs > 5000 && !probe.id.startsWith("adm") && probe.vector === "Parameter Injection") {
    return {
      severity: "medium",
      title: `Slow response (${responseMs}ms) to malformed input — potential DoS vector`,
      detail: `The probe "${probe.description}" took ${responseMs}ms. This indicates the node is processing malformed inputs deeply before rejecting them, making it susceptible to resource-exhaustion DoS attacks.`,
      evidence: `Response time: ${responseMs}ms`,
    };
  }

  // ── net_peerCount disclosure ──────────────────────────────────────────────
  if (probe.method === "net_peerCount" && hasResult) {
    const count = parseInt(String(parsed?.["result"] ?? "0"), 16);
    if (count < 5) {
      return {
        severity: "low",
        title: `Low peer count (${count}) — eclipse attack risk`,
        detail: `This node has only ${count} peers. With so few connections, an attacker can attempt an eclipse attack by filling all peer slots with attacker-controlled nodes, isolating the node from the honest network.`,
        evidence: `peerCount: ${count}`,
      };
    }
    return {
      severity: "info",
      title: `Peer count disclosed: ${count} peers`,
      detail: "Peer count is public information but reveals network topology details.",
      evidence: `peerCount: ${count}`,
    };
  }

  return null;
}

// ── Batch abuse tester ────────────────────────────────────────────────────────

async function runBatchAbuse(endpoint: string): Promise<RpcProbeResult> {
  const probe: RpcProbe = {
    id: "bat-01", vector: "Batch Abuse", method: "eth_blockNumber[]×100",
    params: [], description: "100-request JSON-RPC batch — DoS and rate-limit bypass probe",
  };
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(makeBatch(100)),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const responseMs = Date.now() - t0;
    const raw = (await resp.text()).slice(0, 800);
    let finding: RpcFinding | null = null;
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length === 100) {
        finding = {
          severity: "high",
          title: "Batch request abuse: 100-request batch fully processed",
          detail: `The node processed all 100 batch requests without rate-limiting or truncating the batch. This is a DoS vector — an attacker can send thousands of computationally expensive requests in a single HTTP call, bypassing per-request rate limits. Recommended limit: 10–20 per batch.`,
          evidence: `Batch size accepted: ${arr.length}/100`,
        };
      } else if (Array.isArray(arr)) {
        finding = {
          severity: "medium",
          title: `Batch partially processed: ${arr.length}/100 requests returned`,
          detail: `The node truncated the batch to ${arr.length} responses. A limit exists but may be set too high. Recommended: ≤20 per batch with rate limiting.`,
          evidence: `Batch size returned: ${arr.length}`,
        };
      }
    } catch { /* not array */ }
    return { probe, statusCode: resp.status, responseMs, raw, error: null, finding };
  } catch (err) {
    return { probe, statusCode: null, responseMs: Date.now()-t0, raw: "", error: String(err), finding: null };
  }
}

// ── Main fuzzer entry point ───────────────────────────────────────────────────

export async function runRpcInjectionFuzz(
  endpoint: string,
  vectors: string[] = ["admin", "injection", "batch", "info"]
): Promise<RpcFuzzResult> {
  const t0 = Date.now();

  const activeProbes: RpcProbe[] = [
    ...(vectors.includes("admin")     ? ADMIN_METHODS   : []),
    ...(vectors.includes("injection") ? INJECTION_PROBES : []),
    ...(vectors.includes("info")      ? INFO_PROBES      : []),
  ];

  // Run all probes in parallel (capped at 40 concurrent)
  const chunkSize = 40;
  const allResults: RpcProbeResult[] = [];

  for (let i = 0; i < activeProbes.length; i += chunkSize) {
    const chunk = activeProbes.slice(i, i + chunkSize);
    const results = await Promise.all(
      chunk.map(p => sendRpcProbe(endpoint, p))
    );
    allResults.push(...results);
  }

  // Batch abuse test
  if (vectors.includes("batch")) {
    const batchResult = await runBatchAbuse(endpoint);
    allResults.push(batchResult);
  }

  const findings = allResults
    .map(r => r.finding)
    .filter((f): f is RpcFinding => f !== null);

  const criticals = findings.filter(f => f.severity === "critical").length;
  const highs     = findings.filter(f => f.severity === "high").length;
  const mediums   = findings.filter(f => f.severity === "medium").length;
  const riskScore = Math.min(100, criticals * 40 + highs * 20 + mediums * 8);

  return {
    endpoint,
    probesRun:    allResults.length,
    findings:     findings.sort((a, b) => {
      const order = { critical:0, high:1, medium:2, low:3, info:4 };
      return (order[a.severity]??5) - (order[b.severity]??5);
    }),
    probeResults: allResults,
    riskScore,
    scanTimeMs:   Date.now() - t0,
  };
}
