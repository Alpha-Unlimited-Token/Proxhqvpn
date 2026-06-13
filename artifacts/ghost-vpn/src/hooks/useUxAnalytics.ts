// UX analytics instrumentation — P324
// Tracks adoption friction events without collecting sensitive data.
// Uses existing telemetry infrastructure (PostHog/analytics) if available,
// otherwise fires a fire-and-forget beacon to /api/telemetry/ux-event.

const BASE_PATH = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export type UxEvent =
  | "onboarding_started"
  | "onboarding_completed"
  | "vpn_connect_clicked"
  | "vpn_connect_success"
  | "vpn_connect_failed"
  | "mode_changed"
  | "trust_center_viewed"
  | "command_center_viewed"
  | "ghost_trap_viewed";

function fire(event: UxEvent, props?: Record<string, string | number | boolean>) {
  const payload = {
    event,
    ts: Date.now(),
    ...(props ?? {}),
  };

  if (typeof window === "undefined") return;

  // Use PostHog if configured
  const ph = (window as any).posthog;
  if (ph?.capture) {
    ph.capture(event, payload);
    return;
  }

  // Fallback: beacon to /api/telemetry/ux-event (best-effort, no await)
  const url = `${BASE_PATH}/api/telemetry/ux-event`;
  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, JSON.stringify(payload));
  } else {
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  }
}

export function useUxAnalytics() {
  return { track: fire };
}
