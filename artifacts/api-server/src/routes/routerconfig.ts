import { Router } from "express";
import { db } from "@workspace/db";
import { nodesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

const router = Router();

const FIRMWARE_LIST = [
  { id: "openwrt",  name: "OpenWRT",          method: "wireguard", notes: "LuCI + kmod-wireguard" },
  { id: "ddwrt",    name: "DD-WRT",            method: "wireguard", notes: "Build 45000+ required" },
  { id: "merlin",   name: "ASUSWRT-Merlin",    method: "wireguard", notes: "Firmware 388.x required" },
  { id: "pfsense",  name: "pfSense / OPNsense",method: "wireguard", notes: "pfSense 2.5+ / OPNsense 21.7+" },
  { id: "glinet",   name: "GL.iNet",           method: "wireguard", notes: "All GL.iNet models supported" },
  { id: "ubiquiti", name: "Ubiquiti EdgeRouter",method: "wireguard", notes: "EdgeOS WireGuard package" },
];

router.get("/firmwares", (_req, res) => {
  res.json(FIRMWARE_LIST);
});

router.post("/generate", async (req, res) => {
  const body = z.object({
    firmware: z.enum(["openwrt","ddwrt","merlin","pfsense","glinet","ubiquiti"]),
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
  let serverEndpoint = "YOUR_SERVER_IP:51820";
  let serverIp = "";
  let serverName = "ProxhqVPN Node";

  if (nodeId) {
    const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, nodeId));
    if (node) {
      serverPublicKey = node.publicKey;
      serverEndpoint = `${node.ipAddress}:${node.listenPort}`;
      serverIp = node.ipAddress ?? "";
      serverName = node.name;
    }
  }

  const privKey = clientPrivateKey || "YOUR_CLIENT_PRIVATE_KEY";
  const wgConf = buildWgConf(privKey, clientAddress, dns, serverPublicKey, serverEndpoint, killSwitch, safeIp, serverIp);
  const { commands, steps, notes } = buildFirmwareInstructions(firmware, wgConf, serverName, clientAddress, serverPublicKey, serverEndpoint, dns, privKey);

  res.json({ firmware, serverName, serverEndpoint, wgConf, commands, steps, notes });
});

function buildWgConf(
  privKey: string,
  address: string,
  dns: string,
  serverPubKey: string,
  endpoint: string,
  killSwitch: boolean,
  safeIp?: string,
  serverIp?: string,
): string {
  const safeIpRules = safeIp
    ? `\nPostUp = iptables -I OUTPUT -s ${safeIp} -j ACCEPT; iptables -I OUTPUT -d ${safeIp} -j ACCEPT\nPostDown = iptables -D OUTPUT -s ${safeIp} -j ACCEPT; iptables -D OUTPUT -d ${safeIp} -j ACCEPT`
    : "";
  const serverIpRules = serverIp
    ? `\nPostUp = iptables -I OUTPUT -d ${serverIp} -j ACCEPT\nPostDown = iptables -D OUTPUT -d ${serverIp} -j ACCEPT`
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

function buildFirmwareInstructions(
  firmware: string, wgConf: string, serverName: string,
  clientAddress: string, serverPubKey: string, endpoint: string, dns: string, privKey: string
): { commands: string; steps: string[]; notes: string } {
  const [endpointHost, endpointPort] = endpoint.split(":");

  switch (firmware) {
    case "openwrt":
      return {
        commands: `#!/bin/sh
# ProxhqVPN — OpenWRT WireGuard Setup
# Run on your OpenWRT router via SSH

# 1. Install packages
opkg update
opkg install wireguard-tools kmod-wireguard luci-proto-wireguard luci-app-wireguard

# 2. Create WireGuard interface
uci set network.wg0=interface
uci set network.wg0.proto=wireguard
uci set network.wg0.private_key='${privKey}'
uci add_list network.wg0.addresses='${clientAddress}'

# 3. Add peer (ProxhqVPN server)
uci add network wireguard_wg0
uci set network.@wireguard_wg0[-1].name='${serverName}'
uci set network.@wireguard_wg0[-1].public_key='${serverPubKey}'
uci set network.@wireguard_wg0[-1].endpoint_host='${endpointHost}'
uci set network.@wireguard_wg0[-1].endpoint_port='${endpointPort}'
uci add_list network.@wireguard_wg0[-1].allowed_ips='0.0.0.0/0'
uci add_list network.@wireguard_wg0[-1].allowed_ips='::/0'
uci set network.@wireguard_wg0[-1].persistent_keepalive='25'
uci set network.@wireguard_wg0[-1].route_allowed_ips='1'

# 4. Add firewall zone
uci set firewall.wg0=zone
uci set firewall.wg0.name=wg
uci set firewall.wg0.input=REJECT
uci set firewall.wg0.output=ACCEPT
uci set firewall.wg0.forward=REJECT
uci set firewall.wg0.masq=1
uci set firewall.wg0.mtu_fix=1
uci add_list firewall.wg0.network=wg0

# 5. Allow forwarding from LAN to WireGuard
uci add firewall forwarding
uci set firewall.@forwarding[-1].src=lan
uci set firewall.@forwarding[-1].dest=wg

# 6. Apply
uci commit
/etc/init.d/network restart
/etc/init.d/firewall restart

echo "[+] ProxhqVPN WireGuard active on OpenWRT"
wg show`,
        steps: [
          "SSH into your OpenWRT router: ssh root@192.168.1.1",
          "Copy and paste the commands above into the terminal",
          "Wait for the network to restart (~10 seconds)",
          "Run 'wg show' to confirm the peer is connected",
          "Test: curl ifconfig.me should show your ProxhqVPN server IP",
          "All devices on your network are now protected",
        ],
        notes: "Requires OpenWRT 21.02+. If using LuCI web UI, go to Network → Interfaces → Add interface → Protocol: WireGuard.",
      };

    case "ddwrt":
      return {
        commands: `# ProxhqVPN — DD-WRT WireGuard Setup
# Go to: Setup → Tunnels → WireGuard → Add Tunnel

# Interface settings:
Private Key: ${privKey}
IP Address:  ${clientAddress.split("/")[0]}
Subnet Mask: 255.255.255.0

# Peer settings (click "Add Peer"):
Public Key:        ${serverPubKey}
Endpoint:          ${endpoint}
Allowed IPs:       0.0.0.0/0
Keepalive:         25

# DNS (Setup → Basic Setup → Static DNS 1):
DNS: ${dns}

# Alternative — via CLI (Administration → Commands):
wg genkey | tee /tmp/wg-privkey | wg pubkey > /tmp/wg-pubkey
cat /tmp/wg-privkey`,
        steps: [
          "Log into DD-WRT admin at http://192.168.1.1",
          "Navigate to Setup → Tunnels",
          "Click the WireGuard tab",
          "Enter the Private Key and IP Address from the config above",
          "Click 'Add Peer' and fill in the server details",
          "Set Endpoint to: " + endpoint,
          "Set Allowed IPs to: 0.0.0.0/0",
          "Save and Apply Settings",
          "Go to Setup → Basic Setup and set Static DNS to: " + dns,
        ],
        notes: "Requires DD-WRT build 45000 or newer with WireGuard support. Check your build at Status → Router.",
      };

    case "merlin":
      return {
        commands: `#!/bin/sh
# ProxhqVPN — ASUSWRT-Merlin WireGuard Client Setup
# Requires Merlin firmware 388.x or newer

# Option A: Upload via Web UI
# 1. Go to VPN → VPN Client → WireGuard
# 2. Click + Add Profile
# 3. Paste the .conf content below:

${wgConf}

# Option B: CLI via SSH
mkdir -p /etc/wg
cat > /etc/wg/proxhqvpn.conf << 'WGEOF'
${wgConf}
WGEOF

# Start the tunnel
wg-quick up /etc/wg/proxhqvpn.conf

# Auto-start on boot (Merlin persistent config):
# Services → VPN → WireGuard Client → Enable`,
        steps: [
          "Log into ASUS router admin at http://router.asus.com",
          "Navigate to VPN → VPN Client",
          "Click the WireGuard tab",
          "Click '+ Add Profile'",
          "Paste the .conf file contents shown above",
          "Click 'Activate' to start the VPN tunnel",
          "Check VPN Status — it should show Connected",
          "All LAN devices will route through ProxhqVPN",
        ],
        notes: "ASUSWRT-Merlin 388.x adds native WireGuard support. Make sure Auto-start is enabled so the tunnel reconnects after reboot.",
      };

    case "pfsense":
      return {
        commands: `# ProxhqVPN — pfSense / OPNsense WireGuard Setup

# In pfSense:
# 1. VPN → WireGuard → Tunnels → Add Tunnel
#    Description: ProxhqVPN
#    Listen Port: (leave blank for client)
#    Private Key: (generate with Generate button or paste below)
#    Private Key: ${privKey}
#
# 2. Add Peer:
#    Public Key: ${serverPubKey}
#    Endpoint: ${endpointHost}
#    Port: ${endpointPort}
#    Allowed IPs: 0.0.0.0/0
#    Keepalive: 25
#
# 3. Interfaces → Assignments → Add wg0 interface
#    Enable, IPv4 Static: ${clientAddress}
#
# 4. Firewall → Rules → WAN → Add:
#    Source: Any, Destination: Any, Protocol: Any
#    Gateway: WG0_GW (create under System → Routing → Gateways)
#
# 5. DNS Resolver → General Settings → DNS Servers: ${dns}
#
# In OPNsense:
# VPN → WireGuard → Local → Add
# VPN → WireGuard → Peers → Add
# Same settings as above`,
        steps: [
          "pfSense: Navigate to VPN → WireGuard → Tunnels",
          "Click Add Tunnel, enter your private key",
          "Add a Peer with the server details above",
          "Go to Interfaces → Assignments → add the new wg0 interface",
          "Set a static IPv4: " + clientAddress,
          "Create a Gateway under System → Routing → Gateways pointing to wg0",
          "Add a firewall rule routing LAN traffic to the WireGuard gateway",
          "Set DNS to: " + dns + " in System → General or DNS Resolver",
        ],
        notes: "pfSense 2.5+ and OPNsense 21.7+ include WireGuard as a built-in package. No manual package install needed.",
      };

    case "glinet":
      return {
        commands: `# ProxhqVPN — GL.iNet Setup
# GL.iNet routers have native WireGuard support

# Option A: Upload .conf via web UI
# 1. Log into http://192.168.8.1
# 2. Go to VPN → WireGuard Client
# 3. Click '+ Add' → 'Upload Config File'
# 4. Save the config below as 'proxhqvpn.conf' and upload it:

${wgConf}

# Option B: GL.iNet API
curl -s -X POST http://192.168.8.1/cgi-bin/api/vpn/wireguard/add \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "ProxhqVPN",
    "config": "${wgConf.replace(/\n/g, "\\n")}"
  }'`,
        steps: [
          "Log into your GL.iNet admin at http://192.168.8.1",
          "Navigate to VPN → WireGuard Client",
          "Click Add → Upload Config File",
          "Save the configuration above as a .conf file on your computer",
          "Upload the file and click Apply",
          "Toggle the VPN on — status should show Connected",
          "All devices connecting to this GL.iNet router are now protected",
        ],
        notes: "All GL.iNet models running firmware 3.x or 4.x support WireGuard natively. The GL-MT3000, GL-MT6000, and GL-AXT1800 have hardware acceleration.",
      };

    case "ubiquiti":
      return {
        commands: `#!/bin/vbash
# ProxhqVPN — Ubiquiti EdgeRouter WireGuard Setup
# SSH into your EdgeRouter and run these commands

# Install WireGuard (if not already installed)
# Download the correct deb for your hardware from:
# https://github.com/Lochnair/vyatta-wireguard/releases

# Create WireGuard interface
set interfaces wireguard wg0 private-key ${privKey}
set interfaces wireguard wg0 address ${clientAddress}
set interfaces wireguard wg0 description 'ProxhqVPN'

# Add peer
set interfaces wireguard wg0 peer ${serverPubKey} endpoint ${endpoint}
set interfaces wireguard wg0 peer ${serverPubKey} allowed-ips 0.0.0.0/0
set interfaces wireguard wg0 peer ${serverPubKey} persistent-keepalive 25

# Firewall and routing
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
        notes: "EdgeOS requires the WireGuard Vyatta package. Check your hardware architecture (MIPS/ARM) before downloading the package.",
      };

    default:
      return { commands: "", steps: [], notes: "" };
  }
}

export default router;
