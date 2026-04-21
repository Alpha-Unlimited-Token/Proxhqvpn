import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export interface MeResponse {
  userId: string;
  email: string | null;
  isAdmin: boolean;
  isEmployee: boolean;
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
      if (!res.ok) throw new Error("Failed to fetch user info");
      return res.json();
    },
    enabled: !!isSignedIn,
    staleTime: 60 * 1000,
  });

  return {
    isAdmin: query.data?.isAdmin ?? false,
    isEmployee: query.data?.isEmployee ?? false,
    hasAccess: query.data?.hasAccess ?? false,
    hasSubscription: query.data?.hasSubscription ?? false,
    hasCommandCenter: query.data?.hasCommandCenter ?? false,
    tier: query.data?.tier ?? null,
    email: query.data?.email ?? null,
    isLoading: query.isLoading || query.isFetching,
  };
}
