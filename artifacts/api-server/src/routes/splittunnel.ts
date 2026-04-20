import { Router } from "express";
import os from "os";

const router = Router();

type TunnelMode = "vpn" | "direct" | "block";

interface SplitRule {
  id: string;
  name: string;
  type: "ip" | "cidr" | "app" | "domain" | "port";
  value: string;
  mode: TunnelMode;
  enabled: boolean;
  priority: number;
  notes: string;
  createdAt: string;
  hitCount: number;
}

const defaultRules: SplitRule[] = [
  { id: "sr-001", name: "Local network bypass",    type: "cidr",   value: "192.168.0.0/16", mode: "direct", enabled: true,  priority: 10, notes: "LAN traffic goes direct",    createdAt: new Date().toISOString(), hitCount: 0 },
  { id: "sr-002", name: "Loopback bypass",         type: "cidr",   value: "127.0.0.0/8",    mode: "direct", enabled: true,  priority: 10, notes: "Localhost always direct",     createdAt: new Date().toISOString(), hitCount: 0 },
  { id: "sr-003", name: "RFC1918 private",         type: "cidr",   value: "10.0.0.0/8",     mode: "direct", enabled: true,  priority: 10, notes: "Private range bypass",        createdAt: new Date().toISOString(), hitCount: 0 },
  { id: "sr-004", name: "DNS through VPN",         type: "port",   value: "53",             mode: "vpn",    enabled: true,  priority: 20, notes: "Force DNS over tunnel",       createdAt: new Date().toISOString(), hitCount: 0 },
  { id: "sr-005", name: "Block BitTorrent ports",  type: "port",   value: "6881-6889",      mode: "block",  enabled: false, priority: 50, notes: "Optional P2P block",          createdAt: new Date().toISOString(), hitCount: 0 },
];

let rules: SplitRule[] = [...defaultRules];
let idCounter = 100;

function generateLinuxRoutes(activeRules: SplitRule[], vpnIface = "tun0"): string {
  const lines = [
    "#!/usr/bin/env bash",
    "# ProxhqVPN Split Tunneling — Linux ip rule/route commands",
    "# Run as root: sudo bash split_tunnel.sh",
    "",
    "VPN_IFACE=${1:-" + vpnIface + "}",
    "VPN_TABLE=200",
    "",
    "# Create custom routing table",
    "echo '$VPN_TABLE vpn_tunnel' >> /etc/iproute2/rt_tables 2>/dev/null || true",
    "",
    "# Add VPN as default route in the VPN table",
    "ip route add default dev $VPN_IFACE table $VPN_TABLE",
    "ip rule add fwmark 1 table $VPN_TABLE",
    "",
    "# Mark packets destined for VPN-only destinations",
  ];

  for (const r of activeRules.filter(r => r.enabled && r.mode === "vpn" && r.type === "cidr")) {
    lines.push(`ip route add ${r.value} dev $VPN_IFACE                  # ${r.name}`);
  }

  lines.push("", "# Direct routes (bypass VPN)");
  for (const r of activeRules.filter(r => r.enabled && r.mode === "direct" && r.type === "cidr")) {
    lines.push(`ip route add ${r.value} via $(ip route | awk '/default/{print $3}')  # ${r.name}`);
  }

  lines.push(
    "",
    "# Block rules (iptables DROP)",
    ...activeRules
      .filter(r => r.enabled && r.mode === "block" && r.type === "port")
      .map(r => `iptables -A OUTPUT -p tcp --dport ${r.value} -j DROP            # ${r.name}`),
    "",
    'echo "Split tunneling applied."',
  );
  return lines.join("\n");
}

function generateWindowsRoutes(activeRules: SplitRule[]): string {
  const lines = [
    "# ProxhqVPN Split Tunneling — Windows route commands",
    "# Run as Administrator in PowerShell",
    "",
    "# Get VPN adapter IP",
    '$vpnGw = (Get-NetAdapter | Where-Object {$_.InterfaceDescription -match "WireGuard|TUN|VPN"} | Get-NetIPConfiguration).IPv4DefaultGateway.NextHop',
    "",
  ];
  for (const r of activeRules.filter(r => r.enabled && r.mode === "direct" && r.type === "cidr")) {
    lines.push(`route ADD ${r.value} MASK 255.255.255.0 %DEFAULT_GW%     REM ${r.name}`);
  }
  for (const r of activeRules.filter(r => r.enabled && r.mode === "vpn" && r.type === "cidr")) {
    lines.push(`route ADD ${r.value} MASK 255.255.255.0 $vpnGw            REM ${r.name}`);
  }
  return lines.join("\n");
}

router.get("/rules", (_req, res) => {
  res.json({
    rules,
    total: rules.length,
    enabled: rules.filter(r => r.enabled).length,
    vpnCount: rules.filter(r => r.mode === "vpn").length,
    directCount: rules.filter(r => r.mode === "direct").length,
    blockCount: rules.filter(r => r.mode === "block").length,
  });
});

router.post("/rules", (req, res) => {
  const { name, type, value, mode, priority, notes } = req.body as Partial<SplitRule>;
  if (!name || !type || !value || !mode) {
    return res.status(400).json({ error: "name, type, value, mode are required" });
  }
  const rule: SplitRule = {
    id: `sr-${String(++idCounter).padStart(3, "0")}`,
    name, type, value, mode,
    enabled: true,
    priority: priority ?? 100,
    notes: notes ?? "",
    createdAt: new Date().toISOString(),
    hitCount: 0,
  };
  rules.push(rule);
  rules.sort((a, b) => a.priority - b.priority);
  res.status(201).json(rule);
});

router.put("/rules/:id", (req, res) => {
  const rule = rules.find(r => r.id === req.params.id);
  if (!rule) return res.status(404).json({ error: "Rule not found" });
  const { name, mode, enabled, priority, notes } = req.body as Partial<SplitRule>;
  if (name)    rule.name     = name;
  if (mode)    rule.mode     = mode;
  if (priority !== undefined) rule.priority = priority;
  if (enabled  !== undefined) rule.enabled  = enabled;
  if (notes)   rule.notes    = notes;
  rules.sort((a, b) => a.priority - b.priority);
  res.json(rule);
});

router.delete("/rules/:id", (req, res) => {
  const idx = rules.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Rule not found" });
  const removed = rules.splice(idx, 1)[0];
  res.json({ removed: removed.id });
});

router.post("/rules/reset", (_req, res) => {
  rules = [...defaultRules];
  res.json({ reset: true, rules });
});

router.get("/generate", (req, res) => {
  const platform = (req.query.platform as string) ?? os.platform();
  const iface    = (req.query.iface as string)    ?? "tun0";
  const active   = rules.filter(r => r.enabled);

  if (platform === "win32") {
    res.json({ platform: "Windows", script: generateWindowsRoutes(active) });
  } else {
    res.json({ platform: "Linux", script: generateLinuxRoutes(active, iface) });
  }
});

export default router;
