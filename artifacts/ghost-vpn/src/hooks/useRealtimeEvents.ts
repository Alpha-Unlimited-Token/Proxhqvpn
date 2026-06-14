// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useEffect, useRef, useState } from "react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const MAX_BUFFER = 250;

export type RealtimeStatus = "idle" | "connecting" | "open" | "error" | "closed";

export function useRealtimeEvents(enabled = true) {
  const [events, setEvents] = useState<unknown[]>([]);
  const [status, setStatus] = useState<RealtimeStatus>("idle");
  const sourceRef = useRef<EventSource | null>(null);
  const retryTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCount = useRef(0);
  const MAX_RETRIES = 5;

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    function connect() {
      sourceRef.current?.close();
      setStatus("connecting");

      const source = new EventSource(`${BASE}/api/realtime/events`, { withCredentials: true });
      sourceRef.current = source;

      source.onopen = () => {
        setStatus("open");
        retryCount.current = 0;
      };

      source.onerror = () => {
        source.close();
        setStatus("error");

        if (retryCount.current < MAX_RETRIES) {
          const delay = Math.min(1000 * 2 ** retryCount.current, 30_000);
          retryCount.current++;
          retryTimeout.current = setTimeout(connect, delay);
        } else {
          setStatus("closed");
        }
      };

      source.addEventListener("platform-events", (e) => {
        try {
          const payload = JSON.parse((e as MessageEvent).data);
          const incoming: unknown[] = Array.isArray(payload?.events) ? payload.events : [payload];
          setEvents((prev) => [...incoming, ...prev].slice(0, MAX_BUFFER));
        } catch {
          // Malformed JSON from SSE — ignore this frame, keep connection alive
        }
      });

      source.addEventListener("security-alert", (e) => {
        try {
          const payload = JSON.parse((e as MessageEvent).data);
          setEvents((prev) => [payload, ...prev].slice(0, MAX_BUFFER));
        } catch { /* ignore */ }
      });
    }

    connect();

    return () => {
      if (retryTimeout.current) clearTimeout(retryTimeout.current);
      sourceRef.current?.close();
      sourceRef.current = null;
      setStatus("closed");
    };
  }, [enabled]);

  function clearEvents() { setEvents([]); }

  return { events, status, clearEvents };
}
