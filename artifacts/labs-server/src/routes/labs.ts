// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Labs API routes — all protected by requireLabsAdmin middleware.
import { Router }            from "express";
import { requireLabsAdmin }  from "../middleware/auth";

const router = Router();

// ── Status endpoint ────────────────────────────────────────────────────────
router.get("/status", requireLabsAdmin, (_req, res) => {
  res.json({
    service:    "labs-server",
    boundary:   "isolated",
    timestamp:  new Date().toISOString(),
    features:   ["offensive-tools", "exploit-analysis", "threat-simulation"],
    status:     "operational",
  });
});

// ── Tool catalog ───────────────────────────────────────────────────────────
router.get("/tools", requireLabsAdmin, (_req, res) => {
  res.json({
    tools: [
      { id: "exploit-analyzer",   name: "Exploit Analyzer",   description: "Analyze binary/script exploits",       restricted: true },
      { id: "payload-generator",  name: "Payload Generator",  description: "Generate test payloads for pen-tests",  restricted: true },
      { id: "network-prober",     name: "Network Prober",     description: "Active network reconnaissance",         restricted: true },
      { id: "vuln-scanner",       name: "Vulnerability Scanner", description: "CVE-based vulnerability detection",  restricted: false },
    ],
  });
});

// ── Session info — who am I ────────────────────────────────────────────────
router.get("/me", requireLabsAdmin, (req, res) => {
  const labsUser = (req as any).labsUser as { userId: string; email: string } | undefined;
  res.json({
    userId:   labsUser?.userId ?? "unknown",
    email:    labsUser?.email ?? "unknown",
    role:     "labs-admin",
    boundary: "isolated",
  });
});

export default router;
