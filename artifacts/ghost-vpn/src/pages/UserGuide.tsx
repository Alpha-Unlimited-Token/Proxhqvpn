import { useState, useEffect, useRef } from "react";
import {
  BookOpen, Wifi, Shield, Globe, Server, Terminal, Database,
  ScanSearch, Layers, Router, Cpu, Zap, EyeOff, GitBranch,
  Globe2, Activity, Network, Power, Search, ShieldPlus,
  ChevronRight, Bookmark, Copy, Check, AlertCircle, Info,
  Radio, Gamepad2, Tv, Smartphone, Monitor, Bug, FileText,
  Lock, Key, Settings, BarChart2, Bell, Map, TrendingUp,
} from "lucide-react";

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); };
  return (
    <button onClick={copy} className="ml-2 opacity-40 hover:opacity-100 transition-opacity">
      {done ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function CB({ children, label }: { children: string; label?: string }) {
  return (
    <div className="my-2">
      {label && <div className="text-[8px] text-primary/30 font-mono uppercase tracking-widest mb-1">{label}</div>}
      <pre className="relative group font-mono text-[10px] bg-black border border-primary/15 rounded p-3 text-green-400/80 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {children}
        <button onClick={() => navigator.clipboard.writeText(children)}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-primary/30 hover:text-primary">
          <Copy className="w-3 h-3" />
        </button>
      </pre>
    </div>
  );
}

function Note({ children, type = "info" }: { children: React.ReactNode; type?: "info" | "warn" | "danger" }) {
  const styles: Record<string, string> = {
    info:   "border-blue-500/20 bg-blue-900/10 text-blue-400/80",
    warn:   "border-yellow-500/20 bg-yellow-900/10 text-yellow-400/80",
    danger: "border-red-500/20 bg-red-900/10 text-red-400/80",
  };
  const icons: Record<string, React.ElementType> = { info: Info, warn: AlertCircle, danger: AlertCircle };
  const Icon = icons[type];
  return (
    <div className={`flex items-start gap-2 text-[9px] font-mono border rounded px-3 py-2 my-2 ${styles[type]}`}>
      <Icon className="w-3 h-3 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

interface Section {
  id: string; title: string; icon: React.ElementType;
  content: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: "overview", title: "Platform Overview", icon: BookOpen,
    content: (
      <div className="space-y-3">
        <p>ProxhqVPN is a fully self-hosted, enterprise-grade VPN platform built by <strong>ALPHA UNLIMITED TECHNOLOGIES LLC</strong>. It combines WireGuard's modern cryptography (AES-256-GCM, ChaCha20-Poly1305) with double-hop routing via VPN Gate, a SilkWeb honeypot mesh for active threat detection, and an integrated Alpha Toolkit for advanced security research.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {[
            { t: "WireGuard Core", d: "Modern VPN protocol with AES-256-GCM. Fastest and most secure available." },
            { t: "Double-Hop (VPN Gate)", d: "Route through community VPN Gate servers for an extra anonymity layer." },
            { t: "SilkWeb Honeypot Mesh", d: "Decoy network that lures, fingerprints, and blocks attackers in real time." },
            { t: "Alpha Toolkit", d: "Universal Scanner, Vuln Verifier, Web Scraper — all Tor-cloakable." },
            { t: "Kill Switch", d: "Block all traffic if VPN drops. No IP leaks, ever." },
            { t: "Clerk Auth + Stripe", d: "Enterprise SSO authentication with integrated subscription billing." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/15 rounded p-3">
              <div className="text-[10px] font-mono font-bold text-primary mb-0.5">{t}</div>
              <div className="text-[9px] text-primary/50 font-mono">{d}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "connect", title: "My VPN — Connecting", icon: Wifi,
    content: (
      <div className="space-y-3">
        <p>The <strong>My VPN</strong> page (<code>/my-vpn</code>) is your main connection hub. It shows your active tunnel, public IP, protocol, and connection stats.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Connect</h4>
        <ol className="space-y-2 text-[10px] font-mono text-primary/70">
          <li><span className="text-primary/30">1.</span> Go to <strong>My VPN</strong> in the sidebar.</li>
          <li><span className="text-primary/30">2.</span> Select a server from the map or the server list. Servers are sorted by latency.</li>
          <li><span className="text-primary/30">3.</span> Click <strong>Connect</strong>. The status indicator changes from grey to green.</li>
          <li><span className="text-primary/30">4.</span> Your real IP is replaced with the VPN server's IP. Verify at <code>https://api64.ipify.org</code>.</li>
          <li><span className="text-primary/30">5.</span> To disconnect, click the red <strong>Disconnect</strong> button.</li>
        </ol>
        <Note type="info">ProxhqVPN uses WireGuard by default. It re-establishes connections automatically if the network changes (e.g. switching from WiFi to cellular).</Note>
        <h4 className="font-bold text-primary text-[11px] mt-4">Connection Modes</h4>
        <div className="space-y-2">
          {[
            { m: "WireGuard (Default)", d: "Direct tunnel to the nearest ProxhqVPN server. Fastest option." },
            { m: "Double-Hop (VPN Gate)", d: "Your traffic first goes through a community VPN Gate server, then through ProxhqVPN. Extra anonymity layer — slightly slower." },
            { m: "Obfuscated (Stealth)", d: "Wraps WireGuard in obfs4 to look like HTTPS traffic. Bypasses VPN-blocking firewalls." },
          ].map(({ m, d }) => (
            <div key={m} className="border border-primary/10 rounded px-3 py-2 text-[10px] font-mono">
              <span className="text-primary font-bold">{m}</span> — <span className="text-primary/60">{d}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "wireguard", title: "WireGuard Config", icon: Cpu,
    content: (
      <div className="space-y-3">
        <p>The <strong>WireGuard Config</strong> page (<code>/wireguard</code>) generates cryptographically-signed config files for any device.</p>
        <h4 className="font-bold text-primary text-[11px]">Generate a Config</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/70">
          <li><span className="text-primary/30">1.</span> Select a server location from the dropdown.</li>
          <li><span className="text-primary/30">2.</span> Choose DNS: ProxhqVPN DNS (default), Cloudflare, or system.</li>
          <li><span className="text-primary/30">3.</span> Click <strong>Generate</strong>. A config block appears.</li>
          <li><span className="text-primary/30">4.</span> Click <strong>Download .conf</strong> for desktop/router or <strong>Show QR</strong> for mobile.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">Sample Config Structure</h4>
        <CB label="wireguard config file (wg0.conf)">{`[Interface]
PrivateKey = <your-generated-private-key>
Address = 10.8.0.2/24
DNS = 1.1.1.1

[Peer]
PublicKey = <proxhqvpn-server-public-key>
Endpoint = vpn.proxhqvpn.net:51820
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25`}</CB>
        <Note type="info">AllowedIPs = 0.0.0.0/0 routes ALL traffic through the VPN (full tunnel). To use split tunneling, use specific CIDR ranges instead.</Note>
        <h4 className="font-bold text-primary text-[11px] mt-3">Rotate Keys</h4>
        <p className="text-[10px] font-mono text-primary/70">Click <strong>Rotate Keys</strong> to generate a new keypair. Old configs are immediately invalidated — update all devices after rotating.</p>
      </div>
    ),
  },
  {
    id: "killswitch", title: "Kill Switch", icon: Power,
    content: (
      <div className="space-y-3">
        <p>The <strong>Kill Switch</strong> (<code>/kill-switch</code>) blocks ALL internet traffic if the VPN tunnel drops, preventing IP leaks.</p>
        <h4 className="font-bold text-primary text-[11px]">How It Works</h4>
        <p className="text-[10px] font-mono text-primary/70">The kill switch adds iptables/nftables rules that DROP all outbound packets not going through the WireGuard interface (<code>wg0</code>). If WireGuard disconnects, your traffic stops — it does not fall back to your real IP.</p>
        <CB label="what the kill switch rules look like">{`# Block all outbound traffic NOT on wg0
iptables -I OUTPUT ! -o wg0 -m mark ! --mark $(wg show wg0 fwmark) -m addrtype ! --dst-type LOCAL -j REJECT

# Allow local network traffic
iptables -I OUTPUT -o lo -j ACCEPT
iptables -I OUTPUT -d 192.168.0.0/16 -j ACCEPT`}</CB>
        <h4 className="font-bold text-primary text-[11px] mt-3">Enable Kill Switch</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/70">
          <li><span className="text-primary/30">1.</span> Go to <strong>Kill Switch</strong> in the Protection section.</li>
          <li><span className="text-primary/30">2.</span> Toggle <strong>Enable Kill Switch</strong> → Confirm.</li>
          <li><span className="text-primary/30">3.</span> The rules are applied to the server. Status shows <span className="text-green-400">ACTIVE</span>.</li>
          <li><span className="text-primary/30">4.</span> To disable: toggle off and confirm — rules are flushed.</li>
        </ol>
        <Note type="warn">If you disable the kill switch while disconnected, your real IP will be briefly exposed. Always re-connect the VPN first.</Note>
      </div>
    ),
  },
  {
    id: "leaks", title: "Leak Test", icon: Search,
    content: (
      <div className="space-y-3">
        <p>The <strong>Leak Detection</strong> page (<code>/leaks</code>) tests for DNS leaks, WebRTC leaks, and IPv6 leaks — the three most common ways a VPN fails to protect you.</p>
        <div className="space-y-2">
          {[
            { t: "IP Leak Test", d: "Compares your detected IP against the VPN server IP. Any mismatch = your real IP is visible." },
            { t: "DNS Leak Test", d: "Sends DNS requests to a canary server and checks which DNS resolvers answered. Should only see ProxhqVPN's DNS or your VPN server's IP." },
            { t: "WebRTC Leak Test", d: "WebRTC can bypass VPN tunnels and expose your LAN/real IP. ProxhqVPN's script patches the browser's WebRTC STUN configuration." },
            { t: "IPv6 Leak Test", d: "Many VPNs only tunnel IPv4 traffic. ProxhqVPN checks for IPv6 route exposure and blocks it if found." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/50 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <Note type="info">Run the leak test while connected to ProxhqVPN. All results should show VPN IP addresses, not your ISP-assigned IP.</Note>
      </div>
    ),
  },
  {
    id: "dns", title: "DNS Protection", icon: ShieldPlus,
    content: (
      <div className="space-y-3">
        <p>The <strong>DNS Shield</strong> page (<code>/dns-shield</code>) configures encrypted DNS to prevent ISP tracking and DNS-based censorship.</p>
        <h4 className="font-bold text-primary text-[11px]">DNS Options</h4>
        <div className="space-y-2">
          {[
            { t: "ProxhqVPN DNS", d: "Default. Routes DNS through the VPN tunnel. Zero logs." },
            { t: "DNS-over-HTTPS (DoH)", d: "Encrypts DNS queries inside HTTPS. Even your ISP cannot see what domains you're resolving." },
            { t: "DNS-over-TLS (DoT)", d: "TLS-encrypted DNS on port 853. Supported by Cloudflare (1.1.1.1), Google (8.8.8.8)." },
            { t: "Custom DNS", d: "Set any DNS server IP. Use for private internal DNS in corporate environments." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/50 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Enable DNS Protection</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/70">
          <li><span className="text-primary/30">1.</span> Go to <strong>DNS Protection</strong> → choose your preferred DNS provider.</li>
          <li><span className="text-primary/30">2.</span> Click <strong>Apply</strong>. Your WireGuard DNS setting is updated automatically.</li>
          <li><span className="text-primary/30">3.</span> Regenerate your WireGuard config if you use a device with a cached config.</li>
        </ol>
      </div>
    ),
  },
  {
    id: "obfuscation", title: "Obfuscation (Stealth Mode)", icon: EyeOff,
    content: (
      <div className="space-y-3">
        <p>Obfuscation (<code>/obfuscation</code>) disguises VPN traffic so it looks like ordinary HTTPS/TLS traffic, bypassing deep packet inspection (DPI) used by China's Great Firewall, Russia's TSPU, and corporate firewalls.</p>
        <h4 className="font-bold text-primary text-[11px]">Obfuscation Methods</h4>
        <div className="space-y-2">
          {[
            { t: "obfs4", d: "Best general-purpose obfuscation. Randomizes packet length, timing, and byte patterns. Used by Tor Project." },
            { t: "Shadowsocks", d: "Stream cipher proxy. Widely used to bypass the Great Firewall. Looks like random data, not a VPN." },
            { t: "V2Ray (VMess)", d: "Advanced proxy protocol with traffic morphing. Mimics WebSocket or HTTP/2 traffic." },
            { t: "Stunnel / TLS Wrap", d: "Wraps WireGuard traffic inside a TLS 1.3 session. Appears as normal HTTPS to firewalls." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/50 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <Note type="warn">Obfuscation adds latency (typically 10–40ms extra). Use only when behind a restrictive firewall. For maximum speed, use standard WireGuard.</Note>
      </div>
    ),
  },
  {
    id: "splittunnel", title: "Split Tunneling", icon: GitBranch,
    content: (
      <div className="space-y-3">
        <p>Split Tunneling (<code>/split-tunnel</code>) lets you choose which apps or domains go through the VPN and which use your direct internet connection.</p>
        <h4 className="font-bold text-primary text-[11px]">Use Cases</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/70">
          <div>• Route <strong>Netflix</strong> through VPN (US server) while banking app uses your real IP (avoids fraud flags).</div>
          <div>• Route all <strong>corporate traffic</strong> through VPN but let <strong>YouTube</strong> bypass it for speed.</div>
          <div>• Tunnel only <strong>torrent clients</strong> through VPN — everything else stays on your ISP connection.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Configuration</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/70">
          <li><span className="text-primary/30">1.</span> Go to <strong>Split Tunnel</strong> → choose Exclude or Include mode.</li>
          <li><span className="text-primary/30">2.</span> <strong>Exclude mode</strong>: everything goes through VPN except the apps/IPs you list.</li>
          <li><span className="text-primary/30">3.</span> <strong>Include mode</strong>: only the apps/IPs you list use the VPN.</li>
          <li><span className="text-primary/30">4.</span> Add rules by IP range (CIDR) or domain. Changes apply immediately — no reconnect needed.</li>
        </ol>
        <CB label="example: split tunnel cidr entries">{`# Route only these through VPN:
10.0.0.0/8        # Corporate LAN
172.16.0.0/12     # Private datacenter range

# Bypass VPN for these:
8.8.8.8/32        # Google DNS (direct)
192.168.1.0/24    # Local home network`}</CB>
      </div>
    ),
  },
  {
    id: "proxy", title: "Proxy & Tor", icon: Globe2,
    content: (
      <div className="space-y-3">
        <p>The <strong>Proxy & Tor</strong> page (<code>/proxy</code>) manages SOCKS5 proxy endpoints and Tor bridge configuration. Use these to add extra anonymity layers on top of your VPN.</p>
        <h4 className="font-bold text-primary text-[11px]">SOCKS5 Proxy</h4>
        <p className="text-[10px] font-mono text-primary/70">ProxhqVPN exposes a SOCKS5 proxy on port 1080 of the VPN server. Configure your browser or torrent client to use it:</p>
        <CB label="socks5 proxy settings">{`SOCKS5 Host: 10.8.0.1  (VPN server internal IP)
Port: 1080
Authentication: use your ProxhqVPN credentials

# In curl:
curl --socks5-hostname 10.8.0.1:1080 https://api64.ipify.org`}</CB>
        <h4 className="font-bold text-primary text-[11px] mt-3">Tor Integration</h4>
        <p className="text-[10px] font-mono text-primary/70">ProxhqVPN runs a Tor daemon (127.0.0.1:9050). Traffic routed through Tor exits at a random Tor exit node — triple-hop: you → ProxhqVPN → Tor circuit → destination.</p>
        <CB label="verify tor is running">{`# On the server (via Terminal page):
systemctl status tor

# Check your Tor exit IP:
curl --socks5 127.0.0.1:9050 https://check.torproject.org/api/ip`}</CB>
        <Note type="info">Tor adds significant latency (200–500ms typical). Use for maximum anonymity, not for streaming or gaming.</Note>
      </div>
    ),
  },
  {
    id: "vpngate", title: "VPN Gate (Double-Hop)", icon: Globe,
    content: (
      <div className="space-y-3">
        <p>VPN Gate (<code>/vpngate</code>) connects you to community-operated VPN servers worldwide for an extra anonymity layer. Your traffic goes: <strong>You → ProxhqVPN → VPN Gate Server → Internet</strong>.</p>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/70">
          <li><span className="text-primary/30">1.</span> Go to <strong>VPN Gate</strong> — the page fetches the live server list from vpngate.net.</li>
          <li><span className="text-primary/30">2.</span> Filter by country, latency, or protocol (OpenVPN/L2TP).</li>
          <li><span className="text-primary/30">3.</span> Click a server → <strong>Generate Config</strong> → the config is created for that specific VPN Gate endpoint.</li>
          <li><span className="text-primary/30">4.</span> Click <strong>Connect via Gate</strong> to activate the double-hop tunnel.</li>
        </ol>
        <Note type="warn">VPN Gate servers are community-run and logs may exist on them. Use for geo-unblocking, not for high-security anonymity.</Note>
      </div>
    ),
  },
  {
    id: "onion", title: "Onion Browser", icon: Globe2,
    content: (
      <div className="space-y-3">
        <p>The <strong>Onion Browser</strong> (<code>/onion-browser</code>) is a built-in dark web browser that routes traffic through Tor circuits, accessible directly from the ProxhqVPN dashboard.</p>
        <h4 className="font-bold text-primary text-[11px]">Usage</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/70">
          <li><span className="text-primary/30">1.</span> Click <strong>Onion Browser</strong> in the Network section.</li>
          <li><span className="text-primary/30">2.</span> Enter any .onion address or clearnet URL in the address bar.</li>
          <li><span className="text-primary/30">3.</span> Traffic is routed: ProxhqVPN Server → Tor Entry Guard → Tor Relay → Tor Exit → Destination.</li>
          <li><span className="text-primary/30">4.</span> The exit IP shown is a Tor exit node — not your real IP, not ProxhqVPN's IP.</li>
        </ol>
        <CB label="example .onion addresses to test">{`# DuckDuckGo Onion:
https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion

# New York Times:
https://www.nytimesn7cgmftshazwhfgzm37qxb44r64ytbb2dj3x62d2lljsciiyd.onion`}</CB>
        <Note type="warn">Do not use the Onion Browser for illegal activity. It provides anonymity, not immunity from law enforcement.</Note>
      </div>
    ),
  },
  {
    id: "smartdns", title: "Smart DNS", icon: Zap,
    content: (
      <div className="space-y-3">
        <p>Smart DNS (<code>/smart-dns</code>) bypasses geo-blocks on streaming services (Netflix, Hulu, BBC iPlayer) without routing ALL your traffic through a VPN. Only DNS queries for geo-blocked domains are intercepted and spoofed.</p>
        <h4 className="font-bold text-primary text-[11px]">Setup Smart DNS</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/70">
          <li><span className="text-primary/30">1.</span> Go to <strong>Smart DNS</strong> → copy the two DNS server IPs.</li>
          <li><span className="text-primary/30">2.</span> On your device, set the DNS servers to the ProxhqVPN Smart DNS addresses.</li>
          <li><span className="text-primary/30">3.</span> No VPN app needed — works on any device including Smart TVs and game consoles.</li>
          <li><span className="text-primary/30">4.</span> Supported regions: US, UK, Canada, Australia, Japan (configurable).</li>
        </ol>
        <Note type="info">Smart DNS does NOT encrypt your traffic. It only changes which content you can access. For privacy, use the full VPN.</Note>
      </div>
    ),
  },
  {
    id: "router", title: "Router Config", icon: Router,
    content: (
      <div className="space-y-3">
        <p>The <strong>Router Config</strong> page (<code>/router-config</code>) generates platform-specific WireGuard configs for routers, protecting every device on your network automatically.</p>
        <h4 className="font-bold text-primary text-[11px]">Supported Router Firmware</h4>
        <div className="grid grid-cols-2 gap-2">
          {["OpenWRT", "DD-WRT", "pfSense", "OPNsense", "AsusWRT-Merlin", "Tomato", "MikroTik"].map(f => (
            <div key={f} className="text-[9px] font-mono text-primary/70 border border-primary/10 rounded px-2 py-1">✓ {f}</div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">OpenWRT Quick Setup</h4>
        <CB label="ssh into your openwrt router and run:">{`# Install WireGuard
opkg update
opkg install wireguard-tools kmod-wireguard luci-proto-wireguard

# Create interface
uci set network.wg0=interface
uci set network.wg0.proto=wireguard
uci set network.wg0.private_key='PASTE_PRIVATE_KEY_FROM_PROXHQVPN'
uci set network.wg0.addresses='10.8.0.2/24'
uci commit network
/etc/init.d/network restart`}</CB>
      </div>
    ),
  },
  {
    id: "vpncoexist", title: "VPN Coexistence", icon: Settings,
    content: (
      <div className="space-y-3">
        <p>VPN Coexistence (<code>/vpn-coexist</code>) lets ProxhqVPN run alongside other VPN clients (corporate VPNs, Tailscale, Zerotier) without conflicts.</p>
        <h4 className="font-bold text-primary text-[11px]">Common Scenarios</h4>
        <div className="space-y-2">
          {[
            { t: "Corporate VPN + ProxhqVPN", d: "Use split tunneling to route corporate subnets through the corporate VPN and all other traffic through ProxhqVPN." },
            { t: "Tailscale + ProxhqVPN", d: "Both use WireGuard. Set fwmark values to not conflict. ProxhqVPN detects Tailscale automatically and adjusts routing tables." },
            { t: "Tor + ProxhqVPN", d: "Your traffic goes: ProxhqVPN → Tor. Both are active simultaneously on different ports/interfaces." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/50 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "nodes", title: "VPN Servers (Admin)", icon: Server,
    content: (
      <div className="space-y-3">
        <p>The <strong>VPN Servers</strong> page (<code>/nodes</code>) is the admin control panel for your ProxhqVPN server infrastructure.</p>
        <h4 className="font-bold text-primary text-[11px]">Provisioning a New Server</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/70">
          <li><span className="text-primary/30">1.</span> Click <strong>Add Server</strong> → enter the server's IP, location, and label.</li>
          <li><span className="text-primary/30">2.</span> Click <strong>Get Setup Script</strong> — a bash script is generated for that server.</li>
          <li><span className="text-primary/30">3.</span> SSH into the server and run the script as root. It installs WireGuard, the ProxhqVPN daemon, and configures all firewall rules.</li>
          <li><span className="text-primary/30">4.</span> The server appears as <span className="text-green-400">Online</span> in the dashboard within 60 seconds.</li>
        </ol>
        <CB label="run on your new vps as root:">{`curl -s https://your-proxhqvpn-api/api/setup-script | bash`}</CB>
        <h4 className="font-bold text-primary text-[11px] mt-3">Server Actions</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/70">
          <div>• <strong>Rotate IP</strong> — assigns a new public IP to the node (if provider supports it)</div>
          <div>• <strong>Enable/Disable</strong> — temporarily removes the node from the connection pool</div>
          <div>• <strong>Bulk Replace</strong> — swap all nodes with a new batch simultaneously</div>
          <div>• <strong>View Status</strong> — see live WireGuard peer count, uptime, CPU, and bandwidth</div>
        </div>
      </div>
    ),
  },
  {
    id: "silkweb", title: "SilkWeb Decoy Network (Admin)", icon: Network,
    content: (
      <div className="space-y-3">
        <p>SilkWeb (<code>/silkweb</code>) is the ProxhqVPN honeypot and decoy mesh. It deploys fake services that look real (SSH, HTTP, FTP, databases) to attract and fingerprint attackers.</p>
        <h4 className="font-bold text-primary text-[11px]">How SilkWeb Works</h4>
        <div className="space-y-2 text-[10px] font-mono text-primary/70">
          <div>1. SilkWeb traps listen on commonly-scanned ports (22, 80, 443, 3306, 5432, 6379, 27017).</div>
          <div>2. When an attacker connects, SilkWeb accepts the connection and logs every keystroke, payload, and command.</div>
          <div>3. The attacker's IP, fingerprint, and tools are captured and automatically added to the firewall blocklist.</div>
          <div>4. Advanced traps run nmap and SQLmap back against the attacker to identify their infrastructure.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Running a Port Scan on a Trapped IP</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/70">
          <li><span className="text-primary/30">1.</span> Go to <strong>SilkWeb</strong> → <strong>Trapped IPs</strong> tab.</li>
          <li><span className="text-primary/30">2.</span> Select a trapped IP → click <strong>Port Scan</strong>.</li>
          <li><span className="text-primary/30">3.</span> Toggle <strong>Use Tor</strong> to route the scan through Tor (recommended to avoid revealing your server IP).</li>
          <li><span className="text-primary/30">4.</span> Results show open ports, services, and OS fingerprint of the attacker's machine.</li>
        </ol>
        <Note type="danger">Counterscanning is a legal grey area in many jurisdictions. Only scan IPs that attacked you first, and consult legal counsel for your region.</Note>
      </div>
    ),
  },
  {
    id: "beacons", title: "Threat Monitor / Beacons (Admin)", icon: Bell,
    content: (
      <div className="space-y-3">
        <p>The <strong>Threat Monitor</strong> (<code>/beacons</code>) shows real-time intrusion detection alerts from all ProxhqVPN nodes and SilkWeb honeypots.</p>
        <h4 className="font-bold text-primary text-[11px]">Alert Types</h4>
        <div className="space-y-2">
          {[
            { t: "Port Scan Detected", d: "Sequential port probing detected on a VPN node. Attacker IP auto-blocked." },
            { t: "SSH Brute Force", d: "Multiple failed SSH login attempts from the same IP." },
            { t: "Honeypot Hit", d: "Connection to a SilkWeb decoy service. Full payload captured." },
            { t: "WireGuard Handshake Anomaly", d: "Invalid or replayed WireGuard handshake packets. Possible replay attack." },
            { t: "DNS Exfiltration Attempt", d: "Unusual DNS query volume or base64-encoded subdomains (DNS tunneling)." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-red-500/10 rounded px-3 py-2 bg-red-900/5">
              <div className="text-[10px] font-mono font-bold text-red-400">{t}</div>
              <div className="text-[9px] font-mono text-primary/50 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Actions</h4>
        <p className="text-[10px] font-mono text-primary/70">For each alert: <strong>Dismiss</strong> (false positive), <strong>Block IP</strong> (add to firewall), or <strong>Investigate</strong> (run port scan, WHOIS, threat intel lookup).</p>
      </div>
    ),
  },
  {
    id: "firewall", title: "Firewall (Admin)", icon: Shield,
    content: (
      <div className="space-y-3">
        <p>The <strong>Firewall</strong> page (<code>/firewall</code>) manages iptables/nftables rules across all ProxhqVPN nodes from a single interface.</p>
        <h4 className="font-bold text-primary text-[11px]">Rule Types</h4>
        <div className="space-y-2">
          {[
            { t: "Block IP / CIDR", d: "Drop all packets from a specific IP or range. Applied to all nodes simultaneously." },
            { t: "Allow Port", d: "Allow inbound traffic on specific ports (e.g. allow 51820/UDP for WireGuard)." },
            { t: "Rate Limit", d: "Limit connection rate per IP to mitigate DDoS and brute force attacks." },
            { t: "GeoIP Block", d: "Block all traffic from entire countries by ASN/country code." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/50 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Generate iptables Rules</h4>
        <CB label="generated output example">{`# ProxhqVPN Auto-generated firewall rules
iptables -A INPUT -s 192.168.100.50 -j DROP          # Blocked attacker IP
iptables -A INPUT -p tcp --dport 22 -m limit --limit 5/min -j ACCEPT  # SSH rate limit
iptables -A INPUT -p udp --dport 51820 -j ACCEPT     # WireGuard
iptables -A INPUT -j DROP                             # Default deny all`}</CB>
      </div>
    ),
  },
  {
    id: "terminal", title: "Remote Terminal (Admin)", icon: Terminal,
    content: (
      <div className="space-y-3">
        <p>The <strong>Terminal</strong> (<code>/terminal</code>) provides a web-based shell for executing commands on your ProxhqVPN server infrastructure. Rate limited to 20 commands/minute. All commands are logged in the audit trail.</p>
        <h4 className="font-bold text-primary text-[11px]">Useful Commands</h4>
        <CB label="wireguard status">{`wg show                         # Show all WireGuard interfaces and peers
wg show wg0 latest-handshakes   # When each peer last connected
ip route show table main        # Full routing table`}</CB>
        <CB label="system diagnostics">{`ss -tupn                        # All open sockets and listening services
df -h                           # Disk usage
free -m                         # RAM usage
journalctl -u wg-quick@wg0 -n 50  # WireGuard service logs`}</CB>
        <CB label="network debugging">{`curl -s https://api64.ipify.org   # Check public IP
ping -c 4 8.8.8.8               # Basic connectivity
traceroute 8.8.8.8              # Route tracing
nmap -sV localhost              # Local port scan`}</CB>
        <Note type="warn">The terminal is protected by Clerk auth and admin role. Never share your session or run commands from untrusted input. All commands are audit-logged.</Note>
      </div>
    ),
  },
  {
    id: "monitor", title: "Performance Monitor (Admin)", icon: Activity,
    content: (
      <div className="space-y-3">
        <p>The <strong>Performance</strong> page (<code>/monitor</code>) shows real-time system metrics across all VPN nodes.</p>
        <div className="space-y-2">
          {[
            { t: "CPU & RAM", d: "Per-node CPU usage and memory consumption updated every 30 seconds." },
            { t: "Bandwidth", d: "Inbound/outbound bytes per WireGuard interface. Used for capacity planning." },
            { t: "Active Connections", d: "Count of active WireGuard peers and their last handshake timestamps." },
            { t: "Network Sockets", d: "All open TCP/UDP sockets on each node — useful for detecting unexpected services." },
            { t: "MTU Optimization", d: "Automatically finds the optimal MTU for each node to prevent packet fragmentation." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/50 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "sqlmap", title: "SQLmap Vulnerability Scanner", icon: ScanSearch,
    content: (
      <div className="space-y-4">
        <p>The <strong>SQLmap Scanner</strong> (<code>/sqlmap</code>) is a full integration of the SQLmap automatic SQL injection detection and exploitation tool, accessible from the ProxhqVPN dashboard. All scans can be routed through Tor.</p>
        <Note type="danger">Only scan targets you own or have explicit written permission to test. Unauthorized scanning is illegal.</Note>
        <h4 className="font-bold text-primary text-[11px]">Running a Scan from the UI</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/70">
          <li><span className="text-primary/30">1.</span> Go to <strong>Vulnerability Scanner</strong> → enter the target URL.</li>
          <li><span className="text-primary/30">2.</span> Set the scan options (level, risk, technique, DBMS type).</li>
          <li><span className="text-primary/30">3.</span> Toggle <strong>Use Tor</strong> to route through Tor SOCKS5 (127.0.0.1:9050).</li>
          <li><span className="text-primary/30">4.</span> Click <strong>Start Scan</strong> — results stream in as SQLmap finds injections.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-2">SQLmap Command Reference</h4>
        <CB label="basic get parameter test">{`sqlmap -u "https://target.com/page.php?id=1" --batch --dbs`}</CB>
        <CB label="test post form">{`sqlmap -u "https://target.com/login" \
  --data="username=admin&password=test" \
  --method POST \
  --batch --dbs`}</CB>
        <CB label="via tor (always recommended)">{`sqlmap -u "https://target.com/page.php?id=1" \
  --tor \
  --tor-type=SOCKS5 \
  --tor-port=9050 \
  --batch --dbs`}</CB>
        <CB label="dump specific database table">{`sqlmap -u "https://target.com/page.php?id=1" \
  --dbms=mysql \
  -D target_db \
  -T users \
  --dump \
  --batch`}</CB>
        <CB label="detect waf and bypass">{`sqlmap -u "https://target.com/page.php?id=1" \
  --identify-waf \
  --tamper=space2comment,charencode,randomcase \
  --level=5 --risk=3 \
  --batch --dbs`}</CB>
        <CB label="test all parameters in a request (burp format)">{`# Save a Burp Suite HTTP request to request.txt, then:
sqlmap -r request.txt --batch --dbs --level=3 --risk=2`}</CB>
        <CB label="blind boolean injection">{`sqlmap -u "https://target.com/page.php?id=1" \
  --technique=B \
  --dbms=postgres \
  --batch --dbs`}</CB>
        <CB label="time-based blind injection">{`sqlmap -u "https://target.com/page.php?id=1" \
  --technique=T \
  --time-sec=5 \
  --batch --dbs`}</CB>
        <CB label="enumerate users and passwords">{`sqlmap -u "https://target.com/page.php?id=1" \
  --users --passwords \
  --batch`}</CB>
        <CB label="os command execution (if db has privileges)">{`sqlmap -u "https://target.com/page.php?id=1" \
  --os-shell \
  --batch`}</CB>
        <h4 className="font-bold text-primary text-[11px] mt-3">SQLmap Flags Reference</h4>
        <div className="space-y-1.5 text-[9px] font-mono">
          {[
            ["--level=1-5", "Test depth. 1=basic, 5=all possible injection points."],
            ["--risk=1-3", "Risk of damage. 1=safe, 3=includes heavy queries (may break DBs)."],
            ["--technique=BEUSTQ", "B=boolean, E=error, U=union, S=stacked, T=time, Q=inline."],
            ["--tamper=SCRIPT", "Apply evasion transforms (space2comment, charencode, etc)."],
            ["--dbms=TYPE", "Target specific DBMS: mysql, postgres, mssql, oracle, sqlite."],
            ["--dump-all", "Dump every database, table, and column (use carefully)."],
            ["--batch", "Non-interactive mode. Auto-answer all prompts with defaults."],
            ["--threads=N", "Parallel requests. Max 10 recommended."],
            ["--delay=N", "Seconds between requests. Use with sensitive targets."],
            ["--proxy=URL", "Route through a proxy (e.g. Burp: http://127.0.0.1:8080)."],
          ].map(([flag, desc]) => (
            <div key={flag} className="flex gap-3 border border-primary/10 rounded px-2 py-1">
              <code className="text-green-400/80 shrink-0 w-48">{flag}</code>
              <span className="text-primary/50">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "alphatools", title: "Alpha Toolkit", icon: Layers,
    content: (
      <div className="space-y-4">
        <p>The <strong>Alpha Toolkit</strong> (<code>/alpha-tools</code>) provides three advanced security research engines with a seamless Scanner → Verifier pipeline, all optionally routed through Tor.</p>

        <h4 className="font-bold text-primary text-[11px]">Tool 1 — Universal Scanner</h4>
        <p className="text-[10px] font-mono text-primary/70">Alpha Scanner v4.0 supports 35+ programming languages, 200+ vulnerability patterns, multi-step exploit chain detection, network port scanning, service fingerprinting, and secret/credential detection.</p>
        <div className="space-y-2">
          {[
            { m: "Network Scan", d: "Port scanning + service fingerprinting + banner grabbing via nmap integration." },
            { m: "Security Audit", d: "Scan source code or config files for hardcoded secrets, weak keys, misconfigs, exposed credentials." },
            { m: "Exploit Scan", d: "200+ vulnerability patterns: SQLi, XSS, SSTI, SSRF, path traversal, deserialization, RCE chains." },
            { m: "Full Scan", d: "Runs all three modes sequentially. Generates a comprehensive HTML report." },
          ].map(({ m, d }) => (
            <div key={m} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{m}</div>
              <div className="text-[9px] font-mono text-primary/50 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <CB label="scanner workflow">{`1. Enter Target IP/Hostname (network/all mode) or Path/URL (security/exploit mode)
2. Set port range for network scans (default: 1-10000)
3. Add extra flags: --lang cpp  --deep  --config-audit
4. Toggle Tor Cloak to route scan through Tor
5. Click Run Scanner → monitor live output in terminal
6. When complete: click Download HTML Report or Send to Verifier`}</CB>

        <h4 className="font-bold text-primary text-[11px] mt-3">Tool 2 — Vulnerability Verifier</h4>
        <p className="text-[10px] font-mono text-primary/70">The Verifier takes the Alpha Scanner HTML report and <strong>actively probes every finding against the live target</strong>. It performs TLS handshakes, TCP banner grabs, HTTP header analysis, SQL error probes, SSRF checks, and CDN false-positive filtering.</p>
        <CB label="scanner → verifier pipeline">{`Step 1: Run Universal Scanner → wait for completion
Step 2: Click "Send to Verifier" (green button)
         → App switches to Verifier tab automatically
         → HTML report is pre-loaded (~N KB)
Step 3: Optionally set a Target URL override
Step 4: Toggle Tor Cloak for anonymous probing
Step 5: Click "Verify Findings"
Step 6: Results show:
         - Exposed findings with captured evidence
         - False positive count
         - CDN detection warning if applicable
         - Downloadable color-coded Exposure Report`}</CB>

        <h4 className="font-bold text-primary text-[11px] mt-3">Tool 3 — Web Scraper</h4>
        <p className="text-[10px] font-mono text-primary/70">Alpha Web Scraper runs entirely in the browser and stores everything in a local SQLite database. It captures pages, links, emails, phone numbers, OpenGraph metadata, JSON-LD structured data, forms, and file assets into 14 queryable tables.</p>
        <CB label="what the scraper captures">{`Table: pages         → URL, title, meta description, HTML, status code
Table: links         → All href links (internal + external) with anchor text
Table: emails        → All email addresses found on any scraped page
Table: phones        → Phone numbers extracted via regex
Table: images        → Image URLs and alt text
Table: forms         → Form actions, methods, and all input field names
Table: opengraph     → og:title, og:image, og:description, og:type
Table: jsonld        → JSON-LD structured data blocks
Table: headers       → HTTP response headers per page
Table: cookies       → Cookie names, values, flags (HttpOnly, Secure)
Table: scripts       → External script URLs loaded per page
Table: stylesheets   → External CSS URLs
Table: assets        → Other assets (fonts, media, PDFs, etc.)
Table: metadata      → Crawl session info, start time, depth`}</CB>
        <div className="text-[9px] font-mono text-primary/50 border border-primary/10 rounded px-3 py-2">
          Export all data as <strong>.sqlite</strong> (open in DB Browser for SQLite), <strong>CSV</strong> (per table), or <strong>JSON</strong>. Enable Tor Mode inside the scraper (top-right toggle) to route all fetch requests through Tor circuits.
        </div>

        <h4 className="font-bold text-primary text-[11px] mt-3">Global Tor Cloak</h4>
        <p className="text-[10px] font-mono text-primary/70">The <strong>Tor Cloak</strong> toggle at the top of the Alpha Toolkit page routes ALL tools (Scanner, Verifier, nmap, SQLmap) through the Tor daemon at 127.0.0.1:9050. The Tor badge shows your current exit IP — verify it's a Tor exit node before running any scans.</p>
      </div>
    ),
  },
  {
    id: "securityaudit", title: "Security Audit (Admin)", icon: Lock,
    content: (
      <div className="space-y-3">
        <p>The <strong>Security Audit</strong> page (<code>/security-audit</code>) runs a full self-audit of the ProxhqVPN platform, checking for misconfigurations, weak settings, exposed endpoints, and known vulnerabilities in the installed software stack.</p>
        <h4 className="font-bold text-primary text-[11px]">What It Checks</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/70">
          {[
            "WireGuard key strength and rotation status",
            "Firewall rules completeness (default-deny, rate limiting)",
            "TLS certificate validity and cipher suites",
            "Open ports audit — unexpected services flagged",
            "Daemon PSK strength (entropy check)",
            "Admin password and session security",
            "Database exposure — ensures no DB ports are externally accessible",
            "Clerk auth configuration validity",
            "CORS configuration against known bypass techniques",
            "Content Security Policy headers audit",
          ].map(c => <div key={c}>• {c}</div>)}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Run</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/70">
          <li><span className="text-primary/30">1.</span> Click <strong>Run Self-Audit</strong>. Results appear in under 30 seconds.</li>
          <li><span className="text-primary/30">2.</span> Each finding is rated: <span className="text-green-400">PASS</span>, <span className="text-yellow-400">WARN</span>, or <span className="text-red-400">FAIL</span>.</li>
          <li><span className="text-primary/30">3.</span> Expand any finding for remediation instructions.</li>
          <li><span className="text-primary/30">4.</span> Re-run after making changes to verify fixes.</li>
        </ol>
      </div>
    ),
  },
  {
    id: "threatintel", title: "Threat Intelligence", icon: TrendingUp,
    content: (
      <div className="space-y-3">
        <p>The <strong>Threat Intel</strong> page (<code>/threat-intel</code>) provides IP reputation lookups, WHOIS queries, TLS certificate inspection, and real-time threat feed integration.</p>
        <div className="space-y-2">
          {[
            { t: "IP Reputation Check", d: "Query IP against AbuseIPDB, Shodan, GreyNoise, and VirusTotal. See abuse reports, open ports, and geolocation." },
            { t: "WHOIS Lookup", d: "Full WHOIS data for any IP or domain. Identifies registrar, registrant, nameservers, and abuse contacts." },
            { t: "TLS Certificate Inspector", d: "Check any domain's TLS certificate: issuer, expiry, cipher suite, HSTS policy, certificate transparency logs." },
            { t: "HTTP Headers Inspector", d: "Fetch and analyze HTTP response headers for a target. Checks for missing security headers (CSP, HSTS, X-Frame-Options)." },
            { t: "Threat Feeds", d: "Live feed of IPs flagged by Emerging Threats, Spamhaus, and ProxhqVPN's own SilkWeb trap network." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/50 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "subscription", title: "Subscription & Billing", icon: BarChart2,
    content: (
      <div className="space-y-3">
        <p>ProxhqVPN uses Stripe for subscription billing. Manage your plan from the <strong>Pricing</strong> page (<code>/pricing</code>) and your billing details from <strong>Account</strong> (<code>/account</code>).</p>
        <h4 className="font-bold text-primary text-[11px]">Plan Actions</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/70">
          <div>• <strong>Upgrade</strong> — click a plan tier → redirected to Stripe Checkout → payment processed securely</div>
          <div>• <strong>Downgrade</strong> — takes effect at end of current billing period</div>
          <div>• <strong>Cancel</strong> — click <strong>Manage Billing</strong> in Account → Stripe Customer Portal → Cancel subscription</div>
          <div>• <strong>Invoices</strong> — all invoices available in Account → Stripe Customer Portal</div>
        </div>
        <Note type="info">ProxhqVPN never stores your payment card details. All payment data is handled exclusively by Stripe's PCI-DSS Level 1 certified systems.</Note>
      </div>
    ),
  },
  {
    id: "account", title: "Account & Security Settings", icon: Key,
    content: (
      <div className="space-y-3">
        <p>Manage your ProxhqVPN account from the <strong>Account</strong> page (<code>/account</code>).</p>
        <div className="space-y-2">
          {[
            { t: "Profile", d: "Update display name, profile picture (via Clerk)." },
            { t: "Linked Accounts", d: "Add Google, GitHub, or other SSO providers to your account for passwordless login." },
            { t: "Rotate API Keys", d: "Rotate WireGuard keypairs or API access tokens. Old keys are immediately revoked." },
            { t: "Session Management", d: "View all active sessions (device type, location, last active). Revoke any session remotely." },
            { t: "Two-Factor Auth", d: "Enable TOTP 2FA (Google Authenticator, Authy) via Clerk's 2FA settings." },
            { t: "Data Export", d: "Request a full export of your ProxhqVPN data (configs, usage logs, account info)." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/50 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

export default function UserGuide() {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const active = SECTIONS.find(s => s.id === activeId) ?? SECTIONS[0];

  return (
    <div className="font-mono max-w-6xl">
      <div className="mb-5">
        <h1 className="text-lg font-bold tracking-widest uppercase text-primary flex items-center gap-2">
          <BookOpen className="w-5 h-5" /> ProxhqVPN — Complete User Guide
        </h1>
        <p className="text-xs text-primary/40 mt-1">
          Comprehensive instruction manual covering every feature, tool, and engine. By ALPHA UNLIMITED TECHNOLOGIES LLC.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar TOC */}
        <div className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-4 space-y-0.5 border border-primary/15 rounded p-2 bg-primary/3">
            <div className="text-[8px] font-mono text-primary/30 uppercase tracking-widest px-2 py-1">Table of Contents</div>
            {SECTIONS.map(s => {
              const Icon = s.icon;
              return (
                <button key={s.id} onClick={() => setActiveId(s.id)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors text-[9px] font-mono ${activeId === s.id ? "bg-primary/10 text-primary" : "text-primary/40 hover:text-primary/70 hover:bg-primary/5"}`}>
                  <Icon className="w-3 h-3 shrink-0" />
                  <span className="truncate">{s.title}</span>
                  {activeId === s.id && <ChevronRight className="w-2.5 h-2.5 ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mobile TOC */}
        <div className="lg:hidden w-full mb-4">
          <button onClick={() => setMobileMenuOpen(v => !v)}
            className="flex items-center gap-2 text-[10px] font-mono text-primary/60 border border-primary/20 px-3 py-2 rounded w-full">
            <BookOpen className="w-3.5 h-3.5" /> Contents: {active.title}
            <ChevronRight className={`w-3 h-3 ml-auto transition-transform ${mobileMenuOpen ? "rotate-90" : ""}`} />
          </button>
          {mobileMenuOpen && (
            <div className="border border-primary/15 rounded mt-1 p-2 space-y-0.5 bg-primary/3">
              {SECTIONS.map(s => {
                const Icon = s.icon;
                return (
                  <button key={s.id} onClick={() => { setActiveId(s.id); setMobileMenuOpen(false); }}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors text-[9px] font-mono ${activeId === s.id ? "bg-primary/10 text-primary" : "text-primary/40 hover:text-primary/70"}`}>
                    <Icon className="w-3 h-3 shrink-0" /> {s.title}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Content */}
        <div ref={contentRef} className="flex-1 min-w-0">
          <div className="border border-primary/15 rounded p-5 bg-primary/3">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-primary/15">
              {(() => { const Icon = active.icon; return <Icon className="w-4 h-4 text-primary/60" />; })()}
              <h2 className="text-sm font-bold text-primary tracking-widest uppercase">{active.title}</h2>
            </div>
            <div className="text-[10px] font-mono text-primary/70 leading-relaxed space-y-3">
              {active.content}
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            {(() => {
              const idx = SECTIONS.findIndex(s => s.id === activeId);
              const prev = SECTIONS[idx - 1];
              const next = SECTIONS[idx + 1];
              return (
                <>
                  {prev ? (
                    <button onClick={() => setActiveId(prev.id)}
                      className="flex items-center gap-2 text-[9px] font-mono text-primary/40 hover:text-primary border border-primary/15 hover:border-primary/30 px-3 py-2 rounded transition-colors">
                      ← {prev.title}
                    </button>
                  ) : <div />}
                  {next ? (
                    <button onClick={() => setActiveId(next.id)}
                      className="flex items-center gap-2 text-[9px] font-mono text-primary/40 hover:text-primary border border-primary/15 hover:border-primary/30 px-3 py-2 rounded transition-colors">
                      {next.title} →
                    </button>
                  ) : <div />}
                </>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
