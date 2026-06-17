import type { UxMode } from "./modes";

export type NavItemPolicy = {
  route: string;
  modes: UxMode[];
  requiredCapability?: string;
  hiddenForConsumer?: boolean;
};

const securityOnlyRoutes = [
  "/command-center",
  "/ghost-trap",
  "/ghost-nodes",
  "/security-graph",
  "/siem",
  "/threat-intel",
  "/node-management",
  "/firewall",
  "/ghost-chain",
  "/ghost-trace",
  "/osint",
  "/canary",
  "/security-dashboard-v2",
  "/detection-rules",
  "/cases",
  "/playbooks",
  "/containment",
];

const businessHiddenRoutes = [
  "/ghost",
  "/ghost-trap",
  "/ghost-nodes",
  "/ghost-chain",
  "/ghost-trace",
  "/osint",
  "/canary",
  "/silkweb",
  "/beacons",
  "/alpha-tools",
  "/sqlmap",
  "/parrot-tools",

  "/lab-targets",
  "/hack-anon",
];

export function shouldShowRoute(input: {
  route: string;
  mode: UxMode;
  capabilities?: string[];
}): boolean {
  if (
    input.mode === "consumer" &&
    securityOnlyRoutes.some((r) => input.route.startsWith(r))
  ) {
    return false;
  }

  if (input.mode === "business") {
    if (businessHiddenRoutes.some((r) => input.route.startsWith(r))) {
      return false;
    }
  }

  return true;
}
