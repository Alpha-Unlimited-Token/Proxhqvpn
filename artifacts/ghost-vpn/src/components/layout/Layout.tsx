import React, { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Activity, ShieldAlert, Network, Terminal, Database, Server, Settings2, Code, Shield, Globe, Layers } from "lucide-react";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", label: "DASHBOARD", icon: Activity },
    { href: "/nodes", label: "NODE MGR", icon: Server },
    { href: "/beacons", label: "BEACONS", icon: ShieldAlert },
    { href: "/silkweb", label: "SILK WEB", icon: Network },
    { href: "/firewall", label: "FIREWALL", icon: Shield },
    { href: "/wireguard", label: "WG CONFIG", icon: Settings2 },
    { href: "/monitor", label: "MONITOR", icon: Activity },
    { href: "/terminal", label: "TERMINAL", icon: Terminal },
    { href: "/sql", label: "SQL INTF", icon: Database },
    { href: "/proxy", label: "PROXY/TOR", icon: Globe },
    { href: "/onion-browser", label: "ONION BROWSER", icon: Layers },
  ];

  return (
    <div className="min-h-screen bg-black text-primary flex selection:bg-primary selection:text-black">
      {/* Sidebar */}
      <aside className="w-64 border-r border-primary/20 flex flex-col">
        <div className="p-4 border-b border-primary/20">
          <h1 className="text-xl font-bold tracking-tighter">GHOSTNET_OS</h1>
          <div className="text-xs text-primary/60 mt-1 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            SYS_ONLINE
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href} className={`flex items-center gap-3 px-3 py-2 border ${isActive ? 'bg-primary/10 border-primary text-primary' : 'border-transparent text-primary/70 hover:bg-primary/5 hover:text-primary hover:border-primary/50'} transition-colors`}>
                <Icon className="w-4 h-4" />
                <span className="text-sm font-bold tracking-wider">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-12 border-b border-primary/20 flex items-center justify-between px-6 shrink-0">
          <div className="text-xs text-primary/50 tracking-widest">
            {location} // {new Date().toISOString()}
          </div>
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
