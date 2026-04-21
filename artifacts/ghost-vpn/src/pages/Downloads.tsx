import { useState } from "react";
import {
  Monitor, Smartphone, Tv, Router, Download, CheckCircle,
  ChevronDown, ChevronUp, AlertCircle, ExternalLink, Cpu,
  Tablet, Radio, Gamepad2, Globe, Wifi, Copy, Check,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); };
  return (
    <button onClick={copy} className="ml-2 text-primary/30 hover:text-primary transition-colors">
      {done ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function Code({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center font-mono text-[10px] bg-black border border-primary/20 px-2 py-0.5 rounded text-primary/80">
      {children}<CopyBtn text={children} />
    </span>
  );
}

function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <div className="mt-2 mb-1">
      {label && <div className="text-[8px] text-primary/30 font-mono uppercase tracking-widest mb-1">{label}</div>}
      <pre className="relative group font-mono text-[10px] bg-black border border-primary/15 rounded p-3 text-primary/70 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {children}
        <button onClick={() => navigator.clipboard.writeText(children)}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-primary/30 hover:text-primary">
          <Copy className="w-3 h-3" />
        </button>
      </pre>
    </div>
  );
}

interface Step { text: string; code?: string; note?: string }
interface PlatformCard {
  id: string; name: string; os?: string; tag?: string;
  icon: React.ElementType; badge: string; badgeColor: string;
  downloadUrl?: string; downloadLabel?: string;
  steps: Step[];
  note?: string;
  fireStick?: boolean;
}

const PLATFORMS: { group: string; icon: React.ElementType; color: string; items: PlatformCard[] }[] = [
  {
    group: "DESKTOP & LAPTOP", icon: Monitor, color: "text-blue-400",
    items: [
      {
        id: "windows", name: "Windows", os: "Windows 10 / 11",
        icon: Monitor, badge: "WireGuard", badgeColor: "text-blue-400 border-blue-500/30 bg-blue-900/10",
        downloadUrl: "https://download.wireguard.com/windows-client/wireguard-installer.exe",
        downloadLabel: "Download WireGuard Installer (.exe)",
        steps: [
          { text: "Download and run the WireGuard installer above." },
          { text: "Open WireGuard → click the ▾ arrow next to Add Tunnel → Import tunnel(s) from file or Add empty tunnel." },
          { text: "In ProxhqVPN, go to WireGuard Config → Generate a new config → Download .conf file." },
          { text: "Drag the .conf file into the WireGuard window, or paste the config text into an empty tunnel." },
          { text: "Click Activate. The status indicator turns green — you're connected." },
          { text: "Confirm your IP changed:", code: "curl https://api64.ipify.org" },
        ],
        note: "WireGuard runs as a Windows service. You can configure it to auto-connect at login via the WireGuard UI.",
      },
      {
        id: "macos", name: "macOS", os: "macOS 12+",
        icon: Monitor, badge: "App Store", badgeColor: "text-gray-400 border-gray-500/30 bg-gray-900/10",
        downloadUrl: "https://apps.apple.com/us/app/wireguard/id1451685025",
        downloadLabel: "Download WireGuard on Mac App Store",
        steps: [
          { text: "Install WireGuard from the Mac App Store (link above)." },
          { text: "In ProxhqVPN → WireGuard Config → Generate → Download .conf file." },
          { text: "In WireGuard → Import tunnel(s) from file → select your .conf." },
          { text: "Click Allow when macOS asks for VPN permission." },
          { text: "Click Activate — look for the WireGuard icon in the menu bar." },
          { text: "Verify:", code: "curl https://api64.ipify.org" },
        ],
      },
      {
        id: "linux", name: "Linux", os: "Ubuntu / Debian / Fedora / Arch",
        icon: Monitor, badge: "wg-quick", badgeColor: "text-orange-400 border-orange-500/30 bg-orange-900/10",
        steps: [
          { text: "Install WireGuard:", code: "sudo apt install wireguard   # Ubuntu/Debian" },
          { text: "Or Fedora/RHEL:", code: "sudo dnf install wireguard-tools" },
          { text: "Or Arch:", code: "sudo pacman -S wireguard-tools" },
          { text: "Generate your config from ProxhqVPN → WireGuard Config → Download .conf." },
          { text: "Move it:", code: "sudo mv ~/Downloads/proxhq-wg0.conf /etc/wireguard/wg0.conf" },
          { text: "Connect:", code: "sudo wg-quick up wg0" },
          { text: "Auto-start on boot:", code: "sudo systemctl enable --now wg-quick@wg0" },
          { text: "Check status:", code: "sudo wg show" },
        ],
      },
      {
        id: "chromebook", name: "Chromebook", os: "ChromeOS",
        icon: Monitor, badge: "Linux (Crostini)", badgeColor: "text-green-400 border-green-500/30 bg-green-900/10",
        steps: [
          { text: "Enable Linux: Settings → Advanced → Developers → Linux development environment → Turn On." },
          { text: "In the Linux terminal:", code: "sudo apt update && sudo apt install wireguard" },
          { text: "Download your ProxhqVPN config from WireGuard Config page." },
          { text: "Move to Linux files and connect:", code: "sudo wg-quick up /path/to/proxhq.conf" },
        ],
        note: "Requires ChromeOS 73+ with Linux (Beta) enabled.",
      },
    ],
  },
  {
    group: "MOBILE PHONES & TABLETS", icon: Smartphone, color: "text-green-400",
    items: [
      {
        id: "android", name: "Android", os: "Android 7+",
        icon: Smartphone, badge: "Google Play", badgeColor: "text-green-400 border-green-500/30 bg-green-900/10",
        downloadUrl: "https://play.google.com/store/apps/details?id=com.wireguard.android",
        downloadLabel: "WireGuard on Google Play",
        steps: [
          { text: "Install WireGuard from Google Play (link above)." },
          { text: "In ProxhqVPN → WireGuard Config → Generate config → show QR Code." },
          { text: "In WireGuard app → tap the + icon → Scan from QR code." },
          { text: "Scan the QR code — the tunnel is imported automatically." },
          { text: "Tap the toggle to connect. Android shows a key icon in the status bar." },
          { text: "Optional: tap the tunnel → tap the pencil → enable On-demand activation for always-on VPN." },
        ],
        note: "Android 10+ supports always-on VPN with block connections without VPN in network settings.",
      },
      {
        id: "iphone", name: "iPhone & iPad", os: "iOS 14+ / iPadOS 14+",
        icon: Smartphone, badge: "App Store", badgeColor: "text-blue-400 border-blue-500/30 bg-blue-900/10",
        downloadUrl: "https://apps.apple.com/us/app/wireguard/id1441195209",
        downloadLabel: "WireGuard on the App Store",
        steps: [
          { text: "Install WireGuard from the App Store (link above)." },
          { text: "In ProxhqVPN → WireGuard Config → Generate config → show QR Code." },
          { text: "In WireGuard app → tap + → Create from QR code." },
          { text: "Scan the QR and tap Allow when iOS requests VPN permission." },
          { text: "Toggle the tunnel on. Look for the VPN indicator in the iOS status bar." },
          { text: "For always-on: Settings → General → VPN & Device Management → VPN → Connect On Demand." },
        ],
      },
      {
        id: "android-tablet", name: "Android Tablet", os: "Android 7+ (Samsung, Lenovo, etc.)",
        icon: Tablet, badge: "Google Play", badgeColor: "text-green-400 border-green-500/30 bg-green-900/10",
        downloadUrl: "https://play.google.com/store/apps/details?id=com.wireguard.android",
        downloadLabel: "WireGuard on Google Play",
        steps: [
          { text: "Install WireGuard from Google Play — identical to Android phone setup." },
          { text: "Use QR code import from ProxhqVPN → WireGuard Config for easiest setup." },
          { text: "Toggle to connect. Tablets show the VPN key icon in the status bar." },
        ],
      },
    ],
  },
  {
    group: "AMAZON FIRE DEVICES", icon: Tv, color: "text-orange-400",
    items: [
      {
        id: "firestick", name: "Amazon Fire Stick", os: "Fire OS 5+ (4K, 4K Max, Lite, 3rd gen+)",
        icon: Tv, badge: "Sideload APK", badgeColor: "text-orange-400 border-orange-500/30 bg-orange-900/10",
        fireStick: true,
        steps: [
          { text: "Enable apps from unknown sources: Settings → My Fire TV → Developer Options → Apps from Unknown Sources → ON." },
          { text: "Install Downloader from the Amazon Appstore (search: Downloader by AFTVnews)." },
          { text: "Open Downloader → enter this URL to download the WireGuard APK:", code: "https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk" },
          { text: "Tap Install when prompted — allow the installation." },
          { text: "Go back to the Fire Stick home screen. Find WireGuard under Recent or Your Apps & Games." },
          { text: "In ProxhqVPN → WireGuard Config → Generate config → Download .conf file to a cloud service (Google Drive / Dropbox)." },
          { text: "In WireGuard on Fire Stick → tap + → Import from file → navigate to your downloaded .conf." },
          { text: "Alternatively, on another device, tap QR and scan with a phone → share the text and manually type the config." },
          { text: "Toggle the tunnel to connect. Fire Stick will show a VPN key icon." },
        ],
        note: "Fire Stick uses Android under the hood (Fire OS). The WireGuard Android APK works natively. No rooting needed.",
      },
      {
        id: "firetv", name: "Amazon Fire TV Cube", os: "Fire OS 7+",
        icon: Tv, badge: "Sideload APK", badgeColor: "text-orange-400 border-orange-500/30 bg-orange-900/10",
        steps: [
          { text: "Same process as Fire Stick above — Fire TV Cube also runs Fire OS." },
          { text: "Additionally, you can sideload via ADB over WiFi:", code: "adb connect FIRETV_IP:5555\nadb install wireguard.apk" },
          { text: "Find your Fire TV IP at Settings → My Fire TV → About → Network." },
          { text: "Enable ADB: Settings → My Fire TV → Developer Options → ADB Debugging → ON." },
        ],
      },
    ],
  },
  {
    group: "SMART TVs & STREAMING BOXES", icon: Tv, color: "text-purple-400",
    items: [
      {
        id: "androidtv", name: "Android TV / Google TV", os: "Android TV 8+ (Sony, Philips, TCL, Nvidia Shield, Chromecast with Google TV)",
        icon: Tv, badge: "Google Play", badgeColor: "text-green-400 border-green-500/30 bg-green-900/10",
        downloadUrl: "https://play.google.com/store/apps/details?id=com.wireguard.android",
        downloadLabel: "WireGuard on Google Play (TV)",
        steps: [
          { text: "Open Google Play on your Android TV and search for WireGuard." },
          { text: "Install WireGuard — it has a full TV-optimized interface." },
          { text: "In ProxhqVPN → WireGuard Config → Generate → Download .conf to Google Drive." },
          { text: "On Android TV, open a file manager (FX File Explorer works well) or install Downloader." },
          { text: "Import the .conf from your cloud storage into WireGuard." },
          { text: "Toggle the tunnel ON. Look for the VPN key in the TV status bar." },
        ],
        note: "Nvidia Shield TV supports WireGuard natively via Google Play and is the best Android TV option for ProxhqVPN.",
      },
      {
        id: "samsung", name: "Samsung Smart TV", os: "Tizen OS",
        icon: Tv, badge: "Router / Smart DNS", badgeColor: "text-yellow-400 border-yellow-500/30 bg-yellow-900/10",
        steps: [
          { text: "Samsung Tizen TVs do NOT support WireGuard apps directly." },
          { text: "Best option — Router-level VPN: Install ProxhqVPN on your router (see Router section below). All devices on your network are automatically protected, including your Samsung TV." },
          { text: "Alternative — Smart DNS: Go to ProxhqVPN → Smart DNS → copy the DNS server IPs." },
          { text: "On your Samsung TV: Settings → General → Network → Network Status → IP Settings → DNS Setting → Enter manually." },
          { text: "Enter the ProxhqVPN Smart DNS address. This bypasses geo-restrictions without full encryption." },
        ],
      },
      {
        id: "lg", name: "LG Smart TV", os: "webOS",
        icon: Tv, badge: "Router / Smart DNS", badgeColor: "text-yellow-400 border-yellow-500/30 bg-yellow-900/10",
        steps: [
          { text: "LG webOS TVs do NOT support WireGuard apps directly." },
          { text: "Router VPN: Connect LG TV to a router running ProxhqVPN (see Router section) for full VPN protection." },
          { text: "Smart DNS (geo-bypass only): Settings → All Settings → Network → Wired/Wi-Fi Connection → Edit → DNS Server → Enter ProxhqVPN Smart DNS IPs." },
        ],
      },
      {
        id: "roku", name: "Roku", os: "Roku OS",
        icon: Tv, badge: "Router Only", badgeColor: "text-red-400 border-red-500/30 bg-red-900/10",
        steps: [
          { text: "Roku does NOT support VPN apps or manual DNS changes." },
          { text: "Only option: install ProxhqVPN on your router. All traffic from the Roku device will be encrypted and tunneled." },
          { text: "See the Router Setup section below for OpenWRT, DD-WRT, or pfSense instructions." },
        ],
      },
      {
        id: "appletv", name: "Apple TV", os: "tvOS 17+",
        icon: Tv, badge: "WireGuard / Router", badgeColor: "text-blue-400 border-blue-500/30 bg-blue-900/10",
        steps: [
          { text: "Apple TV 4K (tvOS 17+) supports WireGuard natively via the App Store." },
          { text: "Search for WireGuard in the tvOS App Store and install it." },
          { text: "To import a config on Apple TV (no camera): use iCloud Keychain sharing — in WireGuard on iPhone, share the tunnel via iCloud, and it appears on Apple TV." },
          { text: "Older Apple TV: use router-level VPN instead." },
        ],
      },
    ],
  },
  {
    group: "ROUTERS", icon: Router, color: "text-cyan-400",
    items: [
      {
        id: "openwrt", name: "OpenWRT", os: "OpenWRT 21.02+",
        icon: Router, badge: "WireGuard Built-in", badgeColor: "text-cyan-400 border-cyan-500/30 bg-cyan-900/10",
        steps: [
          { text: "OpenWRT 21.02+ includes WireGuard support. Install the package:", code: "opkg update && opkg install wireguard-tools kmod-wireguard luci-proto-wireguard" },
          { text: "In ProxhqVPN → Router Config → select OpenWRT → copy the generated commands." },
          { text: "SSH into your router and run the provided setup commands." },
          { text: "Or use LuCI web UI: Network → Interfaces → Add new interface → Protocol: WireGuard." },
          { text: "Paste the WireGuard keys and peer config from ProxhqVPN." },
          { text: "Set the firewall zone for the VPN interface to forward traffic properly." },
        ],
      },
      {
        id: "ddwrt", name: "DD-WRT", os: "DD-WRT (build 45000+)",
        icon: Router, badge: "WireGuard", badgeColor: "text-cyan-400 border-cyan-500/30 bg-cyan-900/10",
        steps: [
          { text: "In DD-WRT web UI: Setup → VPN → WireGuard." },
          { text: "Enable WireGuard, set the keys from ProxhqVPN → Router Config." },
          { text: "Add the ProxhqVPN server as a peer with the public key and endpoint from Router Config page." },
          { text: "Set Allowed IPs to 0.0.0.0/0 for full tunnel mode." },
          { text: "Save and apply — DD-WRT will route all connected devices through ProxhqVPN." },
        ],
      },
      {
        id: "pfsense", name: "pfSense / OPNsense", os: "pfSense 2.6+ / OPNsense 22+",
        icon: Router, badge: "WireGuard Plugin", badgeColor: "text-cyan-400 border-cyan-500/30 bg-cyan-900/10",
        steps: [
          { text: "In pfSense: System → Package Manager → Available Packages → search wireguard → Install." },
          { text: "VPN → WireGuard → Settings → Enable WireGuard → Add Tunnel." },
          { text: "Generate keys or use the keys from ProxhqVPN → WireGuard Config." },
          { text: "Add a Peer using the ProxhqVPN server public key and endpoint." },
          { text: "Create an interface assignment for the WireGuard tunnel." },
          { text: "Set firewall rules to pass traffic through the VPN interface." },
        ],
      },
      {
        id: "asus", name: "ASUS Router (Merlin)", os: "AsusWRT-Merlin",
        icon: Router, badge: "WireGuard", badgeColor: "text-cyan-400 border-cyan-500/30 bg-cyan-900/10",
        steps: [
          { text: "Install AsusWRT-Merlin firmware (if not already installed — check freeshelter.net/asuswrt-merlin)." },
          { text: "In the router web UI: VPN → VPN Client → Add profile → WireGuard." },
          { text: "Copy the Private Key, Public Key, Address, DNS from ProxhqVPN → WireGuard Config." },
          { text: "Add the ProxhqVPN server endpoint and public key as the Peer." },
          { text: "Enable the profile — all LAN devices route through ProxhqVPN." },
        ],
      },
    ],
  },
  {
    group: "GAMING CONSOLES", icon: Gamepad2, color: "text-red-400",
    items: [
      {
        id: "ps5", name: "PlayStation 5 / PS4", os: "PlayStation OS",
        icon: Gamepad2, badge: "Router Only", badgeColor: "text-red-400 border-red-500/30 bg-red-900/10",
        steps: [
          { text: "PS5 and PS4 do not support VPN apps natively." },
          { text: "Best method: Install ProxhqVPN on your router — PlayStation will be protected automatically." },
          { text: "Alternative: share VPN from a PC over ethernet or WiFi hotspot (PC method below)." },
          { text: "On Windows: Settings → Network → VPN connection (WireGuard) → Share → Allow other devices to connect." },
        ],
      },
      {
        id: "xbox", name: "Xbox (Series X/S, One)", os: "Xbox OS",
        icon: Gamepad2, badge: "Router Only", badgeColor: "text-red-400 border-red-500/30 bg-red-900/10",
        steps: [
          { text: "Xbox does not support VPN apps natively." },
          { text: "Router VPN is the recommended method — see Router Setup in ProxhqVPN." },
          { text: "Alternative: connect Xbox to a Windows PC running WireGuard via ICS (Internet Connection Sharing)." },
        ],
      },
    ],
  },
  {
    group: "RASPBERRY PI & EMBEDDED", icon: Cpu, color: "text-pink-400",
    items: [
      {
        id: "raspberrypi", name: "Raspberry Pi", os: "Raspberry Pi OS / Ubuntu ARM",
        icon: Cpu, badge: "wg-quick", badgeColor: "text-pink-400 border-pink-500/30 bg-pink-900/10",
        steps: [
          { text: "Install WireGuard:", code: "sudo apt update && sudo apt install wireguard" },
          { text: "Download config from ProxhqVPN → WireGuard Config." },
          { text: "Copy to:", code: "sudo cp proxhq.conf /etc/wireguard/wg0.conf" },
          { text: "Connect:", code: "sudo wg-quick up wg0" },
          { text: "You can also use your Pi as a travel router — all devices connected to its hotspot get tunneled through ProxhqVPN." },
        ],
      },
    ],
  },
];

function PlatformCard({ p }: { p: PlatformCard }) {
  const [open, setOpen] = useState(false);
  const Icon = p.icon;
  return (
    <div className={`border rounded transition-colors ${open ? "border-primary/30 bg-primary/5" : "border-primary/15 hover:border-primary/25"}`}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
        <Icon className="w-4 h-4 text-primary/50 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-primary font-mono">{p.name}</span>
            {p.fireStick && (
              <span className="text-[8px] font-mono text-orange-400 border border-orange-500/30 bg-orange-900/10 px-1.5 rounded">SIDELOAD</span>
            )}
            <span className={`text-[8px] font-mono border px-1.5 py-0.5 rounded ${p.badgeColor}`}>{p.badge}</span>
          </div>
          {p.os && <div className="text-[9px] text-primary/30 font-mono mt-0.5">{p.os}</div>}
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-primary/40 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-primary/40 shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-primary/10 pt-3 space-y-3">
          {p.downloadUrl && (
            <a href={p.downloadUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[10px] font-mono text-black bg-primary hover:bg-primary/80 px-4 py-2 rounded transition-colors">
              <Download className="w-3.5 h-3.5" />
              {p.downloadLabel ?? "Download"}
              <ExternalLink className="w-3 h-3 opacity-60" />
            </a>
          )}

          <ol className="space-y-2">
            {p.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="text-[9px] font-mono text-primary/30 mt-0.5 shrink-0 w-4">{i + 1}.</span>
                <div className="flex-1">
                  <span className="text-[10px] text-primary/70 font-mono leading-relaxed">{s.text}</span>
                  {s.code && <CodeBlock>{s.code}</CodeBlock>}
                  {s.note && (
                    <div className="mt-1 text-[9px] text-yellow-400/80 font-mono flex items-start gap-1">
                      <AlertCircle className="w-2.5 h-2.5 mt-0.5 shrink-0" /> {s.note}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>

          {p.note && (
            <div className="flex items-start gap-2 text-[9px] font-mono text-primary/40 border border-primary/10 rounded px-3 py-2 bg-primary/5 mt-2">
              <CheckCircle className="w-3 h-3 mt-0.5 shrink-0 text-green-400" />
              {p.note}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Downloads() {
  const [search, setSearch] = useState("");
  const q = search.toLowerCase();

  const filtered = PLATFORMS.map(g => ({
    ...g,
    items: g.items.filter(p =>
      !q || p.name.toLowerCase().includes(q) || (p.os ?? "").toLowerCase().includes(q) || g.group.toLowerCase().includes(q)
    ),
  })).filter(g => g.items.length > 0);

  return (
    <div className="space-y-6 font-mono max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold tracking-widest uppercase text-primary flex items-center gap-2">
          <Download className="w-5 h-5" /> ProxhqVPN — Download & Install
        </h1>
        <p className="text-xs text-primary/40 mt-1">
          Full setup instructions for every major platform. ProxhqVPN runs on any device that supports WireGuard —
          phones, tablets, TVs, Fire Stick, routers, desktops, servers, and embedded hardware.
        </p>
      </div>

      {/* Quick start banner */}
      <div className="border border-primary/20 rounded p-4 bg-primary/5">
        <div className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-2">
          <Wifi className="w-3.5 h-3.5" /> Quick Start (All Platforms)
        </div>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/60">
          <li className="flex gap-2"><span className="text-primary/30">1.</span> <span>Sign in to ProxhqVPN → <span className="text-primary">WireGuard Config</span> → click <strong className="text-primary">Generate</strong></span></li>
          <li className="flex gap-2"><span className="text-primary/30">2.</span> <span>Download the <strong className="text-primary">.conf file</strong> or scan the <strong className="text-primary">QR code</strong> (mobile)</span></li>
          <li className="flex gap-2"><span className="text-primary/30">3.</span> <span>Install the <strong className="text-primary">WireGuard app</strong> for your platform (links below)</span></li>
          <li className="flex gap-2"><span className="text-primary/30">4.</span> <span>Import the config → <strong className="text-primary">Activate</strong> — done</span></li>
        </ol>
      </div>

      {/* Compatibility matrix */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Phones & Tablets", sub: "Android · iPhone · iPad", icon: Smartphone, ok: true },
          { label: "Fire Stick / Fire TV", sub: "All generations (sideload)", icon: Tv, ok: true },
          { label: "Android TV / Google TV", sub: "Sony · TCL · Nvidia Shield", icon: Tv, ok: true },
          { label: "Samsung / LG TV", sub: "Via router or Smart DNS", icon: Tv, ok: "partial" },
          { label: "Desktop", sub: "Windows · macOS · Linux", icon: Monitor, ok: true },
          { label: "Routers", sub: "OpenWRT · DD-WRT · pfSense", icon: Router, ok: true },
          { label: "Gaming Consoles", sub: "PS5 · Xbox (via router)", icon: Gamepad2, ok: "partial" },
          { label: "Apple TV 4K", sub: "tvOS 17+ native WireGuard", icon: Tv, ok: true },
        ].map(({ label, sub, icon: Icon, ok }) => (
          <div key={label} className={`border rounded p-3 text-center ${ok === true ? "border-green-500/20 bg-green-900/5" : ok === "partial" ? "border-yellow-500/20 bg-yellow-900/5" : "border-red-500/20 bg-red-900/5"}`}>
            <Icon className={`w-4 h-4 mx-auto mb-1.5 ${ok === true ? "text-green-400" : ok === "partial" ? "text-yellow-400" : "text-red-400"}`} />
            <div className="text-[9px] font-mono font-bold text-primary">{label}</div>
            <div className="text-[8px] text-primary/30 font-mono mt-0.5">{sub}</div>
            <div className={`text-[8px] font-mono mt-1.5 font-bold ${ok === true ? "text-green-400" : ok === "partial" ? "text-yellow-400" : "text-red-400"}`}>
              {ok === true ? "✓ FULL VPN" : ok === "partial" ? "⚡ PARTIAL" : "✗ N/A"}
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by platform name or OS… (e.g. Fire Stick, Samsung, Android)"
          className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-3 py-2 focus:outline-none focus:border-primary/50 rounded" />
      </div>

      {/* Platform groups */}
      <div className="space-y-6">
        {filtered.map(g => {
          const GIcon = g.icon;
          return (
            <div key={g.group}>
              <div className={`flex items-center gap-2 mb-3 text-[10px] font-mono font-bold uppercase tracking-widest ${g.color}`}>
                <GIcon className="w-3.5 h-3.5" /> {g.group}
              </div>
              <div className="space-y-2">
                {g.items.map(p => <PlatformCard key={p.id} p={p} />)}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-16 text-primary/30 font-mono text-sm">
            No platforms match "{search}". Try "Android", "TV", "Fire Stick", or "Linux".
          </div>
        )}
      </div>

      {/* Config download button */}
      <div className="border border-primary/20 rounded p-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[10px] font-mono font-bold text-primary">Ready to connect?</div>
          <div className="text-[9px] text-primary/40 font-mono mt-0.5">Go to WireGuard Config to generate your personal VPN config file or QR code.</div>
        </div>
        <a href={`${BASE}/wireguard`}
          className="flex items-center gap-2 text-[10px] font-mono text-black bg-primary hover:bg-primary/80 px-4 py-2 rounded transition-colors">
          <Cpu className="w-3.5 h-3.5" /> Generate Config
        </a>
      </div>
    </div>
  );
}
