import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Search, 
  List, 
  ShieldAlert, 
  Cpu,
  Menu,
  ShieldCheck,
  Terminal,
  Globe,
  Code2,
  Key,
  Layers,
  BarChart3,
  Lock,
  Crosshair,
  GitBranch,
  Zap,
  Link2,
  Pickaxe,
  Activity,
  Unlock,
  Wallet,
  ShieldBan,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const NavItem = ({ href, icon: Icon, label }: NavItemProps) => {
    const isActive = location === href || (href !== "/" && location.startsWith(href));
    
    return (
      <Link href={href} className="block">
        <div
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md transition-all duration-200",
            isActive 
              ? "bg-primary/10 text-primary font-medium" 
              : "text-muted-foreground hover:bg-accent hover:text-foreground"
          )}
        >
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </div>
      </Link>
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col md:flex-row bg-background text-foreground dark">
      {/* Mobile header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-2 font-mono font-bold text-lg text-primary">
          <ShieldCheck className="w-6 h-6" />
          QuantumAudit
        </div>
        <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Menu className="w-5 h-5" />
        </Button>
      </div>

      {/* Sidebar */}
      <div 
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static md:flex-shrink-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6 hidden md:flex items-center gap-2 font-mono font-bold text-xl text-primary border-b border-border">
          <ShieldCheck className="w-6 h-6" />
          QuantumAudit
        </div>

        <div className="flex-1 py-6 px-4 space-y-1 overflow-y-auto">
          <NavItem href="/" icon={LayoutDashboard} label="Dashboard" />
          <NavItem href="/scan/new" icon={Search} label="New Scan" />
          <NavItem href="/scans" icon={List} label="All Scans" />
          <NavItem href="/vulnerabilities" icon={ShieldAlert} label="Vulnerabilities" />
          <NavItem href="/quantum-threats" icon={Cpu} label="Quantum Threats" />
          <div className="pt-2 mt-2 border-t border-border/50 space-y-1">
            <NavItem href="/live-scan" icon={Globe} label="Live Chain Scan" />
            <NavItem href="/deep-analysis" icon={Code2} label="Deep Analysis" />
            <NavItem href="/ecdsa-scanner" icon={Key} label="ECDSA Scanner" />
            <NavItem href="/scheme-auditor" icon={Layers} label="Scheme Auditor" />
            <NavItem href="/batch-scan" icon={BarChart3} label="Batch Scanner" />
            <NavItem href="/batch-jobs" icon={Lock} label="Scan Jobs (Admin)" />
            <NavItem href="/threat-scanner" icon={Crosshair} label="Threat Scanner" />
            <NavItem href="/spider" icon={GitBranch} label="Adaptive Spider" />
            <NavItem href="/unified" icon={Zap} label="Unified Scanner" />
            <NavItem href="/proxy-scanner" icon={Link2} label="Proxy Scanner" />
            <NavItem href="/sig-miner" icon={Pickaxe} label="Sig Miner Suite" />
            <NavItem href="/autonomous" icon={Activity} label="Autonomous Scan" />
            <NavItem href="/key-recovery" icon={Unlock} label="Key Recovery" />
            <NavItem href="/wallet-scanner" icon={Wallet} label="Wallet Scanner" />
            <NavItem href="/wallet-intel" icon={ShieldBan} label="Attack Vector Audit" />
            <NavItem href="/pentest" icon={Terminal} label="Pen Test" />
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          {children}
        </div>
      </main>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
