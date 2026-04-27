import type { AnalysisFinding } from "./solidity-analyzer";

// ─── Bitcoin Script Analyzer ──────────────────────────────────────────────────

const BITCOIN_PATTERNS: Array<{
  pattern: RegExp;
  title: string;
  description: string;
  severity: AnalysisFinding["severity"];
  category: AnalysisFinding["category"];
  isQuantumRelated: boolean;
  cweId: string;
  cvssScore: number;
  recommendation: string;
  references: string[];
}> = [
  {
    pattern: /OP_CHECKSIG|OP_CHECKMULTISIG/g,
    title: "OP_CHECKSIG/OP_CHECKMULTISIG — ECDSA secp256k1 Quantum Vulnerability",
    description: "Bitcoin Script's OP_CHECKSIG and OP_CHECKMULTISIG opcodes verify ECDSA signatures over secp256k1. This elliptic curve is fully vulnerable to Shor's algorithm. Any address that has ever broadcast a transaction (exposing its public key in scriptSig) is permanently at risk once a 4,000+ logical qubit quantum computer is available.",
    severity: "critical",
    category: "elliptic_curve",
    isQuantumRelated: true,
    cweId: "CWE-327",
    cvssScore: 9.8,
    recommendation: "Plan migration to Taproot (P2TR) outputs and monitor Bitcoin's post-quantum upgrade proposals (e.g. BIP-360 and NIST PQC standards). Implement address rotation: use each address exactly once and migrate funds to fresh addresses regularly.",
    references: [
      "https://en.bitcoin.it/wiki/Secp256k1",
      "https://github.com/bitcoin/bips/blob/master/bip-0341.mediawiki",
    ],
  },
  {
    pattern: /OP_RETURN/g,
    title: "OP_RETURN — Unspendable Output Data",
    description: "OP_RETURN creates provably unspendable outputs used for embedding data on-chain. While not a vulnerability itself, data embedded via OP_RETURN is permanently public and immutable. Sensitive data (keys, identifiers, PII) embedded this way can never be removed.",
    severity: "informational",
    category: "other",
    isQuantumRelated: false,
    cweId: "CWE-312",
    cvssScore: 3.0,
    recommendation: "Never embed sensitive data, private keys, or PII in OP_RETURN outputs. Consider off-chain storage with on-chain content hashes for data integrity verification.",
    references: ["https://en.bitcoin.it/wiki/OP_RETURN"],
  },
  {
    pattern: /OP_IF|OP_NOTIF/g,
    title: "Conditional Script Logic",
    description: "Script contains OP_IF/OP_NOTIF conditional branches. Complex branching logic in Bitcoin Script is difficult to audit and has historically contained subtle vulnerabilities around branch prediction and stack management.",
    severity: "low",
    category: "logic_error",
    isQuantumRelated: false,
    cweId: "CWE-670",
    cvssScore: 3.5,
    recommendation: "Thoroughly test all script branches. Use script simulators (e.g. btcdeb) to trace execution paths. Prefer well-audited standard script templates (P2PKH, P2WPKH, P2SH-multisig) over custom Script logic.",
    references: ["https://en.bitcoin.it/wiki/Script"],
  },
  {
    pattern: /OP_CHECKLOCKTIMEVERIFY|OP_CHECKSEQUENCEVERIFY|CLTV|CSV/g,
    title: "Timelock Opcode — Quantum Attack Window",
    description: "CHECKLOCKTIMEVERIFY (CLTV) and CHECKSEQUENCEVERIFY (CSV) introduce time-based spending conditions. During the timelock period, the redeem script is visible on-chain. A quantum adversary could use this window to attempt preimage attacks or signature forgery before the timelock expires.",
    severity: "medium",
    category: "timestamp_dependence",
    isQuantumRelated: true,
    cweId: "CWE-362",
    cvssScore: 5.5,
    recommendation: "Use longer timelocks that exceed the estimated quantum attack window (currently several decades, but this window narrows rapidly). Monitor quantum computing progress and adjust timelock durations accordingly.",
    references: ["https://github.com/bitcoin/bips/blob/master/bip-0065.mediawiki"],
  },
  {
    pattern: /OP_HASH160|OP_SHA256|OP_HASH256/g,
    title: "Hash Opcodes — Grover's Algorithm Exposure",
    description: "OP_HASH160 (RIPEMD-160 of SHA-256) provides only 80-bit post-quantum security with Grover's algorithm. OP_SHA256 provides 128-bit post-quantum security. While still considered computationally infeasible today, long-lived scripts and HTLCs using these hash functions face increasing quantum risk over time.",
    severity: "medium",
    category: "hash_collision",
    isQuantumRelated: true,
    cweId: "CWE-916",
    cvssScore: 5.9,
    recommendation: "For new HTLC constructions, prefer OP_SHA256 over OP_HASH160. Monitor Bitcoin Improvement Proposals for post-quantum hash function opcodes. Future scripts should be designed with quantum-resistant hash commitments.",
    references: ["https://en.bitcoin.it/wiki/Script#Crypto"],
  },
  {
    pattern: /P2PK|pay.to.public.key/gi,
    title: "Pay-to-Public-Key (P2PK) Output — Direct Quantum Exposure",
    description: "P2PK outputs embed the full uncompressed or compressed public key directly in the scriptPubKey, permanently exposing it on-chain. This is immediately vulnerable to Shor's algorithm — no transaction is needed to expose the public key, unlike P2PKH addresses.",
    severity: "critical",
    category: "elliptic_curve",
    isQuantumRelated: true,
    cweId: "CWE-327",
    cvssScore: 9.9,
    recommendation: "Migrate all P2PK funds to P2WPKH (Bech32) addresses immediately. P2WPKH only exposes the public key hash (HASH160) until spending, providing one additional layer of quantum protection. Never create new P2PK outputs.",
    references: ["https://en.bitcoin.it/wiki/Pay_to_Public_Key"],
  },
];

// ─── Generic EVM/Protocol Analyzer ───────────────────────────────────────────

const GENERIC_EVM_PATTERNS: Array<{
  pattern: RegExp;
  title: string;
  description: string;
  severity: AnalysisFinding["severity"];
  category: AnalysisFinding["category"];
  isQuantumRelated: boolean;
  cweId: string;
  cvssScore: number;
  recommendation: string;
  references: string[];
}> = [
  {
    pattern: /DELEGATECALL|delegatecall/g,
    title: "DELEGATECALL Opcode — Proxy Storage Collision",
    description: "DELEGATECALL executes code from another contract in the context of the calling contract's storage. Mismatched storage layouts between proxy and implementation can silently corrupt critical variables including ownership records and balance mappings.",
    severity: "high",
    category: "logic_error",
    isQuantumRelated: false,
    cweId: "CWE-829",
    cvssScore: 8.2,
    recommendation: "Use EIP-1967 standardized storage slots for all proxy patterns. Never store implementation-specific state at slot 0 in proxy contracts. Use OpenZeppelin's TransparentUpgradeableProxy or UUPS patterns.",
    references: ["https://eips.ethereum.org/EIPS/eip-1967"],
  },
  {
    pattern: /SELFDESTRUCT|SUICIDE/gi,
    title: "SELFDESTRUCT Opcode Present",
    description: "The bytecode or source contains SELFDESTRUCT. This opcode permanently destroys the contract and forwards ETH to a specified address. It can be used to force-send ETH to contracts that reject ETH, breaking assumptions in downstream contracts.",
    severity: "high",
    category: "access_control",
    isQuantumRelated: false,
    cweId: "CWE-284",
    cvssScore: 8.5,
    recommendation: "Remove or strictly gate SELFDESTRUCT behind multi-sig access control. Note that EIP-6049 deprecates SELFDESTRUCT and future EVM versions may change its behavior.",
    references: ["https://eips.ethereum.org/EIPS/eip-6049"],
  },
  {
    pattern: /CREATE2/g,
    title: "CREATE2 — Deterministic Deployment Risk",
    description: "CREATE2 allows deploying contracts to pre-computable addresses. If the salt is user-controlled, attackers can front-run deployments or pre-deploy malicious contracts at addresses that users expect to be empty.",
    severity: "medium",
    category: "front_running",
    isQuantumRelated: false,
    cweId: "CWE-362",
    cvssScore: 6.0,
    recommendation: "Use non-predictable salts (include msg.sender and a nonce). Validate deployed contract bytecode before trusting a CREATE2 address.",
    references: ["https://eips.ethereum.org/EIPS/eip-1014"],
  },
  {
    pattern: /ECDSA|ecrecover|secp256k1/gi,
    title: "ECDSA/secp256k1 Cryptography — Quantum Critical",
    description: "The codebase uses ECDSA signature verification over secp256k1. Shor's algorithm can break this in O(n³) time on a quantum computer with approximately 4,000 logical qubits, enabling private key recovery from any exposed public key or signature.",
    severity: "critical",
    category: "elliptic_curve",
    isQuantumRelated: true,
    cweId: "CWE-327",
    cvssScore: 9.5,
    recommendation: "Plan migration to post-quantum signature schemes (CRYSTALS-Dilithium, SPHINCS+). Use EIP-4337 account abstraction to create upgradeable signature validation contracts that can be switched to PQC schemes without moving funds.",
    references: [
      "https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.204.pdf",
      "https://eips.ethereum.org/EIPS/eip-4337",
    ],
  },
  {
    pattern: /SHA256|KECCAK256|keccak256|sha256/g,
    title: "Hash Functions — Grover's Algorithm Reduces Security",
    description: "SHA-256 and Keccak-256 provide 128-bit post-quantum security (halved from classical 256-bit) against Grover's algorithm. Commitment schemes, Merkle tree roots, and proof systems built on these hashes have reduced long-term quantum resistance.",
    severity: "medium",
    category: "hash_collision",
    isQuantumRelated: true,
    cweId: "CWE-916",
    cvssScore: 5.5,
    recommendation: "For critical long-lived commitments: use SHA-512 or SHAKE-256 with 512-bit output. Document the post-quantum security margin of all hash-based proof systems.",
    references: ["https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.202.pdf"],
  },
];

function scanWithPatterns(
  code: string,
  patterns: typeof BITCOIN_PATTERNS | typeof GENERIC_EVM_PATTERNS
): AnalysisFinding[] {
  const findings: AnalysisFinding[] = [];
  const lines = code.split("\n");

  for (const p of patterns) {
    const regex = new RegExp(p.pattern.source, "gi");
    let matched = false;

    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        matched = true;
        const snippet = lines.slice(Math.max(0, i - 2), Math.min(lines.length, i + 4))
          .join("\n").trim().substring(0, 300);
        findings.push({
          title: p.title,
          description: p.description,
          severity: p.severity,
          category: p.category,
          isQuantumRelated: p.isQuantumRelated,
          cweId: p.cweId,
          cvssScore: p.cvssScore,
          affectedCode: snippet,
          lineNumber: i + 1,
          recommendation: p.recommendation,
          references: p.references,
        });
        break; // one finding per pattern
      }
      regex.lastIndex = 0;
    }
  }

  return findings;
}

export function analyzeBitcoinScript(code: string): {
  findings: AnalysisFinding[];
  lineCount: number;
} {
  return {
    findings: scanWithPatterns(code, BITCOIN_PATTERNS),
    lineCount: code.split("\n").length,
  };
}

export function analyzeGenericEvm(code: string): {
  findings: AnalysisFinding[];
  lineCount: number;
} {
  return {
    findings: scanWithPatterns(code, GENERIC_EVM_PATTERNS),
    lineCount: code.split("\n").length,
  };
}

// ─── Protocol-level analyzer (consensus / cryptography scan types) ────────────

export function analyzeProtocol(code: string, chain: string): {
  findings: AnalysisFinding[];
  lineCount: number;
} {
  const allFindings: AnalysisFinding[] = [];

  // Always add chain-specific quantum assessment
  const chainQuantumFindings: Record<string, AnalysisFinding[]> = {
    ethereum: [
      {
        title: "Ethereum Consensus — BLS12-381 Validator Signature Quantum Risk",
        description: "Ethereum's Proof-of-Stake consensus uses BLS12-381 pairing-based signatures for validator attestations. Quantum algorithms targeting discrete logarithms over pairing-friendly curves can break BLS aggregate signatures, potentially allowing signature forgery for validator attestations and threatening finality.",
        severity: "high",
        category: "elliptic_curve",
        isQuantumRelated: true,
        cweId: "CWE-327",
        cvssScore: 8.5,
        affectedCode: null,
        lineNumber: null,
        recommendation: "Monitor NIST PQC standardization for pairing-friendly curve alternatives. Ethereum Foundation's post-quantum research tracks hybrid BLS + lattice-based signature schemes for validators.",
        references: ["https://ethresear.ch/t/how-to-hard-fork-to-save-most-users-funds-in-a-quantum-emergency/18901"],
      },
    ],
    solana: [
      {
        title: "Solana Tower BFT — Ed25519 Consensus Vote Signatures",
        description: "Solana's Tower BFT consensus requires validators to sign votes with Ed25519. This elliptic curve signature scheme is quantum-vulnerable via Shor's algorithm. A quantum-capable adversary could forge validator votes, threatening network consensus integrity.",
        severity: "high",
        category: "elliptic_curve",
        isQuantumRelated: true,
        cweId: "CWE-327",
        cvssScore: 8.5,
        affectedCode: null,
        lineNumber: null,
        recommendation: "Monitor Solana Foundation's post-quantum migration roadmap. Plan for hybrid signature schemes combining Ed25519 with CRYSTALS-Dilithium for validator identity.",
        references: ["https://docs.solana.com/proposals/tower-bft"],
      },
    ],
  };

  if (chainQuantumFindings[chain]) {
    allFindings.push(...chainQuantumFindings[chain]);
  }

  // Also scan provided code
  allFindings.push(...scanWithPatterns(code, GENERIC_EVM_PATTERNS));

  return {
    findings: allFindings,
    lineCount: code.split("\n").length,
  };
}
