import { useState, useEffect, useRef } from "react";
import { PageSEO } from "@/components/PageSEO";
import {
  BookOpen, Wifi, Shield, Globe, Server, Terminal, Database,
  ScanSearch, Layers, Router, Cpu, Zap, EyeOff, GitBranch,
  Globe2, Activity, Network, Power, Search, ShieldPlus,
  ChevronRight, Bookmark, Copy, Check, AlertCircle, Info,
  Radio, Gamepad2, Tv, Smartphone, Monitor, Bug, FileText,
  Lock, Key, Settings, BarChart2, Bell, Map, TrendingUp,
  MapPin, Crosshair, Eye, Send, FolderSearch, Radar,
  Swords, Code2, GitCompare, ShieldAlert,
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
        <p>ProxhqVPN is a fully self-hosted, enterprise-grade VPN platform built by <strong>ALPHA UNLIMITED TECHNOLOGIES LLC</strong>. It combines WireGuard's modern cryptography (AES-256-GCM, ChaCha20-Poly1305) with double-hop routing via VPN Gate, a SilkWeb honeypot mesh for active threat detection, an integrated Alpha Toolkit for advanced security research, and automatic IP whitelisting to prevent lockouts.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {[
            { t: "WireGuard Core", d: "Modern VPN protocol with AES-256-GCM. Fastest and most secure available." },
            { t: "Double-Hop (VPN Gate)", d: "Route through community VPN Gate servers for an extra anonymity layer." },
            { t: "SilkWeb Honeypot Mesh", d: "Decoy network that lures, fingerprints, and blocks attackers in real time." },
            { t: "Alpha Toolkit", d: "Universal Scanner, Vuln Verifier, Web Scraper — all Tor-cloakable." },
            { t: "Kill Switch + Auto-IP", d: "Block all traffic if VPN drops. Your real IP is auto-detected and whitelisted so you never lose remote access." },
            { t: "Clerk Auth + Stripe", d: "Enterprise SSO authentication with integrated subscription billing." },
            { t: "Auto IP Whitelisting", d: "Platform detects your current IP at session start and pre-bakes it into iptables/pf/netsh rules and WireGuard PostUp hooks." },
            { t: "Router Config Generator", d: "One-click WireGuard configs for 6 router firmware platforms with your IP pre-embedded in the kill switch rules." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/15 rounded p-3">
              <div className="text-[10px] font-mono font-bold text-primary mb-0.5">{t}</div>
              <div className="text-[9px] text-primary/83 font-mono">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Plan Tiers</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { t: "VPN Basic", p: "$6.99/mo · $59.99/yr", d: "WireGuard VPN, Kill Switch, Leak Detection, DNS Protection, Smart DNS, Split Tunneling, VPN Gate double-hop, Onion Browser, Router Config." },
            { t: "Command Center Pro", p: "$39.99/mo · $349.99/yr", d: "Everything in Basic plus the full security toolkit: Alpha Toolkit, SQLmap Scanner, SilkWeb Honeypot, Firewall Manager, Threat Monitor, Remote Terminal, Security Audit, Threat Intelligence." },
          ].map(({ t, p, d }) => (
            <div key={t} className="border border-primary/20 rounded p-3 bg-primary/5">
              <div className="text-[11px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[10px] text-green-400 font-mono font-bold mb-1">{p}</div>
              <div className="text-[9px] text-primary/83 font-mono leading-relaxed">{d}</div>
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
        <p>The <strong>My VPN</strong> page (<code>/my-vpn</code>) is your main connection hub. It shows your active tunnel, public IP, protocol, and connection stats. It also auto-detects your current IP and displays a green confirmation banner.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Connect</h4>
        <ol className="space-y-2 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Go to <strong>My VPN</strong> in the sidebar.</li>
          <li><span className="text-primary/30">2.</span> A green banner confirms: <strong>"Your current IP detected"</strong> — this IP is automatically embedded in your WireGuard config's PostUp/PostDown iptables rules.</li>
          <li><span className="text-primary/30">3.</span> Select a server from the map or the server list. Servers are sorted by latency.</li>
          <li><span className="text-primary/30">4.</span> Click <strong>Connect</strong>. The status indicator changes from grey to green.</li>
          <li><span className="text-primary/30">5.</span> Your real IP is replaced with the VPN server's IP. Verify at <code>https://api64.ipify.org</code>.</li>
          <li><span className="text-primary/30">6.</span> To disconnect, click the red <strong>Disconnect</strong> button.</li>
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
              <span className="text-primary font-bold">{m}</span> — <span className="text-primary/83">{d}</span>
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
        <p>The <strong>WireGuard Config</strong> page (<code>/wireguard</code>) generates cryptographically-signed config files for any device. Generated configs now include <strong>automatic PostUp/PostDown IP whitelisting hooks</strong> so your remote access IP is never blocked when the kill switch activates.</p>
        <h4 className="font-bold text-primary text-[11px]">Generate a Config</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Your current IP is auto-detected and shown in a green banner.</li>
          <li><span className="text-primary/30">2.</span> Select a server location from the dropdown.</li>
          <li><span className="text-primary/30">3.</span> Choose DNS: ProxhqVPN DNS (default), Cloudflare, or system.</li>
          <li><span className="text-primary/30">4.</span> Click <strong>Generate</strong>. A config block appears with your IP embedded in PostUp/PostDown rules.</li>
          <li><span className="text-primary/30">5.</span> Click <strong>Download .conf</strong> for desktop/router or <strong>Show QR</strong> for mobile.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">Sample Config Structure (with Auto-IP Hooks)</h4>
        <CB label="wireguard config file with kill switch hooks (wg0.conf)">{`[Interface]
PrivateKey = <your-generated-private-key>
Address = 10.8.0.2/24
DNS = 1.1.1.1
PostUp   = iptables -I OUTPUT ! -o wg0 -m mark ! --mark $(wg show wg0 fwmark) -m addrtype ! --dst-type LOCAL -j REJECT
PostUp   = iptables -I OUTPUT -s YOUR_SAFE_IP/32 -j ACCEPT
PostUp   = iptables -I OUTPUT -d VPN_ENDPOINT_IP/32 -j ACCEPT
PostDown = iptables -D OUTPUT ! -o wg0 -m mark ! --mark $(wg show wg0 fwmark) -m addrtype ! --dst-type LOCAL -j REJECT
PostDown = iptables -D OUTPUT -s YOUR_SAFE_IP/32 -j ACCEPT
PostDown = iptables -D OUTPUT -d VPN_ENDPOINT_IP/32 -j ACCEPT

[Peer]
PublicKey = <proxhqvpn-server-public-key>
Endpoint = vpn.proxhqvpn.net:51820
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25`}</CB>
        <Note type="info">YOUR_SAFE_IP is automatically filled in from your detected IP. VPN_ENDPOINT_IP is the server's public IP — whitelisted so the WireGuard handshake always works even with the kill switch active.</Note>
        <h4 className="font-bold text-primary text-[11px] mt-3">Rotate Keys</h4>
        <p className="text-[10px] font-mono text-primary/83">Click <strong>Rotate Keys</strong> to generate a new keypair. Old configs are immediately invalidated — update all devices after rotating.</p>
      </div>
    ),
  },
  {
    id: "killswitch", title: "Kill Switch + Auto-IP", icon: Power,
    content: (
      <div className="space-y-3">
        <p>The <strong>Kill Switch</strong> (<code>/kill-switch</code>) blocks ALL internet traffic if the VPN tunnel drops, preventing IP leaks. It now includes <strong>Auto-IP Whitelisting</strong> — your current IP is detected automatically and pre-baked into the generated rules so you never lose remote access to your own machine.</p>
        <h4 className="font-bold text-primary text-[11px]">Auto-IP Detection</h4>
        <p className="text-[10px] font-mono text-primary/83">When you open the Kill Switch page, ProxhqVPN calls <code>/api/my-ip</code> and displays a green <strong>"SAFE IP AUTO-DETECTED"</strong> banner showing your current public IP. This IP is automatically embedded in all generated firewall rules.</p>
        <Note type="info">If you're on a dynamic IP, regenerate your kill switch rules after your IP changes. Your new IP will be auto-detected when you reload the page.</Note>
        <h4 className="font-bold text-primary text-[11px] mt-3">Platform Rules — Download</h4>
        <p className="text-[10px] font-mono text-primary/83">The Kill Switch page provides downloadable rule files for all three OS platforms, with your IP pre-baked in:</p>
        <div className="space-y-2">
          {[
            { t: "Linux (iptables)", d: "Download a .sh script that sets up iptables REJECT rules for all traffic outside wg0, while allowing your safe IP and the VPN endpoint." },
            { t: "macOS (pf firewall)", d: "Download a pf.conf snippet that blocks all non-VPN traffic. Includes an anchor rule allowing your IP to bypass the block." },
            { t: "Windows (netsh)", d: "Download a .bat script that sets Windows Firewall rules blocking all traffic except the WireGuard interface and your whitelisted IP." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How the Rules Work</h4>
        <CB label="linux kill switch rules (auto-generated with your ip)">{`# Block all outbound traffic NOT on wg0
iptables -I OUTPUT ! -o wg0 -m mark ! --mark $(wg show wg0 fwmark) -m addrtype ! --dst-type LOCAL -j REJECT

# Allow your safe IP (auto-detected) to bypass block
iptables -I OUTPUT -s YOUR_SAFE_IP/32 -j ACCEPT

# Allow VPN server endpoint IP (so handshake always works)
iptables -I OUTPUT -d VPN_ENDPOINT_IP/32 -j ACCEPT

# Allow local network traffic
iptables -I OUTPUT -o lo -j ACCEPT
iptables -I OUTPUT -d 192.168.0.0/16 -j ACCEPT`}</CB>
        <h4 className="font-bold text-primary text-[11px] mt-3">Enable Kill Switch</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Go to <strong>Kill Switch</strong> in the Protection section.</li>
          <li><span className="text-primary/30">2.</span> Confirm the green "SAFE IP AUTO-DETECTED" banner shows your correct IP.</li>
          <li><span className="text-primary/30">3.</span> Toggle <strong>Enable Kill Switch</strong> → Confirm.</li>
          <li><span className="text-primary/30">4.</span> The rules are applied. Status shows <span className="text-green-400">ACTIVE</span>.</li>
          <li><span className="text-primary/30">5.</span> To disable: toggle off and confirm — rules are flushed.</li>
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
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
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
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Enable DNS Protection</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
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
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
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
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• Route <strong>Netflix</strong> through VPN (US server) while banking app uses your real IP (avoids fraud flags).</div>
          <div>• Route all <strong>corporate traffic</strong> through VPN but let <strong>YouTube</strong> bypass it for speed.</div>
          <div>• Tunnel only <strong>torrent clients</strong> through VPN — everything else stays on your ISP connection.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Configuration</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
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
        <p className="text-[10px] font-mono text-primary/83">ProxhqVPN exposes a SOCKS5 proxy on port 1080 of the VPN server. Configure your browser or torrent client to use it:</p>
        <CB label="socks5 proxy settings">{`SOCKS5 Host: 10.8.0.1  (VPN server internal IP)
Port: 1080
Authentication: use your ProxhqVPN credentials

# In curl:
curl --socks5-hostname 10.8.0.1:1080 https://api64.ipify.org`}</CB>
        <h4 className="font-bold text-primary text-[11px] mt-3">Tor Integration (Ghost Chain)</h4>
        <p className="text-[10px] font-mono text-primary/83">ProxhqVPN runs a Tor daemon (127.0.0.1:9050). Traffic routed through Tor exits at a random Tor exit node — triple-hop: you → ProxhqVPN → Tor circuit → destination. This is referred to as <strong>Ghost Chain</strong> mode in the UI.</p>
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
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
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
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
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
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
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
        <p>The <strong>Router Config</strong> page (<code>/router-config</code>) generates platform-specific WireGuard configs for routers, protecting every device on your network automatically. Your current IP is auto-detected and embedded in the kill switch rules for each firmware.</p>
        <h4 className="font-bold text-primary text-[11px]">Supported Router Firmware</h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { f: "OpenWRT",         d: "opkg + luci-proto-wireguard" },
            { f: "DD-WRT",          d: "Built-in WireGuard module" },
            { f: "AsusWRT-Merlin",  d: "wg-quick via Entware" },
            { f: "pfSense / OPNsense", d: "VPN → WireGuard UI" },
            { f: "GL.iNet",         d: "Native WireGuard in GL admin panel" },
            { f: "Ubiquiti EdgeOS", d: "configure via set interfaces wireguard" },
          ].map(({ f, d }) => (
            <div key={f} className="text-[9px] font-mono border border-primary/10 rounded px-2 py-1.5">
              <div className="text-primary font-bold">✓ {f}</div>
              <div className="text-primary/78 mt-0.5">{d}</div>
            </div>
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
        <Note type="info">After running the Setup Script from the Router Config page, your router config includes your safe IP pre-baked into PostUp/PostDown rules so you never lose LAN access when the kill switch fires.</Note>
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
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
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
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Click <strong>Add Server</strong> → enter the server's IP, location, and label.</li>
          <li><span className="text-primary/30">2.</span> Click <strong>Get Setup Script</strong> — a bash script is generated for that server.</li>
          <li><span className="text-primary/30">3.</span> SSH into the server and run the script as root. It installs WireGuard, the ProxhqVPN daemon, and configures all firewall rules.</li>
          <li><span className="text-primary/30">4.</span> The server appears as <span className="text-green-400">Online</span> in the dashboard within 60 seconds.</li>
        </ol>
        <CB label="run on your new vps as root:">{`curl -s https://your-proxhqvpn-api/api/setup-script | bash`}</CB>
        <h4 className="font-bold text-primary text-[11px] mt-3">Server Actions</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
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
        <div className="space-y-2 text-[10px] font-mono text-primary/83">
          <div>1. SilkWeb traps listen on commonly-scanned ports (22, 80, 443, 3306, 5432, 6379, 27017).</div>
          <div>2. When an attacker connects, SilkWeb accepts the connection and logs every keystroke, payload, and command.</div>
          <div>3. The attacker's IP, fingerprint, and tools are captured and automatically added to the firewall blocklist.</div>
          <div>4. Advanced traps run nmap and SQLmap back against the attacker to identify their infrastructure.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Running a Port Scan on a Trapped IP</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
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
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Actions</h4>
        <p className="text-[10px] font-mono text-primary/83">For each alert: <strong>Dismiss</strong> (false positive), <strong>Block IP</strong> (add to firewall), or <strong>Investigate</strong> (run port scan, WHOIS, threat intel lookup).</p>
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
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
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
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
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
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
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
              <span className="text-primary/83">{desc}</span>
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
        <p>The <strong>Alpha Toolkit</strong> (<code>/alpha-tools</code>) provides three advanced security research engines with a seamless Scanner → Verifier pipeline, all optionally routed through Tor. Available to Command Center Pro subscribers and all employees.</p>

        <h4 className="font-bold text-primary text-[11px]">Tool 1 — Universal Scanner</h4>
        <p className="text-[10px] font-mono text-primary/83">Alpha Scanner v4.0 supports 35+ programming languages, 200+ vulnerability patterns, multi-step exploit chain detection, network port scanning, service fingerprinting, and secret/credential detection.</p>
        <div className="space-y-2">
          {[
            { m: "Network Scan", d: "Port scanning + service fingerprinting + banner grabbing via nmap integration." },
            { m: "Security Audit", d: "Scan source code or config files for hardcoded secrets, weak keys, misconfigs, exposed credentials." },
            { m: "Exploit Scan", d: "200+ vulnerability patterns: SQLi, XSS, SSTI, SSRF, path traversal, deserialization, RCE chains." },
            { m: "Full Scan", d: "Runs all three modes sequentially. Generates a comprehensive HTML report." },
          ].map(({ m, d }) => (
            <div key={m} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{m}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
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
        <p className="text-[10px] font-mono text-primary/83">The Verifier takes the Alpha Scanner HTML report and <strong>actively probes every finding against the live target</strong>. It performs TLS handshakes, TCP banner grabs, HTTP header analysis, SQL error probes, SSRF checks, and CDN false-positive filtering.</p>
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
        <p className="text-[10px] font-mono text-primary/83">Alpha Web Scraper runs entirely in the browser and stores everything in a local SQLite database. It captures pages, links, emails, phone numbers, OpenGraph metadata, JSON-LD structured data, forms, and file assets into 14 queryable tables.</p>
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
        <div className="text-[9px] font-mono text-primary/83 border border-primary/10 rounded px-3 py-2">
          Export all data as <strong>.sqlite</strong> (open in DB Browser for SQLite), <strong>CSV</strong> (per table), or <strong>JSON</strong>. Enable Tor Mode inside the scraper (top-right toggle) to route all fetch requests through Tor circuits.
        </div>

        <h4 className="font-bold text-primary text-[11px] mt-3">Global Tor Cloak</h4>
        <p className="text-[10px] font-mono text-primary/83">The <strong>Tor Cloak</strong> toggle at the top of the Alpha Toolkit page routes ALL tools (Scanner, Verifier, nmap, SQLmap) through the Tor daemon at 127.0.0.1:9050. The Tor badge shows your current exit IP — verify it's a Tor exit node before running any scans.</p>
      </div>
    ),
  },
  {
    id: "securityaudit", title: "Security Audit (Admin)", icon: Lock,
    content: (
      <div className="space-y-3">
        <p>The <strong>Security Audit</strong> page (<code>/security-audit</code>) runs a full self-audit of the ProxhqVPN platform, checking for misconfigurations, weak settings, exposed endpoints, and known vulnerabilities in the installed software stack.</p>
        <h4 className="font-bold text-primary text-[11px]">What It Checks</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
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
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
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
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "ipexposure", title: "IP Exposure Scanner", icon: Eye,
    content: (
      <div className="space-y-3">
        <p>The <strong>IP Exposure Scanner</strong> (<code>/ip-exposure</code>) shows you a full breakdown of what your current IP address reveals to websites, trackers, and monitoring systems. Available to all VPN Basic subscribers.</p>
        <h4 className="font-bold text-primary text-[11px]">What It Shows</h4>
        <div className="space-y-2">
          {[
            { t: "Public IP & Geolocation", d: "Your external IP with country, region, city, ISP name, and ASN — exactly what websites see when you connect." },
            { t: "VPN / Proxy Detection", d: "Whether your IP is flagged as a known VPN exit, proxy, or Tor exit node by third-party databases." },
            { t: "WebRTC Leak Test", d: "Checks if your browser leaks your real local IP via WebRTC, even when using a VPN." },
            { t: "DNS Leak Test", d: "Verifies that your DNS queries are routed through ProxhqVPN's encrypted DNS, not your ISP's servers." },
            { t: "Browser Fingerprint Risk", d: "Checks canvas fingerprint, user-agent, timezone, and language consistency against your apparent location." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Using IP Exposure Scanner</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Go to <strong>IP Exposure</strong> — the scan runs automatically on page load.</li>
          <li><span className="text-primary/30">2.</span> If you see a <span className="text-red-400">LEAK DETECTED</span> badge, follow the remediation steps shown on screen.</li>
          <li><span className="text-primary/30">3.</span> Enable <strong>Kill Switch</strong> and ensure your WireGuard connection is active to resolve most leak types.</li>
          <li><span className="text-primary/30">4.</span> Use the <strong>DNS Shield</strong> page to fix DNS leak issues specifically.</li>
        </ol>
        <Note type="info">Run the IP Exposure Scanner before and after connecting to ProxhqVPN to verify your IP is properly masked.</Note>
      </div>
    ),
  },
  {
    id: "httprobe", title: "HTTP Probe", icon: Send,
    content: (
      <div className="space-y-3">
        <p>The <strong>HTTP Probe</strong> (<code>/http-probe</code>) is a full-featured HTTP client for crafting and sending custom HTTP requests. It is equivalent to Burp Suite Repeater and is available to Command Center Pro subscribers.</p>
        <h4 className="font-bold text-primary text-[11px]">Key Features</h4>
        <div className="space-y-2">
          {[
            { t: "Custom Headers", d: "Set any request header including Authorization, Content-Type, Cookie, X-Forwarded-For, and custom headers." },
            { t: "All HTTP Methods", d: "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, CONNECT, TRACE." },
            { t: "Body Editors", d: "Switch between raw text, JSON, form data, XML, and binary body types with syntax highlighting." },
            { t: "Response Inspector", d: "View response status, headers, body, timing, and size. Syntax-highlighted JSON and HTML responses." },
            { t: "Tor Routing", d: "Toggle to route requests through Tor SOCKS5 to hide your probe origin." },
            { t: "Request History", d: "All requests logged locally. Re-send, modify, or compare any previous request." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <Note type="danger">Only probe targets you own or have explicit written authorization to test. Unauthorized HTTP probing may violate the CFAA and similar laws.</Note>
      </div>
    ),
  },
  {
    id: "dirfuzzer", title: "Directory Fuzzer", icon: FolderSearch,
    content: (
      <div className="space-y-3">
        <p>The <strong>Directory Fuzzer</strong> (<code>/dir-fuzzer</code>) brute-forces hidden files and directories on web servers using customizable wordlists. Equivalent to ffuf or gobuster. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">How to Run a Directory Fuzz</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Enter the target URL (e.g. <code>https://target.com/</code>).</li>
          <li><span className="text-primary/30">2.</span> Choose a wordlist: <strong>Common</strong> (admin panels, backups), <strong>API Routes</strong>, <strong>Git/Config Files</strong>, or upload a custom list.</li>
          <li><span className="text-primary/30">3.</span> Set the file extensions to append (e.g. <code>.php, .bak, .old, .zip</code>).</li>
          <li><span className="text-primary/30">4.</span> Set the thread count and delay. Higher threads = faster but more detectable.</li>
          <li><span className="text-primary/30">5.</span> Toggle <strong>Tor Mode</strong> to route requests anonymously.</li>
          <li><span className="text-primary/30">6.</span> Click <strong>Start Fuzz</strong> — discovered paths stream in real-time.</li>
        </ol>
        <Note type="warn">Fuzzing sends hundreds or thousands of requests per minute. This may trigger WAFs, rate limiting, or alert the target's monitoring systems.</Note>
      </div>
    ),
  },
  {
    id: "subdomains", title: "Subdomain Scout", icon: Radar,
    content: (
      <div className="space-y-3">
        <p>The <strong>Subdomain Scout</strong> (<code>/subdomain-scan</code>) enumerates subdomains of a target domain using multiple passive and active techniques. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">Enumeration Methods</h4>
        <div className="space-y-2">
          {[
            { t: "Certificate Transparency (CT Logs)", d: "Query crt.sh and other CT log aggregators for every SSL certificate ever issued for the domain. Purely passive — never touches the target." },
            { t: "DNS Brute-Force", d: "Send DNS resolution requests for common subdomain patterns (www, api, dev, staging, mail, cdn, etc.)." },
            { t: "Reverse DNS / ASN Lookup", d: "Identify all IPs owned by the target's ASN and attempt reverse DNS resolution to find additional hosts." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Export Results</h4>
        <p className="text-[10px] font-mono text-primary/83">Export discovered subdomains as a plain text list or JSON. Send directly to the Security Audit tool for a quick TLS/header check across all found domains.</p>
        <Note type="info">CT log enumeration is always anonymous — it never contacts the target domain. DNS brute-force sends packets to your DNS resolver, not to the target directly.</Note>
      </div>
    ),
  },
  {
    id: "intruder", title: "Intruder", icon: Swords,
    content: (
      <div className="space-y-3">
        <p>The <strong>Intruder</strong> (<code>/intruder</code>) automates parameter fuzzing across multiple payload sets. Modeled after Burp Intruder — inject payloads at any marked position in a request template. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">Attack Modes</h4>
        <div className="space-y-2">
          {[
            { t: "Sniper", d: "One payload set. Injects each payload into one position at a time, cycling through all positions sequentially. Best for single-parameter fuzzing." },
            { t: "Battering Ram", d: "One payload set. Injects the same payload into all marked positions simultaneously. Good for testing multi-parameter forms." },
            { t: "Pitchfork", d: "Multiple payload sets (one per position). Iterates all sets in parallel — position 1 gets payload 1[n], position 2 gets payload 2[n]." },
            { t: "Cluster Bomb", d: "Multiple payload sets. Tries every combination of all payloads across all positions. Highest coverage, highest request count." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Using Intruder</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Paste a raw HTTP request or set a base URL + params.</li>
          <li><span className="text-primary/30">2.</span> Mark injection positions with <code>§ § </code> delimiters.</li>
          <li><span className="text-primary/30">3.</span> Load a payload list (paste custom list, use a built-in wordlist, or pull from Payload Generator).</li>
          <li><span className="text-primary/30">4.</span> Set concurrency and delay. Enable Tor for anonymous fuzzing.</li>
          <li><span className="text-primary/30">5.</span> Click <strong>Start Attack</strong>. Filter results by response length, status code, or keywords to find anomalies.</li>
        </ol>
        <Note type="danger">Intruder can send thousands of requests quickly. Only use on targets you are authorized to test.</Note>
      </div>
    ),
  },
  {
    id: "encoder", title: "Encoder / Decoder", icon: Code2,
    content: (
      <div className="space-y-3">
        <p>The <strong>Encoder</strong> (<code>/encoder</code>) provides encoding, decoding, and hashing utilities essential for security testing and development. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">Supported Transforms</h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { cat: "Encoding", items: ["Base64 (encode/decode)", "URL encode/decode", "HTML entity encode/decode", "Hex encode/decode", "Binary (UTF-8 ↔ binary)"] },
            { cat: "Cryptography", items: ["MD5 hash", "SHA-1 / SHA-256 / SHA-512", "HMAC-SHA256 (with key)", "bcrypt hash (cost factor)", "JWT decode (header + payload)"] },
          ].map(({ cat, items }) => (
            <div key={cat} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary mb-1">{cat}</div>
              {items.map(i => <div key={i} className="text-[9px] font-mono text-primary/83">• {i}</div>)}
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Smart Detect</h4>
        <p className="text-[10px] font-mono text-primary/83">Paste any string and click <strong>Auto-Detect</strong> — the encoder identifies the encoding format and decodes it automatically. Useful for analyzing encoded payloads in HTTP responses or JWT tokens.</p>
      </div>
    ),
  },
  {
    id: "comparer", title: "Request Comparer", icon: GitCompare,
    content: (
      <div className="space-y-3">
        <p>The <strong>Request Comparer</strong> (<code>/comparer</code>) shows a side-by-side diff of two HTTP requests or responses. Equivalent to Burp Comparer. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">Use Cases</h4>
        <div className="space-y-2">
          {[
            { t: "Auth Bypass Detection", d: "Compare an authenticated request and an unauthenticated request — if responses are identical, the endpoint lacks proper auth enforcement." },
            { t: "IDOR Verification", d: "Compare two responses with different user IDs in the parameter — identical data indicates an IDOR vulnerability." },
            { t: "WAF Bypass Testing", d: "Compare a raw payload response vs a tampered payload response to confirm WAF evasion is working." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Diff Modes</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Words</strong> — highlight individual changed words</div>
          <div>• <strong>Lines</strong> — highlight full changed lines (good for raw HTTP)</div>
          <div>• <strong>Bytes</strong> — byte-level diff for binary responses</div>
          <div>• <strong>Ignore</strong> — optionally ignore headers, timestamps, session IDs</div>
        </div>
      </div>
    ),
  },
  {
    id: "payloads", title: "Payload Generator", icon: Bug,
    content: (
      <div className="space-y-3">
        <p>The <strong>Payload Generator</strong> (<code>/payloads</code>) provides categorized, ready-to-use attack payloads for security testing. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">Payload Categories</h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { cat: "Injection", items: ["SQL Injection (MySQL, Postgres, MSSQL, Oracle)", "XSS (reflected, stored, DOM, polyglots)", "Server-Side Template Injection (SSTI)", "LDAP Injection", "Command Injection"] },
            { cat: "Server-Side", items: ["SSRF (localhost, cloud metadata endpoints)", "XXE (XML External Entity)", "Path Traversal / LFI", "Deserialization (Java, PHP, Python)", "RCE via Log4j"] },
            { cat: "Evasion", items: ["WAF bypass variants (encoding, case mangling)", "Filter bypass payloads", "Null byte injection", "Unicode normalization attacks"] },
            { cat: "Recon", items: ["Wordlists (admin, backup, API, upload dirs)", "Common credential pairs", "Default password lists", "JWT secret brute-force lists"] },
          ].map(({ cat, items }) => (
            <div key={cat} className="border border-primary/10 rounded px-2.5 py-2">
              <div className="text-[10px] font-mono font-bold text-primary mb-1">{cat}</div>
              {items.map(i => <div key={i} className="text-[9px] font-mono text-primary/83">• {i}</div>)}
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Sending Payloads to Other Tools</h4>
        <p className="text-[10px] font-mono text-primary/83">Click <strong>Send to HTTP Probe</strong> to test a payload directly, or <strong>Send to Intruder</strong> to use the payload list as input for an automated attack run.</p>
      </div>
    ),
  },
  {
    id: "cvesearch", title: "CVE Lookup", icon: ShieldAlert,
    content: (
      <div className="space-y-3">
        <p>The <strong>CVE Lookup</strong> (<code>/cve-search</code>) lets you search the NVD (National Vulnerability Database) and other CVE sources directly from the Command Center. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">Search Modes</h4>
        <div className="space-y-2">
          {[
            { t: "CVE ID Lookup", d: "Enter a CVE ID (e.g. CVE-2021-44228) to pull the full description, CVSS score, affected versions, and available patches." },
            { t: "Keyword Search", d: "Search by software name, vendor, or vulnerability type (e.g. 'Apache Log4j', 'WordPress plugin RCE', 'OpenSSL buffer overflow')." },
            { t: "CVSS Score Filter", d: "Filter results by CVSS score — focus on Critical (9.0–10.0) or High (7.0–8.9) vulnerabilities only." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">CVSS Score Reference</h4>
        <div className="space-y-1.5 text-[9px] font-mono">
          {[["9.0 – 10.0", "Critical", "text-red-400"], ["7.0 – 8.9", "High", "text-orange-400"], ["4.0 – 6.9", "Medium", "text-yellow-400"], ["0.1 – 3.9", "Low", "text-green-400"]].map(([range, level, color]) => (
            <div key={range} className="flex gap-3 items-center">
              <span className="text-primary/83 w-24">{range}</span>
              <span className={`font-bold ${color}`}>{level}</span>
            </div>
          ))}
        </div>
        <Note type="info">CVE data is pulled live from the NVD API. Results may take 2–3 seconds for high-volume keyword searches. Results are not cached.</Note>
      </div>
    ),
  },
  {
    id: "subscription", title: "Subscription & Billing", icon: BarChart2,
    content: (
      <div className="space-y-3">
        <p>ProxhqVPN uses Stripe for subscription billing. Manage your plan from the <strong>Pricing</strong> page (<code>/pricing</code>) and your billing details from <strong>Account</strong> (<code>/account</code>). The Pricing page is publicly accessible — no login needed to compare plans.</p>
        <h4 className="font-bold text-primary text-[11px]">Plan Pricing</h4>
        <div className="space-y-2">
          {[
            { t: "VPN Basic", p: "$6.99/mo — $59.99/yr", d: "WireGuard VPN, kill switch, leak test, DNS shield, smart DNS, split tunneling, VPN Gate, onion browser, router config." },
            { t: "Command Center Pro", p: "$39.99/mo — $349.99/yr", d: "Everything in Basic plus Alpha Toolkit, SQLmap, SilkWeb honeypot, firewall manager, threat monitor, terminal, security audit, threat intel." },
          ].map(({ t, p, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t} <span className="text-green-400 ml-1">{p}</span></div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Plan Actions</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Upgrade</strong> — click a plan tier → redirected to Stripe Checkout → payment processed securely</div>
          <div>• <strong>Downgrade</strong> — takes effect at end of current billing period</div>
          <div>• <strong>Cancel</strong> — click <strong>Manage Billing</strong> in Account → Stripe Customer Portal → Cancel subscription</div>
          <div>• <strong>Invoices</strong> — all invoices available in Account → Stripe Customer Portal</div>
          <div>• <strong>Ambassador Promo Code</strong> — enter at checkout for a 10% discount and to support your chosen ambassador</div>
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
            { t: "Two-Factor Authentication", d: "Enable TOTP 2FA via Clerk. Supported by Google Authenticator, Authy, 1Password." },
            { t: "Manage Billing", d: "Opens the Stripe Customer Portal — change plan, update card, view invoices, or cancel." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "ambassador", title: "Ambassador Program", icon: TrendingUp,
    content: (
      <div className="space-y-3">
        <p>The <strong>Ambassador Program</strong> lets content creators, security researchers, and ProxhqVPN enthusiasts earn <strong>10% commission</strong> on every subscription referred through their unique promo code.</p>
        <h4 className="font-bold text-primary text-[11px]">How It Works</h4>
        <div className="space-y-2">
          {[
            { step: "1", t: "Apply", d: "Visit Ambassadors → Apply Now. Fill in your display name, bio, promo code, and social links. Applications are reviewed within 24–48 hours." },
            { step: "2", t: "Get Approved", d: "Once approved, your public profile goes live on the Ambassadors page. You can add YouTube/Vimeo tutorial videos at any time from your dashboard." },
            { step: "3", t: "Share Your Code", d: "Share your unique promo code with your audience. When someone enters it at checkout, they get recognized as your referral." },
            { step: "4", t: "Earn Commission", d: "You earn 10% of every subscription payment made by your referred subscribers — monthly and annual. Tracked live in your Ambassador Dashboard." },
          ].map(({ step, t, d }) => (
            <div key={step} className="border border-primary/10 rounded px-3 py-2 flex gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-mono font-bold flex items-center justify-center shrink-0">{step}</div>
              <div>
                <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
                <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
              </div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Ambassador Dashboard Features</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Promo Code Display</strong> — large, easy-to-copy promo code with one-click clipboard copy</div>
          <div>• <strong>Live Stats</strong> — total referrals, total earned, pending payout, video count</div>
          <div>• <strong>Video Management</strong> — add/remove YouTube or Vimeo tutorial links anytime</div>
          <div>• <strong>Bio Editor</strong> — edit your public profile bio in-place</div>
          <div>• <strong>Referral History</strong> — line-by-line breakdown of each referred subscriber and commission earned</div>
        </div>
        <Note type="info">Your ambassador profile page is public — it can be found at <code>/ambassadors</code> by anyone browsing the site, whether or not they are logged in.</Note>
      </div>
    ),
  },
];

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function UserGuide() {
  const [active, setActive] = useState("overview");
  const [search, setSearch] = useState("");
  const contentRef = useRef<HTMLDivElement>(null);

  const filtered = search
    ? SECTIONS.filter(s =>
        s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.id.toLowerCase().includes(search.toLowerCase())
      )
    : SECTIONS;

  useEffect(() => {
    if (contentRef.current) contentRef.current.scrollTop = 0;
  }, [active]);

  const current = SECTIONS.find(s => s.id === active) ?? SECTIONS[0];

  return (
    <div className="flex gap-0 h-[calc(100vh-4rem)] -mx-6 -my-6 overflow-hidden">
      <PageSEO
        title="User Guide & Documentation — ProxhqVPN"
        description="Complete documentation for ProxhqVPN — WireGuard setup, kill switch, leak testing, router configs, Alpha Toolkit, SilkWeb honeypot, ambassador program, and billing. Self-hosted VPN by ALPHA UNLIMITED TECHNOLOGIES LLC."
        path="/guide"
      />

      {/* Sidebar */}
      <aside className="w-52 shrink-0 border-r border-primary/10 bg-black overflow-y-auto flex flex-col">
        <div className="px-3 py-3 border-b border-primary/10 shrink-0">
          <div className="text-[9px] font-mono font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <BookOpen className="w-3 h-3" /> User Guide
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search docs…"
            className="w-full bg-black border border-primary/15 text-primary text-[9px] font-mono px-2 py-1 focus:outline-none focus:border-primary/40 rounded"
          />
        </div>
        <nav className="flex-1 py-2">
          {filtered.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => { setActive(s.id); setSearch(""); }}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 text-[10px] font-mono transition-colors ${
                  active === s.id
                    ? "bg-primary/10 text-primary border-r-2 border-primary"
                    : "text-primary/78 hover:text-primary hover:bg-primary/5"
                }`}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <span className="truncate">{s.title}</span>
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-primary/10 shrink-0">
          <div className="text-[8px] font-mono text-primary/83 leading-relaxed">
            ProxhqVPN v2.0<br />
            ALPHA UNLIMITED TECHNOLOGIES LLC<br />
            <a href="mailto:support@proxhqvpn.com" className="text-primary/78 hover:text-primary">support@proxhqvpn.com</a>
          </div>
        </div>
      </aside>

      {/* Content */}
      <div ref={contentRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
          {/* Header */}
          <div className="flex items-center gap-2 text-[9px] font-mono text-primary/78">
            <BookOpen className="w-3 h-3 text-primary" />
            <ChevronRight className="w-2 h-2" />
            <span className="text-primary">{current.title}</span>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <current.icon className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-primary tracking-tight">{current.title}</h1>
              <div className="text-[9px] font-mono text-primary/78">ProxhqVPN Documentation</div>
            </div>
          </div>

          <div className="border-t border-primary/10 pt-4 text-[10px] font-mono text-primary/88 leading-relaxed space-y-2">
            {current.content}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-6 border-t border-primary/10">
            {(() => {
              const idx = SECTIONS.findIndex(s => s.id === active);
              const prev = SECTIONS[idx - 1];
              const next = SECTIONS[idx + 1];
              return (
                <>
                  {prev ? (
                    <button onClick={() => setActive(prev.id)}
                      className="flex items-center gap-1 text-[9px] font-mono text-primary/78 hover:text-primary transition-colors">
                      ← {prev.title}
                    </button>
                  ) : <div />}
                  {next ? (
                    <button onClick={() => setActive(next.id)}
                      className="flex items-center gap-1 text-[9px] font-mono text-primary/78 hover:text-primary transition-colors">
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
