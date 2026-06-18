// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const anonAccountsTable = pgTable("anon_accounts", {
  id: serial("id").primaryKey(),
  accountNumber: text("account_number").notNull().unique(),
  /** @deprecated Use wgPrivateKeyEnc instead. Kept for backfill; must be '__encrypted__' or NULL after migration. */
  wgPrivateKey: text("wg_private_key"),
  wgPublicKey: text("wg_public_key"),
  /** AES-256-GCM encrypted WireGuard private key (same envelope as userWgConfigsTable). */
  wgPrivateKeyEnc: text("wg_private_key_enc"),
  /** Encryption version tag — 'v1' = AES-256-GCM with PROXHQ_MASTER_KEY_B64. */
  keyEncryptionVersion: text("key_encryption_version").notNull().default("v1"),
  assignedIp: text("assigned_ip"),
  assignedNodeId: integer("assigned_node_id"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AnonAccount = typeof anonAccountsTable.$inferSelect;
export type InsertAnonAccount = typeof anonAccountsTable.$inferInsert;
