// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Bitcoin Blockchain Connector
// Uses mempool.space public API — no key required
// Detects quantum-vulnerable outputs and exposed public keys on-chain

const MEMPOOL = "https://mempool.space/api";
const BLOCKSTREAM = "https://blockstream.info/api";

async function apiFetch(url: string): Promise<unknown> {
  const r = await fetch(url, {
    headers: { "User-Agent": "QuantumAudit/1.0" },
    signal: AbortSignal.timeout(12000),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  return r.json();
}

export interface BitcoinAddressReport {
  address: string;
  chain: "bitcoin";
  balanceSats: number;
  balanceBTC: string;
  txCount: number;
  utxoCount: number;
  firstSeenBlock: number | null;
  scriptType: string;
  publicKeyExposed: boolean;
  publicKeys: string[];
  isP2PK: boolean;
  hasReusedAddress: boolean;
  quantumRiskLevel: "critical" | "high" | "medium" | "low";
  quantumRiskReason: string;
  utxos: UtxoEntry[];
  recentTransactions: TxSummary[];
  exposedKeyFindings: KeyFinding[];
  rawData: Record<string, unknown>;
}

export interface UtxoEntry {
  txid: string;
  vout: number;
  valueSats: number;
  valueBTC: string;
  scriptType: string;
  scriptHex: string;
  isP2PK: boolean;
  exposedPubkey: string | null;
}

export interface TxSummary {
  txid: string;
  blockHeight: number | null;
  confirmed: boolean;
  valueSat: number;
  fee: number | null;
  exposedPubkey: string | null;
}

export interface KeyFinding {
  type: "p2pk_pubkey" | "p2pkh_reuse_pubkey" | "multisig_pubkey" | "taproot_internal_key";
  pubkey: string;
  txid: string;
  vout?: number;
  valueSats: number;
  description: string;
  quantumRisk: string;
}

function detectScriptType(scriptHex: string): string {
  if (!scriptHex) return "unknown";
  if (scriptHex.startsWith("76a914") && scriptHex.endsWith("88ac")) return "P2PKH";
  if (scriptHex.startsWith("a914") && scriptHex.endsWith("87")) return "P2SH";
  if (scriptHex.startsWith("0014")) return "P2WPKH (SegWit v0)";
  if (scriptHex.startsWith("0020")) return "P2WSH (SegWit v0)";
  if (scriptHex.startsWith("5120")) return "P2TR (Taproot)";
  // P2PK: <pubkey> OP_CHECKSIG — 41 or 33 byte pubkey
  if ((scriptHex.startsWith("41") || scriptHex.startsWith("21")) && scriptHex.endsWith("ac")) return "P2PK";
  if (scriptHex.includes("ae")) return "Multisig";
  return "unknown";
}

function extractP2PKPubkey(scriptHex: string): string | null {
  // P2PK uncompressed: 41<65-byte-pubkey>ac => starts 41, ends ac, 136 chars
  if (scriptHex.startsWith("41") && scriptHex.endsWith("ac") && scriptHex.length === 138) {
    return scriptHex.slice(2, 132);
  }
  // P2PK compressed: 21<33-byte-pubkey>ac => starts 21, ends ac, 70 chars
  if (scriptHex.startsWith("21") && scriptHex.endsWith("ac") && scriptHex.length === 70) {
    return scriptHex.slice(2, 68);
  }
  return null;
}

function extractTaprootInternalKey(scriptHex: string): string | null {
  // P2TR: 5120<32-byte-internal-key> => starts 5120, 68 chars total
  if (scriptHex.startsWith("5120") && scriptHex.length === 68) {
    return scriptHex.slice(4);
  }
  return null;
}

export async function scanBitcoinAddress(address: string): Promise<BitcoinAddressReport> {
  // Fetch address stats
  const stats = await apiFetch(`${MEMPOOL}/address/${address}`) as Record<string, unknown>;
  const txids = await apiFetch(`${MEMPOOL}/address/${address}/txs`) as unknown[];
  const utxosRaw = await apiFetch(`${MEMPOOL}/address/${address}/utxo`) as unknown[];

  const chainStats = (stats.chain_stats ?? {}) as Record<string, number>;
  const mempoolStats = (stats.mempool_stats ?? {}) as Record<string, number>;

  const txCount = (chainStats.tx_count ?? 0) + (mempoolStats.tx_count ?? 0);
  const balanceSats = (chainStats.funded_txo_sum ?? 0) - (chainStats.spent_txo_sum ?? 0) +
    (mempoolStats.funded_txo_sum ?? 0) - (mempoolStats.spent_txo_sum ?? 0);

  const exposedKeys: string[] = [];
  const keyFindings: KeyFinding[] = [];
  const utxos: UtxoEntry[] = [];
  const recentTxs: TxSummary[] = [];

  let isP2PK = false;
  let hasSpent = txCount > 1; // spending reveals pubkey for P2PKH
  let firstBlock: number | null = null;

  // Process UTXOs
  for (const u of (utxosRaw as Record<string, unknown>[]).slice(0, 20)) {
    const scriptHex = String((u.scriptpubkey as string) ?? "");
    const scriptType = detectScriptType(scriptHex);
    const valueSats = Number(u.value ?? 0);
    const txid = String(u.txid ?? "");

    let p2pkPub = extractP2PKPubkey(scriptHex);
    let taprootKey = extractTaprootInternalKey(scriptHex);
    let exposedPub: string | null = null;

    if (p2pkPub) {
      isP2PK = true;
      exposedPub = p2pkPub;
      if (!exposedKeys.includes(p2pkPub)) exposedKeys.push(p2pkPub);
      keyFindings.push({
        type: "p2pk_pubkey",
        pubkey: p2pkPub,
        txid,
        vout: Number(u.vout ?? 0),
        valueSats,
        description: `P2PK UTXO — raw public key embedded in locking script. ${(valueSats / 1e8).toFixed(8)} BTC at risk.`,
        quantumRisk: "CRITICAL: Public key is permanently on-chain. Shor's Algorithm can derive the private key directly. No action needed by attacker except quantum hardware.",
      });
    }

    if (taprootKey) {
      exposedPub = taprootKey;
      if (!exposedKeys.includes(taprootKey)) exposedKeys.push(taprootKey);
      keyFindings.push({
        type: "taproot_internal_key",
        pubkey: taprootKey,
        txid,
        vout: Number(u.vout ?? 0),
        valueSats,
        description: `Taproot (P2TR) UTXO — internal key (tweaked x-only pubkey) embedded in scriptPubKey. ${(valueSats / 1e8).toFixed(8)} BTC.`,
        quantumRisk: "HIGH: Taproot key-path spend exposes tweaked public key. Vulnerable to Shor's Algorithm on secp256k1. Script-path spend has partial protection via MAST hash.",
      });
    }

    utxos.push({
      txid,
      vout: Number(u.vout ?? 0),
      valueSats,
      valueBTC: (valueSats / 1e8).toFixed(8),
      scriptType,
      scriptHex: scriptHex.slice(0, 80),
      isP2PK: !!p2pkPub,
      exposedPubkey: exposedPub,
    });
  }

  // Process recent transactions — look for pubkeys in scriptSig (P2PKH spending reveals pubkey)
  for (const tx of (txids as Record<string, unknown>[]).slice(0, 15)) {
    const txid = String(tx.txid ?? "");
    const blockHeight = tx.status ? Number((tx.status as Record<string, unknown>).block_height ?? 0) || null : null;
    const confirmed = Boolean((tx.status as Record<string, unknown>)?.confirmed ?? false);
    const fee = Number(tx.fee ?? 0) || null;

    if (firstBlock === null && blockHeight) firstBlock = blockHeight;

    let exposedPub: string | null = null;
    // Check inputs for scriptSig pubkey reveal (P2PKH spending)
    for (const vin of (tx.vin as Record<string, unknown>[]) ?? []) {
      const scriptSig = String(vin.scriptsig ?? "");
      // P2PKH scriptSig: OP_PUSH<sig> OP_PUSH<pubkey>
      // Compressed pubkey is 33 bytes = 66 hex chars, prefixed with 02 or 03
      const pubkeyMatch = scriptSig.match(/(?:02|03)[0-9a-fA-F]{64}/g);
      if (pubkeyMatch) {
        exposedPub = pubkeyMatch[0];
        if (!exposedKeys.includes(exposedPub)) {
          exposedKeys.push(exposedPub);
          keyFindings.push({
            type: "p2pkh_reuse_pubkey",
            pubkey: exposedPub,
            txid,
            valueSats: 0,
            description: `Public key revealed in scriptSig of spending transaction ${txid.slice(0, 16)}... Address has been spent from — public key is now permanently on-chain.`,
            quantumRisk: "CRITICAL if address reused: Any remaining UTXO at this address has its public key known. Shor's Algorithm can derive private key. Move funds immediately to a fresh address.",
          });
        }
      }
      // Check witness for SegWit pubkey
      const witness = vin.witness as string[] ?? [];
      for (const item of witness) {
        if (typeof item === "string" && item.length === 66 && (item.startsWith("02") || item.startsWith("03"))) {
          exposedPub = item;
          if (!exposedKeys.includes(item)) exposedKeys.push(item);
        }
      }
    }

    const vouts = tx.vout as Record<string, unknown>[] ?? [];
    const valueSat = vouts.reduce((a, v) => a + Number(v.value ?? 0), 0);

    recentTxs.push({ txid, blockHeight, confirmed, valueSat, fee, exposedPubkey: exposedPub });
  }

  // Determine script type from address format
  let scriptType = "unknown";
  if (address.startsWith("1")) scriptType = "P2PKH (Legacy)";
  else if (address.startsWith("3")) scriptType = "P2SH";
  else if (address.startsWith("bc1q")) scriptType = hasSpent ? "P2WPKH (SegWit — pubkey exposed after spend)" : "P2WPKH (SegWit — pubkey hidden until spend)";
  else if (address.startsWith("bc1p")) scriptType = "P2TR (Taproot)";
  else if (address.startsWith("bc1")) scriptType = "SegWit (unknown version)";

  // Quantum risk assessment
  let riskLevel: "critical" | "high" | "medium" | "low" = "low";
  let riskReason = "";

  if (isP2PK) {
    riskLevel = "critical";
    riskReason = `P2PK output detected — raw public key is embedded in the locking script and permanently visible on-chain. ${exposedKeys.length} public key(s) exposed. Shor's Algorithm can derive the private key from any of these. Estimated break window: 2030–2035.`;
  } else if (exposedKeys.length > 0 && hasSpent) {
    riskLevel = "critical";
    riskReason = `Address has been spent from — public key is now permanently on-chain (visible in scriptSig). Any remaining balance is quantum-vulnerable. ${exposedKeys.length} public key(s) confirmed exposed.`;
  } else if (address.startsWith("bc1p")) {
    riskLevel = "high";
    riskReason = "Taproot (P2TR) address — internal key exposed in scriptPubKey on all UTXOs. Vulnerable to Shor's Algorithm on secp256k1.";
  } else if (address.startsWith("1") && txCount > 1) {
    riskLevel = "high";
    riskReason = "Legacy P2PKH address with multiple transactions — public key has been revealed through at least one spending transaction. Address reuse confirmed.";
  } else if (address.startsWith("1") && txCount === 1) {
    riskLevel = "medium";
    riskReason = "Legacy P2PKH address — public key not yet revealed (no spending tx). However, 160-bit hash security is reduced to ~80-bit effective strength by Grover's Algorithm.";
  } else if (address.startsWith("bc1q")) {
    riskLevel = hasSpent ? "high" : "medium";
    riskReason = hasSpent
      ? "SegWit P2WPKH address with spending transactions — public key exposed in witness data."
      : "SegWit P2WPKH address — public key hidden behind hash until first spend. Relatively safer pre-quantum.";
  }

  return {
    address,
    chain: "bitcoin",
    balanceSats,
    balanceBTC: (balanceSats / 1e8).toFixed(8),
    txCount,
    utxoCount: (utxosRaw as unknown[]).length,
    firstSeenBlock: firstBlock,
    scriptType,
    publicKeyExposed: exposedKeys.length > 0,
    publicKeys: exposedKeys,
    isP2PK,
    hasReusedAddress: hasSpent && address.startsWith("1"),
    quantumRiskLevel: riskLevel,
    quantumRiskReason: riskReason,
    utxos,
    recentTransactions: recentTxs,
    exposedKeyFindings: keyFindings,
    rawData: { stats, utxoCount: (utxosRaw as unknown[]).length, txCount },
  };
}
