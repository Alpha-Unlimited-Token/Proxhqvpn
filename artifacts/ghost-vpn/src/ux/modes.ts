export type UxMode = "consumer" | "business" | "security";

export const uxModes = {
  consumer: {
    label: "VPN",
    description: "Simple personal VPN experience",
    defaultRoute: "/dashboard",
  },
  business: {
    label: "Business",
    description: "Team, device, policy, and reporting tools",
    defaultRoute: "/business",
  },
  security: {
    label: "Security Ops",
    description: "Command Center, deception, SIEM, and investigations",
    defaultRoute: "/command-center",
  },
} as const;
