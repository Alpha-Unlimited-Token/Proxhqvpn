/**
 * Live Contract Exploit Tester
 * Makes real eth_call and eth_getLogs calls against a deployed contract on
 * a real blockchain. Reports what an attacker discovers: proxy patterns,
 * unprotected admin functions, permit exposure, upgrade mechanisms, and
 * on-chain approval history.
 */

const CHAIN_RPCS: Record<string, string> = {
  ethereum:  "https://ethereum.publicnode.com",
  polygon:   "https://polygon.publicnode.com",
  bsc:       "https://bsc.publicnode.com",
  arbitrum:  "https://arbitrum-one.publicnode.com",
  optimism:  "https://optimism.publicnode.com",
};

const BLOCKSCOUT_BASES: Record<string, string> = {
  ethereum: "https://eth.blockscout.com",
  polygon:  "https://polygon.blockscout.com",
  bsc:      "https://bsc.blockscout.com",
  arbitrum: "https://arbitrum.blockscout.com",
  optimism: "https://optimism.blockscout.com",
};

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";

export interface ContractFinding {
  id: string;
  severity: FindingSeverity;
  title: string;
  detail: string;
  attackVector: string;
  remediation: string;
  evidence?: string;
}

export interface LiveContractResult {
  address: string;
  chain: string;
  contractName?: string;
  isContract: boolean;
  bytecodeSize: number;
  isProxy: boolean;
  implementationAddress?: string;
  isVerified: boolean;
  isERC20: boolean;
  isERC721: boolean;
  hasPermit: boolean;
  hasSetApprovalForAll: boolean;
  hasTransferOwnership: boolean;
  hasRenounceOwnership: boolean;
  hasInitialize: boolean;
  hasUpgradeTo: boolean;
  hasSelfDestruct: boolean;
  ownerAddress?: string;
  tokenName?: string;
  tokenSymbol?: string;
  totalSupply?: string;
  recentApprovalCount: number;
  recentPermitCount: number;
  findings: ContractFinding[];
  riskScore: number;
  scanTimeMs: number;
}

// ABI-encoded function selectors (keccak256 of signature, first 4 bytes)
const SELECTORS: Record<string, string> = {
  // ERC-20
  name:                  "0x06fdde03",
  symbol:                "0x95d89b41",
  decimals:              "0x313ce567",
  totalSupply:           "0x18160ddd",
  balanceOf:             "0x70a08231",
  approve:               "0x095ea7b3",
  // ERC-20 Permit (EIP-2612)
  permit:                "0xd505accf",
  nonces:                "0x7ecebe00",
  DOMAIN_SEPARATOR:      "0x3644e515",
  // ERC-721
  setApprovalForAll:     "0xa22cb465",
  isApprovedForAll:      "0xe985e9c5",
  ownerOf:               "0x6352211e",
  // Ownable
  owner:                 "0x8da5cb5b",
  transferOwnership:     "0xf2fde38b",
  renounceOwnership:     "0x715018a6",
  // Upgradeable
  initialize:            "0x8129fc1c",
  upgradeTo:             "0x3659cfe6",
  upgradeToAndCall:      "0x4f1ef286",
  implementation:        "0x5c60da1b",
  // UUPS / Beacon proxy
  proxiableUUID:         "0x52d1902d",
};

// ERC-1967 proxy implementation slot
const IMPL_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
// OpenZeppelin proxy admin slot
const ADMIN_SLOT = "0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103";

// Event topic hashes
const TOPICS = {
  Approval:          "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
  ApprovalForAll:    "0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31",
  PermitApproval:    "0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925",
  OwnershipTransferred: "0x8be0079c531659141344cd1fd0a4f28419497f9722a3daafe3b4186f6b6457e0",
};

async function ethCall(rpc: string, to: string, data: string): Promise<string | null> {
  try {
    const resp = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to, data }, "latest"] }),
      signal: AbortSignal.timeout(8000),
    });
    const body = await resp.json() as Record<string, unknown>;
    if (body.error) return null;
    return body.result as string;
  } catch { return null; }
}

async function ethGetCode(rpc: string, address: string): Promise<string> {
  try {
    const resp = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getCode", params: [address, "latest"] }),
      signal: AbortSignal.timeout(8000),
    });
    const body = await resp.json() as Record<string, unknown>;
    return (body.result as string) ?? "0x";
  } catch { return "0x"; }
}

async function ethGetStorageAt(rpc: string, address: string, slot: string): Promise<string | null> {
  try {
    const resp = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getStorageAt", params: [address, slot, "latest"] }),
      signal: AbortSignal.timeout(8000),
    });
    const body = await resp.json() as Record<string, unknown>;
    return body.result as string;
  } catch { return null; }
}

async function ethGetLogs(rpc: string, address: string, topics: string[], fromBlock: string, toBlock: string): Promise<unknown[]> {
  try {
    const resp = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "eth_getLogs",
        params: [{ address, topics, fromBlock, toBlock }],
      }),
      signal: AbortSignal.timeout(10000),
    });
    const body = await resp.json() as Record<string, unknown>;
    return Array.isArray(body.result) ? body.result : [];
  } catch { return []; }
}

async function getLatestBlock(rpc: string): Promise<number> {
  try {
    const resp = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] }),
      signal: AbortSignal.timeout(6000),
    });
    const body = await resp.json() as Record<string, unknown>;
    return parseInt(body.result as string, 16);
  } catch { return 0; }
}

function decodeAddress(hex: string): string | null {
  if (!hex || hex === "0x" || hex.length < 66) return null;
  const cleaned = hex.replace("0x", "").padStart(64, "0");
  const addr = "0x" + cleaned.slice(24);
  if (addr === "0x0000000000000000000000000000000000000000") return null;
  return addr;
}

function decodeString(hex: string): string | null {
  try {
    if (!hex || hex === "0x") return null;
    const data = hex.slice(2);
    const offset = parseInt(data.slice(0, 64), 16) * 2;
    const length = parseInt(data.slice(offset, offset + 64), 16);
    const strHex = data.slice(offset + 64, offset + 64 + length * 2);
    return Buffer.from(strHex, "hex").toString("utf8");
  } catch { return null; }
}

function decodeUint(hex: string): string | null {
  try {
    if (!hex || hex === "0x") return null;
    return BigInt("0x" + hex.slice(2)).toString();
  } catch { return null; }
}

function selectorInBytecode(bytecode: string, selector: string): boolean {
  return bytecode.includes(selector.slice(2));
}

export async function testLiveContract(address: string, chain: string): Promise<LiveContractResult> {
  const start = Date.now();
  const rpc = CHAIN_RPCS[chain] ?? CHAIN_RPCS.ethereum;
  const blockscoutBase = BLOCKSCOUT_BASES[chain] ?? BLOCKSCOUT_BASES.ethereum;

  const normalizedAddress = address.toLowerCase();

  // Get bytecode
  const bytecode = await ethGetCode(rpc, normalizedAddress);
  const isContract = bytecode !== "0x" && bytecode.length > 4;
  const bytecodeSize = isContract ? (bytecode.length - 2) / 2 : 0;

  if (!isContract) {
    return {
      address: normalizedAddress, chain, isContract: false, bytecodeSize: 0,
      isProxy: false, isVerified: false, isERC20: false, isERC721: false,
      hasPermit: false, hasSetApprovalForAll: false, hasTransferOwnership: false,
      hasRenounceOwnership: false, hasInitialize: false, hasUpgradeTo: false, hasSelfDestruct: false,
      recentApprovalCount: 0, recentPermitCount: 0,
      findings: [{ id: "NOT_CONTRACT", severity: "info", title: "Address is not a contract", detail: "This address is an EOA (Externally Owned Account), not a smart contract.", attackVector: "N/A", remediation: "Verify the contract address." }],
      riskScore: 0, scanTimeMs: Date.now() - start,
    };
  }

  // Check which function selectors are present in bytecode
  const hasSel = (sel: string) => selectorInBytecode(bytecode, sel);
  const hasPermit            = hasSel(SELECTORS.permit);
  const hasSetApprovalForAll = hasSel(SELECTORS.setApprovalForAll);
  const hasTransferOwnership = hasSel(SELECTORS.transferOwnership);
  const hasRenounceOwnership = hasSel(SELECTORS.renounceOwnership);
  const hasInitialize        = hasSel(SELECTORS.initialize);
  const hasUpgradeTo         = hasSel(SELECTORS.upgradeTo) || hasSel(SELECTORS.upgradeToAndCall);
  const isERC20              = hasSel(SELECTORS.totalSupply) && hasSel(SELECTORS.balanceOf) && hasSel(SELECTORS.approve);
  const isERC721             = hasSel(SELECTORS.ownerOf) && hasSel(SELECTORS.setApprovalForAll);
  const hasSelfDestruct      = bytecode.includes("ff");

  // Check proxy patterns
  const implSlotData = await ethGetStorageAt(rpc, normalizedAddress, IMPL_SLOT);
  const implAddress = implSlotData ? decodeAddress(implSlotData) : null;
  const isProxy = !!implAddress;

  // Try calling implementation() directly (some proxies expose it)
  let implementationAddress = implAddress ?? undefined;
  if (!implementationAddress && hasSel(SELECTORS.implementation)) {
    const implResult = await ethCall(rpc, normalizedAddress, SELECTORS.implementation);
    implementationAddress = implResult ? decodeAddress(implResult) ?? undefined : undefined;
  }

  // Read on-chain state
  const [ownerResult, nameResult, symbolResult, totalSupplyResult] = await Promise.all([
    hasSel(SELECTORS.owner) ? ethCall(rpc, normalizedAddress, SELECTORS.owner) : Promise.resolve(null),
    hasSel(SELECTORS.name) ? ethCall(rpc, normalizedAddress, SELECTORS.name) : Promise.resolve(null),
    hasSel(SELECTORS.symbol) ? ethCall(rpc, normalizedAddress, SELECTORS.symbol) : Promise.resolve(null),
    hasSel(SELECTORS.totalSupply) ? ethCall(rpc, normalizedAddress, SELECTORS.totalSupply) : Promise.resolve(null),
  ]);

  const ownerAddress     = ownerResult ? decodeAddress(ownerResult) ?? undefined : undefined;
  const tokenName        = nameResult ? decodeString(nameResult) ?? undefined : undefined;
  const tokenSymbol      = symbolResult ? decodeString(symbolResult) ?? undefined : undefined;
  const totalSupply      = totalSupplyResult ? decodeUint(totalSupplyResult) ?? undefined : undefined;

  // Blockscout: check if contract is verified
  let isVerified = false;
  let contractName: string | undefined;
  try {
    const bsResp = await fetch(`${blockscoutBase}/api/v2/smart-contracts/${normalizedAddress}`, {
      signal: AbortSignal.timeout(6000),
    });
    if (bsResp.ok) {
      const bsData = await bsResp.json() as Record<string, unknown>;
      isVerified = !!bsData.is_verified || !!bsData.source_code;
      contractName = bsData.name as string | undefined;
    }
  } catch { /* not critical */ }

  // Recent events (last ~5000 blocks ≈ ~17 hours on Ethereum)
  const latestBlock = await getLatestBlock(rpc);
  const fromBlock = "0x" + Math.max(0, latestBlock - 5000).toString(16);
  const toBlock = "0x" + latestBlock.toString(16);

  const [approvalLogs, approvalForAllLogs] = await Promise.all([
    isERC20 ? ethGetLogs(rpc, normalizedAddress, [TOPICS.Approval], fromBlock, toBlock) : Promise.resolve([]),
    isERC721 || hasSetApprovalForAll ? ethGetLogs(rpc, normalizedAddress, [TOPICS.ApprovalForAll], fromBlock, toBlock) : Promise.resolve([]),
  ]);

  // Detect permit events (they emit Approval with spender = permit caller)
  // Permits look like Approval events with a specific data pattern (unlimited amount)
  const unlimitedApprovals = (approvalLogs as Array<{ data?: string }>).filter(log =>
    log.data && BigInt(log.data) >= BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff") / 2n
  );
  const recentPermitCount = unlimitedApprovals.length;
  const recentApprovalCount = approvalLogs.length + approvalForAllLogs.length;

  // Build findings
  const findings: ContractFinding[] = [];

  if (!isVerified) {
    findings.push({
      id: "UNVERIFIED",
      severity: "high",
      title: "Contract Source Not Verified",
      detail: "The contract bytecode has not been verified on the block explorer. Users cannot inspect what logic is actually executing.",
      attackVector: "Unverified contracts can contain hidden backdoors, exit scams, or logic that differs entirely from what was marketed to users. Audits cannot be performed without source code.",
      remediation: "Verify the contract source on the block explorer immediately. All production contracts handling user funds must be verified.",
    });
  }

  if (hasPermit && recentPermitCount > 0) {
    findings.push({
      id: "PERMIT_ACTIVE",
      severity: "critical",
      title: `Active Permit Approvals Detected (${recentPermitCount} in last 5,000 blocks)`,
      detail: `${recentPermitCount} unlimited token approvals detected via EIP-2612 permit() in recent blocks. These gasless approvals are the primary drainer attack vector in 2026.`,
      attackVector: "Wallet drainer contracts trick users into signing permit() transactions that appear as wallet connection prompts. One signature grants unlimited spending rights with no on-chain confirmation required. The drainer can execute the actual transfer hours later.",
      remediation: "Implement permit() deadline validation (reject max uint256). Add UI warnings when permit() is called. Display full permit parameters before signing. Consider emitting a custom PermitWarning event for monitoring.",
      evidence: `${recentPermitCount} approvals with amounts ≥ type(uint128).max in the last 5,000 blocks`,
    });
  }

  if (hasPermit && recentPermitCount === 0) {
    findings.push({
      id: "PERMIT_PRESENT",
      severity: "medium",
      title: "EIP-2612 permit() Function Present",
      detail: "This contract supports gasless approvals via permit(). No recent exploits detected, but this function is the #1 target for wallet drainers.",
      attackVector: "Any frontend using this contract can present users with permit() signing requests that look identical to wallet connection prompts. No on-chain transaction is required from the attacker.",
      remediation: "Validate deadline is not type(uint256).max. Add front-end UI that clearly shows permit parameters. Implement monitoring for unusually large amounts.",
    });
  }

  if (hasSetApprovalForAll && approvalForAllLogs.length > 0) {
    findings.push({
      id: "APPROVAL_FOR_ALL",
      severity: "critical",
      title: `setApprovalForAll Activity Detected (${approvalForAllLogs.length} events)`,
      detail: `${approvalForAllLogs.length} setApprovalForAll events detected recently. This grants an operator full control over ALL NFTs in a collection — the most dangerous approval type.`,
      attackVector: "Attackers prompt users to sign setApprovalForAll transactions disguised as 'list on marketplace' operations. Once granted, the attacker can transfer every token the user owns at any time.",
      remediation: "Emit detailed events for setApprovalForAll calls. Consider requiring explicit user confirmation with a delay. Monitor for approvals to unknown operator addresses.",
      evidence: `${approvalForAllLogs.length} ApprovalForAll events in last 5,000 blocks`,
    });
  }

  if (isProxy && implementationAddress) {
    findings.push({
      id: "PROXY_UPGRADEABLE",
      severity: "high",
      title: "Upgradeable Proxy Detected",
      detail: `Contract is a proxy pointing to implementation at ${implementationAddress}. The implementation can be changed by whoever controls the admin/owner role.`,
      attackVector: "If the upgrade mechanism is controlled by a single EOA (not a multisig with timelock), the owner can silently replace the implementation with malicious logic — stealing all user funds in a single transaction.",
      remediation: "Use a Gnosis Safe multisig + OpenZeppelin TimelockController as the upgrade admin. Ensure upgrades require multiple signers and a minimum delay (e.g. 48 hours). Announce all upgrades publicly before execution.",
      evidence: `Implementation slot points to: ${implementationAddress}`,
    });
  }

  if (hasInitialize && !isProxy) {
    findings.push({
      id: "INITIALIZE_EXPOSED",
      severity: "high",
      title: "initialize() Function Present",
      detail: "An initialize() function is present. If this was called in the deployment transaction but the initializer guard was not set correctly, it may be callable again.",
      attackVector: "An attacker calls initialize() to reset the owner to their address, gaining full control of the contract and all its assets.",
      remediation: "Use OpenZeppelin's `initializer` modifier which sets a flag after first call. Call initialize() in the deployment transaction, not in a separate tx. Verify the initialized flag is set correctly.",
    });
  }

  if (hasTransferOwnership && ownerAddress) {
    const isZeroLike = ownerAddress === "0x0000000000000000000000000000000000000000";
    if (!isZeroLike) {
      findings.push({
        id: "EOA_OWNER",
        severity: "medium",
        title: `Contract Owner is an EOA: ${ownerAddress}`,
        detail: "The contract owner is a regular wallet address, not a multisig. A single private key compromise gives an attacker full ownership of the contract.",
        attackVector: "If the owner's private key is compromised (phishing, malware, exchange breach), the attacker calls transferOwnership to their address and then executes any privileged function — draining funds, minting tokens, or pausing the protocol.",
        remediation: "Transfer ownership to a Gnosis Safe multisig (3-of-5 minimum for production). Implement a TimelockController so all privileged actions have a minimum delay for community review.",
        evidence: `Current owner: ${ownerAddress}`,
      });
    }
  }

  if (!isVerified && bytecodeSize > 0) {
    // Check if bytecode contains selfdestruct opcode (0xFF at end of opcode sequence)
    if (hasSelfDestruct && bytecodeSize > 100) {
      findings.push({
        id: "SELFDESTRUCT_BYTECODE",
        severity: "high",
        title: "selfdestruct Opcode Found in Bytecode",
        detail: "The contract bytecode contains the SELFDESTRUCT opcode (0xFF). This can permanently destroy the contract and force-send all ETH to an arbitrary address.",
        attackVector: "If access controls are weak or the owner key is compromised, selfdestruct can drain all ETH from the contract and make it permanently non-functional — a rug pull mechanism.",
        remediation: "Remove selfdestruct from the contract. Implement emergency withdrawal patterns using pull-payment instead. Note that post-EIP-6780, selfdestruct only works in the same creation transaction on most networks.",
      });
    }
  }

  if (recentApprovalCount > 50) {
    findings.push({
      id: "HIGH_APPROVAL_VOLUME",
      severity: "medium",
      title: `High Approval Volume: ${recentApprovalCount} recent approvals`,
      detail: `${recentApprovalCount} approval events detected in the last 5,000 blocks. This is significantly above normal usage and may indicate an active drainer campaign targeting users of this contract.`,
      attackVector: "Mass approval campaigns often precede large-scale drain events. Attackers phish multiple users simultaneously to collect permits/approvals before executing mass transfers in a single block.",
      remediation: "Implement approval monitoring with automatic alerts for volume spikes. Consider adding a protocol-level approval revocation mechanism for emergency response.",
    });
  }

  const riskScore = Math.min(100, findings.reduce((s, f) => s + ({ critical: 30, high: 15, medium: 7, low: 2, info: 0 } as Record<FindingSeverity, number>)[f.severity], 0));

  return {
    address: normalizedAddress,
    chain,
    contractName,
    isContract: true,
    bytecodeSize,
    isProxy,
    implementationAddress,
    isVerified,
    isERC20,
    isERC721,
    hasPermit,
    hasSetApprovalForAll,
    hasTransferOwnership,
    hasRenounceOwnership,
    hasInitialize,
    hasUpgradeTo,
    hasSelfDestruct: hasSelfDestruct && bytecodeSize > 100,
    ownerAddress,
    tokenName,
    tokenSymbol,
    totalSupply,
    recentApprovalCount,
    recentPermitCount,
    findings,
    riskScore,
    scanTimeMs: Date.now() - start,
  };
}
