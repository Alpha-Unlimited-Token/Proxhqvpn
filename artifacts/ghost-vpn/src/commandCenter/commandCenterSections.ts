export const commandCenterSections = [
  {
    label: "Overview",
    routes: ["/command-center", "/security-dashboard-v2", "/validation"],
  },
  {
    label: "Deception",
    routes: ["/ghost-nodes", "/ghost-trap", "/ghost-trap/events", "/ghost-trap/evidence"],
  },
  {
    label: "Detection",
    routes: ["/siem", "/security-graph", "/threat-intel", "/detection-rules"],
  },
  {
    label: "Response",
    routes: ["/cases", "/playbooks", "/containment", "/reports"],
  },
  {
    label: "Infrastructure",
    routes: ["/node-management", "/firewall", "/dns", "/control-plane"],
  },
] as const;

export type CommandCenterSection = (typeof commandCenterSections)[number];
