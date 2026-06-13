// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
const SECURITY_API_BASE = import.meta.env.VITE_SECURITY_API_BASE;

if (!SECURITY_API_BASE) {
  throw new Error("Missing VITE_SECURITY_API_BASE");
}

if (SECURITY_API_BASE.includes("prox") && !SECURITY_API_BASE.includes("security")) {
  console.warn(
    "VITE_SECURITY_API_BASE looks like a customer/public API. Security Console should point to an isolated security API.",
  );
}

export async function securityApiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const res = await fetch(`${SECURITY_API_BASE}${normalizedPath}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data?.error || `Security API error: HTTP ${res.status}`);
  }

  return data as T;
}
