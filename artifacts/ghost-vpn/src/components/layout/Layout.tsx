import React, { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/react";
import {
  Activity, ShieldAlert, Network, Terminal, Database, Server,
  Settings2, Shield, Globe, Layers,
  Power, Search, AlertTriangle, GitBranch, EyeOff, ShieldCheck, SplitSquareHorizontal, LogOut,
  Tv, Smartphone, Router, Wifi, ShieldPlus, Zap, User
} from "lucide-react";
import WireGuardModal from "@/components/WireGuardModal";
import { useWireGuardSubscription } from "@/hooks/useWireGuardSubscription";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [wgModalOpen, setWgModalOpen] = useState(false);
  const { hasWireGuard, loading: wgLoading } = useWireGuardSubscription();

  const navGroups = [
    {
      label: "CORE",
      items: [
        { href: "/dashboard",    label: "DASHBOARD",     icon: Activity },
        { href: "/nodes",        label: "NODE MGR",       icon: Server },
        { href: "/vpngate",      label: "VPN GATE",       icon: Globe },
        { href: "/platforms",    label: "PLATFORMS",      icon: Tv },
        { href: "/devices",      label: "DEVICES",        icon: Smartphone },
        { href: "/beacons",      label: "BEACONS",        icon: ShieldAlert },
        { href: "/silkweb",      label: "SILK WEB",       icon: Network },
        { href: "/monitor",      label: "MONITOR",        icon: Activity },
      ],
    },
    {
      label: "SECURITY",
      items: [
        { href: "/firewall",     label: "FIREWALL",       icon: Shield },
        { href: "/kill-switch",  label: "KILL SWITCH",    icon: Power },
        { href: "/dns-shield",   label: "DNS SHIELD",     icon: ShieldPlus },
        { href: "/leaks",        label: "LEAK DETECT",    icon: Search },
        { href: "/threat-intel",   label: "THREAT INTEL",   icon: AlertTriangle },
        { href: "/security-audit", label: "SEC AUDIT",       icon: ShieldCheck },
      ],
    },
    {
      label: "TUNNEL",
      items: [
        { href: "/wireguard",    label: "WG CONFIG",      icon: Settings2 },
        { href: "/router-config",label: "ROUTER CFG",     icon: Router },
        { href: "/smart-dns",    label: "SMART DNS",      icon: Wifi },
        { href: "/split-tunnel", label: "SPLIT TUNNEL",   icon: GitBranch },
        { href: "/obfuscation",  label: "OBFUSCATION",    icon: EyeOff },
        { href: "/proxy",        label: "PROXY/TOR",      icon: Globe },
        { href: "/onion-browser",label: "ONION BROWSER",  icon: Layers },
        { href: "/vpn-coexist",  label: "VPN COEXIST",    icon: SplitSquareHorizontal },
      ],
    },
    {
      label: "SYSTEM",
      items: [
        { href: "/terminal",     label: "TERMINAL",       icon: Terminal },
        { href: "/sql",          label: "SQL INTF",       icon: Database },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-black text-primary flex selection:bg-primary selection:text-black">
      {/* Sidebar */}
      <aside className="w-52 border-r border-primary/20 flex flex-col shrink-0">
        <div className="p-4 border-b border-primary/20">
          <h1 className="text-lg font-bold tracking-tighter">ProxhqVPN</h1>
          <div className="text-xs text-primary/60 mt-1 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            SYS_ONLINE
          </div>
        </div>
        <nav className="flex-1 p-3 overflow-y-auto space-y-3">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="text-[9px] font-mono tracking-[0.2em] text-primary/25 px-2 pb-1 uppercase">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 px-2 py-1.5 border ${
                        isActive
                          ? "bg-primary/10 border-primary text-primary"
                          : "border-transparent text-primary/60 hover:bg-primary/5 hover:text-primary hover:border-primary/40"
                      } transition-colors`}
                    >
                      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="text-[10px] font-bold tracking-wider">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* WireGuard add-on CTA / status */}
        {!wgLoading && !hasWireGuard && (
          <div className="mx-3 mb-2">
            <button
              onClick={() => setWgModalOpen(true)}
              className="w-full flex items-center gap-1.5 border border-primary/30 bg-primary/5 hover:bg-primary/10 px-2 py-2 transition-colors text-left"
            >
              <Zap className="w-3 h-3 text-primary shrink-0" />
              <div>
                <div className="text-[8px] font-bold text-primary uppercase tracking-wide">Add WireGuard</div>
                <div className="text-[7px] text-primary/40">From $5/mo</div>
              </div>
            </button>
          </div>
        )}
        {!wgLoading && hasWireGuard && (
          <div className="mx-3 mb-2">
            <Link href="/account"
              className="w-full flex items-center gap-1.5 border border-primary/20 hover:border-primary/40 px-2 py-1.5 transition-colors">
              <Zap className="w-3 h-3 text-primary shrink-0" />
              <div className="text-[8px] font-bold text-primary uppercase tracking-wide">WireGuard Active</div>
            </Link>
          </div>
        )}

        {/* User / sign-out */}
        {user && (
          <div className="p-3 border-t border-primary/20">
            <div className="text-[9px] font-mono text-primary/40 uppercase tracking-widest mb-1 truncate">
              {user.primaryEmailAddress?.emailAddress ?? user.username ?? "Operator"}
            </div>
            <Link href="/account"
              className="flex items-center gap-2 w-full text-[10px] font-mono uppercase tracking-widest text-primary/50 hover:text-primary border border-transparent hover:border-primary/30 px-2 py-1.5 transition-colors mb-0.5"
            >
              <User className="w-3 h-3" />
              MY ACCOUNT
            </Link>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 w-full text-[10px] font-mono uppercase tracking-widest text-primary/50 hover:text-primary border border-transparent hover:border-primary/30 px-2 py-1.5 transition-colors"
            >
              <LogOut className="w-3 h-3" />
              SIGN OUT
            </button>
          </div>
        )}
        <WireGuardModal open={wgModalOpen} onClose={() => setWgModalOpen(false)} />
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-12 border-b border-primary/20 flex items-center justify-between px-6 shrink-0">
          <div className="text-xs text-primary/50 tracking-widest">
            {location} // {new Date().toISOString()}
          </div>
          {user && (
            <div className="text-[10px] font-mono text-primary/30 uppercase tracking-widest">
              {user.username ?? user.firstName ?? "OP"}
            </div>
          )}
        </header>
        <div className="flex-1 overflow-auto p-6 relative min-h-0">
          {/* Scanline effect */}
          <div className="pointer-events-none fixed inset-0 z-50 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20" />
          <div className="relative z-10 h-full">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
