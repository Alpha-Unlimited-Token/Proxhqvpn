// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Solana Blockchain Connector
// Uses @solana/web3.js with public RPC — no API key required
// Scans programs for upgrade authority, account structure, and security patterns

import {
  Connection, PublicKey, LAMPORTS_PER_SOL,
  BpfLoader, SystemProgram
} from "@solana/web3.js";

const PUBLIC_RPCS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-api.projectserum.com",
];

export interface SolanaAddressReport {
  address: string;
  chain: "solana";
  isProgram: boolean;
  isSystemProgram: boolean;
  balanceLamports: number;
  balanceSOL: string;
  owner: string;
  executable: boolean;
  dataSize: number;
  rentEpoch: number | null;
  upgradeAuthority: string | null;
  isUpgradeable: boolean;
  isFrozen: boolean;
  programDataAccount: string | null;
  recentSignatures: SolanaSignature[];
  quantumRiskLevel: "critical" | "high" | "medium" | "low";
  quantumRiskReason: string;
  findings: SolanaFinding[];
  rawData: Record<string, unknown>;
}

export interface SolanaSignature {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: string | null;
  memo: string | null;
}

export interface SolanaFinding {
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  evidence: string;
  quantumContext?: string;
}

// Known dangerous program IDs
const KNOWN_PROGRAMS: Record<string, string> = {
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA": "SPL Token Program",
  "11111111111111111111111111111111": "System Program",
  "BPFLoaderUpgradeab1e11111111111111111111111": "BPF Upgradeable Loader",
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJe1bRS": "Associated Token Account Program",
  "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s": "Metaplex Token Metadata",
};

const BPF_UPGRADEABLE_LOADER = new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111");

export async function scanSolanaAddress(address: string): Promise<SolanaAddressReport> {
  const connection = new Connection(PUBLIC_RPCS[0], {
    commitment: "confirmed",
    httpHeaders: { "User-Agent": "QuantumAudit/1.0" },
  });

  let pubkey: PublicKey;
  try {
    pubkey = new PublicKey(address);
  } catch {
    throw new Error(`Invalid Solana address: ${address}`);
  }

  const accountInfo = await connection.getAccountInfo(pubkey, "confirmed");
  if (!accountInfo) {
    return {
      address,
      chain: "solana",
      isProgram: false,
      isSystemProgram: false,
      balanceLamports: 0,
      balanceSOL: "0",
      owner: "unknown",
      executable: false,
      dataSize: 0,
      rentEpoch: null,
      upgradeAuthority: null,
      isUpgradeable: false,
      isFrozen: false,
      programDataAccount: null,
      recentSignatures: [],
      quantumRiskLevel: "low",
      quantumRiskReason: "Account not found on Solana mainnet.",
      findings: [],
      rawData: {},
    };
  }

  const owner = accountInfo.owner.toBase58();
  const executable = accountInfo.executable;
  const dataSize = accountInfo.data.length;
  const balanceLamports = accountInfo.lamports;

  const isProgram = executable;
  const isSystemProgram = owner === "11111111111111111111111111111111";
  const isUpgradeableLoader = owner === BPF_UPGRADEABLE_LOADER.toBase58();

  // For upgradeable programs, find the program data account and upgrade authority
  let upgradeAuthority: string | null = null;
  let programDataAccount: string | null = null;
  let isFrozen = false;
  let isUpgradeable = false;

  if (isUpgradeableLoader && isProgram) {
    try {
      // The program account data contains a pointer to the ProgramData account
      // Layout: 4 bytes tag (0x02000000) + 32 bytes ProgramData pubkey
      if (accountInfo.data.length >= 36) {
        const tag = accountInfo.data.readUInt32LE(0);
        if (tag === 2) { // Program account tag
          const pdaPubkey = new PublicKey(accountInfo.data.slice(4, 36));
          programDataAccount = pdaPubkey.toBase58();

          const pdaInfo = await connection.getAccountInfo(pdaPubkey, "confirmed");
          if (pdaInfo && pdaInfo.data.length >= 45) {
            // ProgramData layout: 4 bytes tag + 8 bytes slot + 1 byte option + 32 bytes authority
            const authOption = pdaInfo.data[12]; // option byte
            if (authOption === 1) {
              const authorityPubkey = new PublicKey(pdaInfo.data.slice(13, 45));
              upgradeAuthority = authorityPubkey.toBase58();
              isUpgradeable = true;
            } else {
              isFrozen = true; // No upgrade authority = immutable
            }
          }
        }
      }
    } catch (e) {
      // Ignore parse errors for non-standard programs
    }
  }

  // Fetch recent transaction signatures
  const sigInfos = await connection.getSignaturesForAddress(pubkey, { limit: 10 }).catch(() => []);
  const recentSignatures: SolanaSignature[] = sigInfos.map(s => ({
    signature: s.signature,
    slot: s.slot,
    blockTime: s.blockTime ?? null,
    err: s.err ? JSON.stringify(s.err) : null,
    memo: s.memo ?? null,
  }));

  // Build findings
  const findings: SolanaFinding[] = [];

  if (isUpgradeable && upgradeAuthority) {
    findings.push({
      type: "upgradeable_program",
      severity: "high",
      description: `Program is upgradeable. Upgrade authority: ${upgradeAuthority}. The authority key can replace program logic at any time — full centralization risk and potential backdoor.`,
      evidence: `Upgrade authority pubkey: ${upgradeAuthority} | ProgramData: ${programDataAccount}`,
      quantumContext: "Upgrade authority key is a secp256k1/Ed25519 keypair. Ed25519 is broken by Shor's Algorithm. A quantum attacker who recovers the authority's private key can replace the program with malicious code.",
    });
  }

  if (!isFrozen && !isUpgradeable && isProgram) {
    findings.push({
      type: "unknown_mutability",
      severity: "medium",
      description: "Unable to determine if program is frozen or upgradeable. Manual verification of BPF loader type recommended.",
      evidence: `Owner: ${owner} | Executable: ${executable}`,
    });
  }

  if (isFrozen) {
    findings.push({
      type: "immutable_program",
      severity: "low",
      description: "Program is immutable (no upgrade authority). Cannot be modified — reduces centralization risk but also means no security patches possible.",
      evidence: "No upgrade authority set in ProgramData account",
    });
  }

  const knownName = KNOWN_PROGRAMS[address];
  if (knownName) {
    findings.push({
      type: "known_program",
      severity: "low",
      description: `This is the known Solana program: ${knownName}. Ensure you are auditing the correct program ID.`,
      evidence: `Address matches known program: ${knownName}`,
    });
  }

  // Ed25519 quantum finding — all Solana accounts use Ed25519
  findings.push({
    type: "ed25519_quantum_risk",
    severity: "critical",
    description: "All Solana accounts and programs use Ed25519 signatures over Curve25519. Ed25519 ECDLP is broken by Shor's Algorithm on a fault-tolerant quantum computer.",
    evidence: "Solana network-wide: Ed25519 signing scheme used for all transactions and program authorities",
    quantumContext: "Estimated break window: 2030–2035. Migration path: Solana Labs must implement a post-quantum signature scheme at the protocol level. No individual contract fix is possible — this is a network-level vulnerability.",
  });

  // Determine quantum risk
  let riskLevel: "critical" | "high" | "medium" | "low" = "medium";
  let riskReason = "";

  if (isUpgradeable && upgradeAuthority) {
    riskLevel = "critical";
    riskReason = `Upgradeable program with exposed upgrade authority (${upgradeAuthority}). Quantum recovery of the authority's Ed25519 private key enables complete program replacement with malicious logic — all user funds at risk.`;
  } else if (isFrozen) {
    riskLevel = "medium";
    riskReason = "Immutable program — no upgrade authority risk. However, Ed25519 signature scheme used for all Solana transactions is quantum-vulnerable (Shor's Algorithm, 2030–2035).";
  } else {
    riskLevel = "high";
    riskReason = "Solana program with Ed25519-based ownership. All Solana accounts are quantum-vulnerable to Shor's Algorithm targeting the Ed25519 discrete log problem.";
  }

  return {
    address,
    chain: "solana",
    isProgram,
    isSystemProgram,
    balanceLamports,
    balanceSOL: (balanceLamports / LAMPORTS_PER_SOL).toFixed(9),
    owner,
    executable,
    dataSize,
    rentEpoch: null,
    upgradeAuthority,
    isUpgradeable,
    isFrozen,
    programDataAccount,
    recentSignatures,
    quantumRiskLevel: riskLevel,
    quantumRiskReason: riskReason,
    findings,
    rawData: { owner, executable, dataSize, balanceLamports, knownName: knownName ?? null },
  };
}
