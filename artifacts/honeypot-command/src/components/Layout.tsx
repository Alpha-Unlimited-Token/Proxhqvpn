// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Server,
  Users,
  Terminal,
  FileCode2,
  ShieldAlert,
  Bell,
  Database,
  Bug,
  ChevronRight,
} from "lucide-react";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/nodes", label: "Nodes", icon: Server },
  { href: "/attackers", label: "Attackers", icon: Users },
  { href: "/sessions", label: "Sessions", icon: Terminal },
  { href: "/commands", label: "Commands", icon: FileCode2 },
  { href: "/files", label: "Payloads", icon: Bug },
  { href: "/iocs", label: "IOCs", icon: Database },
  { href: "/alerts", label: "Alerts", icon: Bell },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        {/* Brand */}
        <div className="px-4 py-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-primary" />
            <div>
              <div className="text-sm font-bold text-primary tracking-wider font-mono">HONEYPOT</div>
              <div className="text-xs text-muted-foreground">Command Center</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 px-2 overflow-y-auto">
          <div className="space-y-0.5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? location === "/" : location.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded text-sm transition-colors",
                    active
                      ? "bg-primary/10 text-primary font-medium border border-primary/20"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className={cn("w-4 h-4 flex-shrink-0", active && "text-primary")} />
                  {label}
                  {active && <ChevronRight className="w-3 h-3 ml-auto text-primary/60" />}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="text-[10px] text-muted-foreground font-mono">
            © Alpha Unlimited Technologies LLC
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
