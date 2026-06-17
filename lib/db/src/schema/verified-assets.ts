// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Verified Assets — the legal gate for all active outbound security scans.
//
// RULE: Any route that sends packets to an external target (port scan, SQL injection
// test, directory fuzz, TLS probe, etc.) MUST call requireVerifiedAsset() first.
// This is how legitimate security tools (Burp Suite Enterprise, Tenable, Qualys)
// keep scanning legal: the customer must PROVE they own or control the target.
//
// Passive tools (WHOIS, public DNS, public cert inspection) and file-upload tools
// (SAST, dep scan, IaC scan) do NOT require verification because they do not touch
// a third-party system.
import {
  pgTable,
  serial,
  text,
  boolean,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const verifiedAssetsTable = pgTable(
  "verified_assets",
  {
    id:                 serial("id").primaryKey(),
    userId:             text("user_id").notNull(),
    tenantId:           text("tenant_id"),
    assetType:          text("asset_type").notNull(),
    // 'domain' | 'ip' | 'cidr'
    value:              text("value").notNull(),
    // e.g. "example.com" | "203.0.113.4" | "203.0.113.0/24"
    verificationMethod: text("verification_method").notNull(),
    // 'dns_txt' | 'http_file' | 'meta_tag' | 'manual_admin'
    verificationToken:  text("verification_token").notNull(),
    // the random token the user must place at the target
    verificationStatus: text("verification_status").notNull().default("pending"),
    // 'pending' | 'verified' | 'failed' | 'revoked'
    verifiedAt:         timestamp("verified_at"),
    lastCheckedAt:      timestamp("last_checked_at"),
    expiresAt:          timestamp("expires_at"),
    // null = no expiry (manually granted by admin)
    evidence:           jsonb("evidence"),
    // { dnsRecord, httpResponse, checkedFrom, checkedAt }
    notes:              text("notes"),
    createdAt:          timestamp("created_at").defaultNow().notNull(),
    updatedAt:          timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    index("verified_assets_user_idx").on(t.userId),
    index("verified_assets_value_idx").on(t.value),
    index("verified_assets_status_idx").on(t.verificationStatus),
  ],
);

export type VerifiedAsset    = typeof verifiedAssetsTable.$inferSelect;
export type NewVerifiedAsset = typeof verifiedAssetsTable.$inferInsert;
