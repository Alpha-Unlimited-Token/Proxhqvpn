// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import JSZip from "jszip";
import { PageSEO } from "@/components/PageSEO";
import {
  Monitor, Smartphone, Tv, Router, Download, CheckCircle,
  ChevronDown, ChevronUp, AlertCircle, ExternalLink, Cpu,
  Tablet, Gamepad2, Wifi, Copy, Check, Flame, Apple,
  Star, Info, Package, Shield, Archive,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── WireGuard APK — direct link (official WireGuard release) ─────────────────
const WG_APK_URL      = "https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk";
const WG_WIN_URL      = "https://download.wireguard.com/windows-client/wireguard-installer.exe";
const WG_APPSTORE_MAC = "https://apps.apple.com/us/app/wireguard/id1451685025";
const PROXHQ_WIN_INSTALLER     = `${BASE}/downloads/ProxhqVPN-Windows-x64.zip`;
const PROXHQ_MAC_INSTALLER     = `${BASE}/downloads/ProxhqVPN-macOS-arm64.zip`;
const PROXHQ_MAC_INTEL         = `${BASE}/downloads/ProxhqVPN-macOS-x64.zip`;
const PROXHQ_LINUX_INSTALLER   = `${BASE}/downloads/ProxhqVPN-Linux-x64.zip`;
const PROXHQ_ANDROID_INSTALLER = `${BASE}/downloads/ProxhqVPN-Android.zip`;
const PROXHQ_IOS_INSTALLER     = `${BASE}/downloads/ProxhqVPN-iOS.zip`;
const PROXHQ_UNIVERSAL         = `${BASE}/downloads/ProxhqVPN-Universal-NodeJS.zip`;
const PROXHQ_ALL_PLATFORMS     = `${BASE}/downloads/ProxhqVPN-ALL-PLATFORMS.zip`;
const APP_VERSION               = "2.1.0";
const RELEASE_DATE              = "June 6, 2026";
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
        badge: "Auto-Configure Installer", badgeColor: "text-blue-400 border-blue-500/30 bg-blue-900/10",
        canInstall: true,
        downloads: [
          { label: `Download ProxhqVPN v${APP_VERSION} — Windows x64 (.zip)`, url: PROXHQ_WIN_INSTALLER, variant: "primary", icon: Download },
        ],
        steps: [
          { text: `v${APP_VERSION} — ${RELEASE_DATE}. Includes ⚔ Counter Attack tab, Ghost Trap honeypot, DNS Sinkhole, Network Monitor, SIEM, OSINT Recon, and all recent security upgrades. Force-update available on Downloads page.` },
          { text: "Download the ProxhqVPN .zip, extract it, and run 'start.bat'. Windows will open the dashboard in your browser automatically." },
          { text: "SmartScreen warning? Click 'More info' → 'Run anyway'. Normal for any installer downloaded outside the Microsoft Store." },
          { text: "Screen 1 — Welcome: overview of everything that will install automatically. Click 'Get Started'." },
          { text: "Screen 2 — License & Tunnel Mode: tick the checkbox to accept, then pick Split Tunnel (★ Recommended — your apps work normally) or Full Tunnel (all traffic encrypted)." },
          { text: "Screen 3 — Silent WireGuard Install: the wizard downloads WireGuard from wireguard.com and runs it with the /S silent flag. The UI stays fully responsive throughout — a live log and progress bar show every step. Phase badges track: ① WireGuard → ② Sign In → ③ Activate." },
          { text: "Screen 4 — Sign In: your default browser (Edge/Chrome) opens the ProxhqVPN sign-in page. Sign in, go to WireGuard Config → Generate Config → Download. The wizard watches your Downloads folder — the moment the .conf file lands it picks it up automatically." },
          { text: "Screen 5 — Auto-Activate: the wizard reads your config, patches AllowedIPs for your chosen tunnel mode, saves it to the WireGuard directory, and runs wireguard.exe /installtunnel — VPN goes live with no extra clicks." },
          { text: "Screen 6 — Done: green/orange status dots confirm WireGuard, tunnel state, mode, and shortcuts. Click 'Open ProxhqVPN' to reach your dashboard." },
        ],
        note: "The installer requests admin rights once at launch (needed for WireGuard and tunnel activation). WireGuard installs silently from wireguard.com with no extra prompts. Your default browser handles sign-in so modern auth works correctly.",
      },
      {
        id: "macos", name: "macOS", os: "macOS 11+  ·  Intel & Apple Silicon",
        icon: Monitor, iconColor: "text-white/90",
        badge: "GUI Wizard Installer", badgeColor: "text-primary border-primary/30 bg-primary/10",
        canInstall: true,
        downloads: [
          { label: `Download ProxhqVPN v${APP_VERSION} — Apple Silicon (.zip)`, url: PROXHQ_MAC_INSTALLER, variant: "primary", icon: Download },
          { label: `Download ProxhqVPN v${APP_VERSION} — Mac Intel (.zip)`, url: PROXHQ_MAC_INTEL, variant: "primary", icon: Download },
          { label: "WireGuard on Mac App Store", url: WG_APPSTORE_MAC, variant: "store", icon: Apple },
        ],
        steps: [
          { text: `v${APP_VERSION} — ${RELEASE_DATE}. Includes ⚔ Counter Attack tab, Ghost Trap honeypot, DNS Sinkhole, Network Monitor, SIEM, OSINT Recon, and all recent security upgrades. Force-update available on Downloads page.` },
          { text: "Download the correct .zip for your Mac (Apple Silicon = M1/M2/M3/M4 chips, Intel = older Macs). Unzip and run 'start.sh'." },
          { text: "Double-click the app to launch the setup wizard." },
          { text: "If macOS says 'can't be opened because it's from an unidentified developer' — this is normal for apps downloaded outside the App Store." },
          { text: "To allow it: go to Apple Menu → System Settings → Privacy & Security → scroll to Security → click 'Open Anyway' next to ProxhqVPN." },
          { text: "Or: right-click (Control+click) the app → Open → Open. After you allow it once, it opens normally forever." },
          { text: "Follow the wizard: Welcome → License → Install Location (All Users or Just Me) → WireGuard → Done." },
          { text: "The wizard installs WireGuard and adds ProxhqVPN to your Applications folder. Click 'Launch Now' to sign in." },
        ],
        note: "No App Store required. The installer uses native macOS dialog boxes — no terminal, no commands.",
      },
      {
        id: "linux", name: "Linux", os: "Ubuntu · Debian · Fedora · Arch · More",
        icon: Monitor, iconColor: "text-orange-400",
        badge: "GUI Wizard Installer", badgeColor: "text-orange-400 border-orange-500/30 bg-orange-900/10",
        canInstall: true,
        downloads: [
          { label: `Download ProxhqVPN v${APP_VERSION} — Linux x64 (.zip)`, url: PROXHQ_LINUX_INSTALLER, variant: "primary", icon: Download },
          { label: `Download v${APP_VERSION} — Universal (any OS + Node.js)`, url: PROXHQ_UNIVERSAL, variant: "primary", icon: Download },
        ],
        steps: [
          { text: `v${APP_VERSION} — ${RELEASE_DATE}. Includes ⚔ Counter Attack tab, Ghost Trap honeypot, DNS Sinkhole, Network Monitor, SIEM, OSINT Recon, and all recent security upgrades. Force-update available on Downloads page.` },
          { text: "Download the Linux x64 .zip and extract it — you will get a self-contained 'ProxhqVPN' executable." },
          { text: "Make it executable: right-click → Properties → Permissions → check 'Allow executing file as program'." },
          { text: "Double-click the file in your file manager and choose 'Run' or 'Run in Terminal'." },
          { text: "The wizard uses your desktop's native GUI dialogs (GNOME, KDE, or terminal fallback) — Welcome → License → Install → WireGuard → Done." },
          { text: "The installer adds a desktop shortcut, registers ProxhqVPN in your app menu, and installs WireGuard via your package manager (apt/dnf/pacman)." },
          { text: "Or run manually in a terminal:", code: "chmod +x ProxhqVPN-Linux-Install.sh && ./ProxhqVPN-Linux-Install.sh" },
          { text: "After install: open ProxhqVPN → WireGuard Config → Download .conf, then:", code: "sudo wg-quick up ~/Downloads/proxhq.conf" },
        ],
        note: "Works on all major distros. Uses zenity (GNOME), yad, or kdialog for native GUI — falls back to terminal if none available.",
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
          { label: "Download ProxhqVPN Setup Guide — Android (.zip)", url: PROXHQ_ANDROID_INSTALLER, variant: "primary", icon: Download },
          { label: "WireGuard on Google Play", url: WG_PLAY_URL, variant: "apk" },
          { label: "WireGuard APK (sideload)", url: WG_APK_URL, variant: "apk", icon: Package },
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
          { label: "Download ProxhqVPN Setup Guide — iPhone (.zip)", url: PROXHQ_IOS_INSTALLER, variant: "primary", icon: Download },
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
            {/* ZIP setup bundle — always shown */}
            <button
              onClick={() => downloadPlatformZip(p.id, p.name)}
              className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg transition-colors bg-primary/10 text-primary/70 hover:bg-primary/20 hover:text-primary border border-primary/20 hover:border-primary/40"
              title="Download README + User Guide + Quick Start as ZIP"
            >
              <Archive className="w-3 h-3" />
              Setup Bundle (.zip)
            </button>
          </div>
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
  const [search, setSearch]                 = usePersistedState<string>("downloads-search", "");
  const [platform, setPlatform]             = useState<string | null>(null);
  const [isFireOS, setIsFireOS]             = useState(false);
  const [detectedPlatform, setDetectedPlatform] = useState<string | null>(null);

  // ── Update checker ────────────────────────────────────────────────────────
  const [updateChecking,  setUpdateChecking]  = useState(false);
  const [updateResult,    setUpdateResult]    = useState<null | { upToDate: boolean; runningVersion?: string; latestVersion: string; changelog?: string[] }>(null);

  function semverGt(a: string, b: string): boolean {
    const pa = a.split(".").map(Number);
    const pb = b.split(".").map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
      if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
    }
    return false;
  }

  const checkForUpdates = async () => {
    setUpdateChecking(true);
    setUpdateResult(null);
    try {
      const r = await fetch("/api/update/check");
      if (!r.ok) throw new Error("unreachable");
      const data = await r.json() as { version?: string; changelog?: string[] };
      const running = data.version ?? "0.0.0";
      setUpdateResult({
        upToDate: !semverGt(APP_VERSION, running),
        runningVersion: running,
        latestVersion: APP_VERSION,
        changelog: data.changelog,
      });
    } catch {
      // Web app — always served at latest version; standalone server unreachable
      setUpdateResult({ upToDate: true, runningVersion: APP_VERSION, latestVersion: APP_VERSION });
    }
    setUpdateChecking(false);
  };

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

      {/* ── What's New in v2.0.0 ───────────────────────────────────────────── */}
      <div className="border border-primary/20 rounded-xl overflow-hidden bg-primary/[0.03]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-primary/15 bg-primary/[0.04]">
          <div className="flex items-center gap-2.5">
            <Star className="w-3.5 h-3.5 text-primary/70" />
            <span className="text-[12px] font-bold tracking-widest uppercase text-primary/80">What's New in v{APP_VERSION}</span>
            <span className="text-[9px] font-bold uppercase tracking-widest text-black bg-primary px-1.5 py-0.5 rounded-full leading-none">NOW LIVE</span>
          </div>
          <span className="text-[10px] text-primary/40 font-mono">{RELEASE_DATE}</span>
        </div>
        <div className="px-5 py-4 grid gap-2 sm:grid-cols-2">
          {[
            { label: "⚔ Counter Attack Tab",  desc: "Ghost Trap: live tools to strike back — port scan, OSINT, canary inject, payload reflect", badge: "NEW" },
            { label: "Canary Beacon Injector", desc: "6 beacon types: Pixel, JS fingerprint, Fake AWS Key, JWT session, DNS, SQL OOB exfil", badge: "NEW" },
            { label: "Ghost Trap Honeypot",    desc: "Personal device & website modes — instant attacker reports + counter-intelligence" },
            { label: "DNS Sinkhole",           desc: "Pi-hole style blocking: Ads, Trackers, Malware, Phishing, Botnet C2" },
            { label: "Network Monitor",        desc: "Real-time traffic flow analysis across all 60 VPN nodes" },
            { label: "SIEM Event Log",         desc: "Unified security timeline with severity filtering across all sources" },
            { label: "OSINT Recon",            desc: "DNS, TLS, HTTP headers, email security, ASN fingerprinting" },
            { label: "QuantumAudit",           desc: "Blockchain smart contract + post-quantum vulnerability scanner" },
            { label: "Ghost Trace",            desc: "VPN-native outbound behavioral analysis — detects C2 beaconing" },
            { label: "Ghost Chain",            desc: "Automated kill-chain discovery and attack-path intelligence" },
            { label: "JWT Analyzer",           desc: "JWKS injection, X5U, Embedded JWK, kid SQL/path injection attacks" },
            { label: "Subdomain Scanner",      desc: "9 passive OSINT sources including crt.sh, AlienVault, Wayback" },
          ].map(({ label, desc, badge }) => (
            <div key={label} className="flex items-start gap-2.5">
              <CheckCircle className="w-3.5 h-3.5 text-primary/60 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-1.5">
                  <div className="text-[11px] font-semibold text-white/80 leading-snug">{label}</div>
                  {badge && <span className="text-[8px] font-bold uppercase tracking-widest text-black bg-primary px-1 py-0.5 rounded-full leading-none">{badge}</span>}
                </div>
                <div className="text-[10px] text-primary/40 font-mono leading-snug mt-0.5">{desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-primary/10 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-[10px] text-primary/35 font-mono">Already running the standalone app? Re-download below to get all updates.</span>
          <a
            href={PROXHQ_ALL_PLATFORMS}
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-black bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/85 transition-colors"
          >
            <Archive className="w-3 h-3" /> Download v{APP_VERSION} — All Platforms
          </a>
        </div>
      </div>

      {/* ── Software Update Checker ───────────────────────────────────────── */}
      <div className="border border-primary/20 rounded-xl overflow-hidden bg-primary/[0.02]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-primary/10 bg-primary/[0.03]">
          <div className="flex items-center gap-2.5">
            <svg className="w-3.5 h-3.5 text-primary/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span className="text-[12px] font-bold tracking-widest uppercase text-primary/80">Software Updates</span>
            <span className="text-[10px] font-mono text-primary/40 ml-1">Latest: v{APP_VERSION}</span>
          </div>
          <span className="text-[10px] text-primary/30 font-mono">{RELEASE_DATE}</span>
        </div>
        <div className="px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 min-w-0 space-y-1">
            {!updateResult ? (
              <div className="space-y-0.5">
                <div className="text-[12px] font-semibold text-white/80">ProxhqVPN v{APP_VERSION}</div>
                <div className="text-[11px] text-white/40 leading-snug">
                  Web app users are always on the latest version automatically.
                  Standalone app users can click <span className="text-primary/70">Check for Updates</span> to see if a newer version is available without waiting for the background check.
                </div>
              </div>
            ) : updateResult.upToDate ? (
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-green-500/15 border border-green-500/25 flex items-center justify-center shrink-0">
                  <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-green-300">You're up to date — v{updateResult.runningVersion}</div>
                  <div className="text-[10px] text-white/35 font-mono mt-0.5">
                    {updateResult.runningVersion === APP_VERSION ? "Running the latest version. No action needed." : "Web app is always current. Re-check after a new build ships."}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0 animate-pulse">
                    <svg className="w-3.5 h-3.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold text-primary">
                      Update available — v{updateResult.latestVersion}
                    </div>
                    <div className="text-[10px] text-white/40 font-mono mt-0.5">
                      You are running v{updateResult.runningVersion}. Download the new version below.
                    </div>
                  </div>
                </div>
                {updateResult.changelog && updateResult.changelog.length > 0 && (
                  <div className="pl-9 space-y-1 max-h-36 overflow-y-auto">
                    {updateResult.changelog.slice(0, 8).map((item, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-[10px] text-white/50">
                        <span className="text-primary/50 shrink-0 mt-0.5">▸</span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="pl-9 flex flex-wrap gap-2">
                  <a href={PROXHQ_ALL_PLATFORMS}
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-black bg-primary px-3 py-1.5 rounded-lg hover:bg-primary/85 transition-colors">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Update Now — All Platforms
                  </a>
                  <a href={`#windows`} onClick={() => setTimeout(() => document.getElementById("windows")?.scrollIntoView({ behavior: "smooth" }), 100)}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium text-primary/70 border border-primary/25 px-3 py-1.5 rounded-lg hover:bg-primary/5 transition-colors">
                    See platform-specific downloads ↓
                  </a>
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <button
              onClick={checkForUpdates}
              disabled={updateChecking}
              className="inline-flex items-center gap-2 text-[11px] font-semibold px-4 py-2 rounded-lg border border-primary/30 bg-primary/8 text-primary hover:bg-primary/15 transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {updateChecking ? (
                <>
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Checking…
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Check for Updates
                </>
              )}
            </button>
            {updateResult && (
              <button onClick={() => setUpdateResult(null)} className="text-[9px] text-white/25 hover:text-white/40 transition-colors font-mono">
                Clear result
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Fire OS detection banner */}
      {isFireOS && <FireStickBanner />}

      {/* Smart download for current device */}
      {!isFireOS && detectedPlatform && detectedPlatform !== "unknown" && (() => {
        const dlMap: Record<string, { label: string; url: string; variant: "primary"|"store"|"apk" }> = {
          windows: { label: "Download ProxhqVPN Installer for Windows (.zip)", url: PROXHQ_WIN_INSTALLER, variant: "primary" },
          mac:     { label: "Download ProxhqVPN Installer for Mac (.zip)",     url: PROXHQ_MAC_INSTALLER, variant: "primary" },
          android: { label: "Download ProxhqVPN Setup Guide for Android (.zip)", url: PROXHQ_ANDROID_INSTALLER, variant: "primary" },
          ios:     { label: "Download ProxhqVPN Setup Guide for iPhone (.zip)",  url: PROXHQ_IOS_INSTALLER, variant: "primary" },
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

      {/* v2.0.0 release banner + All Platforms download */}
      <div className="border border-primary/30 rounded-xl p-4 bg-primary/5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <div className="text-[9px] font-mono font-bold text-primary uppercase tracking-widest flex items-center gap-2">
              <Star className="w-3 h-3" /> ProxhqVPN v{APP_VERSION} — {RELEASE_DATE}
            </div>
            <div className="text-[10px] font-mono text-primary/55 mt-0.5">
              ⚔ Counter Attack · Ghost Trap · DNS Sinkhole · Network Monitor · SIEM · OSINT Recon · QuantumAudit · Signature Mining Engine · Force-Update
            </div>
          </div>
          <a href={PROXHQ_ALL_PLATFORMS} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold px-4 py-2 rounded-lg bg-primary text-black hover:bg-primary/80 transition-colors shrink-0">
            <Download className="w-3.5 h-3.5" /> All Platforms Bundle (.zip)
          </a>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: "Windows x64", url: PROXHQ_WIN_INSTALLER },
            { label: "macOS Apple Silicon", url: PROXHQ_MAC_INSTALLER },
            { label: "macOS Intel", url: PROXHQ_MAC_INTEL },
            { label: "Linux x64", url: PROXHQ_LINUX_INSTALLER },
            { label: "Android", url: PROXHQ_ANDROID_INSTALLER },
            { label: "iPhone / iPad", url: PROXHQ_IOS_INSTALLER },
          ].map(d => (
            <a key={d.label} href={d.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[9px] font-mono text-primary/70 hover:text-primary border border-primary/20 hover:border-primary/50 bg-black rounded-lg px-3 py-2 transition-colors">
              <Download className="w-2.5 h-2.5 shrink-0" /> {d.label}
            </a>
          ))}
        </div>
        <div className="text-[9px] font-mono text-primary/30 flex items-center gap-1.5">
          <Wifi className="w-2.5 h-2.5" />
          Auto-update: the standalone server checks <span className="text-primary/50">/api/update/check</span> on startup and notifies you when a new version is available.
        </div>
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

    </div>
  );
}

// ── ZIP bundle generator (README + User Guide + Quick Start per platform) ─────
// Each platform's ZIP contains: README.txt + User_Guide.txt + Quick_Start.txt

const QUICK_START_TXT = `ProxhqVPN — Quick Start Guide
==============================
ALPHA UNLIMITED TECHNOLOGIES LLC | https://proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — CREATE YOUR ACCOUNT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Visit: https://proxhqvpn.com/sign-in
  Sign up with email or use Google / GitHub SSO.

STEP 2 — CHOOSE A PLAN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  VPN Basic:           $6.99/mo or $59.99/yr
  Command Center Pro:  $39.99/mo or $349.99/yr
  Subscribe at: https://proxhqvpn.com/pricing
  Use an Ambassador promo code at checkout for a 10% discount.

STEP 3 — GENERATE YOUR WIREGUARD CONFIG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Sign in → WireGuard Config (/wireguard) → click "Generate"
  Download the .conf file (desktop) or show QR code (mobile/TV)

STEP 4 — INSTALL WIREGUARD ON YOUR DEVICE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  See your platform-specific README.txt in this bundle for
  exact install instructions for your operating system.
  All platform downloads: https://proxhqvpn.com/downloads

STEP 5 — IMPORT YOUR CONFIG & CONNECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Desktop: Import the .conf file into WireGuard → Activate
  Mobile:  Scan the QR code in the WireGuard app → Toggle ON
  Router:  Paste the generated config block → restart network

STEP 6 — VERIFY YOU'RE PROTECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Visit: https://api64.ipify.org
  The IP shown must be a ProxhqVPN server IP, not your real IP.
  Run a full leak test at: https://proxhqvpn.com/leaks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ★ Exploit Importer — Instructions Tab
    Every detected vulnerability now includes a complete
    step-by-step exploitation guide: tools required (with
    exact install commands), prerequisites, numbered attack
    walkthrough, how to verify, and corrected code remediation.

  ★ 24 Built-In Vulnerability Guides
    SQLi, XSS, RCE, LFI, SSRF, XXE, IDOR, CSRF, JWT attacks,
    Deserialization, SSTI, CORS misconfig, Auth Bypass, .env/.git
    Exposure, Missing Headers, No Rate Limiting, Hardcoded Secrets,
    Buffer Overflow, Mass Assignment, Weak TLS, Spring Actuator,
    Open Redirect, Default Credentials, GraphQL Security.

  ★ Download Full Report Button
    Export a complete .md pentest report from any Exploit Importer
    scan — every finding, full guide, PoC code, and remediation.
    Ready to share with clients or teams.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email:     support@proxhqvpn.com
  Full guide: https://proxhqvpn.com/guide
  Downloads:  https://proxhqvpn.com/downloads
  Pricing:    https://proxhqvpn.com/pricing
`;

const USER_GUIDE_TXT = `ProxhqVPN — Full User Guide
============================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
★ Exploit Importer — Instructions Tab
  Each detected vulnerability now opens a complete exploitation
  guide covering tools required (with exact install commands for
  all OS), prerequisites, numbered step-by-step attack walkthrough,
  how to verify the exploit, corrected code remediation examples,
  and curated reference links (PortSwigger, OWASP, NVD).

★ 24 Built-In Vulnerability Guides
  SQL Injection, XSS (reflected/stored/DOM), RCE, LFI, SSRF, XXE,
  IDOR, CSRF, JWT Vulnerabilities, Deserialization, SSTI, CORS
  Misconfiguration, Auth Bypass, .env/.git Exposure, Missing Security
  Headers, No Rate Limiting, Hardcoded Secrets, Buffer Overflow, Mass
  Assignment, Weak TLS, Spring Actuator Exposure, Open Redirect,
  Default Credentials, GraphQL Security, CVE-Based Exploits.

★ Download Full Report
  The green "Download Full Report" button in Exploit Importer exports
  a complete Markdown (.md) pentest report covering every finding:
  full guide, PoC code, remediation, and reference links. Ready to
  share with clients or security teams.

★ Three-Tab Result Cards
  Every Exploit Importer finding now has three tabs:
    [Details]      — raw evidence, CVE ID, severity badge
    [Instructions] — complete step-by-step exploitation guide
    [Exploit Code] — ready-to-run PoC code (Python/Bash/SQL/JS/XML)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PLAN OVERVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VPN Basic:           $6.99/mo or $59.99/yr
Command Center Pro:  $39.99/mo or $349.99/yr

VPN Basic includes:
  WireGuard VPN, Kill Switch, DNS Shield, DNS Sinkhole,
  Network Traffic Monitor, Leak Detection, Smart DNS,
  Split Tunneling, VPN Gate (double-hop), Onion Browser (Tor over VPN),
  Obfuscation (Stealth Mode), Router Config, VPN Coexistence,
  Device Manager, IP Exposure Scanner, GPS Spoofing,
  Port Forwarding, Dedicated Static IP, Meshnet,
  Data Broker Opt-Out (180+ brokers)

Command Center Pro (everything in Basic plus):
  Alpha Toolkit (Universal Scanner + Verifier + Web Scraper),
  SQLmap Vulnerability Scanner, HTTP Probe, Directory Fuzzer,
  Subdomain Scout, Threat Intelligence, Security Audit,
  Threat Monitor (Beacons), Firewall Manager, Remote Terminal,
  Database Interface, SilkWeb Honeypot, Encoder/Decoder,
  Request Comparer, Payload Generator, CVE Lookup, Intruder,
  SIEM (Security Event Log), OSINT Recon, Canary Tokens,
  Ghost Chain Exploit Arsenal, Exploit Importer,
  OAST Tester, Dependency Scanner, Token Sequencer,
  WebSocket Tester, SAST Scanner

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VPN CONNECTION (/my-vpn)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The main VPN connection page. Shows your active WireGuard tunnel status,
connected server, connection time, and bandwidth. Connect/disconnect here.

WireGuard Config (/wireguard):
  - Generate your private/public keypair (server stores only the public key)
  - Download .conf file or show QR code for mobile import
  - Regenerate at any time (old keypair is immediately revoked)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
KILL SWITCH (/kill-switch)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Blocks ALL internet traffic if the VPN drops unexpectedly, preventing
IP leaks. Three modes:
  - Strict: Block everything if VPN is down (recommended)
  - Allow LAN: Block internet but allow local network access
  - Custom: Whitelist specific IPs or CIDRs to always bypass the kill switch

Platform-specific firewall rule generators for Linux (iptables/nftables),
macOS (pf), and Windows (netsh) are included.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LEAK DETECTION (/leaks)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Tests your VPN connection for three types of leaks:
  - DNS Leak: Verifies DNS queries go through ProxhqVPN, not your ISP
  - IPv6 Leak: Checks for IPv6 address exposure (common on dual-stack ISPs)
  - WebRTC Leak: Tests if the browser leaks your local IP via WebRTC

If a leak is detected, follow the on-screen remediation steps.
Enable Kill Switch + use DNS Shield to eliminate most leaks.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DNS SHIELD (/dns-shield)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Encrypted DNS resolver with built-in blocking lists:
  - Ads & Trackers: Blocks 100k+ advertising and tracking domains
  - Malware: Blocks known malware distribution and phishing domains
  - Adult Content: Optional category-based blocking
  - Custom: Add your own allow/block rules (one domain per line)
  - DNS-over-HTTPS: Routes DNS queries over encrypted HTTPS (no ISP snooping)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPLIT TUNNELING (/split-tunnel)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Route only specific traffic through the VPN. Bypass rules by:
  - IP Address / CIDR: Force specific IPs to bypass or use the VPN
  - Domain: Bypass VPN for specific websites (e.g., local banking, corporate intranet)
  - Port: Bypass VPN for specific ports (e.g., gaming UDP ports for low latency)
  - Application: Per-app VPN rules (Linux only via cgroups)

Generates platform-specific scripts (Linux ip rules, Windows route commands).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VPN GATE DOUBLE-HOP (/vpngate)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Routes traffic through an additional relay VPN Gate server before reaching
the destination. Your traffic: Your Device → ProxhqVPN → VPN Gate Relay → Internet.
The destination site sees a VPN Gate relay IP, not your ProxhqVPN server IP.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ONION BROWSER (TOR OVER VPN) (/onion-browser)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Browse .onion sites and surface web through Tor, tunneled through ProxhqVPN.
Connection chain: Your Device → ProxhqVPN → Tor Entry → Tor Relay → Tor Exit → Destination
The Tor exit node IP is shown. You are NOT identified to the destination.

Proxy modes: Direct / ProxhqVPN Onion / Tor / Double-hop / Custom SOCKS4/5/HTTP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SMART DNS (/smart-dns)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DNS-only geo-bypass for streaming (Netflix, Hulu, BBC iPlayer) on any
device including Smart TVs and game consoles that cannot run VPN apps.
Copy the two DNS server IPs and enter them in your device network settings.
Note: Smart DNS does NOT encrypt traffic — for privacy, use the full VPN.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ROUTER CONFIG (/router-config)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Generates firmware-specific WireGuard configs for routers. Supported:
OpenWRT, DD-WRT, AsusWRT-Merlin, pfSense/OPNsense, GL.iNet, Ubiquiti EdgeOS.
Your current IP is auto-detected and embedded in the kill switch rules.
Protects every device on your network automatically.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IP EXPOSURE SCANNER (/ip-exposure) — VPN Basic
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Shows exactly what your IP reveals: geolocation, ISP, VPN/proxy detection,
WebRTC leak, DNS leak, browser fingerprint risk. Run before and after
connecting to ProxhqVPN to verify coverage.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
COMMAND CENTER PRO TOOLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Alpha Toolkit (/alpha-tools):
  Three engines: Universal Scanner (35+ languages, 200+ vuln patterns),
  Vulnerability Verifier (actively probes Scanner findings), Web Scraper
  (browser-based, stores to 14-table SQLite DB). All Tor-routable.

Vulnerability Scanner (/sqlmap):
  Full SQLmap integration for automated SQL injection testing.
  Modes: GET/POST/form-data, all DBMS types, Tor routing, tamper scripts.

HTTP Probe (/http-probe):
  Full HTTP client — all methods, custom headers, body editors.
  Equivalent to Burp Suite Repeater. Full response inspector.

Directory Fuzzer (/dir-fuzzer):
  Brute-force hidden files/dirs with wordlists. Equivalent to ffuf/gobuster.
  Common wordlists: admin panels, API routes, git/config files, backups.

Subdomain Scout (/subdomain-scan):
  Certificate Transparency log enumeration + DNS brute-force.
  Passive (CT logs) or active (DNS resolution) enumeration modes.

Threat Intelligence (/threat-intel):
  IP reputation (AbuseIPDB/Shodan/GreyNoise), WHOIS, TLS cert inspector,
  HTTP headers analyzer, live threat feeds.

Security Audit (/security-audit):
  Self-audit of ProxhqVPN platform — TLS grade, open ports, WireGuard
  key strength, firewall rules, CORS, CSP headers. PASS/WARN/FAIL output.

Intruder (/intruder):
  Automated parameter fuzzer. Modes: Sniper, Battering Ram, Pitchfork,
  Cluster Bomb. Modeled after Burp Intruder.

Payload Generator (/payloads):
  Pre-built payloads: SQLi, XSS, SSTI, SSRF, XXE, RCE, Path Traversal,
  Command Injection, WAF bypass, JWT secrets, credential lists.

CVE Lookup (/cve-search):
  NVD database search by CVE ID or keyword. CVSS score filtering.
  Critical (9.0-10.0), High (7.0-8.9), Medium (4.0-6.9), Low (0.1-3.9).

Encoder / Decoder (/encoder):
  Base64, URL encode, HTML entities, Hex, Binary, MD5, SHA-1/256/512,
  HMAC-SHA256, bcrypt, JWT decode, auto-detect mode.

Request Comparer (/comparer):
  Side-by-side diff of two HTTP requests/responses. Modes: Words, Lines,
  Bytes. Useful for auth bypass detection and IDOR verification.

SIEM — Security Event Log (/siem):
  Unified event log aggregating WireGuard tunnel events, SilkWeb honeypot
  hits, firewall rule blocks, DNS sinkhole blocks, and auth failures.
  Filter by severity, source, time range. Export CSV or JSON.
  Alert rules for email notifications on specific event patterns.

OSINT Recon (/osint-recon):
  Passive intelligence aggregation across 15+ sources: Shodan, Censys,
  AbuseIPDB, VirusTotal, GreyNoise, WHOIS/RDAP, DNSDumpster, crt.sh,
  HaveIBeenPwned, URLhaus, PassiveDNS, BGP/ASN. All queries VPN-routed.
  Export findings as HTML, PDF, or JSON.

Canary Tokens (/canary-tokens):
  Invisible tripwires that alert you the instant someone accesses them.
  Token types: HTTP URL, DNS, PDF/DOCX document, Email pixel, AWS fake
  key, SQL canary row. Alerts include source IP, browser, GeoIP, OS.

Ghost Chain Exploit Arsenal (/ghost-chain):
  200+ categorized exploits with Details tab (technique, CVEs, examples)
  and Exploit PoC tab (copy-ready attack code). Categories: SQLi, XSS,
  RCE, SSRF, XXE, LFI, Deserialization, JWT, OAuth, HTTP Smuggling,
  Cache Poisoning, CORS, WebSocket hijacking, subdomain takeover.
  Integrates with HTTP Probe and Intruder (click Send to tool).

Exploit Importer (/exploit-import):
  Upload Nessus XML, Burp HTML, Nikto, ZAP, or OpenVAS reports.
  Also accepts .txt, .log, .json — ZIP archives auto-extracted.
  30+ pattern categories: SQLi, XSS, RCE, SSRF, XXE, LFI, IDOR, CSRF,
  JWT vulns, SSTI, CORS, mass assignment, GraphQL, buffer overflow,
  exposed .env/.git, hardcoded secrets, open Actuator/Swagger,
  weak TLS, no rate limiting, open redirect, default credentials.
  CVE IDs auto-extracted. Results sorted by severity.

  Each result card has THREE TABS:
    [Details]      Full evidence text, CVE hyperlinks, severity badge
    [Instructions] Complete step-by-step exploitation guide:
                   - Impact assessment
                   - Tools required (with exact install commands)
                   - Before you start / prerequisites
                   - Numbered attack walkthrough with terminal commands
                   - How to verify the exploit succeeded
                   - Remediation with corrected code examples
                   - Reference links (PortSwigger, OWASP, NVD)
    [Exploit Code] Ready-to-run PoC code (Python, Bash, SQL, JS, XML)
                   with one-click clipboard copy

  Download Full Report: Click the green button in the results header
  to download a comprehensive .md (Markdown) report of all findings —
  including full instruction guides for every vulnerability detected.
  Ideal for client deliverables, pentest reports, and team briefings.

  24 Built-in Vulnerability Guides:
    SQL Injection, XSS, RCE, LFI, SSRF, XXE, IDOR, CSRF, JWT attacks,
    Deserialization, SSTI, CORS misconfig, Auth Bypass, .env Exposure,
    .git Exposure, Missing Security Headers, No Rate Limiting,
    Hardcoded Secrets, Buffer Overflow, Mass Assignment, Weak TLS,
    Spring Actuator Exposure, Open Redirect, Default Credentials,
    GraphQL Security, CVE-Based Exploits

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VPN BASIC EXCLUSIVE FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

DNS Sinkhole (/dns-sinkhole):
  Pi-hole equivalent built into the VPN. Blocks 100k+ ad networks,
  trackers, malware distribution domains, stalkerware, and coin miners
  at the DNS layer. Custom block/allow lists with wildcard support.
  Query log shows every DNS request with ALLOWED/BLOCKED status.

Network Traffic Monitor (/network-monitor):
  Real-time flow table — every connection through the VPN tunnel.
  Columns: Source IP, Destination IP, Port, Protocol, Bytes In/Out,
  Duration, Country (GeoIP), Threat flag (AbuseIPDB/botnet check).
  Protocol breakdown tab. PCAP capture (30-sec Wireshark-compatible).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ADMIN TOOLS (Admin accounts only)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Dashboard (/dashboard):       Live platform metrics, subscription counts, MRR
VPN Servers (/nodes):         Add/remove/rotate VPN nodes, get setup scripts
Threat Monitor (/beacons):    Real-time intrusion alerts from all nodes + SilkWeb
SilkWeb Decoy (/silkweb):     Honeypot manager — trapped IPs, payloads captured
Firewall (/firewall):         iptables/nftables rules across all nodes
Performance (/monitor):       Real-time CPU/RAM/bandwidth per node
Employee Access (/employees): Manage employee accounts
Remote Terminal (/terminal):  Web shell for live VPN server management
Database (/sql):              Direct SQL interface (local + external DBs)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AMBASSADOR PROGRAM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Earn 10% commission on every subscription payment from customers you refer.
Apply at: https://proxhqvpn.com/ambassador/apply
Dashboard: https://proxhqvpn.com/ambassador/dashboard
Full handbook: https://proxhqvpn.com/handbook/ambassador

Commission rates:
  VPN Basic Monthly ($6.99):     $0.70/mo per customer
  VPN Basic Annual ($59.99):     $6.00/yr per customer
  Pro Monthly ($39.99):          $4.00/mo per customer
  Pro Annual ($349.99):          $35.00/yr per customer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ACCOUNT & BILLING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Account (/account): Manage profile, 2FA, linked OAuth accounts,
  view active sessions, rotate WireGuard keys, manage billing.
Billing is handled by Stripe (PCI-DSS Level 1). ProxhqVPN never stores
payment card data. Use Account → Manage Billing to cancel or change plans.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email:      support@proxhqvpn.com
Guide:      https://proxhqvpn.com/guide
Pricing:    https://proxhqvpn.com/pricing
Downloads:  https://proxhqvpn.com/downloads
`;

// Platform-specific README content keyed by platform ID
const README_CONTENT: Record<string, string> = {
  windows: `ProxhqVPN — Windows Setup & User Guide
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Windows 10 or Windows 11 (64-bit)
  - WireGuard for Windows (free, open source)
  - A ProxhqVPN account (proxhqvpn.com/sign-in)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — INSTALL WIREGUARD FOR WINDOWS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Download: https://download.wireguard.com/windows-client/wireguard-installer.exe
  1. Run the .exe installer (click "Yes" at the UAC prompt)
  2. WireGuard installs as a Windows Service — no reboot needed
  3. The WireGuard tray icon appears in the system notification area

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — GENERATE YOUR CONFIG FILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. Sign in at https://proxhqvpn.com/sign-in
  2. Navigate to WireGuard Config (/wireguard)
  3. Click "Generate" — your private/public keypair is created
     (your private key is generated in your browser; the server
      only stores your public key — maximum privacy)
  4. Click "Download .conf" to save your proxhq.conf file

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — IMPORT THE CONFIG & CONNECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. Open WireGuard
  2. Click the drop-down arrow next to "Add Tunnel"
  3. Select "Import tunnel(s) from file"
  4. Browse to your downloaded proxhq.conf file
  5. The tunnel "proxhq" appears in the list
  6. Click "Activate" — the indicator turns green
     Your Windows taskbar shows the WireGuard tunnel icon

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — VERIFY YOUR CONNECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Open Command Prompt (Win + R → cmd) and run:
    curl https://api64.ipify.org
  The IP address shown must be a ProxhqVPN server IP, NOT your real IP.
  Run a full leak test at: https://proxhqvpn.com/leaks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WINDOWS-SPECIFIC FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Kill Switch (/kill-switch):
    ProxhqVPN generates Windows netsh firewall rules that block
    ALL internet traffic if the VPN drops. Prevents IP leaks.
    Three modes: Strict / Allow LAN / Custom CIDR whitelist.

  Split Tunneling (/split-tunnel):
    Route only specific apps or IPs through the VPN.
    ProxhqVPN generates Windows "route add" commands for your config.
    Useful for keeping gaming UDP ports on your direct connection.

  DNS Shield (/dns-shield):
    Use ProxhqVPN's encrypted DNS-over-HTTPS to block ads, trackers,
    and malware domains. Add the DNS line to your .conf file:
      DNS = 1.1.1.1, 1.0.0.1

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exploit Importer (/exploit-import) — Command Center Pro:
  Upload scan reports (Nessus, Burp Suite, Nikto, ZAP, OpenVAS)
  and get structured findings with three tabs per result:
    [Details]      Evidence, CVE ID, severity
    [Instructions] Full step-by-step exploitation guide with
                   tool install commands and remediation code
    [Exploit Code] Ready-to-run PoC attack code
  Click "Download Full Report" to export a complete .md report.
  24 built-in vulnerability guides cover SQLi, XSS, RCE, LFI,
  SSRF, XXE, IDOR, JWT attacks, SSTI, CORS, and more.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email:      support@proxhqvpn.com
  Full guide: https://proxhqvpn.com/guide
  Downloads:  https://proxhqvpn.com/downloads
`,
  mac: `ProxhqVPN — macOS Setup & User Guide
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - macOS 12 Monterey or later (Intel or Apple Silicon)
  - WireGuard from the Mac App Store (free)
  - A ProxhqVPN account (proxhqvpn.com/sign-in)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — INSTALL WIREGUARD FOR MACOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Mac App Store: https://apps.apple.com/us/app/wireguard/id1451685025
  Click "Get" → install with your Apple ID as normal.
  WireGuard appears in your Applications folder and menu bar.

  Alternatively via Homebrew (for CLI usage):
    brew install wireguard-tools

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — GENERATE YOUR CONFIG FILE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. Sign in at https://proxhqvpn.com/sign-in
  2. Navigate to WireGuard Config (/wireguard)
  3. Click "Generate" — keypair created in-browser
  4. Click "Download .conf" → save proxhq.conf

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — IMPORT & CONNECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  App Store WireGuard:
    1. Open WireGuard → click "Import tunnel(s) from file"
    2. Select your proxhq.conf
    3. macOS shows a VPN configuration prompt — click "Allow"
    4. Go to System Settings → VPN → allow ProxhqVPN if needed
    5. Toggle the tunnel ON in WireGuard — status shows "Active"

  CLI (Homebrew):
    sudo cp proxhq.conf /etc/wireguard/proxhq.conf
    sudo wg-quick up proxhq
    sudo wg-quick down proxhq   # to disconnect

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — VERIFY YOUR CONNECTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Open Terminal and run:
    curl https://api64.ipify.org
  Must show a ProxhqVPN server IP, not your home IP.
  Full leak test: https://proxhqvpn.com/leaks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
MACOS-SPECIFIC FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Kill Switch (/kill-switch):
    ProxhqVPN generates pf (Packet Filter) firewall rules for macOS.
    Paste into /etc/pf.conf — blocks all non-VPN traffic on drop.

  Split Tunneling (/split-tunnel):
    ProxhqVPN generates macOS route commands for per-IP bypass rules.

  DNS Shield: Set DNS = 1.1.1.1 in your .conf for encrypted DNS.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exploit Importer — 24 built-in vulnerability guides, three-tab
  result cards (Details / Instructions / Exploit Code), and the
  Download Full Report button for complete .md pentest reports.
  Command Center Pro only. Full guide: https://proxhqvpn.com/guide

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
  linux: `ProxhqVPN — Linux Setup & User Guide
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Ubuntu 20.04+ / Debian 11+ / Fedora 36+ / Arch / Alpine / Kali
  - WireGuard kernel module (built into Linux kernel ≥5.6)
  - wireguard-tools package

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — INSTALL WIREGUARD TOOLS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Ubuntu / Debian / Kali:
    sudo apt update && sudo apt install wireguard wireguard-tools -y

  Fedora / RHEL 9+:
    sudo dnf install wireguard-tools -y

  Arch Linux / Manjaro:
    sudo pacman -S wireguard-tools

  Alpine Linux:
    apk add wireguard-tools

  Raspberry Pi OS (Raspbian):
    sudo apt update && sudo apt install wireguard -y

  Verify: which wg-quick   # should return /usr/bin/wg-quick

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — GENERATE YOUR CONFIG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. Sign in at https://proxhqvpn.com/sign-in
  2. Navigate to WireGuard Config (/wireguard)
  3. Click "Generate" → "Copy Config"
  4. Paste into your config file:
       sudo nano /etc/wireguard/proxhq.conf
     (or use the Download .conf button and copy it over)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — CONNECT & MANAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Start VPN:        sudo wg-quick up proxhq
  Stop VPN:         sudo wg-quick down proxhq
  Check status:     sudo wg show
  View interface:   ip a show wg0

  Enable at boot (systemd):
    sudo systemctl enable wg-quick@proxhq
    sudo systemctl start wg-quick@proxhq

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — VERIFY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  curl https://api64.ipify.org
  Should show ProxhqVPN server IP, not your real IP.
  Full leak test: https://proxhqvpn.com/leaks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LINUX-SPECIFIC FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Kill Switch — iptables:
    ProxhqVPN (/kill-switch) generates PostUp/PreDown iptables rules.
    Add them to your [Interface] block in proxhq.conf:
      PostUp   = iptables -I OUTPUT ! -o wg0 -m mark ! --mark $(wg show wg0 fwmark) -m addrtype ! --dst-type LOCAL -j REJECT
      PreDown  = iptables -D OUTPUT ! -o wg0 -m mark ! --mark $(wg show wg0 fwmark) -m addrtype ! --dst-type LOCAL -j REJECT

  Kill Switch — nftables (modern systems):
    ProxhqVPN generates equivalent nftables ruleset via /kill-switch.

  Split Tunneling (/split-tunnel):
    ProxhqVPN generates "ip rule" and "ip route" commands for
    per-IP or per-port VPN bypass on Linux.

  DNS Shield:
    Add to your [Interface] block: DNS = 1.1.1.1, 1.0.0.1
    Or use systemd-resolved for persistent encrypted DNS.

  Chromebook / Raspberry Pi:
    These platforms use the Linux instructions above.
    Raspberry Pi: tested on Raspberry Pi OS Bullseye (64-bit).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exploit Importer — 24 built-in vulnerability guides, three-tab
  result cards (Details / Instructions / Exploit Code), and the
  Download Full Report button for complete .md pentest reports.
  Ideal for security researchers, red teamers, and bug bounty hunters
  running Kali Linux. Command Center Pro only.
  Full guide: https://proxhqvpn.com/guide

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
  android: `ProxhqVPN — Android Setup & User Guide
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Android 8.0 (Oreo) or later, API level 26+
  - Works on phones, tablets, Android TV, and Nvidia Shield

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — INSTALL WIREGUARD FOR ANDROID
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Option A — Google Play Store (recommended):
    https://play.google.com/store/apps/details?id=com.wireguard.android
    Search "WireGuard" → install the official app (by WireGuard LLC)

  Option B — Direct APK (no Play Store needed):
    https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk
    Before installing: Settings → Security → Install unknown apps → ON
    Tap the downloaded APK → Install → Open

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — GET YOUR CONFIG (QR CODE METHOD)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. On a desktop/laptop: sign in to proxhqvpn.com
  2. Navigate to WireGuard Config (/wireguard)
  3. Click "Generate" → "Show QR Code"
  4. On your Android: open WireGuard → tap the blue "+" button
  5. Choose "Scan from QR code"
  6. Point your camera at the QR code on your screen
  7. The tunnel is imported with name "proxhq"

  Alternatively — File Import:
  Download the .conf file → copy to phone → WireGuard → + →
  "Import from file" → browse to proxhq.conf

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — CONNECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Tap the tunnel name "proxhq" → tap the toggle switch to ON
  Android shows a VPN key icon in the status bar = connected
  First use: Android asks to allow a VPN connection → tap "OK"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — VERIFY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Open Chrome → visit https://api64.ipify.org
  Must show a ProxhqVPN server IP, not your mobile carrier IP.
  Full leak test: https://proxhqvpn.com/leaks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ANDROID TV / NVIDIA SHIELD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Android TV and Nvidia Shield run full Android — the Play Store
  WireGuard app installs and works the same way. Use a mouse or
  connect your phone as a remote for QR code scanning.
  Alternatively, use ADB to push the .conf file and import it.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exploit Importer — 24 built-in vulnerability guides, three-tab
  result cards (Details / Instructions / Exploit Code), and the
  Download Full Report button for complete .md pentest reports.
  Access from the ProxhqVPN mobile browser at proxhqvpn.com.
  Command Center Pro only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
  ios: `ProxhqVPN — iOS & iPadOS Setup & User Guide
============================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - iPhone or iPad running iOS / iPadOS 15.0 or later
  - WireGuard from the App Store (free, developed by WireGuard LLC)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — INSTALL WIREGUARD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  App Store: https://apps.apple.com/us/app/wireguard/id1441195209
  Search "WireGuard" → install the official app
  No sign-in required for the WireGuard app itself

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — GENERATE YOUR CONFIG (QR METHOD)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. On a desktop/laptop: sign in to proxhqvpn.com
  2. Navigate to WireGuard Config (/wireguard)
  3. Click "Generate" → "Show QR Code"
  4. On your iPhone/iPad: open WireGuard → tap the "+" button
  5. Choose "Create from QR code"
  6. Point your camera at the QR code on your screen
  7. Name the tunnel "ProxhqVPN" → tap "Save"

  Alternatively — File Import:
  Download the .conf file → share it to WireGuard via iOS Share Sheet

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — CONNECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. iOS will ask to add a VPN configuration — tap "Allow"
  2. Toggle the tunnel ON in WireGuard
  3. The VPN key icon (🔑) appears in the iOS status bar = connected
  4. You can also toggle from Settings → VPN

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — VERIFY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Open Safari → visit https://api64.ipify.org
  Must show ProxhqVPN server IP, not your carrier's IP.
  Full leak test: https://proxhqvpn.com/leaks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
iOS-SPECIFIC TIPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  On-Demand Connect:
    In WireGuard, tap your tunnel → "On-Demand" → enable for
    Wi-Fi and/or Cellular. The VPN reconnects automatically.

  Personal Hotspot Sharing:
    Enable VPN on your iPhone, then share via Personal Hotspot.
    Devices connected to the hotspot (Apple TV, laptop) tunnel
    all traffic through ProxhqVPN automatically.

  iPhone as Router for Apple TV:
    This is the recommended way to protect Apple TV with ProxhqVPN.
    iPhone → VPN ON → Personal Hotspot ON → Apple TV connects to hotspot.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exploit Importer — 24 built-in vulnerability guides, three-tab
  result cards (Details / Instructions / Exploit Code), and the
  Download Full Report button for complete .md pentest reports.
  Access at proxhqvpn.com in Safari. Command Center Pro only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
  fire: `ProxhqVPN — Amazon Fire Stick & Fire TV Setup Guide
====================================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Amazon Fire Stick (any generation: Lite, 4K, 4K Max, 4K Plus)
  - Amazon Fire TV Cube or Fire TV Stick
  - The "Downloader" app (free on Amazon App Store)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — ENABLE APPS FROM UNKNOWN SOURCES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  On your Fire Stick remote, navigate to:
    Settings → My Fire TV → Developer Options
    → Apps from Unknown Sources → ON
  If "Developer Options" is not visible:
    Settings → My Fire TV → About → click "Build" 7 times rapidly
    then go back and Developer Options will appear.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — INSTALL THE DOWNLOADER APP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Fire Stick Home → Find → Search → type "Downloader"
  Install the app by AFTVnews (orange icon)
  Open Downloader and allow storage permissions when prompted

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — DOWNLOAD & INSTALL WIREGUARD APK
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Open Downloader → tap the URL bar → enter this URL exactly:
    https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk
  Tap "Go" → the APK downloads automatically
  When complete: tap "Install" → tap "Done" (not "Open" yet)
  Tap "Delete" to remove the APK file (saves storage space)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — GET YOUR WIREGUARD CONFIG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  On a phone or computer:
    1. Sign in at https://proxhqvpn.com/sign-in
    2. Navigate to WireGuard Config (/wireguard)
    3. Click "Generate" → "Show QR Code"
    4. Leave this screen open (you'll scan it in Step 5)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 — IMPORT CONFIG & CONNECT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Find WireGuard in your Fire Stick apps:
    Home → Apps → Your Apps & Channels → WireGuard
    (or use Downloader: URL bar → type "wireguard" → Find)
  Open WireGuard → tap the blue "+" button (use D-pad + OK)
  Choose "Scan from QR code"
  Point your Fire Stick camera at the QR code on your phone/computer
  Tap "Create Tunnel" → name it "ProxhqVPN"
  Toggle the tunnel ON → VPN key icon appears at the top of the screen

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 — VERIFY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Open Silk Browser → visit https://api64.ipify.org
  Must show ProxhqVPN server IP, not your home IP.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIRE STICK TIPS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  D-Pad Navigation: Use the directional pad + OK button to navigate
    the WireGuard app. Long-press OK to access context menus.

  Auto-Start: WireGuard does not auto-start on Fire Stick boot.
    Add WireGuard to your favorites and toggle ON each session,
    OR use your router as the VPN instead (see Router README).

  No Camera? Use a USB keyboard + mouse (OTG adapter) to navigate
    to WireGuard → Import from file, and copy the .conf via USB.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exploit Importer — 24 built-in vulnerability guides with
  step-by-step attack walkthroughs and downloadable .md reports.
  Command Center Pro. Access at proxhqvpn.com in Silk Browser.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
  router: `ProxhqVPN — Router Setup & User Guide
========================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHY USE A ROUTER?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Installing ProxhqVPN on your router protects EVERY device on
  your network automatically — Smart TVs, gaming consoles, phones,
  tablets, smart home devices, laptops — without installing any app
  on each device. One setup, whole-home VPN coverage.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORTED FIRMWARE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - OpenWRT (recommended — best control and kill switch support)
  - DD-WRT (for older routers)
  - AsusWRT-Merlin (for Asus routers)
  - pfSense / OPNsense (for advanced/enterprise routers)
  - GL.iNet (plug-and-play, native WireGuard support)
  - Ubiquiti EdgeOS (EdgeRouter series)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — GENERATE YOUR ROUTER CONFIG
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Sign in → Router Config (/router-config)
  Select your router firmware from the dropdown.
  Your LAN IP is auto-detected and embedded in the kill switch rules.
  Click "Generate" → copy the full config block.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OPENWRT INSTALLATION (RECOMMENDED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  SSH into your router as root:
    ssh root@192.168.1.1

  Install WireGuard packages:
    opkg update
    opkg install wireguard-tools kmod-wireguard luci-proto-wireguard

  Create and paste your config:
    nano /etc/config/network
    (paste the ProxhqVPN generated [interface] and [peer] block)

  Restart networking:
    /etc/init.d/network restart

  Verify from a connected device:
    curl https://api64.ipify.org

  Enable LuCI WireGuard UI (optional):
    opkg install luci-proto-wireguard luci-app-wireguard
    Reboot → Network → Interfaces → WireGuard visible in LuCI

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GL.INET (EASIEST — PLUG AND PLAY)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  GL.iNet routers (GL-MT3000, GL-AXT1800, GL-AX1800, etc.) have
  native WireGuard client support built in:
    1. Admin Panel (192.168.8.1) → VPN → WireGuard Client
    2. Add Profile → paste the generated config → Save
    3. Toggle WireGuard ON → connected

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PFSENSE / OPNSENSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  pfSense: Install the WireGuard package via Package Manager.
  OPNsense: WireGuard is built in (Plugins → os-wireguard).
  Use the ProxhqVPN generated [Interface] and [Peer] values
  to fill in the GUI fields for key, endpoint, and allowed IPs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
UBIQUITI EDGEOS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  EdgeOS supports WireGuard via DPKG packages:
    configure
    set interfaces wireguard wg0 address <your-vpn-ip>/32
    set interfaces wireguard wg0 private-key <your-private-key>
    set interfaces wireguard wg0 peer <server-pubkey> endpoint <server>:51820
    set interfaces wireguard wg0 peer <server-pubkey> allowed-ips 0.0.0.0/0
    commit ; save

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHICH DEVICES ARE COVERED BY ROUTER VPN?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  ✓ Samsung TVs / LG TVs / Hisense TVs
  ✓ Roku, Fire TV Stick (via router — no APK needed)
  ✓ PlayStation 4, PlayStation 5
  ✓ Xbox One, Xbox Series X/S
  ✓ Nintendo Switch
  ✓ Apple TV HD / Apple TV 4K
  ✓ Smart home devices (Ring, Nest, Alexa)
  ✓ Any phone, tablet, or laptop on your Wi-Fi

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exploit Importer — 24 built-in vulnerability guides with
  step-by-step attack walkthroughs and downloadable .md reports.
  Command Center Pro. Access at proxhqvpn.com from any browser.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
  appletv: `ProxhqVPN — Apple TV Setup Guide
==================================
ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com | support@proxhqvpn.com
Version 4.0 | Updated 2025

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
REQUIREMENTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Apple TV HD (4th gen) or Apple TV 4K (any generation)
  - Running tvOS 17.0 or later
  - Choose one of the three methods below

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHOD 1 — WIREGUARD ON TVOS (RECOMMENDED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  WireGuard is available as a native tvOS app:
    App Store on Apple TV → search "WireGuard" → Install
    (Or: https://apps.apple.com/us/app/wireguard/id1451685025)

  Import your config via QR code:
    1. On a desktop/phone: sign in to proxhqvpn.com
    2. Navigate to WireGuard Config (/wireguard)
    3. Click "Generate" → "Show QR Code"
    4. On Apple TV: open WireGuard → tap "+" → "Create from QR code"
       (Use the Apple TV camera or hold your phone's screen in front
        of the Apple TV camera — works via the tvOS QR scanner)
    5. Toggle the tunnel ON → VPN key appears at top of tvOS

  No Apple TV camera? Use the tvOS Share Clipboard method:
    - AirDrop the .conf file to Apple TV from your Mac
    - Or use Apple TV settings to sign into your iCloud
      and then use iCloud Drive to share the file

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHOD 2 — IPHONE PERSONAL HOTSPOT (EASIEST)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  You don't need to configure anything on the Apple TV itself.
  1. Set up ProxhqVPN on your iPhone (see iOS README)
  2. Connect Apple TV to your iPhone's Personal Hotspot via Wi-Fi
     (Settings → Wi-Fi on Apple TV → select your iPhone's hotspot)
  3. Enable ProxhqVPN on your iPhone → toggle WireGuard ON
  4. All Apple TV traffic is now tunneled through ProxhqVPN

  Trade-off: Your iPhone battery will drain faster, and your
  Apple TV won't work if your iPhone goes out of range.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
METHOD 3 — ROUTER SETUP (BEST FOR ALWAYS-ON)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Install ProxhqVPN on your router — every device on your Wi-Fi,
  including Apple TV, is automatically protected. No configuration
  needed on the Apple TV at all.
  See the Router README in this bundle for full instructions.
  Supported routers: OpenWRT, GL.iNet, pfSense, OPNsense, AsusWRT,
  DD-WRT, Ubiquiti EdgeOS.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERIFY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Open the Infuse or VLC browser on Apple TV and navigate to:
    https://api64.ipify.org
  Or check from any device on the same network:
    curl https://api64.ipify.org

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT'S NEW IN VERSION 4.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Exploit Importer — 24 built-in vulnerability guides with
  step-by-step attack walkthroughs and downloadable .md reports.
  Command Center Pro. Access at proxhqvpn.com from Safari on iPhone
  or Mac while your Apple TV is protected by the VPN.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SUPPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Email: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
};

// ── Shared files included in every platform ZIP ───────────────────────────────

const CHANGELOG_TXT = `ProxhqVPN — Changelog
======================
ALPHA UNLIMITED TECHNOLOGIES LLC | https://proxhqvpn.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERSION 4.0 — 2025
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEW: Exploit Importer — Instructions Tab
  Every detected vulnerability card now has a dedicated Instructions tab
  containing a complete step-by-step exploitation guide:
    - Impact Assessment
    - Tools Required (with exact apt/brew/pip/gem install commands)
    - Prerequisites & access requirements
    - Numbered attack walkthrough with terminal commands
    - How to verify the exploit succeeded
    - Remediation with corrected code examples (Node.js, Python, Java, PHP)
    - Reference links (PortSwigger, OWASP, NVD)

NEW: 24 Built-In Vulnerability Guides
  SQL Injection, XSS (reflected/stored/DOM), RCE, LFI, SSRF, XXE,
  IDOR, CSRF, JWT Vulnerabilities, Deserialization, SSTI, CORS Misconfig,
  Auth Bypass, .env Exposure, .git Exposure, Missing Security Headers,
  No Rate Limiting, Hardcoded Secrets, Buffer Overflow, Mass Assignment,
  Weak TLS, Spring Boot Actuator Exposure, Open Redirect,
  Default Credentials, GraphQL Security, CVE-Based Exploits.

NEW: Download Full Report
  Green "Download Full Report" button in Exploit Importer results header.
  Exports a complete Markdown (.md) pentest report — every finding,
  full instruction guide, PoC code, remediation, and reference links.
  Ideal for client deliverables and team briefings.

NEW: Three-Tab Result Cards
  Every Exploit Importer finding now has three tabs:
    [Details]      Raw evidence, CVE ID, severity badge
    [Instructions] Complete step-by-step exploitation guide
    [Exploit Code] Ready-to-run PoC code (Python/Bash/SQL/JS/XML)

IMPROVED: Expanded Exploit Importer Detection
  30+ pattern categories now include SSTI (FreeMarker, ERB, Twig, Jinja2),
  CORS wildcard, mass assignment, GraphQL introspection, buffer overflow,
  open redirect, Spring Actuator, weak TLS, and more.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERSION 3.0 — 2024
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Ghost Chain Exploit Arsenal: 200+ categorized exploits with PoC code
  - Exploit Importer: upload Nessus/Burp/ZAP/Nikto/OpenVAS reports
  - Canary Tokens: HTTP URL, DNS, document, email, AWS key, SQL canary
  - OSINT Recon: 15+ passive intelligence sources (Shodan, Censys, etc.)
  - SIEM: unified security event log with CSV/JSON export
  - CVE Lookup: NVD database search by CVE ID or keyword
  - Payload Generator: pre-built SQLi, XSS, SSTI, SSRF, XXE, RCE payloads
  - Request Comparer: side-by-side HTTP diff (Words/Lines/Bytes)
  - Encoder/Decoder: Base64, URL, hex, MD5/SHA, JWT decode, bcrypt

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERSION 2.0 — 2023
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Alpha Toolkit: Universal Scanner + Vulnerability Verifier + Web Scraper
  - SilkWeb Honeypot: SSH/HTTP/FTP/RDP decoy services
  - Firewall Manager: iptables/nftables rules across all VPN nodes
  - Threat Monitor: real-time beacon intrusion alert stream
  - Remote Terminal: web-based shell access to VPN servers
  - HTTP Probe: full HTTP client (Burp Repeater equivalent)
  - Directory Fuzzer: ffuf/gobuster equivalent
  - Subdomain Scout: CT log + DNS brute-force enumeration
  - Intruder: Sniper/Battering Ram/Pitchfork/Cluster Bomb fuzzing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VERSION 1.0 — 2022
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  - Initial release
  - WireGuard VPN with AES-256-GCM / ChaCha20-Poly1305
  - Kill Switch (Strict / Allow LAN / Custom)
  - DNS Shield with DNS-over-HTTPS
  - Leak Detection (DNS / IPv6 / WebRTC)
  - VPN Gate Double-Hop relay routing
  - Onion Browser (Tor over VPN)
  - Smart DNS for geo-bypass without VPN encryption
  - Split Tunneling (per-IP, per-domain, per-port)
  - Router Config generator (OpenWRT/DD-WRT/pfSense/GL.iNet)
  - DNS Sinkhole (Pi-hole equivalent)
  - Network Traffic Monitor with PCAP export
  - Device Manager
  - IP Exposure Scanner
  - Obfuscation / Stealth Mode
`;

const VERSION_TXT = `ProxhqVPN — Version Information
=================================
Product:   ProxhqVPN
Version:   4.0
Release:   2026
Company:   ALPHA UNLIMITED TECHNOLOGIES LLC
Website:   https://proxhqvpn.com
Support:   support@proxhqvpn.com
Guide:     https://proxhqvpn.com/guide
Pricing:   https://proxhqvpn.com/pricing
Downloads: https://proxhqvpn.com/downloads

Plans:
  VPN Basic           $6.99/mo or $59.99/yr
  Command Center Pro  $39.99/mo or $349.99/yr

WireGuard Protocol:  AES-256-GCM + ChaCha20-Poly1305
`;

// ── Platform-specific program/script files added to each ZIP ──────────────────
// Keys: resolved platform ID (windows, mac, linux, android, ios, fire, router, appletv)

const PLATFORM_SCRIPTS: Record<string, Record<string, string>> = {

  windows: {
    "install.bat": `@echo off
title ProxhqVPN -- Windows Installer v4.0
color 0A
echo.
echo  ================================================
echo   ProxhqVPN -- Windows Setup  v4.0
echo   ALPHA UNLIMITED TECHNOLOGIES LLC
echo   https://proxhqvpn.com
echo  ================================================
echo.
echo  Step 1 -- Downloading WireGuard for Windows...
powershell -Command "Invoke-WebRequest -Uri 'https://download.wireguard.com/windows-client/wireguard-installer.exe' -OutFile '%TEMP%\\wireguard-installer.exe' -UseBasicParsing"
if %errorlevel% neq 0 (
  echo  [ERROR] Download failed. Check your internet connection.
  pause & exit /b 1
)
echo  Download complete.
echo.
echo  Step 2 -- Installing WireGuard...
start /wait "%TEMP%\\wireguard-installer.exe"
echo  WireGuard installed.
echo.
echo  Step 3 -- Launching ProxhqVPN...
start https://proxhqvpn.com/sign-in
echo.
echo  ================================================
echo   SUBSCRIPTION REQUIRED:
echo   An active ProxhqVPN plan is required to connect.
echo   No account? Visit https://proxhqvpn.com/pricing
echo.
echo   AFTER SIGNING IN:
echo   The app detects your plan automatically:
echo     VPN Basic          -- opens your VPN dashboard
echo     Command Center Pro -- opens the full platform
echo.
echo   CONNECT YOUR VPN:
echo   1. Go to WireGuard Config -- Generate -- Download .conf
echo   2. WireGuard: Add Tunnel -- Import file -- Activate
echo   3. Run vpn-verify.bat to confirm connection
echo  ================================================
echo.
pause
`,
    "vpn-connect.bat": `@echo off
title ProxhqVPN -- Connect / Disconnect
color 0A
echo.
echo  ProxhqVPN -- WireGuard Control v4.0
echo  ================================================
echo  [1] Connect VPN
echo  [2] Disconnect VPN
echo  [3] Show VPN status
echo  [4] Verify connection (check IP)
echo  [Q] Quit
echo.
set /p choice="Enter choice: "
if /i "%choice%"=="1" goto connect
if /i "%choice%"=="2" goto disconnect
if /i "%choice%"=="3" goto status
if /i "%choice%"=="4" goto verify
if /i "%choice%"=="Q" exit
goto end

:connect
echo  Activating ProxhqVPN tunnel...
net start WireGuardTunnel$proxhq 2>nul || (
  echo  Tunnel service not found. Import your .conf file in WireGuard first.
)
goto end

:disconnect
echo  Deactivating ProxhqVPN tunnel...
net stop WireGuardTunnel$proxhq 2>nul
goto end

:status
echo  WireGuard tunnel status:
sc query WireGuardTunnel$proxhq 2>nul || echo  (No tunnel named proxhq found)
goto end

:verify
echo  Checking your public IP...
curl -s https://api64.ipify.org
echo.
goto end

:end
echo.
pause
`,
    "vpn-verify.bat": `@echo off
title ProxhqVPN -- Connection Verification
color 0A
echo.
echo  ProxhqVPN -- Connection Verification v4.0
echo  ================================================
echo.
echo  Your current public IP address:
curl -s https://api64.ipify.org
echo.
echo.
echo  Checking DNS leak...
nslookup myip.opendns.com resolver1.opendns.com
echo.
echo  If the IP above is a ProxhqVPN server IP -- you are protected.
echo  If it shows your home/ISP IP -- the VPN is NOT active.
echo.
echo  Run a full leak test at: https://proxhqvpn.com/leaks
echo.
pause
`,
    "kill-switch-install.bat": `@echo off
title ProxhqVPN -- Kill Switch Setup
color 0C
echo.
echo  ProxhqVPN -- Kill Switch v4.0
echo  Blocks ALL internet traffic if VPN drops unexpectedly
echo  ================================================
echo.
echo  Adding Windows Firewall kill switch rules...
echo  (Requires Administrator privileges)
echo.
netsh advfirewall firewall add rule name="ProxhqVPN-KS-BlockAll" dir=out action=block priority=1
netsh advfirewall firewall add rule name="ProxhqVPN-KS-AllowWG" dir=out action=allow program="%PROGRAMFILES%\\WireGuard\\wireguard.exe" priority=2
netsh advfirewall firewall add rule name="ProxhqVPN-KS-AllowLAN" dir=out action=allow remoteip=192.168.0.0/16,10.0.0.0/8,172.16.0.0/12 priority=3
netsh advfirewall firewall add rule name="ProxhqVPN-KS-AllowLoopback" dir=out action=allow remoteip=127.0.0.0/8 priority=4
echo.
echo  Kill switch ENABLED.
echo  All traffic is now blocked except WireGuard and LAN.
echo.
echo  To DISABLE: run kill-switch-remove.bat
echo  Full options: https://proxhqvpn.com/kill-switch
echo.
pause
`,
    "kill-switch-remove.bat": `@echo off
title ProxhqVPN -- Remove Kill Switch
color 0E
echo.
echo  ProxhqVPN -- Removing Kill Switch Rules...
echo  ================================================
echo.
netsh advfirewall firewall delete rule name="ProxhqVPN-KS-BlockAll"
netsh advfirewall firewall delete rule name="ProxhqVPN-KS-AllowWG"
netsh advfirewall firewall delete rule name="ProxhqVPN-KS-AllowLAN"
netsh advfirewall firewall delete rule name="ProxhqVPN-KS-AllowLoopback"
echo.
echo  Kill switch removed. Normal internet access restored.
echo.
pause
`,
    "wg-template.conf": `# ProxhqVPN -- WireGuard Config Template
# Version 4.0 | https://proxhqvpn.com
#
# Get your real config at: https://proxhqvpn.com/wireguard
# Sign in -> Generate -> Download .conf
#
# DO NOT USE THESE PLACEHOLDER VALUES.
# Replace every UPPERCASE_PLACEHOLDER with your actual values.

[Interface]
PrivateKey = YOUR_PRIVATE_KEY_FROM_PROXHQVPN_DASHBOARD
Address = 10.0.0.2/32
DNS = 1.1.1.1, 1.0.0.1

[Peer]
PublicKey = SERVER_PUBLIC_KEY_FROM_PROXHQVPN_DASHBOARD
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = YOUR_PROXHQVPN_SERVER_IP:51820
PersistentKeepalive = 25
`,
  },

  mac: {
    "install.sh": `#!/bin/bash
# ProxhqVPN -- macOS Installer v4.0
# ALPHA UNLIMITED TECHNOLOGIES LLC | https://proxhqvpn.com

echo ""
echo " ================================================"
echo "  ProxhqVPN -- macOS Setup  v4.0"
echo "  ALPHA UNLIMITED TECHNOLOGIES LLC"
echo "  https://proxhqvpn.com"
echo " ================================================"
echo ""

check_wireguard() {
  if command -v wg &>/dev/null; then
    echo " WireGuard CLI found: $(which wg)"
    return 0
  fi
  return 1
}

if check_wireguard; then
  echo " WireGuard already installed."
else
  echo " WireGuard not found. Choose install method:"
  echo "  [1] Mac App Store (recommended)"
  echo "  [2] Homebrew CLI"
  echo "  [Q] Skip install"
  echo ""
  read -p " Choice: " CHOICE
  case "$CHOICE" in
    1)
      echo " Opening Mac App Store..."
      open "https://apps.apple.com/us/app/wireguard/id1451685025"
      echo " Install WireGuard from the App Store, then re-run this script."
      ;;
    2)
      if ! command -v brew &>/dev/null; then
        echo " Homebrew not found. Installing..."
        /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
      fi
      brew install wireguard-tools
      ;;
    *)
      echo " Skipping install."
      ;;
  esac
fi

echo ""
echo " Launching ProxhqVPN — please sign in..."
open "https://proxhqvpn.com/sign-in"
echo ""
echo " ================================================"
echo "  SUBSCRIPTION REQUIRED:"
echo "  An active ProxhqVPN plan is required to connect."
echo "  No account? Visit https://proxhqvpn.com/pricing"
echo ""
echo "  AFTER SIGNING IN:"
echo "  The app detects your plan automatically:"
echo "    VPN Basic          -- opens your VPN dashboard"
echo "    Command Center Pro -- opens the full platform"
echo ""
echo "  CONNECT YOUR VPN:"
echo "  1. WireGuard Config -> Generate -> Download .conf"
echo "  2. Import the .conf into WireGuard -> Toggle ON"
echo "  3. Run ./vpn-verify.sh to confirm connection"
echo " ================================================"
echo ""
`,
    "vpn-connect.sh": `#!/bin/bash
# ProxhqVPN -- macOS VPN Control v4.0
VPN_NAME="proxhq"
CONF_PATH="/etc/wireguard/\${VPN_NAME}.conf"
ACTION="\${1:-status}"

case "$ACTION" in
  up|connect|start)
    echo "Connecting ProxhqVPN..."
    if [ ! -f "$CONF_PATH" ]; then
      echo "[ERROR] Config not found at $CONF_PATH"
      echo "Run: sudo cp /path/to/proxhq.conf /etc/wireguard/"
      exit 1
    fi
    sudo wg-quick up $VPN_NAME && echo "Connected." || echo "[ERROR] Check your config."
    sleep 1
    echo ""
    echo "Current IP:"
    curl -s https://api64.ipify.org
    echo ""
    ;;
  down|disconnect|stop)
    echo "Disconnecting ProxhqVPN..."
    sudo wg-quick down $VPN_NAME && echo "Disconnected."
    ;;
  status)
    echo "Tunnel status:"
    sudo wg show $VPN_NAME 2>/dev/null || echo "(Not active)"
    echo ""
    echo "Current IP:"
    curl -s https://api64.ipify.org
    echo ""
    ;;
  *)
    echo "Usage: ./vpn-connect.sh [connect|disconnect|status]"
    ;;
esac
`,
    "vpn-verify.sh": `#!/bin/bash
# ProxhqVPN -- macOS Connection Verification v4.0
echo ""
echo " ProxhqVPN -- Connection Verification v4.0"
echo " ================================================"
echo ""
echo " Current public IP:"
curl -s https://api64.ipify.org
echo ""
echo ""
echo " WireGuard status:"
sudo wg show proxhq 2>/dev/null || echo " (Tunnel not active)"
echo ""
echo " Full leak test: https://proxhqvpn.com/leaks"
echo ""
`,
    "kill-switch-pf.conf": `# ProxhqVPN Kill Switch -- macOS pf Rules
# Version 4.0 | https://proxhqvpn.com
#
# INSTALLATION:
#   sudo cp kill-switch-pf.conf /etc/pf.anchors/proxhqvpn
#   Add to /etc/pf.conf:
#     anchor "proxhqvpn"
#     load anchor "proxhqvpn" from "/etc/pf.anchors/proxhqvpn"
#   Apply: sudo pfctl -f /etc/pf.conf -e
#
# DISABLE:  sudo pfctl -d
#
# Replace SERVER_ENDPOINT_IP with your server's IP from the .conf file.

# Allow loopback
pass quick on lo0 all

# Allow WireGuard UDP to server endpoint (get IP from your .conf Endpoint line)
# Replace SERVER_ENDPOINT_IP:
pass quick proto udp to SERVER_ENDPOINT_IP port 51820

# Allow LAN traffic
pass quick to 192.168.0.0/16
pass quick to 10.0.0.0/8
pass quick to 172.16.0.0/12

# Allow traffic through the WireGuard tunnel interface
pass quick on utun0 all
pass quick on utun1 all
pass quick on utun2 all

# Block everything else (kill switch)
block all
`,
    "wg-template.conf": `# ProxhqVPN -- WireGuard Config Template
# Version 4.0 | https://proxhqvpn.com
# Get your real config: https://proxhqvpn.com/wireguard -> Generate -> Download .conf

[Interface]
PrivateKey = YOUR_PRIVATE_KEY_FROM_PROXHQVPN_DASHBOARD
Address = 10.0.0.2/32
DNS = 1.1.1.1, 1.0.0.1

[Peer]
PublicKey = SERVER_PUBLIC_KEY_FROM_PROXHQVPN_DASHBOARD
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = YOUR_PROXHQVPN_SERVER_IP:51820
PersistentKeepalive = 25
`,
  },

  linux: {
    "install.sh": `#!/bin/bash
# ProxhqVPN -- Linux Installer v4.0
# ALPHA UNLIMITED TECHNOLOGIES LLC | https://proxhqvpn.com
# Supports: Ubuntu, Debian, Kali, Fedora, Arch, Alpine, Raspberry Pi

echo ""
echo " ================================================"
echo "  ProxhqVPN -- Linux Setup  v4.0"
echo "  ALPHA UNLIMITED TECHNOLOGIES LLC"
echo "  https://proxhqvpn.com"
echo " ================================================"
echo ""

# Detect distribution
if [ -f /etc/os-release ]; then
  . /etc/os-release
  DISTRO="$ID"
  DISTRO_NAME="$PRETTY_NAME"
else
  DISTRO="unknown"
  DISTRO_NAME="Unknown Linux"
fi

echo " Detected: $DISTRO_NAME"
echo ""
echo " Installing WireGuard tools..."
echo ""

case "$DISTRO" in
  ubuntu|debian|kali|raspbian|pop)
    sudo apt-get update -q
    sudo apt-get install -y wireguard wireguard-tools resolvconf
    ;;
  fedora)
    sudo dnf install -y wireguard-tools
    ;;
  centos|rhel|rocky|almalinux)
    sudo dnf install -y epel-release
    sudo dnf install -y wireguard-tools
    ;;
  arch|manjaro|endeavouros)
    sudo pacman -S --noconfirm wireguard-tools
    ;;
  alpine)
    apk add --no-cache wireguard-tools
    ;;
  opensuse*|suse*)
    sudo zypper install -y wireguard-tools
    ;;
  *)
    echo " Distro not auto-detected. Manual install:"
    echo "   Ubuntu/Debian/Kali: sudo apt install wireguard-tools"
    echo "   Fedora:             sudo dnf install wireguard-tools"
    echo "   Arch:               sudo pacman -S wireguard-tools"
    echo "   Alpine:             apk add wireguard-tools"
    ;;
esac

if command -v wg &>/dev/null; then
  echo ""
  echo " WireGuard installed: $(wg --version)"
else
  echo ""
  echo " [ERROR] WireGuard installation may have failed."
  echo " Try manual install for your distro."
  exit 1
fi

echo ""
echo " Launching ProxhqVPN — please sign in..."
if command -v xdg-open &>/dev/null; then
  xdg-open "https://proxhqvpn.com/sign-in"
elif command -v sensible-browser &>/dev/null; then
  sensible-browser "https://proxhqvpn.com/sign-in"
fi

echo ""
echo " ================================================"
echo "  SUBSCRIPTION REQUIRED:"
echo "  An active ProxhqVPN plan is required to connect."
echo "  No account? Visit https://proxhqvpn.com/pricing"
echo ""
echo "  AFTER SIGNING IN:"
echo "  The app detects your plan automatically:"
echo "    VPN Basic          -- opens your VPN dashboard"
echo "    Command Center Pro -- opens the full platform"
echo ""
echo "  CONNECT YOUR VPN:"
echo "  1. Sign in -> WireGuard Config -> Generate -> Copy Config"
echo "  2. Run: sudo bash vpn-setup.sh  (paste your config)"
echo "  3. Run: sudo bash vpn-connect.sh connect"
echo "  4. Run: bash vpn-verify.sh to confirm"
echo " ================================================"
echo ""
`,
    "vpn-setup.sh": `#!/bin/bash
# ProxhqVPN -- WireGuard Config Setup v4.0
# Run this after getting your config from https://proxhqvpn.com/wireguard

CONF_DIR="/etc/wireguard"
CONF_FILE="$CONF_DIR/proxhq.conf"

echo ""
echo " ProxhqVPN -- WireGuard Config Setup v4.0"
echo " ================================================"
echo ""

if [ "$EUID" -ne 0 ]; then
  echo " [ERROR] Run with sudo: sudo bash vpn-setup.sh"
  exit 1
fi

if [ -f "$CONF_FILE" ]; then
  echo " Existing config found at $CONF_FILE"
  read -p " Overwrite? (y/N): " CONFIRM
  if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo " Cancelled."
    exit 0
  fi
fi

echo ""
echo " Paste your WireGuard config from https://proxhqvpn.com/wireguard"
echo " Press Enter twice + Ctrl+D when done:"
echo " ------------------------------------------------"
CONFIG_CONTENT=$(cat)

mkdir -p "$CONF_DIR"
chmod 700 "$CONF_DIR"
echo "$CONFIG_CONTENT" > "$CONF_FILE"
chmod 600 "$CONF_FILE"

echo ""
echo " Config saved to $CONF_FILE"
echo ""
echo " Commands:"
echo "  Connect:    sudo bash vpn-connect.sh connect"
echo "  Disconnect: sudo bash vpn-connect.sh disconnect"
echo "  Autostart:  sudo bash vpn-connect.sh autostart-on"
echo ""
`,
    "vpn-connect.sh": `#!/bin/bash
# ProxhqVPN -- Linux VPN Control v4.0
VPN_NAME="proxhq"
ACTION="\${1:-status}"

case "$ACTION" in
  up|connect|start)
    echo "Connecting ProxhqVPN..."
    sudo wg-quick up $VPN_NAME || { echo "[ERROR] Failed. Check /etc/wireguard/proxhq.conf exists."; exit 1; }
    echo ""
    echo "Current public IP:"
    curl -s https://api64.ipify.org
    echo ""
    ;;
  down|disconnect|stop)
    echo "Disconnecting ProxhqVPN..."
    sudo wg-quick down $VPN_NAME
    ;;
  status)
    echo "Tunnel status:"
    sudo wg show $VPN_NAME 2>/dev/null || echo "(Not active)"
    echo ""
    echo "Current public IP:"
    curl -s https://api64.ipify.org
    echo ""
    ;;
  autostart-on)
    sudo systemctl enable wg-quick@$VPN_NAME
    sudo systemctl start wg-quick@$VPN_NAME
    echo "Autostart enabled. VPN will start on boot."
    ;;
  autostart-off)
    sudo systemctl disable wg-quick@$VPN_NAME
    sudo systemctl stop wg-quick@$VPN_NAME
    echo "Autostart disabled."
    ;;
  restart)
    sudo wg-quick down $VPN_NAME 2>/dev/null
    sleep 1
    sudo wg-quick up $VPN_NAME
    ;;
  *)
    echo "Usage: sudo bash vpn-connect.sh [connect|disconnect|status|autostart-on|autostart-off|restart]"
    ;;
esac
`,
    "vpn-verify.sh": `#!/bin/bash
# ProxhqVPN -- Linux Connection Verification v4.0
echo ""
echo " ProxhqVPN -- Connection Verification v4.0"
echo " ================================================"
echo ""
echo " Current public IP:"
curl -s https://api64.ipify.org
echo ""
echo ""
echo " WireGuard tunnel status:"
sudo wg show proxhq 2>/dev/null || echo " (Tunnel not active -- run: sudo bash vpn-connect.sh connect)"
echo ""
echo " Network interfaces:"
ip link show | grep -E "wg|wireguard" | awk '{print "  " $0}'
echo ""
echo " DNS check:"
nslookup whoami.akamai.net 2>/dev/null | grep -i address | tail -1 || dig +short whoami.akamai.net 2>/dev/null
echo ""
echo " Full leak test: https://proxhqvpn.com/leaks"
echo ""
`,
    "kill-switch-iptables.sh": `#!/bin/bash
# ProxhqVPN -- Kill Switch (iptables) v4.0
# Blocks all internet traffic if VPN drops
# Run: sudo bash kill-switch-iptables.sh [on|off]

WG_INTERFACE="wg0"
WG_PORT="51820"

install_kill_switch() {
  echo " Installing iptables kill switch..."
  # Allow loopback
  iptables -A OUTPUT -o lo -j ACCEPT
  # Allow established/related
  iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
  # Allow WireGuard UDP out
  iptables -A OUTPUT -p udp --dport $WG_PORT -j ACCEPT
  # Allow traffic through WireGuard interface
  iptables -A OUTPUT -o $WG_INTERFACE -j ACCEPT
  # Allow LAN
  iptables -A OUTPUT -d 192.168.0.0/16 -j ACCEPT
  iptables -A OUTPUT -d 10.0.0.0/8 -j ACCEPT
  iptables -A OUTPUT -d 172.16.0.0/12 -j ACCEPT
  # Block everything else
  iptables -A OUTPUT -j DROP
  echo " Kill switch ENABLED. All non-VPN traffic blocked."
}

remove_kill_switch() {
  echo " Removing kill switch..."
  iptables -F OUTPUT
  iptables -P OUTPUT ACCEPT
  echo " Kill switch DISABLED. Normal traffic restored."
}

if [ "$EUID" -ne 0 ]; then echo "Run with sudo."; exit 1; fi

case "\${1:-on}" in
  on|enable|install)   install_kill_switch ;;
  off|disable|remove)  remove_kill_switch ;;
  *)  echo "Usage: sudo bash kill-switch-iptables.sh [on|off]" ;;
esac
echo ""
echo "Full kill switch guide: https://proxhqvpn.com/kill-switch"
`,
    "kill-switch-nftables.conf": `#!/usr/sbin/nft -f
# ProxhqVPN Kill Switch -- nftables Rules v4.0
# https://proxhqvpn.com/kill-switch
#
# Apply: sudo nft -f kill-switch-nftables.conf
# Remove: sudo nft delete table inet proxhqvpn_killswitch

table inet proxhqvpn_killswitch {
  chain output {
    type filter hook output priority 0; policy drop;
    # Allow loopback
    oif lo accept
    # Allow established connections
    ct state established,related accept
    # Allow WireGuard UDP (replace PORT if different)
    udp dport 51820 accept
    # Allow WireGuard tunnel interface traffic
    oifname "wg0" accept
    # Allow LAN
    ip daddr { 192.168.0.0/16, 10.0.0.0/8, 172.16.0.0/12 } accept
    # Block everything else (kill switch)
    drop
  }
}
`,
    "wg-template.conf": `# ProxhqVPN -- WireGuard Config Template
# Version 4.0 | https://proxhqvpn.com
# Get your real config: https://proxhqvpn.com/wireguard -> Generate -> Copy Config
# Then run: sudo bash vpn-setup.sh  (and paste the config)

[Interface]
PrivateKey = YOUR_PRIVATE_KEY_FROM_PROXHQVPN_DASHBOARD
Address = 10.0.0.2/32
DNS = 1.1.1.1, 1.0.0.1
# Optional kill switch (uncomment to enable):
# PostUp   = iptables -A OUTPUT ! -o %i -m mark ! --mark $(wg show %i fwmark) -m addrtype ! --dst-type LOCAL -j REJECT
# PreDown  = iptables -D OUTPUT ! -o %i -m mark ! --mark $(wg show %i fwmark) -m addrtype ! --dst-type LOCAL -j REJECT

[Peer]
PublicKey = SERVER_PUBLIC_KEY_FROM_PROXHQVPN_DASHBOARD
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = YOUR_PROXHQVPN_SERVER_IP:51820
PersistentKeepalive = 25
`,
  },

  fire: {
    "SETUP-GUIDE.txt": `ProxhqVPN -- Fire Stick / Fire TV Setup Package
================================================
Version 4.0 | ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

This package contains:
  SETUP-GUIDE.txt          This file
  adb-install-windows.bat  ADB installer for Windows
  adb-install-linux.sh     ADB installer for Linux/macOS
  README.txt               Full setup instructions
  Quick_Start.txt          Quick start guide
  User_Guide.txt           Complete user guide
  CHANGELOG.txt            Version history
  VERSION.txt              Version info

QUICK START (Without ADB):
  1. On Fire Stick: Settings -> My Fire TV -> Developer Options
     -> Apps from Unknown Sources -> ON
  2. Install "Downloader" from Amazon App Store (search: Downloader)
  3. Open Downloader -> enter URL:
       https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk
  4. Tap Go -> Download -> Install
  5. Sign in to proxhqvpn.com on phone/computer
  6. WireGuard Config -> Generate -> Show QR Code
  7. Open WireGuard on Fire Stick -> + -> Scan QR Code
  8. Toggle ON -- VPN key icon confirms connection

ADB METHOD (Advanced):
  Allows installing wirelessly from your PC/Mac without the Downloader app.
  Run adb-install-windows.bat (Windows) or adb-install-linux.sh (Linux/macOS)

Support: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
    "adb-install-windows.bat": `@echo off
title ProxhqVPN -- Fire Stick ADB Installer v4.0
color 0A
echo.
echo  ================================================
echo   ProxhqVPN -- Fire Stick ADB Installer  v4.0
echo   ALPHA UNLIMITED TECHNOLOGIES LLC
echo   https://proxhqvpn.com
echo  ================================================
echo.
echo  REQUIREMENTS:
echo    Android Debug Bridge (ADB) must be installed.
echo    Get ADB: https://developer.android.com/tools/releases/platform-tools
echo.
echo  BEFORE RUNNING:
echo    1. Fire Stick: Settings -> My Fire TV -> Developer Options
echo       -> ADB Debugging -> ON
echo       -> Apps from Unknown Sources -> ON
echo    2. Note your Fire Stick IP:
echo       Settings -> My Fire TV -> About -> Network
echo.
set /p FIRE_IP="Enter your Fire Stick IP address: "
if "%FIRE_IP%"=="" (echo Please enter an IP. & pause & exit)
echo.
echo  Connecting to Fire Stick at %FIRE_IP%...
adb connect %FIRE_IP%:5555
echo.
echo  Downloading WireGuard APK...
powershell -Command "Invoke-WebRequest -Uri 'https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk' -OutFile '%TEMP%\\wireguard-fire.apk' -UseBasicParsing"
if %errorlevel% neq 0 (echo [ERROR] Download failed. & pause & exit /b 1)
echo  Download complete.
echo.
echo  Installing WireGuard on Fire Stick...
adb -s %FIRE_IP%:5555 install "%TEMP%\\wireguard-fire.apk"
echo.
echo  ================================================
echo   NEXT STEPS:
echo   1. Open WireGuard on your Fire Stick
echo   2. Tap + -> Scan from QR code
echo   3. Show QR at: https://proxhqvpn.com/wireguard
echo      (Sign in -> Generate -> Show QR Code)
echo   4. Toggle the tunnel ON
echo  ================================================
echo.
pause
`,
    "adb-install-linux.sh": `#!/bin/bash
# ProxhqVPN -- Fire Stick ADB Installer v4.0
# For Linux and macOS
echo ""
echo " ================================================"
echo "  ProxhqVPN -- Fire Stick ADB Installer  v4.0"
echo "  ALPHA UNLIMITED TECHNOLOGIES LLC"
echo "  https://proxhqvpn.com"
echo " ================================================"
echo ""
echo " REQUIREMENTS: adb must be installed."
echo "   Ubuntu/Debian: sudo apt install adb"
echo "   macOS:         brew install android-platform-tools"
echo ""
echo " BEFORE RUNNING:"
echo "   1. Fire Stick: Settings -> My Fire TV -> Developer Options"
echo "      -> ADB Debugging -> ON"
echo "      -> Apps from Unknown Sources -> ON"
echo "   2. Note Fire Stick IP:"
echo "      Settings -> My Fire TV -> About -> Network"
echo ""
read -p " Enter your Fire Stick IP address: " FIRE_IP
if [ -z "$FIRE_IP" ]; then echo "No IP entered."; exit 1; fi
echo ""
echo " Connecting to Fire Stick at $FIRE_IP..."
adb connect "\${FIRE_IP}:5555"
echo ""
echo " Downloading WireGuard APK..."
APK_URL="https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk"
curl -L -o /tmp/wireguard-fire.apk "$APK_URL" || { echo "[ERROR] Download failed."; exit 1; }
echo " Download complete."
echo ""
echo " Installing WireGuard on Fire Stick..."
adb -s "\${FIRE_IP}:5555" install /tmp/wireguard-fire.apk
echo ""
echo " ================================================"
echo "  NEXT STEPS:"
echo "  1. Open WireGuard on your Fire Stick"
echo "  2. Tap + -> Scan from QR code"
echo "  3. Show QR at: https://proxhqvpn.com/wireguard"
echo "     (Sign in -> Generate -> Show QR Code)"
echo "  4. Toggle the tunnel ON"
echo " ================================================"
echo ""
`,
  },

  router: {
    "openwrt-setup.sh": `#!/bin/bash
# ProxhqVPN -- OpenWRT Router Setup v4.0
# ALPHA UNLIMITED TECHNOLOGIES LLC | https://proxhqvpn.com
# Installs WireGuard on your OpenWRT router via SSH

echo ""
echo " ================================================"
echo "  ProxhqVPN -- OpenWRT Router Setup  v4.0"
echo "  ALPHA UNLIMITED TECHNOLOGIES LLC"
echo " ================================================"
echo ""
echo " This installs WireGuard on your OpenWRT router."
echo " Requirements: SSH access to your router (usually root@192.168.1.1)"
echo ""
read -p " Router IP address [192.168.1.1]: " ROUTER_IP
ROUTER_IP="\${ROUTER_IP:-192.168.1.1}"
read -p " SSH username [root]: " SSH_USER
SSH_USER="\${SSH_USER:-root}"
echo ""
echo " Connecting to router at $ROUTER_IP as $SSH_USER..."
echo " (You will be prompted for the router SSH password)"
echo ""

ssh \${SSH_USER}@\${ROUTER_IP} 'bash -s' << 'EOF'
echo "Updating package lists..."
opkg update

echo "Installing WireGuard packages..."
opkg install wireguard-tools kmod-wireguard luci-proto-wireguard luci-app-wireguard

if command -v wg &>/dev/null; then
  echo ""
  echo "WireGuard installed: $(wg --version 2>/dev/null || echo OK)"
  echo ""
  echo "Next: paste your WireGuard config into /etc/config/network"
  echo "Get config from: https://proxhqvpn.com/router-config"
  echo ""
  echo "Then restart networking: /etc/init.d/network restart"
else
  echo "[ERROR] Installation may have failed. Check opkg logs."
fi
EOF

echo ""
echo " ================================================"
echo "  NEXT STEPS:"
echo "  1. Get your router config: https://proxhqvpn.com/router-config"
echo "  2. SSH into router: ssh root@$ROUTER_IP"
echo "  3. Paste config into /etc/config/network"
echo "  4. Run: /etc/init.d/network restart"
echo "  5. Verify from any device: curl https://api64.ipify.org"
echo " ================================================"
echo ""
`,
    "gliNet-setup.txt": `ProxhqVPN -- GL.iNet Router Setup
===================================
Version 4.0 | ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

GL.iNet routers (GL-MT3000, GL-AXT1800, GL-AX1800, GL-MT1300,
GL-MT2500, GL-X3000, GL-E750) have native WireGuard client support.

STEP 1 -- Get your ProxhqVPN config
  Visit: https://proxhqvpn.com/wireguard
  Sign in -> Generate -> Copy Config (copy the entire block)

STEP 2 -- Open GL.iNet Admin Panel
  Open browser -> go to http://192.168.8.1
  Default login password is on the label under your router.

STEP 3 -- Set up WireGuard Client
  Navigate to: VPN -> WireGuard Client -> Add Profile
  Paste your entire copied config into the profile field.
  Give it a name (e.g. ProxhqVPN) -> Save.

STEP 4 -- Connect
  Toggle the WireGuard Client ON.
  Every device on your GL.iNet network is now VPN-protected.

STEP 5 -- Verify
  From any connected device, visit: https://api64.ipify.org
  The IP should be a ProxhqVPN server IP.

RECOMMENDED SETTINGS:
  VPN -> VPN Policies -> Force all traffic through VPN -> ON
  This ensures no device on your network bypasses the VPN.

KILL SWITCH:
  GL.iNet has a built-in VPN kill switch under VPN -> VPN Policies.
  Enable "Block Non-VPN Traffic" for whole-network protection.

Support: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
    "pfsense-opnsense-setup.txt": `ProxhqVPN -- pfSense / OPNsense Setup
=======================================
Version 4.0 | ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

PFSENSE SETUP:
  1. Install WireGuard package:
     System -> Package Manager -> Available Packages
     Search "WireGuard" -> Install

  2. Configure WireGuard:
     VPN -> WireGuard -> Settings -> Enable WireGuard -> Save
     Tunnels tab -> Add Tunnel
       Description: ProxhqVPN
       Listen Port: (leave blank for random)
       Interface Keys: Generate (or paste from ProxhqVPN dashboard)

  3. Add Peer (ProxhqVPN server):
     Public Key: (from your ProxhqVPN .conf Peer section)
     Endpoint: (your ProxhqVPN server IP):51820
     Allowed IPs: 0.0.0.0/0
     Keep Alive: 25

  4. Assign Interface:
     Interfaces -> Assignments -> Add wg0 -> Save
     Configure the interface with address from your .conf

  5. Add firewall rule:
     Firewall -> Rules -> WireGuard tab
     Add rule: Allow All (or restrict as needed)

OPNSENSE SETUP:
  1. Install WireGuard plugin:
     System -> Firmware -> Plugins -> os-wireguard -> Install
     Reboot required.

  2. Configure:
     VPN -> WireGuard -> Local -> Add
     Fill in keys, name "ProxhqVPN", port 51820

  3. Add Endpoint (peer):
     VPN -> WireGuard -> Endpoints -> Add
     Fill in server public key, endpoint IP:51820, AllowedIPs 0.0.0.0/0

  4. Assign interface and add firewall rules.

Get your keys from: https://proxhqvpn.com/wireguard
Support: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
    "wg-router-template.conf": `# ProxhqVPN -- Router WireGuard Config Template
# Version 4.0 | https://proxhqvpn.com
#
# Get your REAL config from: https://proxhqvpn.com/router-config
# Select your firmware -> Generate -> Copy the output below
#
# For OpenWRT, paste the [Interface] and [Peer] block values
# into /etc/config/network in the WireGuard section.
#
# DO NOT USE THESE PLACEHOLDER VALUES.

[Interface]
PrivateKey = YOUR_ROUTER_PRIVATE_KEY_FROM_PROXHQVPN
Address = 10.0.0.3/32
DNS = 1.1.1.1

[Peer]
PublicKey = SERVER_PUBLIC_KEY_FROM_PROXHQVPN
AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = YOUR_PROXHQVPN_SERVER_IP:51820
PersistentKeepalive = 25
`,
    "router-kill-switch.sh": `#!/bin/bash
# ProxhqVPN -- Router Kill Switch (OpenWRT) v4.0
# Run on your OpenWRT router via SSH
# Blocks all WAN traffic if WireGuard tunnel goes down

echo "ProxhqVPN Router Kill Switch v4.0"
echo "==================================="
echo ""

# Add kill switch rules via iptables (run on router)
iptables -I FORWARD -i br-lan -o eth0 -j REJECT
iptables -I FORWARD -i br-lan -o wg0 -j ACCEPT
iptables -I OUTPUT -o eth0 -j REJECT
iptables -I OUTPUT -o wg0 -j ACCEPT
iptables -I OUTPUT -o lo -j ACCEPT

echo "Kill switch enabled. LAN traffic blocked except through wg0."
echo ""
echo "To remove: iptables -D FORWARD -i br-lan -o eth0 -j REJECT"
echo "Full guide: https://proxhqvpn.com/kill-switch"
`,
  },

  android: {
    "SETUP-GUIDE.txt": `ProxhqVPN -- Android Setup Package
====================================
Version 4.0 | ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

This package contains:
  SETUP-GUIDE.txt   This file
  README.txt        Full platform-specific setup guide
  Quick_Start.txt   Quick start guide
  User_Guide.txt    Complete user guide
  CHANGELOG.txt     Version history
  VERSION.txt       Version info

INSTALL WIREGUARD:
  Option A -- Google Play Store (recommended):
    https://play.google.com/store/apps/details?id=com.wireguard.android

  Option B -- Direct APK download (no Play Store needed):
    URL: https://download.wireguard.com/android-client/com.wireguard.android-apk-latest.apk
    Enable unknown sources: Settings -> Security -> Install unknown apps -> ON
    Tap the downloaded APK -> Install

CONNECT:
  1. Sign in at https://proxhqvpn.com/wireguard
  2. Generate -> Show QR Code
  3. WireGuard app -> + -> Scan from QR code
  4. Toggle ON -> VPN key icon in status bar = connected

VERIFY:
  Chrome -> https://api64.ipify.org
  Must show ProxhqVPN server IP.
  Full leak test: https://proxhqvpn.com/leaks

ANDROID TV / NVIDIA SHIELD:
  Install WireGuard from Google Play on Android TV.
  For Nvidia Shield: Play Store -> search WireGuard -> install.
  Use ADB or a USB mouse to navigate the QR scanner.
  ADB push method:
    adb connect SHIELD_IP:5555
    adb install wireguard.apk

Support: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
  },

  ios: {
    "SETUP-GUIDE.txt": `ProxhqVPN -- iOS / iPadOS Setup Package
=========================================
Version 4.0 | ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

This package contains:
  SETUP-GUIDE.txt   This file
  README.txt        Full platform-specific setup guide
  Quick_Start.txt   Quick start guide
  User_Guide.txt    Complete user guide
  CHANGELOG.txt     Version history
  VERSION.txt       Version info

INSTALL WIREGUARD:
  App Store: https://apps.apple.com/us/app/wireguard/id1441195209
  Search "WireGuard" in the App Store -> Get -> Install

CONNECT:
  1. Sign in at https://proxhqvpn.com/wireguard on desktop or laptop
  2. Generate -> Show QR Code
  3. On iPhone/iPad: WireGuard -> + -> Create from QR code
  4. Point camera at QR code -> Save tunnel
  5. Toggle ON -> VPN key icon appears in status bar = connected

ALTERNATIVE -- FILE IMPORT:
  Download the .conf file from ProxhqVPN -> WireGuard Config
  Share the file to WireGuard via iOS Share Sheet:
    Files app -> tap .conf -> Share -> WireGuard -> Import

ON-DEMAND CONNECT:
  In WireGuard: tap your tunnel -> On-Demand
  Enable for Wi-Fi and/or Cellular so VPN reconnects automatically.

USING IPHONE AS ROUTER FOR APPLE TV:
  Enable VPN on iPhone -> Personal Hotspot ON
  Connect Apple TV to iPhone hotspot -> Apple TV is protected.

VERIFY:
  Safari -> https://api64.ipify.org
  Must show ProxhqVPN server IP.
  Full leak test: https://proxhqvpn.com/leaks

Support: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
  },

  appletv: {
    "SETUP-GUIDE.txt": `ProxhqVPN -- Apple TV Setup Package
=====================================
Version 4.0 | ALPHA UNLIMITED TECHNOLOGIES LLC
https://proxhqvpn.com

This package contains:
  SETUP-GUIDE.txt   This file
  README.txt        Full platform-specific setup guide
  Quick_Start.txt   Quick start guide
  User_Guide.txt    Complete user guide
  CHANGELOG.txt     Version history
  VERSION.txt       Version info

THREE SETUP METHODS -- choose the one that works for you:

METHOD 1 -- WIREGUARD ON TVOS (recommended for Apple TV 4K):
  App Store on Apple TV -> search "WireGuard" -> Install
  Sign in at proxhqvpn.com -> WireGuard Config -> Generate -> Show QR
  WireGuard on Apple TV -> + -> Create from QR code
  Point the Apple TV camera at the QR on your phone/screen
  Toggle ON -> VPN key icon at top = connected

  No camera? Use iCloud sharing:
    iPhone WireGuard -> tap tunnel -> Share -> add to iCloud
    Apple TV WireGuard -> Import from iCloud Keychain

METHOD 2 -- IPHONE PERSONAL HOTSPOT (easiest):
  1. Install ProxhqVPN on your iPhone (see iOS README)
  2. Enable VPN on iPhone -> toggle WireGuard ON
  3. iPhone -> Personal Hotspot -> ON
  4. Apple TV Settings -> Wi-Fi -> connect to your iPhone hotspot
  All Apple TV traffic tunnels through your iPhone's VPN.

METHOD 3 -- ROUTER SETUP (best for always-on protection):
  Install ProxhqVPN on your router. Every device including Apple TV
  is automatically protected with no configuration on the Apple TV.
  See Router README and: https://proxhqvpn.com/router-config

VERIFY:
  From any device on the same network:
    curl https://api64.ipify.org
  Should show ProxhqVPN server IP.

Support: support@proxhqvpn.com | Guide: https://proxhqvpn.com/guide
`,
  },
};

// Map platform IDs → README_CONTENT keys
const README_ID_MAP: Record<string, string> = {
  macos:           "mac",
  iphone:          "ios",
  "android-tablet":"android",
  firestick:       "fire",
  firetv:          "fire",
  androidtv:       "android",
  samsung:         "router",
  lg:              "router",
  roku:            "router",
  openwrt:         "router",
  ddwrt:           "router",
  pfsense:         "router",
  asus:            "router",
  ps5:             "router",
  xbox:            "router",
  chromebook:      "linux",
  raspberrypi:     "linux",
};

async function downloadPlatformZip(platformId: string, platformName: string) {
  const resolvedId = README_ID_MAP[platformId] ?? platformId;
  const readmeContent = README_CONTENT[resolvedId] ?? README_CONTENT["linux"] ?? "";

  const zip = new JSZip();
  const folderName = `ProxhqVPN-${platformName.replace(/[^a-zA-Z0-9]/g, "-")}-v4.0`;
  const folder = zip.folder(folderName)!;

  // ── Core documentation (every platform) ──────────────────────────────────
  folder.file("README.txt",       readmeContent);
  folder.file("User_Guide.txt",   USER_GUIDE_TXT);
  folder.file("Quick_Start.txt",  QUICK_START_TXT);
  folder.file("CHANGELOG.txt",    CHANGELOG_TXT);
  folder.file("VERSION.txt",      VERSION_TXT);

  // ── Platform-specific program files (scripts, configs, tools) ────────────
  const scripts = PLATFORM_SCRIPTS[resolvedId] ?? {};
  for (const [filename, content] of Object.entries(scripts)) {
    folder.file(filename, content);
  }

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${folderName}-Setup.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Search icon not imported above — add it
function Search(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  );
}
