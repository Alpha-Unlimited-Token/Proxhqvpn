// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response } from "express";

const router = Router();

const NVD_BASE = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const NVD_API_KEY = process.env.NVD_API_KEY ?? "";

router.get("/search", async (req: Request, res: Response) => {
  const { q, cveId } = req.query as { q?: string; cveId?: string };
  if (!q && !cveId) return res.status(400).json({ error: "Provide q (keyword) or cveId" });

  const url = cveId
    ? `${NVD_BASE}?cveId=${encodeURIComponent(String(cveId).toUpperCase())}`
    : `${NVD_BASE}?keywordSearch=${encodeURIComponent(String(q))}&resultsPerPage=20`;

  try {
    const headers: Record<string, string> = {
      "User-Agent": "ProxhqVPN-CveSearch/1.0",
    };
    if (NVD_API_KEY) headers["apiKey"] = NVD_API_KEY;

    const upstream = await fetch(url, { headers, signal: AbortSignal.timeout(12000) });
    if (!upstream.ok) {
      return res.status(upstream.status).json({ error: `NVD API returned ${upstream.status}` });
    }
    const data = await upstream.json();
    res.json(data);
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      return res.status(504).json({ error: "NVD API timed out. Try again shortly." });
    }
    res.status(502).json({ error: "Failed to reach NVD API." });
  }
});

export default router;
