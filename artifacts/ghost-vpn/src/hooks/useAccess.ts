// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface MeResponse {
  userId: string;
  email: string | null;
  isAdmin: boolean;
  isEmployee: boolean;
  isAdminEmployee: boolean;
  role: "owner" | "employee_admin" | "employee" | "subscriber" | null;
  hasAccess: boolean;
  hasSubscription: boolean;
  hasCommandCenter: boolean;
  tier: "vpn" | "command_center" | null;
}

export function useAccess() {
  const { isSignedIn } = useUser();

  const query = useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/me`, { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    enabled: !!isSignedIn,
    staleTime: 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
  });

  return {
    isAdmin: query.data?.isAdmin ?? false,
    isEmployee: query.data?.isEmployee ?? false,
    isAdminEmployee: query.data?.isAdminEmployee ?? false,
    role: query.data?.role ?? null,
    hasAccess: query.data?.hasAccess ?? false,
    hasSubscription: query.data?.hasSubscription ?? false,
    hasCommandCenter: query.data?.hasCommandCenter ?? false,
    tier: query.data?.tier ?? null,
    email: query.data?.email ?? null,
    isLoading: query.isLoading || query.isFetching,
  };
}
