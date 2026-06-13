import { useEffect, useState } from "react";

export function useRealtimeEvents(enabled = true) {
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const source = new EventSource("/api/realtime/events");

    source.addEventListener("platform-events", (event) => {
      const payload = JSON.parse((event as MessageEvent).data);
      setEvents(payload.events ?? []);
    });

    return () => source.close();
  }, [enabled]);

  return events;
}
