// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Adaptive chain detector — given any address or tx hash, determines the blockchain
// and returns the full cryptographic profile: signature scheme, curve parameters,
// recovery equations, and scan instructions.

export type CurveParams = {
  name: string;
  order: string;           // group order (hex)
  orderDecimal: string;    // group order (decimal, truncated)
  generatorX?: string;     // G.x for reference
  generatorY?: string;     // G.y for reference
  hashAlgorithm: string;   // hash used in signing
  sigFormat: string;       // description of signature byte layout
};

export type RecoveryEquation = {
  label: string;
  formula: string;
  latexHint: string;       // human-readable math notation
  variables: Record<string, string>;  // variable definitions
};

export type ChainInfo = {
  chain: string;
  displayName: string;
  network: string;
  signatureScheme: string;   // "secp256k1-ecdsa" | "ed25519" | "sr25519-schnorr" | "clsag" | "p256-ecdsa"
  schemeLabel: string;
  inputType: "address" | "txHash" | "ambiguous";
  confidence: number;        // 0–100
  curveParams: CurveParams;
  recoveryEquations: RecoveryEquation[];
  explorerBase: string;
  apiNote: string;
  reuseRisk: string;         // what duplicate nonce/keyimage means for this chain
};

// ── Curve parameter definitions ────────────────────────────────────────────────

const SECP256K1: CurveParams = {
  name: "secp256k1",
  order: "FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
  orderDecimal: "115792089237316195423570985008687907852837564279074904382605163141518161494337",
  generatorX: "79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798",
  generatorY: "483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8",
  hashAlgorithm: "SHA-256 (double) for Bitcoin; Keccak-256 for Ethereum",
  sigFormat: "DER/compact: r (32 bytes) || s (32 bytes). ECDSA: verify r = (k·G).x mod n",
};

const P256: CurveParams = {
  name: "P-256 (secp256r1 / NIST P-256)",
  order: "FFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551",
  orderDecimal: "115792089210356248762697446949407573529996955224135760342422259061068512044369",
  generatorX: "6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296",
  generatorY: "4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5",
  hashAlgorithm: "SHA-256",
  sigFormat: "r (32 bytes) || s (32 bytes). ECDSA: same nonce-recovery equations as secp256k1",
};

const ED25519: CurveParams = {
  name: "Ed25519 (Edwards curve / Curve25519)",
  order: "1000000000000000000000000000000014DEF9DEA2F79CD65812631A5CF5D3ED",
  orderDecimal: "7237005577332262213973186563042994240857116359379907606001950938285454250989",
  hashAlgorithm: "SHA-512 (inner), used in H(R || A || M) challenge",
  sigFormat: "[0..31] = R (nonce point, encoded), [32..63] = S (response scalar). Sign: S = k + H(R,A,M)·a mod l",
};

const SR25519: CurveParams = {
  name: "Sr25519 / Schnorr on Ristretto255",
  order: "1000000000000000000000000000000014DEF9DEA2F79CD65812631A5CF5D3ED",
  orderDecimal: "7237005577332262213973186563042994240857116359379907606001950938285454250989",
  hashAlgorithm: "Blake2b / Merlin transcript (context-based challenge hash)",
  sigFormat: "[0..31] = R (Ristretto255 nonce point), [32..63] = s (response). Verify: s·B = R + c·P where c = H(R,P,M)",
};

const CLSAG: CurveParams = {
  name: "CLSAG (Concise Linkable Spontaneous Anonymous Group) on Ed25519",
  order: "1000000000000000000000000000000014DEF9DEA2F79CD65812631A5CF5D3ED",
  orderDecimal: "7237005577332262213973186563042994240857116359379907606001950938285454250989",
  hashAlgorithm: "Keccak-256 for ring challenge; H_p(P) for key image generation",
  sigFormat: "Key image I = x·H_p(P). Ring signature: (c, s[0..n-1]). Reuse detection: same I in two txs = proven double-spend",
};

// ── Recovery equations per scheme ──────────────────────────────────────────────

const ECDSA_RECOVERY: RecoveryEquation[] = [
  {
    label: "Nonce from two signatures sharing r",
    formula: "k = (z1 - z2) × (s1 - s2)⁻¹ mod n",
    latexHint: "k = (z₁ − z₂) · (s₁ − s₂)⁻¹ mod n",
    variables: { z1: "hash of message 1", z2: "hash of message 2", s1: "s scalar of sig 1", s2: "s scalar of sig 2", n: "curve group order", k: "RECOVERED nonce" },
  },
  {
    label: "Private key from recovered nonce k",
    formula: "priv = (s1 × k - z1) × r⁻¹ mod n",
    latexHint: "a = (s₁·k − z₁) · r⁻¹ mod n",
    variables: { s1: "s scalar of sig 1", k: "recovered nonce", z1: "hash of message 1", r: "shared r (= (k·G).x mod n)", n: "curve group order", priv: "RECOVERED private key" },
  },
];

const ED25519_RECOVERY: RecoveryEquation[] = [
  {
    label: "Private scalar from shared nonce R",
    formula: "a = (S1 - S2) × (H(R,A,M1) - H(R,A,M2))⁻¹ mod l",
    latexHint: "a = (S₁ − S₂) · (H₁ − H₂)⁻¹ mod l",
    variables: { S1: "response scalar of sig 1", S2: "response scalar of sig 2", H1: "H(R‖A‖M1) SHA-512 reduced mod l", H2: "H(R‖A‖M2) SHA-512 reduced mod l", l: "Ed25519 group order", a: "RECOVERED private scalar (clamped seed)" },
  },
];

const SR25519_RECOVERY: RecoveryEquation[] = [
  {
    label: "Private key from shared Schnorr nonce R",
    formula: "key = (s1 - s2) × (c1 - c2)⁻¹ mod l",
    latexHint: "x = (s₁ − s₂) · (c₁ − c₂)⁻¹ mod l",
    variables: { s1: "s scalar of extrinsic 1", s2: "s scalar of extrinsic 2", c1: "challenge H(R‖pub‖M1) Blake2b mod l", c2: "challenge H(R‖pub‖M2) Blake2b mod l", l: "Ristretto255 group order", key: "RECOVERED private key" },
  },
];

const CLSAG_DETECTION: RecoveryEquation[] = [
  {
    label: "Key image uniqueness verification",
    formula: "I = x · H_p(P) — unique per UTXO, public on-chain",
    latexHint: "I = x · H_p(P)",
    variables: { x: "private spend key", P: "public spend key (x·G)", "H_p(P)": "point hash of public key", I: "key image — spending fingerprint" },
  },
  {
    label: "Double-spend detection",
    formula: "If I_tx1 = I_tx2 then SAME private key x signed both inputs",
    latexHint: "I₁ = I₂ ⇒ double-spend proven",
    variables: { "I_tx1": "key image in transaction 1", "I_tx2": "key image in transaction 2", "True signer": "intersection of ring(tx1) ∩ ring(tx2)" },
  },
];

// ── Address/hash detection patterns ──────────────────────────────────────────

export function detectChain(input: string): ChainInfo[] {
  const t = input.trim();
  const candidates: ChainInfo[] = [];

  // ── Ethereum / EVM (0x + 40 hex) ──
  if (/^0x[0-9a-fA-F]{40}$/.test(t)) {
    candidates.push(makeChain("ethereum", "Ethereum / EVM", "secp256k1-ecdsa", "address", 99, SECP256K1, ECDSA_RECOVERY,
      "https://etherscan.io", "Etherscan API (public)", "Shared r value between two txs from same address proves same nonce k → full private key recovery"));
  }

  // ── EVM tx hash (0x + 64 hex) — Ethereum OR Polkadot extrinsic ──
  if (/^0x[0-9a-fA-F]{64}$/.test(t)) {
    candidates.push(makeChain("ethereum", "Ethereum / EVM tx hash", "secp256k1-ecdsa", "txHash", 75, SECP256K1, ECDSA_RECOVERY,
      "https://etherscan.io", "Etherscan API", "Shared r value → private key recovery"));
    candidates.push(makeChain("polkadot", "Polkadot / Substrate extrinsic hash", "sr25519-schnorr", "txHash", 75, SR25519, SR25519_RECOVERY,
      "https://polkadot.subscan.io", "Subscan API (public)", "Shared R between extrinsics → Schnorr private key recovery"));
  }

  // ── Bitcoin legacy (1.../3...) ──
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(t)) {
    candidates.push(makeChain("bitcoin", "Bitcoin (Legacy P2PKH/P2SH)", "secp256k1-ecdsa", "address", 95, SECP256K1, ECDSA_RECOVERY,
      "https://blockstream.info", "Blockstream API", "Shared r (nonce reuse in ECDSA) → private key recovery"));
  }

  // ── Bitcoin bech32 (bc1...) ──
  if (/^(bc1|BC1)[a-zA-Z0-9]{6,87}$/.test(t)) {
    candidates.push(makeChain("bitcoin", "Bitcoin (Bech32 P2WPKH/P2TR)", "secp256k1-ecdsa", "address", 97, SECP256K1, ECDSA_RECOVERY,
      "https://blockstream.info", "Blockstream API", "Schnorr nonce reuse in Taproot (same R → key recovery)"));
  }

  // ── Bitcoin tx hash (64 hex, no 0x) ──
  if (/^[0-9a-fA-F]{64}$/.test(t)) {
    candidates.push(makeChain("bitcoin", "Bitcoin tx hash", "secp256k1-ecdsa", "txHash", 60, SECP256K1, ECDSA_RECOVERY,
      "https://blockstream.info", "Blockstream API", "Shared r value in surrounding txs → private key recovery"));
    candidates.push(makeChain("monero", "Monero tx hash", "clsag", "txHash", 60, CLSAG, CLSAG_DETECTION,
      "https://xmrchain.net", "XMRChain API + Monero daemon RPC", "Duplicate key image I in surrounding blocks → double-spend proven"));
  }

  // ── Litecoin ──
  if (/^[LMm3][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(t) && t.startsWith("L")) {
    candidates.push(makeChain("litecoin", "Litecoin", "secp256k1-ecdsa", "address", 90, SECP256K1, ECDSA_RECOVERY,
      "https://blockchair.com/litecoin", "Blockchair API", "Same math as Bitcoin secp256k1 ECDSA — shared r → key recovery"));
  }

  // ── Dogecoin ──
  if (/^D[5-9A-HJ-NP-U][1-9A-HJ-NP-Za-km-z]{32}$/.test(t)) {
    candidates.push(makeChain("dogecoin", "Dogecoin", "secp256k1-ecdsa", "address", 93, SECP256K1, ECDSA_RECOVERY,
      "https://blockchair.com/dogecoin", "Blockchair API", "secp256k1 ECDSA — shared r → full private key recovery"));
  }

  // ── Bitcoin Cash ──
  if (/^(bitcoincash:)?(q|p)[a-z0-9]{41}$/.test(t.toLowerCase())) {
    candidates.push(makeChain("bitcoin-cash", "Bitcoin Cash", "secp256k1-ecdsa", "address", 92, SECP256K1, ECDSA_RECOVERY,
      "https://blockchair.com/bitcoin-cash", "Blockchair API", "secp256k1 ECDSA — shared r → private key recovery"));
  }

  // ── Solana (base58, 32–44 chars, not SS58) ──
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(t) && !isSS58(t)) {
    const isTxSig = t.length >= 80;
    candidates.push(makeChain("solana", isTxSig ? "Solana tx signature" : "Solana wallet", "ed25519", isTxSig ? "txHash" : "address", 85, ED25519, ED25519_RECOVERY,
      "https://solscan.io", "Solana JSON-RPC (public mainnet)", "Same R in two signatures → Ed25519 nonce reuse → private scalar recovery"));
  }

  // ── Polkadot / Substrate SS58 ──
  if (isSS58(t)) {
    const subChain = guessSubstrateChain(t);
    candidates.push(makeChain(subChain.chain, subChain.label, "sr25519-schnorr", "address", 88, SR25519, SR25519_RECOVERY,
      `https://${subChain.chain}.subscan.io`, "Subscan API (public)", "Same Ristretto255 R nonce in two extrinsics → Schnorr private key recovery"));
  }

  // ── Monero wallet address (4..., 95 chars) ──
  if (/^4[0-9AB][1-9A-HJ-NP-Za-km-z]{90,95}$/.test(t)) {
    candidates.push(makeChain("monero", "Monero wallet address", "clsag", "address", 96, CLSAG, CLSAG_DETECTION,
      "https://xmrchain.net", "XMRChain explorer + Monero daemon RPC", "Cross-reference key images in surrounding blocks — duplicate = double-spend proof"));
  }

  // ── Cardano (addr1...) ──
  if (/^addr1[a-z0-9]{40,}$/.test(t.toLowerCase())) {
    candidates.push(makeChain("cardano", "Cardano (Shelley/Babbage)", "ed25519", "address", 96, ED25519, ED25519_RECOVERY,
      "https://cardanoscan.io", "Koios API (public)", "Same R nonce in two vkey witnesses → Ed25519 private scalar recovery"));
  }

  // ── Cosmos / ATOM ──
  if (/^cosmos1[a-z0-9]{38}$/.test(t)) {
    candidates.push(makeChain("cosmos", "Cosmos / ATOM", "secp256k1-ecdsa", "address", 98, SECP256K1, ECDSA_RECOVERY,
      "https://www.mintscan.io/cosmos", "Cosmos REST API", "secp256k1 ECDSA — shared r in txs from same key → private key recovery"));
  }
  // Cosmos variant chains
  if (/^(osmo|juno|stars|inj|sei|akash|regen|ibc)1[a-z0-9]{38}$/.test(t)) {
    const prefix = t.split("1")[0];
    candidates.push(makeChain("cosmos", `Cosmos IBC chain (${prefix})`, "secp256k1-ecdsa", "address", 95, SECP256K1, ECDSA_RECOVERY,
      "https://www.mintscan.io", "Cosmos REST API", "secp256k1 ECDSA nonce reuse → private key recovery"));
  }

  // ── Tezos ──
  if (/^tz1[a-km-zA-HJ-NP-Z1-9]{33}$/.test(t)) {
    candidates.push(makeChain("tezos", "Tezos (tz1 — Ed25519)", "ed25519", "address", 97, ED25519, ED25519_RECOVERY,
      "https://tzkt.io", "TzKT API (public)", "Ed25519 — same R nonce across two ops → private scalar recovery"));
  }
  if (/^tz2[a-km-zA-HJ-NP-Z1-9]{33}$/.test(t)) {
    candidates.push(makeChain("tezos", "Tezos (tz2 — secp256k1)", "secp256k1-ecdsa", "address", 97, SECP256K1, ECDSA_RECOVERY,
      "https://tzkt.io", "TzKT API (public)", "secp256k1 ECDSA nonce reuse → private key recovery"));
  }
  if (/^tz3[a-km-zA-HJ-NP-Z1-9]{33}$/.test(t)) {
    candidates.push(makeChain("tezos", "Tezos (tz3 — P-256 / secp256r1)", "p256-ecdsa", "address", 97, P256, ECDSA_RECOVERY,
      "https://tzkt.io", "TzKT API (public)", "P-256 ECDSA — same r nonce → private key recovery (n_P256 ≠ n_secp256k1!)"));
  }
  if (/^KT1[a-km-zA-HJ-NP-Z1-9]{33}$/.test(t)) {
    candidates.push(makeChain("tezos", "Tezos smart contract (KT1)", "ed25519", "address", 85, ED25519, ED25519_RECOVERY,
      "https://tzkt.io", "TzKT API", "Contract — scan manager key operations"));
  }

  // ── Stellar ──
  if (/^G[A-Z2-7]{55}$/.test(t)) {
    candidates.push(makeChain("stellar", "Stellar (Lumens)", "ed25519", "address", 97, ED25519, ED25519_RECOVERY,
      "https://stellar.expert", "Stellar Horizon API (public)", "Ed25519 — same R nonce in two Stellar operations → private scalar recovery"));
  }

  // ── Algorand ──
  if (/^[A-Z2-7]{58}$/.test(t)) {
    candidates.push(makeChain("algorand", "Algorand", "ed25519", "address", 94, ED25519, ED25519_RECOVERY,
      "https://algoexplorer.io", "AlgoNode API (public)", "Ed25519 — same R in two transactions → private scalar recovery"));
  }

  // ── NEAR ──
  if (/^[a-z0-9_-]{2,64}\.near$/.test(t) || /^[a-f0-9]{64}$/.test(t)) {
    candidates.push(makeChain("near", "NEAR Protocol", "ed25519", /\.near$/.test(t) ? "address" : "txHash", 93, ED25519, ED25519_RECOVERY,
      "https://nearblocks.io", "NEAR RPC + Nearblocks API", "Ed25519 — same R nonce across calls → private key recovery"));
  }

  // ── Avalanche ──
  if (/^X-avax1[a-z0-9]{38}$/.test(t) || /^P-avax1[a-z0-9]{38}$/.test(t)) {
    candidates.push(makeChain("avalanche", "Avalanche (X/P-chain)", "secp256k1-ecdsa", "address", 97, SECP256K1, ECDSA_RECOVERY,
      "https://snowtrace.io", "Avalanche API", "secp256k1 ECDSA nonce reuse → private key recovery"));
  }
  if (/^0x[0-9a-fA-F]{40}$/.test(t)) {
    // Also Avalanche C-chain
    candidates.push(makeChain("avalanche", "Avalanche (C-chain / EVM)", "secp256k1-ecdsa", "address", 70, SECP256K1, ECDSA_RECOVERY,
      "https://snowtrace.io", "Snowtrace API", "secp256k1 ECDSA — same address format as EVM"));
  }

  // ── BSC / Polygon / Arbitrum / OP (all 0x EVM addresses — already included above) ──

  // Sort by confidence desc
  return candidates.sort((a, b) => b.confidence - a.confidence);
}

function makeChain(
  chain: string, displayName: string, scheme: string, inputType: "address" | "txHash" | "ambiguous",
  confidence: number, curve: CurveParams, equations: RecoveryEquation[],
  explorerBase: string, apiNote: string, reuseRisk: string
): ChainInfo {
  const SCHEME_LABELS: Record<string, string> = {
    "secp256k1-ecdsa": "secp256k1 / ECDSA",
    "ed25519": "Ed25519 / EdDSA",
    "sr25519-schnorr": "Sr25519 / Schnorr (Ristretto255)",
    "clsag": "CLSAG Ring Signature",
    "p256-ecdsa": "P-256 (secp256r1) / ECDSA",
  };
  return {
    chain,
    displayName,
    network: "mainnet",
    signatureScheme: scheme,
    schemeLabel: SCHEME_LABELS[scheme] ?? scheme,
    inputType,
    confidence,
    curveParams: curve,
    recoveryEquations: equations,
    explorerBase,
    apiNote,
    reuseRisk,
  };
}

// Check if a string looks like a Substrate SS58 address
// SS58 = base58 encoded [version_byte || 32-byte pubkey || 2-byte checksum]
// Polkadot: version=0 → starts with "1"
// Kusama: version=2 → starts with "C","D","E","F","G","H"
// Generic Substrate: other prefixes
function isSS58(s: string): boolean {
  if (!/^[1-9A-HJ-NP-Za-km-z]{46,50}$/.test(s)) return false;
  // Polkadot mainnet addresses start with "1"
  if (s.startsWith("1")) return true;
  // Kusama starts with C-H range
  if (/^[C-H]/.test(s) && s.length >= 47) return true;
  // Substrate generic: many prefixes, length ~48
  return false;
}

function guessSubstrateChain(addr: string): { chain: string; label: string } {
  if (addr.startsWith("1")) return { chain: "polkadot", label: "Polkadot" };
  if (/^[C-H]/.test(addr)) return { chain: "kusama", label: "Kusama" };
  return { chain: "polkadot", label: "Polkadot / Substrate" };
}

export function getScanPlan(chain: ChainInfo): string {
  const steps: string[] = [];

  if (chain.inputType === "txHash") {
    steps.push(`1. Resolve signer / account from ${chain.chain} transaction hash`);
  }

  switch (chain.signatureScheme) {
    case "secp256k1-ecdsa":
    case "p256-ecdsa":
      steps.push("2. Fetch all transactions for the resolved address via blockchain API");
      steps.push("3. Extract (r, s, z) from each ECDSA signature");
      steps.push("4. Group signatures by shared r value — shared r = same nonce k used");
      steps.push("5. For each matching pair: recover k = (z1−z2)·(s1−s2)⁻¹ mod n");
      steps.push("6. Recover private key: a = (s1·k − z1)·r⁻¹ mod n");
      steps.push(`   Curve order n = 0x${chain.curveParams.order.slice(0, 16)}…`);
      break;
    case "ed25519":
      steps.push("2. Fetch all transactions for the resolved address via blockchain API");
      steps.push("3. Extract 64-byte Ed25519 signatures: R = bytes[0..31], S = bytes[32..63]");
      steps.push("4. Group signatures by shared R (nonce point on Ed25519 curve)");
      steps.push("5. For each pair: compute H1 = H(R‖A‖M1), H2 = H(R‖A‖M2) mod l");
      steps.push("6. Recover private scalar: a = (S1−S2)·(H1−H2)⁻¹ mod l");
      steps.push(`   Group order l = 2²⁵² + 27742317777372353535851937790883648493`);
      break;
    case "sr25519-schnorr":
      steps.push("2. Fetch extrinsics from Subscan API (multi-page: before and after anchor)");
      steps.push("3. Extract 64-byte Sr25519 signatures: R = bytes[0..31], s = bytes[32..63]");
      steps.push("4. Group by shared R (Ristretto255 nonce point)");
      steps.push("5. For each pair: compute c1 = H(R‖pub‖M1), c2 = H(R‖pub‖M2) mod l");
      steps.push("6. Recover private key: x = (s1−s2)·(c1−c2)⁻¹ mod l");
      steps.push(`   Ristretto255 order l = ${chain.curveParams.order.slice(0, 16)}…`);
      break;
    case "clsag":
      steps.push("2. Fetch anchor transaction → determine block height");
      steps.push("3. Scan ±15 surrounding blocks via XMRChain API + Monero daemon RPC");
      steps.push("4. Extract all key images I = x·H_p(P) from all transaction inputs");
      steps.push("5. Cross-reference: any duplicate key image = double-spend proven");
      steps.push("6. Check on-chain spend status for each key image via RPC");
      steps.push("   Note: blockchain prevents duplicate key images on canonical chain — finding one = fork or buggy implementation");
      break;
  }

  return steps.join("\n");
}
