/**
 * UTXO Privacy Coins Adapter (secp256k1)
 * ════════════════════════════════════════
 * Covers: Dash (DASH) and Zcash (ZEC — transparent addresses only)
 *
 * Both chains use the same secp256k1 DER-encoded signature scheme as Bitcoin.
 * Zcash shielded addresses (zs1/u1) use zk-SNARKs — key recovery is not
 * possible; those are flagged as detection-only.
 *
 * Privacy/laundering context:
 *   DASH — PrivateSend mixer (CoinJoin) is built into core wallet. Frequently
 *           used as a mixing layer before converting to BTC/ETH.
 *   ZEC  — Transparent ↔ shielded hops. Coinbase → shielded → transparent is
 *           the classic laundering pattern. Transparent sigs are vulnerable.
 *
 * APIs:
 *   DASH — BlockCypher public API (no key required, rate-limited to 3 req/s)
 *   ZEC  — Zcash.info REST API (zcha.in)
 */

import {
  type ChainAdapter, type ChainInfo, type SigRecord, type NonceReuseResult,
  detectNonceReuseSecp256k1, CHAINS,
} from "../chain-adapter";

const DASH_CHAIN = CHAINS.dash;
const ZEC_CHAIN  = CHAINS.zcash;

const DASH_RE  = /^[X7][1-9A-HJ-NP-Za-km-z]{33}$/;
const ZEC_T_RE = /^t[13][1-9A-HJ-NP-Za-km-z]{33}$/;
const ZEC_S_RE = /^(zs1|u1)[a-z0-9]{60,}$/;

// ── DER parser (shared) ───────────────────────────────────────────────────────

function parseDerSig(hex: string): { r: string; s: string } | null {
  try {
    const b = Buffer.from(hex.replace(/^0x/, ""), "hex");
    if (b[0] !== 0x30) return null;
    let off = 2;
    if (b[off] !== 0x02) return null;
    const rLen = b[off + 1]; off += 2;
    let rB = b.subarray(off, off + rLen);
    if (rB[0] === 0x00) rB = rB.subarray(1);
    off += rLen;
    if (b[off] !== 0x02) return null;
    const sLen = b[off + 1]; off += 2;
    let sB = b.subarray(off, off + sLen);
    if (sB[0] === 0x00) sB = sB.subarray(1);
    return {
      r: rB.toString("hex").padStart(64, "0"),
      s: sB.toString("hex").padStart(64, "0"),
    };
  } catch { return null; }
}

function extractSigsFromAsm(asm: string): Array<{ r: string; s: string }> {
  const out: Array<{ r: string; s: string }> = [];
  for (const tok of (asm ?? "").split(" ")) {
    if (/^30[0-9a-fA-F]{2}/.test(tok) && tok.length >= 140) {
      const p = parseDerSig(tok);
      if (p) out.push(p);
    }
  }
  return out;
}

// ── BlockCypher DASH fetcher ──────────────────────────────────────────────────

interface BcTx {
  hash:   string;
  block_height?: number;
  inputs: Array<{ script?: string; script_type?: string; addresses?: string[] }>;
}

interface BcAddressResp {
  txs?: BcTx[];
}

async function fetchDashSigs(address: string, maxTx = 80): Promise<SigRecord[]> {
  const limit = Math.min(maxTx, 50);
  const url = `${DASH_CHAIN.apiBase}/addrs/${address}/full?limit=${limit}&includeScript=true`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`BlockCypher DASH HTTP ${res.status}`);
  const data: BcAddressResp = await res.json() as BcAddressResp;

  const sigs: SigRecord[] = [];
  for (const tx of data.txs ?? []) {
    for (const vin of tx.inputs) {
      if (!vin.script) continue;
      // Try ASM-style hex script
      const parsed = extractSigsFromAsm(vin.script);
      if (parsed.length === 0) {
        // Raw hex — try directly
        const p = parseDerSig(vin.script);
        if (p) parsed.push(p);
      }
      for (const p of parsed) {
        sigs.push({
          r: p.r, s: p.s,
          txHash: tx.hash,
          blockHeight: tx.block_height,
          raw: vin.script,
        });
      }
    }
  }
  return sigs;
}

// ── Zcash transparent fetcher ─────────────────────────────────────────────────

interface ZchaInTx {
  hash:   string;
  height?: number;
  vin?:   Array<{ scriptSig?: { hex?: string; asm?: string } }>;
}

interface ZchaInResp {
  sent?: ZchaInTx[];
}

async function fetchZecSigs(address: string, maxTx = 80): Promise<SigRecord[]> {
  if (ZEC_S_RE.test(address)) {
    // Shielded address — no ECDSA sig to extract
    return [];
  }
  // Transparent address — fetch via zcha.in
  const url = `${ZEC_CHAIN.apiBase}/accounts/${address}/sent?limit=${Math.min(maxTx, 100)}&offset=0`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) {
    // Fallback: try recv endpoint (some older ZEC explorers)
    return [];
  }
  const data: ZchaInResp = await res.json() as ZchaInResp;

  const sigs: SigRecord[] = [];
  for (const tx of data.sent ?? []) {
    for (const vin of tx.vin ?? []) {
      const hex = vin.scriptSig?.hex ?? "";
      const asm = vin.scriptSig?.asm ?? "";
      const fromAsm = extractSigsFromAsm(asm);
      if (fromAsm.length > 0) {
        for (const p of fromAsm) sigs.push({ r: p.r, s: p.s, txHash: tx.hash, blockHeight: tx.height, raw: hex });
      } else if (hex) {
        const p = parseDerSig(hex);
        if (p) sigs.push({ r: p.r, s: p.s, txHash: tx.hash, blockHeight: tx.height, raw: hex });
      }
    }
  }
  return sigs;
}

// ── DASH Adapter ──────────────────────────────────────────────────────────────

export const dashAdapter: ChainAdapter = {
  chain: DASH_CHAIN,

  matchesAddress(addr) { return DASH_RE.test(addr); },

  async fetchSignatures(address, maxTx = 80) {
    return fetchDashSigs(address, maxTx);
  },

  checkNonceReuse(address, sigs): NonceReuseResult[] {
    return detectNonceReuseSecp256k1(address, "dash", sigs);
  },
};

// ── Zcash Adapter ─────────────────────────────────────────────────────────────

export const zcashAdapter: ChainAdapter = {
  chain: ZEC_CHAIN,

  matchesAddress(addr) { return ZEC_T_RE.test(addr) || ZEC_S_RE.test(addr); },

  async fetchSignatures(address, maxTx = 80) {
    return fetchZecSigs(address, maxTx);
  },

  checkNonceReuse(address, sigs): NonceReuseResult[] {
    // Shielded addresses get flagged differently in the engine — no ECDSA here
    return detectNonceReuseSecp256k1(address, "zcash", sigs);
  },
};
