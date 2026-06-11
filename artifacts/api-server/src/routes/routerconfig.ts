// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { db } from "@workspace/db";
import { nodesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const FIRMWARE_LIST = [
  // ── Tier 1: Most common ───────────────────────────────────────────────────
  { id: "openwrt",   name: "OpenWRT",             method: "wireguard", notes: "LuCI + kmod-wireguard, 21.02+" },
  { id: "ddwrt",     name: "DD-WRT",              method: "wireguard", notes: "Build 45000+ required" },
  { id: "merlin",    name: "ASUSWRT-Merlin",      method: "wireguard", notes: "Firmware 388.x required" },
  { id: "pfsense",   name: "pfSense / OPNsense",  method: "wireguard", notes: "pfSense 2.5+ / OPNsense 21.7+" },
  { id: "glinet",    name: "GL.iNet",             method: "wireguard", notes: "All GL.iNet models, firmware 3.x/4.x" },
  { id: "ubiquiti",  name: "Ubiquiti EdgeRouter",  method: "wireguard", notes: "EdgeOS WireGuard package" },
  // ── Tier 2: Widely used ───────────────────────────────────────────────────
  { id: "mikrotik",  name: "MikroTik RouterOS",   method: "wireguard", notes: "RouterOS 7.1+ native WireGuard" },
  { id: "unifi",     name: "UniFi Dream Machine",  method: "wireguard", notes: "UDM / UDM Pro / Dream Router" },
  { id: "vyos",      name: "VyOS",                method: "wireguard", notes: "VyOS 1.4+ (Sagitta) or newer" },
  { id: "tomato",    name: "FreshTomato / Tomato", method: "wireguard", notes: "FreshTomato 2022.3+ with WireGuard" },
  { id: "ipfire",    name: "IPFire",              method: "wireguard", notes: "IPFire 2.25+ Core 155+" },
  { id: "synology",  name: "Synology SRM",        method: "wireguard", notes: "Synology RT2600ac/MR2200ac, SRM 1.3+" },
  // ── Tier 3: Specialised ───────────────────────────────────────────────────
  { id: "firewalla", name: "Firewalla",           method: "wireguard", notes: "Gold / Purple / Ultra via app or SSH" },
  { id: "turris",    name: "Turris OS",           method: "wireguard", notes: "Turris Omnia/MOX, reForis WireGuard" },
  { id: "alpine",    name: "Alpine Linux Router", method: "wireguard", notes: "Minimal hardened router build" },
  { id: "opnsense",  name: "OPNsense",            method: "wireguard", notes: "Separate from pfSense — own plugin" },
];

const FIRMWARE_IDS = FIRMWARE_LIST.map(f => f.id) as [string, ...string[]];

router.get("/firmwares", (_req, res) => {
  res.json(FIRMWARE_LIST);
});

router.post("/generate", async (req, res) => {
  const body = z.object({
    firmware: z.enum(FIRMWARE_IDS as [string, ...string[]]),
    nodeId: z.number().int().optional(),
    clientPrivateKey: z.string().optional(),
    clientAddress: z.string().default("10.8.0.2/24"),
    dns: z.string().default("1.1.1.1"),
    killSwitch: z.boolean().default(true),
    safeIp: z.string().optional(),
  }).safeParse(req.body);

  if (!body.success) return res.status(400).json({ error: body.error.flatten() });

  const { firmware, nodeId, clientPrivateKey, clientAddress, dns, killSwitch, safeIp } = body.data;

  let serverPublicKey = "SERVER_PUBLIC_KEY_HERE";
  let serverEndpoint  = "YOUR_SERVER_IP:51820";
  let serverIp        = "";
  let serverName      = "ProxhqVPN Node";

  if (nodeId) {
    const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, nodeId));
    if (node) {
      serverPublicKey = node.publicKey;
      serverEndpoint  = `${node.ipAddress}:${node.listenPort}`;
      serverIp        = node.ipAddress ?? "";
      serverName      = node.name;
    }
  }

  const privKey = clientPrivateKey || "YOUR_CLIENT_PRIVATE_KEY";
  const wgConf  = buildWgConf(privKey, clientAddress, dns, serverPublicKey, serverEndpoint, killSwitch, safeIp, serverIp);
  const { commands, steps, notes } = buildFirmwareInstructions(
    firmware, wgConf, serverName, clientAddress, serverPublicKey, serverEndpoint, dns, privKey
  );

  res.json({ firmware, serverName, serverEndpoint, wgConf, commands, steps, notes });
});

// ── WG conf builder ──────────────────────────────────────────────────────────
function buildWgConf(
  privKey: string, address: string, dns: string,
  serverPubKey: string, endpoint: string,
  killSwitch: boolean, safeIp?: string, serverIp?: string,
): string {
  const serverIpRules = serverIp
    ? `\nPostUp = iptables -I OUTPUT -d ${serverIp} -j ACCEPT\nPostDown = iptables -D OUTPUT -d ${serverIp} -j ACCEPT`
    : "";
  const safeIpRules = safeIp
    ? `\nPostUp = iptables -I OUTPUT -s ${safeIp} -j ACCEPT; iptables -I OUTPUT -d ${safeIp} -j ACCEPT\nPostDown = iptables -D OUTPUT -s ${safeIp} -j ACCEPT; iptables -D OUTPUT -d ${safeIp} -j ACCEPT`
    : "";
  const ks = killSwitch
    ? `\nPostUp = iptables -I OUTPUT ! -o %i -m mark ! --mark $(wg show %i fwmark) -m addrtype ! --dst-type LOCAL -j REJECT\nPostDown = iptables -D OUTPUT ! -o %i -m mark ! --mark $(wg show %i fwmark) -m addrtype ! --dst-type LOCAL -j REJECT`
    : "";
  return `[Interface]
PrivateKey = ${privKey}
Address = ${address}
DNS = ${dns}${serverIpRules}${safeIpRules}${ks}

[Peer]
PublicKey = ${serverPubKey}
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = ${endpoint}
PersistentKeepalive = 25`;
}

// ── Per-firmware instruction builder ─────────────────────────────────────────
function buildFirmwareInstructions(
  firmware: string, wgConf: string, serverName: string,
  clientAddress: string, serverPubKey: string,
  endpoint: string, dns: string, privKey: string
): { commands: string; steps: string[]; notes: string } {
  const [endpointHost, endpointPort] = endpoint.split(":");

  switch (firmware) {

    // ────────────────────────────────────────────────────────── OpenWRT ───
    case "openwrt":
      return {
        commands: `#!/bin/sh
# ProxhqVPN — OpenWRT WireGuard Setup
# SSH into your router: ssh root@192.168.1.1

opkg update
opkg install wireguard-tools kmod-wireguard luci-proto-wireguard luci-app-wireguard

uci set network.wg0=interface
uci set network.wg0.proto=wireguard
uci set network.wg0.private_key='${privKey}'
uci add_list network.wg0.addresses='${clientAddress}'

uci add network wireguard_wg0
uci set network.@wireguard_wg0[-1].name='${serverName}'
uci set network.@wireguard_wg0[-1].public_key='${serverPubKey}'
uci set network.@wireguard_wg0[-1].endpoint_host='${endpointHost}'
uci set network.@wireguard_wg0[-1].endpoint_port='${endpointPort}'
uci add_list network.@wireguard_wg0[-1].allowed_ips='0.0.0.0/0'
uci add_list network.@wireguard_wg0[-1].allowed_ips='::/0'
uci set network.@wireguard_wg0[-1].persistent_keepalive='25'
uci set network.@wireguard_wg0[-1].route_allowed_ips='1'

uci set firewall.wg0=zone
uci set firewall.wg0.name=wg
uci set firewall.wg0.input=REJECT
uci set firewall.wg0.output=ACCEPT
uci set firewall.wg0.forward=REJECT
uci set firewall.wg0.masq=1
uci set firewall.wg0.mtu_fix=1
uci add_list firewall.wg0.network=wg0

uci add firewall forwarding
uci set firewall.@forwarding[-1].src=lan
uci set firewall.@forwarding[-1].dest=wg

uci commit
/etc/init.d/network restart
/etc/init.d/firewall restart

echo "[+] ProxhqVPN active on OpenWRT"
wg show`,
        steps: [
          "SSH into your OpenWRT router: ssh root@192.168.1.1",
          "Paste and run the commands above in the terminal",
          "Wait ~10 seconds for the network to restart",
          "Run 'wg show' — you should see the peer listed",
          "Verify: curl ifconfig.me should return your ProxhqVPN server IP",
          "All LAN devices are now protected",
        ],
        notes: "Requires OpenWRT 21.02+. Via LuCI: Network → Interfaces → Add → Protocol: WireGuard.",
      };

    // ─────────────────────────────────────────────────────────── DD-WRT ───
    case "ddwrt":
      return {
        commands: `# ProxhqVPN — DD-WRT WireGuard Setup
# Web UI: Setup → Tunnels → WireGuard → Add Tunnel

# [Interface] settings:
Private Key : ${privKey}
IP Address  : ${clientAddress.split("/")[0]}
Subnet Mask : 255.255.255.0

# [Peer] settings (click "Add Peer"):
Public Key  : ${serverPubKey}
Endpoint    : ${endpoint}
Allowed IPs : 0.0.0.0/0
Keepalive   : 25

# DNS  (Setup → Basic Setup → Static DNS 1):
DNS         : ${dns}

# CLI alternative (Administration → Commands):
wg genkey | tee /tmp/privkey | wg pubkey > /tmp/pubkey
cat /tmp/privkey`,
        steps: [
          "Log into DD-WRT admin at http://192.168.1.1",
          "Go to Setup → Tunnels → WireGuard tab",
          "Click Add Tunnel — enter the Private Key and IP Address above",
          "Click Add Peer — enter server Public Key, Endpoint, and Allowed IPs",
          "Set Endpoint: " + endpoint,
          "Set Allowed IPs: 0.0.0.0/0",
          "Save and Apply Settings",
          "Set DNS: Setup → Basic Setup → Static DNS 1 = " + dns,
        ],
        notes: "Requires DD-WRT build 45000+. Check build at Status → Router.",
      };

    // ───────────────────────────────────────────────── ASUSWRT-Merlin ───
    case "merlin":
      return {
        commands: `#!/bin/sh
# ProxhqVPN — ASUSWRT-Merlin WireGuard Client
# Requires Merlin 388.x or newer

# Option A: Web UI → VPN → VPN Client → WireGuard → + Add Profile
# Paste the .conf below

${wgConf}

# Option B: SSH
mkdir -p /etc/wg
cat > /etc/wg/proxhqvpn.conf << 'EOF'
${wgConf}
EOF
wg-quick up /etc/wg/proxhqvpn.conf`,
        steps: [
          "Log into ASUS router admin at http://router.asus.com",
          "Navigate to VPN → VPN Client → WireGuard",
          "Click '+ Add Profile' and paste the .conf shown above",
          "Click Activate — status should change to Connected",
          "Enable Auto-start so the tunnel reconnects after reboot",
          "All LAN devices now route through ProxhqVPN",
        ],
        notes: "ASUSWRT-Merlin 388.x adds native WireGuard. Ensure Auto-start is on.",
      };

    // ─────────────────────────────────────────────── pfSense / OPNsense ───
    case "pfsense":
      return {
        commands: `# ProxhqVPN — pfSense WireGuard Setup

# 1. VPN → WireGuard → Tunnels → Add Tunnel
#    Description : ProxhqVPN
#    Private Key : ${privKey}   (or generate a new one)

# 2. Add Peer:
#    Public Key  : ${serverPubKey}
#    Endpoint    : ${endpointHost}
#    Port        : ${endpointPort}
#    Allowed IPs : 0.0.0.0/0
#    Keepalive   : 25

# 3. Interfaces → Assignments → assign wg0
#    Enable, IPv4 Static : ${clientAddress}

# 4. Firewall → Rules → WAN → Add
#    Gateway     : WG0_GW  (System → Routing → Gateways)

# 5. DNS Resolver → DNS Servers : ${dns}

# OPNsense: VPN → WireGuard → Local → Add (same values)`,
        steps: [
          "pfSense: VPN → WireGuard → Tunnels → Add Tunnel",
          "Enter private key and generate a public key",
          "Add a peer with the server details above",
          "Interfaces → Assignments → add the new wg0 interface",
          "Set static IPv4: " + clientAddress,
          "Create a gateway: System → Routing → Gateways → wg0",
          "Add LAN → WG firewall rule to route traffic",
          "Set DNS: " + dns,
        ],
        notes: "pfSense 2.5+ and OPNsense 21.7+ include WireGuard natively.",
      };

    // ─────────────────────────────────────────────────────────── GL.iNet ───
    case "glinet":
      return {
        commands: `# ProxhqVPN — GL.iNet Setup
# Log into http://192.168.8.1 → VPN → WireGuard Client → Add

# Save the config below as proxhqvpn.conf and upload it:
${wgConf}

# GL.iNet API (alternative):
curl -s -X POST http://192.168.8.1/cgi-bin/api/vpn/wireguard/add \\
  -H 'Content-Type: application/json' \\
  -d '{"name":"ProxhqVPN","config":"${wgConf.replace(/\n/g, "\\n")}"}'`,
        steps: [
          "Log into GL.iNet admin at http://192.168.8.1",
          "Navigate to VPN → WireGuard Client",
          "Click Add → Upload Config File",
          "Save the configuration above as proxhqvpn.conf and upload",
          "Toggle VPN on — status should show Connected",
          "All devices on your GL.iNet network are protected",
        ],
        notes: "All GL.iNet models running firmware 3.x/4.x support WireGuard natively. GL-MT3000, GL-MT6000, and GL-AXT1800 have hardware acceleration.",
      };

    // ──────────────────────────────────────────── Ubiquiti EdgeRouter ───
    case "ubiquiti":
      return {
        commands: `#!/bin/vbash
# ProxhqVPN — Ubiquiti EdgeRouter
# SSH: ssh ubnt@192.168.1.1  then: configure

set interfaces wireguard wg0 private-key ${privKey}
set interfaces wireguard wg0 address ${clientAddress}
set interfaces wireguard wg0 description 'ProxhqVPN'
set interfaces wireguard wg0 peer ${serverPubKey} endpoint ${endpoint}
set interfaces wireguard wg0 peer ${serverPubKey} allowed-ips 0.0.0.0/0
set interfaces wireguard wg0 peer ${serverPubKey} persistent-keepalive 25

set firewall name WAN_LOCAL rule 20 description 'WireGuard'
set firewall name WAN_LOCAL rule 20 action accept
set firewall name WAN_LOCAL rule 20 protocol udp
set firewall name WAN_LOCAL rule 20 destination port ${endpointPort}

commit; save`,
        steps: [
          "SSH into your EdgeRouter: ssh ubnt@192.168.1.1",
          "Enter configuration mode: configure",
          "Paste the vbash commands above",
          "Run: commit && save",
          "Verify: show interfaces wireguard",
          "Check connectivity: curl --interface wg0 ifconfig.me",
        ],
        notes: "EdgeOS requires the WireGuard Vyatta package. Check your hardware architecture (MIPS/ARM) before downloading.",
      };

    // ──────────────────────────────────────────────── MikroTik RouterOS ───
    case "mikrotik":
      return {
        commands: `# ProxhqVPN — MikroTik RouterOS 7.x
# Paste into Winbox terminal or SSH: ssh admin@192.168.88.1

# 1. Create WireGuard interface
/interface wireguard add name=proxhqvpn \\
  private-key="${privKey}" \\
  listen-port=0 \\
  comment="ProxhqVPN"

# 2. Add IP address to interface
/ip address add address=${clientAddress} interface=proxhqvpn

# 3. Add the server as a peer
/interface wireguard peers add \\
  interface=proxhqvpn \\
  public-key="${serverPubKey}" \\
  endpoint-address=${endpointHost} \\
  endpoint-port=${endpointPort} \\
  allowed-address=0.0.0.0/0 \\
  persistent-keepalive=25s \\
  comment="${serverName}"

# 4. Add default route through WireGuard
/ip route add dst-address=0.0.0.0/0 gateway=proxhqvpn

# 5. Set DNS
/ip dns set servers=${dns}

# 6. Masquerade LAN traffic going out the WireGuard interface
/ip firewall nat add chain=srcnat out-interface=proxhqvpn action=masquerade

# Verify
/interface wireguard print
/interface wireguard peers print`,
        steps: [
          "Open Winbox or SSH into your MikroTik: ssh admin@192.168.88.1",
          "Paste and run the commands above in the terminal",
          "Verify the interface: /interface wireguard print",
          "Check peer handshake: /interface wireguard peers print",
          "Test: /tool fetch url=https://ifconfig.me (should show VPN IP)",
          "All LAN clients behind the MikroTik are now protected",
        ],
        notes: "Requires RouterOS 7.1 or newer for native WireGuard support. In older RouterOS 6.x, install the WireGuard package manually from MikroTik's extra packages.",
      };

    // ───────────────────────────────────────── UniFi Dream Machine ───
    case "unifi":
      return {
        commands: `# ProxhqVPN — UniFi Dream Machine / Dream Router
# Option A: UniFi Network UI (recommended)
# Settings → VPN → VPN Client → Create New
#   Type        : WireGuard
#   Server IP   : ${endpointHost}
#   Port        : ${endpointPort}
#   Private Key : ${privKey}
#   Public Key  : ${serverPubKey}
#   DNS         : ${dns}
#   Allowed IPs : 0.0.0.0/0, ::/0

# Option B: SSH into UDM (unifi OS 3.x)
# ssh root@192.168.1.1 -p 22  (UDM Pro) or ubnt@unifi (older)

mkdir -p /etc/wireguard
cat > /etc/wireguard/proxhqvpn.conf << 'EOF'
${wgConf}
EOF

wg-quick up proxhqvpn

# Auto-start (UDM boot-script via unifios-utilities or on-boot.d):
# Place wg-quick startup in /mnt/data/on_boot.d/

# Verify
wg show proxhqvpn`,
        steps: [
          "Open UniFi Network UI in your browser",
          "Go to Settings → VPN → VPN Client",
          "Click Create New and select WireGuard type",
          "Enter server IP, port, and keys from the config above",
          "Assign the VPN client to your main LAN network",
          "Click Apply Changes — the tunnel should come up within 5 seconds",
          "Verify in Network → Clients that traffic is routing through the VPN",
        ],
        notes: "UniFi OS 3.x+ on Dream Machine, Dream Router, and Dream Wall supports WireGuard VPN client natively. For older firmware, use the SSH method above with on-boot.d persistence.",
      };

    // ──────────────────────────────────────────────────────────── VyOS ───
    case "vyos":
      return {
        commands: `# ProxhqVPN — VyOS 1.4+ (Sagitta)
# SSH: ssh vyos@192.168.1.1  then: configure

# 1. Create WireGuard interface
set interfaces wireguard wg0 description 'ProxhqVPN'
set interfaces wireguard wg0 address '${clientAddress}'
set interfaces wireguard wg0 private-key '${privKey}'

# 2. Add peer
set interfaces wireguard wg0 peer proxhqvpn \\
  public-key '${serverPubKey}'
set interfaces wireguard wg0 peer proxhqvpn \\
  address '${endpointHost}'
set interfaces wireguard wg0 peer proxhqvpn \\
  port '${endpointPort}'
set interfaces wireguard wg0 peer proxhqvpn \\
  allowed-ips '0.0.0.0/0'
set interfaces wireguard wg0 peer proxhqvpn \\
  persistent-keepalive '25'

# 3. Route all traffic through WireGuard
set protocols static route 0.0.0.0/0 interface wg0

# 4. NAT masquerade for LAN
set nat source rule 10 outbound-interface name wg0
set nat source rule 10 source address '10.0.0.0/8'
set nat source rule 10 translation address masquerade

# 5. DNS
set system name-server ${dns}

commit; save

# Verify
show interfaces wireguard wg0
show wireguard interface wg0`,
        steps: [
          "SSH into VyOS: ssh vyos@192.168.1.1",
          "Enter configuration mode: configure",
          "Paste the commands above",
          "Run: commit && save",
          "Verify the interface: show interfaces wireguard wg0",
          "Test: curl --interface wg0 https://ifconfig.me",
        ],
        notes: "Requires VyOS 1.4 (Sagitta) or newer for native WireGuard. VyOS 1.3 (Equuleus) requires the wireguard package to be installed manually.",
      };

    // ──────────────────────────────────────────── FreshTomato / Tomato ───
    case "tomato":
      return {
        commands: `# ProxhqVPN — FreshTomato WireGuard Setup
# Requires FreshTomato 2022.3+ with AIO build (includes WireGuard)

# Web UI path: VPN → WireGuard Client

# [Interface]
Private Key : ${privKey}
IP Address  : ${clientAddress.split("/")[0]}
DNS         : ${dns}

# [Peer]
Public Key  : ${serverPubKey}
Endpoint    : ${endpoint}
Allowed IPs : 0.0.0.0/0, ::/0
Keepalive   : 25

# CLI alternative (JFFS or telnet):
modprobe wireguard
mkdir -p /etc/wireguard
cat > /etc/wireguard/proxhqvpn.conf << 'EOF'
${wgConf}
EOF
wg-quick up proxhqvpn

# Enable kill switch (iptables):
iptables -I OUTPUT ! -o wg0 -m mark ! --mark $(wg show wg0 fwmark) \\
  -m addrtype ! --dst-type LOCAL -j REJECT`,
        steps: [
          "Log into FreshTomato admin at http://192.168.1.1",
          "Navigate to VPN → WireGuard Client",
          "Click Add New Configuration",
          "Enter the Interface settings (private key, IP, DNS)",
          "Enter the Peer settings (server public key, endpoint, allowed IPs)",
          "Save and click Start",
          "Status should show 'Active' with a handshake timestamp",
        ],
        notes: "FreshTomato's WireGuard support is in the AIO (All-in-One) build — make sure you flashed the AIO variant, not the VPN-only or K26 build. Supported on MIPS, ARM, and ARM64 Broadcom platforms.",
      };

    // ──────────────────────────────────────────────────────── IPFire ───
    case "ipfire":
      return {
        commands: `# ProxhqVPN — IPFire WireGuard Setup
# IPFire 2.25+ Core 155 includes WireGuard natively

# Web UI: VPN → WireGuard → Add Connection

# Connection settings:
Name        : ProxhqVPN
Enabled     : Yes
Type        : Client (Roadwarrior)

# Local settings:
Private Key : ${privKey}
IP Address  : ${clientAddress}
DNS         : ${dns}

# Remote (peer) settings:
Public Key  : ${serverPubKey}
Endpoint    : ${endpointHost}
Port        : ${endpointPort}
Allowed IPs : 0.0.0.0/0, ::/0
Keepalive   : 25

# Shell alternative (SSH root@192.168.1.1):
mkdir -p /etc/wireguard
cat > /etc/wireguard/proxhqvpn.conf << 'EOF'
${wgConf}
EOF

wg-quick up proxhqvpn

# IPFire firewall rule (allow WireGuard UDP out):
# Firewall → Firewall Rules → Add Rule
# Source: GREEN, Destination: Any, Protocol: UDP, Port: ${endpointPort}`,
        steps: [
          "Log into IPFire Web UI at https://192.168.1.1:444",
          "Navigate to VPN → WireGuard",
          "Click 'Add Connection' and fill in the settings above",
          "Save — IPFire will generate a public key automatically if private key is blank",
          "Enable the connection and check the status indicator",
          "Add a firewall rule permitting UDP to port " + endpointPort + " if needed",
          "All GREEN-network clients will be tunnelled through ProxhqVPN",
        ],
        notes: "IPFire Core 155+ ships WireGuard as a kernel module. Earlier versions need 'pakfire install wireguard-tools'. Zone routing: GREEN = LAN, RED = WAN, ORANGE = DMZ.",
      };

    // ──────────────────────────────────────────────── Synology SRM ───
    case "synology":
      return {
        commands: `# ProxhqVPN — Synology Router Manager (SRM) WireGuard
# Supported hardware: RT2600ac, RT1900ac, MR2200ac, WRX560, RX600

# Install VPN Plus Server from Package Center
# (SRM 1.3+: WireGuard is bundled — no extra package needed)

# Web UI: VPN Plus → VPN Client → WireGuard → Add Profile

# Upload or paste the config file below:
${wgConf}

# SSH alternative (SRM SSH enabled in Control Panel):
sudo mkdir -p /etc/wireguard
sudo cat > /etc/wireguard/proxhqvpn.conf << 'EOF'
${wgConf}
EOF

sudo wg-quick up proxhqvpn

# Auto-start on boot:
sudo systemctl enable wg-quick@proxhqvpn 2>/dev/null || \\
  echo "@reboot root wg-quick up proxhqvpn" >> /etc/crontab`,
        steps: [
          "Open Synology Router Manager web UI",
          "Install 'VPN Plus Server' from Package Center (if not already installed)",
          "Go to VPN Plus → VPN Client → WireGuard",
          "Click Add Profile → Upload Config and upload the .conf file above",
          "Click Connect — the status LED should turn green",
          "Enable 'Auto-reconnect' so it reconnects after reboot",
          "All clients on your Synology router's network are now protected",
        ],
        notes: "SRM 1.3+ on RT2600ac/MR2200ac natively supports WireGuard client mode. Use 'VPN Plus Server' package for full WireGuard UI. SSH access must be enabled under Control Panel → Terminal & SNMP.",
      };

    // ──────────────────────────────────────────────────── Firewalla ───
    case "firewalla":
      return {
        commands: `# ProxhqVPN — Firewalla Gold / Purple / Ultra
# Option A: Firewalla App
# VPN → VPN Client → WireGuard → + Add
# Paste the .conf or fill in fields manually

# Conf content:
${wgConf}

# Option B: SSH into Firewalla (pi@firewalla.local)
# Default password: Firewalla@1234 (change it!)
sudo mkdir -p /etc/wireguard
sudo cat > /etc/wireguard/proxhqvpn.conf << 'EOF'
${wgConf}
EOF

sudo wg-quick up proxhqvpn

# Persist across reboots:
sudo systemctl enable wg-quick@proxhqvpn

# Route all LAN traffic through WireGuard:
# App: VPN Client → Set as default gateway → ON
# Or shell:
sudo iptables -t nat -A POSTROUTING -o proxhqvpn -j MASQUERADE`,
        steps: [
          "Open the Firewalla app on your phone",
          "Tap VPN → VPN Client → + button",
          "Select WireGuard and tap 'Import Config File'",
          "Save the .conf above to your phone and import it",
          "Tap 'Set as Default Gateway' so all LAN traffic is tunnelled",
          "Tap Connect — Firewalla will display the active VPN indicator",
          "All connected devices in your network are now protected",
        ],
        notes: "Firewalla Gold, Purple, and Ultra support WireGuard natively through the app. SSH is available at pi@firewalla.local for advanced CLI setup. App version 1.972+ required for WireGuard client import.",
      };

    // ──────────────────────────────────────────────────── Turris OS ───
    case "turris":
      return {
        commands: `# ProxhqVPN — Turris OS (Omnia / MOX / Shield)
# Turris OS is OpenWRT-based — reForis UI or CLI

# Option A: reForis UI
# Go to: reForis → VPN → WireGuard → Add Peer
# (Or use LuCI at http://192.168.1.1/cgi-bin/luci)

# Option B: CLI via SSH (ssh root@192.168.1.1)
opkg update
opkg install wireguard-tools kmod-wireguard luci-proto-wireguard

uci set network.wg0=interface
uci set network.wg0.proto=wireguard
uci set network.wg0.private_key='${privKey}'
uci add_list network.wg0.addresses='${clientAddress}'

uci add network wireguard_wg0
uci set network.@wireguard_wg0[-1].name='${serverName}'
uci set network.@wireguard_wg0[-1].public_key='${serverPubKey}'
uci set network.@wireguard_wg0[-1].endpoint_host='${endpointHost}'
uci set network.@wireguard_wg0[-1].endpoint_port='${endpointPort}'
uci add_list network.@wireguard_wg0[-1].allowed_ips='0.0.0.0/0'
uci add_list network.@wireguard_wg0[-1].allowed_ips='::/0'
uci set network.@wireguard_wg0[-1].persistent_keepalive='25'
uci set network.@wireguard_wg0[-1].route_allowed_ips='1'

uci set firewall.wg0=zone
uci set firewall.wg0.name=wg
uci set firewall.wg0.input=REJECT
uci set firewall.wg0.output=ACCEPT
uci set firewall.wg0.forward=REJECT
uci set firewall.wg0.masq=1
uci add_list firewall.wg0.network=wg0

uci add firewall forwarding
uci set firewall.@forwarding[-1].src=lan
uci set firewall.@forwarding[-1].dest=wg
uci commit && reload_config

echo "[+] ProxhqVPN active on Turris"
wg show`,
        steps: [
          "SSH into your Turris router: ssh root@192.168.1.1",
          "Paste and run the commands above",
          "Run reload_config or reboot to apply the firewall rules",
          "Verify: wg show — peer should appear with a recent handshake",
          "Alternatively, use reForis or LuCI to set up through the web UI",
        ],
        notes: "Turris OS is built on OpenWRT so the same OpenWRT commands apply. For newer Turris OS (6.x+) with reForis, a WireGuard plugin may be available from the Turris package repository.",
      };

    // ──────────────────────────────────────────── Alpine Linux Router ───
    case "alpine":
      return {
        commands: `#!/bin/sh
# ProxhqVPN — Alpine Linux Router / Gateway
# SSH: ssh root@192.168.1.1

# 1. Install WireGuard tools
apk add --no-cache wireguard-tools

# 2. Load the kernel module
modprobe wireguard

# 3. Write config
mkdir -p /etc/wireguard
chmod 700 /etc/wireguard
cat > /etc/wireguard/proxhqvpn.conf << 'EOF'
${wgConf}
EOF
chmod 600 /etc/wireguard/proxhqvpn.conf

# 4. Bring up the interface
wg-quick up proxhqvpn

# 5. Enable at boot (OpenRC)
rc-update add wg-quick default
rc-service wg-quick start

# 6. Enable IP forwarding (NAT gateway mode)
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p

# 7. Masquerade LAN traffic (replace eth0 with your LAN interface)
iptables -t nat -A POSTROUTING -o proxhqvpn -j MASQUERADE
iptables -A FORWARD -i eth0 -o proxhqvpn -j ACCEPT
iptables -A FORWARD -i proxhqvpn -o eth0 -m state --state RELATED,ESTABLISHED -j ACCEPT

# Make iptables rules persistent
apk add iptables-persistent
iptables-save > /etc/iptables/rules-save

# 8. Verify
wg show proxhqvpn`,
        steps: [
          "SSH into your Alpine Linux router as root",
          "Run: apk add --no-cache wireguard-tools",
          "Paste the script above and execute it",
          "Verify with: wg show proxhqvpn — handshake should appear",
          "Test: curl --interface proxhqvpn https://ifconfig.me",
          "Alpine is now a full WireGuard router gateway",
        ],
        notes: "Alpine uses OpenRC, not systemd. Enable IP forwarding and masquerade in /etc/sysctl.conf for gateway/NAT mode. Replace 'eth0' with your actual LAN interface name (check with: ip link).",
      };

    // ─────────────────────────────────────────────────── OPNsense ───
    case "opnsense":
      return {
        commands: `# ProxhqVPN — OPNsense WireGuard Setup
# OPNsense 21.7+ includes WireGuard as a built-in plugin

# 1. Install WireGuard plugin (if not already installed):
#    System → Firmware → Plugins → search "wireguard" → Install
#    Or via CLI:
pkg install os-wireguard

# 2. Create Local (Interface):
#    VPN → WireGuard → Local → Add
#    Name        : ProxhqVPN
#    Instance    : 1
#    Private Key : ${privKey}   (or generate new)
#    Tunnel Address : ${clientAddress}
#    DNS Servers : ${dns}

# 3. Create Peer (Server):
#    VPN → WireGuard → Peers → Add
#    Name         : ${serverName}
#    Public Key   : ${serverPubKey}
#    Endpoint     : ${endpointHost}
#    Port         : ${endpointPort}
#    Allowed IPs  : 0.0.0.0/0, ::/0
#    Keepalive    : 25

# 4. Assign interface:
#    Interfaces → Assignments → Assign wg1
#    Enable → Save

# 5. Outbound NAT:
#    Firewall → NAT → Outbound → Add
#    Interface: WireGuard, Source: LAN, Translation: Interface address

# 6. Verify:
#    VPN → WireGuard → Status`,
        steps: [
          "Install the WireGuard plugin: System → Firmware → Plugins → wireguard",
          "Go to VPN → WireGuard → Local → Add and fill in your private key and tunnel address",
          "Go to VPN → WireGuard → Peers → Add and enter server details",
          "Assign the wg interface: Interfaces → Assignments",
          "Configure Outbound NAT so LAN traffic routes through WireGuard",
          "Enable the tunnel and check VPN → WireGuard → Status",
          "Verify: the status page should show a live handshake",
        ],
        notes: "OPNsense 22.7+ has WireGuard kernel module support (faster than userspace). Use the 'os-wireguard' plugin, not the legacy 'os-wireguard-go'. Check the plugin version under System → Firmware.",
      };

    default:
      return { commands: "", steps: [], notes: "" };
  }
}

export default router;
