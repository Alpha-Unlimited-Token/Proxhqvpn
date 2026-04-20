import { useState } from "react";
import { Globe, Copy, CheckCheck, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useGetSystemStats } from "@workspace/api-client-react";

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    toast({ title: "Copied to clipboard" });
  };
  return (
    <div className="relative">
      {label && <div className="text-[10px] font-mono text-primary/50 mb-1 uppercase tracking-widest">{label}</div>}
      <div className="bg-black border border-primary/20 rounded p-3 font-mono text-xs text-primary/90 whitespace-pre overflow-x-auto">
        {code}
      </div>
      <button
        onClick={copy}
        className="absolute top-2 right-2 text-primary/40 hover:text-primary transition-colors"
        title="Copy"
      >
        {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="bg-black border-primary/20">
      <CardHeader className="pb-0">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center justify-between w-full text-left group"
        >
          <CardTitle className="text-sm font-bold tracking-widest uppercase text-primary/80 group-hover:text-primary transition-colors">
            {title}
          </CardTitle>
          {open ? <ChevronDown className="w-4 h-4 text-primary/50" /> : <ChevronRight className="w-4 h-4 text-primary/50" />}
        </button>
      </CardHeader>
      {open && <CardContent className="pt-4 space-y-4">{children}</CardContent>}
    </Card>
  );
}

export default function ProxyConfig() {
  const { data: stats } = useGetSystemStats({ query: { refetchInterval: 10000 } });
  const externalIp = stats?.externalIp ?? "203.0.113.X";

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Globe className="w-6 h-6" />
        <h2 className="text-2xl font-bold tracking-tighter uppercase">Proxy / Tor / Multi-OS Setup</h2>
      </div>

      <div className="grid grid-cols-3 gap-4 text-xs font-mono">
        <div className="border border-primary/20 rounded p-3 bg-black">
          <div className="text-primary/50 mb-1">SOCKS5 PROXY HOST</div>
          <div className="text-primary font-bold">127.0.0.1</div>
        </div>
        <div className="border border-primary/20 rounded p-3 bg-black">
          <div className="text-primary/50 mb-1">SOCKS5 PORT</div>
          <div className="text-primary font-bold">1080</div>
        </div>
        <div className="border border-primary/20 rounded p-3 bg-black">
          <div className="text-primary/50 mb-1">TOR SOCKS5 PORT</div>
          <div className="text-primary font-bold">9050</div>
        </div>
      </div>

      <div className="space-y-3">

        <Section title="Tor Browser — Route All Traffic Through GhostNet" defaultOpen>
          <p className="text-xs text-primary/60 font-mono">
            Tor Browser uses SOCKS5 by default on port 9150 (browser bundle) or 9050 (Tor daemon). Chain GhostNet with Tor for double-layer anonymity.
          </p>
          <CodeBlock label="torrc — append to /etc/tor/torrc or ~/.torrc" code={`# GhostNet + Tor chaining
# Tor exits through your local SOCKS5 tunnel on port 1080
Socks5Proxy 127.0.0.1:1080

# Use Tor Browser's built-in port (9150) or system Tor (9050)
SocksPort 9050
SocksPort 127.0.0.1:9050

# Optional: enforce strict circuit isolation
IsolateDestAddr 1
IsolateDestPort 1`} />
          <CodeBlock label="Tor Browser — manual proxy settings" code={`Network Settings > Configure Proxy:
  Type      : SOCKS5
  Host      : 127.0.0.1
  Port      : 1080
  Proxy DNS : YES (check "Use proxy for DNS")`} />
          <p className="text-[10px] text-primary/40 font-mono">Traffic path: Your app → GhostNet SOCKS5 :1080 → 60-node mesh → Tor exit → destination</p>
        </Section>

        <Section title="Firefox — Proxy via GhostNet SOCKS5">
          <CodeBlock label="Firefox about:config (network.proxy.*)" code={`network.proxy.type              = 1    (manual)
network.proxy.socks             = 127.0.0.1
network.proxy.socks_port        = 1080
network.proxy.socks_version     = 5
network.proxy.socks_remote_dns  = true   ← prevents DNS leaks`} />
          <CodeBlock label="Or set environment variable before launch" code={`# Linux / macOS
ALL_PROXY=socks5h://127.0.0.1:1080 firefox

# Windows PowerShell
$env:ALL_PROXY="socks5h://127.0.0.1:1080"; Start-Process firefox`} />
        </Section>

        <Section title="Chrome / Chromium / Edge — Command-Line Proxy">
          <CodeBlock label="Launch with proxy flag" code={`# Linux / macOS
google-chrome --proxy-server="socks5://127.0.0.1:1080" --proxy-bypass-list="localhost,127.0.0.1"

# Windows
chrome.exe --proxy-server="socks5://127.0.0.1:1080"

# Also works for: chromium, microsoft-edge, brave-browser`} />
        </Section>

        <Section title="curl / wget — CLI Tools">
          <CodeBlock code={`# curl — all protocols
curl --socks5-hostname 127.0.0.1:1080 https://check.torproject.org/api/ip

# wget
wget -e "use_proxy = yes" -e "http_proxy = socks5://127.0.0.1:1080" https://example.com

# Environment variable approach (affects all tools)
export ALL_PROXY=socks5h://127.0.0.1:1080
export NO_PROXY=localhost,127.0.0.1`} />
        </Section>

        <Section title="Linux — System-Wide via proxychains-ng">
          <CodeBlock label="/etc/proxychains4.conf" code={`# GhostNet → Tor double-hop
strict_chain
proxy_dns

[ProxyList]
socks5  127.0.0.1  1080    # GhostNet entry
socks5  127.0.0.1  9050    # Tor (optional second hop)`} />
          <CodeBlock label="Run any app through the chain" code={`proxychains4 -f /etc/proxychains4.conf curl https://check.torproject.org/api/ip
proxychains4 -f /etc/proxychains4.conf nmap -sT -Pn scanme.nmap.org
proxychains4 -f /etc/proxychains4.conf ssh user@target`} />
        </Section>

        <Section title="macOS — System Network Proxy">
          <CodeBlock code={`# Apply via networksetup (requires sudo)
sudo networksetup -setsocksfirewallproxy Wi-Fi 127.0.0.1 1080
sudo networksetup -setsocksfirewallproxystate Wi-Fi on

# Verify
networksetup -getsocksfirewallproxy Wi-Fi

# Disable
sudo networksetup -setsocksfirewallproxystate Wi-Fi off`} />
        </Section>

        <Section title="Windows — System SOCKS5 Proxy">
          <CodeBlock label="PowerShell (per-session)" code={`[System.Net.WebRequest]::DefaultWebProxy = New-Object System.Net.WebProxy("socks5://127.0.0.1:1080")
$env:ALL_PROXY = "socks5://127.0.0.1:1080"`} />
          <CodeBlock label="netsh — Internet Explorer / legacy WinHTTP proxy" code={`netsh winhttp set proxy proxy-server="socks=127.0.0.1:1080" bypass-list="localhost;127.*"

# Reset
netsh winhttp reset proxy`} />
        </Section>

        <Section title="Android — WireGuard App (All Traffic)">
          <CodeBlock code={`# Install: F-Droid → WireGuard  or  Play Store → WireGuard
# Import the .conf file generated in WG CONFIG tab
# App → Import from file → ghostnet-android.conf
# Toggle: Excluded Applications (choose which bypass the tunnel)

# Enable: Apps → WireGuard → toggle the tunnel ON
# All TCP/UDP traffic now routes through GhostNet mesh`} />
        </Section>

        <Section title="iOS — WireGuard App">
          <CodeBlock code={`# Install: App Store → WireGuard
# Share the .conf QR code from WG CONFIG tab → scan with app
# Or: AirDrop / iCloud Drive the .conf file and open with WireGuard
# iOS Settings → VPN & Device Management → WireGuard tunnel shows here`} />
        </Section>

        <Section title="Port Knocking — Secfense Ghost-Mode Invisibility">
          <p className="text-xs text-primary/60 font-mono">
            GhostNet nodes use port knocking to remain invisible. Scan a node's IP and all ports appear CLOSED — the service only opens after the correct knock sequence.
          </p>
          <CodeBlock label="knockd config — /etc/knockd.conf on each node" code={`[options]
    logfile = /var/log/knockd.log
    interface = eth0

[ghostnet_open]
    sequence    = 7000,8000,9000
    seq_timeout = 5
    command     = /sbin/iptables -I INPUT -s %IP% -p tcp --dport 51820 -j ACCEPT
    tcpflags    = syn

[ghostnet_close]
    sequence    = 9000,8000,7000
    seq_timeout = 5
    command     = /sbin/iptables -D INPUT -s %IP% -p tcp --dport 51820 -j ACCEPT
    tcpflags    = syn`} />
          <CodeBlock label="Client-side knock sequence" code={`# Send the knock (Linux/macOS — using knock or nmap)
knock -v ${externalIp} 7000 8000 9000

# Or using nmap
nmap -Pn --host-timeout 201ms -p 7000 ${externalIp}; \\
nmap -Pn --host-timeout 201ms -p 8000 ${externalIp}; \\
nmap -Pn --host-timeout 201ms -p 9000 ${externalIp}

# WireGuard port (51820) is now temporarily open for your IP
# Connect within 5 seconds, then close:
knock -v ${externalIp} 9000 8000 7000`} />
          <CodeBlock label="iptables base rules — all ports closed by default" code={`# Drop all incoming by default
iptables -P INPUT DROP
iptables -P FORWARD DROP
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
iptables -A INPUT -i lo -j ACCEPT

# knockd must run to handle the knock sequences
systemctl enable --now knockd`} />
        </Section>

        <Section title="DNS Leak Prevention">
          <CodeBlock code={`# /etc/resolv.conf — use encrypted resolvers
nameserver 127.0.0.1          # dnscrypt-proxy listening locally
# OR
nameserver 1.1.1.1            # Cloudflare (fallback only)
nameserver 9.9.9.9            # Quad9

# dnscrypt-proxy — /etc/dnscrypt-proxy/dnscrypt-proxy.toml
listen_addresses = ['127.0.0.1:53']
server_names = ['cloudflare', 'quad9-dnscrypt-ip4-filter-ecs-pri']
require_nolog = true
require_nofilter = false
force_tcp = false

# Verify no leaks
curl --socks5-hostname 127.0.0.1:1080 https://dnsleaktest.com/`} />
        </Section>

        <Section title="Verify Your Anonymity">
          <CodeBlock code={`# Check exit IP through GhostNet
curl --socks5-hostname 127.0.0.1:1080 https://api.ipify.org?format=json

# Check Tor detection
curl --socks5-hostname 127.0.0.1:9050 https://check.torproject.org/api/ip

# DNS leak test
curl --socks5-hostname 127.0.0.1:1080 https://dns.google/resolve?name=whoami.akamai.net&type=A

# WebRTC leak (browser only — run in browser)
# Visit: https://browserleaks.com/webrtc  (should show no real IP)`} />
        </Section>

      </div>
    </div>
  );
}
