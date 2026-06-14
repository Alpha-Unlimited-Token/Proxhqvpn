// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useEffect, useState } from "react";
import type { SecurityEventLine } from "@/components/security-ops/EventTerminal";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function useSecurityOpsEvents(enabled = true) {
  const [events, setEvents] = useState<SecurityEventLine[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource(`${BASE}/api/realtime/events`);
    setLoading(true);

    source.addEventListener("open", () => {
      setLoading(false);
      setError(null);
    });

    source.addEventListener("platform-events", (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data);
        const mapped = (payload.events ?? []).map((item: any) => ({
          id: String(item.id ?? crypto.randomUUID()),
          timestamp: item.created_at ?? item.createdAt ?? new Date().toISOString(),
          severity: item.severity ?? "info",
          message: item.type ?? item.message ?? "platform.event",
          source: item.subject ?? item.actor ?? undefined,
        }));
        setEvents((prev) => [...prev, ...mapped].slice(-250));
      } catch {
        setError("Received malformed realtime event payload.");
      }
    });

    source.addEventListener("error", () => {
      setLoading(false);
      setError("Realtime stream disconnected. Retrying automatically.");
    });

    return () => source.close();
  }, [enabled]);

  return { events, loading, error };
}
