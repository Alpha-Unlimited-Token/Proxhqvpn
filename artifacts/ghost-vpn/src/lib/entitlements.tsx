// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Frontend entitlement provider — resolves which commercial features the signed-in user has.
import React, { createContext, useContext, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";

export type FeatureKey =
  | "vpn"
  | "vpn_pro"
  | "firewall"
  | "privacy"
  | "developer"
  | "api_access"
  | "device_management"
  | "rbac"
  | "zero_trust"
  | "command_center"
  | "siem"
  | "ghost_nodes"
  | "ghost_trap"
  | "audit_chain"
  | "compliance"
  | "trust_center"
  | "node_management"
  | "security_console";

type EntitlementResponse = {
  features: Partial<Record<FeatureKey, boolean>>;
  limits: Record<string, unknown>;
  isAdmin?: boolean;
};

const EntitlementContext = createContext<{
  features: Partial<Record<FeatureKey, boolean>>;
  limits: Record<string, unknown>;
  hasFeature: (feature: FeatureKey) => boolean;
  isAdmin: boolean;
  loading: boolean;
} | null>(null);

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const query = useQuery<EntitlementResponse>({
    queryKey: ["entitlements", "me"],
    queryFn: () => apiFetch<EntitlementResponse>("/entitlements/me"),
    staleTime: 60_000,
    retry: false,
  });

  const value = useMemo(() => {
    const features = query.data?.features ?? {};
    const isAdmin = query.data?.isAdmin ?? false;
    return {
      features,
      limits: query.data?.limits ?? {},
      hasFeature: (feature: FeatureKey) => isAdmin || !!features[feature],
      isAdmin,
      loading: query.isLoading,
    };
  }, [query.data, query.isLoading]);

  return <EntitlementContext.Provider value={value}>{children}</EntitlementContext.Provider>;
}

export function useEntitlements() {
  const ctx = useContext(EntitlementContext);
  if (!ctx) throw new Error("useEntitlements must be used inside EntitlementProvider");
  return ctx;
}

export function RequireFeature({
  feature,
  children,
  fallback,
}: {
  feature: FeatureKey;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasFeature, loading } = useEntitlements();
  if (loading) return null;
  if (!hasFeature(feature)) return <>{fallback ?? <UpgradeRequired feature={feature} />}</>;
  return <>{children}</>;
}

export function UpgradeRequired({ feature }: { feature: FeatureKey }) {
  return (
    <div className="rounded-2xl border border-yellow-400/30 bg-yellow-950/20 p-6 text-white">
      <div className="text-xs font-semibold uppercase tracking-[0.3em] text-yellow-300">
        Upgrade Required
      </div>
      <h1 className="mt-3 text-2xl font-bold">
        This feature is not included in your current plan.
      </h1>
      <p className="mt-2 text-sm text-white/60">
        Required feature:{" "}
        <span className="font-mono text-yellow-200">{feature}</span>
      </p>
      <a
        href="/pricing"
        className="mt-5 inline-flex items-center rounded-lg bg-yellow-300 px-4 py-2 text-sm font-semibold text-black hover:bg-yellow-200"
      >
        View Plans →
      </a>
    </div>
  );
}
