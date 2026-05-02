// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { sql } from "drizzle-orm";

// ─── Crypto Invoices ──────────────────────────────────────────────────────────
// One invoice is created per checkout attempt. Expires after 2 hours.
// The unique amountCrypto (base + tiny random offset) fingerprints the payment.
export const cryptoInvoicesTable = pgTable("crypto_invoices", {
  id: varchar("id", { length: 64 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: text("user_id").notNull().references(() => usersTable.id),
  plan: text("plan").notNull(),             // 'vpn_monthly' | 'vpn_annual' | 'pro_monthly' | 'pro_annual'
  planTier: text("plan_tier").notNull(),    // 'vpn' | 'command_center'
  durationDays: integer("duration_days").notNull(),
  amountUsdCents: integer("amount_usd_cents").notNull(),
  currency: text("currency").notNull(),      // 'BTC' | 'ETH'
  address: text("address").notNull(),        // deposit address
  amountCrypto: text("amount_crypto").notNull(), // exact amount user must send
  exchangeRate: text("exchange_rate").notNull(),  // USD per 1 BTC/ETH at time of invoice
  status: text("status").notNull().default("pending"), // 'pending'|'confirmed'|'expired'|'overpaid'
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  confirmedAt: timestamp("confirmed_at"),
});

export type CryptoInvoice = typeof cryptoInvoicesTable.$inferSelect;
export type InsertCryptoInvoice = typeof cryptoInvoicesTable.$inferInsert;

// ─── Crypto Subscriptions ─────────────────────────────────────────────────────
// Active crypto-paid subscription. One active record per user at a time.
// Access is time-based (expiresAt) not recurring — user manually renews.
export const cryptoSubscriptionsTable = pgTable("crypto_subscriptions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique().references(() => usersTable.id),
  planTier: text("plan_tier").notNull(),    // 'vpn' | 'command_center'
  invoiceId: varchar("invoice_id", { length: 64 }).notNull(),
  startsAt: timestamp("starts_at").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type CryptoSubscription = typeof cryptoSubscriptionsTable.$inferSelect;
