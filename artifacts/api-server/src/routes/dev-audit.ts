/**
 * Developer External Audit Routes
 * ================================
 * Real external scanning endpoints — no simulators, no mocked data.
 *
 *   POST /api/dev-audit/rpc-probe        — probe a live JSON-RPC endpoint
 *   POST /api/dev-audit/headers-check    — scan HTTP security headers on a live URL
 *   POST /api/dev-audit/contract-test    — test a deployed contract on-chain
 *   POST /api/dev-audit/key-entropy      — audit key generation entropy from real addresses
 *   POST /api/dev-audit/contract-source  — static analysis of Solidity source code
 */

import { Router, type Request, type Response } from "express";
import { probeRpcEndpoint }    from "../lib/dev-audit/rpc-prober";
import { checkSecurityHeaders } from "../lib/dev-audit/headers-checker";
import { testLiveContract }    from "../lib/dev-audit/live-contract-tester";
import { auditKeyEntropy }     from "../lib/dev-audit/key-entropy-auditor";
import { scanContractSource }  from "../lib/dev-audit/contract-scanner";
import { runRpcAttackSuite }   from "../lib/dev-audit/rpc-attack-suite";
import { logger }              from "../lib/logger";

const router = Router();

const SUPPORTED_CHAINS = ["ethereum", "polygon", "bsc", "arbitrum", "optimism"];

// POST /api/dev-audit/rpc-probe
router.post("/rpc-probe", async (req: Request, res: Response) => {
  const { endpoint } = req.body as Record<string, unknown>;
  if (typeof endpoint !== "string" || !endpoint.trim()) {
    return res.status(400).json({ error: "endpoint (string) is required" });
  }
  let parsed: URL;
  try {
    parsed = new URL(endpoint.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad protocol");
  } catch {
    return res.status(400).json({ error: "endpoint must be a valid http:// or https:// URL" });
  }
  // Block private/loopback ranges for external scanning
  const host = parsed.hostname.toLowerCase();
  const isInternal = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  if (isInternal) {
    return res.status(400).json({ error: "Cannot probe internal/loopback addresses. The tool scans external endpoints only." });
  }
  try {
    const result = await probeRpcEndpoint(endpoint.trim());
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "rpc-probe error");
    return res.status(500).json({ error: "Probe failed — check the endpoint URL and ensure it is publicly accessible" });
  }
});

// POST /api/dev-audit/headers-check
router.post("/headers-check", async (req: Request, res: Response) => {
  const { url } = req.body as Record<string, unknown>;
  if (typeof url !== "string" || !url.trim()) {
    return res.status(400).json({ error: "url (string) is required" });
  }
  let normalized = url.trim();
  if (!normalized.startsWith("http://") && !normalized.startsWith("https://")) {
    normalized = "https://" + normalized;
  }
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return res.status(400).json({ error: "url must be a valid URL" });
  }
  const host = parsed.hostname.toLowerCase();
  const isInternal = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  if (isInternal) {
    return res.status(400).json({ error: "Cannot scan internal/loopback addresses. Provide a publicly accessible URL." });
  }
  try {
    const result = await checkSecurityHeaders(normalized);
    return res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "headers-check error");
    if (msg.includes("fetch failed") || msg.includes("ENOTFOUND") || msg.includes("ECONNREFUSED")) {
      return res.status(422).json({ error: `Could not reach ${normalized} — ensure the URL is publicly accessible` });
    }
    return res.status(500).json({ error: "Headers scan failed" });
  }
});

// POST /api/dev-audit/contract-test
router.post("/contract-test", async (req: Request, res: Response) => {
  const { address, chain } = req.body as Record<string, unknown>;
  if (typeof address !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(address.trim())) {
    return res.status(400).json({ error: "address must be a valid 0x-prefixed Ethereum address" });
  }
  const resolvedChain = typeof chain === "string" && SUPPORTED_CHAINS.includes(chain.toLowerCase())
    ? chain.toLowerCase()
    : "ethereum";
  try {
    const result = await testLiveContract(address.trim(), resolvedChain);
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "contract-test error");
    return res.status(500).json({ error: "Contract test failed — check the address and chain" });
  }
});

// POST /api/dev-audit/key-entropy
router.post("/key-entropy", async (req: Request, res: Response) => {
  const { addresses } = req.body as Record<string, unknown>;
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return res.status(400).json({ error: "addresses must be a non-empty array of Ethereum addresses" });
  }
  if (addresses.length > 500) {
    return res.status(400).json({ error: "Maximum 500 addresses per audit request" });
  }
  const stringAddresses = addresses.filter((a): a is string => typeof a === "string");
  try {
    const result = auditKeyEntropy(stringAddresses);
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "key-entropy error");
    return res.status(500).json({ error: "Entropy audit failed" });
  }
});

// POST /api/dev-audit/contract-source
router.post("/contract-source", async (req: Request, res: Response) => {
  const { source } = req.body as Record<string, unknown>;
  if (typeof source !== "string" || source.trim().length < 10) {
    return res.status(400).json({ error: "source must be a non-empty Solidity source string" });
  }
  if (source.length > 500_000) {
    return res.status(400).json({ error: "Source too large — maximum 500KB" });
  }
  try {
    const result = scanContractSource(source);
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "contract-source error");
    return res.status(500).json({ error: "Source analysis failed" });
  }
});

// POST /api/dev-audit/rpc-attack
// Full hacker-technique RPC attack suite:
//   batch amplification, cache probing, namespace enumeration, parameter fuzzing
router.post("/rpc-attack", async (req: Request, res: Response) => {
  const { endpoint } = req.body as Record<string, unknown>;
  if (typeof endpoint !== "string" || !endpoint.trim()) {
    return res.status(400).json({ error: "endpoint (string) is required" });
  }
  let parsed: URL;
  try {
    parsed = new URL(endpoint.trim());
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("bad protocol");
  } catch {
    return res.status(400).json({ error: "endpoint must be a valid http:// or https:// URL" });
  }
  const host = parsed.hostname.toLowerCase();
  const isInternal = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host);
  if (isInternal) {
    return res.status(400).json({ error: "Only external endpoints can be tested. Use a publicly accessible URL." });
  }
  try {
    const result = await runRpcAttackSuite(endpoint.trim());
    return res.json(result);
  } catch (err) {
    req.log.error({ err }, "rpc-attack error");
    return res.status(500).json({ error: "Attack suite failed — verify the endpoint is reachable" });
  }
});

export default router;
