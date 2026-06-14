const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export class ApiClientError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  // Guard against callers that already include the /api prefix — strip it to
  // avoid building /api/api/... URLs. The regex only matches /api at the start
  // when followed by "/" or end-of-string, so /api-keys etc. are unaffected.
  const apiPath = normalized.replace(/^\/api(?=\/|$)/, "") || "/";

  const res = await fetch(`${BASE}/api${apiPath}`, {
    credentials: "include",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message =
      data?.error?.message ??
      data?.error ??
      `API request failed: HTTP ${res.status}`;

    throw new ApiClientError(message, res.status, data);
  }

  return data as T;
}
