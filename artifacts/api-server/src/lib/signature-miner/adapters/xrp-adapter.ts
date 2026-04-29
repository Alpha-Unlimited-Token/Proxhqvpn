/**
 * XRP Ledger Adapter (secp256k1)
 * ══════════════════════════════
 * Fetches transaction signatures for an XRP address via the public XRPL
 * JSON-RPC cluster (xrplcluster.com) and runs secp256k1 nonce-reuse analysis.
 *
 * XRP uses DER-encoded secp256k1 signatures stored in the TxnSignature field.
 * The signing payload is: 0x53545800 (STX\0) + canonical binary serialisation.
 * Because full sighash recovery requires canonical serialisation of the tx
 * object (complex), we detect nonce reuse via r-value collisions and flag
 * them at 0.9 confidence. When z values become available via a future resolver
 * the confidence jumps to 1.0 with full key recovery.
 *
 * Privacy/laundering note:
 *   XRP is the #7 most-used blockchain by tx volume and is frequently used
 *   to layer funds before conversion. Address format: r[25-34 base58].
 */

import {
  type ChainAdapter, type ChainInfo, type SigRecord, type NonceReuseResult,
  detectNonceReuseSecp256k1, CHAINS,
} from "../chain-adapter";

const CHAIN = CHAINS.ripple;
const XRP_RE = /^r[1-9A-HJ-NP-Za-km-z]{24,33}$/;

// ── DER signature parser ──────────────────────────────────────────────────────

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

// ── XRPL JSON-RPC types ───────────────────────────────────────────────────────

interface XrplTx {
  hash:           string;
  TxnSignature?:  string;   // DER hex for secp256k1 accounts
  ledger_index?:  number;
  Sequence?:      number;
}

interface XrplResponse {
  result: {
    transactions?: Array<{ tx?: XrplTx; tx_json?: XrplTx }>;
    error_message?: string;
    status?: string;
  };
}

// ── Signature fetcher ─────────────────────────────────────────────────────────

async function fetchXrpSigs(address: string, maxTx = 80): Promise<SigRecord[]> {
  const body = JSON.stringify({
    method: "account_tx",
    params: [{
      account: address,
      limit:   Math.min(maxTx, 200),
      binary:  false,
    }],
  });

  const res = await fetch(CHAIN.rpcUrl!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(12_000),
  });
  if (!res.ok) throw new Error(`XRPL HTTP ${res.status}`);
  const data: XrplResponse = await res.json() as XrplResponse;

  if (data.result?.error_message) {
    throw new Error(`XRPL error: ${data.result.error_message}`);
  }

  const sigs: SigRecord[] = [];
  for (const entry of data.result?.transactions ?? []) {
    const tx: XrplTx = entry.tx ?? entry.tx_json ?? ({} as XrplTx);
    if (!tx.TxnSignature || !tx.hash) continue;
    const parsed = parseDerSig(tx.TxnSignature);
    if (!parsed) continue;
    sigs.push({
      r:           parsed.r,
      s:           parsed.s,
      txHash:      tx.hash,
      blockHeight: tx.ledger_index,
      raw:         tx.TxnSignature,
    });
  }
  return sigs;
}

// ── Adapter ───────────────────────────────────────────────────────────────────

export const xrpAdapter: ChainAdapter = {
  chain: CHAIN,

  matchesAddress(addr) { return XRP_RE.test(addr); },

  async fetchSignatures(address, maxTx = 80) {
    return fetchXrpSigs(address, maxTx);
  },

  checkNonceReuse(address, sigs): NonceReuseResult[] {
    return detectNonceReuseSecp256k1(address, "ripple", sigs);
  },
};
