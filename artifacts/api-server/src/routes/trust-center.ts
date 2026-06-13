// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Trust Center public read API — safe public summary only.
// NO raw findings, NO private node details, NO internal IPs, NO WireGuard configs.
import { Router } from "express";
import {
  getPublicTrustSummary,
  getPublicValidationSummary,
  getPublicStatusSummary,
  listPublicTrustDocuments,
} from "../services/publicTrustCenterService";

const router = Router();

// GET /api/trust-center/summary — overall trust posture (public, no auth)
router.get("/summary", async (_req, res) => {
  const summary = await getPublicTrustSummary();
  res.json(summary);
});

// GET /api/trust-center/validation-summary — safe validation stats only (public)
router.get("/validation-summary", async (_req, res) => {
  const summary = await getPublicValidationSummary();
  res.json(summary);
});

// GET /api/trust-center/status — live system status (public)
router.get("/status", async (_req, res) => {
  const status = await getPublicStatusSummary();
  res.json(status);
});

// GET /api/trust-center/documents — published trust documents (public)
router.get("/documents", async (_req, res) => {
  const docs = await listPublicTrustDocuments();
  res.json({ documents: docs });
});

export default router;
