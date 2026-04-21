import { useState } from "react";
import { PageSEO } from "@/components/PageSEO";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Wifi, Router, Tv, Smartphone, Monitor, Gamepad2, Globe, Download } from "lucide-react";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Platform {
  id: string;
  name: string;
  method: "wireguard" | "smart-dns" | "router";
  methodLabel: string;
  status: "native" | "via-router" | "via-smart-dns";
  steps: string[];
  appLink?: string;
  appLabel?: string;
  note?: string;
}

interface PlatformGroup {
  label: string;
  icon: React.ElementType;
  platforms: Platform[];
}

const GROUPS: PlatformGroup[] = [
  {
    label: "DESKTOP",
    icon: Monitor,
    platforms: [
      {
        id: "windows", name: "Windows 10 / 11", method: "wireguard", methodLabel: "WireGuard App",
        status: "native",
        appLink: "https://www.wireguard.com/install/", appLabel: "Download WireGuard for Windows",
        steps: [
          "Download and install WireGuard from wireguard.com/install",
          "Open WireGuard → click the ▾ arrow next to Add Tunnel → Add empty tunnel",
          "In the dashboard, go to WG Config and generate a config for your device",
          "Paste the config into the WireGuard window",
          "Click Activate — the tunnel shows as Active",
        ],
      },
      {
        id: "macos", name: "macOS", method: "wireguard", methodLabel: "WireGuard App",
        status: "native",
        appLink: "https://apps.apple.com/us/app/wireguard/id1451685025", appLabel: "Download WireGuard on Mac App Store",
        steps: [
          "Install WireGuard from the Mac App Store",
          "In the ProxhqVPN dashboard, go to WG Config → generate your config",
          "In WireGuard → Import tunnel(s) from file → select your .conf",
          "Or click 'Add empty tunnel' and paste the config text",
          "Click Allow when macOS asks for VPN permission",
          "Activate the tunnel",
        ],
      },
      {
        id: "linux", name: "Linux", method: "wireguard", methodLabel: "wg-quick",
        status: "native",
        steps: [
          "Install WireGuard: sudo apt install wireguard (Debian/Ubuntu) or sudo dnf install wireguard-tools (Fedora)",
          "Generate your config from the WG Config page in the dashboard",
          "Save config to /etc/wireguard/wg0.conf",
          "Start: sudo wg-quick up wg0",
          "Enable auto-start: sudo systemctl enable wg-quick@wg0",
          "Verify: sudo wg show",
        ],
      },
      {
        id: "chromebook", name: "Chromebook", method: "wireguard", methodLabel: "Linux (Crostini)",
        status: "native",
        steps: [
          "Enable Linux environment: Settings → Advanced → Developers → Linux development environment",
          "In Linux terminal: sudo apt install wireguard",
          "Generate config from the WG Config page",
          "Save to ~/wg0.conf and run: sudo wg-quick up ~/wg0.conf",
        ],
        note: "Requires ChromeOS with Linux enabled (most Chromebooks from 2019+).",
      },
    ],
  },
  {
    label: "MOBILE",
    icon: Smartphone,
    platforms: [
      {
        id: "ios", name: "iPhone / iPad (iOS)", method: "wireguard", methodLabel: "WireGuard App",
        status: "native",
        appLink: "https://apps.apple.com/us/app/wireguard/id1441195209", appLabel: "Download WireGuard on App Store",
        steps: [
          "Install WireGuard from the App Store",
          "In the ProxhqVPN dashboard, go to Device Manager → Add Device → iOS",
          "After adding, click 'Show QR Code' on your device",
          "In WireGuard app → tap + → Create from QR code",
          "Scan the QR code from the dashboard",
          "Tap Allow when iOS asks for VPN permission",
          "Toggle the tunnel on",
        ],
      },
      {
        id: "android", name: "Android", method: "wireguard", methodLabel: "WireGuard App",
        status: "native",
        appLink: "https://play.google.com/store/apps/details?id=com.wireguard.android", appLabel: "Download WireGuard on Play Store",
        steps: [
          "Install WireGuard from the Google Play Store",
          "In the ProxhqVPN dashboard, go to Device Manager → Add Device → Android",
          "Click 'Show QR Code' on your device",
          "In WireGuard app → tap + → Scan QR code",
          "Scan the QR code from the dashboard",
          "Toggle the tunnel on",
        ],
      },
    ],
  },
  {
    label: "TV & STREAMING",
    icon: Tv,
    platforms: [
      {
        id: "android-tv", name: "Android TV / Google TV", method: "wireguard", methodLabel: "WireGuard App",
        status: "native",
        steps: [
          "Open Google Play Store on your Android TV",
          "Search for 'WireGuard' and install it",
          "In the ProxhqVPN dashboard, go to Device Manager → Add Device → Android TV",
          "Click 'Show QR Code'",
          "In WireGuard on TV → Import from QR code",
          "Use your phone to scan the QR code shown by the TV app",
          "Activate the tunnel",
        ],
        note: "Works on all Android TV / Google TV devices including NVIDIA SHIELD, Chromecast with Google TV, Sony/TCL/Hisense Android TVs.",
      },
      {
        id: "fire-tv", name: "Amazon Fire TV / Fire Stick", method: "wireguard", methodLabel: "WireGuard (sideload)",
        status: "native",
        steps: [
          "On your Fire TV: Settings → My Fire TV → Developer Options → ADB Debugging ON + Apps from Unknown Sources ON",
          "Download WireGuard APK from wireguard.com/install (Android section)",
          "Sideload via ADB: adb connect <fire-tv-ip> && adb install wireguard.apk",
          "Or use the Downloader app to install WireGuard from: https://f-droid.org/repo/com.wireguard.android_XXX.apk",
          "Generate your config in the Device Manager and scan the QR code",
        ],
        note: "Alternatively, connect your Fire TV via a VPN-capable router to avoid sideloading.",
      },
      {
        id: "apple-tv", name: "Apple TV (tvOS 17+)", method: "wireguard", methodLabel: "WireGuard App",
        status: "native",
        appLink: "https://apps.apple.com/us/app/wireguard/id1441195209", appLabel: "WireGuard on App Store",
        steps: [
          "Open App Store on Apple TV → search 'WireGuard' → install",
          "In the ProxhqVPN dashboard, go to Device Manager → Add Device → Apple TV",
          "Generate the config and note the QR code",
          "In WireGuard on Apple TV → Add a tunnel → Create from QR code",
          "Use your iPhone Camera app to scan, then it auto-adds to Apple TV via iCloud",
          "Toggle the tunnel on",
        ],
        note: "Requires tvOS 17.0 or later. WireGuard for Apple TV was added in 2023.",
      },
      {
        id: "samsung-tv", name: "Samsung Smart TV", method: "router", methodLabel: "Router VPN",
        status: "via-router",
        steps: [
          "Samsung Smart TVs have no VPN app support",
          "Best option: connect via a VPN-enabled router (all traffic is protected)",
          "Alternative: use Smart DNS — go to Smart DNS in the dashboard for instructions",
          "On the TV: Settings → Network → IP Settings → DNS → Manual",
          "Enter the ProxhqVPN Smart DNS server IP from the Smart DNS page",
        ],
        note: "Router VPN covers all Samsung TV traffic automatically. Smart DNS works for streaming unblocking but doesn't encrypt traffic.",
      },
      {
        id: "lg-tv", name: "LG Smart TV (webOS)", method: "smart-dns", methodLabel: "Smart DNS",
        status: "via-smart-dns",
        steps: [
          "LG TVs do not support VPN apps natively",
          "Go to Smart DNS in the dashboard — copy your ProxhqVPN DNS server IP",
          "On the TV: Settings gear → All Settings → Network → Wired/Wi-Fi → Advanced Settings",
          "Change DNS to Manual → enter the ProxhqVPN Smart DNS IP",
          "Or connect the TV via a VPN router for full encryption",
        ],
      },
      {
        id: "roku", name: "Roku", method: "router", methodLabel: "Router VPN",
        status: "via-router",
        steps: [
          "Roku does not support VPN apps or manual DNS on all models",
          "Recommended: use a VPN-enabled router — Roku automatically uses it",
          "Go to Router Config in the dashboard and set up ProxhqVPN on your router",
          "All Roku traffic will route through the VPN automatically",
        ],
        note: "Router-level VPN is the most reliable method for Roku devices.",
      },
    ],
  },
  {
    label: "GAMING CONSOLES",
    icon: Gamepad2,
    platforms: [
      {
        id: "ps5", name: "PlayStation 4 / 5", method: "smart-dns", methodLabel: "Smart DNS or Router",
        status: "via-smart-dns",
        steps: [
          "Option A — Smart DNS (fast, for geo-unblocking):",
          "  Settings → Network → Set Up Internet Connection → Custom",
          "  IP, DHCP, DNS: Manual — enter ProxhqVPN Smart DNS IP",
          "Option B — Router VPN (full encryption):",
          "  Connect your PS4/5 to a router running ProxhqVPN WireGuard",
          "  All traffic is encrypted automatically, no console config needed",
        ],
      },
      {
        id: "xbox", name: "Xbox One / Series X|S", method: "smart-dns", methodLabel: "Smart DNS or Router",
        status: "via-smart-dns",
        steps: [
          "Option A — Smart DNS:",
          "  Settings → General → Network Settings → Advanced Settings → DNS Settings → Manual",
          "  Primary DNS: enter ProxhqVPN Smart DNS IP from the Smart DNS page",
          "  Secondary DNS: 1.1.1.1",
          "Option B — Router VPN:",
          "  Connect Xbox to a router running ProxhqVPN WireGuard for full protection",
        ],
      },
    ],
  },
  {
    label: "ROUTER (covers all devices)",
    icon: Router,
    platforms: [
      {
        id: "openwrt", name: "OpenWRT", method: "router", methodLabel: "WireGuard via UCI",
        status: "native",
        steps: [
          "Go to Router Config in the dashboard",
          "Select OpenWRT and a ProxhqVPN server node",
          "Copy the generated commands",
          "SSH into your router and paste the commands",
          "All devices on your network are protected",
        ],
      },
      {
        id: "ddwrt", name: "DD-WRT", method: "router", methodLabel: "WireGuard built-in",
        status: "native",
        steps: [
          "Go to Router Config in the dashboard → select DD-WRT",
          "Copy the configuration values",
          "In DD-WRT: Setup → Tunnels → WireGuard → Add Tunnel",
          "Enter the values from the generated config",
          "Save and Apply",
        ],
      },
      {
        id: "merlin", name: "ASUSWRT-Merlin", method: "router", methodLabel: "WireGuard Client",
        status: "native",
        steps: [
          "Go to Router Config → select ASUSWRT-Merlin",
          "Download the generated .conf file",
          "In ASUS router admin: VPN → VPN Client → WireGuard → Add Profile",
          "Upload the .conf file and Activate",
        ],
      },
      {
        id: "glinet", name: "GL.iNet", method: "router", methodLabel: "WireGuard native",
        status: "native",
        steps: [
          "Go to Router Config → select GL.iNet",
          "Download the generated .conf file",
          "In GL.iNet admin (192.168.8.1): VPN → WireGuard Client → Add → Upload Config",
          "Toggle the VPN on",
        ],
      },
    ],
  },
  {
    label: "BROWSER",
    icon: Globe,
    platforms: [
      {
        id: "chrome-ext", name: "Chrome / Edge / Brave", method: "smart-dns", methodLabel: "SOCKS5 Proxy",
        status: "via-smart-dns",
        steps: [
          "Install the Proxy SwitchyOmega extension from the Chrome Web Store",
          "Go to ProxyConfig in the dashboard → copy the SOCKS5 proxy settings",
          "In SwitchyOmega: create a new Proxy profile",
          "Protocol: SOCKS5, Server: 127.0.0.1, Port: 1080 (or your configured port)",
          "Switch to the ProxhqVPN proxy profile when browsing",
        ],
        note: "This routes only browser traffic through ProxhqVPN. For full device protection, use the WireGuard app.",
      },
      {
        id: "firefox-ext", name: "Firefox", method: "smart-dns", methodLabel: "SOCKS5 Proxy",
        status: "via-smart-dns",
        steps: [
          "Install FoxyProxy Standard from Firefox Add-ons",
          "Go to ProxyConfig in the dashboard → copy the SOCKS5 proxy settings",
          "In FoxyProxy: Add Proxy → Type SOCKS5, IP: 127.0.0.1, Port: 1080",
          "Enable the proxy when browsing",
          "Or: Settings → Network Settings → Manual proxy → SOCKS5 Host",
        ],
      },
    ],
  },
];

const METHOD_COLORS: Record<string, string> = {
  wireguard:  "border-green-500/50 text-green-400",
  "router":   "border-yellow-500/50 text-yellow-400",
  "smart-dns":"border-blue-500/50 text-blue-400",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  "native":        { label: "NATIVE APP",     color: "bg-green-900/30 text-green-400 border-green-500/30" },
  "via-router":    { label: "VIA ROUTER",     color: "bg-yellow-900/30 text-yellow-400 border-yellow-500/30" },
  "via-smart-dns": { label: "VIA SMART DNS",  color: "bg-blue-900/30 text-blue-400 border-blue-500/30" },
};

export default function Platforms() {
  const [expanded, setExpanded] = useState<string | null>(null);

  const toggle = (id: string) => setExpanded(prev => prev === id ? null : id);

  return (
    <div className="space-y-6 font-mono">
      <PageSEO
        title="Platform Support — VPN for Every Device"
        description="ProxhqVPN works on Windows, macOS, iPhone, Android, Linux, Apple TV, Fire TV, smart TVs, gaming consoles (PS5, Xbox), and routers. Full WireGuard support across all platforms."
        path="/platforms"
      />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-widest uppercase text-primary">Platform Support</h1>
          <p className="text-xs text-primary/40 mt-0.5">ProxhqVPN on every device — desktop, mobile, TV, console, router</p>
        </div>
        <div className="flex gap-3 text-[9px]">
          <span className="flex items-center gap-1 text-green-400"><span className="w-2 h-2 rounded-sm bg-green-900/60 border border-green-500/50 inline-block" /> NATIVE APP</span>
          <span className="flex items-center gap-1 text-yellow-400"><span className="w-2 h-2 rounded-sm bg-yellow-900/60 border border-yellow-500/50 inline-block" /> VIA ROUTER</span>
          <span className="flex items-center gap-1 text-blue-400"><span className="w-2 h-2 rounded-sm bg-blue-900/60 border border-blue-500/50 inline-block" /> SMART DNS</span>
        </div>
      </div>

      {GROUPS.map(group => {
        const GroupIcon = group.icon;
        return (
          <div key={group.label}>
            <div className="flex items-center gap-2 mb-2">
              <GroupIcon className="w-3.5 h-3.5 text-primary/50" />
              <span className="text-[9px] tracking-[0.25em] text-primary/30 uppercase">{group.label}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {group.platforms.map(p => {
                const isOpen = expanded === p.id;
                const statusInfo = STATUS_LABELS[p.status];
                return (
                  <Card key={p.id} className="bg-black border-primary/20">
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-bold text-primary tracking-wide truncate">{p.name}</div>
                          <div className={`text-[9px] font-mono mt-0.5 border px-1.5 py-0.5 inline-block ${METHOD_COLORS[p.method]}`}>
                            {p.methodLabel}
                          </div>
                        </div>
                        <div className={`text-[8px] font-mono border px-1.5 py-0.5 shrink-0 ${statusInfo.color}`}>
                          {statusInfo.label}
                        </div>
                      </div>

                      {p.note && (
                        <p className="text-[9px] text-primary/40 leading-relaxed">{p.note}</p>
                      )}

                      <div className="flex items-center gap-2 pt-1">
                        <button
                          onClick={() => toggle(p.id)}
                          className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/50 px-2 py-1 transition-colors flex-1"
                        >
                          {isOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          {isOpen ? "HIDE GUIDE" : "SETUP GUIDE"}
                        </button>

                        {p.id === "openwrt" || p.id === "ddwrt" || p.id === "merlin" || p.id === "glinet" || p.id === "ubiquiti" ? (
                          <Link href="/router-config"
                            className="text-[9px] uppercase tracking-widest text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/50 px-2 py-1 transition-colors flex items-center gap-1">
                            <Download className="w-3 h-3" /> CONFIG
                          </Link>
                        ) : p.method === "wireguard" && p.status === "native" && p.id !== "openwrt" ? (
                          <Link href="/devices"
                            className="text-[9px] uppercase tracking-widest text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/50 px-2 py-1 transition-colors flex items-center gap-1">
                            <Download className="w-3 h-3" /> GET CONFIG
                          </Link>
                        ) : p.method === "smart-dns" || p.status === "via-smart-dns" ? (
                          <Link href="/smart-dns"
                            className="text-[9px] uppercase tracking-widest text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/50 px-2 py-1 transition-colors">
                            SMART DNS
                          </Link>
                        ) : null}
                      </div>

                      {isOpen && (
                        <div className="pt-2 border-t border-primary/10 space-y-1">
                          {p.steps.map((step, i) => (
                            <div key={i} className="flex gap-2">
                              <span className="text-[8px] text-primary/30 shrink-0 pt-0.5 w-3">{step.startsWith(" ") ? "" : `${i + 1}.`}</span>
                              <p className="text-[9px] text-primary/60 leading-relaxed">{step.trim()}</p>
                            </div>
                          ))}
                          {p.appLink && (
                            <a href={p.appLink} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[9px] text-primary/50 hover:text-primary underline mt-2 block">
                              <Wifi className="w-3 h-3 inline" /> {p.appLabel}
                            </a>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="border border-primary/10 p-4 text-center">
        <p className="text-[9px] text-primary/30 font-mono">
          ProxhqVPN supports any device that can run WireGuard, use a custom DNS server, or connect through a VPN-enabled router.
          Router-level setup protects every device on your network simultaneously — including any smart home devices, IoT, and streaming sticks.
        </p>
      </div>
    </div>
  );
}
