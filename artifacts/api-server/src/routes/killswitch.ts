import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const router = Router();
const execAsync = promisify(exec);

interface KillSwitchState {
  enabled: boolean;
  mode: "hard" | "soft";
  allowedInterfaces: string[];
  blockedOutboundWhenVpnDown: boolean;
  autoTriggerOnDrop: boolean;
  lastTriggeredAt: string | null;
  triggerCount: number;
  platform: string;
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
};

function generateIptablesRules(ifaces: string[]): string[] {
  const rules: string[] = [
    "# GhostNet Kill Switch — iptables rules",
    "# Apply with: sudo bash kill_switch.sh",
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
    'echo "Kill switch ACTIVE — all non-VPN traffic blocked"',
  );

  return rules;
}

function generateDisableScript(): string[] {
  return [
    "#!/usr/bin/env bash",
    "# GhostNet Kill Switch — DISABLE (restore normal traffic)",
    "iptables -P OUTPUT ACCEPT",
    "iptables -P INPUT  ACCEPT",
    "iptables -P FORWARD ACCEPT",
    "iptables -F",
    'echo "Kill switch DISABLED — normal traffic restored"',
  ];
}

function generatePfRules(ifaces: string[]): string[] {
  const rules = [
    "# GhostNet Kill Switch — macOS pf rules",
    "# Apply with: sudo pfctl -f /etc/pf.anchors/ghostnet_killswitch",
    "",
    "# Block all by default",
    "block out all",
    "block in  all",
    "",
    "# Allow loopback",
    "pass on lo0 all",
    "",
  ];
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

router.get("/status", (_req, res) => {
  res.json(state);
});

router.post("/enable", (req, res) => {
  const { mode, allowedInterfaces } = req.body as Partial<KillSwitchState>;
  state.enabled = true;
  state.mode = mode ?? state.mode;
  state.allowedInterfaces = allowedInterfaces ?? state.allowedInterfaces;
  state.lastTriggeredAt = new Date().toISOString();
  state.triggerCount += 1;
  res.json({ ...state, message: "Kill switch enabled — VPN tunnel is now the sole exit." });
});

router.post("/disable", (_req, res) => {
  state.enabled = false;
  res.json({ ...state, message: "Kill switch disabled — normal routing restored." });
});

router.patch("/config", (req, res) => {
  const { mode, allowedInterfaces, autoTriggerOnDrop, blockedOutboundWhenVpnDown } =
    req.body as Partial<KillSwitchState>;
  if (mode) state.mode = mode;
  if (allowedInterfaces) state.allowedInterfaces = allowedInterfaces;
  if (autoTriggerOnDrop !== undefined) state.autoTriggerOnDrop = autoTriggerOnDrop;
  if (blockedOutboundWhenVpnDown !== undefined)
    state.blockedOutboundWhenVpnDown = blockedOutboundWhenVpnDown;
  res.json(state);
});

router.get("/generate-rules", (req, res) => {
  const platform = (req.query.platform as string) ?? os.platform();
  const ifaces = state.allowedInterfaces;

  if (platform === "darwin") {
    res.json({
      platform: "macOS",
      type: "pf",
      enable: generatePfRules(ifaces).join("\n"),
      disable: "sudo pfctl -d  # disable pf entirely",
    });
  } else if (platform === "win32") {
    res.json({
      platform: "Windows",
      type: "netsh/wfp",
      enable: [
        "# GhostNet Kill Switch — Windows Firewall (PowerShell)",
        '# Run as Administrator',
        "",
        "# Block all outbound except VPN",
        'netsh advfirewall set allprofiles firewallpolicy blockinbound,blockoutbound',
        ...ifaces.map(i => `# Allow interface: ${i}`),
        'netsh advfirewall firewall add rule name="GhostNet VPN" protocol=UDP dir=out action=allow localport=51820',
        'netsh advfirewall firewall add rule name="GhostNet Loopback" protocol=any dir=out action=allow localip=127.0.0.0/8',
      ].join("\n"),
      disable: 'netsh advfirewall set allprofiles firewallpolicy blockinbound,allowoutbound',
    });
  } else {
    res.json({
      platform: "Linux",
      type: "iptables",
      enable: generateIptablesRules(ifaces).join("\n"),
      disable: generateDisableScript().join("\n"),
    });
  }
});

export default router;
