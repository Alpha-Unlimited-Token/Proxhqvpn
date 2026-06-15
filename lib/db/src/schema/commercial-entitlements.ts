// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Commercial entitlements schema — subscription products, feature grants, usage events.
import { pgTable, text, boolean, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

// ── subscription_products — master product catalog ────────────────────────────
export const subscriptionProductsTable = pgTable("subscription_products", {
  id:                  text("id").primaryKey(),
  productKey:          text("product_key").notNull().unique(),
  name:                text("name").notNull(),
  description:         text("description"),
  productType:         text("product_type").notNull(),
  monthlyPriceCents:   integer("monthly_price_cents"),
  yearlyPriceCents:    integer("yearly_price_cents"),
  perUserMonthlyCents: integer("per_user_monthly_cents"),
  minUsers:            integer("min_users").notNull().default(1),
  status:              text("status").notNull().default("active"),
  metadata:            jsonb("metadata").notNull().default({}),
  createdAt:           timestamp("created_at").defaultNow().notNull(),
  updatedAt:           timestamp("updated_at").defaultNow().notNull(),
});

// ── subscription_features — features included in each product ─────────────────
export const subscriptionFeaturesTable = pgTable("subscription_features", {
  id:         text("id").primaryKey(),
  productKey: text("product_key").notNull(),
  featureKey: text("feature_key").notNull(),
  enabled:    boolean("enabled").notNull().default(true),
  limits:     jsonb("limits").notNull().default({}),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});

// ── tenant_features — tenant-wide feature grants/revocations ──────────────────
export const tenantFeaturesTable = pgTable("tenant_features", {
  id:         text("id").primaryKey(),
  tenantId:   text("tenant_id").notNull(),
  featureKey: text("feature_key").notNull(),
  enabled:    boolean("enabled").notNull().default(true),
  source:     text("source").notNull().default("subscription"),
  limits:     jsonb("limits").notNull().default({}),
  expiresAt:  timestamp("expires_at"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
});

// ── user_features — per-user overrides and trials ─────────────────────────────
export const userFeaturesTable = pgTable("user_features", {
  id:         text("id").primaryKey(),
  userId:     text("user_id").notNull(),
  tenantId:   text("tenant_id"),
  featureKey: text("feature_key").notNull(),
  enabled:    boolean("enabled").notNull().default(true),
  source:     text("source").notNull().default("override"),
  limits:     jsonb("limits").notNull().default({}),
  expiresAt:  timestamp("expires_at"),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
  updatedAt:  timestamp("updated_at").defaultNow().notNull(),
});

// ── entitlement_audit_events — who granted/revoked/denied what ────────────────
export const entitlementAuditEventsTable = pgTable("entitlement_audit_events", {
  id:            text("id").primaryKey(),
  actorUserId:   text("actor_user_id"),
  tenantId:      text("tenant_id"),
  targetUserId:  text("target_user_id"),
  action:        text("action").notNull(),
  featureKey:    text("feature_key"),
  productKey:    text("product_key"),
  metadata:      jsonb("metadata").notNull().default({}),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});

// ── feature_usage_events — metered usage for billing analytics ────────────────
export const featureUsageEventsTable = pgTable("feature_usage_events", {
  id:         text("id").primaryKey(),
  tenantId:   text("tenant_id"),
  userId:     text("user_id"),
  featureKey: text("feature_key").notNull(),
  metric:     text("metric").notNull(),
  quantity:   integer("quantity").notNull().default(1),
  metadata:   jsonb("metadata").notNull().default({}),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});
