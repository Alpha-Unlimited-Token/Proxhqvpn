import { scanBitcoinAddress, type BitcoinAddressReport } from "./bitcoin";
import { scanEthereumAddress, type EthereumAddressReport } from "./ethereum";
import { scanSolanaAddress, type SolanaAddressReport } from "./solana";
import { scanMoneroNetwork, type MoneroNetworkReport } from "./monero";

export type ChainScanResult =
  | { chain: "bitcoin"; data: BitcoinAddressReport }
  | { chain: "ethereum" | "polygon" | "bsc" | "arbitrum" | "avalanche"; data: EthereumAddressReport }
  | { chain: "solana"; data: SolanaAddressReport }
  | { chain: "monero"; data: MoneroNetworkReport };

export async function scanBlockchainAddress(
  chain: string,
  address?: string
): Promise<ChainScanResult> {
  switch (chain) {
    case "bitcoin":
      if (!address) throw new Error("Bitcoin address required");
      return { chain: "bitcoin", data: await scanBitcoinAddress(address) };

    case "ethereum":
    case "polygon":
    case "bsc":
    case "arbitrum":
    case "avalanche":
      if (!address) throw new Error("EVM address required");
      return { chain, data: await scanEthereumAddress(address, chain) } as ChainScanResult;

    case "solana":
      if (!address) throw new Error("Solana address required");
      return { chain: "solana", data: await scanSolanaAddress(address) };

    case "monero":
      // Monero: scans network + node, no single address (privacy by design)
      return { chain: "monero", data: await scanMoneroNetwork() };

    default:
      throw new Error(`Unsupported chain: ${chain}`);
  }
}

export type { BitcoinAddressReport, EthereumAddressReport, SolanaAddressReport, MoneroNetworkReport };
