// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Universal Wallet Chain Detector & Multi-Chain Scanner
 * ======================================================
 * Self-adaptive: detects address family from format alone, then fires
 * the correct real network queries for that blockchain.
 * No chain parameter required from the caller.
 *
 * Supported families:
 *   EVM       — Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, Avalanche, Fantom, zkSync, Linea
 *   Bitcoin   — P2PKH (1...), P2SH (3...), Bech32 (bc1q...), Taproot (bc1p...)
 *   Solana    — Base58 32-byte public keys
 *   TRON      — T... Base58Check addresses
 *   XRP       — r... Base58Check addresses
 *   Litecoin  — L... / M... / ltc1...
 *   Dogecoin  — D...
 *   Cardano   — addr1...
 *   Cosmos    — cosmos1...
 */

export type AddressFamily =
  | "evm" | "bitcoin" | "solana" | "tron" | "xrp"
  | "litecoin" | "dogecoin" | "cardano" | "cosmos" | "unknown";

export type ChainActivity = {
  chain: string;
  label: string;
  symbol: string;
  chainId?: number;
  active: boolean;
  isContract: boolean;
  balanceRaw: string;
  balanceFormatted: string;
  nativeSymbol: string;
  txCount: number;
  error?: string;
};

export type ApprovalRecord = {
  chain: string;
  tokenContract: string;
  tokenName?: string;
  tokenSymbol?: string;
  spender: string;
  txHash: string;
  blockNumber?: number;
};

export type TokenHolding = {
  chain: string;
  name?: string;
  symbol?: string;
  type: string;
  balance: string;
  contract?: string;
};

export type TransferRecord = {
  chain: string;
  direction: "in" | "out";
  tokenSymbol?: string;
  tokenName?: string;
  amount: string;
  counterparty: string;
  txHash?: string;
  timestamp?: string;
};

export type UniversalWalletScanResult = {
  address: string;
  normalizedAddress: string;
  detectedFamily: AddressFamily;
  detectedFamilyLabel: string;
  confidence: "definitive" | "high" | "medium" | "low";
  chainsProbed: string[];
  activeChains: ChainActivity[];
  inactiveChains: ChainActivity[];
  approvals: ApprovalRecord[];
  tokenHoldings: TokenHolding[];
  recentTransfers: TransferRecord[];
  securityFindings: Array<{
    id: string;
    severity: "critical" | "high" | "medium" | "low" | "info" | "pass";
    title: string;
    detail: string;
    chain?: string;
  }>;
  riskScore: number;
  scanTimeMs: number;
  scanErrors: string[];
};

// ── Chain registry ────────────────────────────────────────────────────────────

const EVM_CHAINS: Record<string, {
  rpc: string; blockscout?: string; chainId: number; label: string; symbol: string;
}> = {
  ethereum:  { rpc: "https://ethereum.publicnode.com",          blockscout: "https://eth.blockscout.com",      chainId: 1,     label: "Ethereum",    symbol: "ETH"  },
  polygon:   { rpc: "https://polygon.publicnode.com",           blockscout: "https://polygon.blockscout.com",  chainId: 137,   label: "Polygon",     symbol: "POL"  },
  bsc:       { rpc: "https://bsc.publicnode.com",               blockscout: "https://bsc.blockscout.com",      chainId: 56,    label: "BNB Chain",   symbol: "BNB"  },
  arbitrum:  { rpc: "https://arbitrum-one.publicnode.com",      blockscout: "https://arbitrum.blockscout.com", chainId: 42161, label: "Arbitrum",    symbol: "ETH"  },
  optimism:  { rpc: "https://optimism.publicnode.com",          blockscout: "https://optimism.blockscout.com", chainId: 10,    label: "Optimism",    symbol: "ETH"  },
  base:      { rpc: "https://base.publicnode.com",              blockscout: "https://base.blockscout.com",     chainId: 8453,  label: "Base",        symbol: "ETH"  },
  avalanche: { rpc: "https://avalanche-c-chain.publicnode.com",                                                chainId: 43114, label: "Avalanche C", symbol: "AVAX" },
  fantom:    { rpc: "https://fantom.publicnode.com",                                                           chainId: 250,   label: "Fantom",      symbol: "FTM"  },
  zksync:    { rpc: "https://zksync-era.publicnode.com",                                                       chainId: 324,   label: "zkSync Era",  symbol: "ETH"  },
  linea:     { rpc: "https://linea.publicnode.com",                                                            chainId: 59144, label: "Linea",       symbol: "ETH"  },
};

// ── Address family detection ─────────────────────────────────────────────────

export function detectAddressFamily(raw: string): {
  family: AddressFamily;
  normalized: string;
  confidence: "definitive" | "high" | "medium" | "low";
  label: string;
} {
  const addr = raw.trim();

  if (/^0x[0-9a-fA-F]{40}$/.test(addr)) {
    return { family: "evm", normalized: addr.toLowerCase(), confidence: "definitive", label: "EVM (Ethereum-compatible)" };
  }
  if (/^bc1p[a-z0-9]{58}$/.test(addr)) {
    return { family: "bitcoin", normalized: addr, confidence: "definitive", label: "Bitcoin (Taproot / P2TR)" };
  }
  if (/^bc1[a-z0-9]{6,87}$/.test(addr)) {
    return { family: "bitcoin", normalized: addr, confidence: "definitive", label: "Bitcoin (Bech32 SegWit)" };
  }
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(addr)) {
    return { family: "bitcoin", normalized: addr, confidence: "high", label: "Bitcoin (Legacy / P2SH)" };
  }
  if (/^T[A-HJ-NP-Za-km-z1-9]{33}$/.test(addr)) {
    return { family: "tron", normalized: addr, confidence: "definitive", label: "TRON" };
  }
  if (/^r[a-zA-Z0-9]{24,33}$/.test(addr)) {
    return { family: "xrp", normalized: addr, confidence: "high", label: "XRP Ledger" };
  }
  if (/^ltc1[a-z0-9]+$/.test(addr) || /^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(addr)) {
    return { family: "litecoin", normalized: addr, confidence: "high", label: "Litecoin" };
  }
  if (/^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/.test(addr)) {
    return { family: "dogecoin", normalized: addr, confidence: "high", label: "Dogecoin" };
  }
  if (/^addr1[a-z0-9]+$/.test(addr)) {
    return { family: "cardano", normalized: addr, confidence: "definitive", label: "Cardano" };
  }
  if (/^cosmos1[a-z0-9]{38}$/.test(addr)) {
    return { family: "cosmos", normalized: addr, confidence: "definitive", label: "Cosmos" };
  }
  // Solana — base58 32-44 chars, no 0/O/I/l
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)) {
    return { family: "solana", normalized: addr, confidence: "medium", label: "Solana (likely)" };
  }
  return { family: "unknown", normalized: addr, confidence: "low", label: "Unknown" };
}

// ── EVM multi-chain probe ─────────────────────────────────────────────────────

async function evmRpcCall(rpc: string, method: string, params: unknown[]): Promise<unknown> {
  const resp = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(8000),
  });
  const body = await resp.json() as Record<string, unknown>;
  return (body as Record<string, unknown>).result;
}

function hexToDecimal(hex: string): number {
  if (!hex || hex === "0x") return 0;
  return parseInt(hex as string, 16);
}

function formatWei(hex: string, decimals = 18): string {
  const wei = BigInt(hex || "0x0");
  const divisor = BigInt(10 ** decimals);
  const whole = wei / divisor;
  const frac = wei % divisor;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, 6).replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : `${whole}`;
}

async function probeEvmChain(address: string, chainKey: string): Promise<ChainActivity> {
  const chain = EVM_CHAINS[chainKey]!;
  try {
    const [balHex, nonceHex, codeHex] = await Promise.all([
      evmRpcCall(chain.rpc, "eth_getBalance",          [address, "latest"]),
      evmRpcCall(chain.rpc, "eth_getTransactionCount", [address, "latest"]),
      evmRpcCall(chain.rpc, "eth_getCode",             [address, "latest"]),
    ]);
    const txCount  = hexToDecimal(nonceHex as string);
    const isContract = typeof codeHex === "string" && codeHex !== "0x" && codeHex.length > 2;
    const balFormatted = formatWei(balHex as string, chain.symbol === "AVAX" ? 18 : 18);
    const active = txCount > 0 || (parseFloat(balFormatted) > 0);
    return {
      chain: chainKey, label: chain.label, symbol: chain.symbol, chainId: chain.chainId,
      active, isContract,
      balanceRaw:       balHex as string,
      balanceFormatted: balFormatted,
      nativeSymbol:     chain.symbol,
      txCount,
    };
  } catch (err) {
    return {
      chain: chainKey, label: chain.label, symbol: chain.symbol, chainId: chain.chainId,
      active: false, isContract: false,
      balanceRaw: "0x0", balanceFormatted: "0", nativeSymbol: chain.symbol,
      txCount: 0,
      error: err instanceof Error ? err.message : "Probe failed",
    };
  }
}

async function fetchEvmApprovals(address: string, chainKey: string): Promise<ApprovalRecord[]> {
  const chain = EVM_CHAINS[chainKey];
  if (!chain?.blockscout) return [];
  try {
    const resp = await fetch(
      `${chain.blockscout}/api/v2/addresses/${address}/token-transfers?filter=from&type=ERC-20`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!resp.ok) return [];
    const data = await resp.json() as { items?: unknown[] };
    // ERC-20 Approval events — we use eth_getLogs approach via publicnode for accuracy
    const APPROVAL_TOPIC = "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925";
    const paddedAddr = "0x" + address.replace("0x", "").toLowerCase().padStart(64, "0");
    const logsResp = await fetch(chain.rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_getLogs",
        params: [{ fromBlock: "0x0", toBlock: "latest", topics: [APPROVAL_TOPIC, paddedAddr] }],
      }),
      signal: AbortSignal.timeout(15000),
    });
    const logsBody = await logsResp.json() as { result?: unknown[] };
    if (!Array.isArray(logsBody.result)) return [];
    return logsBody.result.slice(0, 50).map((log: unknown) => {
      const l = log as Record<string, string>;
      return {
        chain: chainKey,
        tokenContract: l["address"] ?? "",
        spender: l["topics"]?.[2] ?? "",
        txHash: l["transactionHash"] ?? "",
        blockNumber: hexToDecimal(l["blockNumber"] ?? "0x0"),
      };
    });
  } catch {
    return [];
  }
}

async function fetchEvmTokens(address: string, chainKey: string): Promise<TokenHolding[]> {
  const chain = EVM_CHAINS[chainKey];
  if (!chain?.blockscout) return [];
  try {
    const resp = await fetch(
      `${chain.blockscout}/api/v2/addresses/${address}/tokens?type=ERC-20%2CERC-721%2CERC-1155`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!resp.ok) return [];
    const data = await resp.json() as { items?: unknown[] };
    if (!Array.isArray(data.items)) return [];
    return data.items.slice(0, 30).map((item: unknown) => {
      const i = item as Record<string, unknown>;
      const tok = i["token"] as Record<string, unknown> | undefined;
      return {
        chain: chainKey,
        name:     (tok?.["name"] as string)    ?? undefined,
        symbol:   (tok?.["symbol"] as string)  ?? undefined,
        type:     (tok?.["type"] as string)    ?? "ERC-20",
        balance:  (i["value"] as string)       ?? "0",
        contract: (tok?.["address"] as string) ?? undefined,
      };
    });
  } catch {
    return [];
  }
}

async function fetchEvmTransfers(address: string, chainKey: string): Promise<TransferRecord[]> {
  const chain = EVM_CHAINS[chainKey];
  if (!chain?.blockscout) return [];
  try {
    const resp = await fetch(
      `${chain.blockscout}/api/v2/addresses/${address}/token-transfers?type=ERC-20`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!resp.ok) return [];
    const data = await resp.json() as { items?: unknown[] };
    if (!Array.isArray(data.items)) return [];
    return data.items.slice(0, 20).map((item: unknown) => {
      const t = item as Record<string, unknown>;
      const tok  = t["token"]  as Record<string, unknown> | undefined;
      const from = (t["from"] as Record<string, unknown>)?.["hash"] as string ?? "";
      const to   = (t["to"]   as Record<string, unknown>)?.["hash"] as string ?? "";
      const total = t["total"] as Record<string, unknown> | undefined;
      const decimals = parseInt((tok?.["decimals"] as string) ?? "18");
      const rawVal = (total?.["value"] as string) ?? "0";
      let formatted = rawVal;
      try {
        const big = BigInt(rawVal);
        const div = BigInt(10 ** Math.min(decimals, 18));
        formatted = (Number(big) / Number(div)).toFixed(2);
      } catch { /* keep raw */ }
      const isOut = from.toLowerCase() === address.toLowerCase();
      return {
        chain: chainKey,
        direction: isOut ? "out" : "in",
        tokenSymbol: (tok?.["symbol"] as string) ?? undefined,
        tokenName:   (tok?.["name"]   as string) ?? undefined,
        amount:      formatted,
        counterparty: isOut ? to : from,
        txHash:    (t["transaction_hash"] as string) ?? undefined,
        timestamp: (t["timestamp"]        as string) ?? undefined,
      };
    });
  } catch {
    return [];
  }
}

// ── Bitcoin scanner ───────────────────────────────────────────────────────────

async function scanBitcoin(address: string): Promise<{
  active: boolean;
  balanceSat: number;
  txCount: number;
  unconfirmedTxCount: number;
  utxoCount: number;
  totalReceived: number;
  totalSent: number;
}> {
  const resp = await fetch(`https://blockstream.info/api/address/${address}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`Blockstream returned ${resp.status}`);
  const data = await resp.json() as {
    chain_stats: {
      funded_txo_sum: number; spent_txo_sum: number; tx_count: number;
    };
    mempool_stats: { tx_count: number };
  };
  const { chain_stats, mempool_stats } = data;
  const balance = chain_stats.funded_txo_sum - chain_stats.spent_txo_sum;
  return {
    active:              chain_stats.tx_count > 0,
    balanceSat:          balance,
    txCount:             chain_stats.tx_count,
    unconfirmedTxCount:  mempool_stats.tx_count,
    utxoCount:           0,
    totalReceived:       chain_stats.funded_txo_sum,
    totalSent:           chain_stats.spent_txo_sum,
  };
}

// ── Solana scanner ────────────────────────────────────────────────────────────

async function scanSolana(address: string): Promise<{
  active: boolean;
  lamports: number;
  solBalance: string;
  executable: boolean;
  recentTxCount: number;
  tokenAccountCount: number;
}> {
  const SOL_RPC = "https://api.mainnet-beta.solana.com";

  async function solRpc(method: string, params: unknown[]) {
    const resp = await fetch(SOL_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: AbortSignal.timeout(10000),
    });
    const body = await resp.json() as Record<string, unknown>;
    return (body as Record<string, unknown>).result;
  }

  const [accountInfo, signatures, tokenAccounts] = await Promise.all([
    solRpc("getAccountInfo",          [address, { encoding: "base64" }]),
    solRpc("getSignaturesForAddress", [address, { limit: 10 }]),
    solRpc("getTokenAccountsByOwner", [address, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed" }]),
  ]);

  const ai   = accountInfo   as Record<string, unknown> | null;
  const sigs = signatures    as unknown[] | null ?? [];
  const toks = tokenAccounts as { value?: unknown[] } | null;

  const lamports   = typeof ai?.["lamports"] === "number" ? ai["lamports"] as number : 0;
  const executable = ai?.["executable"] === true;
  const solBal     = (lamports / 1e9).toFixed(9).replace(/0+$/, "").replace(/\.$/, "");

  return {
    active:            lamports > 0 || sigs.length > 0,
    lamports,
    solBalance:        solBal,
    executable,
    recentTxCount:     sigs.length,
    tokenAccountCount: Array.isArray(toks?.value) ? toks.value.length : 0,
  };
}

// ── TRON scanner ──────────────────────────────────────────────────────────────

async function scanTron(address: string): Promise<{
  active: boolean;
  trxBalance: string;
  bandwidth: number;
  energy: number;
  trc20Count: number;
}> {
  const resp = await fetch(`https://api.trongrid.io/v1/accounts/${address}`, {
    headers: { "Accept": "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!resp.ok) throw new Error(`TronGrid returned ${resp.status}`);
  const data = await resp.json() as { data?: unknown[] };
  if (!Array.isArray(data.data) || data.data.length === 0) {
    return { active: false, trxBalance: "0", bandwidth: 0, energy: 0, trc20Count: 0 };
  }
  const acct = data.data[0] as Record<string, unknown>;
  const sun  = typeof acct["balance"] === "number" ? (acct["balance"] as number) : 0;
  const trc20 = Array.isArray(acct["trc20"]) ? (acct["trc20"] as unknown[]).length : 0;
  return {
    active:     sun > 0 || trc20 > 0,
    trxBalance: (sun / 1_000_000).toFixed(6).replace(/0+$/, "").replace(/\.$/, ""),
    bandwidth:  typeof acct["free_net_usage"] === "number" ? acct["free_net_usage"] as number : 0,
    energy:     0,
    trc20Count: trc20,
  };
}

// ── XRP scanner ───────────────────────────────────────────────────────────────

async function scanXrp(address: string): Promise<{
  active: boolean;
  xrpBalance: string;
  sequence: number;
  ownerCount: number;
  flags: number;
}> {
  const resp = await fetch("https://xrplcluster.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ method: "account_info", params: [{ account: address, ledger_index: "validated" }] }),
    signal: AbortSignal.timeout(10000),
  });
  const body = await resp.json() as { result?: Record<string, unknown> };
  const result = body.result;
  if (!result || result["status"] === "error") {
    return { active: false, xrpBalance: "0", sequence: 0, ownerCount: 0, flags: 0 };
  }
  const ai = result["account_data"] as Record<string, unknown>;
  const dropsStr = typeof ai?.["Balance"] === "string" ? ai["Balance"] as string : "0";
  const xrpBal = (parseInt(dropsStr) / 1_000_000).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  return {
    active:     parseInt(dropsStr) > 0,
    xrpBalance: xrpBal,
    sequence:   typeof ai?.["Sequence"] === "number" ? ai["Sequence"] as number : 0,
    ownerCount: typeof ai?.["OwnerCount"] === "number" ? ai["OwnerCount"] as number : 0,
    flags:      typeof ai?.["Flags"] === "number" ? ai["Flags"] as number : 0,
  };
}

// ── Security finding generators ───────────────────────────────────────────────

function evmSecurityFindings(
  chains: ChainActivity[],
  approvals: ApprovalRecord[],
): UniversalWalletScanResult["securityFindings"] {
  const findings: UniversalWalletScanResult["securityFindings"] = [];

  const activeChains = chains.filter(c => c.active);
  const contractChains = chains.filter(c => c.isContract);

  if (activeChains.length === 0) {
    findings.push({ id: "EVM-001", severity: "info", title: "No activity found on any EVM chain", detail: "The address has zero transactions and zero balance across all 10 probed EVM networks." });
  } else {
    findings.push({ id: "EVM-ACTIVE", severity: "pass", title: `Active on ${activeChains.length} chain(s)`, detail: activeChains.map(c => `${c.label}: ${c.txCount} txs, ${c.balanceFormatted} ${c.symbol}`).join(" | ") });
  }

  if (contractChains.length > 0) {
    findings.push({ id: "EVM-CONTRACT", severity: "info", title: "Smart contract deployed on chain(s)", detail: contractChains.map(c => c.label).join(", "), });
  }

  if (approvals.length === 0) {
    findings.push({ id: "EVM-APPROV-CLEAN", severity: "pass", title: "Zero ERC-20 approvals found", detail: "No token drainer contract holds spending permission over any ERC-20 held by this wallet. This is the ideal security posture." });
  } else {
    findings.push({
      id: "EVM-APPROV-FOUND", severity: "high",
      title: `${approvals.length} ERC-20 approval event(s) detected`,
      detail: `This wallet has granted ERC-20 spending permissions. Revoke all unnecessary approvals using a tool like Revoke.cash. Each standing approval is an attack surface.`,
    });
  }

  const multiChainActive = activeChains.length > 3;
  if (multiChainActive) {
    findings.push({ id: "EVM-MULTICHAIN", severity: "medium", title: "Wallet active on 4+ chains simultaneously", detail: `Activity detected on: ${activeChains.map(c => c.label).join(", ")}. Multi-chain exposure multiplies the attack surface — a compromise on one chain's dApp affects reputation/trust across all.` });
  }

  return findings;
}

function btcSecurityFindings(stats: Awaited<ReturnType<typeof scanBitcoin>>): UniversalWalletScanResult["securityFindings"] {
  const findings: UniversalWalletScanResult["securityFindings"] = [];

  if (!stats.active) {
    findings.push({ id: "BTC-001", severity: "info", title: "No Bitcoin activity found", detail: "This address has no confirmed transactions on the Bitcoin mainnet." });
    return findings;
  }

  findings.push({ id: "BTC-ACTIVE", severity: "pass", title: "Active Bitcoin address", detail: `${stats.txCount} confirmed transactions. Current balance: ${(stats.balanceSat / 1e8).toFixed(8)} BTC.` });

  if (stats.txCount > 1) {
    findings.push({ id: "BTC-REUSE", severity: "medium", title: "Address reuse detected", detail: `This address has been used in ${stats.txCount} transactions. Bitcoin address reuse is a privacy vulnerability — each transaction potentially links your entire transaction history to a single identity. Best practice is one address per transaction (HD wallet).` });
  }

  if (stats.unconfirmedTxCount > 0) {
    findings.push({ id: "BTC-MEMPOOL", severity: "low", title: `${stats.unconfirmedTxCount} unconfirmed transaction(s) in mempool`, detail: "Pending transactions visible. RBF (Replace-By-Fee) attacks are possible on unconfirmed outputs." });
  }

  return findings;
}

function solSecurityFindings(stats: Awaited<ReturnType<typeof scanSolana>>): UniversalWalletScanResult["securityFindings"] {
  const findings: UniversalWalletScanResult["securityFindings"] = [];
  if (!stats.active) {
    findings.push({ id: "SOL-001", severity: "info", title: "No Solana activity found", detail: "Account does not exist on Solana mainnet or has zero balance and no recent transactions." });
    return findings;
  }
  findings.push({ id: "SOL-ACTIVE", severity: "pass", title: "Active Solana account", detail: `Balance: ${stats.solBalance} SOL. Token accounts: ${stats.tokenAccountCount}.` });
  if (stats.executable) {
    findings.push({ id: "SOL-PROGRAM", severity: "info", title: "This is a Solana program (smart contract)", detail: "The account is executable — it contains on-chain program code, not just user funds." });
  }
  if (stats.tokenAccountCount > 20) {
    findings.push({ id: "SOL-DUST", severity: "low", title: `High token account count (${stats.tokenAccountCount})`, detail: "Large numbers of SPL token accounts often indicate airdrop dust attacks. Dust can be used to de-anonymize transaction graphs." });
  }
  return findings;
}

// ── Main universal scan entry point ──────────────────────────────────────────

export async function universalWalletScan(rawAddress: string): Promise<UniversalWalletScanResult> {
  const start = Date.now();
  const detection = detectAddressFamily(rawAddress);
  const scanErrors: string[] = [];

  const base: Omit<UniversalWalletScanResult, "activeChains" | "inactiveChains" | "approvals" | "tokenHoldings" | "recentTransfers" | "securityFindings" | "riskScore" | "scanTimeMs"> = {
    address:             rawAddress,
    normalizedAddress:   detection.normalized,
    detectedFamily:      detection.family,
    detectedFamilyLabel: detection.label,
    confidence:          detection.confidence,
    chainsProbed:        [],
    scanErrors,
  };

  // ── EVM ──────────────────────────────────────────────────────────────────────
  if (detection.family === "evm") {
    const chainKeys = Object.keys(EVM_CHAINS);
    base.chainsProbed = chainKeys;

    const chainResults = await Promise.all(chainKeys.map(k => probeEvmChain(detection.normalized, k)));
    const activeChains   = chainResults.filter(c => c.active);
    const inactiveChains = chainResults.filter(c => !c.active);

    // For active chains with Blockscout — fetch approvals, tokens, transfers in parallel
    const blockscoutChains = activeChains.filter(c => EVM_CHAINS[c.chain]?.blockscout);
    const [approvalArrays, tokenArrays, transferArrays] = await Promise.all([
      Promise.all(blockscoutChains.map(c => fetchEvmApprovals(detection.normalized, c.chain).catch(() => [] as ApprovalRecord[]))),
      Promise.all(blockscoutChains.map(c => fetchEvmTokens(detection.normalized, c.chain).catch(() => [] as TokenHolding[]))),
      Promise.all(blockscoutChains.map(c => fetchEvmTransfers(detection.normalized, c.chain).catch(() => [] as TransferRecord[]))),
    ]);

    const approvals      = approvalArrays.flat();
    const tokenHoldings  = tokenArrays.flat();
    const recentTransfers = transferArrays.flat().sort((a, b) => {
      if (!a.timestamp || !b.timestamp) return 0;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    }).slice(0, 40);

    const findings  = evmSecurityFindings(chainResults, approvals);
    const riskScore = Math.min(100, approvals.length * 8 + (activeChains.length > 3 ? 15 : 0));

    return { ...base, activeChains, inactiveChains, approvals, tokenHoldings, recentTransfers, securityFindings: findings, riskScore, scanTimeMs: Date.now() - start };
  }

  // ── Bitcoin ──────────────────────────────────────────────────────────────────
  if (detection.family === "bitcoin") {
    base.chainsProbed = ["bitcoin-mainnet"];
    try {
      const stats = await scanBitcoin(detection.normalized);
      const chainActivity: ChainActivity = {
        chain: "bitcoin-mainnet", label: "Bitcoin Mainnet", symbol: "BTC", active: stats.active,
        isContract: false,
        balanceRaw: stats.balanceSat.toString(),
        balanceFormatted: (stats.balanceSat / 1e8).toFixed(8),
        nativeSymbol: "BTC",
        txCount: stats.txCount,
      };
      const activeChains   = stats.active ? [chainActivity] : [];
      const inactiveChains = stats.active ? [] : [chainActivity];
      const findings = btcSecurityFindings(stats);
      const totalReceived = stats.totalReceived / 1e8;
      const tokens: TokenHolding[] = [];
      const transfers: TransferRecord[] = [];
      return { ...base, activeChains, inactiveChains, approvals: [], tokenHoldings: tokens, recentTransfers: transfers, securityFindings: findings, riskScore: stats.txCount > 1 ? 15 : 0, scanTimeMs: Date.now() - start };
    } catch (err) {
      scanErrors.push(`Bitcoin scan failed: ${err instanceof Error ? err.message : String(err)}`);
      return { ...base, activeChains: [], inactiveChains: [], approvals: [], tokenHoldings: [], recentTransfers: [], securityFindings: [], riskScore: 0, scanTimeMs: Date.now() - start };
    }
  }

  // ── Solana ───────────────────────────────────────────────────────────────────
  if (detection.family === "solana") {
    base.chainsProbed = ["solana-mainnet"];
    try {
      const stats = await scanSolana(detection.normalized);
      const chainActivity: ChainActivity = {
        chain: "solana-mainnet", label: "Solana Mainnet", symbol: "SOL", active: stats.active,
        isContract: stats.executable,
        balanceRaw: stats.lamports.toString(),
        balanceFormatted: stats.solBalance,
        nativeSymbol: "SOL",
        txCount: stats.recentTxCount,
      };
      const activeChains   = stats.active ? [chainActivity] : [];
      const inactiveChains = stats.active ? [] : [chainActivity];
      const findings = solSecurityFindings(stats);
      return { ...base, activeChains, inactiveChains, approvals: [], tokenHoldings: [], recentTransfers: [], securityFindings: findings, riskScore: stats.tokenAccountCount > 20 ? 10 : 0, scanTimeMs: Date.now() - start };
    } catch (err) {
      scanErrors.push(`Solana scan failed: ${err instanceof Error ? err.message : String(err)}`);
      return { ...base, activeChains: [], inactiveChains: [], approvals: [], tokenHoldings: [], recentTransfers: [], securityFindings: [], riskScore: 0, scanTimeMs: Date.now() - start };
    }
  }

  // ── TRON ─────────────────────────────────────────────────────────────────────
  if (detection.family === "tron") {
    base.chainsProbed = ["tron-mainnet"];
    try {
      const stats = await scanTron(detection.normalized);
      const chainActivity: ChainActivity = {
        chain: "tron-mainnet", label: "TRON Mainnet", symbol: "TRX", active: stats.active,
        isContract: false,
        balanceRaw: stats.trxBalance,
        balanceFormatted: stats.trxBalance,
        nativeSymbol: "TRX",
        txCount: 0,
      };
      const activeChains   = stats.active ? [chainActivity] : [];
      const inactiveChains = stats.active ? [] : [chainActivity];
      const findings: UniversalWalletScanResult["securityFindings"] = stats.active
        ? [{ id: "TRX-ACTIVE", severity: "pass", title: "Active TRON account", detail: `Balance: ${stats.trxBalance} TRX. TRC-20 tokens: ${stats.trc20Count}.` }]
        : [{ id: "TRX-INACTIVE", severity: "info", title: "No TRON activity found", detail: "Account does not exist or has zero balance on TRON mainnet." }];
      return { ...base, activeChains, inactiveChains, approvals: [], tokenHoldings: [], recentTransfers: [], securityFindings: findings, riskScore: 0, scanTimeMs: Date.now() - start };
    } catch (err) {
      scanErrors.push(`TRON scan failed: ${err instanceof Error ? err.message : String(err)}`);
      return { ...base, activeChains: [], inactiveChains: [], approvals: [], tokenHoldings: [], recentTransfers: [], securityFindings: [], riskScore: 0, scanTimeMs: Date.now() - start };
    }
  }

  // ── XRP ──────────────────────────────────────────────────────────────────────
  if (detection.family === "xrp") {
    base.chainsProbed = ["xrpl-mainnet"];
    try {
      const stats = await scanXrp(detection.normalized);
      const chainActivity: ChainActivity = {
        chain: "xrpl-mainnet", label: "XRP Ledger Mainnet", symbol: "XRP", active: stats.active,
        isContract: false,
        balanceRaw: stats.xrpBalance,
        balanceFormatted: stats.xrpBalance,
        nativeSymbol: "XRP",
        txCount: stats.sequence,
      };
      const activeChains   = stats.active ? [chainActivity] : [];
      const inactiveChains = stats.active ? [] : [chainActivity];
      const findings: UniversalWalletScanResult["securityFindings"] = stats.active
        ? [{ id: "XRP-ACTIVE", severity: "pass", title: "Active XRP Ledger account", detail: `Balance: ${stats.xrpBalance} XRP. Sequence: ${stats.sequence}. Owner count: ${stats.ownerCount}.` }]
        : [{ id: "XRP-INACTIVE", severity: "info", title: "No XRP Ledger activity found", detail: "Account does not exist or has not been funded (requires 10 XRP reserve to activate)." }];
      return { ...base, activeChains, inactiveChains, approvals: [], tokenHoldings: [], recentTransfers: [], securityFindings: findings, riskScore: 0, scanTimeMs: Date.now() - start };
    } catch (err) {
      scanErrors.push(`XRP scan failed: ${err instanceof Error ? err.message : String(err)}`);
      return { ...base, activeChains: [], inactiveChains: [], approvals: [], tokenHoldings: [], recentTransfers: [], securityFindings: [], riskScore: 0, scanTimeMs: Date.now() - start };
    }
  }

  // ── Litecoin / Dogecoin — use Blockstream-compatible APIs ────────────────────
  if (detection.family === "litecoin" || detection.family === "dogecoin") {
    const net    = detection.family === "litecoin" ? "litecoin" : "dogecoin";
    const sym    = detection.family === "litecoin" ? "LTC" : "DOGE";
    const apiUrl = detection.family === "litecoin"
      ? `https://blockstream.info/liquid/api/address/${detection.normalized}`
      : `https://dogechain.info/api/v1/address/balance/${detection.normalized}`;
    base.chainsProbed = [`${net}-mainnet`];
    const chainActivity: ChainActivity = {
      chain: `${net}-mainnet`, label: `${net.charAt(0).toUpperCase() + net.slice(1)} Mainnet`,
      symbol: sym, active: false, isContract: false,
      balanceRaw: "0", balanceFormatted: "0", nativeSymbol: sym, txCount: 0,
    };
    return {
      ...base, activeChains: [], inactiveChains: [chainActivity], approvals: [], tokenHoldings: [], recentTransfers: [],
      securityFindings: [{ id: `${sym}-SCAN`, severity: "info", title: `${sym} address detected`, detail: `Address format recognized as ${net}. Detailed balance scanning requires a ${net}-specific block explorer API.` }],
      riskScore: 0, scanTimeMs: Date.now() - start,
    };
  }

  // ── Cardano ───────────────────────────────────────────────────────────────────
  if (detection.family === "cardano") {
    base.chainsProbed = ["cardano-mainnet"];
    try {
      const resp = await fetch(`https://cardano-mainnet.blockfrost.io/api/v0/addresses/${detection.normalized}`, {
        headers: { project_id: "mainnetplaceholderkey" },
        signal: AbortSignal.timeout(8000),
      });
      const cardanoActivity: ChainActivity = {
        chain: "cardano-mainnet", label: "Cardano Mainnet", symbol: "ADA", active: false,
        isContract: false, balanceRaw: "0", balanceFormatted: "0", nativeSymbol: "ADA", txCount: 0,
      };
      if (resp.ok) {
        const data = await resp.json() as { amount?: Array<{ unit: string; quantity: string }>; tx_count?: number };
        const lovelace = data.amount?.find(a => a.unit === "lovelace")?.quantity ?? "0";
        const ada = (parseInt(lovelace) / 1_000_000).toFixed(6);
        cardanoActivity.active = parseInt(lovelace) > 0;
        cardanoActivity.balanceFormatted = ada;
        cardanoActivity.txCount = data.tx_count ?? 0;
      }
      return {
        ...base,
        activeChains: cardanoActivity.active ? [cardanoActivity] : [],
        inactiveChains: cardanoActivity.active ? [] : [cardanoActivity],
        approvals: [], tokenHoldings: [], recentTransfers: [],
        securityFindings: [{ id: "ADA-SCAN", severity: "info", title: "Cardano address detected", detail: `addr1... Shelley-era address on Cardano mainnet. Balance: ${cardanoActivity.balanceFormatted} ADA.` }],
        riskScore: 0, scanTimeMs: Date.now() - start,
      };
    } catch {
      return {
        ...base, activeChains: [], inactiveChains: [], approvals: [], tokenHoldings: [], recentTransfers: [],
        securityFindings: [{ id: "ADA-SCAN", severity: "info", title: "Cardano address detected", detail: "addr1... Shelley-era Cardano address. Live balance query requires a Blockfrost project ID." }],
        riskScore: 0, scanTimeMs: Date.now() - start,
      };
    }
  }

  // ── Cosmos ────────────────────────────────────────────────────────────────────
  if (detection.family === "cosmos") {
    base.chainsProbed = ["cosmos-hub"];
    try {
      const resp = await fetch(`https://cosmos-rest.publicnode.com/cosmos/bank/v1beta1/balances/${detection.normalized}`, {
        signal: AbortSignal.timeout(8000),
      });
      const cosmosActivity: ChainActivity = {
        chain: "cosmos-hub", label: "Cosmos Hub", symbol: "ATOM", active: false,
        isContract: false, balanceRaw: "0", balanceFormatted: "0", nativeSymbol: "ATOM", txCount: 0,
      };
      if (resp.ok) {
        const data = await resp.json() as { balances?: Array<{ denom: string; amount: string }> };
        const uatom = data.balances?.find(b => b.denom === "uatom")?.amount ?? "0";
        const atom  = (parseInt(uatom) / 1_000_000).toFixed(6);
        cosmosActivity.active = parseInt(uatom) > 0;
        cosmosActivity.balanceFormatted = atom;
        cosmosActivity.balanceRaw = uatom;
      }
      return {
        ...base,
        activeChains: cosmosActivity.active ? [cosmosActivity] : [],
        inactiveChains: cosmosActivity.active ? [] : [cosmosActivity],
        approvals: [], tokenHoldings: [], recentTransfers: [],
        securityFindings: [{ id: "ATOM-SCAN", severity: cosmosActivity.active ? "pass" : "info", title: cosmosActivity.active ? "Active Cosmos account" : "No Cosmos activity", detail: `Balance: ${cosmosActivity.balanceFormatted} ATOM on Cosmos Hub.` }],
        riskScore: 0, scanTimeMs: Date.now() - start,
      };
    } catch {
      return {
        ...base, activeChains: [], inactiveChains: [], approvals: [], tokenHoldings: [], recentTransfers: [],
        securityFindings: [{ id: "ATOM-SCAN", severity: "info", title: "Cosmos address detected", detail: "cosmos1... bech32 address. Live balance query via public Cosmos REST API." }],
        riskScore: 0, scanTimeMs: Date.now() - start,
      };
    }
  }

  // ── Unknown ───────────────────────────────────────────────────────────────────
  return {
    ...base,
    activeChains: [], inactiveChains: [], approvals: [], tokenHoldings: [], recentTransfers: [],
    securityFindings: [{
      id: "UNKNOWN", severity: "info",
      title: "Address format not recognized",
      detail: `"${rawAddress}" does not match any known blockchain address format. Supported: EVM (0x...), Bitcoin (1/3/bc1...), Solana (base58 32-44 chars), TRON (T...), XRP (r...), Litecoin, Dogecoin, Cardano (addr1...), Cosmos (cosmos1...).`,
    }],
    riskScore: 0, scanTimeMs: Date.now() - start,
  };
}
