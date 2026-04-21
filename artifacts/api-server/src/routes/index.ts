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
import alphaRouter from "./alpha";

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
  // Always use the stable Replit dev domain so external servers can reach us
  const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0] || "";
  const apiBase = replitDomain ? `https://${replitDomain}/api` : `https://${req.headers.host}/api`;
  const region = (req.query.region as string) || "Unknown";

  const script = `#!/bin/bash
# ProxhqVPN Node Setup Script
# Installs WireGuard + daemon on a fresh Ubuntu/Debian VPS

API="${apiBase}"
PSK="${psk}"
REGION="${region}"

die() { echo ""; echo "ERROR: \$1"; echo "Setup failed. Fix the error above and re-run."; exit 1; }
ok()  { echo "  OK"; }

echo ""
echo "========================================"
echo "   ProxhqVPN Node Setup"
echo "   Region: \$REGION"
echo "========================================"
echo ""

# Wait for cloud-init to finish (new servers need this)
echo "[0/7] Waiting for system to be ready..."
sleep 5
systemctl is-active --quiet cloud-init-local 2>/dev/null && sleep 10
ok

# 1. Install WireGuard
echo "[1/7] Installing WireGuard..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq 2>&1 | tail -1 || true
apt-get install -y wireguard wireguard-tools openvpn curl python3 iptables 2>&1 | grep -E "^(Err|W:|E:)" || true
which wg > /dev/null 2>&1 || die "WireGuard failed to install. Try: apt-get install wireguard"
ok

# 2. Generate WireGuard keys
echo "[2/7] Generating WireGuard keys..."
SERVER_PRIVKEY=\$(wg genkey) || die "Failed to generate WireGuard private key"
SERVER_PUBKEY=\$(echo "\$SERVER_PRIVKEY" | wg pubkey) || die "Failed to derive public key"
echo "  Public key: \$SERVER_PUBKEY"
ok

# 3. Get public IP
echo "[3/7] Detecting public IP..."
PUBLIC_IP=\$(curl -sf --max-time 8 https://api.ipify.org 2>/dev/null) \\
  || PUBLIC_IP=\$(curl -sf --max-time 8 https://ipinfo.io/ip 2>/dev/null) \\
  || PUBLIC_IP=\$(curl -sf --max-time 8 https://icanhazip.com 2>/dev/null)
[ -z "\$PUBLIC_IP" ] && die "Could not detect public IP — check internet connectivity"
echo "  IP: \$PUBLIC_IP"
ok

# 4. Register with ProxhqVPN
echo "[4/7] Registering node with ProxhqVPN..."
PAYLOAD='{"publicKey":"'"\$SERVER_PUBKEY"'","publicIp":"'"\$PUBLIC_IP"'","region":"'"\$REGION"'"}'
RESPONSE=\$(curl -sf --max-time 15 -X POST "\$API/node-provision" \\
  -H "Content-Type: application/json" \\
  -H "X-Daemon-PSK: \$PSK" \\
  -d "\$PAYLOAD") || die "Could not reach ProxhqVPN API at \$API"
[ -z "\$RESPONSE" ] && die "Empty response from API — check DAEMON_PSK"
NODE_ID=\$(echo "\$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['nodeId'])") || die "Bad API response: \$RESPONSE"
SERVER_VPN_IP=\$(echo "\$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['serverVpnIp'])")
echo "  Node ID: \$NODE_ID | VPN IP: \$SERVER_VPN_IP"
ok

# 5. Create wg0.conf
echo "[5/7] Configuring WireGuard..."
mkdir -p /etc/wireguard
cat > /etc/wireguard/wg0.conf << WGEOF
[Interface]
Address = \${SERVER_VPN_IP}/24
ListenPort = 51820
PrivateKey = \${SERVER_PRIVKEY}
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
WGEOF
chmod 600 /etc/wireguard/wg0.conf
grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf || echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -w net.ipv4.ip_forward=1 -q
systemctl enable wg-quick@wg0 2>/dev/null || true
systemctl restart wg-quick@wg0 || die "WireGuard failed to start — check /etc/wireguard/wg0.conf"
ok

# 6. Download daemon
echo "[6/7] Installing ProxhqVPN daemon..."
curl -sf --max-time 15 "\$API/daemon-download" -o /usr/local/bin/proxhqd.py || die "Failed to download daemon from \$API/daemon-download"
chmod +x /usr/local/bin/proxhqd.py
ok

# 7. Install systemd service
echo "[7/7] Starting daemon service..."
cat > /etc/systemd/system/proxhqd.service << SVCEOF
[Unit]
Description=ProxhqVPN Daemon
After=network.target wg-quick@wg0.service
Wants=wg-quick@wg0.service

[Service]
ExecStart=/usr/bin/python3 /usr/local/bin/proxhqd.py --api \${API} --node-id \${NODE_ID} --psk \${PSK}
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF
systemctl daemon-reload
systemctl enable proxhqd
systemctl restart proxhqd
ok

echo ""
echo "========================================"
echo "  Setup Complete!"
echo ""
echo "  Node ID  : \$NODE_ID"
echo "  Region   : \$REGION"
echo "  Public IP: \$PUBLIC_IP"
echo "  VPN IP   : \$SERVER_VPN_IP"
echo ""
echo "  Node is now online and reporting"
echo "  Check your dashboard in 30 seconds"
echo "========================================"
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
router.use("/alpha",          alphaRouter);

export default router;
