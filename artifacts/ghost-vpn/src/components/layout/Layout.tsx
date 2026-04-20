import React, { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import {
  Wifi, CreditCard, Smartphone, BookOpen,
  Power, Search, ShieldPlus, EyeOff,
  Globe, GitBranch, Globe2,
  LayoutDashboard, Server, ShieldAlert, Network,
  Activity, Shield, Terminal, Database,
  LogOut, User, ChevronDown, ChevronRight,
  Settings, Zap
} from "lucide-react";
import { useAdmin } from "@/hooks/useAdmin";

interface LayoutProps {
  children: ReactNode;
}

const PAGE_NAMES: Record<string, string> = {
  "/my-vpn": "Connect",
  "/pricing": "Subscription Plans",
  "/devices": "My Devices",
  "/platforms": "Setup Guide",
  "/kill-switch": "Kill Switch",
  "/leaks": "Leak Test",
  "/dns-shield": "DNS Protection",
  "/obfuscation": "Obfuscation",
  "/vpngate": "VPN Gate",
  "/split-tunnel": "Split Tunneling",
  "/proxy": "Proxy & Tor",
  "/onion-browser": "Onion Browser",
  "/vpn-coexist": "VPN Coexistence",
  "/wireguard": "WireGuard Config",
  "/router-config": "Router Setup",
  "/smart-dns": "Smart DNS",
  "/dashboard": "Dashboard",
  "/nodes": "VPN Servers",
  "/beacons": "Threat Monitor",
  "/silkweb": "Decoy Network",
  "/monitor": "Performance",
  "/firewall": "Firewall",
  "/security-audit": "Security Audit",
  "/threat-intel": "Threat Intelligence",
  "/terminal": "Terminal",
  "/sql": "Database",
  "/account": "My Account",
};

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isAdmin } = useAdmin();
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const pageName = PAGE_NAMES[location] ?? "ProxhqVPN";

  const userNav = [
    { href: "/my-vpn",       label: "Connect",         icon: Wifi },
    { href: "/pricing",      label: "Subscription",    icon: CreditCard },
    { href: "/devices",      label: "My Devices",      icon: Smartphone },
    { href: "/platforms",    label: "Setup Guide",     icon: BookOpen },
  ];

  const protectionNav = [
    { href: "/kill-switch",  label: "Kill Switch",     icon: Power },
    { href: "/leaks",        label: "Leak Test",       icon: Search },
    { href: "/dns-shield",   label: "DNS Protection",  icon: ShieldPlus },
    { href: "/obfuscation",  label: "Obfuscation",     icon: EyeOff },
  ];

  const networkNav = [
    { href: "/vpngate",      label: "VPN Gate",        icon: Globe },
    { href: "/split-tunnel", label: "Split Tunneling", icon: GitBranch },
    { href: "/proxy",        label: "Proxy & Tor",     icon: Globe2 },
  ];

  const adminNav = [
    { href: "/dashboard",    label: "Dashboard",       icon: LayoutDashboard },
    { href: "/nodes",        label: "VPN Servers",     icon: Server },
    { href: "/beacons",      label: "Threat Monitor",  icon: ShieldAlert },
    { href: "/silkweb",      label: "Decoy Network",   icon: Network },
    { href: "/monitor",      label: "Performance",     icon: Activity },
    { href: "/firewall",     label: "Firewall",        icon: Shield },
    { href: "/terminal",     label: "Terminal",        icon: Terminal },
    { href: "/sql",          label: "Database",        icon: Database },
  ];

  const advancedNav = [
    { href: "/wireguard",    label: "WireGuard",       icon: Settings },
    { href: "/router-config",label: "Router Setup",    icon: Settings },
    { href: "/smart-dns",    label: "Smart DNS",       icon: Zap },
    { href: "/vpn-coexist",  label: "VPN Coexistence", icon: GitBranch },
  ];

  const NavItem = ({ href, label, icon: Icon }: { href: string; label: string; icon: any }) => {
    const isActive = location === href;
    return (
      <Link
        href={href}
        className={`flex items-center gap-2.5 px-3 py-2 rounded-sm transition-colors text-sm ${
          isActive
            ? "bg-primary/15 border border-primary/40 text-primary font-medium"
            : "text-primary/60 hover:bg-primary/5 hover:text-primary border border-transparent"
        }`}
      >
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span>{label}</span>
      </Link>
    );
  };

  const NavGroup = ({ label, items }: { label: string; items: typeof userNav }) => (
    <div className="space-y-0.5">
      <div className="text-[10px] font-semibold tracking-widest text-primary/30 uppercase px-3 pt-3 pb-1">
        {label}
      </div>
      {items.map((item) => <NavItem key={item.href} {...item} />)}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-primary flex selection:bg-primary selection:text-black">
      {/* Sidebar */}
      <aside className="w-56 border-r border-primary/10 flex flex-col shrink-0 bg-gradient-to-b from-black via-[#020d05] to-black">

        {/* Logo */}
        <div className="p-4 border-b border-primary/15">
          <div className="flex items-center gap-2.5">
            <img src="/icon-final2.png" alt="ProxhqVPN" className="w-8 h-8 shrink-0" />
            <div>
              <div className="font-bold text-base tracking-tight leading-none text-primary">ProxhqVPN</div>
              <div className="text-[10px] text-primary/50 mt-1 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
                System Active
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-1">

          <NavGroup label="My VPN" items={userNav} />
          <NavGroup label="Protection" items={protectionNav} />
          <NavGroup label="Network" items={networkNav} />

          {/* Advanced (collapsible) */}
          <div>
            <button
              onClick={() => setAdvancedOpen((v) => !v)}
              className="flex items-center gap-2 w-full px-3 pt-3 pb-1 text-[10px] font-semibold tracking-widest text-primary/30 uppercase hover:text-primary/50 transition-colors"
            >
              {advancedOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              Advanced
            </button>
            {advancedOpen && (
              <div className="space-y-0.5">
                {advancedNav.map((item) => <NavItem key={item.href} {...item} />)}
              </div>
            )}
          </div>

          {/* Admin-only section */}
          {isAdmin && (
            <NavGroup label="Admin" items={adminNav} />
          )}
        </nav>

        {/* User footer */}
        {user && (
          <div className="p-3 border-t border-primary/15 space-y-1">
            <div className="px-3 py-1.5">
              <div className="text-[11px] text-primary/70 font-medium truncate">
                {user.firstName ?? user.username ?? "User"}
              </div>
              <div className="text-[10px] text-primary/35 truncate">
                {user.primaryEmailAddress?.emailAddress ?? ""}
              </div>
            </div>
            <Link
              href="/account"
              className="flex items-center gap-2 w-full text-sm text-primary/55 hover:text-primary px-3 py-2 rounded-sm hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-colors"
            >
              <User className="w-3.5 h-3.5" />
              Account Settings
            </Link>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 w-full text-sm text-primary/55 hover:text-primary px-3 py-2 rounded-sm hover:bg-primary/5 border border-transparent hover:border-primary/20 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* Header */}
        <header className="h-12 border-b border-primary/15 flex items-center justify-between px-6 shrink-0">
          <div className="text-sm font-medium text-primary/80">
            {pageName}
          </div>
          <div className="text-[10px] text-primary/30 font-mono">
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 relative min-h-0">
          <div className="relative z-10 h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
