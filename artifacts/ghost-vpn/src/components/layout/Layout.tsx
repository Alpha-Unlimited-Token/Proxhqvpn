import React, { ReactNode, useState } from "react";
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
import { useAdmin } from "@/hooks/useAdmin";

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
  { href: "/kill-switch",   label: "Kill Switch",     icon: Power },
  { href: "/leaks",         label: "Leak Test",       icon: Search },
  { href: "/dns-shield",    label: "DNS Protection",  icon: ShieldPlus },
  { href: "/obfuscation",   label: "Obfuscation",     icon: EyeOff },
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

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isAdmin } = useAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    </div>
  );
}
