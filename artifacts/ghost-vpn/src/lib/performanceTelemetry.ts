import { captureFrontendEvent } from "./frontendTelemetry";

export function reportWebVitals() {
  if (!("PerformanceObserver" in window)) return;

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      captureFrontendEvent({
        type: "frontend.performance",
        severity: "info",
        metadata: {
          name: entry.name,
          entryType: entry.entryType,
          startTime: entry.startTime,
          duration: entry.duration,
        },
      });
    }
  });

  try {
    observer.observe({ entryTypes: ["navigation", "paint", "largest-contentful-paint"] });
  } catch {
    // unsupported entry type in some browsers
  }
}
