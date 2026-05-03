// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Wallet Intelligence Routes — Multi-Chain
 * ==========================================
 * API endpoints for the 2026 attack-vector audit suite.
 * Automatically detects chain from address format — no chain param required.
 *
 *   POST /api/wallet-intel/permit-scan      — EIP-2612 / SPL delegate / BTC script vuln scanner
 *   POST /api/wallet-intel/poisoning-scan   — Address lookalike / dust-attack detector (all chains)
 *   POST /api/wallet-intel/approval-scan    — Token approval / UTXO risk auditor (all chains)
 *   POST /api/wallet-intel/sig-scan         — Signature pattern scanner (BTC / Solana / EVM)
 *
 * Supported chains:
 *   EVM:   ethereum, polygon, bsc, arbitrum, optimism, base, avalanche
 *   UTXO:  bitcoin, litecoin, dogecoin, bitcoincash
 *   Other: solana
 */

import { Router, type Request, type Response } from "express";
import { detectAddress, isEvmChain, isUtxoChain } from "../lib/wallet-intel/chain-detect";

// EVM scanners (existing)
import { scanPermitExploits }    from "../lib/wallet-intel/permit-scanner";
import { detectAddressPoisoning } from "../lib/wallet-intel/address-poisoning";
import { scanTokenApprovals }    from "../lib/wallet-intel/approval-scanner";

// Bitcoin / UTXO scanners
import {
  scanBitcoinScripts,
  detectBitcoinPoisoning,
  scanUtxoRisks,
  scanBitcoinSignatures,
} from "../lib/wallet-intel/bitcoin-scanner";

// Solana scanners
import {
  scanSolanaAuthorities,
  detectSolanaPoisoning,
  scanSolanaTokenRisks,
} from "../lib/wallet-intel/solana-scanner";

import { logger } from "../lib/logger";

const router = Router();

const EVM_CHAINS = ["ethereum", "polygon", "bsc", "arbitrum", "optimism", "base", "avalanche", "fantom"];

function resolveEvmChain(body: any, detected: string): string {
  const requested = (body?.chain ?? "").toLowerCase();
  if (EVM_CHAINS.includes(requested)) return requested;
  return detected === "ethereum" ? "ethereum" : detected;
}

// ── POST /api/wallet-intel/permit-scan ────────────────────────────────────────
// Covers: EIP-2612 permit abuse (EVM) | SPL delegate authority (Solana) | Script vulnerabilities (Bitcoin/UTXO)
router.post("/permit-scan", async (req: Request, res: Response) => {
  const raw = String(req.body?.address ?? "").trim();
  if (!raw) { res.status(400).json({ error: "address is required" }); return; }

  const info = detectAddress(raw);
  if (!info.valid) {
    res.status(400).json({ error: `Unrecognized address format: ${info.reason ?? "unknown"}`, address: raw });
    return;
  }

  req.log?.info({ address: info.address, chain: info.chain, family: info.family }, "permit-scan requested");

  try {
    if (info.family === "solana") {
      const result = await scanSolanaAuthorities(info.address);
      res.json({ ...result, scanType: "solana-authority-scan" });
      return;
    }

    if (isUtxoChain(info.chain)) {
      const result = await scanBitcoinScripts(info.address, info.chain);
      res.json({ ...result, scanType: "utxo-script-scan" });
      return;
    }

    // EVM
    const chain = resolveEvmChain(req.body, info.chain);
    const result = await scanPermitExploits(info.address, chain);
    res.json({ ...result, scanType: "evm-permit-scan" });
  } catch (err) {
    logger.error({ err, address: raw }, "permit-scan failed");
    res.status(500).json({ error: "Scan failed", detail: String(err) });
  }
});

// ── POST /api/wallet-intel/poisoning-scan ─────────────────────────────────────
// Covers: address lookalike + dust attacks on ALL chains
router.post("/poisoning-scan", async (req: Request, res: Response) => {
  const raw = String(req.body?.address ?? "").trim();
  if (!raw) { res.status(400).json({ error: "address is required" }); return; }

  const info = detectAddress(raw);
  if (!info.valid) {
    res.status(400).json({ error: `Unrecognized address format: ${info.reason ?? "unknown"}`, address: raw });
    return;
  }

  req.log?.info({ address: info.address, chain: info.chain, family: info.family }, "poisoning-scan requested");

  try {
    if (info.family === "solana") {
      const result = await detectSolanaPoisoning(info.address);
      res.json({ ...result, scanType: "solana-poisoning-scan" });
      return;
    }

    if (isUtxoChain(info.chain)) {
      const result = await detectBitcoinPoisoning(info.address, info.chain);
      res.json({ ...result, scanType: "utxo-poisoning-scan" });
      return;
    }

    // EVM
    const chain = resolveEvmChain(req.body, info.chain);
    const result = await detectAddressPoisoning(info.address, chain);
    res.json({ ...result, scanType: "evm-poisoning-scan" });
  } catch (err) {
    logger.error({ err, address: raw }, "poisoning-scan failed");
    res.status(500).json({ error: "Scan failed", detail: String(err) });
  }
});

// ── POST /api/wallet-intel/approval-scan ─────────────────────────────────────
// Covers: ERC-20/721 approvals (EVM) | SPL token account risks (Solana) | UTXO risk (Bitcoin/UTXO)
router.post("/approval-scan", async (req: Request, res: Response) => {
  const raw = String(req.body?.address ?? "").trim();
  if (!raw) { res.status(400).json({ error: "address is required" }); return; }

  const info = detectAddress(raw);
  if (!info.valid) {
    res.status(400).json({ error: `Unrecognized address format: ${info.reason ?? "unknown"}`, address: raw });
    return;
  }

  req.log?.info({ address: info.address, chain: info.chain, family: info.family }, "approval-scan requested");

  try {
    if (info.family === "solana") {
      const result = await scanSolanaTokenRisks(info.address);
      res.json({ ...result, scanType: "solana-token-risk-scan" });
      return;
    }

    if (isUtxoChain(info.chain)) {
      const result = await scanUtxoRisks(info.address, info.chain);
      res.json({ ...result, scanType: "utxo-risk-scan" });
      return;
    }

    // EVM
    const chain = resolveEvmChain(req.body, info.chain);
    const result = await scanTokenApprovals(info.address, chain);
    res.json({ ...result, scanType: "evm-approval-scan" });
  } catch (err) {
    logger.error({ err, address: raw }, "approval-scan failed");
    res.status(500).json({ error: "Scan failed", detail: String(err) });
  }
});

// ── POST /api/wallet-intel/sig-scan ───────────────────────────────────────────
// Signature vulnerability scanner — ECDSA nonce/r-value pattern analysis
// Detects vulnerability indicators WITHOUT performing key recovery
router.post("/sig-scan", async (req: Request, res: Response) => {
  const raw = String(req.body?.address ?? "").trim();
  if (!raw) { res.status(400).json({ error: "address is required" }); return; }

  const info = detectAddress(raw);
  if (!info.valid) {
    res.status(400).json({ error: `Unrecognized address format: ${info.reason ?? "unknown"}`, address: raw });
    return;
  }

  req.log?.info({ address: info.address, chain: info.chain }, "sig-scan requested");

  try {
    if (info.family === "solana") {
      res.json({
        address:      info.address,
        chain:        "solana",
        scanType:     "solana-sig-scan",
        supported:    false,
        note:         "Solana uses Ed25519 signatures which use deterministic nonces by design. ECDSA nonce-reuse attacks do not apply. No signature vulnerability scanning needed.",
        riskScore:    0,
        summary:      "Ed25519 is not vulnerable to nonce-reuse attacks. No scan required.",
        durationMs:   0,
      });
      return;
    }

    if (isUtxoChain(info.chain)) {
      const result = await scanBitcoinSignatures(info.address, info.chain);
      res.json({ ...result, scanType: "utxo-sig-scan" });
      return;
    }

    // EVM — redirect to the existing wallet-tx scan endpoint note
    res.json({
      address:   info.address,
      chain:     info.chain,
      scanType:  "evm-sig-scan",
      supported: true,
      note:      "For full EVM signature scan (r/s/v nonce-reuse analysis across all historical transactions), use POST /api/wallet/scan-job which runs a deep background scan.",
      riskScore: 0,
      summary:   "Use /api/wallet/scan-job for full EVM signature analysis.",
      durationMs: 0,
    });
  } catch (err) {
    logger.error({ err, address: raw }, "sig-scan failed");
    res.status(500).json({ error: "Scan failed", detail: String(err) });
  }
});

// ── GET /api/wallet-intel/chains ──────────────────────────────────────────────
// Returns the list of all supported chains and address formats
router.get("/chains", (_req: Request, res: Response) => {
  res.json({
    supported: [
      { family: "evm",         chains: EVM_CHAINS,              example: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", scans: ["permit", "poisoning", "approval"] },
      { family: "bitcoin",     chains: ["bitcoin"],              example: "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa",       scans: ["script", "poisoning", "utxo", "sig"] },
      { family: "litecoin",    chains: ["litecoin"],             example: "LaMT349PWRnnjYR1b4UFqiT3hW5MBazo9e",        scans: ["script", "poisoning", "utxo", "sig"] },
      { family: "dogecoin",    chains: ["dogecoin"],             example: "D8vFez4p1GmRFRWvF9G2cFMsRCsVFNFBFF",        scans: ["script", "poisoning", "utxo", "sig"] },
      { family: "bitcoincash", chains: ["bitcoincash"],          example: "bitcoincash:qp3wjpa3tjlj042z2wv7hahsldgwhwy0rq9sywjpyy", scans: ["script", "poisoning", "utxo"] },
      { family: "solana",      chains: ["solana"],               example: "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM", scans: ["authority", "poisoning", "token-risk"] },
    ],
    autoDetect: true,
    note: "Pass any address to any scan endpoint — chain is detected automatically from address format.",
  });
});

export default router;
