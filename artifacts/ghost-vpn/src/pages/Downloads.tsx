import { useState, useEffect } from "react";
import { PageSEO } from "@/components/PageSEO";
import {
  Monitor, Smartphone, Tv, Router, Download, CheckCircle,
  ChevronDown, ChevronUp, AlertCircle, ExternalLink, Cpu,
  Tablet, Gamepad2, Wifi, Copy, Check, Flame, Apple,
  Star, Info, Package, Shield, FileText, BookOpen,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── WireGuard APK — direct link (official WireGuard release) ─────────────────
const WG_APK_URL      = "https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk";
const WG_WIN_URL      = "https://download.wireguard.com/windows-client/wireguard-installer.exe";
const WG_APPSTORE_MAC = "https://apps.apple.com/us/app/wireguard/id1451685025";
const WG_APPSTORE_IOS = "https://apps.apple.com/us/app/wireguard/id1441195209";
const WG_PLAY_URL     = "https://play.google.com/store/apps/details?id=com.wireguard.android";
const WG_APPSTORE_TV  = "https://apps.apple.com/us/app/wireguard/id1451685025"; // tvOS App Store

// ── Detect Fire OS from user agent ───────────────────────────────────────────
function detectFireOS() {
  const ua = navigator.userAgent;
  // Amazon Fire TV / Fire Stick device codes
  if (/AFTB|AFTM|AFTT|AFTS|AFTA|AFTSS|AFTMM|AFTKL|AFTR|AFTDI|AFTBU/i.test(ua)) return "firestick";
  if (/Silk|Android.*AmazonWebView/i.test(ua) && /Amazon/i.test(ua)) return "firestick";
  return null;
}

function detectPlatform() {
  const ua = navigator.userAgent;
  if (/AFTB|AFTM|AFTT|AFTS|AFTA|AFTSS|AFTMM|AFTKL|AFTR|AFTDI|AFTBU|Silk/i.test(ua) && /Amazon/i.test(ua)) return "fire";
  if (/iPhone|iPad/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Mac/i.test(ua)) return "mac";
  if (/Win/i.test(ua)) return "windows";
  if (/Linux/i.test(ua)) return "linux";
  return "unknown";
}

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = () => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); };
  return (
    <button onClick={copy} className="ml-2 text-primary/30 hover:text-primary transition-colors shrink-0">
      {done ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <div className="mt-1.5 mb-1">
      {label && <div className="text-[8px] text-primary/30 font-mono uppercase tracking-widest mb-1">{label}</div>}
      <pre className="relative group font-mono text-[10px] bg-black border border-primary/15 rounded p-2.5 text-primary/70 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {children}
        <button onClick={() => navigator.clipboard.writeText(children)}
          className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-primary/30 hover:text-primary">
          <Copy className="w-3 h-3" />
        </button>
      </pre>
    </div>
  );
}

// ── Download button variants ──────────────────────────────────────────────────
function DownloadBtn({ href, label, variant = "primary", icon: Icon = Download }: {
  href: string; label: string; variant?: "primary" | "store" | "apk"; icon?: React.ElementType;
}) {
  const base = "inline-flex items-center gap-2 text-[11px] font-mono font-bold px-4 py-2.5 rounded-lg transition-colors";
  const styles: Record<string, string> = {
    primary: `${base} bg-primary text-black hover:bg-primary/80`,
    store:   `${base} bg-white/10 text-white hover:bg-white/15 border border-white/20`,
    apk:     `${base} bg-orange-500/90 text-white hover:bg-orange-500 border border-orange-400/40`,
  };
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={styles[variant]}>
      <Icon className="w-3.5 h-3.5" />
      {label}
      <ExternalLink className="w-2.5 h-2.5 opacity-60" />
    </a>
  );
}

// ── Platform data ─────────────────────────────────────────────────────────────
interface Step { text: string; code?: string }

interface Platform {
  id: string; name: string; os: string;
  icon: React.ElementType; iconColor: string;
  badge: string; badgeColor: string;
  canInstall: boolean;
  downloads: { label: string; url: string; variant: "primary" | "store" | "apk"; icon?: React.ElementType }[];
  steps: Step[];
  note?: string;
}

interface PlatformGroup { group: string; icon: React.ElementType; color: string; items: Platform[] }

const PLATFORMS: PlatformGroup[] = [
  {
    group: "DESKTOP & LAPTOP", icon: Monitor, color: "text-blue-400",
    items: [
      {
        id: "windows", name: "Windows", os: "Windows 10 / 11",
        icon: Monitor, iconColor: "text-blue-400",
        badge: "Direct Download", badgeColor: "text-blue-400 border-blue-500/30 bg-blue-900/10",
        canInstall: true,
        downloads: [
          { label: "Download WireGuard (.exe)", url: WG_WIN_URL, variant: "primary" },
        ],
        steps: [
          { text: "Run the downloaded WireGuard installer and follow the setup wizard." },
          { text: "Open WireGuard → click the ▾ arrow next to Add Tunnel → Import tunnel(s) from file." },
          { text: "In ProxhqVPN → WireGuard Config → Generate → Download .conf file." },
          { text: "Import the .conf into WireGuard. Click Activate — status turns green." },
          { text: "Verify you're connected:", code: "curl https://api64.ipify.org" },
        ],
        note: "WireGuard runs as a Windows service and can auto-start at login.",
      },
      {
        id: "macos", name: "macOS", os: "macOS 12+",
        icon: Monitor, iconColor: "text-white/90",
        badge: "Mac App Store", badgeColor: "text-white/82 border-gray-500/30 bg-gray-900/10",
        canInstall: true,
        downloads: [
          { label: "WireGuard on Mac App Store", url: WG_APPSTORE_MAC, variant: "store", icon: Apple },
        ],
        steps: [
          { text: "Install WireGuard from the Mac App Store (link above)." },
          { text: "In ProxhqVPN → WireGuard Config → Generate → Download .conf file." },
          { text: "WireGuard → Import tunnel(s) from file → select your .conf." },
          { text: "Click Allow when macOS asks for VPN permission." },
          { text: "Click Activate — the WireGuard icon appears in the menu bar." },
          { text: "Verify:", code: "curl https://api64.ipify.org" },
        ],
      },
      {
        id: "linux", name: "Linux", os: "Ubuntu · Debian · Fedora · Arch",
        icon: Monitor, iconColor: "text-orange-400",
        badge: "Package Manager", badgeColor: "text-orange-400 border-orange-500/30 bg-orange-900/10",
        canInstall: true,
        downloads: [],
        steps: [
          { text: "Ubuntu / Debian:", code: "sudo apt install wireguard" },
          { text: "Fedora / RHEL:", code: "sudo dnf install wireguard-tools" },
          { text: "Arch Linux:", code: "sudo pacman -S wireguard-tools" },
          { text: "Download your config from ProxhqVPN → WireGuard Config → Download .conf." },
          { text: "Move the config:", code: "sudo mv ~/Downloads/proxhq.conf /etc/wireguard/wg0.conf" },
          { text: "Connect:", code: "sudo wg-quick up wg0" },
          { text: "Auto-start at boot:", code: "sudo systemctl enable --now wg-quick@wg0" },
        ],
      },
      {
        id: "chromebook", name: "Chromebook", os: "ChromeOS 73+",
        icon: Monitor, iconColor: "text-green-400",
        badge: "Linux Terminal", badgeColor: "text-green-400 border-green-500/30 bg-green-900/10",
        canInstall: true,
        downloads: [],
        steps: [
          { text: "Enable Linux: Settings → Advanced → Developers → Linux development environment → Turn On." },
          { text: "In the Linux terminal:", code: "sudo apt update && sudo apt install wireguard" },
          { text: "Download your ProxhqVPN config from the WireGuard Config page." },
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
        id: "android", name: "Android Phone", os: "Android 7+",
        icon: Smartphone, iconColor: "text-green-400",
        badge: "Google Play", badgeColor: "text-green-400 border-green-500/30 bg-green-900/10",
        canInstall: true,
        downloads: [
          { label: "WireGuard on Google Play", url: WG_PLAY_URL, variant: "primary" },
          { label: "Download APK directly", url: WG_APK_URL, variant: "apk", icon: Package },
        ],
        steps: [
          { text: "Install WireGuard from Google Play (link above) — or sideload the APK if Play is unavailable." },
          { text: "In ProxhqVPN → WireGuard Config → Generate config → show QR Code." },
          { text: "In WireGuard app → tap + → Scan from QR code → scan the code." },
          { text: "Tap the toggle to connect. A key icon appears in the Android status bar." },
          { text: "Optional: enable always-on VPN in Settings → Network → VPN → ProxhqVPN → gear icon → Always-on VPN." },
        ],
        note: "Android 10+ supports always-on VPN with 'block connections without VPN'.",
      },
      {
        id: "iphone", name: "iPhone & iPad", os: "iOS 14+ / iPadOS 14+",
        icon: Smartphone, iconColor: "text-blue-300",
        badge: "App Store", badgeColor: "text-blue-400 border-blue-500/30 bg-blue-900/10",
        canInstall: true,
        downloads: [
          { label: "WireGuard on the App Store", url: WG_APPSTORE_IOS, variant: "store", icon: Apple },
        ],
        steps: [
          { text: "Install WireGuard from the App Store." },
          { text: "In ProxhqVPN → WireGuard Config → Generate config → show QR Code." },
          { text: "In WireGuard app → tap + → Create from QR code → scan." },
          { text: "Tap Allow when iOS requests VPN permission." },
          { text: "Toggle the tunnel on. The VPN indicator appears in the iOS status bar." },
          { text: "For always-on: Settings → General → VPN & Device Management → VPN → Connect On Demand." },
        ],
      },
      {
        id: "android-tablet", name: "Android Tablet", os: "Samsung · Lenovo · Xiaomi · etc.",
        icon: Tablet, iconColor: "text-green-400",
        badge: "Google Play", badgeColor: "text-green-400 border-green-500/30 bg-green-900/10",
        canInstall: true,
        downloads: [
          { label: "WireGuard on Google Play", url: WG_PLAY_URL, variant: "primary" },
        ],
        steps: [
          { text: "Install WireGuard from Google Play — identical to Android phone setup." },
          { text: "Use QR code import from ProxhqVPN → WireGuard Config for easiest setup." },
          { text: "Toggle to connect. Tablets show the VPN key icon in the status bar." },
        ],
      },
    ],
  },
  {
    group: "AMAZON FIRE DEVICES", icon: Flame, color: "text-orange-400",
    items: [
      {
        id: "firestick", name: "Amazon Fire Stick", os: "Fire OS 5+ · 4K · 4K Max · Lite · 3rd gen+",
        icon: Flame, iconColor: "text-orange-400",
        badge: "Direct APK Install", badgeColor: "text-orange-400 border-orange-500/30 bg-orange-900/10",
        canInstall: true,
        downloads: [
          { label: "Download WireGuard APK for Fire Stick", url: WG_APK_URL, variant: "apk", icon: Package },
        ],
        steps: [
          { text: "FIRST — Enable unknown sources: Settings → My Fire TV → Developer Options → Apps from Unknown Sources → ON." },
          { text: "Option A (Silk Browser — easiest): Open the Silk browser on your Fire Stick, navigate to this page, and tap the orange 'Download WireGuard APK' button above. Fire OS will download and prompt you to install." },
          { text: "Option B (Downloader App): Install the free 'Downloader by AFTVnews' app from the Amazon Appstore, then enter this URL:", code: "https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk" },
          { text: "After installation, find WireGuard under Your Apps & Games or Recent." },
          { text: "In ProxhqVPN → WireGuard Config → Generate → Download .conf to Google Drive or Dropbox." },
          { text: "In WireGuard on Fire Stick → tap + → Import from file → navigate to your downloaded .conf." },
          { text: "Toggle the tunnel on — Fire Stick shows a VPN key icon at the top." },
        ],
        note: "Fire Stick runs Fire OS (based on Android). The WireGuard Android APK works natively — no rooting required.",
      },
      {
        id: "firetv", name: "Amazon Fire TV Cube", os: "Fire OS 7+",
        icon: Tv, iconColor: "text-orange-400",
        badge: "APK / ADB", badgeColor: "text-orange-400 border-orange-500/30 bg-orange-900/10",
        canInstall: true,
        downloads: [
          { label: "Download WireGuard APK", url: WG_APK_URL, variant: "apk", icon: Package },
        ],
        steps: [
          { text: "Same APK as Fire Stick above — Fire TV Cube also runs Fire OS." },
          { text: "Use Silk Browser or Downloader app method (see Fire Stick steps above)." },
          { text: "Advanced — sideload via ADB over WiFi from a PC:", code: "adb connect YOUR_FIRETV_IP:5555\nadb install wireguard.apk" },
          { text: "Find your Fire TV IP: Settings → My Fire TV → About → Network." },
          { text: "Enable ADB: Settings → My Fire TV → Developer Options → ADB Debugging → ON." },
        ],
      },
    ],
  },
  {
    group: "SMART TVs & STREAMING BOXES", icon: Tv, color: "text-purple-400",
    items: [
      {
        id: "androidtv", name: "Android TV / Google TV", os: "Sony · Philips · TCL · Nvidia Shield · Chromecast",
        icon: Tv, iconColor: "text-green-400",
        badge: "Google Play", badgeColor: "text-green-400 border-green-500/30 bg-green-900/10",
        canInstall: true,
        downloads: [
          { label: "WireGuard on Google Play (TV)", url: WG_PLAY_URL, variant: "primary" },
          { label: "Sideload APK", url: WG_APK_URL, variant: "apk", icon: Package },
        ],
        steps: [
          { text: "Open Google Play on your Android TV and search for 'WireGuard' — it has a full TV-optimized interface." },
          { text: "Install WireGuard from the search results." },
          { text: "In ProxhqVPN → WireGuard Config → Generate → Download .conf to Google Drive." },
          { text: "On Android TV, open a file manager (FX File Explorer) or install Downloader app." },
          { text: "Import the .conf from your cloud storage into WireGuard." },
          { text: "Toggle the tunnel ON — a VPN key appears in the TV status bar." },
        ],
        note: "Nvidia Shield TV is the best Android TV option — supports WireGuard natively via Google Play.",
      },
      {
        id: "appletv", name: "Apple TV", os: "tvOS 17+ (4K 3rd gen)",
        icon: Tv, iconColor: "text-white/90",
        badge: "tvOS App Store", badgeColor: "text-blue-400 border-blue-500/30 bg-blue-900/10",
        canInstall: true,
        downloads: [
          { label: "WireGuard on tvOS App Store", url: WG_APPSTORE_TV, variant: "store", icon: Apple },
        ],
        steps: [
          { text: "Apple TV 4K (tvOS 17+) supports WireGuard natively — search for it in the tvOS App Store." },
          { text: "Install WireGuard from the App Store on your Apple TV." },
          { text: "To import a config without a camera — use iCloud Keychain: in WireGuard on iPhone, share the tunnel via iCloud. It automatically appears on your Apple TV." },
          { text: "Older Apple TV (1st/2nd/3rd gen): use router-level VPN instead (see Routers section)." },
        ],
        note: "For Apple TV 4K (tvOS 17+) only. iCloud config sharing is the easiest setup method — no USB or QR code needed.",
      },
      {
        id: "samsung", name: "Samsung Smart TV", os: "Tizen OS (2016+)",
        icon: Tv, iconColor: "text-yellow-400",
        badge: "Router / Smart DNS", badgeColor: "text-yellow-400 border-yellow-500/30 bg-yellow-900/10",
        canInstall: false,
        downloads: [],
        steps: [
          { text: "Samsung Tizen TVs do NOT support WireGuard apps — no VPN app is available on Tizen." },
          { text: "Best option — Router-level VPN: Install ProxhqVPN on your router (see Routers section). Your Samsung TV is automatically protected along with every device on your network." },
          { text: "Alternative — Smart DNS (geo-bypass only, no encryption): ProxhqVPN → Smart DNS → copy the DNS IPs." },
          { text: "On Samsung TV: Settings → General → Network → Network Status → IP Settings → DNS Setting → Enter manually → paste Smart DNS IP." },
        ],
      },
      {
        id: "lg", name: "LG Smart TV", os: "webOS (2016+)",
        icon: Tv, iconColor: "text-red-400",
        badge: "Router / Smart DNS", badgeColor: "text-yellow-400 border-yellow-500/30 bg-yellow-900/10",
        canInstall: false,
        downloads: [],
        steps: [
          { text: "LG webOS TVs do NOT support WireGuard apps directly." },
          { text: "Router VPN: Connect LG TV to a router running ProxhqVPN — full encryption for all TV traffic." },
          { text: "Smart DNS (geo-bypass): Settings → All Settings → Network → Wired/Wi-Fi Connection → Edit → DNS Server → Enter ProxhqVPN Smart DNS IPs." },
        ],
      },
      {
        id: "roku", name: "Roku", os: "Roku OS",
        icon: Tv, iconColor: "text-purple-400",
        badge: "Router Only", badgeColor: "text-red-400 border-red-500/30 bg-red-900/10",
        canInstall: false,
        downloads: [],
        steps: [
          { text: "Roku does NOT support VPN apps or manual DNS changes — it is a closed platform." },
          { text: "Only option: install ProxhqVPN on your router. All Roku traffic is automatically encrypted and tunneled." },
          { text: "See the Router Setup section below for OpenWRT, DD-WRT, and pfSense instructions." },
        ],
      },
    ],
  },
  {
    group: "ROUTERS", icon: Router, color: "text-cyan-400",
    items: [
      {
        id: "openwrt", name: "OpenWRT", os: "OpenWRT 21.02+",
        icon: Router, iconColor: "text-cyan-400",
        badge: "WireGuard Built-in", badgeColor: "text-cyan-400 border-cyan-500/30 bg-cyan-900/10",
        canInstall: true,
        downloads: [],
        steps: [
          { text: "Install WireGuard packages:", code: "opkg update && opkg install wireguard-tools kmod-wireguard luci-proto-wireguard" },
          { text: "In ProxhqVPN → Router Config → select OpenWRT → copy the generated setup commands." },
          { text: "SSH into your router and run the provided commands." },
          { text: "Or use LuCI web UI: Network → Interfaces → Add new → Protocol: WireGuard. Paste the keys and peer config from ProxhqVPN." },
          { text: "Set the firewall zone for the WireGuard interface to forward traffic correctly." },
        ],
      },
      {
        id: "ddwrt", name: "DD-WRT", os: "DD-WRT build 45000+",
        icon: Router, iconColor: "text-cyan-400",
        badge: "WireGuard", badgeColor: "text-cyan-400 border-cyan-500/30 bg-cyan-900/10",
        canInstall: true,
        downloads: [],
        steps: [
          { text: "In DD-WRT web UI: Setup → VPN → WireGuard." },
          { text: "Enable WireGuard, paste the keys from ProxhqVPN → Router Config." },
          { text: "Add the ProxhqVPN server as a peer with the public key and endpoint from Router Config." },
          { text: "Set Allowed IPs to 0.0.0.0/0 for full-tunnel mode." },
          { text: "Save and apply — DD-WRT routes all connected devices through ProxhqVPN." },
        ],
      },
      {
        id: "pfsense", name: "pfSense / OPNsense", os: "pfSense 2.6+ / OPNsense 22+",
        icon: Router, iconColor: "text-cyan-400",
        badge: "WireGuard Plugin", badgeColor: "text-cyan-400 border-cyan-500/30 bg-cyan-900/10",
        canInstall: true,
        downloads: [],
        steps: [
          { text: "In pfSense: System → Package Manager → Available Packages → search 'wireguard' → Install." },
          { text: "VPN → WireGuard → Settings → Enable → Add Tunnel." },
          { text: "Generate keys or use keys from ProxhqVPN → WireGuard Config." },
          { text: "Add a Peer using the ProxhqVPN server public key and endpoint." },
          { text: "Create an interface assignment for the WireGuard tunnel." },
          { text: "Set firewall rules to pass traffic through the VPN interface." },
        ],
      },
      {
        id: "asus", name: "ASUS Router (Merlin)", os: "AsusWRT-Merlin",
        icon: Router, iconColor: "text-cyan-400",
        badge: "WireGuard", badgeColor: "text-cyan-400 border-cyan-500/30 bg-cyan-900/10",
        canInstall: true,
        downloads: [],
        steps: [
          { text: "Install AsusWRT-Merlin firmware (freeshelter.net/asuswrt-merlin) if not already installed." },
          { text: "Router web UI: VPN → VPN Client → Add profile → WireGuard." },
          { text: "Copy Private Key, Public Key, Address, DNS from ProxhqVPN → WireGuard Config." },
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
        icon: Gamepad2, iconColor: "text-blue-400",
        badge: "Router Only", badgeColor: "text-red-400 border-red-500/30 bg-red-900/10",
        canInstall: false,
        downloads: [],
        steps: [
          { text: "PS5 and PS4 do not support VPN apps — use router-level VPN for automatic protection." },
          { text: "Router method: Install ProxhqVPN on your router — your PlayStation is automatically protected." },
          { text: "PC hotspot method (Windows): Settings → Network → VPN → Share VPN connection → allow other devices (connect PlayStation via ethernet or WiFi)." },
        ],
      },
      {
        id: "xbox", name: "Xbox (Series X/S, One)", os: "Xbox OS",
        icon: Gamepad2, iconColor: "text-green-400",
        badge: "Router Only", badgeColor: "text-red-400 border-red-500/30 bg-red-900/10",
        canInstall: false,
        downloads: [],
        steps: [
          { text: "Xbox does not support VPN apps — use router-level VPN." },
          { text: "Router VPN is the recommended method — see Router Setup in ProxhqVPN." },
          { text: "Alternative: connect Xbox to a Windows PC running WireGuard via Internet Connection Sharing (ICS)." },
        ],
      },
    ],
  },
  {
    group: "RASPBERRY PI & EMBEDDED", icon: Cpu, color: "text-pink-400",
    items: [
      {
        id: "raspberrypi", name: "Raspberry Pi", os: "Raspberry Pi OS / Ubuntu ARM",
        icon: Cpu, iconColor: "text-pink-400",
        badge: "wg-quick", badgeColor: "text-pink-400 border-pink-500/30 bg-pink-900/10",
        canInstall: true,
        downloads: [],
        steps: [
          { text: "Install WireGuard:", code: "sudo apt update && sudo apt install wireguard" },
          { text: "Download config from ProxhqVPN → WireGuard Config." },
          { text: "Copy to:", code: "sudo cp proxhq.conf /etc/wireguard/wg0.conf" },
          { text: "Connect:", code: "sudo wg-quick up wg0" },
          { text: "Use your Pi as a travel router — all devices on its hotspot tunnel through ProxhqVPN automatically." },
        ],
      },
    ],
  },
];

// ── Platform card component ───────────────────────────────────────────────────
function PlatformCard({ p, defaultOpen }: { p: Platform; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const Icon = p.icon;

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${open ? "border-primary/30" : "border-primary/15 hover:border-primary/25"}`}>
      {/* Card header — always visible */}
      <div className="px-4 py-3 flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg bg-black border border-primary/15 flex items-center justify-center shrink-0 mt-0.5`}>
          <Icon className={`w-4 h-4 ${p.iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-bold text-primary">{p.name}</span>
            <span className={`text-[8px] font-mono border px-1.5 py-0.5 rounded ${p.badgeColor}`}>{p.badge}</span>
            {!p.canInstall && (
              <span className="text-[8px] font-mono text-yellow-400/70 border border-yellow-500/20 bg-yellow-900/10 px-1.5 py-0.5 rounded">Instructions Only</span>
            )}
          </div>
          <div className="text-[9px] text-primary/30 font-mono">{p.os}</div>

          {/* Download buttons — visible without expanding */}
          {p.downloads.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2.5">
              {p.downloads.map((d, i) => {
                const DIcon = d.icon ?? Download;
                const styles: Record<string, string> = {
                  primary: "bg-primary text-black hover:bg-primary/80",
                  store:   "bg-white/10 text-white hover:bg-white/15 border border-white/20",
                  apk:     "bg-orange-500/90 text-white hover:bg-orange-500 border border-orange-400/40",
                };
                return (
                  <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
                    className={`inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg transition-colors ${styles[d.variant]}`}>
                    <DIcon className="w-3 h-3" />
                    {d.label}
                    <ExternalLink className="w-2 h-2 opacity-50" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
        <button onClick={() => setOpen(v => !v)}
          className="shrink-0 mt-1 text-primary/30 hover:text-primary transition-colors">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded setup instructions */}
      {open && (
        <div className="px-4 pb-4 border-t border-primary/10 pt-3 space-y-2.5">
          <div className="text-[8px] font-mono text-primary/25 uppercase tracking-widest mb-2">Setup Instructions</div>
          <ol className="space-y-2">
            {p.steps.map((s, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="text-[9px] font-mono text-primary/25 mt-0.5 shrink-0 w-4 text-right">{i + 1}.</span>
                <div className="flex-1">
                  <span className="text-[10px] text-primary/65 font-mono leading-relaxed">{s.text}</span>
                  {s.code && <CodeBlock>{s.code}</CodeBlock>}
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

// ── Fire Stick detection banner ───────────────────────────────────────────────
function FireStickBanner() {
  return (
    <div className="border-2 border-orange-500/40 rounded-xl bg-orange-900/10 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
          <Flame className="w-5 h-5 text-orange-400" />
        </div>
        <div>
          <div className="text-sm font-bold text-orange-400">Amazon Fire Stick Detected!</div>
          <div className="text-[10px] text-orange-400/60 font-mono">You can install WireGuard directly on this Fire Stick</div>
        </div>
      </div>

      <div className="flex items-start gap-3 border border-orange-500/20 rounded-lg px-3 py-2.5 bg-orange-900/10">
        <AlertCircle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
        <p className="text-[10px] font-mono text-orange-400/80 leading-relaxed">
          <strong>Before downloading:</strong> Enable Apps from Unknown Sources —{" "}
          <span className="text-orange-300">Settings → My Fire TV → Developer Options → Apps from Unknown Sources → ON</span>
        </p>
      </div>

      <div className="space-y-2">
        <div className="text-[9px] font-mono text-orange-400/50 uppercase tracking-widest">Step 1 — Download & Install WireGuard</div>
        <a href={WG_APK_URL} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-3 w-full sm:w-auto bg-orange-500 hover:bg-orange-400 text-white text-sm font-bold px-5 py-3 rounded-xl transition-colors">
          <Package className="w-5 h-5" />
          <span>Download WireGuard APK for Fire Stick</span>
          <Download className="w-4 h-4 ml-auto sm:ml-0" />
        </a>
        <div className="text-[9px] font-mono text-orange-400/40">
          Tap the button above → Fire OS downloads the APK → tap Install when prompted
        </div>
      </div>

      <div className="space-y-1">
        <div className="text-[9px] font-mono text-orange-400/50 uppercase tracking-widest">Step 2 — Set Up Your VPN Config</div>
        <p className="text-[10px] font-mono text-orange-400/70 leading-relaxed">
          After installing WireGuard, go to <strong className="text-orange-300">ProxhqVPN → WireGuard Config → Generate</strong> on another device,
          save the .conf file to Google Drive or Dropbox, then import it into WireGuard on your Fire Stick.
        </p>
      </div>
    </div>
  );
}

// ── Quick-pick platform buttons ───────────────────────────────────────────────
const QUICK_PICKS = [
  { label: "Windows",       id: "windows",       color: "text-blue-300",   bg: "border-blue-500/20 hover:border-blue-400/40" },
  { label: "macOS",         id: "macos",         color: "text-white/90",   bg: "border-gray-500/20 hover:border-gray-400/40" },
  { label: "Android",       id: "android",       color: "text-green-400",  bg: "border-green-500/20 hover:border-green-400/40" },
  { label: "iPhone/iPad",   id: "iphone",        color: "text-blue-300",   bg: "border-blue-500/20 hover:border-blue-400/40" },
  { label: "Fire Stick",    id: "firestick",     color: "text-orange-400", bg: "border-orange-500/20 hover:border-orange-400/40" },
  { label: "Android TV",    id: "androidtv",     color: "text-green-400",  bg: "border-green-500/20 hover:border-green-400/40" },
  { label: "Apple TV",      id: "appletv",       color: "text-white/90",   bg: "border-gray-500/20 hover:border-gray-400/40" },
  { label: "Router",        id: "openwrt",       color: "text-cyan-400",   bg: "border-cyan-500/20 hover:border-cyan-400/40" },
];

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Downloads() {
  const [search, setSearch]                 = useState("");
  const [platform, setPlatform]             = useState<string | null>(null);
  const [isFireOS, setIsFireOS]             = useState(false);
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);

  useEffect(() => {
    const fire = detectFireOS();
    setIsFireOS(!!fire);
    setDetectedPlatform(detectPlatform());
  }, []);

  const q = search.toLowerCase();

  const scrollTo = (id: string) => {
    const el = document.getElementById(`platform-${id}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const filtered = PLATFORMS.map(g => ({
    ...g,
    items: g.items.filter(p =>
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.os.toLowerCase().includes(q) ||
      g.group.toLowerCase().includes(q) ||
      p.badge.toLowerCase().includes(q)
    ),
  })).filter(g => g.items.length > 0);

  const allPlatforms = PLATFORMS.flatMap(g => g.items);

  return (
    <div className="space-y-7 max-w-4xl">
      <PageSEO
        title="Downloads — WireGuard VPN Apps for Every Device"
        description="Download ProxhqVPN on any device. Native WireGuard apps for Windows, macOS, iOS, Android, Linux, Fire TV, Apple TV, gaming consoles, and routers. Free to download."
        path="/downloads"
      />
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold tracking-widest uppercase text-primary flex items-center gap-2">
          <Download className="w-5 h-5" /> Download ProxhqVPN
        </h1>
        <p className="text-xs text-primary/40 mt-1 font-mono">
          One-click downloads for every platform. ProxhqVPN works on any device that supports WireGuard —
          phones, tablets, TVs, Fire Stick, routers, desktops, and embedded hardware.
        </p>
      </div>

      {/* Fire OS detection banner */}
      {isFireOS && <FireStickBanner />}

      {/* Smart download for current device */}
      {!isFireOS && detectedPlatform && detectedPlatform !== "unknown" && (() => {
        const dlMap: Record<string, { label: string; url: string; variant: "primary"|"store"|"apk" }> = {
          windows: { label: "Download WireGuard for Windows (.exe)", url: WG_WIN_URL, variant: "primary" },
          mac:     { label: "WireGuard on Mac App Store",            url: WG_APPSTORE_MAC, variant: "store" },
          android: { label: "WireGuard on Google Play",              url: WG_PLAY_URL, variant: "primary" },
          ios:     { label: "WireGuard on the App Store",            url: WG_APPSTORE_IOS, variant: "store" },
        };
        const dl = dlMap[detectedPlatform];
        if (!dl) return null;
        const styles: Record<string, string> = {
          primary: "bg-primary text-black hover:bg-primary/80",
          store:   "bg-white/10 text-white hover:bg-white/15 border border-white/20",
          apk:     "bg-orange-500/90 text-white hover:bg-orange-500",
        };
        return (
          <div className="border border-primary/20 rounded-xl px-5 py-4 bg-primary/5 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-primary" />
              <div>
                <div className="text-xs font-bold text-primary">Recommended for your device</div>
                <div className="text-[9px] text-primary/40 font-mono capitalize">{detectedPlatform} detected</div>
              </div>
            </div>
            <a href={dl.url} target="_blank" rel="noopener noreferrer"
              className={`inline-flex items-center gap-2 text-[11px] font-mono font-bold px-4 py-2 rounded-lg transition-colors ${styles[dl.variant]}`}>
              <Download className="w-3.5 h-3.5" /> {dl.label}
            </a>
          </div>
        );
      })()}

      {/* Quick platform jump buttons */}
      <div className="space-y-2">
        <div className="text-[8px] font-mono text-primary/25 uppercase tracking-widest">Jump to Platform</div>
        <div className="flex flex-wrap gap-2">
          {QUICK_PICKS.map(p => (
            <button key={p.id} onClick={() => scrollTo(p.id)}
              className={`text-[10px] font-mono border px-3 py-1.5 rounded-lg bg-black transition-colors ${p.bg} ${p.color}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick start */}
      <div className="border border-primary/20 rounded-xl p-4 bg-primary/5">
        <div className="text-[9px] font-mono font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-2">
          <Wifi className="w-3 h-3" /> Quick Start (All Platforms)
        </div>
        <ol className="space-y-1 text-[10px] font-mono text-primary/55 grid sm:grid-cols-2 gap-x-6">
          <li className="flex gap-2"><span className="text-primary/25">1.</span><span>Sign in to ProxhqVPN → <span className="text-primary">WireGuard Config</span> → click <strong className="text-primary">Generate</strong></span></li>
          <li className="flex gap-2"><span className="text-primary/25">2.</span><span>Download the generated <span className="text-primary">.conf</span> file or show the QR code</span></li>
          <li className="flex gap-2"><span className="text-primary/25">3.</span><span>Install WireGuard on your device (use download button below)</span></li>
          <li className="flex gap-2"><span className="text-primary/25">4.</span><span>Import the .conf or scan the QR → Toggle ON → Done</span></li>
        </ol>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/30" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search platforms (e.g. Fire Stick, Nvidia Shield, pfSense...)"
          className="w-full bg-black border border-primary/20 text-primary text-xs font-mono pl-9 pr-4 py-2 focus:outline-none focus:border-primary/50 rounded-lg" />
      </div>

      {/* Platform groups */}
      {filtered.map(group => {
        const GroupIcon = group.icon;
        return (
          <div key={group.group} className="space-y-3">
            <div className={`flex items-center gap-2 text-[9px] font-mono ${group.color} uppercase tracking-widest`}>
              <GroupIcon className="w-3.5 h-3.5" /> {group.group}
            </div>
            <div className="space-y-2.5">
              {group.items.map(p => (
                <div key={p.id} id={`platform-${p.id}`}>
                  <PlatformCard p={p} defaultOpen={detectedPlatform === p.id} />
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Router note */}
      <div className="border border-cyan-500/20 rounded-xl p-4 bg-cyan-900/5 flex items-start gap-3">
        <Shield className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
        <div>
          <div className="text-[11px] font-bold text-cyan-400 mb-0.5">Can't install an app? Use your Router.</div>
          <p className="text-[10px] font-mono text-cyan-400/60 leading-relaxed">
            Samsung TVs, LG TVs, Roku, PlayStation, and Xbox cannot run VPN apps.
            The cleanest solution: install ProxhqVPN on your router.
            Every device on your network — including your TV, gaming console, and smart home devices — is automatically protected without any extra setup.
          </p>
        </div>
      </div>

      {/* Platform README Downloads */}
      <ReadmeDownloads />
    </div>
  );
}

// ── README content per platform ───────────────────────────────────────────────
const README_CONTENT: Record<string, string> = {
  windows: `ProxhqVPN — Windows Setup README
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

REQUIREMENTS
- Windows 10 or 11 (64-bit)
- WireGuard for Windows

STEP 1 — Install WireGuard
  Download: https://download.wireguard.com/windows-client/wireguard-installer.exe
  Run the installer with default settings. WireGuard installs as a Windows service.

STEP 2 — Get Your Config File
  1. Sign in to ProxhqVPN → WireGuard Config (proxhqvpn.com/wireguard)
  2. Click "Generate" to create your personal keypair
  3. Click "Download .conf" to save your configuration file

STEP 3 — Import & Connect
  1. Open WireGuard
  2. Click the arrow next to "Add Tunnel" → "Import tunnel(s) from file"
  3. Select the .conf file you downloaded
  4. Click "Activate" — the status indicator turns green

STEP 4 — Verify Connection
  Open Command Prompt and run:
    curl https://api64.ipify.org
  The IP shown should be your ProxhqVPN server IP, not your real IP.

OPTIONAL — Kill Switch
  ProxhqVPN → Kill Switch (/kill-switch)
  Enable to block all traffic if the VPN drops unexpectedly.

SUPPORT
  Email: support@proxhqvpn.com
  Guide: https://proxhqvpn.com/guide
`,
  mac: `ProxhqVPN — macOS Setup README
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

REQUIREMENTS
- macOS 12 (Monterey) or later
- WireGuard from the Mac App Store

STEP 1 — Install WireGuard
  Mac App Store: https://apps.apple.com/us/app/wireguard/id1451685025
  Click "Get" → install as usual.

STEP 2 — Get Your Config File
  1. Sign in to ProxhqVPN → WireGuard Config
  2. Click "Generate" → "Download .conf"

STEP 3 — Import & Connect
  1. Open WireGuard
  2. Click "Import tunnel(s) from file" and select the .conf
  3. Allow VPN configuration when prompted by macOS System Settings
  4. Toggle the tunnel ON — status turns Active

STEP 4 — Verify
  Terminal: curl https://api64.ipify.org

SUPPORT
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
  linux: `ProxhqVPN — Linux Setup README
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

REQUIREMENTS
- Ubuntu 20.04+ / Debian 11+ / Fedora 36+ / Arch Linux
- WireGuard kernel module (included in mainline kernel ≥5.6)

STEP 1 — Install WireGuard Tools
  Ubuntu/Debian:  sudo apt install wireguard wireguard-tools
  Fedora:         sudo dnf install wireguard-tools
  Arch:           sudo pacman -S wireguard-tools
  Alpine:         apk add wireguard-tools

STEP 2 — Get Your Config
  1. Sign in to ProxhqVPN → WireGuard Config
  2. Click "Generate" → "Copy Config"
  3. Paste into: sudo nano /etc/wireguard/proxhq.conf

STEP 3 — Connect
  Start:    sudo wg-quick up proxhq
  Stop:     sudo wg-quick down proxhq
  Status:   sudo wg show
  Auto-start: sudo systemctl enable wg-quick@proxhq

STEP 4 — Verify
  curl https://api64.ipify.org

OPTIONAL — DNS Shield
  Edit your config and set DNS = 1.1.1.1 or use ProxhqVPN's encrypted DNS.

SUPPORT
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
  android: `ProxhqVPN — Android Setup README
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

REQUIREMENTS
- Android 8.0+ (API level 26+)
- WireGuard for Android

STEP 1 — Install WireGuard
  Option A: Google Play Store
    https://play.google.com/store/apps/details?id=com.wireguard.android
  Option B: Direct APK (for devices without Play Store)
    https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk
    Enable "Install from unknown sources" in Settings → Security

STEP 2 — Get Your Config
  1. Sign in to ProxhqVPN → WireGuard Config
  2. Click "Generate" → "Show QR Code"
  3. On your Android: WireGuard → + → "Scan from QR code"
  4. Scan the QR — tunnel is imported automatically

STEP 3 — Connect
  Tap the tunnel name → toggle ON. Android shows the VPN key icon in the status bar.

STEP 4 — Verify
  Visit https://api64.ipify.org in Chrome — should show ProxhqVPN server IP.

SUPPORT
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
  ios: `ProxhqVPN — iOS / iPadOS Setup README
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

REQUIREMENTS
- iPhone or iPad running iOS/iPadOS 15+
- WireGuard from the App Store

STEP 1 — Install WireGuard
  App Store: https://apps.apple.com/us/app/wireguard/id1441195209

STEP 2 — Get Your Config
  1. Sign in to ProxhqVPN → WireGuard Config
  2. Click "Generate" → "Show QR Code"
  3. In WireGuard app: tap + → "Create from QR code"
  4. Point your camera at the QR code

STEP 3 — Connect
  Allow VPN configuration when iOS prompts. Tap the tunnel → toggle ON.
  The VPN key icon appears in the iOS status bar.

STEP 4 — Verify
  Safari: visit https://api64.ipify.org — should show ProxhqVPN server IP.

SUPPORT
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
  fire: `ProxhqVPN — Amazon Fire Stick / Fire TV README
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

REQUIREMENTS
- Fire Stick (any generation) or Fire TV
- Downloader app (free on Amazon App Store)

STEP 1 — Enable Apps from Unknown Sources
  Fire Stick Settings → My Fire TV → Developer Options → Apps from Unknown Sources → ON

STEP 2 — Install Downloader
  Fire Stick → Find → Search → "Downloader" → Install

STEP 3 — Download WireGuard APK
  Open Downloader → enter URL:
    https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk
  Tap "Go" → Download → Install → Done

STEP 4 — Get Your Config
  On a phone/computer: sign in to ProxhqVPN → WireGuard Config → "Show QR Code"
  In WireGuard on Fire Stick: tap + → Scan QR Code

STEP 5 — Connect
  Tap the tunnel name → toggle Active. VPN key icon appears at top of screen.

TIP
  Connect your Fire Stick remote → navigate WireGuard using the D-pad.

SUPPORT
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
  router: `ProxhqVPN — Router Setup README
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

SUPPORTED FIRMWARE
  - OpenWRT (recommended)
  - DD-WRT
  - AsusWRT-Merlin
  - pfSense / OPNsense
  - GL.iNet (native WireGuard support)
  - Ubiquiti EdgeOS

WHY USE ROUTER SETUP?
  Protects every device on your network (TVs, consoles, phones, smart home)
  without installing any app on each device.

STEP 1 — Generate Router Config
  Sign in to ProxhqVPN → Router Config (/router-config)
  Select your firmware → your safe LAN IP is auto-detected and embedded in kill switch rules.

STEP 2 — OpenWRT Quick Install
  SSH into your router as root, then run:
    opkg update
    opkg install wireguard-tools kmod-wireguard luci-proto-wireguard
    
  Paste the generated config block into /etc/config/network
  Then: /etc/init.d/network restart

STEP 3 — GL.iNet (Simplest Option)
  GL.iNet routers have native WireGuard support.
  Admin Panel → VPN → WireGuard Client → Add Profile → paste config → Connect

STEP 4 — Verify
  From any device on your network:
    curl https://api64.ipify.org
  IP should show ProxhqVPN server address.

SUPPORT
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
  appletv: `ProxhqVPN — Apple TV Setup README
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

REQUIREMENTS
  Apple TV HD or Apple TV 4K running tvOS 17+

RECOMMENDED METHOD — Router Setup
  Apple TV cannot run VPN apps directly.
  The best approach: install ProxhqVPN on your router.
  See: https://proxhqvpn.com/downloads (Router section)

ALTERNATIVE — iPhone VPN Hotspot
  1. Set up ProxhqVPN on your iPhone (see iOS README).
  2. Turn on iPhone Personal Hotspot.
  3. Connect Apple TV to iPhone hotspot via Wi-Fi.
  4. Apple TV traffic is tunneled through ProxhqVPN on your iPhone.

ALTERNATIVE — WireGuard on tvOS (Beta)
  The WireGuard tvOS app is available on the App Store:
  https://apps.apple.com/us/app/wireguard/id1451685025
  Set up is identical to iOS — scan QR from ProxhqVPN → WireGuard Config.

SUPPORT
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
};

function downloadReadme(platform: string) {
  const content = README_CONTENT[platform];
  if (!content) return;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ProxhqVPN-Setup-${platform.charAt(0).toUpperCase() + platform.slice(1)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const README_PLATFORMS = [
  { id: "windows",  label: "Windows",       emoji: "🪟" },
  { id: "mac",      label: "macOS",          emoji: "🍎" },
  { id: "linux",    label: "Linux",          emoji: "🐧" },
  { id: "android",  label: "Android",        emoji: "📱" },
  { id: "ios",      label: "iPhone/iPad",    emoji: "📱" },
  { id: "fire",     label: "Fire Stick",     emoji: "🔥" },
  { id: "router",   label: "Router Setup",   emoji: "📡" },
  { id: "appletv",  label: "Apple TV",       emoji: "📺" },
];

function ReadmeDownloads() {
  return (
    <div className="border border-primary/20 rounded-xl p-4 space-y-3 bg-primary/[0.02]">
      <div className="flex items-center gap-2">
        <BookOpen className="w-4 h-4 text-primary/70 shrink-0" />
        <div>
          <div className="text-[11px] font-bold text-primary">Platform README & Installer Guides</div>
          <div className="text-[9px] font-mono text-primary/50 mt-0.5">Download a step-by-step text setup guide for any device. Includes WireGuard install commands and troubleshooting tips.</div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {README_PLATFORMS.map(({ id, label, emoji }) => (
          <button
            key={id}
            onClick={() => downloadReadme(id)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-primary/15 bg-black hover:bg-primary/5 hover:border-primary/30 transition-all text-left group"
          >
            <span className="text-sm">{emoji}</span>
            <div className="min-w-0">
              <div className="text-[10px] font-mono font-bold text-primary/80 group-hover:text-primary truncate">{label}</div>
              <div className="text-[8px] font-mono text-primary/30">README.txt</div>
            </div>
            <FileText className="w-3 h-3 text-primary/20 group-hover:text-primary/50 ml-auto shrink-0 transition-colors" />
          </button>
        ))}
      </div>
      <div className="text-[9px] font-mono text-primary/30 flex items-center gap-1.5">
        <Download className="w-3 h-3" />
        Each guide downloads as a .txt file — open with any text editor or share via USB
      </div>
    </div>
  );
}

// Search icon not imported above — add it
function Search(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  );
}
