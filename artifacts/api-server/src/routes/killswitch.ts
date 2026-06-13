// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import os from "os";
import { exec } from "child_process";
import { promisify } from "util";
import { bus } from "../lib/service-bus";

const execAsync = promisify(exec);

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
  bus.publish("firewall.rule_change", {
    event: "killswitch_enabled",
    mode: state.mode,
    allowedInterfaces: state.allowedInterfaces,
    safeIps: state.safeIps,
    triggerCount: state.triggerCount,
  }, "killswitch");
  res.json({ ...state, message: "Kill switch enabled — VPN tunnel is now the sole exit." });
});

router.post("/disable", (_req, res) => {
  state.enabled = false;
  bus.publish("firewall.rule_change", {
    event: "killswitch_disabled",
    mode: state.mode,
    triggerCount: state.triggerCount,
  }, "killswitch");
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
  bus.publish("firewall.rule_change", {
    event: "killswitch_config_changed",
    mode: state.mode,
    autoTriggerOnDrop: state.autoTriggerOnDrop,
    blockedOutboundWhenVpnDown: state.blockedOutboundWhenVpnDown,
  }, "killswitch");
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

// ── Validate: checks if iptables/ip6tables kill switch rules are actually active ──
router.get("/validate", async (_req, res) => {
  interface ValidationResult {
    canValidate: boolean;
    ipv4DropPolicy: boolean;
    ipv6DropPolicy: boolean;
    vpnIfaceAllowed: boolean;
    loopbackAllowed: boolean;
    dhcpAllowed: boolean;
    wgPortAllowed: boolean;
    issues: string[];
    recommendations: string[];
    raw: { ipv4?: string; ipv6?: string };
  }

  const result: ValidationResult = {
    canValidate: false,
    ipv4DropPolicy: false,
    ipv6DropPolicy: false,
    vpnIfaceAllowed: false,
    loopbackAllowed: false,
    dhcpAllowed: false,
    wgPortAllowed: false,
    issues: [],
    recommendations: [],
    raw: {},
  };

  try {
    const [v4res, v6res] = await Promise.all([
      execAsync("iptables -S OUTPUT 2>/dev/null").catch(() => ({ stdout: "" })),
      execAsync("ip6tables -S OUTPUT 2>/dev/null").catch(() => ({ stdout: "" })),
    ]);

    result.canValidate = true;
    result.raw.ipv4 = v4res.stdout.trim();
    result.raw.ipv6 = v6res.stdout.trim();

    result.ipv4DropPolicy  = v4res.stdout.includes("-P OUTPUT DROP");
    result.ipv6DropPolicy  = v6res.stdout.includes("-P OUTPUT DROP");
    result.vpnIfaceAllowed = state.allowedInterfaces.some(iface =>
      v4res.stdout.includes(`-o ${iface} -j ACCEPT`)
    );
    result.loopbackAllowed = v4res.stdout.includes("-o lo -j ACCEPT");
    result.dhcpAllowed     = v4res.stdout.includes("--dport 67");
    result.wgPortAllowed   = v4res.stdout.includes("--dport 51820");

    if (!result.ipv4DropPolicy)
      result.issues.push("IPv4 OUTPUT policy is NOT DROP — kill switch is NOT enforcing. Run the generated Linux script as root.");
    if (!result.ipv6DropPolicy)
      result.issues.push("IPv6 OUTPUT policy is NOT DROP — IPv6 traffic can bypass the VPN tunnel.");
    if (!result.vpnIfaceAllowed)
      result.issues.push(`Interfaces [${state.allowedInterfaces.join(", ")}] not found in rules — VPN traffic would also be blocked. Regenerate the script.`);
    if (!result.loopbackAllowed)
      result.issues.push("Loopback (lo) not allowed — local processes may break.");

    if (result.ipv4DropPolicy && result.ipv6DropPolicy && result.vpnIfaceAllowed)
      result.recommendations.push("Kill switch is FULLY ACTIVE — IPv4 and IPv6 leak protection confirmed.");
    else if (result.ipv4DropPolicy && !result.ipv6DropPolicy)
      result.recommendations.push("IPv4 is protected but IPv6 is NOT — an adversary on your local network can still see your real IPv6 address.");
    if (!result.ipv4DropPolicy)
      result.recommendations.push("Download and run the Linux kill switch script as: sudo bash proxhqvpn_killswitch_linux.sh");
    if (!result.wgPortAllowed)
      result.recommendations.push("WireGuard UDP port 51820 is not explicitly allowed — WireGuard handshake may fail after kill switch is armed.");

  } catch {
    result.issues.push("iptables/ip6tables not accessible from this process. The validation endpoint must run on the same Linux host as your VPN server. On Windows/macOS use the platform-specific scripts.");
    result.recommendations.push("Download the kill switch script for your OS and run it manually. Then re-run validation on the Linux VPS where the VPN server runs.");
  }

  res.json(result);
});

// ── Systemd: generates a systemd unit file that applies the kill switch at boot ──
router.get("/systemd", (req, res) => {
  const ifaces = state.allowedInterfaces;
  const querySafeIps = parseSafeIps(req.query.safeIps as string | undefined);
  const safeIps = querySafeIps.length > 0 ? querySafeIps : state.safeIps;

  const iptablesScript = generateIptablesRules(ifaces, safeIps).join("\n");
  const disableScript  = generateDisableScript().join("\n");

  const serviceFile = `[Unit]
Description=ProxhqVPN Kill Switch — blocks all non-VPN traffic
Documentation=https://proxhqvpn.example.com
DefaultDependencies=no
Before=network-pre.target
After=local-fs.target
Wants=network-pre.target

[Service]
Type=oneshot
RemainAfterExit=yes

# Write the kill switch scripts to disk on start
ExecStartPre=/bin/bash -c 'mkdir -p /etc/proxhqvpn && cat > /etc/proxhqvpn/ks_enable.sh << '"'"'PROXHQ_EOF'"'"'
${iptablesScript}
PROXHQ_EOF
chmod 700 /etc/proxhqvpn/ks_enable.sh'

ExecStartPre=/bin/bash -c 'cat > /etc/proxhqvpn/ks_disable.sh << '"'"'PROXHQ_EOF'"'"'
${disableScript}
PROXHQ_EOF
chmod 700 /etc/proxhqvpn/ks_disable.sh'

ExecStart=/bin/bash /etc/proxhqvpn/ks_enable.sh
ExecStop=/bin/bash /etc/proxhqvpn/ks_disable.sh

[Install]
WantedBy=multi-user.target
`;

  const installInstructions = [
    "# ProxhqVPN Kill Switch — systemd installation",
    "# Run as root on your Linux VPS / server",
    "",
    "# 1. Save the service file",
    "sudo tee /etc/systemd/system/proxhq-killswitch.service << 'EOF'",
    serviceFile,
    "EOF",
    "",
    "# 2. Reload systemd and enable at boot",
    "sudo systemctl daemon-reload",
    "sudo systemctl enable proxhq-killswitch.service",
    "",
    "# 3. Start immediately",
    "sudo systemctl start proxhq-killswitch.service",
    "",
    "# 4. Verify status",
    "sudo systemctl status proxhq-killswitch.service",
    "sudo iptables -L OUTPUT -n --line-numbers",
    "sudo ip6tables -L OUTPUT -n --line-numbers",
  ].join("\n");

  res.json({
    serviceFile,
    installInstructions,
    ifaces,
    safeIps,
    note: "This unit starts Before=network-pre.target so the kill switch is armed before any network interface comes up. The VPN tunnel must be started separately (e.g. via wg-quick@wg0.service).",
  });
});

// ── Watchdog: auto-reconnect + kill-switch-on-drop daemon script ──
router.get("/watchdog", (req, res) => {
  const ifaces = state.allowedInterfaces;
  const wgIface = ifaces.find(i => i.startsWith("wg")) ?? "wg0";
  const querySafeIps = parseSafeIps(req.query.safeIps as string | undefined);
  const safeIps = querySafeIps.length > 0 ? querySafeIps : state.safeIps;
  const wgConfig = (req.query.config as string) ?? `/etc/wireguard/${wgIface}.conf`;

  const iptablesLines = generateIptablesRules(ifaces, safeIps);
  const disableLines  = generateDisableScript();

  const watchdogScript = `#!/usr/bin/env bash
# ProxhqVPN Watchdog — WireGuard auto-reconnect + kill switch on drop
# Generated by ProxhqVPN · ALPHA UNLIMITED TECHNOLOGIES LLC
#
# HOW IT WORKS:
#   1. Polls the WireGuard interface every POLL_INTERVAL seconds
#   2. If the tunnel drops:
#      a. Immediately applies iptables kill switch (all traffic blocked)
#      b. Waits RECONNECT_WAIT seconds for routes to settle
#      c. Attempts wg-quick up to reconnect
#      d. If reconnected: lifts the kill switch
#      e. If failed: keeps kill switch armed and retries every RETRY_WAIT seconds
#   3. Logs all events with timestamps to LOG_FILE
#
# USAGE:
#   chmod +x proxhq-watchdog.sh
#   sudo nohup ./proxhq-watchdog.sh &    # background
#   sudo systemctl start proxhq-watchdog  # if using the companion .service

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────
WG_IFACE="${wgIface}"
WG_CONFIG="${wgConfig}"
POLL_INTERVAL=5          # seconds between tunnel health checks
RECONNECT_WAIT=3         # seconds to wait before attempting reconnect
RETRY_WAIT=15            # seconds between reconnect retries
MAX_RETRIES=10           # max reconnect attempts before giving up
LOG_FILE="/var/log/proxhq-watchdog.log"
ARMED=false              # tracks whether kill switch is currently active

# ── Helpers ────────────────────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

arm_kill_switch() {
  if [ "$ARMED" = "false" ]; then
    log "KILL SWITCH ARMED — blocking all non-VPN traffic"
${iptablesLines.filter(l => !l.startsWith("#") && l.trim() !== "").map(l => `    ${l}`).join("\n")}
    ARMED=true
  fi
}

disarm_kill_switch() {
  if [ "$ARMED" = "true" ]; then
    log "KILL SWITCH DISARMED — VPN tunnel confirmed up"
${disableLines.filter(l => !l.startsWith("#") && l.trim() !== "").map(l => `    ${l}`).join("\n")}
    ARMED=false
  fi
}

tunnel_is_up() {
  ip link show "$WG_IFACE" 2>/dev/null | grep -q "UP" && \\
  wg show "$WG_IFACE" 2>/dev/null | grep -q "latest handshake"
}

reconnect() {
  local attempt=0
  while [ $attempt -lt $MAX_RETRIES ]; do
    attempt=$((attempt + 1))
    log "Reconnect attempt $attempt/$MAX_RETRIES..."
    if wg-quick down "$WG_IFACE" 2>/dev/null; true; then
      sleep 1
    fi
    if wg-quick up "$WG_CONFIG" 2>/dev/null || wg-quick up "$WG_IFACE" 2>/dev/null; then
      sleep 2
      if tunnel_is_up; then
        log "Tunnel restored on attempt $attempt"
        return 0
      fi
    fi
    log "Reconnect attempt $attempt failed. Retrying in $\{RETRY_WAIT}s..."
    sleep "$RETRY_WAIT"
  done
  log "ERROR: Failed to reconnect after $MAX_RETRIES attempts. Kill switch remains ARMED."
  return 1
}

# ── Main loop ──────────────────────────────────────────────────────────────
log "ProxhqVPN Watchdog started — monitoring interface $WG_IFACE"
log "Config: $WG_CONFIG | Poll: $\{POLL_INTERVAL}s | MaxRetries: $MAX_RETRIES"

trap 'log "Watchdog stopped by signal. Disarming kill switch."; disarm_kill_switch; exit 0' SIGTERM SIGINT

while true; do
  if tunnel_is_up; then
    if [ "$ARMED" = "true" ]; then
      disarm_kill_switch
    fi
  else
    log "TUNNEL DOWN — interface $WG_IFACE is not active or has no recent handshake"
    arm_kill_switch
    sleep "$RECONNECT_WAIT"
    if reconnect; then
      disarm_kill_switch
    fi
  fi
  sleep "$POLL_INTERVAL"
done
`;

  const systemdService = `[Unit]
Description=ProxhqVPN Watchdog — WireGuard auto-reconnect + kill switch on drop
After=network.target wg-quick@${wgIface}.service
Requires=wg-quick@${wgIface}.service

[Service]
Type=simple
Restart=always
RestartSec=5
ExecStart=/etc/proxhqvpn/proxhq-watchdog.sh
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
`;

  const installInstructions = [
    "# ProxhqVPN Watchdog — installation",
    "sudo mkdir -p /etc/proxhqvpn",
    "sudo cp proxhq-watchdog.sh /etc/proxhqvpn/proxhq-watchdog.sh",
    "sudo chmod 700 /etc/proxhqvpn/proxhq-watchdog.sh",
    "",
    "# Install systemd service",
    "sudo tee /etc/systemd/system/proxhq-watchdog.service << 'EOF'",
    systemdService,
    "EOF",
    "",
    "sudo systemctl daemon-reload",
    "sudo systemctl enable proxhq-watchdog.service",
    "sudo systemctl start proxhq-watchdog.service",
    "",
    "# Monitor logs",
    "journalctl -u proxhq-watchdog -f",
    "# or: tail -f /var/log/proxhq-watchdog.log",
  ].join("\n");

  res.json({
    watchdogScript,
    systemdService,
    installInstructions,
    wgIface,
    wgConfig,
    pollInterval: 5,
    maxRetries: 10,
    note: "The watchdog arms the kill switch the instant WireGuard drops, preventing any traffic from leaking through your real IP during the reconnect window.",
  });
});

export default router;
