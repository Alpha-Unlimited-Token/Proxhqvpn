/**
 * Wallet Intelligence Routes
 * ==========================
 * API endpoints for the 2026 attack-vector audit suite:
 *   POST /api/wallet-intel/permit-scan      — EIP-2612 permit & approval exploit scanner
 *   POST /api/wallet-intel/poisoning-scan   — Address poisoning / vanity lookalike detector
 *   POST /api/wallet-intel/approval-scan    — Active token approval risk auditor
 */

import { Router, type Request, type Response } from "express";
import { scanPermitExploits }    from "../lib/wallet-intel/permit-scanner";
import { detectAddressPoisoning } from "../lib/wallet-intel/address-poisoning";
import { scanTokenApprovals }    from "../lib/wallet-intel/approval-scanner";
import { logger } from "../lib/logger";

const router = Router();

const SUPPORTED_CHAINS = ["ethereum", "polygon", "bsc", "arbitrum", "optimism"];

function validateAddress(address: unknown): string | null {
  if (typeof address !== "string") return null;
  const trimmed = address.trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

function validateChain(chain: unknown): string {
  if (typeof chain === "string" && SUPPORTED_CHAINS.includes(chain.toLowerCase())) {
    return chain.toLowerCase();
  }
  return "ethereum";
}

// POST /api/wallet-intel/permit-scan
// Body: { address: string, chain?: string }
router.post("/permit-scan", async (req: Request, res: Response) => {
  const address = validateAddress(req.body?.address);
  if (!address) {
    res.status(400).json({ error: "Invalid or missing Ethereum address (0x…40 hex chars required)" });
    return;
  }
  const chain = validateChain(req.body?.chain);
  req.log?.info({ address, chain }, "permit-scan requested");

  try {
    const result = await scanPermitExploits(address, chain);
    res.json(result);
  } catch (err) {
    logger.error({ err, address, chain }, "permit-scan failed");
    res.status(500).json({ error: "Permit scan failed", detail: String(err) });
  }
});

// POST /api/wallet-intel/poisoning-scan
// Body: { address: string, chain?: string }
router.post("/poisoning-scan", async (req: Request, res: Response) => {
  const address = validateAddress(req.body?.address);
  if (!address) {
    res.status(400).json({ error: "Invalid or missing Ethereum address (0x…40 hex chars required)" });
    return;
  }
  const chain = validateChain(req.body?.chain);
  req.log?.info({ address, chain }, "poisoning-scan requested");

  try {
    const result = await detectAddressPoisoning(address, chain);
    res.json(result);
  } catch (err) {
    logger.error({ err, address, chain }, "poisoning-scan failed");
    res.status(500).json({ error: "Poisoning scan failed", detail: String(err) });
  }
});

// POST /api/wallet-intel/approval-scan
// Body: { address: string, chain?: string }
router.post("/approval-scan", async (req: Request, res: Response) => {
  const address = validateAddress(req.body?.address);
  if (!address) {
    res.status(400).json({ error: "Invalid or missing Ethereum address (0x…40 hex chars required)" });
    return;
  }
  const chain = validateChain(req.body?.chain);
  req.log?.info({ address, chain }, "approval-scan requested");

  try {
    const result = await scanTokenApprovals(address, chain);
    res.json(result);
  } catch (err) {
    logger.error({ err, address, chain }, "approval-scan failed");
    res.status(500).json({ error: "Approval scan failed", detail: String(err) });
  }
});

export default router;
