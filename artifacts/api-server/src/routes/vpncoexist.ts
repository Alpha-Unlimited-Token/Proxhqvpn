// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { z } from "zod";
import os from "os";
import { execSync } from "child_process";

const router = Router();

// ─── Known commercial VPN profiles ───────────────────────────────────────────
const VPN_PROFILES = [
  {
    id: "nordvpn",
    name: "NordVPN",
    processes: ["nordvpnd", "nordvpn", "nordlynx"],
    interfaces: ["nordlynx", "tun0", "utun0", "utun1"],
    defaultPort: 51820,
    protocol: "WireGuard / OpenVPN",
    dnsServers: ["103.86.96.100", "103.86.99.100"],
    serverCidrs: ["194.165.16.0/24", "89.44.9.0/24", "45.83.220.0/22"],
    killSwitchIface: "nordlynx",
    notes: "NordVPN uses 'nordlynx' as its WireGuard interface. Uses Meshnet for LAN routing.",
    coexistMethod: "fwmark",
  },
  {
    id: "expressvpn",
    name: "ExpressVPN",
    processes: ["expressvpnd", "lightway_helper", "expressvpn"],
    interfaces: ["tun0", "utun0", "utun2"],
    defaultPort: 1195,
    protocol: "Lightway / OpenVPN",
    dnsServers: ["8.8.8.8", "8.8.4.4"],
    serverCidrs: ["216.232.0.0/16", "195.206.105.0/24"],
    killSwitchIface: "tun0",
    notes: "ExpressVPN Lightway uses UDP/1195. Uses split-tunneling via its own driver.",
    coexistMethod: "routing-table",
  },
  {
    id: "protonvpn",
    name: "ProtonVPN",
    processes: ["protonvpn", "proton-vpn-gnome-desktop", "protonvpnd"],
    interfaces: ["proton0", "tun0", "utun0", "wg0"],
    defaultPort: 51820,
    protocol: "WireGuard / OpenVPN",
    dnsServers: ["10.2.0.1"],
    serverCidrs: ["185.159.156.0/22", "37.120.196.0/22", "185.159.158.0/24"],
    killSwitchIface: "proton0",
    notes: "ProtonVPN uses 'proton0' for WireGuard. DNS leaks via 10.2.0.1 on the tunnel.",
    coexistMethod: "fwmark",
  },
  {
    id: "mullvad",
    name: "Mullvad VPN",
    processes: ["mullvad-daemon", "mullvad", "mullvad-vpn"],
    interfaces: ["wg0", "wg-mullvad", "mullvad", "tun0"],
    defaultPort: 51820,
    protocol: "WireGuard / OpenVPN",
    dnsServers: ["10.64.0.1"],
    serverCidrs: ["193.32.127.0/24", "193.138.218.0/24", "185.213.154.0/24"],
    killSwitchIface: "wg0",
    notes: "Mullvad uses local DNS 10.64.0.1. Strict no-logs. Use network namespaces for cleanest isolation.",
    coexistMethod: "namespace",
  },
  {
    id: "surfshark",
    name: "Surfshark",
    processes: ["surfshark", "surfshark-vpn"],
    interfaces: ["wg0", "tun0", "utun0"],
    defaultPort: 51820,
    protocol: "WireGuard / OpenVPN / IKEv2",
    dnsServers: ["162.252.172.57", "162.252.172.58"],
    serverCidrs: ["91.108.56.0/24", "195.181.170.0/24"],
    killSwitchIface: "tun0",
    notes: "Surfshark NoBorders mode uses obfuscation. MultiHop option pairs well with ProxhqVPN overlay.",
    coexistMethod: "routing-table",
  },
  {
    id: "wireguard-generic",
    name: "WireGuard (Generic)",
    processes: ["wg-quick", "wireguard", "wg"],
    interfaces: ["wg0", "wg1", "wg2"],
    defaultPort: 51820,
    protocol: "WireGuard",
    dnsServers: [],
    serverCidrs: [],
    killSwitchIface: "wg0",
    notes: "Generic WireGuard interface. ProxhqVPN runs on a separate interface (tun0 or proxhq0).",
    coexistMethod: "fwmark",
  },
  {
    id: "openvpn-generic",
    name: "OpenVPN (Generic)",
    processes: ["openvpn"],
    interfaces: ["tun0", "tun1", "tap0"],
    defaultPort: 1194,
    protocol: "OpenVPN",
    dnsServers: [],
    serverCidrs: [],
    killSwitchIface: "tun0",
    notes: "Generic OpenVPN adapter. Use routing tables 200/201 to separate ProxhqVPN and OpenVPN.",
    coexistMethod: "routing-table",
  },
];

// ─── In-memory exception store ─────────────────────────────────────────────
interface ExceptionRule {
  id: string;
  cidr: string;
  description: string;
  action: "bypass-proxhq" | "force-proxhq" | "block";
  source: "manual" | "vpn-profile" | "auto";
  addedAt: string;
}

// ─── Security Tool Exception Store ─────────────────────────────────────────
interface ToolExceptionRule {
  id: string;
  tool: string;
  toolLabel: string;
  outboundBypass: boolean;
  inboundBypass: boolean;
  ports: string;
  protocols: string[];
  cidr: string;
  enabled: boolean;
  note: string;
  addedAt: string;
}

const TOOL_DEFAULTS: Omit<ToolExceptionRule, "id" | "addedAt">[] = [
  { tool: "http-probe",     toolLabel: "HTTP Probe",          outboundBypass: true, inboundBypass: true,  ports: "80,443,8080,8443",        protocols: ["tcp"],       cidr: "*", enabled: true,  note: "HTTP/HTTPS reconnaissance — allow outbound requests and return traffic" },
  { tool: "intruder",       toolLabel: "Intruder",            outboundBypass: true, inboundBypass: true,  ports: "80,443,8080",             protocols: ["tcp"],       cidr: "*", enabled: true,  note: "Intruder attack traffic — bypass kill switch for target connections" },
  { tool: "dir-fuzzer",     toolLabel: "Directory Fuzzer",    outboundBypass: true, inboundBypass: true,  ports: "80,443,8080,8443",        protocols: ["tcp"],       cidr: "*", enabled: true,  note: "Directory/path fuzzing — high-volume outbound HTTP traffic" },
  { tool: "sqlmap",         toolLabel: "SQLmap Scanner",      outboundBypass: true, inboundBypass: true,  ports: "80,443,3306,5432,1433",   protocols: ["tcp"],       cidr: "*", enabled: true,  note: "SQL injection testing — allow DB port responses through" },
  { tool: "alpha",          toolLabel: "Alpha Toolkit",       outboundBypass: true, inboundBypass: true,  ports: "*",                       protocols: ["tcp","udp"], cidr: "*", enabled: true,  note: "Alpha Toolkit full bypass — multi-protocol offensive operations" },
  { tool: "osint",          toolLabel: "OSINT Engine",        outboundBypass: true, inboundBypass: true,  ports: "80,443",                  protocols: ["tcp"],       cidr: "*", enabled: true,  note: "OSINT queries — allow external API and web traffic" },
  { tool: "waf",            toolLabel: "WAF Analyzer",        outboundBypass: true, inboundBypass: true,  ports: "80,443,8080,8443",        protocols: ["tcp"],       cidr: "*", enabled: true,  note: "WAF probe traffic — allow bypass and evasion test connections" },
  { tool: "subdomain-scan", toolLabel: "Subdomain Scanner",   outboundBypass: true, inboundBypass: true,  ports: "80,443,53",               protocols: ["tcp","udp"], cidr: "*", enabled: true,  note: "DNS resolution + HTTP probes for subdomain discovery" },
  { tool: "ghost-trace",    toolLabel: "Ghost Trace",         outboundBypass: true, inboundBypass: true,  ports: "*",                       protocols: ["icmp","udp","tcp"], cidr: "*", enabled: true,  note: "Traceroute/ICMP probes — allow all ICMP and TTL packets" },
  { tool: "omnistrike",     toolLabel: "OmniStrike",          outboundBypass: true, inboundBypass: true,  ports: "*",                       protocols: ["tcp","udp"], cidr: "*", enabled: true,  note: "OmniStrike coordinated attack — full outbound/inbound bypass" },
  { tool: "exploit-import", toolLabel: "Exploit Import",      outboundBypass: true, inboundBypass: false, ports: "80,443",                  protocols: ["tcp"],       cidr: "*", enabled: true,  note: "Exploit downloads — allow outbound; block unsolicited inbound" },
  { tool: "attack-chain",   toolLabel: "Attack Chain",        outboundBypass: true, inboundBypass: true,  ports: "*",                       protocols: ["tcp","udp"], cidr: "*", enabled: true,  note: "Attack chain orchestration — allow all tool traffic during chain execution" },
];

const toolExceptions: ToolExceptionRule[] = TOOL_DEFAULTS.map((t, i) => ({
  ...t,
  id: `tool-exc-${i + 1}`,
  addedAt: new Date().toISOString(),
}));

const exceptions: ExceptionRule[] = [
  {
    id: "exc-1",
    cidr: "192.168.0.0/16",
    description: "Local LAN — always bypass VPN",
    action: "bypass-proxhq",
    source: "auto",
    addedAt: new Date().toISOString(),
  },
  {
    id: "exc-2",
    cidr: "10.0.0.0/8",
    description: "RFC 1918 private — bypass",
    action: "bypass-proxhq",
    source: "auto",
    addedAt: new Date().toISOString(),
  },
  {
    id: "exc-3",
    cidr: "172.16.0.0/12",
    description: "RFC 1918 private — bypass",
    action: "bypass-proxhq",
    source: "auto",
    addedAt: new Date().toISOString(),
  },
];

// ─── Auto-detect running VPN processes ────────────────────────────────────
function detectRunningVpns(): { found: (typeof VPN_PROFILES[0] & { active: boolean; detectedIface: string | null; pid: number | null })[] } {
  const platform = os.platform();
  const found: (typeof VPN_PROFILES[0] & { active: boolean; detectedIface: string | null; pid: number | null })[] = [];

  for (const profile of VPN_PROFILES) {
    let active = false;
    let detectedIface: string | null = null;
    let pid: number | null = null;

    try {
      if (platform === "linux") {
        const procs = execSync("ps aux 2>/dev/null", { timeout: 3000 }).toString();
        for (const proc of profile.processes) {
          if (procs.includes(proc)) {
            active = true;
            const match = procs.match(new RegExp(`\\s+(\\d+)\\s+.*${proc}`));
            if (match) pid = parseInt(match[1]);
            break;
          }
        }
        if (active) {
          const ifaces = execSync("ip link show 2>/dev/null", { timeout: 3000 }).toString();
          for (const iface of profile.interfaces) {
            if (ifaces.includes(`${iface}:`)) { detectedIface = iface; break; }
          }
        }
      } else if (platform === "darwin") {
        for (const proc of profile.processes) {
          try {
            execSync(`pgrep -x ${proc} 2>/dev/null`, { timeout: 2000 });
            active = true; break;
          } catch {}
        }
        if (active) {
          const ifaces = execSync("ifconfig 2>/dev/null", { timeout: 3000 }).toString();
          for (const iface of profile.interfaces) {
            if (ifaces.includes(`${iface}:`)) { detectedIface = iface; break; }
          }
        }
      } else if (platform === "win32") {
        for (const proc of profile.processes) {
          try {
            const out = execSync(`tasklist /FI "IMAGENAME eq ${proc}.exe" 2>nul`, { timeout: 3000 }).toString();
            if (out.includes(proc)) { active = true; break; }
          } catch {}
        }
      }
    } catch {}

    if (active) {
      found.push({ ...profile, active, detectedIface, pid });
    }
  }

  return { found };
}

// ─── Script generators ─────────────────────────────────────────────────────
function generateLinuxCoexistScript(
  mode: string,
  detectedVpnIface: string,
  proxhqIface: string,
  proxhqFwmark: number,
  extraExceptions: string[]
): string {
  const tableId = 200;
  const exceptions_str = extraExceptions.map(c => `ip route add ${c} dev ${detectedVpnIface} table ${tableId}`).join("\n");

  if (mode === "fwmark") {
    return `#!/usr/bin/env bash
# ProxhqVPN VPN Coexistence — fwmark Policy Routing
# Mode: fwmark (traffic marked ${proxhqFwmark} → ProxhqVPN, rest → ${detectedVpnIface})
# Generated by ProxhqVPN v3.0 — run as root

set -e

ProxhqVPN_IFACE="${proxhqIface}"
NATIVE_VPN_IFACE="${detectedVpnIface}"
FWMARK=${proxhqFwmark}
TABLE=${tableId}

echo "[+] Setting up ProxhqVPN coexistence routing (fwmark mode)..."

# 1. Create routing table for ProxhqVPN traffic
ip route flush table $TABLE 2>/dev/null || true
ip route add default dev $ProxhqVPN_IFACE table $TABLE

# 2. Add fwmark rule: marked packets use ProxhqVPN table
ip rule del fwmark $FWMARK table $TABLE 2>/dev/null || true
ip rule add fwmark $FWMARK table $TABLE priority 100

# 3. Native VPN exception routes (bypass ProxhqVPN for native VPN traffic)
${exceptions_str || "# No additional exceptions added"}

# 4. iptables: mark ProxhqVPN-destined traffic
iptables -t mangle -F ProxhqVPN_COEXIST 2>/dev/null || iptables -t mangle -N ProxhqVPN_COEXIST
iptables -t mangle -A PREROUTING -j ProxhqVPN_COEXIST
# Mark traffic from ProxhqVPN TUN (10.99.0.0/24) with fwmark
iptables -t mangle -A ProxhqVPN_COEXIST -s 10.99.0.0/24 -j MARK --set-mark $FWMARK
iptables -t mangle -A ProxhqVPN_COEXIST -d 10.99.0.0/24 -j MARK --set-mark $FWMARK

# 5. Verify
echo "[+] Active routing rules:"
ip rule list | grep -E "fwmark|${tableId}"
echo "[+] ProxhqVPN coexistence table:"
ip route show table $TABLE

echo "[+] Done. ProxhqVPN runs alongside $NATIVE_VPN_IFACE."
echo "    • ProxhqVPN traffic: tun/proxhq → fwmark $FWMARK → table $TABLE"
echo "    • Native VPN traffic: $NATIVE_VPN_IFACE → main table (unchanged)"
echo ""
echo "    To revert: run ghostnet-coexist-disable.sh"
`;
  }

  if (mode === "double-hop") {
    return `#!/usr/bin/env bash
# ProxhqVPN VPN Coexistence — Double-Hop Mode
# Traffic path: Your Device → ProxhqVPN Mesh (${proxhqIface}) → ${detectedVpnIface} → Internet
# Both VPNs active simultaneously for maximum anonymity
# Generated by ProxhqVPN v3.0 — run as root

set -e

ProxhqVPN_IFACE="${proxhqIface}"
NATIVE_VPN_IFACE="${detectedVpnIface}"

echo "[+] Configuring double-hop VPN routing..."

# Step 1: ProxhqVPN runs first (inner tunnel)
# Its packets exit via the native VPN as outer tunnel
# This is achieved by ensuring ProxhqVPN daemon traffic
# uses the native VPN's routing table

# MTU adjustment — critical for double-hop
# Ethernet (1500) → Native VPN (~1420) → ProxhqVPN (~1380)
ip link set $ProxhqVPN_IFACE mtu 1380 2>/dev/null || true
echo "[+] MTU set to 1380 on $ProxhqVPN_IFACE (double-hop optimized)"

# Step 2: Route ProxhqVPN control traffic through native VPN
# The ProxhqVPN server endpoint must go through the native VPN
ProxhqVPN_SERVER_IP="\${ProxhqVPN_SERVER_IP:-10.99.0.1}"
ip route add $ProxhqVPN_SERVER_IP/32 dev $NATIVE_VPN_IFACE 2>/dev/null || true
echo "[+] ProxhqVPN server endpoint routed through native VPN"

# Step 3: All other traffic through ProxhqVPN (which exits via native VPN)
ip route replace default dev $ProxhqVPN_IFACE

echo "[+] Double-hop active:"
echo "    Device → ProxhqVPN ($ProxhqVPN_IFACE) → Native VPN ($NATIVE_VPN_IFACE) → Internet"
echo ""
echo "    Privacy: Your ISP sees only native VPN traffic."
echo "    Native VPN provider sees only encrypted ProxhqVPN packets."
echo "    Neither can see plaintext application traffic."
`;
  }

  // namespace mode
  return `#!/usr/bin/env bash
# ProxhqVPN VPN Coexistence — Network Namespace Isolation
# ProxhqVPN runs in its own namespace; native VPN owns the main namespace
# Generated by ProxhqVPN v3.0 — run as root

set -e

NS="ghostnet-ns"
ProxhqVPN_IFACE="${proxhqIface}"
VETH_HOST="veth-ghostnet"
VETH_NS="veth-ghost-ns"

echo "[+] Creating network namespace '$NS' for ProxhqVPN..."
ip netns add $NS 2>/dev/null || echo "    (namespace exists)"

# Veth pair: bridge between main namespace and ghostnet namespace
ip link add $VETH_HOST type veth peer name $VETH_NS 2>/dev/null || true
ip link set $VETH_NS netns $NS
ip addr add 192.168.200.1/30 dev $VETH_HOST
ip netns exec $NS ip addr add 192.168.200.2/30 dev $VETH_NS
ip link set $VETH_HOST up
ip netns exec $NS ip link set $VETH_NS up
ip netns exec $NS ip link set lo up

# Default route in namespace goes through veth pair
ip netns exec $NS ip route add default via 192.168.200.1

# Enable IP forwarding and NAT for namespace traffic
sysctl -qw net.ipv4.ip_forward=1
iptables -t nat -A POSTROUTING -s 192.168.200.0/30 -j MASQUERADE

echo "[+] Namespace '$NS' created."
echo "    Run ProxhqVPN inside namespace:"
echo "    sudo ip netns exec $NS ./ghostd.py --mode server"
echo ""
echo "    Native VPN continues in main namespace (unchanged)."
echo "    ProxhqVPN and native VPN are fully isolated — no conflicts."
`;
}

function generateWindowsCoexistScript(detectedVpnIface: string, mode: string): string {
  return `@echo off
:: ProxhqVPN VPN Coexistence — Windows Route Table
:: Mode: ${mode}
:: Generated by ProxhqVPN v3.0 — Run as Administrator

echo [+] ProxhqVPN VPN Coexistence Setup (Windows)
echo     Native VPN interface: ${detectedVpnIface || "Auto-detected"}
echo.

:: Set higher metric on ProxhqVPN adapter to avoid conflicts
:: Lower number = preferred. ProxhqVPN should NOT override the native VPN
:: unless explicitly configured.

:: Find ProxhqVPN tunnel adapter (WinTun / ProxhqVPN0)
netsh interface ipv4 show interfaces | findstr /i "ghostnet wintun tun"

:: Set interface metrics
:: ProxhqVPN: metric 50 (handles specific traffic)
:: Native VPN: metric 5 (default, handles everything else)
netsh interface ipv4 set interface "ProxhqVPN" metric=50 2>nul
netsh interface ipv4 set interface "${detectedVpnIface || "NordLynx"}" metric=5 2>nul

:: Add specific routes through ProxhqVPN tunnel
:: Example: route all 10.99.0.0/24 (ProxhqVPN mesh) through tun
route add 10.99.0.0 MASK 255.255.255.0 10.99.0.1 IF 50

:: LAN exceptions — never route these through VPN
route add 192.168.0.0 MASK 255.255.0.0 0.0.0.0 METRIC 1
route add 10.0.0.0 MASK 255.0.0.0 0.0.0.0 METRIC 1

:: MTU for double-hop (if in double-hop mode)
${mode === "double-hop" ? 'netsh interface ipv4 set subinterface "ProxhqVPN" mtu=1380 store=persistent' : ":: (MTU adjustment not needed in this mode)"}

echo.
echo [+] Routes configured. Verify with: route print
echo [+] ProxhqVPN and ${detectedVpnIface || "Native VPN"} are now co-active.
pause
`;
}

function generateMacOSCoexistScript(detectedVpnIface: string, mode: string): string {
  return `#!/usr/bin/env bash
# ProxhqVPN VPN Coexistence — macOS pf + route
# Mode: ${mode}
# Generated by ProxhqVPN v3.0 — run as root (sudo)

set -e

ProxhqVPN_IFACE="${mode === "namespace" ? "utun10" : "utun5"}"
NATIVE_VPN_IFACE="${detectedVpnIface || "utun0"}"

echo "[+] ProxhqVPN macOS coexistence setup..."

# macOS uses utun interfaces for VPN tunnels
# Check active interfaces
ifconfig | grep -E "^utun" | awk '{print $1}'

# Set routing for ProxhqVPN mesh (10.99.0.0/24) to ProxhqVPN interface
route -n add -net 10.99.0.0/24 -interface $ProxhqVPN_IFACE 2>/dev/null || true
echo "[+] ProxhqVPN mesh routed via $ProxhqVPN_IFACE"

# Set MTU for ProxhqVPN tunnel (avoid fragmentation)
${mode === "double-hop" ? "ifconfig $ProxhqVPN_IFACE mtu 1380" : "ifconfig $ProxhqVPN_IFACE mtu 1420"}
echo "[+] MTU configured"

# LAN bypass — these never go through any VPN
route -n add -net 192.168.0.0/16 -interface en0 2>/dev/null || true
route -n add -net 172.16.0.0/12 -interface en0 2>/dev/null || true

# pf rules for coexistence
PF_ANCHOR="/etc/pf.anchors/ghostnet_coexist"
cat > $PF_ANCHOR << 'PF_EOF'
# ProxhqVPN coexistence pf anchor
# Block ProxhqVPN-sourced traffic from leaking to native VPN iface
pass out on $ProxhqVPN_IFACE all
pass in on $ProxhqVPN_IFACE all
# Do not redirect ProxhqVPN control port (7475) through native VPN
pass out proto tcp from any to 127.0.0.1 port 7475 keep state
PF_EOF

echo "[+] pf anchor written to $PF_ANCHOR"
echo "    Load with: sudo pfctl -a ghostnet_coexist -f $PF_ANCHOR"
echo ""
echo "[+] ProxhqVPN ($ProxhqVPN_IFACE) and native VPN ($NATIVE_VPN_IFACE) co-active."
echo "    Verify: netstat -rn | grep -E 'utun|tun'"
`;
}

// ─── Routes ────────────────────────────────────────────────────────────────

// GET /api/vpn-coexist/profiles
router.get("/profiles", (_req, res) => {
  res.json({ profiles: VPN_PROFILES, count: VPN_PROFILES.length });
});

// GET /api/vpn-coexist/detect
router.get("/detect", (_req, res) => {
  const platform = os.platform();
  let result: ReturnType<typeof detectRunningVpns> = { found: [] };

  try {
    result = detectRunningVpns();
  } catch (e) {
    // graceful degradation in sandboxed envs
  }

  res.json({
    platform,
    platformLabel: platform === "linux" ? "Linux" : platform === "darwin" ? "macOS" : platform === "win32" ? "Windows" : platform,
    detectedVpns: result.found,
    detectedCount: result.found.length,
    coexistSupported: platform !== "win32" ? true : true,
    note: result.found.length === 0
      ? "No commercial VPN processes detected. If your VPN is running, select it manually from the profiles list."
      : `Detected ${result.found.length} VPN(s) running. Coexistence scripts generated for each.`,
    ghostnetInterfaces: ["tun0", "ghostnet0", "wg-ghost"],
    recommendedGhostnetIface: "ghostnet0",
  });
});

// GET /api/vpn-coexist/exceptions
router.get("/exceptions", (_req, res) => {
  res.json({ exceptions, count: exceptions.length });
});

// POST /api/vpn-coexist/exceptions
router.post("/exceptions", (req, res) => {
  const schema = z.object({
    cidr: z.string().min(1).max(50),
    description: z.string().max(200).default(""),
    action: z.enum(["bypass-proxhq", "force-proxhq", "block"]).default("bypass-proxhq"),
  });
  const body = schema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const rule: ExceptionRule = {
    id: `exc-${Date.now()}`,
    cidr: body.data.cidr,
    description: body.data.description,
    action: body.data.action,
    source: "manual",
    addedAt: new Date().toISOString(),
  };
  exceptions.push(rule);
  res.status(201).json({ added: rule });
});

// DELETE /api/vpn-coexist/exceptions/:id
router.delete("/exceptions/:id", (req, res) => {
  const idx = exceptions.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Exception not found" });
  const removed = exceptions.splice(idx, 1)[0];
  res.json({ removed });
});

// POST /api/vpn-coexist/generate-rules
router.post("/generate-rules", (req, res) => {
  const schema = z.object({
    vpnProfileId: z.string().default("wireguard-generic"),
    mode: z.enum(["fwmark", "double-hop", "namespace", "routing-table"]).default("fwmark"),
    detectedIface: z.string().max(20).default("tun0"),
    proxhqIface: z.string().max(20).default("proxhq0"),
    proxhqFwmark: z.number().int().min(1).max(255).default(100),
    targetOs: z.enum(["linux", "macos", "windows"]).default("linux"),
  });
  const body = schema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const { vpnProfileId, mode, detectedIface, proxhqIface: ghostnetIface, proxhqFwmark, targetOs } = body.data;
  const profile = VPN_PROFILES.find(p => p.id === vpnProfileId) ?? VPN_PROFILES[0];

  const exceptionCidrs = exceptions
    .filter(e => e.action === "bypass-proxhq")
    .map(e => e.cidr);

  let script = "";
  let disableScript = "";

  if (targetOs === "linux") {
    script = generateLinuxCoexistScript(mode, detectedIface, ghostnetIface, proxhqFwmark, [
      ...profile.serverCidrs,
      ...exceptionCidrs,
    ]);
    disableScript = `#!/usr/bin/env bash
# ProxhqVPN coexistence DISABLE script
ip rule del fwmark ${proxhqFwmark} table 200 2>/dev/null || true
ip route flush table 200 2>/dev/null || true
iptables -t mangle -F ProxhqVPN_COEXIST 2>/dev/null || true
iptables -t mangle -D PREROUTING -j ProxhqVPN_COEXIST 2>/dev/null || true
echo "[+] ProxhqVPN coexistence rules removed."
`;
  } else if (targetOs === "macos") {
    script = generateMacOSCoexistScript(detectedIface, mode);
    disableScript = `#!/usr/bin/env bash
# Undo ProxhqVPN coexistence (macOS)
route -n delete -net 10.99.0.0/24 2>/dev/null || true
sudo pfctl -a ghostnet_coexist -F rules 2>/dev/null || true
echo "[+] ProxhqVPN coexistence rules removed."
`;
  } else {
    script = generateWindowsCoexistScript(detectedIface, mode);
    disableScript = `@echo off
:: Undo ProxhqVPN coexistence (Windows)
route delete 10.99.0.0
netsh interface ipv4 set interface "ProxhqVPN" metric=automatic 2>nul
echo [+] ProxhqVPN coexistence rules removed.
`;
  }

  const mtu = mode === "double-hop" ? 1380 : 1420;

  res.json({
    profile: { id: profile.id, name: profile.name },
    mode,
    targetOs,
    detectedIface,
    ghostnetIface,
    mtu,
    enableScript: script,
    disableScript,
    exceptionCidrsIncluded: exceptionCidrs,
    notes: [
      `Run the enable script as root/Administrator.`,
      `Keep the disable script safe to undo these changes.`,
      `MTU for ProxhqVPN tunnel set to ${mtu}${mode === "double-hop" ? " (double-hop reduces MTU by 40 bytes per hop)." : "."}`,
      profile.notes,
    ],
  });
});

// POST /api/vpn-coexist/mtu-optimize
router.post("/mtu-optimize", (req, res) => {
  const schema = z.object({
    baseMtu: z.number().int().min(576).max(9000).default(1500),
    hopCount: z.number().int().min(1).max(4).default(1),
    protocol: z.enum(["wireguard", "openvpn", "custom"]).default("wireguard"),
    overhead: z.number().int().min(0).max(200).default(0),
  });
  const body = schema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const { baseMtu, hopCount, protocol, overhead } = body.data;

  const OVERHEAD = {
    wireguard: 60,
    openvpn: 80,
    custom: overhead,
  };

  const perHopOverhead = OVERHEAD[protocol];
  const recommended = baseMtu - (perHopOverhead * hopCount);
  const safe = recommended - 40;

  res.json({
    baseMtu,
    hopCount,
    protocol,
    perHopOverheadBytes: perHopOverhead,
    recommendedMtu: recommended,
    safeMtu: safe,
    breakdown: Array.from({ length: hopCount }, (_, i) => ({
      hop: i + 1,
      label: i === 0 ? "Native VPN" : `ProxhqVPN hop ${i}`,
      mtu: baseMtu - perHopOverhead * (i + 1),
    })),
    commands: {
      linux: `ip link set ghostnet0 mtu ${recommended}`,
      macos: `ifconfig utun5 mtu ${recommended}`,
      windows: `netsh interface ipv4 set subinterface "ProxhqVPN" mtu=${recommended} store=persistent`,
    },
    warning: recommended < 1280 ? "MTU below 1280 may cause IPv6 connectivity issues." : null,
  });
});

// GET /api/vpn-coexist/security-tool-exceptions
router.get("/security-tool-exceptions", (_req, res) => {
  res.json({ rules: toolExceptions, count: toolExceptions.length });
});

// POST /api/vpn-coexist/security-tool-exceptions
router.post("/security-tool-exceptions", (req, res) => {
  const schema = z.object({
    tool: z.string().min(1).max(60),
    toolLabel: z.string().min(1).max(60),
    outboundBypass: z.boolean().default(true),
    inboundBypass: z.boolean().default(true),
    ports: z.string().default("*"),
    protocols: z.array(z.string()).default(["tcp"]),
    cidr: z.string().default("*"),
    note: z.string().default(""),
  });
  const body = schema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  const rule: ToolExceptionRule = {
    ...body.data,
    id: `tool-exc-${Date.now()}`,
    enabled: true,
    addedAt: new Date().toISOString(),
  };
  toolExceptions.push(rule);
  res.status(201).json({ added: rule });
});

// PUT /api/vpn-coexist/security-tool-exceptions/:id
router.put("/security-tool-exceptions/:id", (req, res) => {
  const idx = toolExceptions.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Rule not found" });
  const schema = z.object({
    outboundBypass: z.boolean().optional(),
    inboundBypass: z.boolean().optional(),
    ports: z.string().optional(),
    protocols: z.array(z.string()).optional(),
    cidr: z.string().optional(),
    note: z.string().optional(),
    enabled: z.boolean().optional(),
  });
  const body = schema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });
  toolExceptions[idx] = { ...toolExceptions[idx], ...body.data };
  res.json({ updated: toolExceptions[idx] });
});

// DELETE /api/vpn-coexist/security-tool-exceptions/:id
router.delete("/security-tool-exceptions/:id", (req, res) => {
  const idx = toolExceptions.findIndex(e => e.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: "Rule not found" });
  const [removed] = toolExceptions.splice(idx, 1);
  res.json({ removed });
});

// POST /api/vpn-coexist/security-tool-exceptions/generate-rules
router.post("/security-tool-exceptions/generate-rules", (req, res) => {
  const { proxhqIface = "ghostnet0", fwmark: rawFwmark } = (req.body ?? {}) as { proxhqIface?: string; fwmark?: unknown };
  const auditMark = typeof rawFwmark === "number" ? rawFwmark : 0x5050;
  const markHex = `0x${auditMark.toString(16)}`;

  const enabled = toolExceptions.filter(r => r.enabled);
  const outbound = enabled.filter(r => r.outboundBypass);
  const inbound  = enabled.filter(r => r.inboundBypass);

  const iptables: string[] = [
    `# ProxhqVPN Security Tool Firewall Exceptions — iptables`,
    `# Generated ${new Date().toISOString()}`,
    `# Audit fwmark: ${markHex} — marks tool traffic so it bypasses the kill switch`,
    ``,
    `# ── MANGLE: mark outbound tool traffic ────────────────────────────────`,
    `iptables -t mangle -N PROXHQ_AUDIT 2>/dev/null || iptables -t mangle -F PROXHQ_AUDIT`,
    `iptables -t mangle -C OUTPUT -j PROXHQ_AUDIT 2>/dev/null || iptables -t mangle -A OUTPUT -j PROXHQ_AUDIT`,
    ``,
    `# Outbound per-tool marks`,
    ...outbound.map(r => {
      const proto = r.protocols.includes("any") ? "" : `-p ${r.protocols[0]}`;
      const ports = r.ports === "*" ? "" : `-m multiport --dports ${r.ports}`;
      const dst   = r.cidr !== "*" ? `-d ${r.cidr}` : "";
      return `iptables -t mangle -A PROXHQ_AUDIT ${proto} ${dst} ${ports} -j MARK --set-mark ${markHex}  # ${r.toolLabel}`.replace(/\s+/g, " ").trim();
    }),
    ``,
    `# ── FILTER: allow marked traffic through kill switch ──────────────────`,
    `iptables -N PROXHQ_AUDIT_ALLOW 2>/dev/null || iptables -F PROXHQ_AUDIT_ALLOW`,
    `iptables -C OUTPUT -j PROXHQ_AUDIT_ALLOW 2>/dev/null || iptables -A OUTPUT -j PROXHQ_AUDIT_ALLOW`,
    `iptables -A PROXHQ_AUDIT_ALLOW -m mark --mark ${markHex} -j ACCEPT`,
    ``,
    `# ── INPUT: allow inbound responses for active tool sessions ───────────`,
    `iptables -N PROXHQ_AUDIT_IN 2>/dev/null || iptables -F PROXHQ_AUDIT_IN`,
    `iptables -C INPUT -j PROXHQ_AUDIT_IN 2>/dev/null || iptables -A INPUT -j PROXHQ_AUDIT_IN`,
    ...inbound.map(r => {
      const proto = r.protocols.includes("any") ? "" : `-p ${r.protocols[0]}`;
      const ports = r.ports === "*" ? "" : `-m multiport --sports ${r.ports}`;
      return `iptables -A PROXHQ_AUDIT_IN ${proto} ${ports} -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT  # ${r.toolLabel}`.replace(/\s+/g, " ").trim();
    }),
    ``,
    `# ── Cleanup (run to revert) ────────────────────────────────────────────`,
    `# iptables -t mangle -F PROXHQ_AUDIT && iptables -t mangle -D OUTPUT -j PROXHQ_AUDIT`,
    `# iptables -F PROXHQ_AUDIT_ALLOW && iptables -D OUTPUT -j PROXHQ_AUDIT_ALLOW`,
    `# iptables -F PROXHQ_AUDIT_IN && iptables -D INPUT -j PROXHQ_AUDIT_IN`,
  ];

  const nftables: string[] = [
    `#!/usr/sbin/nft -f`,
    `# ProxhqVPN Audit Exemption Rules (nftables)`,
    `# Generated ${new Date().toISOString()}`,
    `table inet proxhq_audit {`,
    `  chain mangle_output {`,
    `    type filter hook output priority mangle; policy accept;`,
    ...outbound.map(r => {
      const proto = r.protocols.includes("any") ? "" : `${r.protocols[0]} `;
      const ports = r.ports === "*" ? "" : `dport { ${r.ports} } `;
      return `    ${proto}${ports}meta mark set ${markHex}  # ${r.toolLabel}`;
    }),
    `    meta mark ${markHex} accept`,
    `  }`,
    `  chain filter_input {`,
    `    type filter hook input priority filter; policy accept;`,
    ...inbound.map(r => {
      const proto = r.protocols.includes("any") ? "" : `${r.protocols[0]} `;
      const ports = r.ports === "*" ? "" : `sport { ${r.ports} } `;
      return `    ${proto}${ports}ct state established,related accept  # ${r.toolLabel}`;
    }),
    `  }`,
    `}`,
  ];

  const wgKillSwitch = [
    `# Add to [Interface] section of your WireGuard config (wg0.conf / ghostnet.conf)`,
    `# This creates an exception so ProxhqVPN security tools work through the kill switch`,
    ``,
    `PostUp   = iptables -t mangle -N PROXHQ_AUDIT 2>/dev/null; \\`,
    `           iptables -t mangle -A OUTPUT -j PROXHQ_AUDIT; \\`,
    `           iptables -t mangle -A PROXHQ_AUDIT -s 10.99.0.0/24 -j MARK --set-mark ${markHex}; \\`,
    `           iptables -A OUTPUT -m mark --mark ${markHex} -j ACCEPT; \\`,
    `           iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT`,
    ``,
    `PostDown = iptables -t mangle -F PROXHQ_AUDIT 2>/dev/null; \\`,
    `           iptables -t mangle -D OUTPUT -j PROXHQ_AUDIT 2>/dev/null; \\`,
    `           iptables -D OUTPUT -m mark --mark ${markHex} -j ACCEPT 2>/dev/null; \\`,
    `           iptables -D INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT 2>/dev/null`,
  ];

  const pf_rules = [
    `# macOS pf anchor — ProxhqVPN audit exceptions`,
    `# Add to /etc/pf.anchors/proxhq_audit then load with: sudo pfctl -a proxhq_audit -f /etc/pf.anchors/proxhq_audit`,
    `pass out on ${proxhqIface} all flags S/SA keep state`,
    `pass in  on ${proxhqIface} all keep state`,
    ...outbound.map(r => {
      const proto = r.protocols[0] === "any" ? "tcp" : r.protocols[0];
      const ports = r.ports === "*" ? "" : `port { ${r.ports} }`;
      return `pass out proto ${proto} to any ${ports} keep state  # ${r.toolLabel}`;
    }),
  ];

  res.json({
    iptables: iptables.join("\n"),
    nftables: nftables.join("\n"),
    wireguardKillSwitchException: wgKillSwitch.join("\n"),
    pfRules: pf_rules.join("\n"),
    auditFwmark: markHex,
    enabledRules: enabled.length,
    outboundRules: outbound.length,
    inboundRules: inbound.length,
    generatedAt: new Date().toISOString(),
  });
});

// GET /api/vpn-coexist/status
router.get("/status", (_req, res) => {
  const platform = os.platform();
  let activeRules: string[] = [];
  let ghostnetActive = false;

  try {
    if (platform === "linux") {
      const rules = execSync("ip rule list 2>/dev/null", { timeout: 2000 }).toString();
      activeRules = rules.split("\n").filter(l => l.includes("fwmark") || l.includes("table 2"));
      const ifaces = execSync("ip link show 2>/dev/null", { timeout: 2000 }).toString();
      ghostnetActive = ifaces.includes("ghostnet0:") || ifaces.includes("tun0:");
    } else if (platform === "darwin") {
      const routes = execSync("netstat -rn 2>/dev/null", { timeout: 2000 }).toString();
      activeRules = routes.split("\n").filter(l => l.includes("utun"));
      ghostnetActive = routes.includes("10.99.");
    }
  } catch {}

  res.json({
    platform,
    ghostnetActive,
    coexistRulesActive: activeRules.length > 0,
    activeRules,
    exceptionCount: exceptions.length,
    recommendedMode: platform === "linux" ? "fwmark" : platform === "darwin" ? "routing-table" : "routing-table",
  });
});

export default router;
