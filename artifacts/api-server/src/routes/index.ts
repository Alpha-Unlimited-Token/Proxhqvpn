import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import healthRouter from "./health";
import meRouter from "./me";
import nodesRouter from "./nodes";
import beaconsRouter from "./beacons";
import silkwebRouter from "./silkweb";
import firewallRouter from "./firewall";
import monitorRouter from "./monitor";
import terminalRouter from "./terminal";
import sqlRouter from "./sqlquery";
import proxyBrowserRouter from "./proxybrowser";
import killswitchRouter from "./killswitch";
import leaksRouter from "./leaks";
import threatintelRouter from "./threatintel";
import splittunnelRouter from "./splittunnel";
import obfuscationRouter from "./obfuscation";
import securityauditRouter from "./securityaudit";
import daemonRouter from "./daemon";
import vpnCoexistRouter from "./vpncoexist";
import vpnGateRouter from "./vpngate";
import devicesRouter from "./devices";
import dnsShieldRouter from "./dnsshield";
import smartDnsRouter from "./smartdns";
import routerConfigRouter from "./routerconfig";
import stripeRouter from "./stripe";
import wireguardRouter from "./wireguard";
import daemonInboundRouter from "./daemon-inbound";
import nodeProvisionRouter from "./node-provision";
import sqlmapRouter from "./sqlmap";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);

// Daemon inbound — authenticated via PSK header (not Clerk), public route
router.use("/daemon-inbound", daemonInboundRouter);

// Node auto-provision — PSK protected, public (no Clerk)
router.use("/node-provision", nodeProvisionRouter);

// Public daemon download — serves proxhqd.py for deployment to VPN nodes
router.get("/daemon-download", (_req: Request, res: Response) => {
  const filePath = path.resolve(process.cwd(), "../../tools/proxhqd.py");
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Daemon file not found" });
  }
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", "attachment; filename=proxhqd.py");
  res.send(fs.readFileSync(filePath, "utf-8"));
});

// Node setup script — returns a bash installer for new VPN servers
router.get("/setup-script", (req: Request, res: Response) => {
  const psk = process.env.DAEMON_PSK || "";
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "";
  const apiBase = `${proto}://${host}/api`;
  const region = (req.query.region as string) || "Unknown";

  const script = `#!/bin/bash
set -e

API="${apiBase}"
PSK="${psk}"
REGION="${region}"

echo ""
echo "=== ProxhqVPN Node Setup ==="
echo "API: \$API"
echo "Region: \$REGION"
echo ""

# 1. Update and install WireGuard
echo "[1/7] Installing WireGuard..."
apt-get update -qq
apt-get install -y wireguard wireguard-tools curl python3 2>/dev/null

# 2. Generate server WireGuard keys
echo "[2/7] Generating WireGuard keys..."
SERVER_PRIVKEY=\$(wg genkey)
SERVER_PUBKEY=\$(echo \$SERVER_PRIVKEY | wg pubkey)

# 3. Get this server's public IP
echo "[3/7] Detecting public IP..."
PUBLIC_IP=\$(curl -sf --max-time 5 https://api.ipify.org || curl -sf --max-time 5 https://ipinfo.io/ip || curl -sf --max-time 5 https://icanhazip.com)
echo "    Public IP: \$PUBLIC_IP"

# 4. Register node with ProxhqVPN API
echo "[4/7] Registering node with ProxhqVPN..."
RESPONSE=\$(curl -sf -X POST "\$API/node-provision" \\
  -H "Content-Type: application/json" \\
  -H "X-Daemon-PSK: \$PSK" \\
  -d "{\\\"publicKey\\\":\\\"\$SERVER_PUBKEY\\\",\\\"publicIp\\\":\\\"\$PUBLIC_IP\\\",\\\"region\\\":\\\"\$REGION\\\"}")

NODE_ID=\$(echo \$RESPONSE | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['nodeId'])")
SERVER_VPN_IP=\$(echo \$RESPONSE | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['serverVpnIp'])")
VPN_SUBNET=\$(echo \$RESPONSE | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['vpnSubnet'])")

echo "    Node ID: \$NODE_ID"
echo "    VPN IP: \$SERVER_VPN_IP"
echo "    Subnet: \$VPN_SUBNET"

# 5. Create wg0.conf
echo "[5/7] Creating WireGuard config..."
mkdir -p /etc/wireguard
cat > /etc/wireguard/wg0.conf << WGCONF
[Interface]
Address = \$SERVER_VPN_IP/24
ListenPort = 51820
PrivateKey = \$SERVER_PRIVKEY
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
WGCONF
chmod 600 /etc/wireguard/wg0.conf

# Enable IP forwarding
echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -p -q

# Start WireGuard
systemctl enable --now wg-quick@wg0
echo "    WireGuard started on port 51820"

# 6. Download and install daemon
echo "[6/7] Installing ProxhqVPN daemon..."
curl -sf "\$API/daemon-download" -o /usr/local/bin/proxhqd.py
chmod +x /usr/local/bin/proxhqd.py

# 7. Install systemd service
echo "[7/7] Setting up auto-start service..."
cat > /etc/systemd/system/proxhqd.service << SVCEOF
[Unit]
Description=ProxhqVPN Daemon
After=network.target wg-quick@wg0.service

[Service]
ExecStart=/usr/bin/python3 /usr/local/bin/proxhqd.py --api \$API --node-id \$NODE_ID --psk \$PSK
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable --now proxhqd

echo ""
echo "========================================="
echo "  ProxhqVPN Node Setup Complete!"
echo "  Node ID:     \$NODE_ID"
echo "  Region:      \$REGION"
echo "  Public IP:   \$PUBLIC_IP"
echo "  VPN Address: \$SERVER_VPN_IP"
echo "  Status:      Online — reporting every 30s"
echo "========================================="
echo ""
`;

  res.setHeader("Content-Type", "text/plain");
  res.send(script);
});

// Auth guard — all routes below require a valid Clerk session
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  next();
};
router.use(requireAuth);

// Admin guard — checks is_admin flag in DB
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user?.isAdmin) return res.status(403).json({ error: "Forbidden: admin only" });
  next();
};

router.use("/me",             meRouter);
router.use("/nodes",          nodesRouter);
router.use("/beacons",        beaconsRouter);
router.use("/silkweb",        silkwebRouter);
router.use("/firewall",       firewallRouter);
router.use("/monitor",        monitorRouter);
router.use("/terminal",       terminalRouter);
router.use("/sql",            sqlRouter);
router.use("/proxy-browser",  proxyBrowserRouter);
router.use("/killswitch",     killswitchRouter);
router.use("/leaks",          leaksRouter);
router.use("/threatintel",    threatintelRouter);
router.use("/split-tunnel",   splittunnelRouter);
router.use("/obfuscation",    obfuscationRouter);
router.use("/security-audit", securityauditRouter);
router.use("/daemon",         daemonRouter);
router.use("/vpn-coexist",    vpnCoexistRouter);
router.use("/vpngate",        vpnGateRouter);
router.use("/devices",        devicesRouter);
router.use("/dns-shield",     dnsShieldRouter);
router.use("/smart-dns",      smartDnsRouter);
router.use("/router-config",  routerConfigRouter);

// Stripe routes — require auth (enforced above)
router.use("/stripe",         stripeRouter);
router.use("/wireguard",      wireguardRouter);
router.use("/sqlmap",         sqlmapRouter);

export default router;
