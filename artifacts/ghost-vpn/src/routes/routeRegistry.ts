// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.

export type RouteAccess =
  | "public"
  | "authenticated"
  | "vpn"
  | "command_center"
  | "admin";

export type RouteGroup =
  | "public"
  | "account"
  | "vpn"
  | "privacy"
  | "command_center"
  | "security_tools"
  | "admin"
  | "omega";

export type AppRouteMeta = {
  path: string;
  label: string;
  access: RouteAccess;
  group: RouteGroup;
  nav?: boolean;
  risk?: "low" | "medium" | "high" | "critical";
};

export const routeRegistry: AppRouteMeta[] = [
  { path: "/", label: "Home", access: "public", group: "public", nav: false },
  { path: "/pricing", label: "Pricing", access: "public", group: "public", nav: true },
  { path: "/downloads", label: "Downloads", access: "public", group: "public", nav: true },
  { path: "/guide", label: "User Guide", access: "public", group: "public", nav: true },

  { path: "/account", label: "Account", access: "authenticated", group: "account", nav: true },
  { path: "/app", label: "App", access: "authenticated", group: "account", nav: false },

  { path: "/my-vpn", label: "My VPN", access: "vpn", group: "vpn", nav: true },
  { path: "/wireguard", label: "WireGuard", access: "vpn", group: "vpn", nav: true },
  { path: "/kill-switch", label: "Kill Switch", access: "vpn", group: "vpn", nav: true },
  { path: "/leaks", label: "Leak Detection", access: "vpn", group: "vpn", nav: true },
  { path: "/dns-shield", label: "DNS Shield", access: "vpn", group: "vpn", nav: true },
  { path: "/devices", label: "Devices", access: "vpn", group: "vpn", nav: true },
  { path: "/split-tunnel", label: "Split Tunnel", access: "vpn", group: "vpn", nav: true },
  { path: "/vpngate", label: "VPNGate", access: "vpn", group: "vpn", nav: true },
  { path: "/obfuscation", label: "Obfuscation", access: "vpn", group: "vpn", nav: true },
  { path: "/router-config", label: "Router Config", access: "vpn", group: "vpn", nav: true },
  { path: "/smart-dns", label: "Smart DNS", access: "vpn", group: "vpn", nav: true },
  { path: "/onion-browser", label: "Onion Browser", access: "vpn", group: "privacy", nav: true },
  { path: "/pqc", label: "Post Quantum", access: "vpn", group: "privacy", nav: true },
  { path: "/daita", label: "DAITA", access: "vpn", group: "privacy", nav: true },
  { path: "/dark-web", label: "Dark Web Monitor", access: "vpn", group: "privacy", nav: true },
  { path: "/alt-id", label: "Alt Identity", access: "vpn", group: "privacy", nav: true },
  { path: "/ip-rotator", label: "IP Rotator", access: "vpn", group: "privacy", nav: true },

  { path: "/dashboard", label: "Command Center", access: "command_center", group: "command_center", nav: true },
  { path: "/threat-intel", label: "Threat Intel", access: "command_center", group: "command_center", nav: true },
  { path: "/security-audit", label: "Security Audit", access: "command_center", group: "security_tools", nav: true },
  { path: "/http-probe", label: "HTTP Probe", access: "command_center", group: "security_tools", nav: true },
  { path: "/dir-fuzzer", label: "Directory Fuzzer", access: "command_center", group: "security_tools", nav: true, risk: "high" },
  { path: "/subdomain-scan", label: "Subdomain Scan", access: "command_center", group: "security_tools", nav: true },
  { path: "/intruder", label: "Intruder", access: "command_center", group: "security_tools", nav: true, risk: "high" },
  { path: "/waf", label: "WAF Analyzer", access: "command_center", group: "security_tools", nav: true },
  { path: "/waf-bypass", label: "WAF Bypass", access: "command_center", group: "security_tools", nav: true, risk: "high" },
  { path: "/sqli-scanner", label: "SQLi Scanner", access: "command_center", group: "security_tools", nav: true, risk: "high" },
  { path: "/sast", label: "SAST Analyzer", access: "command_center", group: "security_tools", nav: true },
  { path: "/siem", label: "SIEM", access: "command_center", group: "command_center", nav: true },
  { path: "/event-graph", label: "Event Graph", access: "command_center", group: "command_center", nav: true },
  { path: "/service-bus", label: "Service Bus", access: "command_center", group: "command_center", nav: true },

  { path: "/nodes", label: "Nodes", access: "admin", group: "admin", nav: true },
  { path: "/terminal", label: "Terminal", access: "admin", group: "admin", nav: true, risk: "critical" },
  { path: "/sql", label: "SQL Console", access: "admin", group: "admin", nav: true, risk: "critical" },
  { path: "/employees", label: "Employees", access: "admin", group: "admin", nav: true },
  { path: "/setup", label: "Setup", access: "admin", group: "admin", nav: true },

  { path: "/omega-dashboard", label: "Omega Dashboard", access: "admin", group: "omega", nav: false, risk: "critical" },
  { path: "/omega-hosts", label: "Omega Hosts", access: "admin", group: "omega", nav: false, risk: "critical" },
  { path: "/omega-keylogger", label: "Omega Keylogger", access: "admin", group: "omega", nav: false, risk: "critical" },
  { path: "/omega-screen-capture", label: "Omega Screen Capture", access: "admin", group: "omega", nav: false, risk: "critical" },
  { path: "/omega-file-manager", label: "Omega File Manager", access: "admin", group: "omega", nav: false, risk: "critical" },
  { path: "/omega-remote-commands", label: "Omega Remote Commands", access: "admin", group: "omega", nav: false, risk: "critical" },
];

export function getRouteMeta(path: string): AppRouteMeta | undefined {
  return routeRegistry.find((route) => route.path === path);
}

export function getNavRoutes(group?: RouteGroup): AppRouteMeta[] {
  return routeRegistry.filter(
    (route) => route.nav && (!group || route.group === group),
  );
}

export function getRoutesByAccess(access: RouteAccess): AppRouteMeta[] {
  return routeRegistry.filter((route) => route.access === access);
}
