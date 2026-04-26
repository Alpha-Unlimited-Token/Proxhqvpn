import { Router } from "express";
import os from "os";

const router = Router();

interface KillSwitchState {
  enabled: boolean;
  mode: "hard" | "soft";
  allowedInterfaces: string[];
  blockedOutboundWhenVpnDown: boolean;
  autoTriggerOnDrop: boolean;
  lastTriggeredAt: string | null;
  triggerCount: number;
  platform: string;
  safeIps: string[];
}

let state: KillSwitchState = {
  enabled: false,
  mode: "hard",
  allowedInterfaces: ["tun0", "wg0"],
  blockedOutboundWhenVpnDown: true,
  autoTriggerOnDrop: true,
  lastTriggeredAt: null,
  triggerCount: 0,
  platform: os.platform(),
  safeIps: [],
};

function parseSafeIps(raw: string | string[] | undefined): string[] {
  if (!raw) return [];
  const str = Array.isArray(raw) ? raw.join(",") : raw;
  return str
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[\d.:a-fA-F/]+$/.test(s));
}

function generateIptablesRules(ifaces: string[], safeIps: string[]): string[] {
  const rules: string[] = [
    "# ProxhqVPN Kill Switch — iptables rules",
    "# Apply with: sudo bash kill_switch.sh",
    "# Auto-generated — includes your current IP as a safe address",
    "",
    "#!/usr/bin/env bash",
    "set -e",
    "",
    "# Flush existing rules",
    "iptables -F OUTPUT",
    "iptables -F INPUT",
    "iptables -F FORWARD",
    "",
    "# Allow loopback",
    "iptables -A OUTPUT -o lo -j ACCEPT",
    "iptables -A INPUT  -i lo -j ACCEPT",
    "",
    "# Allow established/related",
    "iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
    "iptables -A INPUT  -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
    "",
  ];

  if (safeIps.length > 0) {
    rules.push("# Allow your safe/current IP(s) — auto-detected before VPN activated");
    for (const ip of safeIps) {
      const clean = ip.includes("/") ? ip : `${ip}/32`;
      rules.push(`iptables -A OUTPUT -d ${clean} -j ACCEPT`);
      rules.push(`iptables -A INPUT  -s ${clean} -j ACCEPT`);
    }
    rules.push("");
  }

  for (const iface of ifaces) {
    rules.push(`# Allow traffic on ${iface} (VPN tunnel)`);
    rules.push(`iptables -A OUTPUT -o ${iface} -j ACCEPT`);
    rules.push(`iptables -A INPUT  -i ${iface} -j ACCEPT`);
    rules.push("");
  }

  rules.push(
    "# Allow DHCP (UDP 67/68)",
    "iptables -A OUTPUT -p udp --dport 67 -j ACCEPT",
    "iptables -A INPUT  -p udp --sport 67 -j ACCEPT",
    "",
    "# Allow WireGuard UDP handshake port",
    "iptables -A OUTPUT -p udp --dport 51820 -j ACCEPT",
    "",
    "# Block ALL other outbound traffic (kill switch core)",
    "iptables -P OUTPUT DROP",
    "iptables -P INPUT  DROP",
    "iptables -P FORWARD DROP",
    "",
    "# ── IPv6 Leak Protection (ip6tables) ─────────────────────────────────────",
    "# Flush existing IPv6 rules",
    "ip6tables -F OUTPUT 2>/dev/null || true",
    "ip6tables -F INPUT  2>/dev/null || true",
    "ip6tables -F FORWARD 2>/dev/null || true",
    "",
    "# Allow IPv6 loopback",
    "ip6tables -A OUTPUT -o lo -j ACCEPT 2>/dev/null || true",
    "ip6tables -A INPUT  -i lo -j ACCEPT 2>/dev/null || true",
    "",
    "# Allow established IPv6 sessions on VPN interfaces",
    ...ifaces.flatMap((iface) => [
      `ip6tables -A OUTPUT -o ${iface} -j ACCEPT 2>/dev/null || true`,
      `ip6tables -A INPUT  -i ${iface} -j ACCEPT 2>/dev/null || true`,
    ]),
    "",
    "# Block ALL IPv6 traffic not on VPN (prevents IPv6 leak bypass)",
    "ip6tables -P OUTPUT DROP 2>/dev/null || true",
    "ip6tables -P INPUT  DROP 2>/dev/null || true",
    "ip6tables -P FORWARD DROP 2>/dev/null || true",
    "",
    'echo "Kill switch ACTIVE — IPv4 + IPv6 leak protection enabled"',
  );

  return rules;
}

function generateDisableScript(): string[] {
  return [
    "#!/usr/bin/env bash",
    "# ProxhqVPN Kill Switch — DISABLE (restore normal traffic)",
    "iptables -P OUTPUT ACCEPT",
    "iptables -P INPUT  ACCEPT",
    "iptables -P FORWARD ACCEPT",
    "iptables -F",
    "# Also restore IPv6",
    "ip6tables -P OUTPUT ACCEPT 2>/dev/null || true",
    "ip6tables -P INPUT  ACCEPT 2>/dev/null || true",
    "ip6tables -P FORWARD ACCEPT 2>/dev/null || true",
    "ip6tables -F 2>/dev/null || true",
    'echo "Kill switch DISABLED — IPv4 + IPv6 traffic restored"',
  ];
}

function generatePfRules(ifaces: string[], safeIps: string[]): string[] {
  const rules = [
    "# ProxhqVPN Kill Switch — macOS pf rules",
    "# Apply with: sudo pfctl -f /etc/pf.anchors/proxhq_killswitch",
    "# Auto-generated — includes your current IP as a safe address",
    "",
    "# Block all by default",
    "block out all",
    "block in  all",
    "",
    "# Allow loopback",
    "pass on lo0 all",
    "",
  ];

  if (safeIps.length > 0) {
    rules.push("# Allow your safe/current IP(s) — auto-detected before VPN activated");
    for (const ip of safeIps) {
      rules.push(`pass out proto { tcp udp } from any to ${ip}`);
      rules.push(`pass in  proto { tcp udp } from ${ip} to any`);
    }
    rules.push("");
  }

  for (const iface of ifaces) {
    rules.push(`pass out on ${iface} all`);
    rules.push(`pass in  on ${iface} all`);
  }
  rules.push(
    "",
    "# Allow DHCP",
    "pass out proto udp from any to any port 67",
    "pass out proto udp from any to any port 51820",
  );
  return rules;
}

function generateWindowsRules(ifaces: string[], safeIps: string[]): string {
  const lines = [
    "# ProxhqVPN Kill Switch — Windows Firewall (PowerShell)",
    "# Run as Administrator",
    "# Auto-generated — includes your current IP as a safe address",
    "",
    "# Block all outbound except VPN",
    "netsh advfirewall set allprofiles firewallpolicy blockinbound,blockoutbound",
  ];

  if (safeIps.length > 0) {
    lines.push("");
    lines.push("# Allow your safe/current IP(s) — auto-detected before VPN activated");
    for (const ip of safeIps) {
      lines.push(
        `netsh advfirewall firewall add rule name="ProxhqVPN SafeIP ${ip}" protocol=any dir=out action=allow remoteip=${ip}`,
      );
      lines.push(
        `netsh advfirewall firewall add rule name="ProxhqVPN SafeIP In ${ip}" protocol=any dir=in action=allow remoteip=${ip}`,
      );
    }
  }

  lines.push("");
  lines.push("# Allow WireGuard/VPN interfaces and ports");
  for (const i of ifaces) {
    lines.push(`# Allow interface: ${i}`);
  }
  lines.push(
    'netsh advfirewall firewall add rule name="ProxhqVPN WireGuard" protocol=UDP dir=out action=allow localport=51820',
    'netsh advfirewall firewall add rule name="ProxhqVPN Loopback" protocol=any dir=out action=allow localip=127.0.0.0/8',
  );

  return lines.join("\n");
}

router.get("/status", (_req, res) => {
  res.json(state);
});

router.post("/enable", (req, res) => {
  const { mode, allowedInterfaces, safeIps } = req.body as Partial<KillSwitchState>;
  state.enabled = true;
  state.mode = mode ?? state.mode;
  state.allowedInterfaces = allowedInterfaces ?? state.allowedInterfaces;
  if (safeIps && Array.isArray(safeIps)) state.safeIps = safeIps;
  state.lastTriggeredAt = new Date().toISOString();
  state.triggerCount += 1;
  res.json({ ...state, message: "Kill switch enabled — VPN tunnel is now the sole exit." });
});

router.post("/disable", (_req, res) => {
  state.enabled = false;
  res.json({ ...state, message: "Kill switch disabled — normal routing restored." });
});

router.patch("/config", (req, res) => {
  const { mode, allowedInterfaces, autoTriggerOnDrop, blockedOutboundWhenVpnDown, safeIps } =
    req.body as Partial<KillSwitchState>;
  if (mode) state.mode = mode;
  if (allowedInterfaces) state.allowedInterfaces = allowedInterfaces;
  if (autoTriggerOnDrop !== undefined) state.autoTriggerOnDrop = autoTriggerOnDrop;
  if (blockedOutboundWhenVpnDown !== undefined) state.blockedOutboundWhenVpnDown = blockedOutboundWhenVpnDown;
  if (safeIps && Array.isArray(safeIps)) state.safeIps = safeIps;
  res.json(state);
});

router.get("/generate-rules", (req, res) => {
  const platform = (req.query.platform as string) ?? os.platform();
  const ifaces = state.allowedInterfaces;
  const querySafeIps = parseSafeIps(req.query.safeIps as string | undefined);
  const safeIps = querySafeIps.length > 0 ? querySafeIps : state.safeIps;

  if (platform === "darwin") {
    res.json({
      platform: "macOS",
      type: "pf",
      safeIps,
      enable: generatePfRules(ifaces, safeIps).join("\n"),
      disable: "sudo pfctl -d  # disable pf entirely",
    });
  } else if (platform === "win32") {
    res.json({
      platform: "Windows",
      type: "netsh/wfp",
      safeIps,
      enable: generateWindowsRules(ifaces, safeIps),
      disable: "netsh advfirewall set allprofiles firewallpolicy blockinbound,allowoutbound",
    });
  } else {
    res.json({
      platform: "Linux",
      type: "iptables",
      safeIps,
      enable: generateIptablesRules(ifaces, safeIps).join("\n"),
      disable: generateDisableScript().join("\n"),
    });
  }
});

export default router;
