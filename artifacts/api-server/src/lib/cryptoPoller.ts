/**
 * cryptoPoller.ts
 * Server-side background job that checks pending crypto invoices against the
 * blockchain every 60 seconds — so users get access even after closing the modal.
 */
import { db } from "@workspace/db";
import {
  cryptoInvoicesTable,
  cryptoSubscriptionsTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and, lt, sql } from "drizzle-orm";
import { logger } from "./logger";

// ── Re-use the same blockchain checkers from the route ────────────────────────

interface TxResult { found: boolean; txHash?: string }

async function checkBtcPayment(address: string, expectedAmount: string): Promise<TxResult> {
  try {
    const expected = parseFloat(expectedAmount);
    const r = await fetch(
      `https://api.blockchair.com/bitcoin/dashboards/address/${address}?limit=25`,
      { headers: { "User-Agent": "ProxhqVPN/3.0" }, signal: AbortSignal.timeout(12000) }
    );
    if (!r.ok) return { found: false };
    const data = await r.json() as any;
    const txList: string[] = data?.data?.[address]?.transactions ?? [];
    for (const txHash of txList) {
      const txr = await fetch(
        `https://api.blockchair.com/bitcoin/dashboards/transaction/${txHash}`,
        { headers: { "User-Agent": "ProxhqVPN/3.0" }, signal: AbortSignal.timeout(12000) }
      );
      if (!txr.ok) continue;
      const txd = await txr.json() as any;
      const outputs: any[] = txd?.data?.[txHash]?.outputs ?? [];
      for (const out of outputs) {
        if (out.recipient === address && Math.abs(out.value / 1e8 - expected) < 1e-7) {
          return { found: true, txHash };
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
      { headers: { "User-Agent": "ProxhqVPN/3.0" }, signal: AbortSignal.timeout(12000) }
    );
    if (!r.ok) return { found: false };
    const data = await r.json() as any;
    if (data.status !== "1") return { found: false };
    for (const tx of (data.result ?? []).slice(0, 50)) {
      if (Math.abs(parseInt(tx.value) / 1e18 - expected) < 1e-8) {
        return { found: true, txHash: tx.hash };
      }
    }
    return { found: false };
  } catch {
    return { found: false };
  }
}

// ── Activation helper ─────────────────────────────────────────────────────────

async function activateInvoice(invoiceId: string, userId: string, txHash: string | undefined) {
  const now = new Date();

  const [invoice] = await db
    .select()
    .from(cryptoInvoicesTable)
    .where(eq(cryptoInvoicesTable.id, invoiceId));

  if (!invoice || invoice.status !== "pending") return; // already handled

  const accessExpiresAt = new Date(now.getTime() + invoice.durationDays * 24 * 60 * 60 * 1000);

  // Mark invoice confirmed
  await db.update(cryptoInvoicesTable)
    .set({ status: "confirmed", txHash: txHash ?? null, confirmedAt: now })
    .where(eq(cryptoInvoicesTable.id, invoiceId));

  // Upsert subscription
  const existing = await db
    .select()
    .from(cryptoSubscriptionsTable)
    .where(eq(cryptoSubscriptionsTable.userId, userId));

  if (existing.length > 0) {
    await db.update(cryptoSubscriptionsTable)
      .set({ planTier: invoice.planTier, invoiceId: invoice.id, startsAt: now, expiresAt: accessExpiresAt })
      .where(eq(cryptoSubscriptionsTable.userId, userId));
  } else {
    await db.insert(cryptoSubscriptionsTable).values({
      userId,
      planTier: invoice.planTier,
      invoiceId: invoice.id,
      startsAt: now,
      expiresAt: accessExpiresAt,
    });
  }

  // Create in-app notification
  const tierLabel = invoice.planTier === "command_center" ? "Command Center Pro" : "VPN Basic";
  await db.insert(notificationsTable).values({
    userId,
    type: "crypto_payment_confirmed",
    title: "Payment Confirmed — Access Granted",
    body: `Your ${invoice.currency} payment was detected on-chain. Your ${tierLabel} subscription is now active until ${accessExpiresAt.toLocaleDateString()}.`,
    data: {
      invoiceId: invoice.id,
      txHash: txHash ?? null,
      planTier: invoice.planTier,
      currency: invoice.currency,
      accessExpiresAt: accessExpiresAt.toISOString(),
    },
  });

  logger.info({ invoiceId, userId, txHash, planTier: invoice.planTier }, "Crypto payment confirmed — access activated");
}

// ── Main poll loop ────────────────────────────────────────────────────────────

export async function pollPendingCryptoInvoices() {
  try {
    const now = new Date();

    // Fetch all pending invoices that haven't expired yet
    const pending = await db
      .select()
      .from(cryptoInvoicesTable)
      .where(
        and(
          eq(cryptoInvoicesTable.status, "pending"),
          sql`${cryptoInvoicesTable.expiresAt} > ${now}`
        )
      );

    if (pending.length === 0) return;

    logger.info({ count: pending.length }, "Crypto poller: checking pending invoices");

    for (const invoice of pending) {
      // Expire overdue invoices
      if (new Date(invoice.expiresAt) <= now) {
        await db.update(cryptoInvoicesTable)
          .set({ status: "expired" })
          .where(eq(cryptoInvoicesTable.id, invoice.id));
        continue;
      }

      const result =
        invoice.currency === "BTC"
          ? await checkBtcPayment(invoice.address, invoice.amountCrypto)
          : await checkEthPayment(invoice.address, invoice.amountCrypto);

      if (result.found) {
        await activateInvoice(invoice.id, invoice.userId, result.txHash);
      }
    }
  } catch (err) {
    logger.warn({ err }, "Crypto poller encountered an error");
  }
}

export function startCryptoPoller(intervalMs = 60_000) {
  pollPendingCryptoInvoices(); // run immediately on startup
  setInterval(pollPendingCryptoInvoices, intervalMs);
  logger.info({ intervalMs }, "Crypto invoice poller started");
}
