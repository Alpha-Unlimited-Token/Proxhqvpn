// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Entitlement service — resolves feature access for tenants and users.
// Admin users (req.__isAdmin) bypass all feature checks; see requireFeature.ts.
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { PRODUCT_CATALOG, type FeatureKey, type ProductKey } from "../commercial/productCatalog";
import { isKnownFeature } from "../commercial/featureRegistry";

export type EntitlementProfile = {
  tenantId?: string | null;
  userId?: string | null;
  features: Partial<Record<FeatureKey, boolean>>;
  limits: Record<string, unknown>;
  products: ProductKey[];
};

// ── Seed product catalog ──────────────────────────────────────────────────────
export async function seedProductCatalog(): Promise<{ ok: boolean; products: number }> {
  for (const product of PRODUCT_CATALOG) {
    await db.execute(sql`
      INSERT INTO subscription_products
        (id, product_key, name, product_type, monthly_price_cents, yearly_price_cents,
         per_user_monthly_cents, min_users, metadata)
      VALUES
        (${randomUUID()}, ${product.key}, ${product.name}, ${product.type},
         ${product.monthlyPriceCents ?? null}, ${product.yearlyPriceCents ?? null},
         ${product.perUserMonthlyCents ?? null}, ${product.minUsers ?? 1},
         ${JSON.stringify(product.limits ?? {})}::jsonb)
      ON CONFLICT (product_key) DO UPDATE SET
        name                  = EXCLUDED.name,
        product_type          = EXCLUDED.product_type,
        monthly_price_cents   = EXCLUDED.monthly_price_cents,
        yearly_price_cents    = EXCLUDED.yearly_price_cents,
        per_user_monthly_cents= EXCLUDED.per_user_monthly_cents,
        min_users             = EXCLUDED.min_users,
        metadata              = EXCLUDED.metadata,
        updated_at            = NOW()
    `);

    for (const feature of product.features) {
      await db.execute(sql`
        INSERT INTO subscription_features (id, product_key, feature_key, enabled, limits)
        VALUES (${randomUUID()}, ${product.key}, ${feature}, TRUE, ${JSON.stringify(product.limits ?? {})}::jsonb)
        ON CONFLICT (product_key, feature_key)
        DO UPDATE SET enabled = TRUE, limits = EXCLUDED.limits
      `);
    }
  }

  return { ok: true, products: PRODUCT_CATALOG.length };
}

// ── Resolve entitlements for a user / tenant ──────────────────────────────────
export async function resolveEntitlements(input: {
  tenantId?: string | null;
  userId?: string | null;
}): Promise<EntitlementProfile> {
  const features: Partial<Record<FeatureKey, boolean>> = {};
  const limits: Record<string, unknown> = {};

  if (input.tenantId) {
    const tenantRows: any = await db.execute(sql`
      SELECT feature_key, limits
      FROM tenant_features
      WHERE tenant_id = ${input.tenantId}
        AND enabled = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
    `);
    for (const row of tenantRows.rows ?? []) {
      if (isKnownFeature(row.feature_key)) {
        features[row.feature_key as FeatureKey] = true;
        Object.assign(limits, row.limits ?? {});
      }
    }
  }

  if (input.userId) {
    const userRows: any = await db.execute(sql`
      SELECT feature_key, limits
      FROM user_features
      WHERE user_id = ${input.userId}
        AND (${input.tenantId ?? null} IS NULL OR tenant_id = ${input.tenantId ?? null})
        AND enabled = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
    `);
    for (const row of userRows.rows ?? []) {
      if (isKnownFeature(row.feature_key)) {
        features[row.feature_key as FeatureKey] = true;
        Object.assign(limits, row.limits ?? {});
      }
    }
  }

  return { tenantId: input.tenantId, userId: input.userId, features, limits, products: [] };
}

export async function hasFeature(input: {
  tenantId?: string | null;
  userId?: string | null;
  featureKey: FeatureKey;
}): Promise<boolean> {
  const profile = await resolveEntitlements(input);
  return !!profile.features[input.featureKey];
}

// ── Grant / revoke tenant features ───────────────────────────────────────────
export async function grantTenantFeature(input: {
  tenantId: string;
  featureKey: FeatureKey;
  actorUserId?: string | null;
  source?: string;
  limits?: Record<string, unknown>;
  expiresAt?: Date | null;
}): Promise<{ ok: boolean }> {
  if (!isKnownFeature(input.featureKey)) throw new Error("Unknown feature");

  await db.execute(sql`
    INSERT INTO tenant_features (id, tenant_id, feature_key, enabled, source, limits, expires_at)
    VALUES (${randomUUID()}, ${input.tenantId}, ${input.featureKey}, TRUE,
            ${input.source ?? "manual"}, ${JSON.stringify(input.limits ?? {})}::jsonb,
            ${input.expiresAt?.toISOString() ?? null})
    ON CONFLICT (tenant_id, feature_key)
    DO UPDATE SET enabled = TRUE, source = EXCLUDED.source,
                  limits = EXCLUDED.limits, expires_at = EXCLUDED.expires_at, updated_at = NOW()
  `);

  await recordEntitlementAudit({ ...input, action: "tenant_feature.granted" });
  return { ok: true };
}

export async function revokeTenantFeature(input: {
  tenantId: string;
  featureKey: FeatureKey;
  actorUserId?: string | null;
}): Promise<{ ok: boolean }> {
  await db.execute(sql`
    UPDATE tenant_features
    SET enabled = FALSE, updated_at = NOW()
    WHERE tenant_id = ${input.tenantId} AND feature_key = ${input.featureKey}
  `);

  await recordEntitlementAudit({ ...input, action: "tenant_feature.revoked" });
  return { ok: true };
}

// ── Grant user feature override ───────────────────────────────────────────────
export async function grantUserFeature(input: {
  userId: string;
  tenantId?: string | null;
  featureKey: FeatureKey;
  actorUserId?: string | null;
  source?: string;
  limits?: Record<string, unknown>;
  expiresAt?: Date | null;
}): Promise<{ ok: boolean }> {
  if (!isKnownFeature(input.featureKey)) throw new Error("Unknown feature");

  await db.execute(sql`
    INSERT INTO user_features (id, user_id, tenant_id, feature_key, enabled, source, limits, expires_at)
    VALUES (${randomUUID()}, ${input.userId}, ${input.tenantId ?? null}, ${input.featureKey},
            TRUE, ${input.source ?? "manual"}, ${JSON.stringify(input.limits ?? {})}::jsonb,
            ${input.expiresAt?.toISOString() ?? null})
    ON CONFLICT (user_id, tenant_id, feature_key)
    DO UPDATE SET enabled = TRUE, source = EXCLUDED.source,
                  limits = EXCLUDED.limits, expires_at = EXCLUDED.expires_at, updated_at = NOW()
  `);

  await recordEntitlementAudit({ ...input, targetUserId: input.userId, action: "user_feature.granted" });
  return { ok: true };
}

// ── Revoke user feature override ─────────────────────────────────────────────
export async function revokeUserFeature(input: {
  userId: string;
  tenantId?: string | null;
  featureKey: FeatureKey;
  actorUserId?: string | null;
}): Promise<{ ok: boolean }> {
  await db.execute(sql`
    UPDATE user_features
    SET enabled = FALSE, updated_at = NOW()
    WHERE user_id = ${input.userId}
      AND (${input.tenantId ?? null} IS NULL OR tenant_id = ${input.tenantId ?? null})
      AND feature_key = ${input.featureKey}
  `);

  await recordEntitlementAudit({ ...input, targetUserId: input.userId, action: "user_feature.revoked" });
  return { ok: true };
}

// ── Record feature usage event (metering) ────────────────────────────────────
export async function recordFeatureUsage(input: {
  userId?: string | null;
  tenantId?: string | null;
  featureKey: FeatureKey;
  metric: string;
  quantity?: number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.execute(sql`
    INSERT INTO feature_usage_events (id, tenant_id, user_id, feature_key, metric, quantity, metadata)
    VALUES (${randomUUID()}, ${input.tenantId ?? null}, ${input.userId ?? null},
            ${input.featureKey}, ${input.metric}, ${input.quantity ?? 1},
            ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);
}

// ── Entitlement audit log ─────────────────────────────────────────────────────
export async function recordEntitlementAudit(input: {
  actorUserId?: string | null;
  tenantId?: string | null;
  targetUserId?: string | null;
  action: string;
  featureKey?: string | null;
  productKey?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await db.execute(sql`
    INSERT INTO entitlement_audit_events
      (id, actor_user_id, tenant_id, target_user_id, action, feature_key, product_key, metadata)
    VALUES
      (${randomUUID()}, ${input.actorUserId ?? null}, ${input.tenantId ?? null},
       ${input.targetUserId ?? null}, ${input.action},
       ${input.featureKey ?? null}, ${input.productKey ?? null},
       ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);
}

// ── Upgrade recommendation — features denied to user ─────────────────────────
export async function getUpgradeRecommendations(userId: string): Promise<{
  deniedFeatures: string[];
  suggestedProducts: string[];
}> {
  const denied: any = await db.execute(sql`
    SELECT feature_key, COUNT(*) AS deny_count
    FROM entitlement_audit_events
    WHERE target_user_id = ${userId}
      AND action = 'feature.denied'
      AND created_at > NOW() - INTERVAL '30 days'
    GROUP BY feature_key
    ORDER BY deny_count DESC
    LIMIT 5
  `);

  const deniedFeatures = (denied.rows ?? []).map((r: any) => r.feature_key as string);

  const suggestedProducts = PRODUCT_CATALOG
    .filter((p) => deniedFeatures.some((f: string) => p.features.includes(f as FeatureKey)))
    .map((p) => p.key);

  return { deniedFeatures, suggestedProducts };
}
