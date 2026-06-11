// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { z } from "zod";
import os from "os";
import { execSync } from "child_process";
import { db } from "@workspace/db";
import { nodesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

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

interface VultrNode { ip: string; port: number; name: string; region: string; ramKey: boolean }

function generateLinuxCoexistScript(
  mode: string,
  detectedVpnIface: string,
  proxhqIface: string,
  proxhqFwmark: number,
  extraExceptions: string[],
  nodes: VultrNode[],
): string {
  const tableId = 200;
  const exceptions_str = extraExceptions.map(c => `ip route add ${c} dev ${detectedVpnIface} table ${tableId} 2>/dev/null || true`).join("\n");
  const wgSubnet = "10.8.0.0/24";

  // Critical: for each Vultr node, we must add a direct route + kill-switch exception
  // so that WireGuard UDP packets can reach the server even when the kill switch is active.
  const nodeBlock = nodes.length > 0
    ? nodes.map(n => `
# ── ${n.name} (${n.region}) — Vultr ${n.ip}:${n.port} ${n.ramKey ? "[RAM keys]" : ""} ──
GWAY_${n.name.replace(/[^a-zA-Z0-9]/g, "_")}=$(ip route get ${n.ip} 2>/dev/null | awk 'NR==1{for(i=1;i<=NF;i++){if($i=="via"){print $(i+1);exit}}}')
if [ -n "$GWAY_${n.name.replace(/[^a-zA-Z0-9]/g, "_")}" ]; then
  ip route add ${n.ip}/32 via $GWAY_${n.name.replace(/[^a-zA-Z0-9]/g, "_")} 2>/dev/null || true
  echo "[+]   Route: ${n.ip}/32 via $GWAY_${n.name.replace(/[^a-zA-Z0-9]/g, "_")} (main table)"
else
  ip route add ${n.ip}/32 dev $(ip route | awk '/^default/{print $5;exit}') 2>/dev/null || true
  echo "[+]   Route: ${n.ip}/32 via default gateway"
fi
iptables -I OUTPUT -d ${n.ip}/32 -p udp --dport ${n.port} -j ACCEPT
iptables -I INPUT  -s ${n.ip}/32 -p udp --sport ${n.port} -j ACCEPT`).join("\n")
    : `# No Vultr nodes selected — add server IP exceptions manually if using a kill switch`;

  const nodeIps = nodes.map(n => n.ip).join(", ");

  if (mode === "fwmark") {
    return `#!/usr/bin/env bash
# ProxhqVPN VPN Coexistence — fwmark Policy Routing
# Mode: fwmark (traffic marked ${proxhqFwmark} → ProxhqVPN, rest → ${detectedVpnIface})
# Vultr nodes: ${nodeIps || "none selected"}
# Generated by ProxhqVPN v3.0 — run as root

set -euo pipefail

ProxhqVPN_IFACE="${proxhqIface}"
NATIVE_VPN_IFACE="${detectedVpnIface}"
FWMARK=${proxhqFwmark}
TABLE=${tableId}

echo "[+] Setting up ProxhqVPN coexistence routing (fwmark mode)..."

# ── STEP 1: Vultr server exceptions ──────────────────────────────────────────
# CRITICAL: These routes + iptables rules allow WireGuard UDP to reach the
# Vultr servers. Without this, the kill switch blocks the tunnel itself.
echo "[+] Adding Vultr server IP exceptions..."
${nodeBlock}

# ── STEP 2: Create routing table for ProxhqVPN traffic ───────────────────────
ip route flush table $TABLE 2>/dev/null || true
ip route add default dev $ProxhqVPN_IFACE table $TABLE
echo "[+] Routing table $TABLE: default → $ProxhqVPN_IFACE"

# ── STEP 3: fwmark rule — marked packets use ProxhqVPN table ─────────────────
ip rule del fwmark $FWMARK table $TABLE 2>/dev/null || true
ip rule add fwmark $FWMARK table $TABLE priority 100
echo "[+] fwmark $FWMARK → table $TABLE"

# ── STEP 4: Native VPN server CIDRs bypass ProxhqVPN ────────────────────────
${exceptions_str || "# No additional CIDR exceptions"}

# ── STEP 5: iptables — mark ProxhqVPN WireGuard subnet traffic ───────────────
iptables -t mangle -F ProxhqVPN_COEXIST 2>/dev/null || iptables -t mangle -N ProxhqVPN_COEXIST
iptables -t mangle -C PREROUTING -j ProxhqVPN_COEXIST 2>/dev/null || iptables -t mangle -A PREROUTING -j ProxhqVPN_COEXIST
iptables -t mangle -A ProxhqVPN_COEXIST -s ${wgSubnet} -j MARK --set-mark $FWMARK
iptables -t mangle -A ProxhqVPN_COEXIST -d ${wgSubnet} -j MARK --set-mark $FWMARK
echo "[+] iptables mangle: ${wgSubnet} → fwmark $FWMARK"

# ── STEP 6: Verify ────────────────────────────────────────────────────────────
echo ""
echo "[+] Active fwmark rules:"
ip rule list | grep -E "fwmark|table ${tableId}" || true
echo "[+] ProxhqVPN routing table $TABLE:"
ip route show table $TABLE
echo ""
echo "[✓] ProxhqVPN coexistence active."
echo "    • ProxhqVPN traffic:  ${wgSubnet} → fwmark $FWMARK → table $TABLE → $ProxhqVPN_IFACE"
echo "    • Native VPN traffic: $NATIVE_VPN_IFACE → main table (unchanged)"
echo "    • Vultr nodes:        Direct route (bypasses kill switch correctly)"
echo ""
echo "    To disable: run proxhqvpn-coexist-disable.sh"
`;
  }

  if (mode === "double-hop") {
    const firstNode = nodes[0];
    return `#!/usr/bin/env bash
# ProxhqVPN VPN Coexistence — Double-Hop Mode
# Traffic: Your Device → ProxhqVPN (${proxhqIface}) → ${detectedVpnIface} → Internet
# Vultr nodes: ${nodeIps || "none selected"}
# Generated by ProxhqVPN v3.0 — run as root

set -euo pipefail

ProxhqVPN_IFACE="${proxhqIface}"
NATIVE_VPN_IFACE="${detectedVpnIface}"

echo "[+] Configuring double-hop VPN routing..."

# ── MTU: critical for double-encapsulation ────────────────────────────────────
# Ethernet (1500) → Native VPN (-60~80B) → ProxhqVPN (-60B) = ~1380 safe MTU
ip link set $ProxhqVPN_IFACE mtu 1380 2>/dev/null || true
echo "[+] MTU 1380 on $ProxhqVPN_IFACE (prevents fragmentation in double-hop)"

# ── Route ProxhqVPN Vultr servers through native VPN ─────────────────────────
# The outer tunnel (native VPN) carries inner tunnel (ProxhqVPN) packets.
# Vultr server IPs must exit via the native VPN, not the default gateway.
echo "[+] Routing ProxhqVPN Vultr servers through native VPN ($NATIVE_VPN_IFACE)..."
${nodes.length > 0
  ? nodes.map(n => `ip route add ${n.ip}/32 dev $NATIVE_VPN_IFACE 2>/dev/null || true
echo "[+]   ${n.name} (${n.region}): ${n.ip}:${n.port} → $NATIVE_VPN_IFACE"`).join("\n")
  : `# No Vultr nodes — set ProxhqVPN_SERVER_IP manually:
ProxhqVPN_SERVER_IP="\${ProxhqVPN_SERVER_IP:?ERROR: set ProxhqVPN_SERVER_IP to your Vultr server IP}"
ip route add $ProxhqVPN_SERVER_IP/32 dev $NATIVE_VPN_IFACE 2>/dev/null || true`}

# ── Set ProxhqVPN as default route (traffic exits via native VPN) ─────────────
ip route replace default dev $ProxhqVPN_IFACE
echo "[+] Default route → $ProxhqVPN_IFACE"

echo ""
echo "[✓] Double-hop active:"
echo "    Device → ProxhqVPN ($ProxhqVPN_IFACE) → Native VPN ($NATIVE_VPN_IFACE) → Internet"
echo ""
echo "    Privacy:  ISP sees only native VPN traffic."
echo "              Native VPN sees only encrypted ProxhqVPN packets."
echo "              Neither provider can see plaintext application data."
${firstNode ? `echo "    Primary:  ${firstNode.name} (${firstNode.region}) — ${firstNode.ip}"` : ""}
`;
  }

  // namespace mode
  return `#!/usr/bin/env bash
# ProxhqVPN VPN Coexistence — Network Namespace Isolation
# ProxhqVPN in its own namespace; native VPN owns the main namespace
# Vultr nodes: ${nodeIps || "none selected"}
# Generated by ProxhqVPN v3.0 — run as root

set -euo pipefail

NS="ghostnet-ns"
ProxhqVPN_IFACE="${proxhqIface}"
VETH_HOST="veth-ghostnet"
VETH_NS="veth-ghost-ns"

echo "[+] Creating network namespace '$NS' for ProxhqVPN..."
ip netns add $NS 2>/dev/null || echo "    (namespace already exists)"

# ── Veth pair: bridge between namespaces ─────────────────────────────────────
ip link add $VETH_HOST type veth peer name $VETH_NS 2>/dev/null || true
ip link set $VETH_NS netns $NS
ip addr add 192.168.200.1/30 dev $VETH_HOST 2>/dev/null || true
ip netns exec $NS ip addr add 192.168.200.2/30 dev $VETH_NS 2>/dev/null || true
ip link set $VETH_HOST up
ip netns exec $NS ip link set $VETH_NS up
ip netns exec $NS ip link set lo up
ip netns exec $NS ip route add default via 192.168.200.1

# ── NAT: allow namespace traffic to reach the internet ───────────────────────
sysctl -qw net.ipv4.ip_forward=1
iptables -t nat -C POSTROUTING -s 192.168.200.0/30 -j MASQUERADE 2>/dev/null || \
  iptables -t nat -A POSTROUTING -s 192.168.200.0/30 -j MASQUERADE

# ── Vultr server IPs: pre-route in main namespace ────────────────────────────
# Make sure the main namespace can reach Vultr nodes directly.
${nodeBlock}

echo ""
echo "[✓] Namespace '$NS' created. Run ProxhqVPN inside it:"
echo "    sudo ip netns exec $NS wg-quick up /etc/wireguard/proxhqvpn.conf"
echo ""
echo "    Native VPN continues in main namespace (fully isolated — no conflicts)."
${nodes.length > 0 ? `echo "    Vultr nodes: ${nodeIps}"` : ""}
`;
}

function generateWindowsCoexistScript(detectedVpnIface: string, mode: string, nodes: VultrNode[]): string {
  const nodeRoutes = nodes.length > 0
    ? nodes.map(n =>
        `:: ${n.name} (${n.region}) — Vultr ${n.ip}:${n.port}\n` +
        `route add ${n.ip} MASK 255.255.255.255 0.0.0.0 METRIC 1\n` +
        `netsh advfirewall firewall add rule name="ProxhqVPN-WG-${n.name}" ` +
        `dir=out action=allow protocol=UDP remoteip=${n.ip} remoteport=${n.port}`
      ).join("\n")
    : ":: No Vultr nodes selected — add server IP routes manually";
  const nodeIps = nodes.map(n => n.ip).join(", ");
  return `@echo off
:: ProxhqVPN VPN Coexistence — Windows Route Table
:: Mode: ${mode}
:: Vultr nodes: ${nodeIps || "none selected"}
:: Generated by ProxhqVPN v3.0 — Run as Administrator

echo [+] ProxhqVPN VPN Coexistence Setup (Windows)
echo     Native VPN interface: ${detectedVpnIface || "Auto-detected"}
echo.

:: ── STEP 1: Vultr server host routes ────────────────────────────────────────
:: CRITICAL: These host routes (/32) ensure WireGuard UDP traffic to the
:: Vultr servers goes through the physical NIC, not the VPN tunnel.
:: Without this, the kill switch severs the WireGuard connection itself.
echo [+] Adding Vultr server host routes...
${nodeRoutes}
echo.

:: ── STEP 2: Interface metrics ────────────────────────────────────────────────
:: ProxhqVPN metric=50 (handles specific mesh traffic)
:: Native VPN metric=5 (default handler for everything else)
netsh interface ipv4 set interface "ProxhqVPN" metric=50 2>nul
netsh interface ipv4 set interface "${detectedVpnIface || "NordLynx"}" metric=5 2>nul

:: ── STEP 3: ProxhqVPN mesh subnet via tunnel ─────────────────────────────────
route add 10.8.0.0 MASK 255.255.255.0 10.8.0.1

:: ── STEP 4: LAN bypass — never route through VPN ────────────────────────────
route add 192.168.0.0 MASK 255.255.0.0 0.0.0.0 METRIC 1
route add 10.0.0.0   MASK 255.0.0.0   0.0.0.0 METRIC 1
route add 172.16.0.0 MASK 255.240.0.0 0.0.0.0 METRIC 1

:: ── STEP 5: MTU for double-hop ───────────────────────────────────────────────
${mode === "double-hop" ? 'netsh interface ipv4 set subinterface "ProxhqVPN" mtu=1380 store=persistent' : ":: (Standard MTU — double-hop not selected)"}

echo.
echo [+] Routes configured. Verify with: route print
echo [+] ProxhqVPN and ${detectedVpnIface || "Native VPN"} are now co-active.
echo     Vultr nodes: ${nodeIps || "none"}
pause
`;
}

function generateMacOSCoexistScript(detectedVpnIface: string, mode: string, nodes: VultrNode[]): string {
  const proxhqIface = mode === "namespace" ? "utun10" : "utun5";
  const nativeIface = detectedVpnIface || "utun0";
  const nodeIps = nodes.map(n => n.ip).join(", ");
  const nodeRoutes = nodes.length > 0
    ? nodes.map(n =>
        `# ${n.name} (${n.region}) — Vultr ${n.ip}:${n.port}\n` +
        `route -n add -host ${n.ip} -interface $(route -n get default | awk '/interface:/{print $2}') 2>/dev/null || true\n` +
        `echo "[+]   ${n.name}: ${n.ip} → physical NIC (bypasses kill switch)"`
      ).join("\n")
    : "# No Vultr nodes selected — add server host routes manually";
  return `#!/usr/bin/env bash
# ProxhqVPN VPN Coexistence — macOS pf + route
# Mode: ${mode}
# Vultr nodes: ${nodeIps || "none selected"}
# Generated by ProxhqVPN v3.0 — run as root (sudo)

set -euo pipefail

ProxhqVPN_IFACE="${proxhqIface}"
NATIVE_VPN_IFACE="${nativeIface}"

echo "[+] ProxhqVPN macOS coexistence setup..."
echo "    ProxhqVPN iface: $ProxhqVPN_IFACE | Native VPN: $NATIVE_VPN_IFACE"
echo ""

# ── Active utun interfaces ────────────────────────────────────────────────────
echo "[+] Active tunnel interfaces:"
ifconfig | grep -E "^utun" | awk '{print "    " $1}'

# ── STEP 1: Vultr server host routes ─────────────────────────────────────────
# CRITICAL: WireGuard UDP to each Vultr server must go through the physical
# NIC, not the VPN tunnel — otherwise the kill switch blocks the tunnel itself.
echo "[+] Adding Vultr server host routes via physical gateway..."
${nodeRoutes}

# ── STEP 2: ProxhqVPN mesh subnet ────────────────────────────────────────────
route -n add -net 10.8.0.0/24 -interface $ProxhqVPN_IFACE 2>/dev/null || true
echo "[+] ProxhqVPN mesh 10.8.0.0/24 → $ProxhqVPN_IFACE"

# ── STEP 3: MTU ───────────────────────────────────────────────────────────────
${mode === "double-hop"
  ? `ifconfig $ProxhqVPN_IFACE mtu 1380\necho "[+] MTU 1380 (double-hop mode)"`
  : `ifconfig $ProxhqVPN_IFACE mtu 1420\necho "[+] MTU 1420"`}

# ── STEP 4: LAN bypass ───────────────────────────────────────────────────────
route -n add -net 192.168.0.0/16 -interface en0 2>/dev/null || true
route -n add -net 172.16.0.0/12  -interface en0 2>/dev/null || true
echo "[+] LAN (192.168/172.16) → en0 (no VPN)"

# ── STEP 5: pf anchor ────────────────────────────────────────────────────────
PF_ANCHOR="/etc/pf.anchors/proxhqvpn_coexist"
cat > $PF_ANCHOR << 'PF_EOF'
# ProxhqVPN coexistence pf anchor
pass out on $ProxhqVPN_IFACE all
pass in  on $ProxhqVPN_IFACE all
pass out proto tcp from any to 127.0.0.1 port 7475 keep state
PF_EOF

echo "[+] pf anchor → $PF_ANCHOR"
echo "    Load with: sudo pfctl -a proxhqvpn_coexist -f $PF_ANCHOR"
echo ""
echo "[✓] ProxhqVPN ($ProxhqVPN_IFACE) and native VPN ($NATIVE_VPN_IFACE) co-active."
echo "    Vultr nodes: ${nodeIps || "none"}"
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
router.post("/generate-rules", async (req, res) => {
  const schema = z.object({
    vpnProfileId: z.string().default("wireguard-generic"),
    mode: z.enum(["fwmark", "double-hop", "namespace", "routing-table"]).default("fwmark"),
    detectedIface: z.string().max(20).default("tun0"),
    proxhqIface: z.string().max(20).default("proxhq0"),
    proxhqFwmark: z.number().int().min(1).max(255).default(100),
    targetOs: z.enum(["linux", "macos", "windows"]).default("linux"),
    nodeId: z.number().int().positive().optional(),
  });
  const body = schema.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const { vpnProfileId, mode, detectedIface, proxhqIface: ghostnetIface, proxhqFwmark, targetOs, nodeId } = body.data;
  const profile = VPN_PROFILES.find(p => p.id === vpnProfileId) ?? VPN_PROFILES[0];

  // ── Fetch real Vultr nodes from DB ────────────────────────────────────────
  let vultrNodes: VultrNode[] = [];
  try {
    const rows = nodeId
      ? await db.select().from(nodesTable).where(eq(nodesTable.id, nodeId))
      : await db.select().from(nodesTable).where(eq(nodesTable.status, "active"));
    vultrNodes = rows.map(r => ({
      ip: r.publicIp ?? r.ipAddress,
      port: r.listenPort ?? 51820,
      name: r.name,
      region: r.region ?? "unknown",
      ramKey: r.ramKeyLoaded ?? false,
    }));
  } catch {
    req.log?.warn("vpncoexist: failed to query nodes from DB");
  }

  const exceptionCidrs = exceptions
    .filter(e => e.action === "bypass-proxhq")
    .map(e => e.cidr);

  let script = "";
  let disableScript = "";

  // Build per-node cleanup lines for the disable script
  const nodeCleanup = vultrNodes.length > 0
    ? vultrNodes.map(n =>
        `ip route del ${n.ip}/32 2>/dev/null || true\n` +
        `iptables -D OUTPUT -d ${n.ip}/32 -p udp --dport ${n.port} -j ACCEPT 2>/dev/null || true\n` +
        `iptables -D INPUT  -s ${n.ip}/32 -p udp --sport ${n.port} -j ACCEPT 2>/dev/null || true`
      ).join("\n")
    : "";

  if (targetOs === "linux") {
    script = generateLinuxCoexistScript(mode, detectedIface, ghostnetIface, proxhqFwmark, [
      ...profile.serverCidrs,
      ...exceptionCidrs,
    ], vultrNodes);
    disableScript = `#!/usr/bin/env bash
# ProxhqVPN coexistence DISABLE script
# Removes all rules added by the enable script

set -euo pipefail

echo "[+] Removing ProxhqVPN coexistence rules..."

# Remove Vultr server exceptions
${nodeCleanup || "# (no node-specific rules to remove)"}

# Remove fwmark rule and routing table
ip rule del fwmark ${proxhqFwmark} table 200 2>/dev/null || true
ip route flush table 200 2>/dev/null || true

# Remove iptables mangle chain
iptables -t mangle -D PREROUTING -j ProxhqVPN_COEXIST 2>/dev/null || true
iptables -t mangle -F ProxhqVPN_COEXIST 2>/dev/null || true
iptables -t mangle -X ProxhqVPN_COEXIST 2>/dev/null || true

echo "[✓] ProxhqVPN coexistence rules removed."
`;
  } else if (targetOs === "macos") {
    script = generateMacOSCoexistScript(detectedIface, mode, vultrNodes);
    const macNodeCleanup = vultrNodes.length > 0
      ? vultrNodes.map(n => `route -n delete -host ${n.ip} 2>/dev/null || true`).join("\n")
      : "";
    disableScript = `#!/usr/bin/env bash
# Undo ProxhqVPN coexistence (macOS)

set -euo pipefail

echo "[+] Removing ProxhqVPN coexistence rules..."

# Remove Vultr server host routes
${macNodeCleanup || "# (no node routes to remove)"}

# Remove mesh subnet route
route -n delete -net 10.8.0.0/24 2>/dev/null || true

# Remove pf anchor
sudo pfctl -a proxhqvpn_coexist -F rules 2>/dev/null || true

echo "[✓] ProxhqVPN coexistence rules removed."
`;
  } else {
    script = generateWindowsCoexistScript(detectedIface, mode, vultrNodes);
    const winNodeCleanup = vultrNodes.length > 0
      ? vultrNodes.map(n =>
          `route delete ${n.ip}\n` +
          `netsh advfirewall firewall delete rule name="ProxhqVPN-WG-${n.name}" 2>nul`
        ).join("\n")
      : "";
    disableScript = `@echo off
:: Undo ProxhqVPN coexistence (Windows)

echo [+] Removing ProxhqVPN coexistence rules...

:: Remove Vultr server host routes
${winNodeCleanup || ":: (no node routes to remove)"}

:: Remove mesh subnet
route delete 10.8.0.0

:: Reset interface metrics
netsh interface ipv4 set interface "ProxhqVPN" metric=automatic 2>nul

echo [+] ProxhqVPN coexistence rules removed.
pause
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
    vultrNodes: vultrNodes.map(n => ({ name: n.name, ip: n.ip, port: n.port, region: n.region })),
    notes: [
      `Run the enable script as root/Administrator.`,
      `Keep the disable script safe to undo these changes.`,
      `MTU for ProxhqVPN tunnel set to ${mtu}${mode === "double-hop" ? " (double-hop reduces MTU by 40 bytes per hop)." : "."}`,
      vultrNodes.length > 0
        ? `Vultr node kill-switch exceptions added for: ${vultrNodes.map(n => `${n.name} (${n.ip})`).join(", ")}.`
        : `No Vultr nodes found in DB — kill-switch server exceptions not added. Ensure nodes are registered.`,
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
    `# WireGuard subnet: 10.8.0.0/24 (ProxhqVPN mesh)`,
    ``,
    `PostUp   = iptables -t mangle -N PROXHQ_AUDIT 2>/dev/null; \\`,
    `           iptables -t mangle -A OUTPUT -j PROXHQ_AUDIT; \\`,
    `           iptables -t mangle -A PROXHQ_AUDIT -s 10.8.0.0/24 -j MARK --set-mark ${markHex}; \\`,
    `           iptables -t mangle -A PROXHQ_AUDIT -d 10.8.0.0/24 -j MARK --set-mark ${markHex}; \\`,
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
