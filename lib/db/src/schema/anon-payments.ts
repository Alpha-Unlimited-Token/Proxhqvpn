// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { anonAccountsTable } from "./anon-accounts";

// ─── Anonymous Account Crypto Payment Invoices ───────────────────────────────
// One invoice per checkout attempt. Expires after 2 hours.
// amountCrypto includes a tiny random offset to fingerprint the payment uniquely.
// No email, no identity — account number is the only link.
export const anonPaymentInvoicesTable = pgTable("anon_payment_invoices", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  accountNumber: text("account_number").notNull().references(() => anonAccountsTable.accountNumber),
  currency: text("currency").notNull(),          // 'BTC' | 'ETH'
  address: text("address").notNull(),             // deposit address from env
  amountCrypto: text("amount_crypto").notNull(),  // exact amount with fingerprint offset
  amountUsdCents: integer("amount_usd_cents").notNull(),
  durationDays: integer("duration_days").notNull(), // 30 or 365
  status: text("status").notNull().default("pending"), // 'pending'|'confirmed'|'expired'
  txHash: text("tx_hash"),                        // submitted by user
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),   // 2 hours from creation
  confirmedAt: timestamp("confirmed_at"),
});

export type AnonPaymentInvoice = typeof anonPaymentInvoicesTable.$inferSelect;
export type InsertAnonPaymentInvoice = typeof anonPaymentInvoicesTable.$inferInsert;
