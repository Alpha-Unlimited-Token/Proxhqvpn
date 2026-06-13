import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiClient";

export function useApiQuery<T>(
  queryKey: readonly unknown[],
  path: string,
  options?: Omit<UseQueryOptions<T>, "queryKey" | "queryFn">,
) {
  return useQuery<T>({
    queryKey,
    queryFn: () => apiFetch<T>(path),
    ...options,
  });
}
