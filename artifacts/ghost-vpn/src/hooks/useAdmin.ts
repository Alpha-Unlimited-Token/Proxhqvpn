import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface MeResponse {
  userId: string;
  email: string | null;
  isAdmin: boolean;
}

export function useAdmin() {
  const { isSignedIn } = useUser();

  const query = useQuery<MeResponse>({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await fetch(`${BASE}/api/me`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch user info");
      return res.json();
    },
    enabled: !!isSignedIn,
    staleTime: 5 * 60 * 1000,
  });

  return {
    isAdmin: query.data?.isAdmin ?? false,
    email: query.data?.email ?? null,
    isLoading: query.isLoading,
  };
}
