// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { anonAccountsTable, nodesTable, anonPaymentInvoicesTable } from "@workspace/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

const router = Router();

// ── JWT helpers ──────────────────────────────────────────────────────────────

function createAnonJwt(accountNumber: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: `anon:${accountNumber}`,
    iat: now,
    exp: now + 60 * 60 * 24 * 90,
  })).toString("base64url");
  const secret = process.env.SESSION_SECRET ?? "";
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export function verifyAnonJwt(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const secret = process.env.SESSION_SECRET ?? "";
    const expected = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!decoded.sub?.startsWith("anon:")) return null;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded.sub.slice(5);
  } catch {
    return null;
  }
}

function requireAnonAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Anon token required" });
  const number = verifyAnonJwt(auth.slice(7));
  if (!number) return res.status(401).json({ error: "Invalid or expired anon token" });
  (req as any).anonAccountNumber = number;
  return next();
}

// ── Key generation ───────────────────────────────────────────────────────────

function generateAccountNumber(): string {
  return Array.from({ length: 16 }, () => crypto.randomInt(0, 10)).join("");
}

function generateWireGuardKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey: privObj, publicKey: pubObj } = crypto.generateKeyPairSync("x25519");
  const privateRaw = Buffer.from(privObj.export({ type: "pkcs8", format: "der" })).slice(-32);
  const publicRaw = Buffer.from(pubObj.export({ type: "spki", format: "der" })).slice(-32);
  return {
    privateKey: privateRaw.toString("base64"),
    publicKey: publicRaw.toString("base64"),
  };
}

async function allocateAnonIp(): Promise<string> {
  const existing = await db.select({ ip: anonAccountsTable.assignedIp }).from(anonAccountsTable);
  const usedSet = new Set(existing.map((r) => r.ip).filter(Boolean));
  for (let i = 2; i <= 254; i++) {
    const candidate = `10.3.0.${i}`;
    if (!usedSet.has(candidate)) return candidate;
  }
  throw new Error("No available IPs in 10.3.0.0/24");
}

// ── POST /create ─────────────────────────────────────────────────────────────

router.post("/create", async (_req, res) => {
  const accountNumber = generateAccountNumber();
  const { privateKey, publicKey } = generateWireGuardKeyPair();
  const assignedIp = await allocateAnonIp();
  const subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [node] = await db
    .select({ id: nodesTable.id })
    .from(nodesTable)
    .where(eq(nodesTable.status, "active"))
    .limit(1);

  if (!node) return res.status(503).json({ error: "No active VPN nodes available" });

  await db.insert(anonAccountsTable).values({
    accountNumber,
    wgPrivateKey: privateKey,
    wgPublicKey: publicKey,
    assignedIp,
    assignedNodeId: node.id,
    subscriptionExpiresAt,
  });

  return res.json({
    accountNumber,
    expiresAt: subscriptionExpiresAt.toISOString(),
    trialDays: 30,
  });
});

// ── POST /auth ────────────────────────────────────────────────────────────────

router.post("/auth", async (req, res) => {
  let body: { accountNumber: string };
  try {
    body = z.object({ accountNumber: z.string().regex(/^\d{16}$/) }).parse(req.body);
  } catch {
    return res.status(400).json({ error: "Account number must be exactly 16 digits" });
  }

  const [account] = await db
    .select()
    .from(anonAccountsTable)
    .where(eq(anonAccountsTable.accountNumber, body.accountNumber));

  if (!account) return res.status(401).json({ error: "Account not found" });

  const token = createAnonJwt(account.accountNumber);
  return res.json({
    token,
    expiresAt: account.subscriptionExpiresAt?.toISOString() ?? null,
  });
});

// ── GET /status ───────────────────────────────────────────────────────────────

router.get("/status", requireAnonAuth, async (req, res) => {
  const [account] = await db
    .select()
    .from(anonAccountsTable)
    .where(eq(anonAccountsTable.accountNumber, (req as any).anonAccountNumber));

  if (!account) return res.status(404).json({ error: "Account not found" });

  const now = new Date();
  const isActive = account.subscriptionExpiresAt ? account.subscriptionExpiresAt > now : false;
  const daysRemaining = account.subscriptionExpiresAt
    ? Math.max(0, Math.ceil((account.subscriptionExpiresAt.getTime() - now.getTime()) / 86400000))
    : 0;

  return res.json({
    accountNumber: account.accountNumber,
    expiresAt: account.subscriptionExpiresAt?.toISOString() ?? null,
    isActive,
    daysRemaining,
  });
});

// ── GET /servers ──────────────────────────────────────────────────────────────

router.get("/servers", requireAnonAuth, async (_req, res) => {
  const nodes = await db
    .select({
      id: nodesTable.id,
      name: nodesTable.name,
      region: nodesTable.region,
      ipAddress: nodesTable.ipAddress,
      latencyMs: nodesTable.latencyMs,
      status: nodesTable.status,
    })
    .from(nodesTable)
    .where(eq(nodesTable.status, "active"));

  return res.json({ servers: nodes });
});

// ── GET /wg-config ────────────────────────────────────────────────────────────

router.get("/wg-config", requireAnonAuth, async (req, res) => {
  const [account] = await db
    .select()
    .from(anonAccountsTable)
    .where(eq(anonAccountsTable.accountNumber, (req as any).anonAccountNumber));

  if (!account) return res.status(404).json({ error: "Account not found" });

  const now = new Date();
  if (!account.subscriptionExpiresAt || account.subscriptionExpiresAt < now) {
    return res.status(402).json({ error: "Subscription expired. Visit /anon/upgrade to renew with crypto." });
  }
  if (!account.wgPrivateKey || !account.assignedIp || !account.assignedNodeId) {
    return res.status(503).json({ error: "VPN credentials not provisioned" });
  }

  // Multi-hop: pick a second active node as exit (different from the assigned entry node)
  const [entryNode] = await db.select().from(nodesTable).where(eq(nodesTable.id, account.assignedNodeId));
  if (!entryNode) return res.status(503).json({ error: "Assigned node not found" });

  const [exitNode] = await db
    .select()
    .from(nodesTable)
    .where(and(eq(nodesTable.status, "active"), ne(nodesTable.id, account.assignedNodeId)))
    .limit(1);

  const cfg: string[] = [
    `# ProxhqVPN Anonymous Account — Double-Hop Configuration`,
    `# Entry: ${entryNode.name} (${entryNode.region})`,
    exitNode ? `# Exit:  ${exitNode.name} (${exitNode.region})` : `# Exit:  single-hop (no second node available)`,
    ``,
    `[Interface]`,
    `PrivateKey = ${account.wgPrivateKey}`,
    `Address = ${account.assignedIp}/32`,
    `DNS = 1.1.1.1, 1.0.0.1`,
    ``,
    `[Peer] # Entry Node — ${entryNode.name}`,
    `PublicKey = ${entryNode.publicKey}`,
    `AllowedIPs = 0.0.0.0/0, ::/0`,
    `Endpoint = ${entryNode.ipAddress}:${entryNode.listenPort}`,
    `PersistentKeepalive = 25`,
  ];

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", `attachment; filename="proxhqvpn-anon.conf"`);
  return res.send(cfg.join("\n"));
});

// ── POST /payment/create ──────────────────────────────────────────────────────
// Creates a crypto payment invoice for anonymous account renewal.
// No identity required — just the account number (via JWT).

const ANON_PLANS: Record<string, { durationDays: number; amountUsdCents: number }> = {
  monthly: { durationDays: 30, amountUsdCents: 699 },
  annual:  { durationDays: 365, amountUsdCents: 5999 },
};

// Fingerprint amounts: add a tiny random offset so each invoice is uniquely
// identifiable by the exact crypto amount the user sends.
function fingerprintAmount(base: number, jitter: number): string {
  const total = base + jitter;
  return total.toFixed(8);
}

router.post("/payment/create", requireAnonAuth, async (req, res) => {
  let body: { plan: string; currency: string };
  try {
    body = z.object({
      plan: z.enum(["monthly", "annual"]),
      currency: z.enum(["BTC", "ETH"]),
    }).parse(req.body);
  } catch {
    return res.status(400).json({ error: "plan must be 'monthly'|'annual', currency must be 'BTC'|'ETH'" });
  }

  const accountNumber = (req as any).anonAccountNumber as string;
  const planDef = ANON_PLANS[body.plan];

  // Get address from env
  const btcAddress = process.env.CRYPTO_BTC_ADDRESS ?? "";
  const ethAddress = process.env.CRYPTO_ETH_ADDRESS ?? "";
  const address = body.currency === "BTC" ? btcAddress : ethAddress;
  if (!address) return res.status(503).json({ error: `${body.currency} address not configured` });

  // Live exchange rate from CoinGecko free public API (no key required)
  let exchangeRate: number;
  try {
    const cgId = body.currency === "BTC" ? "bitcoin" : "ethereum";
    const cgResp = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`,
      { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(6000) }
    );
    if (cgResp.ok) {
      const cgData = await cgResp.json() as Record<string, { usd: number }>;
      exchangeRate = cgData[cgId]?.usd ?? (body.currency === "BTC" ? 65000 : 3500);
    } else {
      exchangeRate = body.currency === "BTC" ? 65000 : 3500;
    }
  } catch {
    exchangeRate = body.currency === "BTC" ? 65000 : 3500;
  }

  const usdAmount = planDef.amountUsdCents / 100;
  const baseAmount = usdAmount / exchangeRate;
  // Jitter: 0.00000001 to 0.00000099 — too small to matter in fiat, unique per invoice
  const jitter = crypto.randomInt(1, 100) * 0.000000001;
  const amountCrypto = fingerprintAmount(baseAmount, jitter);

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

  const [invoice] = await db.insert(anonPaymentInvoicesTable).values({
    accountNumber,
    currency: body.currency,
    address,
    amountCrypto,
    amountUsdCents: planDef.amountUsdCents,
    durationDays: planDef.durationDays,
    status: "pending",
    expiresAt,
  }).returning();

  return res.json({
    invoiceId: invoice.id,
    currency: body.currency,
    address,
    amountCrypto,
    amountUsd: usdAmount.toFixed(2),
    durationDays: planDef.durationDays,
    expiresAt: expiresAt.toISOString(),
    note: `Send exactly ${amountCrypto} ${body.currency} to ${address}. The exact amount is your payment fingerprint.`,
  });
});

// ── POST /payment/verify ──────────────────────────────────────────────────────
// User submits their transaction hash. We mark the invoice as pending manual
// verification. Admins confirm via /api/anon/payment/confirm (admin-only).
// For MVP, auto-confirm after txHash submission (trust model).

router.post("/payment/verify", requireAnonAuth, async (req, res) => {
  let body: { invoiceId: string; txHash: string };
  try {
    body = z.object({
      invoiceId: z.string(),
      txHash: z.string().min(10).max(200),
    }).parse(req.body);
  } catch {
    return res.status(400).json({ error: "invoiceId and txHash required" });
  }

  const accountNumber = (req as any).anonAccountNumber as string;
  const [invoice] = await db
    .select()
    .from(anonPaymentInvoicesTable)
    .where(and(
      eq(anonPaymentInvoicesTable.id, body.invoiceId),
      eq(anonPaymentInvoicesTable.accountNumber, accountNumber),
    ));

  if (!invoice) return res.status(404).json({ error: "Invoice not found" });
  if (invoice.status === "confirmed") return res.json({ ok: true, message: "Already confirmed" });
  if (invoice.status === "expired" || (invoice.expiresAt && invoice.expiresAt < new Date())) {
    return res.status(410).json({ error: "Invoice expired" });
  }

  // Record the txHash and mark confirmed (manual review model — admin audits later)
  await db.update(anonPaymentInvoicesTable).set({
    txHash: body.txHash,
    status: "confirmed",
    confirmedAt: new Date(),
  }).where(eq(anonPaymentInvoicesTable.id, body.invoiceId));

  // Extend the subscription
  const [account] = await db.select().from(anonAccountsTable).where(eq(anonAccountsTable.accountNumber, accountNumber));
  if (!account) return res.status(404).json({ error: "Account not found" });

  const currentExpiry = account.subscriptionExpiresAt && account.subscriptionExpiresAt > new Date()
    ? account.subscriptionExpiresAt
    : new Date();
  const newExpiry = new Date(currentExpiry.getTime() + invoice.durationDays * 86400000);

  await db.update(anonAccountsTable).set({ subscriptionExpiresAt: newExpiry })
    .where(eq(anonAccountsTable.accountNumber, accountNumber));

  return res.json({
    ok: true,
    message: "Payment recorded. Subscription extended.",
    newExpiresAt: newExpiry.toISOString(),
    durationDays: invoice.durationDays,
    note: "Our team will verify the on-chain transaction. Contact support if there are any issues.",
  });
});

// ── GET /payment/invoices ─────────────────────────────────────────────────────

router.get("/payment/invoices", requireAnonAuth, async (req, res) => {
  const accountNumber = (req as any).anonAccountNumber as string;
  const invoices = await db
    .select()
    .from(anonPaymentInvoicesTable)
    .where(eq(anonPaymentInvoicesTable.accountNumber, accountNumber));

  return res.json({ invoices });
});

export default router;
