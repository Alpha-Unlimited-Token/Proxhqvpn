// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Single, canonical frontend API client. All pages/components must use these
// helpers — never call fetch('/api/...') directly (see audit:frontend-api).

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export class ApiClientError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.payload = payload;
  }
}

/**
 * Normalise a caller-provided path so the URL is always `BASE/api/<path>`.
 * Handles three input shapes transparently:
 *   "/nodes"        → /api/nodes
 *   "/api/nodes"    → /api/nodes  (strip duplicate prefix)
 *   "https://..."   → returned unchanged (absolute URL passthrough)
 */
function normalizePath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const clean = path.startsWith("/") ? path : `/${path}`;
  // If the caller already included /api, keep it; otherwise prepend.
  if (clean === "/api" || clean.startsWith("/api/")) return clean;
  return `/api${clean}`;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = /^https?:\/\//i.test(path)
    ? path
    : `${BASE}${normalizePath(path)}`;

  const headers = new Headers(init.headers ?? {});
  if (!headers.has("Content-Type") && init.body) {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(url, {
    credentials: "include",
    ...init,
    headers,
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const message =
      (data as any)?.error?.message ??
      (data as any)?.error ??
      (data as any)?.message ??
      `API request failed: HTTP ${res.status}`;
    throw new ApiClientError(message, res.status, data);
  }

  return data as T;
}

// ── Convenience helpers ───────────────────────────────────────────────────────

export function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: "PATCH",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export function apiDelete<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "DELETE" });
}
