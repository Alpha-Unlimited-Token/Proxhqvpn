// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { z } from "zod";
import { createHash } from "crypto";

const router = Router();

const HIBP_API_KEY = process.env.HIBP_API_KEY ?? "";
const HIBP_BASE    = "https://haveibeenpwned.com/api/v3";
const PWNED_PASS_BASE = "https://api.pwnedpasswords.com";

interface MonitoredEmail {
  email: string;
  addedAt: string;
  lastChecked: string | null;
  breachCount: number;
}

interface BreachResult {
  email: string;
  breaches: HibpBreach[];
  checkedAt: string;
  error?: string;
}

interface HibpBreach {
  Name:        string;
  Title:       string;
  Domain:      string;
  BreachDate:  string;
  AddedDate:   string;
  Description: string;
  DataClasses: string[];
  IsVerified:  boolean;
  IsFabricated: boolean;
  IsSensitive: boolean;
  IsActive:    boolean;
  PwnCount:    number;
}

// In-memory monitored emails per user
const monitoredEmails: Record<string, MonitoredEmail[]> = {};
const breachCache: Record<string, BreachResult> = {};

function getEmails(userId: string): MonitoredEmail[] {
  return monitoredEmails[userId] ?? [];
}

async function checkEmailBreaches(email: string): Promise<{ breaches: HibpBreach[]; error?: string }> {
  if (!HIBP_API_KEY) {
    return { breaches: [], error: "HIBP API key not configured. Add your HIBP_API_KEY to enable live breach monitoring." };
  }
  try {
    const res = await fetch(`${HIBP_BASE}/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`, {
      headers: {
        "hibp-api-key": HIBP_API_KEY,
        "User-Agent": "ProxhqVPN-DarkWebMonitor/1.0",
      },
    });
    if (res.status === 404) return { breaches: [] }; // Not breached
    if (res.status === 401) return { breaches: [], error: "Invalid HIBP API key." };
    if (res.status === 429) return { breaches: [], error: "Rate limited by HIBP. Try again in a few seconds." };
    if (!res.ok) return { breaches: [], error: `HIBP API error: HTTP ${res.status}` };
    const data = await res.json() as HibpBreach[];
    return { breaches: data };
  } catch (e: any) {
    return { breaches: [], error: e.message };
  }
}

// POST /darkweb/pwned-password — FREE k-anonymity password breach check (no API key required)
router.post("/pwned-password", async (req, res) => {
  const { password } = z.object({ password: z.string().min(1) }).parse(req.body);
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);
  try {
    const r = await fetch(`${PWNED_PASS_BASE}/range/${prefix}`, {
      headers: { "Add-Padding": "true", "User-Agent": "ProxhqVPN-DarkWebMonitor/1.0" },
    });
    if (!r.ok) return res.status(r.status).json({ error: `HIBP Passwords API error: ${r.status}` });
    const text = await r.text();
    const lines = text.split("\r\n");
    let count = 0;
    for (const line of lines) {
      const [lineSuffix, lineCount] = line.split(":");
      if (lineSuffix === suffix) { count = parseInt(lineCount, 10); break; }
    }
    res.json({ pwned: count > 0, count, prefix });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /darkweb/status — API config status + email list
router.get("/status", (req, res) => {
  const userId = (req.auth as any)?.userId ?? "anonymous";
  const emails = getEmails(userId);

  res.json({
    apiConfigured: !!HIBP_API_KEY,
    monitoredCount: emails.length,
    emails: emails,
    totalBreaches: emails.reduce((s, e) => s + e.breachCount, 0),
    info: {
      provider: "Have I Been Pwned (HIBP) v3",
      description: "Scans 13+ billion compromised accounts across 700+ data breaches to check if your email addresses have been exposed on the dark web.",
      dataClasses: ["Passwords", "Email addresses", "Phone numbers", "Physical addresses", "Credit cards", "Private messages", "Government IDs"],
    },
  });
});

// POST /darkweb/check — check an email against breach databases
router.post("/check", async (req, res) => {
  const userId = (req.auth as any)?.userId ?? "anonymous";
  const { email } = z.object({ email: z.string().email() }).parse(req.body);

  const cached = breachCache[email];
  const cacheAgeMs = cached ? Date.now() - new Date(cached.checkedAt).getTime() : Infinity;
  const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

  if (cached && cacheAgeMs < CACHE_TTL && !cached.error) {
    return res.json({ ...cached, cached: true });
  }

  const { breaches, error } = await checkEmailBreaches(email);
  const result: BreachResult = { email, breaches, checkedAt: new Date().toISOString(), error };

  if (!error) breachCache[email] = result;

  // Update monitored email record
  const emails = getEmails(userId);
  const existing = emails.find(e => e.email === email);
  if (existing) {
    existing.lastChecked = result.checkedAt;
    existing.breachCount = breaches.length;
  }

  res.json({ ...result, cached: false });
});

// POST /darkweb/monitor — add email to monitoring list
router.post("/monitor", (req, res) => {
  const userId = (req.auth as any)?.userId ?? "anonymous";
  const { email } = z.object({ email: z.string().email() }).parse(req.body);

  if (!monitoredEmails[userId]) monitoredEmails[userId] = [];
  const existing = monitoredEmails[userId].find(e => e.email === email);
  if (existing) return res.status(409).json({ error: "Email already being monitored." });

  monitoredEmails[userId].push({
    email,
    addedAt: new Date().toISOString(),
    lastChecked: null,
    breachCount: 0,
  });

  res.status(201).json({ email, message: "Email added to monitoring list." });
});

// DELETE /darkweb/monitor/:email — remove email from monitoring
router.delete("/monitor/:email", (req, res) => {
  const userId = (req.auth as any)?.userId ?? "anonymous";
  const email  = decodeURIComponent(req.params.email);
  const emails = getEmails(userId);
  const idx    = emails.findIndex(e => e.email === email);
  if (idx === -1) return res.status(404).json({ error: "Email not found in monitoring list." });
  const [removed] = emails.splice(idx, 1);
  res.json({ removed });
});

// GET /darkweb/breaches — list all known breach databases (from HIBP)
router.get("/breaches", async (_req, res) => {
  try {
    const r = await fetch(`${HIBP_BASE}/breaches`, {
      headers: HIBP_API_KEY ? { "hibp-api-key": HIBP_API_KEY } : {},
    });
    if (!r.ok) return res.status(r.status).json({ error: `HIBP error: ${r.status}` });
    const breaches = await r.json() as HibpBreach[];
    res.json({
      count: breaches.length,
      breaches: breaches.slice(0, 50).map(b => ({
        name:      b.Name,
        title:     b.Title,
        domain:    b.Domain,
        date:      b.BreachDate,
        pwnCount:  b.PwnCount,
        classes:   b.DataClasses.slice(0, 4),
        active:    b.IsActive,
        verified:  b.IsVerified,
      })),
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
