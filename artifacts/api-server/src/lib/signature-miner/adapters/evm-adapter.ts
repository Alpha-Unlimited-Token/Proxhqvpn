// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * EVM Multi-Chain Adapter (secp256k1)
 * ════════════════════════════════════
 * Covers all Ethereum-compatible chains:
 *   Ethereum, Polygon, BNB Smart Chain, Arbitrum, Optimism,
 *   Avalanche C-Chain, Base, Fantom, Tron
 *
 * Each chain uses identical secp256k1 ECDSA and identical nonce-reuse math —
 * only the RPC endpoint and transaction format differ.
 *
 * Signature retrieval:
 *   Uses `eth_getTransactionByHash` + address transaction history via
 *   JSON-RPC `eth_getLogs` / public block explorer APIs as fallback.
 *   Tron uses the TronScan REST API since it has a custom RPC format.
 *
 * Nonce reuse detection:
 *   Full key recovery when z values are available from the raw tx hash.
 */

import { ethers } from "ethers";
import {
  type ChainAdapter, type ChainInfo, type SigRecord,
  type NonceReuseResult, detectNonceReuseSecp256k1, CHAINS, type ChainId,
} from "../chain-adapter";

const EVM_ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const TRON_ADDR_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

// ── EVM transaction signature extractor ──────────────────────────────────────
// Ethereum stores v/r/s in each raw transaction. We recover them via ethers.

interface EvmSigInfo {
  r:      string;  // 32 bytes hex, no 0x
  s:      string;  // 32 bytes hex, no 0x
  z:      string;  // transaction hash = message signed (no 0x)
  txHash: string;
  block:  number;
}

async function evmTxToSig(
  provider: ethers.JsonRpcProvider,
  txHash:   string,
): Promise<EvmSigInfo | null> {
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx?.signature) return null;
    const sig = tx.signature;

    // The message signed is the hash of the pre-image (EIP-155 or legacy)
    // We compute it by re-serialising the unsigned transaction
    const unsignedTx: ethers.TransactionLike = {
      to:       tx.to ?? undefined,
      nonce:    tx.nonce,
      gasLimit: tx.gasLimit,
      gasPrice: tx.gasPrice ?? undefined,
      data:     tx.data,
      value:    tx.value,
      chainId:  tx.chainId,
    };
    // Use accessList and maxFeePerGas for EIP-1559 txs
    if (tx.type === 2) {
      unsignedTx.maxFeePerGas        = tx.maxFeePerGas ?? undefined;
      unsignedTx.maxPriorityFeePerGas = tx.maxPriorityFeePerGas ?? undefined;
      unsignedTx.accessList          = tx.accessList;
    }
    const serialized = ethers.Transaction.from({ ...unsignedTx, type: tx.type }).unsignedHash;
    const z = serialized.replace(/^0x/, "").padStart(64, "0");

    const r = sig.r.replace(/^0x/, "").padStart(64, "0");
    const s = sig.s.replace(/^0x/, "").padStart(64, "0");

    const receipt = await provider.getTransactionReceipt(txHash);
    return { r, s, z, txHash, block: receipt?.blockNumber ?? 0 };
  } catch {
    return null;
  }
}

/**
 * Fetch transactions for an address via provider.getLogs + known tx hashes.
 * For public RPC nodes that don't support eth_getTransactionsByAddress,
 * we use a sliding block window scan (last 50 000 blocks, max 200 txs).
 */
async function fetchEvmSigs(
  provider: ethers.JsonRpcProvider,
  address:  string,
  maxTx = 80,
): Promise<SigRecord[]> {
  const records: SigRecord[] = [];
  try {
    const latest = await provider.getBlockNumber();
    const lookback = 50_000;
    const fromBlock = Math.max(0, latest - lookback);

    // Transfer events sent FROM address — each reveals a signature
    const filter: ethers.Filter = {
      fromBlock,
      toBlock:   latest,
      topics:    [
        ethers.id("Transfer(address,address,uint256)"),
        ethers.zeroPadValue(address.toLowerCase(), 32),
      ],
    };

    let txHashes: string[] = [];
    try {
      const logs = await provider.getLogs(filter);
      txHashes = [...new Set(logs.map(l => l.transactionHash))];
    } catch { /* getLogs not supported — skip */ }

    // Fetch raw transactions and extract signatures
    const toProcess = txHashes.slice(0, maxTx);
    await Promise.allSettled(
      toProcess.map(async txHash => {
        const info = await evmTxToSig(provider, txHash);
        if (info) {
          records.push({
            r: info.r, s: info.s, z: info.z,
            txHash: info.txHash, blockHeight: info.block,
          });
        }
      })
    );
  } catch { /* silently skip on RPC error */ }
  return records;
}

// ── Tron fetcher (REST-based, different from EVM JSON-RPC) ────────────────────

async function fetchTronSigs(address: string, maxTx = 80): Promise<SigRecord[]> {
  const records: SigRecord[] = [];
  try {
    const url = `https://apilist.tronscanapi.com/api/transaction?address=${address}&limit=${maxTx}&start=0`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const data: { data?: Array<{ hash: string; block: number }> } = await res.json();
    for (const tx of data.data ?? []) {
      // Fetch raw transaction hex
      const rawRes = await fetch(
        `https://api.trongrid.io/walletsolidity/gettransactionbyid?value=${tx.hash}`,
        { signal: AbortSignal.timeout(10_000) }
      ).catch(() => null);
      if (!rawRes?.ok) continue;
      const raw: { signature?: string[] } = await rawRes.json();
      for (let i = 0; i < (raw.signature?.length ?? 0); i++) {
        const sig65 = raw.signature![i]; // 65 bytes hex = r(32) + s(32) + v(1)
        if (sig65.length !== 130) continue;
        records.push({
          r:           sig65.slice(0, 64),
          s:           sig65.slice(64, 128),
          txHash:      tx.hash,
          blockHeight: tx.block,
          sigIndex:    i,
        });
      }
    }
  } catch { /* skip */ }
  return records;
}

// ── EVM ChainAdapter ──────────────────────────────────────────────────────────

export class EvmChainAdapter implements ChainAdapter {
  chain: ChainInfo;
  private provider?: ethers.JsonRpcProvider;

  constructor(chainId: ChainId) {
    this.chain = CHAINS[chainId];
    if (this.chain.rpcUrl) {
      this.provider = new ethers.JsonRpcProvider(this.chain.rpcUrl);
    }
  }

  matchesAddress(addr: string): boolean {
    if (this.chain.id === "tron") return TRON_ADDR_RE.test(addr.trim());
    return EVM_ADDR_RE.test(addr.trim());
  }

  async fetchSignatures(address: string, maxTx = 80): Promise<SigRecord[]> {
    if (this.chain.id === "tron") return fetchTronSigs(address, maxTx);
    if (!this.provider) return [];
    return fetchEvmSigs(this.provider, address, maxTx);
  }

  checkNonceReuse(address: string, sigs: SigRecord[]): NonceReuseResult[] {
    return detectNonceReuseSecp256k1(address, this.chain.id, sigs);
  }
}

// ── Singleton instances for each supported EVM chain ─────────────────────────

export const evmAdapters: Record<string, EvmChainAdapter> = {
  ethereum:          new EvmChainAdapter("ethereum"),
  polygon:           new EvmChainAdapter("polygon"),
  bsc:               new EvmChainAdapter("bsc"),
  arbitrum:          new EvmChainAdapter("arbitrum"),
  optimism:          new EvmChainAdapter("optimism"),
  avalanche:         new EvmChainAdapter("avalanche"),
  base:              new EvmChainAdapter("base"),
  fantom:            new EvmChainAdapter("fantom"),
  ethereum_classic:  new EvmChainAdapter("ethereum_classic"),
  tron:              new EvmChainAdapter("tron"),
};
