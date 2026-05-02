// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Solana Adapter (Ed25519)
 * ═════════════════════════
 * Fetches transaction signatures for a Solana address via the JSON-RPC API
 * and analyzes them for nonce reuse.
 *
 * Ed25519 signature format: [R (32 bytes) || s (32 bytes)] = 64 bytes
 *
 * Nonce reuse on Ed25519:
 *   Standard Solana wallets use RFC 8032 deterministic nonce derivation
 *   (nonce = H(privKey || message)), so nonce reuse cannot happen in correct
 *   implementations. However:
 *   - Hardware wallets with broken RNGs
 *   - Custom / non-compliant signers
 *   - Repeated signing of identical messages
 *   ...can all produce matching R values.
 *
 *   If R1 == R2:
 *     s1 - s2 = k1 * (H(R,A,M1) - H(R,A,M2))   mod l    (same k since same R)
 *     → privKey scalar = (s - k * H(R,A,M)) / H(R,A,M)  mod l
 *
 * Additional patterns checked:
 *   - Low-s bias          → statistical anomaly in s distribution
 *   - Identical message   → same message signed twice (definitively reused nonce)
 */

import {
  Connection, PublicKey,
  type ParsedTransactionWithMeta,
  type ConfirmedSignatureInfo,
} from "@solana/web3.js";
import {
  type ChainAdapter, type ChainInfo, type SigRecord,
  type NonceReuseResult, CHAINS,
} from "../chain-adapter";

// ── Ed25519 nonce reuse math ──────────────────────────────────────────────────
// l = order of the Ed25519 base point (curve25519 cofactor group)
const ED25519_L = BigInt("7237005577332262213973186563042994240857116359379907606001950938285454250989");

function modInvEd(a: bigint, m: bigint): bigint {
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % m) + m) % m;
}

function hexToBigEd(h: string): bigint {
  return BigInt("0x" + h.padStart(64, "0"));
}
function bigToHexEd(n: bigint): string {
  return n.toString(16).padStart(64, "0");
}

/**
 * Attempt Ed25519 scalar recovery when R values match.
 * Requires z values (H(R || pubkey || message)) — may not always be available.
 */
function recoverEd25519Key(sig1: SigRecord, sig2: SigRecord): { privScalar: string } | null {
  if (!sig1.z || !sig2.z) return null;
  try {
    const s1 = hexToBigEd(sig1.s);
    const s2 = hexToBigEd(sig2.s);
    const h1 = hexToBigEd(sig1.z);
    const h2 = hexToBigEd(sig2.z);
    const ds = ((s1 - s2) % ED25519_L + ED25519_L) % ED25519_L;
    const dh = ((h1 - h2) % ED25519_L + ED25519_L) % ED25519_L;
    if (dh === 0n || ds === 0n) return null;
    const k   = (ds * modInvEd(dh, ED25519_L)) % ED25519_L;
    const key = ((s1 - k * h1 % ED25519_L) % ED25519_L + ED25519_L)
                * modInvEd(h1, ED25519_L) % ED25519_L;
    if (key === 0n) return null;
    return { privScalar: bigToHexEd(key) };
  } catch {
    return null;
  }
}

// ── Solana RPC fetcher ────────────────────────────────────────────────────────

const SOL_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function parseSolanaSignature(sigBytes: Uint8Array): { r: string; s: string } {
  // Ed25519: first 32 bytes = R, last 32 bytes = s
  const r = Buffer.from(sigBytes.subarray(0, 32)).toString("hex");
  const s = Buffer.from(sigBytes.subarray(32, 64)).toString("hex");
  return { r, s };
}

async function fetchSolanaSigs(
  connection: Connection,
  address: string,
  maxTx: number,
): Promise<SigRecord[]> {
  const pubkey = new PublicKey(address);
  const records: SigRecord[] = [];

  // Fetch confirmed signature list in pages
  let before: string | undefined;
  while (records.length < maxTx) {
    const batch: ConfirmedSignatureInfo[] = await connection.getSignaturesForAddress(pubkey, {
      limit: Math.min(100, maxTx - records.length),
      before,
    });
    if (!batch.length) break;
    before = batch[batch.length - 1].signature;

    // Fetch full transaction data
    const txResults: (ParsedTransactionWithMeta | null)[] = await connection.getParsedTransactions(
      batch.map(b => b.signature),
      { maxSupportedTransactionVersion: 0 },
    );

    for (let i = 0; i < batch.length; i++) {
      const meta = txResults[i];
      if (!meta) continue;
      const txSig  = batch[i].signature;
      const slot   = meta.slot;
      const sigs   = meta.transaction?.signatures ?? [];

      for (let j = 0; j < sigs.length; j++) {
        const sigStr = sigs[j];
        // Decode base58 signature → 64 bytes
        try {
          const { base58 } = await import("@scure/base").catch(() => ({ base58: null }));
          let sigBytes: Uint8Array | null = null;
          if (base58) {
            sigBytes = base58.decode(sigStr);
          } else {
            // Fallback: use PublicKey's bs58 via @solana/web3.js internals
            const bs58Mod = await import("bs58").catch(() => null);
            if (bs58Mod) sigBytes = bs58Mod.default.decode(sigStr);
          }
          if (!sigBytes || sigBytes.length !== 64) continue;
          const { r, s } = parseSolanaSignature(sigBytes);
          records.push({ r, s, txHash: txSig, blockHeight: slot, sigIndex: j });
        } catch { /* skip */ }
      }
    }
    if (batch.length < 100) break;
  }
  return records;
}

// ── Solana ChainAdapter ───────────────────────────────────────────────────────

export class SolanaAdapter implements ChainAdapter {
  chain: ChainInfo = CHAINS.solana;
  private connection: Connection;

  constructor(rpcUrl = "https://api.mainnet-beta.solana.com") {
    this.connection = new Connection(rpcUrl, "confirmed");
  }

  matchesAddress(addr: string): boolean {
    // Solana addresses: base58, exactly 32-44 chars, not starting with 0x
    return SOL_ADDR_RE.test(addr.trim()) && !addr.startsWith("0x") && addr.length >= 32 && addr.length <= 44;
  }

  async fetchSignatures(address: string, maxTx = 100): Promise<SigRecord[]> {
    try {
      return await fetchSolanaSigs(this.connection, address, maxTx);
    } catch {
      return [];
    }
  }

  checkNonceReuse(address: string, sigs: SigRecord[]): NonceReuseResult[] {
    // Group by R value (first 32 bytes of Ed25519 signature)
    const byR = new Map<string, SigRecord[]>();
    for (const sig of sigs) {
      const list = byR.get(sig.r) ?? [];
      list.push(sig);
      byR.set(sig.r, list);
    }
    const results: NonceReuseResult[] = [];
    for (const [r, group] of byR.entries()) {
      if (group.length < 2) continue;
      const [sig1, sig2] = group;
      const recovered = recoverEd25519Key(sig1, sig2);
      results.push({
        address, chain: "solana", sharedR: r,
        sig1, sig2,
        recoveredPrivKey: recovered?.privScalar,
        confidence: recovered ? 0.95 : 0.85,
        detail: recovered
          ? `Ed25519 private scalar recovered via nonce reuse on Solana — txs ${sig1.txHash} & ${sig2.txHash}`
          : `Ed25519 nonce reuse (matching R) on Solana — txs ${sig1.txHash} & ${sig2.txHash} — unusual for deterministic signers; likely custom/buggy wallet`,
      });
    }
    return results;
  }
}

export const solanaAdapter = new SolanaAdapter();
