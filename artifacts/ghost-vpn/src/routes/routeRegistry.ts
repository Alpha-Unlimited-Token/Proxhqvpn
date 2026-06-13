// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Capability } from "@workspace/capabilities";

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
  capability?: Capability;
  nav?: boolean;
  navSection?: string;
  risk?: "low" | "medium" | "high" | "critical";
};

export const routeRegistry: AppRouteMeta[] = [
  { path: "/pricing", label: "Pricing", access: "public", group: "public", capability: "public.read", nav: true, navSection: "Public" },
  { path: "/downloads", label: "Downloads", access: "public", group: "public", capability: "public.read", nav: true, navSection: "Public" },
  { path: "/guide", label: "User Guide", access: "public", group: "public", capability: "public.read", nav: true, navSection: "Public" },

  { path: "/account", label: "Account", access: "authenticated", group: "account", capability: "auth.read", nav: true, navSection: "Account" },

  { path: "/my-vpn", label: "My VPN", access: "vpn", group: "vpn", capability: "vpn.read", nav: true, navSection: "VPN" },
  { path: "/wireguard", label: "WireGuard", access: "vpn", group: "vpn", capability: "vpn.write", nav: true, navSection: "VPN" },
  { path: "/kill-switch", label: "Kill Switch", access: "vpn", group: "vpn", capability: "vpn.write", nav: true, navSection: "VPN" },
  { path: "/leaks", label: "Leak Detection", access: "vpn", group: "vpn", capability: "vpn.read", nav: true, navSection: "VPN" },
  { path: "/dns-shield", label: "DNS Shield", access: "vpn", group: "vpn", capability: "vpn.write", nav: true, navSection: "VPN" },
  { path: "/devices", label: "Devices", access: "vpn", group: "vpn", capability: "vpn.write", nav: true, navSection: "VPN" },
  { path: "/split-tunnel", label: "Split Tunnel", access: "vpn", group: "vpn", capability: "vpn.write", nav: true, navSection: "VPN" },
  { path: "/vpngate", label: "VPNGate", access: "vpn", group: "vpn", capability: "vpn.write", nav: true, navSection: "VPN" },
  { path: "/obfuscation", label: "Obfuscation", access: "vpn", group: "vpn", capability: "vpn.write", nav: true, navSection: "VPN" },
  { path: "/router-config", label: "Router Config", access: "vpn", group: "vpn", capability: "vpn.write", nav: true, navSection: "VPN" },
  { path: "/smart-dns", label: "Smart DNS", access: "vpn", group: "vpn", capability: "vpn.write", nav: true, navSection: "VPN" },

  { path: "/onion-browser", label: "Onion Browser", access: "vpn", group: "privacy", capability: "vpn.read", nav: true, navSection: "Privacy" },
  { path: "/pqc", label: "Post Quantum", access: "vpn", group: "privacy", capability: "vpn.read", nav: true, navSection: "Privacy" },
  { path: "/daita", label: "DAITA", access: "vpn", group: "privacy", capability: "vpn.read", nav: true, navSection: "Privacy" },
  { path: "/dark-web", label: "Dark Web Monitor", access: "vpn", group: "privacy", capability: "vpn.read", nav: true, navSection: "Privacy" },
  { path: "/alt-id", label: "Alt Identity", access: "vpn", group: "privacy", capability: "vpn.read", nav: true, navSection: "Privacy" },
  { path: "/ip-rotator", label: "IP Rotator", access: "vpn", group: "privacy", capability: "vpn.write", nav: true, navSection: "Privacy" },

  { path: "/dashboard", label: "Command Center", access: "command_center", group: "command_center", capability: "command_center.read", nav: true, navSection: "Command Center" },
  { path: "/threat-intel", label: "Threat Intel", access: "command_center", group: "command_center", capability: "command_center.read", nav: true, navSection: "Command Center" },
  { path: "/siem", label: "SIEM", access: "command_center", group: "command_center", capability: "command_center.read", nav: true, navSection: "Command Center" },
  { path: "/event-graph", label: "Event Graph", access: "command_center", group: "command_center", capability: "command_center.read", nav: true, navSection: "Command Center" },
  { path: "/service-bus", label: "Service Bus", access: "command_center", group: "command_center", capability: "command_center.read", nav: true, navSection: "Command Center" },

  { path: "/security-audit", label: "Security Audit", access: "command_center", group: "security_tools", capability: "command_center.write", nav: true, navSection: "Security Tools" },
  { path: "/http-probe", label: "HTTP Probe", access: "command_center", group: "security_tools", capability: "command_center.write", nav: true, navSection: "Security Tools" },
  { path: "/dir-fuzzer", label: "Directory Fuzzer", access: "command_center", group: "security_tools", capability: "command_center.write", nav: true, navSection: "Security Tools", risk: "high" },
  { path: "/subdomain-scan", label: "Subdomain Scan", access: "command_center", group: "security_tools", capability: "command_center.write", nav: true, navSection: "Security Tools" },
  { path: "/intruder", label: "Intruder", access: "command_center", group: "security_tools", capability: "command_center.write", nav: true, navSection: "Security Tools", risk: "high" },
  { path: "/waf", label: "WAF Analyzer", access: "command_center", group: "security_tools", capability: "command_center.write", nav: true, navSection: "Security Tools" },
  { path: "/waf-bypass", label: "WAF Bypass", access: "command_center", group: "security_tools", capability: "command_center.write", nav: true, navSection: "Security Tools", risk: "high" },
  { path: "/sqli-scanner", label: "SQLi Scanner", access: "command_center", group: "security_tools", capability: "command_center.write", nav: true, navSection: "Security Tools", risk: "high" },
  { path: "/sast", label: "SAST Analyzer", access: "command_center", group: "security_tools", capability: "command_center.write", nav: true, navSection: "Security Tools" },

  { path: "/nodes", label: "Nodes", access: "admin", group: "admin", capability: "admin.write", nav: true, navSection: "Admin" },
  { path: "/terminal", label: "Terminal", access: "admin", group: "admin", capability: "terminal.exec", nav: true, navSection: "Admin", risk: "critical" },
  { path: "/sql", label: "SQL Console", access: "admin", group: "admin", capability: "sql.exec", nav: true, navSection: "Admin", risk: "critical" },
  { path: "/employees", label: "Employees", access: "admin", group: "admin", capability: "admin.write", nav: true, navSection: "Admin" },
  { path: "/setup", label: "Setup", access: "admin", group: "admin", capability: "admin.write", nav: true, navSection: "Admin" },

  // Omega routes moved to artifacts/security-console.
  // Do not expose in customer SPA route registry.
  { path: "/omega-dashboard", label: "Omega Dashboard", access: "admin", group: "omega", capability: "omega.admin", nav: false, risk: "critical" },
  { path: "/omega-hosts", label: "Omega Hosts", access: "admin", group: "omega", capability: "omega.admin", nav: false, risk: "critical" },
  { path: "/omega-keylogger", label: "Omega Keylogger", access: "admin", group: "omega", capability: "omega.admin", nav: false, risk: "critical" },
  { path: "/omega-screen-capture", label: "Omega Screen Capture", access: "admin", group: "omega", capability: "omega.admin", nav: false, risk: "critical" },
  { path: "/omega-file-manager", label: "Omega File Manager", access: "admin", group: "omega", capability: "omega.admin", nav: false, risk: "critical" },
  { path: "/omega-remote-commands", label: "Omega Remote Commands", access: "admin", group: "omega", capability: "omega.admin", nav: false, risk: "critical" },
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

export function getNavSections(): Array<{
  title: string;
  routes: AppRouteMeta[];
}> {
  const sections = new Map<string, AppRouteMeta[]>();

  for (const route of routeRegistry) {
    if (!route.nav || !route.navSection) continue;
    const existing = sections.get(route.navSection) ?? [];
    existing.push(route);
    sections.set(route.navSection, existing);
  }

  return Array.from(sections.entries()).map(([title, routes]) => ({
    title,
    routes,
  }));
}
