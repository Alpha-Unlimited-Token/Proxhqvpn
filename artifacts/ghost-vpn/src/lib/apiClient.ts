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

  const res = await fetch(`${BASE}/api${normalized}`, {
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
