import { apiFetch } from "@/lib/apiClient";

export function captureFrontendEvent(input: {
  type: string;
  severity?: "info" | "warn" | "error";
  metadata?: Record<string, unknown>;
}) {
  void apiFetch("/frontend-events", {
    method: "POST",
    body: JSON.stringify({
      type: input.type,
      severity: input.severity ?? "info",
      metadata: input.metadata ?? {},
      occurredAt: new Date().toISOString(),
    }),
  }).catch(() => {
    // telemetry must never break UI
  });
}

export function captureFrontendError(error: unknown, metadata?: Record<string, unknown>) {
  captureFrontendEvent({
    type: "frontend.error",
    severity: "error",
    metadata: {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      ...metadata,
    },
  });
}
