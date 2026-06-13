// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { nodesTable } from "./nodes";
import { usersTable } from "./users";

export const userWgConfigsTable = pgTable("user_wg_configs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id),
  nodeId: integer("node_id").notNull().references(() => nodesTable.id),
  // Audit fix: plaintext private key storage replaced with AES-256-GCM envelope encryption.
  // Plain columns kept for migration compatibility but must contain "__encrypted__" sentinel
  // after backfill. Use encryptSecret/decryptSecret from lib/encrypted-secret-store.ts.
  clientPrivateKey: text("client_private_key").notNull().default("__encrypted__"),
  clientPublicKey: text("client_public_key").notNull(),
  assignedIp: text("assigned_ip").notNull(),
  // Encrypted ciphertext columns — AES-256-GCM, format: v1.<iv>.<tag>.<ct> (base64url)
  clientPrivateKeyEnc: text("client_private_key_enc"),
  pskKeyEnc: text("psk_key_enc"),
  keyEncryptionVersion: text("key_encryption_version").default("v1"),
  // Post-quantum PresharedKey — stored encrypted. Rotated via POST /api/wireguard/rotate-psk/:id.
  pskKey: text("psk_key"),
  pskRotatedAt: timestamp("psk_rotated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
});

export type InsertUserWgConfig = typeof userWgConfigsTable.$inferInsert;
export type UserWgConfig = typeof userWgConfigsTable.$inferSelect;

export const wgPeerCommandsTable = pgTable("wg_peer_commands", {
  id: serial("id").primaryKey(),
  configId: integer("config_id").notNull().references(() => userWgConfigsTable.id),
  nodeId: integer("node_id").notNull().references(() => nodesTable.id),
  userId: text("user_id").notNull(),
  clientPublicKey: text("client_public_key").notNull(),
  assignedIp: text("assigned_ip").notNull(),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  appliedAt: timestamp("applied_at"),
  errorMessage: text("error_message"),
});

export type WgPeerCommand = typeof wgPeerCommandsTable.$inferSelect;

// ── WireGuard config fingerprints ────────────────────────────────────────────
// Records a SHA-256 fingerprint every time a WireGuard config is provisioned
// via /api/wireguard/config-v2. Used for auditing and dedup detection.
export const wireguardConfigFingerprintsTable = pgTable(
  "wireguard_config_fingerprints",
  {
    id: serial("id").primaryKey(),
    userId: text("user_id").notNull(),
    deviceId: text("device_id").notNull(),
    fingerprint: text("fingerprint").notNull(),
    peerCount: integer("peer_count").notNull().default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
);

export type WireguardConfigFingerprint =
  typeof wireguardConfigFingerprintsTable.$inferSelect;
