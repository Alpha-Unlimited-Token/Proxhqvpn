// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Trust Center public read API — safe public summary only.
// NO raw findings, NO private node details, NO internal IPs.
import { Router } from "express";
import { getTrustValidationSummary } from "../services/trustValidationSummaryService";

const router = Router();

// GET /api/trust-center/validation-summary
// Public — returns only high-level status, uptime, and last validation time.
router.get("/validation-summary", async (_req, res) => {
  const summary = await getTrustValidationSummary();
  // Strip any fields that could expose infrastructure details
  res.json({
    status:           summary.status,
    score:            summary.score,
    maxScore:         summary.maxScore,
    uptimePct:        summary.uptimePct,
    lastValidationAt: summary.lastValidationAt,
    lastTlsCheckAt:   summary.lastTlsCheckAt,
    environment:      summary.environment,
    generatedAt:      summary.generatedAt,
  });
});

export default router;
