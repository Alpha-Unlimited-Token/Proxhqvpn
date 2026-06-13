// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { Capability } from "@workspace/capabilities";

export type ApiRouteCapability = {
  mountPath: string;
  capability: Capability;
  notes?: string;
};

export const apiRouteCapabilities: ApiRouteCapability[] = [
  { mountPath: "/healthz", capability: "public.read" },
  { mountPath: "/my-ip", capability: "public.read" },
  { mountPath: "/updates", capability: "public.read" },
  { mountPath: "/update/check", capability: "public.read" },
  { mountPath: "/anon", capability: "public.read" },
  { mountPath: "/ambassadors", capability: "public.read" },
  { mountPath: "/stripe", capability: "public.read" },
  { mountPath: "/payments/crypto", capability: "public.read" },
  { mountPath: "/notifications", capability: "public.read" },

  { mountPath: "/me", capability: "auth.read" },
  { mountPath: "/account-security", capability: "vpn.read" },

  { mountPath: "/killswitch", capability: "vpn.write" },
  { mountPath: "/leaks", capability: "vpn.read" },
  { mountPath: "/split-tunnel", capability: "vpn.write" },
  { mountPath: "/obfuscation", capability: "vpn.write" },
  { mountPath: "/daemon", capability: "vpn.write" },
  { mountPath: "/vpn-coexist", capability: "vpn.write" },
  { mountPath: "/vpngate", capability: "vpn.write" },
  { mountPath: "/devices", capability: "vpn.write" },
  { mountPath: "/dns-shield", capability: "vpn.write" },
  { mountPath: "/smart-dns", capability: "vpn.write" },
  { mountPath: "/router-config", capability: "vpn.write" },
  { mountPath: "/wireguard", capability: "vpn.write" },
  { mountPath: "/threat-protection", capability: "vpn.read" },
  { mountPath: "/proxy-browser", capability: "vpn.read" },

  { mountPath: "/threatintel", capability: "command_center.read" },
  { mountPath: "/security-audit", capability: "command_center.write" },
  { mountPath: "/tool-runner", capability: "command_center.write" },
  { mountPath: "/http-probe", capability: "command_center.write" },
  { mountPath: "/dir-fuzzer", capability: "command_center.write" },
  { mountPath: "/subdomain-scan", capability: "command_center.write" },
  { mountPath: "/intruder", capability: "command_center.write" },
  { mountPath: "/waf", capability: "command_center.write" },
  { mountPath: "/waf-bypass", capability: "command_center.write" },
  { mountPath: "/sqli-scanner", capability: "command_center.write" },
  { mountPath: "/sast", capability: "command_center.write" },
  { mountPath: "/siem", capability: "command_center.read" },
  { mountPath: "/events", capability: "command_center.read" },

  { mountPath: "/nodes", capability: "admin.write" },
  { mountPath: "/terminal", capability: "terminal.exec" },
  { mountPath: "/sql", capability: "sql.exec" },
  { mountPath: "/admin/users", capability: "admin.write" },
  { mountPath: "/employees", capability: "admin.write" },
  { mountPath: "/setup", capability: "admin.write" },

  { mountPath: "/node-cracker", capability: "security_lab.admin" },
  { mountPath: "/dev-audit", capability: "security_lab.admin" },
  { mountPath: "/omega", capability: "omega.admin" },
];

export function getApiRouteCapability(path: string): ApiRouteCapability | undefined {
  return apiRouteCapabilities
    .filter((route) => path === route.mountPath || path.startsWith(`${route.mountPath}/`))
    .sort((a, b) => b.mountPath.length - a.mountPath.length)[0];
}
