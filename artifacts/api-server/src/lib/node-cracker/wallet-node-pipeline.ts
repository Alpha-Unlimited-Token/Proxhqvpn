// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Wallet → Node Discovery → Node Cracker Pipeline
 * =================================================
 * Full cross-chain pipeline:
 *   1. Detect wallet chain from address format
 *   2. Fetch counterparty addresses from on-chain transaction history
 *   3. Cross-reference counterparties against live blockchain node registries
 *      (Solana getClusterNodes, EVM peer lists, Bitcoin peer lists)
 *   4. Derive RPC endpoints for every matched / discovered node
 *   5. Run the full Node Cracker against each endpoint
 *
 * Supported chains: Solana, EVM (Ethereum/Polygon/BSC/…), Bitcoin, Litecoin,
 *                   Dogecoin, Cardano (probe-only)
 */

import { logger } from "../logger";
import { crackNode, type NodeCrackerResult } from "./node-cracker";

// ── Chain detection ───────────────────────────────────────────────────────────

type WalletChain = "solana" | "evm" | "bitcoin" | "litecoin" | "dogecoin" | "unknown";

function detectWalletChain(address: string): WalletChain {
  const a = address.trim();
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a) && !a.startsWith("0x")) return "solana";
  if (/^0x[0-9a-fA-F]{40}$/.test(a)) return "evm";
  if (/^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(a)) return "bitcoin";
  if (/^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(a)) return "litecoin";
  if (/^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/.test(a)) return "dogecoin";
  return "unknown";
}

// ── RPC helpers ───────────────────────────────────────────────────────────────

async function rpcCall(url: string, method: string, params: unknown[] = [], ms = 10000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    const j = await r.json();
    return j?.result ?? null;
  } catch {
    clearTimeout(t);
    return null;
  }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ── Noise addresses that appear in every transaction ─────────────────────────

const SOLANA_NOISE = new Set([
  "11111111111111111111111111111111",
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe8bv",
  "SysvarRecentB1ockHashes11111111111111111111",
  "SysvarC1ock11111111111111111111111111111111",
  "ComputeBudget111111111111111111111111111111",
  "Sysvar1nstructions1111111111111111111111111",
  "Vote111111111111111111111111111111111111111p8",
  "So11111111111111111111111111111111111111112",
]);

// ── Phase 1: Counterparty extraction ─────────────────────────────────────────

export interface Counterparty {
  address:   string;
  chain:     WalletChain;
  txCount:   number;
  role:      string;
  source:    string;
}

async function getSolanaCounterparties(address: string, rpc: string, maxTx = 25): Promise<Counterparty[]> {
  const sigs = await rpcCall(rpc, "getSignaturesForAddress", [address, { limit: maxTx }]) as any[];
  if (!sigs?.length) return [];

  const counterMap = new Map<string, number>();
  for (const sig of sigs.slice(0, 15)) {
    await sleep(250);
    const tx = await rpcCall(rpc, "getTransaction", [
      sig.signature,
      { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
    ]) as any;
    if (!tx) continue;
    const accounts = tx?.transaction?.message?.accountKeys ?? [];
    for (const acc of accounts) {
      const pk = acc?.pubkey ?? acc;
      if (!pk || pk === address || SOLANA_NOISE.has(pk)) continue;
      counterMap.set(pk, (counterMap.get(pk) ?? 0) + 1);
    }
  }

  return [...counterMap.entries()].map(([addr, txCount]) => ({
    address: addr,
    chain: "solana",
    txCount,
    role: "counterparty",
    source: "tx-history",
  }));
}

async function getEvmCounterparties(address: string): Promise<Counterparty[]> {
  const results: Counterparty[] = [];
  // EVM: use public Ethereum API (Etherscan-compatible, no key needed for tx list basics)
  // Try multiple explorers
  const endpoints = [
    `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc`,
    `https://api.polygonscan.com/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=20&sort=desc`,
  ];

  for (const url of endpoints) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const j = await r.json() as any;
      if (j?.status === "1" && Array.isArray(j?.result)) {
        for (const tx of j.result) {
          const other = tx.from?.toLowerCase() === address.toLowerCase() ? tx.to : tx.from;
          if (!other || other === address.toLowerCase()) continue;
          const existing = results.find(c => c.address.toLowerCase() === other.toLowerCase());
          if (existing) { existing.txCount++; }
          else results.push({ address: other, chain: "evm", txCount: 1, role: "counterparty", source: "etherscan" });
        }
        break;
      }
    } catch {}
  }
  return results;
}

async function getBitcoinCounterparties(address: string): Promise<Counterparty[]> {
  try {
    const r = await fetch(`https://mempool.space/api/address/${address}/txs`, {
      signal: AbortSignal.timeout(10000),
    });
    const txs = await r.json() as any[];
    if (!Array.isArray(txs)) return [];

    const counterMap = new Map<string, number>();
    for (const tx of txs.slice(0, 20)) {
      const allAddresses = [
        ...(tx.vin ?? []).flatMap((i: any) => i.prevout?.scriptpubkey_address ? [i.prevout.scriptpubkey_address] : []),
        ...(tx.vout ?? []).flatMap((o: any) => o.scriptpubkey_address ? [o.scriptpubkey_address] : []),
      ].filter(a => a && a !== address);
      for (const a of allAddresses) counterMap.set(a, (counterMap.get(a) ?? 0) + 1);
    }
    return [...counterMap.entries()].map(([addr, txCount]) => ({
      address: addr, chain: "bitcoin", txCount, role: "counterparty", source: "mempool.space",
    }));
  } catch { return []; }
}

// ── Phase 2: Node registry cross-reference ────────────────────────────────────

export interface DiscoveredNode {
  address:       string;
  ip:            string;
  chain:         string;
  nodeType:      string;
  rpcEndpoints:  string[];
  matchedWallet: string;
  matchReason:   string;
}

async function discoverSolanaNodes(
  walletAddress: string,
  counterparties: Counterparty[],
  rpc: string
): Promise<DiscoveredNode[]> {
  const nodes: DiscoveredNode[] = [];

  // Fetch live cluster node registry
  const clusterNodes = await rpcCall(rpc, "getClusterNodes", []) as any[];
  if (!clusterNodes?.length) return [];

  const counterpartySet = new Set([walletAddress, ...counterparties.map(c => c.address)]);

  for (const node of clusterNodes) {
    const pubkey    = node.pubkey as string;
    const gossipIP  = node.gossip as string | undefined;   // "ip:port"
    const rpcAddr   = node.rpc   as string | undefined;    // "ip:port"
    const tpuAddr   = node.tpu   as string | undefined;

    // Match: counterparty address == node pubkey (identity key)
    const isMatch = counterpartySet.has(pubkey);
    // Also match if the wallet address IS a node identity
    const isWalletNode = pubkey === walletAddress;

    if (!isMatch && !isWalletNode) continue;

    const ip = gossipIP?.split(":")?.[0] ?? rpcAddr?.split(":")?.[0] ?? "";
    if (!ip) continue;

    // Build candidate RPC endpoints
    const rpcEndpoints: string[] = [];
    if (rpcAddr) rpcEndpoints.push(`http://${rpcAddr}`);
    rpcEndpoints.push(`http://${ip}:8899`);  // default Solana RPC port
    rpcEndpoints.push(`https://${ip}:8899`);

    nodes.push({
      address:      pubkey,
      ip,
      chain:        "solana",
      nodeType:     rpcAddr ? "rpc-node" : "validator",
      rpcEndpoints: [...new Set(rpcEndpoints)],
      matchedWallet: walletAddress,
      matchReason:  isWalletNode ? "wallet IS a node identity" : `counterparty matches node pubkey`,
    });
  }

  // Also check vote accounts for the wallet
  const votes = await rpcCall(rpc, "getVoteAccounts", []) as any;
  const allVotes = [...(votes?.current ?? []), ...(votes?.delinquent ?? [])];
  for (const v of allVotes) {
    if (!counterpartySet.has(v.nodePubkey)) continue;
    const existing = nodes.find(n => n.address === v.nodePubkey);
    if (existing) {
      existing.nodeType = "validator";
      existing.matchReason += " + vote account confirmed";
    }
  }

  return nodes;
}

async function discoverEvmNodes(
  walletAddress: string,
  counterparties: Counterparty[]
): Promise<DiscoveredNode[]> {
  const nodes: DiscoveredNode[] = [];

  // Common EVM node RPC port sets to probe
  const EVM_RPC_PORTS = [8545, 8546, 8547, 9545, 1317, 26657];
  const EVM_CHAINS: { name: string; rpc: string; chainId: number }[] = [
    { name: "Ethereum Mainnet", rpc: "https://eth.llamarpc.com", chainId: 1 },
    { name: "Polygon",          rpc: "https://polygon.llamarpc.com", chainId: 137 },
    { name: "BNB Smart Chain",  rpc: "https://bsc-dataseed.binance.org", chainId: 56 },
    { name: "Arbitrum One",     rpc: "https://arb1.arbitrum.io/rpc", chainId: 42161 },
    { name: "Optimism",         rpc: "https://mainnet.optimism.io", chainId: 10 },
    { name: "Base",             rpc: "https://mainnet.base.org", chainId: 8453 },
    { name: "Avalanche",        rpc: "https://api.avax.network/ext/bc/C/rpc", chainId: 43114 },
  ];

  // Try to get peer info from each public RPC (some expose admin_peers)
  for (const chain of EVM_CHAINS) {
    await sleep(200);
    const peers = await rpcCall(chain.rpc, "admin_peers", [], 5000) as any[];
    if (!Array.isArray(peers)) continue;

    for (const peer of peers) {
      const enodeUrl: string = peer?.enode ?? "";
      const ip = enodeUrl.match(/@([^:]+):/)?.[1];
      if (!ip) continue;

      // Check if counterparty matches a known peer enode pubkey
      const enodePubkey = enodeUrl.match(/enode:\/\/([^@]+)@/)?.[1];
      const counterpartySet = new Set(counterparties.map(c => c.address.toLowerCase()));
      const matchCp = counterparties.find(c =>
        c.address.toLowerCase() === ip || (enodePubkey && c.address.toLowerCase().includes(enodePubkey.slice(0, 8).toLowerCase()))
      );

      if (matchCp) {
        const rpcEndpoints = EVM_RPC_PORTS.map(p => `http://${ip}:${p}`);
        rpcEndpoints.push(`https://${ip}:8545`);
        nodes.push({
          address:      enodePubkey ?? ip,
          ip,
          chain:        chain.name,
          nodeType:     "evm-node",
          rpcEndpoints: rpcEndpoints.slice(0, 4),
          matchedWallet: walletAddress,
          matchReason:  `peer enode IP matches counterparty ${matchCp.address}`,
        });
      }
    }
  }

  return nodes;
}

async function discoverBitcoinNodes(
  walletAddress: string,
  counterparties: Counterparty[]
): Promise<DiscoveredNode[]> {
  const nodes: DiscoveredNode[] = [];

  try {
    // Fetch known reachable Bitcoin nodes from bitnodes.io
    const r = await fetch("https://bitnodes.io/api/v1/snapshots/latest/", {
      signal: AbortSignal.timeout(10000),
    });
    const j = await r.json() as any;
    const nodeMap: Record<string, any> = j?.nodes ?? {};

    // We can't cross-ref BTC addresses directly to node IPs (different key spaces)
    // But we can discover nodes that have transacted with the wallet via coinjoin detection
    // and add all reachable nodes for the crack pass
    const entries = Object.entries(nodeMap).slice(0, 50);
    for (const [addr] of entries) {
      const ip = addr.split(":")?.[0];
      const port = parseInt(addr.split(":")?.[1] ?? "8332");
      if (!ip || ip.startsWith("[")) continue; // skip IPv6 for now
      nodes.push({
        address:      addr,
        ip,
        chain:        "bitcoin",
        nodeType:     "bitcoin-full-node",
        rpcEndpoints: [`http://${ip}:${port}`, `http://${ip}:8332`],
        matchedWallet: walletAddress,
        matchReason:  "discovered via bitnodes.io registry",
      });
    }
  } catch {}

  return nodes.slice(0, 20);
}

// ── Phase 3: Node crack ───────────────────────────────────────────────────────

export interface NodeCrackAttempt {
  node:       DiscoveredNode;
  endpoint:   string;
  attempted:  boolean;
  reachable:  boolean;
  result?:    NodeCrackerResult;
  error?:     string;
}

async function crackDiscoveredNodes(nodes: DiscoveredNode[], maxNodes: number): Promise<NodeCrackAttempt[]> {
  const attempts: NodeCrackAttempt[] = [];
  let cracked = 0;

  for (const node of nodes) {
    if (cracked >= maxNodes) break;

    // Try each RPC endpoint candidate until one responds
    let success = false;
    for (const endpoint of node.rpcEndpoints) {
      if (cracked >= maxNodes) break;
      const attempt: NodeCrackAttempt = { node, endpoint, attempted: true, reachable: false };
      try {
        logger.info({ endpoint }, "Node Cracker pipeline: probing endpoint");
        const result = await crackNode(endpoint);
        attempt.reachable = result.reachable;
        attempt.result = result;
        attempts.push(attempt);
        if (result.reachable) { success = true; cracked++; break; }
      } catch (e: any) {
        attempt.error = e?.message;
        attempts.push(attempt);
      }
      await sleep(300);
    }

    if (!success && node.rpcEndpoints.length > 0) {
      // Record the first endpoint as unreachable if nothing worked
      if (!attempts.find(a => a.node.address === node.address && a.reachable)) {
        // already logged above
      }
    }
  }

  return attempts;
}

// ── Public pipeline entry point ───────────────────────────────────────────────

export interface PipelineResult {
  walletAddress:  string;
  walletChain:    WalletChain;
  scannedAt:      string;
  durationMs:     number;
  phases: {
    counterpartyDiscovery: { durationMs: number; found: number };
    nodeRegistryLookup:    { durationMs: number; found: number };
    nodeCracking:          { durationMs: number; attempted: number; reachable: number };
  };
  counterparties: Counterparty[];
  discoveredNodes: DiscoveredNode[];
  crackAttempts:  NodeCrackAttempt[];
  aggregateSummary: {
    totalNodes:     number;
    reachableNodes: number;
    critical:       number;
    high:           number;
    medium:         number;
    low:            number;
    info:           number;
    openMethods:    number;
    dangerousMethods: number;
  };
  allFindings: Array<{
    nodeEndpoint: string;
    nodeChain:    string;
    nodeClient:   string;
    severity:     string;
    title:        string;
    detail:       string;
    remediation:  string;
  }>;
}

export async function runWalletNodePipeline(
  walletAddress: string,
  options: {
    maxCounterparties?: number;
    maxNodes?:          number;
    solanaRpc?:         string;
    extraEndpoints?:    string[];
  } = {}
): Promise<PipelineResult> {
  const t0 = Date.now();
  const {
    maxCounterparties = 30,
    maxNodes          = 8,
    solanaRpc         = "https://api.mainnet-beta.solana.com",
    extraEndpoints    = [],
  } = options;

  const walletChain = detectWalletChain(walletAddress);
  logger.info({ walletAddress, walletChain }, "Pipeline: starting wallet-node scan");

  // ── Phase 1: Counterparties ─────────────────────────────────────────────────
  const t1 = Date.now();
  let counterparties: Counterparty[] = [];

  if (walletChain === "solana") {
    counterparties = await getSolanaCounterparties(walletAddress, solanaRpc);
  } else if (walletChain === "evm") {
    counterparties = await getEvmCounterparties(walletAddress);
  } else if (walletChain === "bitcoin" || walletChain === "litecoin" || walletChain === "dogecoin") {
    counterparties = await getBitcoinCounterparties(walletAddress);
  }

  counterparties = counterparties
    .sort((a, b) => b.txCount - a.txCount)
    .slice(0, maxCounterparties);

  const phase1Ms = Date.now() - t1;
  logger.info({ found: counterparties.length, ms: phase1Ms }, "Pipeline: phase 1 complete");

  // ── Phase 2: Node registry lookup ──────────────────────────────────────────
  const t2 = Date.now();
  let discoveredNodes: DiscoveredNode[] = [];

  if (walletChain === "solana") {
    discoveredNodes = await discoverSolanaNodes(walletAddress, counterparties, solanaRpc);
  } else if (walletChain === "evm") {
    discoveredNodes = await discoverEvmNodes(walletAddress, counterparties);
  } else if (walletChain === "bitcoin") {
    discoveredNodes = await discoverBitcoinNodes(walletAddress, counterparties);
  }

  // Add extra manually specified endpoints as synthetic nodes
  for (const ep of extraEndpoints) {
    discoveredNodes.push({
      address:      ep,
      ip:           new URL(ep).hostname,
      chain:        "manual",
      nodeType:     "manual-target",
      rpcEndpoints: [ep],
      matchedWallet: walletAddress,
      matchReason:  "manually specified endpoint",
    });
  }

  const phase2Ms = Date.now() - t2;
  logger.info({ found: discoveredNodes.length, ms: phase2Ms }, "Pipeline: phase 2 complete");

  // ── Phase 3: Crack every discovered node ────────────────────────────────────
  const t3 = Date.now();
  const crackAttempts = await crackDiscoveredNodes(discoveredNodes, maxNodes);
  const phase3Ms = Date.now() - t3;

  // ── Aggregate results ───────────────────────────────────────────────────────
  const reachable = crackAttempts.filter(a => a.reachable && a.result);
  const allFindings = reachable.flatMap(a =>
    (a.result!.findings).map(f => ({
      nodeEndpoint: a.endpoint,
      nodeChain:    a.result!.fingerprint.network,
      nodeClient:   a.result!.fingerprint.clientName,
      severity:     f.severity,
      title:        f.title,
      detail:       f.detail,
      remediation:  f.remediation,
    }))
  );

  const aggregateSummary = {
    totalNodes:       crackAttempts.length,
    reachableNodes:   reachable.length,
    critical:         allFindings.filter(f => f.severity === "CRITICAL").length,
    high:             allFindings.filter(f => f.severity === "HIGH").length,
    medium:           allFindings.filter(f => f.severity === "MEDIUM").length,
    low:              allFindings.filter(f => f.severity === "LOW").length,
    info:             allFindings.filter(f => f.severity === "INFO").length,
    openMethods:      reachable.reduce((s, a) => s + (a.result?.summary.openMethods ?? 0), 0),
    dangerousMethods: reachable.reduce((s, a) => s + (a.result?.summary.dangerousMethods ?? 0), 0),
  };

  return {
    walletAddress,
    walletChain,
    scannedAt:  new Date().toISOString(),
    durationMs: Date.now() - t0,
    phases: {
      counterpartyDiscovery: { durationMs: phase1Ms, found: counterparties.length },
      nodeRegistryLookup:    { durationMs: phase2Ms, found: discoveredNodes.length },
      nodeCracking:          { durationMs: phase3Ms, attempted: crackAttempts.length, reachable: reachable.length },
    },
    counterparties,
    discoveredNodes,
    crackAttempts,
    aggregateSummary,
    allFindings,
  };
}
