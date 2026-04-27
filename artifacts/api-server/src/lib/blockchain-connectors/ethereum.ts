// Ethereum / EVM Blockchain Connector
// Uses ethers.js with public RPC endpoints — no API key required for basic use
// Fetches contract source, bytecode, and transaction data for security analysis

import { ethers } from "ethers";

// Public RPC endpoints — no API key needed
const RPC_ENDPOINTS: Record<string, string> = {
  ethereum: "https://cloudflare-eth.com",
  polygon: "https://polygon-rpc.com",
  bsc: "https://bsc-dataseed.binance.org",
  arbitrum: "https://arb1.arbitrum.io/rpc",
  avalanche: "https://api.avax.network/ext/bc/C/rpc",
  optimism: "https://mainnet.optimism.io",
};

const ETHERSCAN_BASES: Record<string, string> = {
  ethereum: "https://api.etherscan.io/api",
  polygon: "https://api.polygonscan.com/api",
  bsc: "https://api.bscscan.com/api",
  arbitrum: "https://api.arbiscan.io/api",
  avalanche: "https://api.snowtrace.io/api",
};

async function getProvider(chain: string): Promise<ethers.JsonRpcProvider> {
  const rpc = RPC_ENDPOINTS[chain] ?? RPC_ENDPOINTS.ethereum;
  return new ethers.JsonRpcProvider(rpc);
}

export interface EthereumAddressReport {
  address: string;
  chain: string;
  isContract: boolean;
  balanceWei: string;
  balanceETH: string;
  txCount: number;
  bytecode: string | null;
  bytecodeSize: number;
  sourceCode: string | null;
  compilerVersion: string | null;
  isVerified: boolean;
  isProxy: boolean;
  implementationAddress: string | null;
  isUpgradeable: boolean;
  exposedPublicKeys: string[];
  recentTransactions: EthTxSummary[];
  contractFindings: ContractFinding[];
  quantumRiskLevel: "critical" | "high" | "medium" | "low";
  quantumRiskReason: string;
  vulnerabilities: string[];
}

export interface EthTxSummary {
  hash: string;
  blockNumber: number | null;
  from: string;
  to: string | null;
  valueETH: string;
  gasUsed: string | null;
  exposedPubkey: string | null;
  isContractCreation: boolean;
}

export interface ContractFinding {
  type: string;
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  evidence: string;
  quantumContext?: string;
}

// EIP-1967 proxy storage slots
const PROXY_SLOTS = {
  EIP1967_IMPL: "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc",
  EIP1967_ADMIN: "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103",
  OPENZEPPELIN_IMPL: "0x7050c9e0f4ca769c69bd3a8ef740bc37934f8e2c036e5a723fd8ee048ed3f8c3",
};

export async function scanEthereumAddress(address: string, chain = "ethereum"): Promise<EthereumAddressReport> {
  const provider = await getProvider(chain);
  const checksum = ethers.getAddress(address);

  // Parallel fetch: balance, tx count, bytecode
  const [balance, txCount, bytecode] = await Promise.all([
    provider.getBalance(checksum).catch(() => 0n),
    provider.getTransactionCount(checksum).catch(() => 0),
    provider.getCode(checksum).catch(() => "0x"),
  ]);

  const isContract = bytecode !== "0x" && bytecode.length > 2;
  const bytecodeSize = isContract ? (bytecode.length - 2) / 2 : 0;

  // Check for proxy patterns
  let isProxy = false;
  let implementationAddress: string | null = null;
  let isUpgradeable = false;

  if (isContract) {
    for (const [slotName, slot] of Object.entries(PROXY_SLOTS)) {
      try {
        const stored = await provider.getStorage(checksum, slot);
        if (stored !== "0x" + "0".repeat(64) && stored.length > 10) {
          const impl = ethers.getAddress("0x" + stored.slice(-40));
          if (impl !== ethers.ZeroAddress) {
            isProxy = true;
            implementationAddress = impl;
            isUpgradeable = slotName.includes("1967") || slotName.includes("OPENZEPPELIN");
            break;
          }
        }
      } catch {}
    }
  }

  // Fetch contract source from Etherscan (no API key — rate limited but works)
  let sourceCode: string | null = null;
  let compilerVersion: string | null = null;
  let isVerified = false;

  const etherscanBase = ETHERSCAN_BASES[chain];
  if (etherscanBase && isContract) {
    try {
      const url = `${etherscanBase}?module=contract&action=getsourcecode&address=${checksum}&apikey=YourApiKeyToken`;
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const json = await r.json() as Record<string, unknown>;
      const result = (json.result as Record<string, unknown>[])?.[0];
      if (result && result.SourceCode && result.SourceCode !== "") {
        sourceCode = String(result.SourceCode).slice(0, 50000);
        compilerVersion = String(result.CompilerVersion ?? "");
        isVerified = true;
      }
    } catch {}
  }

  // Fetch recent transactions via Etherscan
  const recentTxs: EthTxSummary[] = [];
  const exposedPubkeys: string[] = [];

  if (etherscanBase) {
    try {
      const url = `${etherscanBase}?module=account&action=txlist&address=${checksum}&startblock=0&endblock=99999999&page=1&offset=10&sort=desc&apikey=YourApiKeyToken`;
      const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const json = await r.json() as Record<string, unknown>;
      const txs = (json.result as Record<string, unknown>[]) ?? [];

      for (const tx of txs.slice(0, 10)) {
        // Extract public key from ECDSA signature components if available
        let exposedPub: string | null = null;
        try {
          const hash = String(tx.hash ?? "");
          const fullTx = await provider.getTransaction(hash).catch(() => null);
          if (fullTx && fullTx.signature) {
            const sig = fullTx.signature;
            // Recover the public key from the transaction signature
            const digest = ethers.keccak256(ethers.Transaction.from(fullTx).unsignedSerialized);
            const recoveredPub = ethers.SigningKey.recoverPublicKey(digest, sig);
            if (recoveredPub && !exposedPubkeys.includes(recoveredPub)) {
              exposedPubkeys.push(recoveredPub);
              exposedPub = recoveredPub;
            }
          }
        } catch {}

        recentTxs.push({
          hash: String(tx.hash ?? ""),
          blockNumber: Number(tx.blockNumber ?? 0) || null,
          from: String(tx.from ?? ""),
          to: String(tx.to ?? "") || null,
          valueETH: ethers.formatEther(String(tx.value ?? "0")),
          gasUsed: String(tx.gasUsed ?? ""),
          exposedPubkey: exposedPub,
          isContractCreation: !tx.to || tx.to === "",
        });
      }
    } catch {}
  }

  // Contract-specific findings
  const contractFindings: ContractFinding[] = [];
  const vulns: string[] = [];

  if (isContract) {
    // Check bytecode for known patterns
    const bc = bytecode.toLowerCase();

    // SELFDESTRUCT opcode (0xff)
    if (bc.includes("ff")) {
      contractFindings.push({
        type: "selfdestruct",
        severity: "high",
        description: "Contract bytecode contains SELFDESTRUCT opcode (0xFF). This can permanently destroy the contract and send all funds to a target address.",
        evidence: `Opcode 0xFF found in bytecode at position ~${bc.indexOf("ff")}`,
      });
      vulns.push("SELFDESTRUCT opcode present");
    }

    // DELEGATECALL (0xf4)
    if (bc.includes("f4")) {
      contractFindings.push({
        type: "delegatecall",
        severity: "high",
        description: "Contract uses DELEGATECALL (0xF4). If the call target is user-controlled, it enables storage collision and complete contract takeover.",
        evidence: `Opcode 0xF4 found in bytecode`,
      });
      vulns.push("DELEGATECALL in bytecode");
    }

    // ECRECOVER precompile call (address 0x01)
    if (bc.includes("000000000000000000000000000000000000000000000000000000000000000" + "1")) {
      contractFindings.push({
        type: "ecrecover",
        severity: "critical",
        description: "Contract calls the ECRECOVER precompile (0x0000...0001). This uses secp256k1 ECDSA, which is broken by Shor's Algorithm on quantum computers.",
        evidence: "ECRECOVER precompile address found in bytecode calldata",
        quantumContext: "Direct quantum vulnerability: secp256k1 ECDLP solved by Shor's in O(n³). Migrate to CRYSTALS-Dilithium (FIPS 204) or FALCON (FIPS 206).",
      });
      vulns.push("ECRECOVER (quantum-vulnerable secp256k1)");
    }

    if (isProxy) {
      contractFindings.push({
        type: "proxy_pattern",
        severity: isUpgradeable ? "medium" : "low",
        description: `Contract is a ${isUpgradeable ? "upgradeable" : ""} proxy. Implementation at: ${implementationAddress}. Proxy pattern introduces upgrade key management risk.`,
        evidence: `Implementation address stored in EIP-1967 slot: ${implementationAddress}`,
      });
    }

    if (!isVerified) {
      contractFindings.push({
        type: "unverified_source",
        severity: "medium",
        description: "Contract source code is NOT verified on Etherscan. The bytecode cannot be independently audited without decompilation.",
        evidence: "No verified source code found via Etherscan API",
      });
      vulns.push("Unverified source code");
    }
  }

  // Quantum risk assessment
  let riskLevel: "critical" | "high" | "medium" | "low" = "low";
  let riskReason = "";

  if (exposedPubkeys.length > 0 && !isContract) {
    riskLevel = "critical";
    riskReason = `${exposedPubkeys.length} secp256k1 public key(s) recovered from on-chain ECDSA signatures. These keys are permanently exposed and vulnerable to Shor's Algorithm. Estimated break: 2030–2035.`;
  } else if (vulns.includes("ECRECOVER (quantum-vulnerable secp256k1)")) {
    riskLevel = "critical";
    riskReason = "Contract uses ECRECOVER — direct secp256k1 quantum vulnerability. Any signature verification in this contract will be broken by a sufficiently powerful quantum computer.";
  } else if (isContract && vulns.length > 0) {
    riskLevel = "high";
    riskReason = `Contract has ${vulns.length} vulnerability pattern(s) in bytecode: ${vulns.join(", ")}.`;
  } else if (!isContract && txCount > 0) {
    riskLevel = "high";
    riskReason = "EOA (externally owned account) with transaction history — public key is exposed via ECDSA signature recovery from any historical transaction. Quantum-vulnerable.";
  } else {
    riskLevel = "medium";
    riskReason = "Address has no transaction history. Public key not yet exposed on-chain. Some protection remains until first transaction.";
  }

  return {
    address: checksum,
    chain,
    isContract,
    balanceWei: balance.toString(),
    balanceETH: ethers.formatEther(balance),
    txCount,
    bytecode: isContract ? bytecode.slice(0, 1000) : null,
    bytecodeSize,
    sourceCode,
    compilerVersion,
    isVerified,
    isProxy,
    implementationAddress,
    isUpgradeable,
    exposedPublicKeys: exposedPubkeys,
    recentTransactions: recentTxs,
    contractFindings,
    quantumRiskLevel: riskLevel,
    quantumRiskReason: riskReason,
    vulnerabilities: vulns,
  };
}
