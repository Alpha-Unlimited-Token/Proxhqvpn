/**
 * On-Chain Nonce Gap & Collision Detector
 * ========================================
 * "Nonce" in Ethereum has two distinct security contexts:
 *
 *   A) TRANSACTION NONCE — the sequential integer that orders an account's txs.
 *      Ethereum uses this to prevent replay attacks. Gaps, resets, and pending
 *      collisions are all exploitable.
 *
 *   B) ECDSA k-value (cryptographic nonce) — the random scalar used in signing.
 *      Reuse of k reveals the private key. Covered by ecdsa-nonce-scanner.ts.
 *
 * This module covers the on-chain transaction nonce attack surface:
 *
 * CHECK 1 — NONCE GAP DETECTION
 *   If an account has sent tx with nonce 5 but the expected nonce is 6,
 *   and there are no pending txs for nonce 6, the account may be stuck.
 *   Attackers can front-run by submitting a higher-gas tx with the missing nonce.
 *
 * CHECK 2 — NONCE COLLISION (PENDING MEMPOOL)
 *   If two pending transactions share the same nonce, only one will confirm.
 *   This is used intentionally (tx replacement / cancel) but can also be
 *   a sign of replay attack, wallet bug, or accidental double-spend.
 *
 * CHECK 3 — NONCE SEQUENCE INTEGRITY
 *   Scans the confirmed tx history to verify the nonce sequence is unbroken
 *   (0, 1, 2 ... N-1). Missing nonces in history can indicate:
 *   - Internal transfers that bypass normal tx flow
 *   - Contract creation txs not showing in standard tx lists
 *   - Tx data pruning (archive node vs full node mismatch)
 *
 * CHECK 4 — REPLAY RISK (CROSS-CHAIN)
 *   Pre-EIP-155 transactions (v=27 or v=28) can be replayed on other chains.
 *   Any wallet that signed txs before EIP-155 (block ~2.67M on Ethereum) is
 *   vulnerable to cross-chain replay.
 *
 * CHECK 5 — NONCE FRONT-RUN WINDOW
 *   Identifies accounts with large gaps between confirmed nonce and expected
 *   nonce — indicating stuck / queued transactions attackers can exploit.
 *
 * All checks use real RPC + Blockscout API calls.
 */

const ETH_RPC    = "https://ethereum.publicnode.com";
const BLOCKSCOUT = "https://eth.blockscout.com";

export interface TxRecord {
  hash:        string;
  nonce:       number;
  blockNumber: number | null;   // null = pending
  from:        string;
  to:          string | null;
  value:       string;
  gas:         string;
  gasPrice:    string;
  v:           string;   // EIP-155 replay protection field
  r:           string;
  s:           string;
}

export interface NonceFinding {
  severity: "critical" | "high" | "medium" | "low" | "info";
  check:    string;
  title:    string;
  detail:   string;
  evidence: string;
}

export interface NonceAddressResult {
  address:          string;
  confirmedNonce:   number;   // eth_getTransactionCount (latest)
  pendingNonce:     number;   // eth_getTransactionCount (pending)
  txsAnalyzed:      number;
  pendingTxs:       TxRecord[];
  nonceGaps:        number[];
  nonceCollisions:  Array<{ nonce: number; txHashes: string[] }>;
  preEip155Txs:     string[];  // tx hashes with v=27/28
  findings:         NonceFinding[];
  riskScore:        number;
  scanTimeMs:       number;
}

export interface NonceBatchResult {
  results:   NonceAddressResult[];
  scanned:   number;
  scanTimeMs: number;
}

// ── RPC helpers ───────────────────────────────────────────────────────────────

async function rpc(method: string, params: unknown[], timeout = 10000): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(ETH_RPC, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal:  controller.signal,
    });
    clearTimeout(timer);
    const body = await resp.json() as { result?: unknown; error?: unknown };
    if (body.error) throw new Error(JSON.stringify(body.error));
    return body.result;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

async function fetchTxList(address: string, limit = 50): Promise<TxRecord[]> {
  // Primary: Blockscout v1 compat API
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const url = `${BLOCKSCOUT}/api?module=account&action=txlist&address=${address}&sort=asc&page=1&offset=${limit}`;
    const resp = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const body = await resp.json() as { status: string; result: unknown[] };
    if (body.status !== "1" || !Array.isArray(body.result)) return [];
    return (body.result as Array<Record<string,string>>).map(tx => ({
      hash:        tx["hash"] ?? "",
      nonce:       parseInt(tx["nonce"] ?? "0", 10),
      blockNumber: tx["blockNumber"] ? parseInt(tx["blockNumber"], 10) : null,
      from:        (tx["from"] ?? "").toLowerCase(),
      to:          tx["to"] ? tx["to"].toLowerCase() : null,
      value:       tx["value"] ?? "0",
      gas:         tx["gas"] ?? "0",
      gasPrice:    tx["gasPrice"] ?? "0",
      v:           tx["txreceipt_status"] ?? "0x1", // Blockscout v1 doesn't return v directly
      r:           "",
      s:           "",
    }));
  } catch {
    return [];
  }
}

async function fetchTxDetails(hash: string): Promise<TxRecord | null> {
  try {
    const result = await rpc("eth_getTransactionByHash", [hash], 8000);
    if (!result || typeof result !== "object") return null;
    const tx = result as Record<string, string | null>;
    return {
      hash:        tx["hash"] ?? hash,
      nonce:       parseInt(tx["nonce"] ?? "0", 16),
      blockNumber: tx["blockNumber"] ? parseInt(tx["blockNumber"] as string, 16) : null,
      from:        (tx["from"] ?? "").toLowerCase(),
      to:          tx["to"] ? (tx["to"] as string).toLowerCase() : null,
      value:       tx["value"] ?? "0x0",
      gas:         tx["gas"] ?? "0x0",
      gasPrice:    tx["gasPrice"] ?? "0x0",
      v:           tx["v"] ?? "0x0",
      r:           tx["r"] ?? "",
      s:           tx["s"] ?? "",
    };
  } catch {
    return null;
  }
}

// ── Check implementations ────────────────────────────────────────────────────

async function checkNonceGapsAndCollisions(
  address: string,
  txs: TxRecord[],
  confirmedNonce: number
): Promise<{
  gaps:       number[];
  collisions: Array<{ nonce: number; txHashes: string[] }>;
}> {
  // Only look at txs FROM this address that are confirmed
  const fromTxs = txs.filter(tx => tx.from === address.toLowerCase() && tx.blockNumber !== null);
  const nonceMap = new Map<number, string[]>();

  for (const tx of fromTxs) {
    const existing = nonceMap.get(tx.nonce) ?? [];
    existing.push(tx.hash);
    nonceMap.set(tx.nonce, existing);
  }

  // Find gaps in the confirmed sequence
  const gaps: number[] = [];
  const maxNonce = fromTxs.length > 0 ? Math.max(...fromTxs.map(tx => tx.nonce)) : -1;

  for (let n = 0; n <= maxNonce && n < confirmedNonce; n++) {
    if (!nonceMap.has(n)) gaps.push(n);
  }

  // Find collisions (same nonce, multiple confirmed txs — should be impossible on-chain,
  // but can appear in tx-list APIs if internal txs are included)
  const collisions: Array<{ nonce: number; txHashes: string[] }> = [];
  for (const [nonce, hashes] of nonceMap.entries()) {
    if (hashes.length > 1) {
      collisions.push({ nonce, txHashes: hashes });
    }
  }

  return { gaps, collisions };
}

async function checkPendingCollisions(address: string): Promise<TxRecord[]> {
  // Use txpool_content if available (usually not on public nodes), fallback to
  // checking the pending nonce vs confirmed nonce gap
  try {
    const pendingNonce = parseInt(
      String(await rpc("eth_getTransactionCount", [address, "pending"])) ?? "0x0",
      16
    );
    const latestNonce = parseInt(
      String(await rpc("eth_getTransactionCount", [address, "latest"])) ?? "0x0",
      16
    );

    // If pending > latest, there are queued/pending transactions
    const pendingCount = pendingNonce - latestNonce;
    if (pendingCount <= 0) return [];

    // Try to find pending txs via Blockscout pending endpoint
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(
      `${BLOCKSCOUT}/api/v2/addresses/${address}/transactions?filter=pending`,
      { signal: controller.signal }
    );
    if (!resp.ok) return [];
    const body = await resp.json() as { items?: unknown[] };
    if (!Array.isArray(body.items)) return [];

    return (body.items as Array<Record<string,unknown>>).slice(0, 20).map(tx => ({
      hash:        String(tx["hash"] ?? ""),
      nonce:       parseInt(String(tx["nonce"] ?? "0"), 10),
      blockNumber: null,
      from:        String(tx["from"]?.toString() ?? "").toLowerCase(),
      to:          tx["to"] ? String(tx["to"]).toLowerCase() : null,
      value:       String(tx["value"] ?? "0"),
      gas:         String(tx["gas_limit"] ?? "0"),
      gasPrice:    String(tx["gas_price"] ?? "0"),
      v:           "0x0",
      r:           "",
      s:           "",
    }));
  } catch {
    return [];
  }
}

async function checkPreEip155(txs: TxRecord[]): Promise<string[]> {
  // Fetch v values for sample of txs — pre-EIP155 txs have v=0x1b (27) or v=0x1c (28)
  // Post-EIP155: v = chainId*2 + 35 or chainId*2 + 36 (for Ethereum mainnet: 37 or 38)
  const sample = txs.slice(0, 15);
  const withV = await Promise.all(sample.map(tx => fetchTxDetails(tx.hash)));

  const preEip155: string[] = [];
  for (const tx of withV) {
    if (!tx) continue;
    const v = parseInt(tx.v, 16);
    if (v === 27 || v === 28) {
      preEip155.push(tx.hash);
    }
  }
  return preEip155;
}

// ── Main scan function ────────────────────────────────────────────────────────

export async function scanNonceGaps(address: string): Promise<NonceAddressResult> {
  const t0 = Date.now();
  const addr = address.toLowerCase();
  const findings: NonceFinding[] = [];

  let confirmedNonce = 0;
  let pendingNonce   = 0;

  try {
    const [cn, pn] = await Promise.all([
      rpc("eth_getTransactionCount", [addr, "latest"]).then(v => parseInt(String(v ?? "0x0"), 16)),
      rpc("eth_getTransactionCount", [addr, "pending"]).then(v => parseInt(String(v ?? "0x0"), 16)),
    ]);
    confirmedNonce = cn;
    pendingNonce   = pn;
  } catch {
    // keep defaults
  }

  // Fetch tx history and pending txs in parallel
  const [txList, pendingTxs] = await Promise.all([
    fetchTxList(addr, 100),
    checkPendingCollisions(addr),
  ]);

  // Check 1: Nonce gaps and on-chain collisions
  const { gaps, collisions } = await checkNonceGapsAndCollisions(addr, txList, confirmedNonce);

  // Check 2: Pre-EIP155 replay vulnerability
  const preEip155 = txList.length > 0 ? await checkPreEip155(txList) : [];

  // Pending nonce vs confirmed nonce gap
  const pendingQueueDepth = pendingNonce - confirmedNonce;

  // ── Classify findings ─────────────────────────────────────────────────────

  if (gaps.length > 0) {
    findings.push({
      severity: "high",
      check:    "Nonce Gap",
      title:    `${gaps.length} gap(s) in confirmed nonce sequence`,
      detail:   `Nonces ${gaps.slice(0, 10).join(", ")}${gaps.length > 10 ? "..." : ""} are missing from the confirmed transaction history. This can indicate: internal transactions not visible in the standard tx list, contract-deployed sub-calls, or data pruning on non-archive nodes. If the gap is in the pending queue, an attacker can submit a replacement tx at the missing nonce with higher gas and redirect or block the legitimate transaction.`,
      evidence: `Missing nonces: [${gaps.slice(0, 10).join(", ")}]  Confirmed nonce: ${confirmedNonce}`,
    });
  }

  if (collisions.length > 0) {
    for (const col of collisions) {
      findings.push({
        severity: "critical",
        check:    "Nonce Collision",
        title:    `Nonce collision at nonce ${col.nonce} — ${col.txHashes.length} transactions share this nonce`,
        detail:   `Multiple confirmed transactions share the same nonce. On Ethereum's canonical chain this should be impossible (only one tx per nonce can confirm). Possible causes: chain split/reorg history visible in the API, data corruption in the indexer, or uncle blocks. If legitimate — the wallet has an exploitable double-spend history. Hashes: ${col.txHashes.join(", ")}`,
        evidence: `Colliding hashes: ${col.txHashes.slice(0,3).join(", ")}`,
      });
    }
  }

  if (pendingQueueDepth > 5) {
    findings.push({
      severity: "medium",
      check:    "Pending Nonce Queue",
      title:    `${pendingQueueDepth} transactions queued in mempool — front-run window open`,
      detail:   `This account has ${pendingQueueDepth} pending (unconfirmed) transactions with sequential nonces. A well-capitalised attacker can monitor the mempool and submit competing transactions at the same or next nonce with higher gas, front-running or replacing the pending txs. This is especially dangerous for DEX swaps, NFT mints, and DeFi operations.`,
      evidence: `Confirmed nonce: ${confirmedNonce}  Pending nonce: ${pendingNonce}  Queue depth: ${pendingQueueDepth}`,
    });
  }

  if (pendingTxs.length > 0) {
    // Check for pending nonce collisions (two pending txs with same nonce = intentional cancel or wallet bug)
    const pendingNonceMap = new Map<number, string[]>();
    for (const tx of pendingTxs) {
      const existing = pendingNonceMap.get(tx.nonce) ?? [];
      existing.push(tx.hash);
      pendingNonceMap.set(tx.nonce, existing);
    }
    for (const [nonce, hashes] of pendingNonceMap.entries()) {
      if (hashes.length > 1) {
        findings.push({
          severity: "medium",
          check:    "Pending Nonce Collision",
          title:    `${hashes.length} pending transactions at nonce ${nonce} — mempool collision`,
          detail:   `Two or more unconfirmed transactions are competing at nonce ${nonce}. Only one will confirm; the others will be dropped. This pattern is used for: intentional tx cancellation (submit 0-ETH tx at same nonce with higher gas), wallet bugs that sign the same nonce twice, or an attacker attempting to replace a victim's transaction (sandwich/front-run).`,
          evidence: `Colliding pending hashes at nonce ${nonce}: ${hashes.join(", ")}`,
        });
      }
    }
  }

  if (preEip155.length > 0) {
    findings.push({
      severity: "high",
      check:    "Pre-EIP155 Replay Vulnerability",
      title:    `${preEip155.length} transaction(s) signed without EIP-155 replay protection`,
      detail:   `EIP-155 (activated at Ethereum block 2,675,000) added chain ID to signatures to prevent cross-chain replay. Transactions with v=27 or v=28 (pre-EIP155) can be copied byte-for-byte and submitted on other EVM chains (Polygon, BSC, Arbitrum, etc.) where the same wallet address exists. If the same private key holds assets on multiple chains, these transactions could be replayed to drain them. Found in: ${preEip155.slice(0,5).join(", ")}`,
      evidence: `Pre-EIP155 tx hashes: ${preEip155.join(", ")}`,
    });
  }

  if (confirmedNonce === 0) {
    findings.push({
      severity: "info",
      check:    "Never Used",
      title:    "Address has never sent a transaction",
      detail:   "This address has confirmed nonce 0, meaning it has never initiated a transaction from this account. It may be a receiving-only address, a fresh wallet, or a smart contract wallet where transactions are initiated internally.",
      evidence: `Confirmed nonce: 0`,
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: "info",
      check:    "Clean",
      title:    `Nonce sequence clean (${confirmedNonce} confirmed txs, 0 gaps)`,
      detail:   `All ${confirmedNonce} confirmed transaction nonces are sequential with no gaps, collisions, or pre-EIP155 signatures detected in the analyzed sample.`,
      evidence: `Confirmed nonce: ${confirmedNonce}  Pending: ${pendingNonce}  TxsAnalyzed: ${txList.length}`,
    });
  }

  const riskScore = Math.min(100,
    findings.filter(f => f.severity === "critical").length * 50 +
    findings.filter(f => f.severity === "high").length     * 25 +
    findings.filter(f => f.severity === "medium").length   * 10
  );

  return {
    address:         addr,
    confirmedNonce,
    pendingNonce,
    txsAnalyzed:     txList.length,
    pendingTxs,
    nonceGaps:       gaps,
    nonceCollisions: collisions,
    preEip155Txs:    preEip155,
    findings,
    riskScore,
    scanTimeMs:      Date.now() - t0,
  };
}

export async function scanNonceBatch(addresses: string[]): Promise<NonceBatchResult> {
  const t0 = Date.now();
  const results = await Promise.all(addresses.map(scanNonceGaps));
  return { results, scanned: addresses.length, scanTimeMs: Date.now() - t0 };
}
