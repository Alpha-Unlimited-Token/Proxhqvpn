// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { cryptoInvoicesTable, cryptoSubscriptionsTable, notificationsTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

const router = Router();

// ─── Constants ────────────────────────────────────────────────────────────────

const PLANS: Record<string, { label: string; tier: "vpn" | "command_center"; days: number; usdCents: number }> = {
  vpn_monthly:   { label: "VPN Basic — Monthly",          tier: "vpn",             days: 30,  usdCents: 699   },
  vpn_annual:    { label: "VPN Basic — Annual",            tier: "vpn",             days: 365, usdCents: 5999  },
  pro_monthly:   { label: "Command Center Pro — Monthly",  tier: "command_center",  days: 30,  usdCents: 3999  },
  pro_annual:    { label: "Command Center Pro — Annual",   tier: "command_center",  days: 365, usdCents: 34999 },
};

const CURRENCIES = ["BTC", "ETH"] as const;
type CryptoCurrency = typeof CURRENCIES[number];

// Slightly randomised offsets so each invoice has a unique amount.
// BTC offset: 0–999 satoshis (0.00000000–0.00000999 BTC)
// ETH offset: 0–999 gwei    (0.000000000–0.000000999 ETH)
function uniqueOffset(currency: CryptoCurrency): number {
  const rand = crypto.randomInt(1, 999);
  return currency === "BTC" ? rand * 1e-8 : rand * 1e-9;
}

// ─── Exchange Rate Fetcher (Coinbase public API, no auth required) ────────────
async function getExchangeRate(currency: CryptoCurrency): Promise<number> {
  try {
    const symbol = currency === "BTC" ? "BTC-USD" : "ETH-USD";
    const r = await fetch(`https://api.coinbase.com/v2/prices/${symbol}/spot`, {
      headers: { "User-Agent": "ProxhqVPN/3.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) throw new Error(`Coinbase API ${r.status}`);
    const data = await r.json() as { data: { amount: string } };
    return parseFloat(data.data.amount);
  } catch {
    // Fallback rates if Coinbase is down (conservative estimate)
    return currency === "BTC" ? 60000 : 3000;
  }
}

// ─── Address Format Validators ────────────────────────────────────────────────

/**
 * Bitcoin: Legacy (1...), P2SH (3...), or Bech32 (bc1...).
 * Returns "valid", "wrong_network" (looks like ETH), or "invalid".
 */
function validateBtcAddress(address: string): "valid" | "wrong_network" | "invalid" {
  if (/^0x[0-9a-fA-F]{40}$/.test(address)) return "wrong_network"; // ETH address given
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{24,33}$/.test(address)) return "valid"; // Legacy / P2SH
  if (/^bc1[a-z0-9]{6,87}$/i.test(address)) return "valid";              // Bech32 / Taproot
  return "invalid";
}

/**
 * Ethereum: 0x followed by exactly 40 hex chars.
 * Returns "valid", "wrong_network" (looks like BTC), or "invalid".
 */
function validateEthAddress(address: string): "valid" | "wrong_network" | "invalid" {
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{24,33}$/.test(address) || /^bc1[a-z0-9]{6,87}$/i.test(address))
    return "wrong_network"; // BTC address given
  if (/^0x[0-9a-fA-F]{40}$/.test(address)) return "valid";
  return "invalid";
}

// ─── Blockchain Payment Verifier ──────────────────────────────────────────────
interface TxResult { found: boolean; txHash?: string; confirmations?: number }

async function checkBtcPayment(address: string, expectedAmount: string): Promise<TxResult> {
  try {
    const expected = parseFloat(expectedAmount);
    const r = await fetch(
      `https://api.blockchair.com/bitcoin/dashboards/address/${address}?limit=25`,
      { headers: { "User-Agent": "ProxhqVPN/3.0" }, signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok) return { found: false };
    const data = await r.json() as any;
    const txList: any[] = data?.data?.[address]?.transactions ?? [];

    for (const txHash of txList) {
      const txr = await fetch(
        `https://api.blockchair.com/bitcoin/dashboards/transaction/${txHash}`,
        { headers: { "User-Agent": "ProxhqVPN/3.0" }, signal: AbortSignal.timeout(10000) }
      );
      if (!txr.ok) continue;
      const txd = await txr.json() as any;
      const outputs: any[] = txd?.data?.[txHash]?.outputs ?? [];
      const confirmations: number = txd?.data?.[txHash]?.transaction?.block_id != null ? 1 : 0;

      for (const out of outputs) {
        if (out.recipient === address) {
          const amountBtc = out.value / 1e8;
          // Match within 1 sat tolerance
          if (Math.abs(amountBtc - expected) < 1e-7) {
            return { found: true, txHash, confirmations };
          }
        }
      }
    }
    return { found: false };
  } catch {
    return { found: false };
  }
}

async function checkEthPayment(address: string, expectedAmount: string): Promise<TxResult> {
  try {
    const expected = parseFloat(expectedAmount);
    const apiKey = process.env.ETHERSCAN_API_KEY ?? "YourApiKeyToken";
    const r = await fetch(
      `https://api.etherscan.io/api?module=account&action=txlist&address=${address}&sort=desc&apikey=${apiKey}`,
      { headers: { "User-Agent": "ProxhqVPN/3.0" }, signal: AbortSignal.timeout(10000) }
    );
    if (!r.ok) return { found: false };
    const data = await r.json() as any;
    if (data.status !== "1") return { found: false };

    for (const tx of (data.result ?? []).slice(0, 50)) {
      const amountEth = parseInt(tx.value) / 1e18;
      const confirmations = parseInt(tx.confirmations ?? "0");
      if (Math.abs(amountEth - expected) < 1e-8) {
        return { found: true, txHash: tx.hash, confirmations };
      }
    }
    return { found: false };
  } catch {
    return { found: false };
  }
}

// ─── POST /create  ────────────────────────────────────────────────────────────
// Creates a new crypto invoice. Returns address, exact crypto amount, QR data.
router.post("/create", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const body = z.object({
    plan: z.enum(["vpn_monthly", "vpn_annual", "pro_monthly", "pro_annual"]),
    currency: z.enum(["BTC", "ETH"]),
  }).parse(req.body);

  const plan = PLANS[body.plan];

  const address =
    body.currency === "BTC"
      ? (process.env.CRYPTO_BTC_ADDRESS ?? "")
      : (process.env.CRYPTO_ETH_ADDRESS ?? "");

  if (!address) {
    return res.status(503).json({
      error: "Crypto payments are not configured yet. Contact support.",
    });
  }

  // Validate the configured address is actually on the correct network
  const addrCheck = body.currency === "BTC"
    ? validateBtcAddress(address)
    : validateEthAddress(address);

  if (addrCheck === "wrong_network") {
    const got  = body.currency === "BTC" ? "an Ethereum" : "a Bitcoin";
    const need = body.currency === "BTC" ? "Bitcoin"     : "Ethereum";
    return res.status(503).json({
      error: `Wrong network: the configured ${need} address appears to be ${got} address. Payments cannot be processed until the correct ${need} address is set.`,
      code: "WRONG_NETWORK",
    });
  }

  if (addrCheck === "invalid") {
    return res.status(503).json({
      error: `The configured ${body.currency} address is not a valid ${body.currency} address format. Payments cannot be processed.`,
      code: "INVALID_ADDRESS",
    });
  }

  const rate = await getExchangeRate(body.currency);
  const baseAmount = plan.usdCents / 100 / rate;
  const offset = uniqueOffset(body.currency);
  const totalAmount = parseFloat((baseAmount + offset).toFixed(body.currency === "BTC" ? 8 : 8));

  const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

  const [invoice] = await db.insert(cryptoInvoicesTable).values({
    userId,
    plan: body.plan,
    planTier: plan.tier,
    durationDays: plan.days,
    amountUsdCents: plan.usdCents,
    currency: body.currency,
    address,
    amountCrypto: totalAmount.toString(),
    exchangeRate: rate.toString(),
    status: "pending",
    expiresAt,
  }).returning();

  const uriScheme = body.currency === "BTC"
    ? `bitcoin:${address}?amount=${totalAmount}`
    : `ethereum:${address}?value=${Math.round(totalAmount * 1e18)}`;

  return res.json({
    invoiceId: invoice.id,
    currency: body.currency,
    address,
    amountCrypto: totalAmount,
    amountUsd: (plan.usdCents / 100).toFixed(2),
    exchangeRate: rate,
    planLabel: plan.label,
    durationDays: plan.days,
    expiresAt: expiresAt.toISOString(),
    uriScheme,
    instructions: [
      `Send exactly ${totalAmount} ${body.currency} to the address above.`,
      `The exact amount identifies your payment — do not round it.`,
      `Invoice expires in 2 hours. Payment must be sent before expiry.`,
      `Confirmations required: 1 (BTC ≈ 10 min, ETH ≈ 15–30 sec).`,
    ],
  });
});

// ─── GET /status/:invoiceId  ──────────────────────────────────────────────────
// Polls blockchain to check if the invoice has been paid. Auto-activates access.
router.get("/status/:invoiceId", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [invoice] = await db
    .select()
    .from(cryptoInvoicesTable)
    .where(and(eq(cryptoInvoicesTable.id, req.params.invoiceId), eq(cryptoInvoicesTable.userId, userId)));

  if (!invoice) return res.status(404).json({ error: "Invoice not found" });

  // Already confirmed
  if (invoice.status === "confirmed") {
    return res.json({ status: "confirmed", confirmedAt: invoice.confirmedAt });
  }

  // Expired
  if (invoice.status === "expired" || new Date() > new Date(invoice.expiresAt)) {
    if (invoice.status !== "expired") {
      await db.update(cryptoInvoicesTable).set({ status: "expired" }).where(eq(cryptoInvoicesTable.id, invoice.id));
    }
    return res.json({ status: "expired" });
  }

  // Check blockchain
  const result =
    invoice.currency === "BTC"
      ? await checkBtcPayment(invoice.address, invoice.amountCrypto)
      : await checkEthPayment(invoice.address, invoice.amountCrypto);

  if (result.found) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + invoice.durationDays * 24 * 60 * 60 * 1000);

    // Mark invoice confirmed
    await db.update(cryptoInvoicesTable)
      .set({ status: "confirmed", txHash: result.txHash ?? null, confirmedAt: now })
      .where(eq(cryptoInvoicesTable.id, invoice.id));

    // Upsert crypto subscription (replace any existing record for this user)
    const existing = await db
      .select()
      .from(cryptoSubscriptionsTable)
      .where(eq(cryptoSubscriptionsTable.userId, userId));

    if (existing.length > 0) {
      await db.update(cryptoSubscriptionsTable)
        .set({ planTier: invoice.planTier, invoiceId: invoice.id, startsAt: now, expiresAt })
        .where(eq(cryptoSubscriptionsTable.userId, userId));
    } else {
      await db.insert(cryptoSubscriptionsTable).values({
        userId,
        planTier: invoice.planTier,
        invoiceId: invoice.id,
        startsAt: now,
        expiresAt,
      });
    }

    // Create in-app notification (only if one doesn't already exist for this invoice)
    const existingNotifs = await db
      .select({ id: notificationsTable.id, data: notificationsTable.data })
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.type, "crypto_payment_confirmed")));
    const alreadyNotified = existingNotifs.some((n: any) => (n.data as any)?.invoiceId === invoice.id);
    if (!alreadyNotified) {
      const tierLabel = invoice.planTier === "command_center" ? "Command Center Pro" : "VPN Basic";
      await db.insert(notificationsTable).values({
        userId,
        type: "crypto_payment_confirmed",
        title: "Payment Confirmed — Access Granted",
        body: `Your ${invoice.currency} payment was detected on-chain. Your ${tierLabel} subscription is now active until ${expiresAt.toLocaleDateString()}.`,
        data: {
          invoiceId: invoice.id,
          txHash: result.txHash ?? null,
          planTier: invoice.planTier,
          currency: invoice.currency,
          accessExpiresAt: expiresAt.toISOString(),
        },
      });
    }

    return res.json({
      status: "confirmed",
      confirmedAt: now.toISOString(),
      txHash: result.txHash,
      confirmations: result.confirmations,
      accessGranted: true,
      planTier: invoice.planTier,
      accessExpiresAt: expiresAt.toISOString(),
    });
  }

  return res.json({
    status: "pending",
    currency: invoice.currency,
    address: invoice.address,
    amountCrypto: invoice.amountCrypto,
    expiresAt: invoice.expiresAt,
  });
});

// ─── GET /my-invoices  ───────────────────────────────────────────────────────
router.get("/my-invoices", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const invoices = await db
    .select()
    .from(cryptoInvoicesTable)
    .where(eq(cryptoInvoicesTable.userId, userId));

  return res.json({ invoices });
});

// ─── GET /my-subscription  ───────────────────────────────────────────────────
router.get("/my-subscription", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const [sub] = await db
    .select()
    .from(cryptoSubscriptionsTable)
    .where(and(
      eq(cryptoSubscriptionsTable.userId, userId),
      gt(cryptoSubscriptionsTable.expiresAt, new Date())
    ));

  if (!sub) return res.json({ subscription: null });

  return res.json({
    subscription: {
      planTier: sub.planTier,
      startsAt: sub.startsAt,
      expiresAt: sub.expiresAt,
      daysRemaining: Math.max(0, Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / 86400000)),
    },
  });
});

export default router;
