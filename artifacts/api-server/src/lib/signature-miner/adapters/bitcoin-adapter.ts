// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Bitcoin-family Adapter (secp256k1)
 * ════════════════════════════════════
 * Covers: Bitcoin, Litecoin, Dogecoin, Bitcoin Cash
 *
 * Signature retrieval:
 *   - BTC/LTC: Blockstream-compatible REST API (blockstream.info / litecoinspace.org)
 *   - DOGE:    dogechain.info API
 *   - All:     Parse DER-encoded ECDSA signatures from scriptSig / witness
 *
 * Vulnerability detection:
 *   - Nonce reuse (r-collision)  → identical k used twice → full key recovery
 *   - Weak k bias detection       → statistical skew in r values
 *
 * Key recovery math: identical to Ethereum (both use secp256k1)
 *   k = (z1 - z2) / (s1 - s2)  mod n
 *   privKey = (s*k - z) / r      mod n
 */

import {
  type ChainAdapter, type ChainInfo, type SigRecord, type NonceReuseResult,
  detectNonceReuseSecp256k1, CHAINS,
} from "../chain-adapter";

// ── DER signature parser ──────────────────────────────────────────────────────

/**
 * Parse a DER-encoded Bitcoin signature (hex string, optionally with sighash byte).
 * DER format: 30 [total-len] 02 [r-len] [r-bytes] 02 [s-len] [s-bytes] [sighash?]
 */
function parseDerSig(hex: string): { r: string; s: string; raw: string } | null {
  try {
    const b = Buffer.from(hex.replace(/^0x/, ""), "hex");
    if (b[0] !== 0x30) return null;
    let offset = 2;
    if (b[offset] !== 0x02) return null;
    const rLen = b[offset + 1];
    offset += 2;
    let rBytes = b.subarray(offset, offset + rLen);
    // Strip leading 0x00 padding byte (DER uses it to keep r positive)
    if (rBytes[0] === 0x00) rBytes = rBytes.subarray(1);
    offset += rLen;
    if (b[offset] !== 0x02) return null;
    const sLen = b[offset + 1];
    offset += 2;
    let sBytes = b.subarray(offset, offset + sLen);
    if (sBytes[0] === 0x00) sBytes = sBytes.subarray(1);
    return {
      r:   rBytes.toString("hex").padStart(64, "0"),
      s:   sBytes.toString("hex").padStart(64, "0"),
      raw: hex,
    };
  } catch {
    return null;
  }
}

/**
 * Extract DER signatures from a Blockstream-style script_asm string.
 * e.g. "OP_DATA_72 3045...01 OP_DATA_33 02abc..."
 */
function extractSigsFromAsm(asm: string): Array<{ r: string; s: string; raw: string }> {
  const sigs: Array<{ r: string; s: string; raw: string }> = [];
  for (const token of asm.split(" ")) {
    // DER signatures start with 30 and are 140-148 hex chars long (70-74 bytes)
    if (/^30[0-9a-fA-F]{2}/.test(token) && token.length >= 140) {
      const parsed = parseDerSig(token);
      if (parsed) sigs.push(parsed);
    }
  }
  return sigs;
}

// ── Blockstream-compatible fetcher ────────────────────────────────────────────

interface BlockstreamTx {
  txid:   string;
  status: { block_height?: number; confirmed: boolean };
  vin:    Array<{
    scriptsig?:     string;
    scriptsig_asm?: string;
    witness?:       string[];
  }>;
}

async function fetchBlockstreamTxs(apiBase: string, address: string, maxTx = 100): Promise<BlockstreamTx[]> {
  const results: BlockstreamTx[] = [];
  let lastSeen: string | undefined;
  const batchSize = 25;

  while (results.length < maxTx) {
    const url = lastSeen
      ? `${apiBase}/address/${address}/txs/chain/${lastSeen}`
      : `${apiBase}/address/${address}/txs`;

    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) break;
    const batch = await res.json() as BlockstreamTx[];
    if (!batch.length) break;
    results.push(...batch);
    if (batch.length < batchSize) break;
    lastSeen = batch[batch.length - 1].txid;
  }
  return results.slice(0, maxTx);
}

function txsToSigRecords(txs: BlockstreamTx[]): SigRecord[] {
  const records: SigRecord[] = [];
  for (const tx of txs) {
    for (let inputIdx = 0; inputIdx < tx.vin.length; inputIdx++) {
      const vin = tx.vin[inputIdx];
      const sigHexes: string[] = [];

      // Legacy P2PKH — scriptsig_asm
      if (vin.scriptsig_asm) {
        const fromAsm = extractSigsFromAsm(vin.scriptsig_asm);
        for (const s of fromAsm) sigHexes.push(s.raw);
      }
      // Segwit P2WPKH — witness[0]
      if (vin.witness?.length) {
        for (const w of vin.witness) {
          if (/^30[0-9a-fA-F]{2}/.test(w) && w.length >= 140) sigHexes.push(w);
        }
      }

      for (const sigHex of sigHexes) {
        const parsed = parseDerSig(sigHex);
        if (!parsed) continue;
        records.push({
          r:           parsed.r,
          s:           parsed.s,
          txHash:      tx.txid,
          blockHeight: tx.status.block_height,
          sigIndex:    inputIdx,
          raw:         sigHex,
          // z (sighash) is not fetched here — would require reconstructing the
          // entire UTXO signing preimage. Detection works without it; key
          // recovery requires it and is flagged as "pending z" in findings.
        });
      }
    }
  }
  return records;
}

// ── Dogecoin adapter (dogechain.info) ─────────────────────────────────────────

interface DogeTransaction {
  hash:   string;
  inputs: Array<{ script: string }>;
  block?: number;
}

async function fetchDogeTxs(address: string, max = 50): Promise<SigRecord[]> {
  try {
    const res = await fetch(
      `https://dogechain.info/api/v1/address/transactions/${address}/1`,
      { signal: AbortSignal.timeout(15_000) }
    );
    if (!res.ok) return [];
    const data = await res.json() as { transactions?: DogeTransaction[] };
    const txs = data.transactions ?? [];
    const records: SigRecord[] = [];
    for (const tx of txs.slice(0, max)) {
      for (let i = 0; i < tx.inputs.length; i++) {
        const sigs = extractSigsFromAsm(tx.inputs[i].script ?? "");
        for (const sig of sigs) {
          records.push({ r: sig.r, s: sig.s, txHash: tx.hash, sigIndex: i, raw: sig.raw });
        }
      }
    }
    return records;
  } catch {
    return [];
  }
}

// ── Bitcoin-family ChainAdapter ───────────────────────────────────────────────

export class BitcoinFamilyAdapter implements ChainAdapter {
  chain: ChainInfo;

  private readonly addrPatterns: RegExp[];

  constructor(chainId: "bitcoin" | "litecoin" | "dogecoin" | "bitcoincash") {
    this.chain = CHAINS[chainId];
    this.addrPatterns = {
      bitcoin:     [/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/, /^bc1[ac-hj-np-z02-9]{6,87}$/i],
      litecoin:    [/^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$/, /^ltc1[ac-hj-np-z02-9]{6,87}$/i],
      dogecoin:    [/^D[5-9A-HJ-NP-Za-km-z]{33}$/],
      bitcoincash: [/^(bitcoincash:)?[qp][0-9a-z]{41}$/i],
    }[chainId];
  }

  matchesAddress(addr: string): boolean {
    return this.addrPatterns.some(re => re.test(addr.trim()));
  }

  async fetchSignatures(address: string, maxTx = 100): Promise<SigRecord[]> {
    try {
      if (this.chain.id === "dogecoin") {
        return fetchDogeTxs(address, maxTx);
      }
      // BTC, LTC, BCH — Blockstream-compatible REST APIs
      const apiBase = this.chain.apiBase ?? "https://blockstream.info/api";
      const txs = await fetchBlockstreamTxs(apiBase, address, maxTx);
      return txsToSigRecords(txs);
    } catch {
      return [];
    }
  }

  checkNonceReuse(address: string, sigs: SigRecord[]): NonceReuseResult[] {
    return detectNonceReuseSecp256k1(address, this.chain.id, sigs);
  }
}

// ── Singleton instances ───────────────────────────────────────────────────────

export const bitcoinAdapter   = new BitcoinFamilyAdapter("bitcoin");
export const litecoinAdapter  = new BitcoinFamilyAdapter("litecoin");
export const dogecoinAdapter  = new BitcoinFamilyAdapter("dogecoin");
export const bitcoinCashAdapter = new BitcoinFamilyAdapter("bitcoincash");
