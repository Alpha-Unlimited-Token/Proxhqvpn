// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Node Cracker Routes
 * ===================
 * POST /api/node-cracker/scan         — crack a single RPC endpoint directly
 * POST /api/node-cracker/wallet-scan  — full pipeline: wallet → counterparties → node discovery → crack all
 * GET  /api/node-cracker/ping         — health check
 */

import { Router, type Request, type Response } from "express";
import { crackNode }                 from "../lib/node-cracker/node-cracker";
import { runWalletNodePipeline }     from "../lib/node-cracker/wallet-node-pipeline";
import { logger }                    from "../lib/logger";

const router = Router();

// ── GET /api/node-cracker/ping ───────────────────────────────────────────────
router.get("/ping", (_req: Request, res: Response) => {
  res.json({ ok: true, service: "node-cracker", chains: ["evm", "solana", "bitcoin"] });
});

// ── POST /api/node-cracker/scan ──────────────────────────────────────────────
// Crack a single RPC endpoint directly.
// Body: { endpoint: string }
router.post("/scan", async (req: Request, res: Response) => {
  const endpoint = String(req.body?.endpoint ?? "").trim();
  if (!endpoint) {
    res.status(400).json({ error: "endpoint is required (e.g. https://my-node.example.com:8545)" });
    return;
  }
  try {
    new URL(endpoint);
  } catch {
    res.status(400).json({ error: "endpoint is not a valid URL" });
    return;
  }

  req.log?.info({ endpoint }, "Node Cracker: single scan requested");
  try {
    const result = await crackNode(endpoint);
    res.json(result);
  } catch (err: any) {
    logger.error({ endpoint, err: err?.message }, "Node Cracker: scan failed");
    res.status(500).json({ error: "Scan failed", detail: err?.message ?? "Unknown error" });
  }
});

// ── POST /api/node-cracker/wallet-scan ───────────────────────────────────────
// Full pipeline: wallet address → counterparty extraction → node registry
// cross-reference → crack all discovered nodes.
// Body: {
//   address:        string     — wallet address (any chain, auto-detected)
//   maxNodes?:      number     — max nodes to crack (default 8)
//   extraEndpoints?: string[] — additional RPC endpoints to always crack
//   solanaRpc?:     string     — custom Solana RPC (default mainnet-beta)
// }
router.post("/wallet-scan", async (req: Request, res: Response) => {
  const address = String(req.body?.address ?? "").trim();
  if (!address) {
    res.status(400).json({ error: "address is required" });
    return;
  }

  const maxNodes       = Math.min(Number(req.body?.maxNodes ?? 8), 20);
  const extraEndpoints = Array.isArray(req.body?.extraEndpoints)
    ? (req.body.extraEndpoints as unknown[]).map(String).slice(0, 10)
    : [];
  const solanaRpc = String(req.body?.solanaRpc ?? "https://api.mainnet-beta.solana.com");

  req.log?.info({ address, maxNodes, extraEndpoints }, "Node Cracker: wallet pipeline requested");

  try {
    const result = await runWalletNodePipeline(address, { maxNodes, extraEndpoints, solanaRpc });
    res.json(result);
  } catch (err: any) {
    logger.error({ address, err: err?.message }, "Node Cracker: wallet pipeline failed");
    res.status(500).json({ error: "Pipeline failed", detail: err?.message ?? "Unknown error" });
  }
});

export default router;
