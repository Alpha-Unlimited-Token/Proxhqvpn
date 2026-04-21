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
  Zap, Settings, Cpu, Router, ScanSearch, Layers, FileText, Users
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
  "/threat-intel": "Threat Intelligence",
  "/terminal":     "Terminal",
  "/sql":          "Database",
  "/account":      "My Account",
  "/sqlmap":       "Vulnerability Scanner",
  "/alpha-tools":  "Alpha Toolkit",
  "/downloads":    "Download ProxhqVPN",
  "/guide":        "User Guide",
  "/employees":    "Employee Access",
  "/setup":        "Server Setup",
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
  { href: "/threat-protection",  label: "Threat Protection",   icon: ShieldAlert },
  { href: "/obfuscation",        label: "Stealth Protocol",    icon: EyeOff },
];

const NETWORK_NAV = [
  { href: "/vpngate",       label: "VPN Gate",        icon: Globe },
  { href: "/split-tunnel",  label: "Split Tunneling", icon: GitBranch },
  { href: "/proxy",         label: "Proxy & Tor",     icon: Globe2 },
  { href: "/onion-browser", label: "Onion Browser",   icon: Onion },
];

const ADVANCED_NAV = [
  { href: "/wireguard",     label: "WireGuard Config",      icon: Cpu },
  { href: "/router-config", label: "Router Setup",          icon: Router },
  { href: "/smart-dns",     label: "Smart DNS",             icon: Zap },
  { href: "/vpn-coexist",   label: "VPN Coexistence",       icon: Settings },
  { href: "/sqlmap",        label: "Vulnerability Scanner", icon: ScanSearch },
  { href: "/alpha-tools",   label: "Alpha Toolkit",         icon: Layers },
];

const ADMIN_NAV = [
  { href: "/dashboard",     label: "Dashboard",       icon: LayoutDashboard },
  { href: "/nodes",         label: "VPN Servers",     icon: Server },
  { href: "/beacons",       label: "Threat Monitor",  icon: ShieldAlert },
  { href: "/silkweb",       label: "Decoy Network",   icon: Network },
  { href: "/monitor",       label: "Performance",     icon: Activity },
  { href: "/firewall",      label: "Firewall",        icon: Shield },
  { href: "/employees",     label: "Employee Access", icon: Users },
  { href: "/setup",         label: "Server Setup",    icon: Settings },
  { href: "/terminal",      label: "Terminal",        icon: Terminal },
  { href: "/sql",           label: "Database",        icon: Database },
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
          : "text-white/45 hover:text-white/85 hover:bg-white/[0.05]"
      }`}
    >
      <Icon className={`w-[17px] h-[17px] flex-shrink-0 ${isActive ? "text-primary" : "text-white/35 group-hover:text-white/65"}`} />
      <span className="text-[13px] font-medium leading-none">{label}</span>
      {isActive && <span className="ml-auto w-1 h-1 rounded-full bg-primary/70 shrink-0" />}
    </Link>
  );
}

function NavSection({ label, items, onNav }: {
  label: string; items: { href: string; label: string; icon: any }[]; onNav?: () => void;
}) {
  return (
    <div>
      <div className="px-3 pt-5 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/20 select-none">
        {label}
      </div>
      <div className="space-y-0.5">
        {items.map((item) => (
          <NavItem key={item.href} {...item} onClick={onNav} />
        ))}
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
  const { isAdmin, hasAccess } = useAccess();
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

  const SidebarContent = () => (
    <div className="flex flex-col h-full overflow-hidden">
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
      <nav className="flex-1 overflow-y-auto px-2 py-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
        <NavSection label="My VPN"     items={USER_NAV}       onNav={closeSidebar} />
        <NavSection label="Protection" items={PROTECTION_NAV} onNav={closeSidebar} />
        <NavSection label="Network"    items={NETWORK_NAV}    onNav={closeSidebar} />
        <NavSection label="Advanced"   items={ADVANCED_NAV}   onNav={closeSidebar} />
        {isAdmin && (
          <NavSection label="Admin"    items={ADMIN_NAV}      onNav={closeSidebar} />
        )}
      </nav>

      {/* Upgrade prompt for unsubscribed users */}
      {user && !hasAccess && (
        <div className="px-3 py-3 shrink-0">
          <Link
            href="/pricing"
            onClick={closeSidebar}
            className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-all group"
          >
            <Zap className="w-3.5 h-3.5 text-primary/70 group-hover:text-primary shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-primary/80 leading-none">Unlock Full Access</div>
              <div className="text-[10px] text-primary/40 mt-0.5 leading-snug">Subscribe to use all tools</div>
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
              <div className="text-[12px] font-medium text-white/75 truncate leading-none">
                {user.firstName
                  ? `${user.firstName} ${user.lastName ?? ""}`.trim()
                  : (user.username ?? "User")}
              </div>
              <div className="text-[10px] text-white/30 truncate mt-0.5">
                {user.primaryEmailAddress?.emailAddress ?? ""}
              </div>
            </div>
          </div>
          <Link
            href="/account"
            onClick={closeSidebar}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-[12px] text-white/40 hover:text-white/80 hover:bg-white/[0.05] transition-all"
          >
            <User className="w-[14px] h-[14px]" /> Account
          </Link>
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-[12px] text-white/40 hover:text-red-400/80 hover:bg-red-900/[0.12] transition-all"
          >
            <LogOut className="w-[14px] h-[14px]" /> Sign Out
          </button>
        </div>
      )}
    </div>
  );

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
        fixed lg:static inset-y-0 left-0 z-40
        w-56 bg-[#090e0a] border-r border-white/[0.05]
        flex flex-col shrink-0
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
              className="lg:hidden p-1.5 rounded-lg text-white/35 hover:text-white hover:bg-white/[0.07] transition-colors"
            >
              <Menu className="w-4 h-4" />
            </button>
            <span className="text-[13px] font-semibold text-white/65 tracking-tight">{pageName}</span>
          </div>
          <div className="text-[11px] text-white/20 tabular-nums font-mono">
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
                <div className="text-[11px] text-white/45 mt-0.5 leading-snug">
                  Downloaded in the background. Update now or it installs automatically next time you open the app.
                </div>
              </div>
              <button
                onClick={() => setUpdateDismissed(true)}
                className="text-white/25 hover:text-white/60 transition-colors shrink-0 mt-0.5"
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
                className="px-4 text-[12px] font-medium text-white/40 hover:text-white/70 border border-white/10 rounded-lg hover:border-white/20 transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
