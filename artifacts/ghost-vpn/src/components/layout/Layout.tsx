import React, { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import {
  Wifi, CreditCard, Smartphone, BookOpen,
  Power, Search, ShieldPlus, EyeOff,
  Globe, GitBranch, Globe2, Globe as Onion,
  LayoutDashboard, Server, ShieldAlert, Network,
  Activity, Shield, Terminal, Database,
  LogOut, User, Menu, Download,
  Zap, Settings, Cpu, Router, ScanSearch, Layers, FileText, Users,
  Send, FolderSearch, Radar, Award, BarChart2,
  Code2, GitCompare, Swords, Bug, Eye, BookMarked,
  GitMerge, Ban, Bell, Fingerprint, Upload, ChevronDown,
} from "lucide-react";
import { useAccess } from "@/hooks/useAccess";

interface LayoutProps {
  children: ReactNode;
}

const PAGE_NAMES: Record<string, string> = {
  "/my-vpn":       "Connect",
  "/pricing":      "Subscription Plans",
  "/devices":      "My Devices",
  "/platforms":    "Setup Guide",
  "/kill-switch":  "Kill Switch",
  "/leaks":        "Leak Test",
  "/dns-shield":   "DNS Protection",
  "/obfuscation":  "Obfuscation",
  "/vpngate":      "VPN Gate",
  "/split-tunnel": "Split Tunneling",
  "/proxy":        "Proxy & Tor",
  "/onion-browser":"Onion Browser",
  "/vpn-coexist":  "VPN Coexistence",
  "/wireguard":    "WireGuard Config",
  "/router-config":"Router Setup",
  "/smart-dns":    "Smart DNS",
  "/dashboard":    "Dashboard",
  "/nodes":        "VPN Servers",
  "/beacons":      "Threat Monitor",
  "/silkweb":      "Decoy Network",
  "/monitor":      "Performance",
  "/firewall":     "Firewall",
  "/security-audit":"Security Audit",
  "/http-probe":    "HTTP Probe",
  "/dir-fuzzer":    "Directory Fuzzer",
  "/subdomain-scan":"Subdomain Scout",
  "/threat-intel": "Threat Intelligence",
  "/terminal":     "Terminal",
  "/sql":          "Database",
  "/account":      "My Account",
  "/sqlmap":       "Vulnerability Scanner",
  "/alpha-tools":          "Alpha Toolkit",
  "/downloads":            "Download ProxhqVPN",
  "/guide":                "User Guide",
  "/employees":            "Employee Access",
  "/setup":                "Server Setup",
  "/ambassadors":          "Ambassadors",
  "/ambassador/apply":     "Become an Ambassador",
  "/ambassador/dashboard": "Ambassador Dashboard",
  "/encoder":              "Encoder / Decoder",
  "/comparer":             "Request Comparer",
  "/payloads":             "Payload Generator",
  "/cve-search":           "CVE Lookup",
  "/intruder":             "Intruder",
  "/ip-exposure":          "IP Exposure Scanner",
  "/handbook/ambassador":  "Ambassador Handbook",
  "/handbook/employee":    "Employee Handbook",
  "/ghost-trace":          "Ghost Trace",
  "/ghost-chain":          "Ghost Chain",
  "/network-monitor":      "Network Monitor",
  "/dns-sinkhole":         "DNS Sinkhole",
  "/siem":                 "Security Event Log",
  "/osint":                "OSINT Recon",
  "/canary":               "Canary Tokens",
  "/exploit-import":       "Exploit Importer",
  "/omnistrike":           "OmniStrike",
  "/social-breach":        "Social & Game Breach Tester",
  "/waf":                  "WAF Analyzer",
};

const USER_NAV = [
  { href: "/my-vpn",        label: "Connect",         icon: Wifi },
  { href: "/pricing",       label: "Subscription",    icon: CreditCard },
  { href: "/devices",       label: "My Devices",      icon: Smartphone },
  { href: "/downloads",     label: "Download App",    icon: Download },
  { href: "/platforms",     label: "Setup Guide",     icon: BookOpen },
  { href: "/guide",         label: "User Guide",      icon: FileText },
];

const PROTECTION_NAV = [
  { href: "/kill-switch",        label: "Kill Switch",         icon: Power },
  { href: "/leaks",              label: "Leak Test",           icon: Search },
  { href: "/dns-shield",         label: "DNS Protection",      icon: ShieldPlus },
  { href: "/dns-sinkhole",       label: "DNS Sinkhole",        icon: Ban },
  { href: "/threat-protection",  label: "Threat Protection",   icon: ShieldAlert },
  { href: "/obfuscation",        label: "Stealth Protocol",    icon: EyeOff },
  { href: "/ip-exposure",        label: "IP Exposure Scan",    icon: Eye },
  { href: "/ghost-trace",        label: "Ghost Trace",         icon: Radar },
];

const NETWORK_NAV = [
  { href: "/vpngate",          label: "VPN Gate",          icon: Globe },
  { href: "/split-tunnel",     label: "Split Tunneling",   icon: GitBranch },
  { href: "/proxy",            label: "Proxy & Tor",       icon: Globe2 },
  { href: "/onion-browser",    label: "Onion Browser",     icon: Onion },
  { href: "/network-monitor",  label: "Network Monitor",   icon: Activity },
];

const ADVANCED_NAV = [
  { href: "/wireguard",     label: "WireGuard Config",      icon: Cpu },
  { href: "/router-config", label: "Router Setup",          icon: Router },
  { href: "/smart-dns",     label: "Smart DNS",             icon: Zap },
  { href: "/vpn-coexist",   label: "VPN Coexistence",       icon: Settings },
  { href: "/sqlmap",        label: "Vulnerability Scanner", icon: ScanSearch },
  { href: "/alpha-tools",   label: "Alpha Toolkit",         icon: Layers },
  { href: "/http-probe",    label: "HTTP Probe",            icon: Send },
  { href: "/intruder",      label: "Intruder",              icon: Swords },
  { href: "/dir-fuzzer",    label: "Directory Fuzzer",      icon: FolderSearch },
  { href: "/subdomain-scan",label: "Subdomain Scout",       icon: Radar },
  { href: "/encoder",       label: "Encoder / Decoder",     icon: Code2 },
  { href: "/comparer",      label: "Request Comparer",      icon: GitCompare },
  { href: "/payloads",      label: "Payload Generator",     icon: Bug },
  { href: "/cve-search",    label: "CVE Lookup",            icon: ShieldAlert },
  { href: "/ghost-chain",   label: "Ghost Chain",           icon: GitMerge },
  { href: "/siem",          label: "Security Event Log",    icon: Database },
  { href: "/osint",         label: "OSINT Recon",           icon: Fingerprint },
  { href: "/canary",        label: "Canary Tokens",         icon: Bell },
  { href: "/exploit-import", label: "Exploit Importer",     icon: Upload },
  { href: "/omnistrike",    label: "OmniStrike",            icon: Zap },
  { href: "/waf",           label: "WAF Analyzer",          icon: Shield },
  { href: "/social-breach", label: "Social & Game Breach",  icon: Globe2 },
];

const AMBASSADOR_NAV = [
  { href: "/ambassadors",          label: "Browse Ambassadors", icon: Users },
  { href: "/ambassador/apply",     label: "Become Ambassador",  icon: Award },
  { href: "/ambassador/dashboard", label: "My Dashboard",       icon: BarChart2 },
  { href: "/handbook/ambassador",  label: "Ambassador Handbook", icon: BookMarked },
];

const ADMIN_NAV = [
  { href: "/dashboard",          label: "Dashboard",          icon: LayoutDashboard },
  { href: "/nodes",              label: "VPN Servers",        icon: Server },
  { href: "/beacons",            label: "Threat Monitor",     icon: ShieldAlert },
  { href: "/silkweb",            label: "Decoy Network",      icon: Network },
  { href: "/monitor",            label: "Performance",        icon: Activity },
  { href: "/firewall",           label: "Firewall",           icon: Shield },
  { href: "/employees",          label: "Employee Access",    icon: Users },
  { href: "/handbook/employee",  label: "Employee Handbook",  icon: BookMarked },
  { href: "/setup",              label: "Server Setup",       icon: Settings },
  { href: "/terminal",           label: "Terminal",           icon: Terminal },
  { href: "/sql",                label: "Database",           icon: Database },
];

function NavItem({ href, label, icon: Icon, onClick }: {
  href: string; label: string; icon: any; onClick?: () => void;
}) {
  const [location] = useLocation();
  const isActive = location === href;
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 group ${
        isActive
          ? "bg-primary/12 text-primary"
          : "text-white/83 hover:text-white/85 hover:bg-white/[0.05]"
      }`}
    >
      <Icon className={`w-[17px] h-[17px] flex-shrink-0 ${isActive ? "text-primary" : "text-white/78 group-hover:text-white/65"}`} />
      <span className="text-[13px] font-medium leading-none">{label}</span>
      {isActive && <span className="ml-auto w-1 h-1 rounded-full bg-primary/70 shrink-0" />}
    </Link>
  );
}

function NavSection({ label, items, onNav, isOpen, onToggle }: {
  label: string;
  items: { href: string; label: string; icon: any }[];
  onNav?: () => void;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [location] = useLocation();
  const hasActive = items.some((i) => i.href === location);

  return (
    <div>
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-3 pt-4 pb-1.5 group select-none`}
      >
        <span className={`text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors ${
          hasActive ? "text-primary/80" : "text-white/50 group-hover:text-white/70"
        }`}>
          {label}
        </span>
        <ChevronDown className={`w-3 h-3 transition-all duration-200 ${
          hasActive ? "text-primary/60" : "text-white/30 group-hover:text-white/50"
        } ${isOpen ? "rotate-180" : "rotate-0"}`} />
      </button>

      <div className={`overflow-hidden transition-all duration-200 ease-in-out ${
        isOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
      }`}>
        <div className="space-y-0.5 pb-1">
          {items.map((item) => (
            <NavItem key={item.href} {...item} onClick={onNav} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface UpdateInfo {
  version: string;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isAdmin, hasAccess, hasCommandCenter, tier } = useAccess();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<UpdateInfo | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // Register the callback that Electron calls when a background update finishes downloading
  useEffect(() => {
    (window as any).__proxhqShowUpdateBanner = (info: UpdateInfo) => {
      setPendingUpdate(info);
      setUpdateDismissed(false);
    };
    return () => { delete (window as any).__proxhqShowUpdateBanner; };
  }, []);

  function updateNow() {
    setRestarting(true);
    // Give the UI a moment to show "Restarting…" before Electron kills the window
    setTimeout(() => {
      (window as any).proxhq?.installUpdateNow?.();
    }, 600);
  }

  const showBanner = pendingUpdate && !updateDismissed;

  const pageName = PAGE_NAMES[location] ?? "ProxhqVPN";
  const closeSidebar = () => setSidebarOpen(false);

  const SidebarContent = () => {
    const [location] = useLocation();

    // Determine which section contains the current route so it opens by default
    const getDefaultSection = () => {
      if (USER_NAV.some((i) => i.href === location)) return "myvpn";
      if (AMBASSADOR_NAV.some((i) => i.href === location)) return "ambassadors";
      if (PROTECTION_NAV.some((i) => i.href === location)) return "protection";
      if (NETWORK_NAV.some((i) => i.href === location)) return "network";
      if (ADVANCED_NAV.some((i) => i.href === location)) return "commandcenter";
      if (ADMIN_NAV.some((i) => i.href === location)) return "admin";
      return "myvpn";
    };

    const [openSection, setOpenSection] = useState<string>(getDefaultSection);

    const toggle = (key: string) =>
      setOpenSection((prev) => (prev === key ? "" : key));

    return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-3 border-b border-white/[0.05] shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary/12 border border-primary/25 flex items-center justify-center shrink-0">
          <img src="/icon-final2.png" alt="" className="w-5 h-5" onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }} />
        </div>
        <div>
          <div className="font-bold text-[14px] text-white leading-none">ProxhqVPN</div>
          <div className="flex items-center gap-1 mt-1">
            <span className="w-1 h-1 rounded-full bg-primary animate-pulse inline-block" />
            <span className="text-[10px] text-primary/60 font-medium">Live</span>
          </div>
        </div>
      </div>

      {/* Scrollable nav */}
      <nav
        className="flex-1 overflow-y-auto px-2 pt-1 pb-4 scrollbar-green min-h-0"
        style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}
      >
        <NavSection label="My VPN"      items={USER_NAV}       onNav={closeSidebar} isOpen={openSection === "myvpn"}       onToggle={() => toggle("myvpn")} />
        <NavSection label="Ambassadors" items={AMBASSADOR_NAV} onNav={closeSidebar} isOpen={openSection === "ambassadors"} onToggle={() => toggle("ambassadors")} />
        {hasAccess && (
          <>
            <NavSection label="Protection" items={PROTECTION_NAV} onNav={closeSidebar} isOpen={openSection === "protection"} onToggle={() => toggle("protection")} />
            <NavSection label="Network"    items={NETWORK_NAV}    onNav={closeSidebar} isOpen={openSection === "network"}    onToggle={() => toggle("network")} />
          </>
        )}
        {hasCommandCenter && (
          <NavSection label="Command Center" items={ADVANCED_NAV} onNav={closeSidebar} isOpen={openSection === "commandcenter"} onToggle={() => toggle("commandcenter")} />
        )}
        {isAdmin && (
          <NavSection label="Admin" items={ADMIN_NAV} onNav={closeSidebar} isOpen={openSection === "admin"} onToggle={() => toggle("admin")} />
        )}
      </nav>

      {/* Upgrade / subscribe prompt */}
      {user && !hasAccess && (
        <div className="px-3 py-3 shrink-0">
          <Link href="/pricing" onClick={closeSidebar}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-all group">
            <Zap className="w-3.5 h-3.5 text-primary/70 group-hover:text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-primary/80 leading-none">Subscribe to Get Started</div>
              <div className="text-[10px] text-primary/40 mt-0.5">VPN from $6.99 · Pro from $39.99</div>
            </div>
          </Link>
        </div>
      )}
      {user && hasAccess && !hasCommandCenter && (
        <div className="px-3 py-3 shrink-0">
          <Link href="/pricing" onClick={closeSidebar}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl bg-yellow-500/8 border border-yellow-500/20 hover:bg-yellow-500/12 transition-all group">
            <Zap className="w-3.5 h-3.5 text-yellow-400/70 group-hover:text-yellow-400 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-yellow-400/80 leading-none">Upgrade to Pro</div>
              <div className="text-[10px] text-yellow-400/40 mt-0.5">Unlock developer toolkit</div>
            </div>
          </Link>
        </div>
      )}

      {/* User footer */}
      {user && (
        <div className="border-t border-white/[0.05] p-2 shrink-0 space-y-0.5">
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
              <span className="text-primary text-[11px] font-bold">
                {(user.firstName?.[0] ?? user.username?.[0] ?? "U").toUpperCase()}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] font-medium text-white/93 truncate leading-none">
                {user.firstName
                  ? `${user.firstName} ${user.lastName ?? ""}`.trim()
                  : (user.username ?? "User")}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {tier === "command_center" && (
                  <span className="text-[9px] font-bold uppercase tracking-widest text-yellow-400/80 bg-yellow-500/10 px-1.5 py-0.5 rounded-full leading-none">Pro</span>
                )}
                {tier === "vpn" && (
                  <span className="text-[9px] font-bold uppercase tracking-widest text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded-full leading-none">VPN</span>
                )}
                <div className="text-[10px] text-white/70 truncate">
                  {user.primaryEmailAddress?.emailAddress ?? ""}
                </div>
              </div>
            </div>
          </div>
          <Link
            href="/account"
            onClick={closeSidebar}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-[12px] text-white/78 hover:text-white/80 hover:bg-white/[0.05] transition-all"
          >
            <User className="w-[14px] h-[14px]" /> Account
          </Link>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-[12px] text-white/78 hover:text-red-400/80 hover:bg-red-900/[0.12] transition-all"
          >
            <LogOut className="w-[14px] h-[14px]" /> Sign Out
          </button>
        </div>
      )}
    </div>
  );
  };

  return (
    <div className="min-h-screen bg-[#080d09] text-white flex selection:bg-primary selection:text-black">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden backdrop-blur-sm"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky inset-y-0 left-0 z-40 top-0
        w-56 h-screen bg-[#090e0a] border-r border-white/[0.05]
        flex flex-col shrink-0 overflow-hidden
        transition-transform duration-200 ease-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}>
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top bar */}
        <header className="h-12 border-b border-white/[0.05] flex items-center justify-between px-5 shrink-0 bg-[#080d09]/80 backdrop-blur-sm sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(v => !v)}
              className="lg:hidden p-1.5 rounded-lg text-white/78 hover:text-white hover:bg-white/[0.07] transition-colors"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-[13px] font-semibold text-white/88 tracking-tight">{pageName}</span>
          </div>
          <div className="text-[11px] text-white/70 tabular-nums font-mono">
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="p-5 lg:p-7">
            {children}
          </div>
        </main>
      </div>

      {/* Update-ready banner — only appears when update downloads while the app is already open */}
      {showBanner && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 animate-in slide-in-from-bottom-4 duration-300">
          <div className="bg-[#0d1a0f] border border-primary/40 rounded-xl shadow-2xl shadow-black/60 p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-white leading-tight">
                  ProxhqVPN {pendingUpdate.version} is ready
                </div>
                <div className="text-[11px] text-white/83 mt-0.5 leading-snug">
                  Downloaded in the background. Update now or it installs automatically next time you open the app.
                </div>
              </div>
              <button
                onClick={() => setUpdateDismissed(true)}
                className="text-white/70 hover:text-white/60 transition-colors shrink-0 mt-0.5"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={updateNow}
                disabled={restarting}
                className="flex-1 bg-primary text-black text-[12px] font-semibold py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
              >
                {restarting ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Restarting…
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Update Now
                  </>
                )}
              </button>
              <button
                onClick={() => setUpdateDismissed(true)}
                className="px-4 text-[12px] font-medium text-white/78 hover:text-white/70 border border-white/10 rounded-lg hover:border-white/20 transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Copyright footer — always visible at bottom of sidebar */}
      <div className="fixed bottom-0 left-0 w-[260px] bg-gray-950/95 border-t border-white/5 px-3 py-2 z-50 hidden md:block">
        <p className="text-[9px] text-gray-600 leading-tight">
          © 2024–2026 ALPHA UNLIMITED TECHNOLOGIES LLC
        </p>
        <p className="text-[9px] text-gray-700 leading-tight">
          All rights reserved. Patent pending.
        </p>
      </div>
    </div>
  );
}
