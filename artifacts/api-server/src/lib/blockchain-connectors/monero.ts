// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Monero (XMR) Blockchain Connector
// Connects to user's own monerod daemon via JSON-RPC
// Default: localhost:18081 (mainnet) — configure via MONERO_RPC_URL env var
// Also supports public stagenet/testnet nodes for testing

const MONERO_RPC_URL = process.env.MONERO_RPC_URL ?? "http://127.0.0.1:18081";
const MONERO_RPC_USER = process.env.MONERO_RPC_USER ?? "";
const MONERO_RPC_PASS = process.env.MONERO_RPC_PASS ?? "";

// Public community nodes as fallback (no guarantee of availability)
const PUBLIC_NODES = [
  "http://node.moneroworld.com:18089",
  "http://nodes.hashvault.pro:18081",
  "http://p2pmd.xmrvsbeast.com:18081",
];

async function rpcCall(method: string, params: Record<string, unknown> = {}, nodeUrl?: string): Promise<unknown> {
  const url = nodeUrl ?? MONERO_RPC_URL;
  const body = JSON.stringify({ jsonrpc: "2.0", id: "0", method, params });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "QuantumAudit/1.0",
  };
  if (MONERO_RPC_USER && MONERO_RPC_PASS) {
    headers["Authorization"] = "Basic " + Buffer.from(`${MONERO_RPC_USER}:${MONERO_RPC_PASS}`).toString("base64");
  }

  const r = await fetch(`${url}/json_rpc`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(10000),
  });

  if (!r.ok) throw new Error(`Monero RPC HTTP ${r.status}`);
  const json = await r.json() as Record<string, unknown>;
  if (json.error) throw new Error(`Monero RPC error: ${JSON.stringify(json.error)}`);
  return json.result;
}

async function rpcCallFallback(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  // Try user's node first, then fall back to public nodes
  const nodes = [MONERO_RPC_URL, ...PUBLIC_NODES];
  let lastErr: Error | null = null;
  for (const node of nodes) {
    try {
      return await rpcCall(method, params, node);
    } catch (e) {
      lastErr = e as Error;
    }
  }
  throw lastErr ?? new Error("All Monero nodes unreachable");
}

export interface MoneroNetworkReport {
  chain: "monero";
  nodeUrl: string;
  nodeReachable: boolean;
  daemonVersion: string | null;
  networkType: string | null;
  height: number | null;
  topBlockHash: string | null;
  difficulty: number | null;
  hashrate: string | null;
  txPoolSize: number | null;
  txPoolBytes: number | null;
  connections: number | null;
  syncedBlocks: number | null;
  ringctEnabled: boolean;
  currentRingSize: number;
  bulletproofsEnabled: boolean;
  bulletpoolsPlus: boolean;
  clsagEnabled: boolean;
  quantumFindings: MoneroQuantumFinding[];
  recentTransactions: MoneroTxSummary[];
  networkSecurity: NetworkSecurityAssessment;
}

export interface MoneroQuantumFinding {
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  description: string;
  affectedAddresses: string;
  recommendation: string;
  estimatedBreakYear: string;
  algorithm: "shors" | "grovers";
}

export interface MoneroTxSummary {
  txid: string;
  blockHeight: number;
  fee: string;
  ringSize: number;
  rctType: string;
  hasViewTag: boolean;
  inputCount: number;
  outputCount: number;
  quantumRiskNote: string;
}

export interface NetworkSecurityAssessment {
  overallRisk: "critical" | "high" | "medium" | "low";
  cryptoPrimitives: CryptoPrimitive[];
  quantumTimeline: string;
  mitigationStatus: string;
}

export interface CryptoPrimitive {
  name: string;
  purpose: string;
  quantumVulnerable: boolean;
  breakAlgorithm: string;
  estimatedBreakYear: string;
  replacement: string;
}

export async function scanMoneroNetwork(): Promise<MoneroNetworkReport> {
  let nodeReachable = false;
  let daemonInfo: Record<string, unknown> | null = null;
  let nodeUrl = MONERO_RPC_URL;

  // Try to connect
  try {
    daemonInfo = await rpcCallFallback("get_info") as Record<string, unknown>;
    nodeReachable = true;
    // Determine which node we connected to
    const nodes = [MONERO_RPC_URL, ...PUBLIC_NODES];
    for (const node of nodes) {
      try {
        await rpcCall("get_info", {}, node);
        nodeUrl = node;
        break;
      } catch {}
    }
  } catch {
    nodeReachable = false;
  }

  // Fetch recent transactions from mempool if node is reachable
  const recentTxs: MoneroTxSummary[] = [];

  if (nodeReachable && daemonInfo) {
    try {
      const poolResult = await rpcCallFallback("get_transaction_pool") as Record<string, unknown>;
      const txs = (poolResult.transactions as Record<string, unknown>[]) ?? [];
      for (const tx of txs.slice(0, 5)) {
        const txInfo = tx.tx_json ? JSON.parse(tx.tx_json as string) as Record<string, unknown> : tx;
        const rctSig = txInfo.rct_signatures as Record<string, unknown> ?? {};
        const rctType = Number(rctSig.type ?? 0);
        const ringSize = ((txInfo.vin as unknown[]) ?? []).length > 0
          ? Number((((txInfo.vin as Record<string, unknown>[])[0]?.key as Record<string, unknown>)?.key_offsets as unknown[] ?? []).length)
          : 16;

        const rctTypeName: Record<number, string> = {
          0: "Null (pre-RingCT — INSECURE)",
          1: "Full (legacy)", 2: "Simple (legacy)",
          3: "Bulletproof", 4: "Bulletproof (compact)",
          5: "CLSAG + Bulletproof+", 6: "CLSAG + Bulletproof+ (v2)",
        };

        recentTxs.push({
          txid: String(tx.id_hash ?? tx.txid ?? "unknown"),
          blockHeight: Number(tx.block_height ?? 0),
          fee: String(tx.fee ?? "0"),
          ringSize: ringSize || 16,
          rctType: rctTypeName[rctType] ?? `Type ${rctType}`,
          hasViewTag: Boolean(txInfo.extra && String(txInfo.extra).includes("02")),
          inputCount: (txInfo.vin as unknown[] ?? []).length,
          outputCount: (txInfo.vout as unknown[] ?? []).length,
          quantumRiskNote: rctType === 0
            ? "CRITICAL: Pre-RingCT transaction — amounts fully visible on-chain"
            : "HIGH: CLSAG ring signature and Pedersen commitments are ECDLP-based — quantum-vulnerable (Shor's Algorithm, 2030–2035)",
        });
      }
    } catch {}
  }

  // Monero quantum findings — comprehensive regardless of node connectivity
  const quantumFindings: MoneroQuantumFinding[] = [
    {
      type: "ed25519_key_recovery",
      severity: "critical",
      title: "Ed25519 / Curve25519 Private Key Recovery (Shor's Algorithm)",
      description: "All Monero wallet keys (spend key, view key, one-time output keys) are Ed25519 keypairs on Curve25519. Shor's Algorithm running on a fault-tolerant quantum computer can solve the Elliptic Curve Discrete Logarithm Problem (ECDLP) for Curve25519 in polynomial time, recovering any private key from its public key. This breaks wallet ownership for every address on the network.",
      affectedAddresses: "ALL Monero addresses (100% of XMR supply)",
      recommendation: "Monero Research Lab must implement post-quantum signature migration: CRYSTALS-Dilithium (FIPS 204) for spend keys, ML-KEM (FIPS 203) for stealth address key exchange. Hard fork required.",
      estimatedBreakYear: "2030–2035",
      algorithm: "shors",
    },
    {
      type: "clsag_deanonymization",
      severity: "critical",
      title: "CLSAG Ring Signature Deanonymization — Full Transaction Graph Exposure",
      description: "Monero's CLSAG (Compact Linkable Spontaneous Anonymous Group) ring signatures hide the true signer among a ring of 16 decoys. CLSAG's security reduces to the ECDLP on Curve25519. A quantum adversary solving ECDLP for all public keys in every ring can identify the true signer in every transaction — retroactively, from the genesis block (April 2014) to present. This is a permanent, irreversible privacy collapse for all historical Monero transactions.",
      affectedAddresses: "All transactions from block 0 to present — complete historical deanonymization",
      recommendation: "Replace CLSAG with a lattice-based ring signature scheme (Module-LWE or Module-SIS based). Monero Research Lab's Triptych/Arcturus protocols must be extended with post-quantum security proofs. Note: historical transactions cannot be protected retroactively.",
      estimatedBreakYear: "2030–2035",
      algorithm: "shors",
    },
    {
      type: "ecdh_stealth_address",
      severity: "critical",
      title: "ECDH Stealth Address Derivation Broken (Shor's Algorithm)",
      description: "Monero generates one-time stealth addresses using ECDH (Elliptic Curve Diffie-Hellman) over Curve25519: the sender computes r*B (r = ephemeral scalar, B = recipient view key pubkey) to derive a shared secret. Shor's Algorithm breaks ECDH directly — a quantum computer can compute the shared secret for every transaction output from public blockchain data, linking all outputs to their recipients and deriving the one-time private keys.",
      affectedAddresses: "All stealth address outputs — every XMR output since RingCT activation",
      recommendation: "Replace ECDH with CRYSTALS-Kyber (ML-KEM, FIPS 203) for stealth address key encapsulation. New address format required (~800 byte Kyber public key vs 32 byte Curve25519). Hard fork required.",
      estimatedBreakYear: "2030–2035",
      algorithm: "shors",
    },
    {
      type: "pedersen_commitment_forgery",
      severity: "critical",
      title: "Pedersen Commitment Binding Broken — Unlimited XMR Forgery",
      description: "RingCT hides amounts using Pedersen commitments C = v*G + b*H, where G and H are curve generators. The binding property — which prevents creating fake amounts — relies entirely on ECDLP hardness (specifically, the discrete log between G and H being unknown). Shor's Algorithm finds this discrete log, completely breaking commitment binding. An attacker can then construct valid-looking commitments for arbitrary amounts, creating XMR from nothing — an unlimited inflation exploit.",
      affectedAddresses: "All RingCT transactions — the entire Monero supply is at risk of inflation",
      recommendation: "Replace Pedersen commitments with lattice-based commitments (MLWE-based) or hash-based commitments. Extremely complex migration due to tight coupling with Bulletproofs and balance equation. Requires full cryptographic redesign of RingCT.",
      estimatedBreakYear: "2030–2035",
      algorithm: "shors",
    },
    {
      type: "bulletproofs_soundness",
      severity: "high",
      title: "Bulletproofs+ Range Proof Soundness Broken",
      description: "Monero's Bulletproofs+ range proofs (proving amounts are non-negative without revealing them) are an inner-product proof system whose soundness reduces to the discrete logarithm assumption on Curve25519. Quantum ECDLP solving breaks Bulletproofs' soundness — an attacker can forge range proofs for out-of-range values, enabling creation of negative-balance inputs and amount forgery in combination with broken Pedersen commitments.",
      affectedAddresses: "All post-Bulletproof+ transactions (2022–present)",
      recommendation: "Replace Bulletproofs+ with post-quantum zero-knowledge range proofs: ZK-STARKs (hash-based, quantum-resistant), or lattice-based range proofs. Both produce significantly larger proof sizes, increasing blockchain size and transaction fees.",
      estimatedBreakYear: "2030–2035",
      algorithm: "shors",
    },
    {
      type: "randomx_grover",
      severity: "medium",
      title: "RandomX Proof-of-Work Quantum Mining Advantage (Grover's Algorithm)",
      description: "Monero's RandomX PoW algorithm uses AES-NI and Blake2b hashing. Grover's Algorithm provides O(√N) quantum speedup for hash preimage search, giving a quantum miner ~2× the effective hashrate of a classical miner. RandomX's memory-hard design (requiring ~2GB RAM) partially mitigates this because quantum RAM (QRAM) is architecturally extremely difficult to build at scale.",
      affectedAddresses: "Mining — affects block reward distribution and 51% attack threshold",
      recommendation: "Monitor QRAM hardware progress. Consider supplementing RandomX with a memory-hard hash function that is specifically quantum-resistant (e.g., Argon2 with post-quantum secure internal primitives). Plan difficulty algorithm adjustments for the quantum mining era.",
      estimatedBreakYear: "2040–2050",
      algorithm: "grovers",
    },
    {
      type: "view_key_exposure",
      severity: "high",
      title: "View Key Quantum Compromise — All Incoming Transactions Revealed",
      description: "Monero's view key (shared with auditors, payment processors, and third-party wallets) is a Curve25519 private scalar. If a quantum computer recovers the spend key via ECDLP, it trivially also recovers the view key (view key = spend key * scalar in Monero's key derivation). Any party who holds the view key has all incoming transactions fully exposed once quantum hardware breaks Curve25519.",
      affectedAddresses: "Any address whose view key has been shared with third parties",
      recommendation: "Design a post-quantum view key system using ML-KEM (Kyber) for scanning derivation, separating the scanning function from the spending function cryptographically with post-quantum primitives.",
      estimatedBreakYear: "2030–2035",
      algorithm: "shors",
    },
  ];

  // Crypto primitives table
  const cryptoPrimitives: CryptoPrimitive[] = [
    { name: "Ed25519", purpose: "Spend key / view key signatures", quantumVulnerable: true, breakAlgorithm: "Shor's Algorithm", estimatedBreakYear: "2030–2035", replacement: "CRYSTALS-Dilithium (FIPS 204)" },
    { name: "Curve25519 ECDH", purpose: "Stealth address key exchange", quantumVulnerable: true, breakAlgorithm: "Shor's Algorithm", estimatedBreakYear: "2030–2035", replacement: "ML-KEM / Kyber (FIPS 203)" },
    { name: "CLSAG Ring Signatures", purpose: "Sender anonymity", quantumVulnerable: true, breakAlgorithm: "Shor's Algorithm", estimatedBreakYear: "2030–2035", replacement: "Lattice-based ring signatures (Module-LWE)" },
    { name: "Pedersen Commitments", purpose: "Amount hiding (RingCT)", quantumVulnerable: true, breakAlgorithm: "Shor's Algorithm", estimatedBreakYear: "2030–2035", replacement: "Lattice-based commitments" },
    { name: "Bulletproofs+", purpose: "Range proofs (amount validity)", quantumVulnerable: true, breakAlgorithm: "Shor's Algorithm", estimatedBreakYear: "2030–2035", replacement: "ZK-STARKs or lattice range proofs" },
    { name: "Blake2b", purpose: "Hashing (RandomX PoW)", quantumVulnerable: false, breakAlgorithm: "Grover's (partial)", estimatedBreakYear: "2040–2050", replacement: "Blake2b with 512-bit output is acceptable" },
    { name: "Keccak-256", purpose: "Key derivation, hashing", quantumVulnerable: false, breakAlgorithm: "Grover's (partial)", estimatedBreakYear: "2040–2050", replacement: "SHA3-512 or SHAKE-256 for higher security" },
  ];

  const d = daemonInfo ?? {};
  const criticalCount = quantumFindings.filter(f => f.severity === "critical").length;

  return {
    chain: "monero",
    nodeUrl,
    nodeReachable,
    daemonVersion: nodeReachable ? String(d.version ?? "unknown") : null,
    networkType: nodeReachable ? (d.mainnet ? "mainnet" : d.testnet ? "testnet" : d.stagenet ? "stagenet" : "unknown") : null,
    height: nodeReachable ? Number(d.height ?? 0) : null,
    topBlockHash: nodeReachable ? String(d.top_block_hash ?? "") : null,
    difficulty: nodeReachable ? Number(d.difficulty ?? 0) : null,
    hashrate: nodeReachable ? formatHashrate(Number(d.difficulty ?? 0) / 120) : null,
    txPoolSize: nodeReachable ? Number(d.tx_pool_size ?? 0) : null,
    txPoolBytes: nodeReachable ? Number(d.tx_pool_size_bytes ?? 0) : null,
    connections: nodeReachable ? Number(d.outgoing_connections_count ?? 0) + Number(d.incoming_connections_count ?? 0) : null,
    syncedBlocks: nodeReachable ? Number(d.height ?? 0) : null,
    ringctEnabled: true,
    currentRingSize: 16,
    bulletproofsEnabled: true,
    bulletpoolsPlus: true,
    clsagEnabled: true,
    quantumFindings,
    recentTransactions: recentTxs,
    networkSecurity: {
      overallRisk: "critical",
      cryptoPrimitives,
      quantumTimeline: "2030–2035 (Shor's Algorithm on secp256k1/Curve25519) | 2040–2050 (Grover's on hash functions)",
      mitigationStatus: `${criticalCount} critical quantum vulnerabilities require hard fork migration. Monero Research Lab has active research on Triptych/Arcturus but no post-quantum implementations are production-ready. Migration complexity is HIGH due to 5 interdependent cryptographic primitives.`,
    },
  };
}

function formatHashrate(hps: number): string {
  if (hps > 1e12) return `${(hps / 1e12).toFixed(2)} TH/s`;
  if (hps > 1e9) return `${(hps / 1e9).toFixed(2)} GH/s`;
  if (hps > 1e6) return `${(hps / 1e6).toFixed(2)} MH/s`;
  if (hps > 1e3) return `${(hps / 1e3).toFixed(2)} KH/s`;
  return `${hps.toFixed(0)} H/s`;
}
