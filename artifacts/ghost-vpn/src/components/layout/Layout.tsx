// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
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
  Code2, GitCompare, Swords, Bug, Eye, BookMarked, Target, Skull,
  GitMerge, Ban, Bell, Fingerprint, Upload, ChevronDown,
  Lock, Shuffle, UserX, RefreshCcw,
  ShieldCheck, Key, FileCode2, Filter, FlaskConical,
  MapPin, ArrowLeftRight, Share2, Crosshair, Package, Plug, FileSearch,
  CheckCircle2, X,
  Camera, Clipboard, MessageSquare, FolderOpen, AppWindow, Puzzle,
  Bot,
} from "lucide-react";
import { useAccess } from "@/hooks/useAccess";
import { useNotifications } from "@/hooks/useNotifications";
import FirewallPromptOverlay from "@/components/FirewallPromptOverlay";

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
  "/security-audit":      "Security Audit",
  "/ai-audit":            "AI Security Audit",
  "/account-security":    "Account Security Center",
  "/command-governance":  "Command Governance",
  "/dependency-map":      "Dependency Health Map",
  "/node-trust":          "Node Trust Engine",
  "/security-score":      "Security Score",
  "/firewall-compiler":   "Firewall Policy Compiler",
  "/drift-monitor":       "Drift Monitor",
  "/config-lifecycle":    "VPN Config Lifecycle",
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
  "/parrot-tools":         "Parrot OS Tool Library",
  "/user-management":      "User Management",
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
  "/username-intel":       "Username Intelligence",
  "/canary":               "Canary Tokens",
  "/exploit-import":       "Exploit Importer",
  "/omnistrike":           "OmniStrike",
  "/social-breach":        "Social & Game Breach Tester",
  "/bug-bounty":           "Bug Bounty Research Hub",
  "/waf":                  "WAF Analyzer",
  "/manuals":              "ProxhqVPN Manuals",
  "/pqc":                  "Post-Quantum Encryption",
  "/daita":                "DAITA — Traffic Analysis Defense",
  "/dark-web":             "Dark Web Monitor",
  "/alt-id":               "Alternative Identity",
  "/ip-rotator":           "IP Rotator",
  "/ssl-tls":              "SSL/TLS Analyzer",
  "/jwt-analyzer":         "JWT Analyzer",
  "/sqli-scanner":         "SQL Injection Scanner",
  "/iac-scan":             "IaC Scanner",
  "/http-interceptor":     "HTTP Interceptor",
  "/api-tester":           "API Security Tester",
  "/gps-spoof":            "GPS Spoofing",
  "/port-forward":         "Port Forwarding",
  "/dedicated-ip":         "Dedicated IP",
  "/meshnet":              "Meshnet P2P",
  "/data-broker":          "Data Broker Removal",
  "/oast-tester":          "OAST Blind Tester",
  "/oast-server":          "OAST Callback Server",
  "/waf-bypass":           "WAF Bypass Generator",
  "/transparency":         "Transparency Report",
  "/dep-scanner":          "Dependency Scanner",
  "/token-seq":            "Token Entropy Sequencer",
  "/ws-tester":            "WebSocket Tester",
  "/sast":                 "SAST Analyzer",
  "/quantum-audit":        "QuantumAudit — Blockchain Security",
  "/ghost-pentest":        "GhostPentest — AI Pentest Engine",
  "/deception-engine":     "Deception Engine — Honeypot & Attacker Fingerprinting",
  "/request-mind":         "RequestMind — AI HTTP Scanner",
  "/soc-copilot":          "SOC Copilot — AI Security Ops",
  "/code-sentinel":        "CodeSentinel — AI SAST + Autofix",
  "/agent-strike":         "AgentStrike — Agentic Security",
  "/llm-probe":            "LLMProbe — LLM Vulnerability Scanner",
  "/ai-shield":            "AIShield — LLM Security Firewall",
  "/vpn-tracker":          "VPN Tracker",
};

const USER_NAV = [
  { href: "/my-vpn",        label: "Connect",         icon: Wifi },
  { href: "/pricing",       label: "Subscription",    icon: CreditCard },
  { href: "/devices",       label: "My Devices",      icon: Smartphone },
  { href: "/downloads",          label: "Download App",      icon: Download },
  { href: "/browser-extension", label: "Browser Extension", icon: Puzzle },
  { href: "/platforms",         label: "Setup Guide",       icon: BookOpen },
  { href: "/guide",         label: "User Guide",      icon: FileText },
  { href: "/manuals",       label: "Manuals Download", icon: BookMarked },
];

const PROTECTION_NAV = [
  { href: "/kill-switch",        label: "Kill Switch",         icon: Power },
  { href: "/leaks",              label: "Leak Test",           icon: Search },
  { href: "/dns-shield",         label: "DNS Protection",      icon: ShieldPlus },
  { href: "/dns-sinkhole",       label: "DNS Sinkhole",        icon: Ban },
  { href: "/threat-protection",  label: "Threat Protection",   icon: ShieldAlert },
  { href: "/obfuscation",        label: "Stealth Protocol",    icon: EyeOff },
  { href: "/ip-exposure",        label: "IP Exposure Scan",    icon: Eye },
  { href: "/ghost-trap",         label: "Ghost Trap",          icon: Skull },
  { href: "/ghost-trace",        label: "Ghost Trace",         icon: Radar },
];

const PRIVACY_SUITE_NAV = [
  { href: "/pqc",        label: "Post-Quantum Encryption", icon: Lock },
  { href: "/daita",      label: "DAITA Shield",            icon: EyeOff },
  { href: "/dark-web",   label: "Dark Web Monitor",        icon: Eye },
  { href: "/alt-id",     label: "Alternative Identity",    icon: UserX },
  { href: "/ip-rotator", label: "IP Rotator",              icon: RefreshCcw },
  { href: "/gps-spoof",  label: "GPS Spoofing",            icon: MapPin },
  { href: "/data-broker",label: "Data Broker Removal",     icon: FileSearch },
];

const NETWORK_NAV = [
  { href: "/vpngate",          label: "VPN Gate",          icon: Globe },
  { href: "/wireguard",        label: "WireGuard Config",  icon: Cpu },
  { href: "/split-tunnel",     label: "Split Tunneling",   icon: GitBranch },
  { href: "/proxy",            label: "Proxy & Tor",       icon: Globe2 },
  { href: "/onion-browser",    label: "Onion Browser",     icon: Onion },
  { href: "/network-monitor",  label: "Network Monitor",   icon: Activity },
  { href: "/smart-dns",        label: "Smart DNS",         icon: Zap },
  { href: "/router-config",    label: "Router Setup",      icon: Router },
  { href: "/vpn-coexist",      label: "VPN Coexistence",   icon: Settings },
  { href: "/vpn-tracker",      label: "VPN Tracker",       icon: Activity },
  { href: "/port-forward",     label: "Port Forwarding",   icon: ArrowLeftRight },
  { href: "/dedicated-ip",     label: "Dedicated IP",      icon: Share2 },
  { href: "/meshnet",          label: "Meshnet P2P",       icon: GitMerge },
];

// Tool tier assignments: 1=Recon, 2=Strike, 3=Arsenal
const TOOL_TIER: Record<string, 1 | 2 | 3> = {
  "/http-probe": 1, "/dir-fuzzer": 1, "/subdomain-scan": 1,
  "/encoder": 1, "/comparer": 1, "/payloads": 1, "/cve-search": 1,
  "/parrot-tools": 1, "/ip-exposure": 1,
  "/hackanon": 2,
  "/sqlmap": 2, "/alpha-tools": 2, "/tool-runner": 2, "/intruder": 2, "/ghost-chain": 2,
  "/ai-audit": 2,
  "/command-governance": 2, "/dependency-map": 2,
  "/siem": 2, "/osint": 2, "/username-intel": 2, "/canary": 2, "/exploit-import": 2,
  "/omnistrike": 2, "/social-breach": 2, "/bug-bounty": 2,
  "/ssl-tls": 2, "/jwt-analyzer": 2, "/sqli-scanner": 2,
  "/sast": 2, "/dep-scanner": 2, "/ghost-trace": 2, "/network-monitor": 2,
  "/waf": 3, "/iac-scan": 3, "/http-interceptor": 3, "/api-tester": 3,
  "/oast-tester": 3, "/oast-server": 3, "/waf-bypass": 3, "/token-seq": 3,
  "/deception-engine": 3,
  "/ws-tester": 3, "/quantum-audit": 3, "/ghost-pentest": 3, "/request-mind": 3,
  "/soc-copilot": 3, "/code-sentinel": 3, "/agent-strike": 3, "/llm-probe": 3,
  "/ai-shield": 3, "/ai-security-suite": 3,
};

const TIER_LABEL: Record<1 | 2 | 3, string> = { 1: "Recon", 2: "Strike", 3: "Arsenal" };
const TIER_COLOR: Record<1 | 2 | 3, string> = {
  1: "text-cyan-400/70 border-cyan-500/30",
  2: "text-orange-400/70 border-orange-500/30",
  3: "text-purple-400/70 border-purple-500/30",
};

const ADVANCED_NAV = [
  { href: "/ghost-trap",    label: "Ghost Trap — Counter Intel", icon: Skull },
  { href: "/sqlmap",        label: "Vulnerability Scanner", icon: ScanSearch },
  { href: "/alpha-tools",   label: "Alpha Toolkit",         icon: Layers },
  { href: "/tool-runner",   label: "Parrot Tool Runner",    icon: Terminal },
  { href: "/parrot-tools",  label: "Parrot OS Arsenal",     icon: Package },
  { href: "/hackanon",      label: "HackAnon — Exploits",   icon: Bug },
  { href: "/im-auto",       label: "Platform Automation",   icon: MessageSquare },
  { href: "/redteam-scan",  label: "Red Team Scanner",      icon: Crosshair },
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
  { href: "/username-intel", label: "Username Intelligence", icon: Crosshair },
  { href: "/canary",        label: "Canary Tokens",         icon: Bell },
  { href: "/exploit-import", label: "Exploit Importer",     icon: Upload },
  { href: "/omnistrike",    label: "OmniStrike",            icon: Zap },
  { href: "/waf",           label: "WAF Analyzer",          icon: Shield },
  { href: "/social-breach",      label: "Social & Game Breach",   icon: Globe2 },
  { href: "/bug-bounty",         label: "Bug Bounty Hub",         icon: Award },
  { href: "/ssl-tls",            label: "SSL/TLS Analyzer",       icon: ShieldCheck },
  { href: "/jwt-analyzer",       label: "JWT Analyzer",           icon: Key },
  { href: "/sqli-scanner",       label: "SQL Injection Scanner",  icon: Database },
  { href: "/iac-scan",           label: "IaC Scanner",            icon: FileCode2 },
  { href: "/http-interceptor",   label: "HTTP Interceptor",       icon: Filter },
  { href: "/api-tester",         label: "API Security Tester",    icon: FlaskConical },
  { href: "/oast-tester",        label: "OAST Blind Tester",      icon: Crosshair },
  { href: "/oast-server",        label: "OAST Callback Server",   icon: Crosshair },
  { href: "/waf-bypass",         label: "WAF Bypass Generator",   icon: Shield },
  { href: "/dep-scanner",        label: "Dependency Scanner",     icon: Package },
  { href: "/token-seq",          label: "Token Sequencer",        icon: Key },
  { href: "/ws-tester",          label: "WebSocket Tester",       icon: Plug },
  { href: "/sast",               label: "SAST Analyzer",          icon: FileSearch },
  { href: "/ai-audit",            label: "AI Security Audit",      icon: Bot },
  { href: "/quantum-audit",       label: "QuantumAudit",           icon: ShieldCheck },
  { href: "/command-governance",  label: "Command Governance",     icon: ShieldAlert },
  { href: "/dependency-map",      label: "Dependency Health Map",  icon: Server },
  { href: "/node-trust",          label: "Node Trust Engine",       icon: ShieldCheck },
  { href: "/firewall-compiler",   label: "Firewall Policy Compiler",icon: ShieldAlert },
  { href: "/drift-monitor",       label: "Drift Monitor",           icon: GitCompare },
  { href: "/event-graph",         label: "Global Event Graph",      icon: Activity },
  { href: "/security-score",      label: "Security Score",          icon: Shield },
  { href: "/config-lifecycle",    label: "VPN Config Lifecycle",    icon: FileText },
  { href: "/deception-engine",   label: "Deception Engine",       icon: Lock },
  { href: "/ghost-pentest",      label: "GhostPentest",           icon: Target },
  { href: "/request-mind",       label: "RequestMind",            icon: Globe2 },
  { href: "/soc-copilot",        label: "SOC Copilot",            icon: MessageSquare },
  { href: "/code-sentinel",      label: "CodeSentinel",           icon: Code2 },
  { href: "/agent-strike",       label: "AgentStrike",            icon: Zap },
  { href: "/llm-probe",          label: "LLMProbe",               icon: Cpu },
  { href: "/ai-shield",          label: "AIShield",               icon: ShieldPlus },
  { href: "/ai-security-suite",  label: "AI Security Suite",      icon: ShieldAlert },
  { href: "/omega-dashboard",    label: "Omega — Overview",        icon: LayoutDashboard },
  { href: "/omega-hosts",        label: "Omega — Hosts",           icon: Server },
  { href: "/omega-events",       label: "Omega — Events",          icon: Activity },
  { href: "/omega-system-info",  label: "Omega — System Info",     icon: Cpu },
  { href: "/omega-chat",         label: "Omega — Chat",            icon: MessageSquare },
  { href: "/omega-keylogger",    label: "Omega — Key Logger",      icon: Key },
  { href: "/omega-screen-capture", label: "Omega — Screen Capture", icon: Camera },
  { href: "/omega-file-manager", label: "Omega — File Manager",    icon: FolderOpen },
  { href: "/omega-processes",    label: "Omega — Processes",       icon: Cpu },
  { href: "/omega-windows",      label: "Omega — Windows",         icon: AppWindow },
  { href: "/omega-clipboard",    label: "Omega — Clipboard",       icon: Clipboard },
  { href: "/omega-message-manager", label: "Omega — Message Mgr",  icon: MessageSquare },
  { href: "/omega-remote-commands", label: "Omega — Remote Cmds",  icon: Terminal },
  { href: "/omega-ip-scanner",   label: "Omega — IP Scanner",      icon: Network },
  { href: "/omega-ip-tool",      label: "Omega — IP Tool",         icon: Network },
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
  { href: "/user-management",    label: "User Management",    icon: Users },
  { href: "/employees",          label: "Employee Access",    icon: UserX },
  { href: "/handbook/employee",  label: "Employee Handbook",  icon: BookMarked },
  { href: "/setup",              label: "Server Setup",       icon: Settings },
  { href: "/terminal",           label: "Terminal",           icon: Terminal },
  { href: "/sql",                label: "Database",           icon: Database },
];

const FIREWALL_NAV = [
  { href: "/firewall",                    label: "Overview",           icon: Shield },
  { href: "/firewall?tab=ghostos",        label: "GhostOS™ Terminal",  icon: Terminal },
  { href: "/firewall?tab=rules",          label: "Firewall Rules",     icon: Filter },
  { href: "/firewall?tab=blacklist",      label: "Blocked IPs",        icon: Ban },
  { href: "/firewall?tab=zones",          label: "Network Zones",      icon: Network },
  { href: "/firewall?tab=nat",            label: "NAT / Forwarding",   icon: ArrowLeftRight },
  { href: "/firewall?tab=ips",            label: "IPS Engine",         icon: Zap },
  { href: "/firewall?tab=dpi",            label: "DPI Engine",         icon: ScanSearch },
  { href: "/firewall?tab=threat",         label: "Threat Intel",       icon: ShieldAlert },
  { href: "/firewall?tab=atr",            label: "Auto-Response (ATR)",icon: ShieldCheck },
  { href: "/firewall?tab=ddos",           label: "DDoS Shield",        icon: Shield },
  { href: "/firewall?tab=peerrules",      label: "Per-Peer Rules",     icon: Key },
  { href: "/firewall?tab=riskscore",      label: "Risk Score",         icon: BarChart2 },
  { href: "/firewall?tab=optimizer",      label: "AI Optimizer",       icon: Cpu },
  { href: "/firewall?tab=geoip",          label: "Geo-IP Blocking",    icon: Globe },
  { href: "/firewall?tab=portscans",      label: "Portscan Detection", icon: Radar },
  { href: "/firewall?tab=qos",            label: "QoS / Shaping",      icon: Layers },
  { href: "/firewall?tab=analytics",      label: "Analytics",          icon: Activity },
  { href: "/firewall?tab=nodesync",       label: "Node Sync",          icon: Server },
  { href: "/firewall?tab=selinux",        label: "SELinux MAC",        icon: Lock },
  { href: "/firewall?tab=zerotrust",      label: "Zero Trust Seg.",    icon: CheckCircle2 },
  { href: "/firewall?tab=avengine",       label: "ProxhqAV Engine",    icon: Bug },
  { href: "/firewall?tab=looptrap",       label: "Endless Loop Engine™", icon: Shuffle },
  { href: "/firewall?tab=export",         label: "Export / Import",    icon: Upload },
];

function NavItem({ href, label, icon: Icon, onClick, locked, tier }: {
  href: string; label: string; icon: any; onClick?: () => void;
  locked?: boolean; tier?: 1 | 2 | 3;
}) {
  const [location] = useLocation();
  const basePath = href.split("?")[0];
  const hrefTab = href.includes("?tab=") ? new URLSearchParams(href.split("?")[1]).get("tab") : null;

  // Track window.location.search reactively — replaceState/pushState don't re-render wouter
  const [search, setSearch] = useState(() => (typeof window !== "undefined" ? window.location.search : ""));
  useEffect(() => {
    const update = () => setSearch(window.location.search);
    window.addEventListener("popstate", update);
    window.addEventListener("fw-tab-change", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("fw-tab-change", update);
    };
  }, []);

  const currentTab = new URLSearchParams(search).get("tab");
  const isActive = location === basePath &&
    (hrefTab === null
      ? currentTab === null || currentTab === "overview" || currentTab === ""
      : currentTab === hrefTab);

  if (locked) {
    const tierNum = tier ?? 3;
    const tcls = TIER_COLOR[tierNum];
    return (
      <div
        title={`Requires ${TIER_LABEL[tierNum]} tier — upgrade to unlock`}
        className="flex items-center gap-3 px-3 py-2 rounded-xl opacity-40 cursor-not-allowed select-none"
      >
        <Icon className="w-[17px] h-[17px] flex-shrink-0 text-white/30" />
        <span className="text-[13px] font-medium leading-none text-white/40 flex-1 truncate">{label}</span>
        <span className={`text-[8px] font-mono border px-1 py-0.5 rounded shrink-0 ${tcls}`}>
          {TIER_LABEL[tierNum]}
        </span>
        <Lock className="w-2.5 h-2.5 text-white/25 shrink-0" />
      </div>
    );
  }

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
      <span className="text-[13px] font-medium leading-none flex-1">{label}</span>
      {tier && tier > 1 && !isActive && (
        <span className={`text-[7px] font-mono border px-1 py-0.5 rounded shrink-0 ${TIER_COLOR[tier]}`}>
          {TIER_LABEL[tier]}
        </span>
      )}
      {isActive && <span className="ml-auto w-1 h-1 rounded-full bg-primary/70 shrink-0" />}
    </Link>
  );
}

function NavSection({ label, items, onNav, isOpen, onToggle, userDevTier }: {
  label: string;
  items: { href: string; label: string; icon: any }[];
  onNav?: () => void;
  isOpen: boolean;
  onToggle: () => void;
  userDevTier?: number | null;
}) {
  const [location] = useLocation();
  const [search, setSearch] = useState(() => (typeof window !== "undefined" ? window.location.search : ""));
  useEffect(() => {
    const update = () => setSearch(window.location.search);
    window.addEventListener("popstate", update);
    window.addEventListener("fw-tab-change", update);
    return () => {
      window.removeEventListener("popstate", update);
      window.removeEventListener("fw-tab-change", update);
    };
  }, []);
  const currentTab = new URLSearchParams(search).get("tab");
  const hasActive = items.some((i) => {
    const iBase = i.href.split("?")[0];
    const iTab = i.href.includes("?tab=") ? new URLSearchParams(i.href.split("?")[1]).get("tab") : null;
    if (location !== iBase) return false;
    if (iTab === null) return currentTab === null || currentTab === "overview" || currentTab === "";
    return currentTab === iTab;
  });

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

      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
        isOpen ? "max-h-[3000px] opacity-100" : "max-h-0 opacity-0"
      }`}>
        <div className="space-y-0.5 pb-1">
          {items.map((item) => {
            const itemTier = TOOL_TIER[item.href];
            const locked = userDevTier !== undefined && userDevTier !== null && itemTier !== undefined && (userDevTier < itemTier);
            return <NavItem key={item.href} {...item} onClick={locked ? undefined : onNav} locked={locked} tier={itemTier} />;
          })}
        </div>
      </div>
    </div>
  );
}

interface UpdateInfo {
  version: string;
}

// Latest published standalone version — bump this whenever a new build ships
const LATEST_STANDALONE_VERSION = "2.2.0";

function semverGt(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return true;
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return false;
  }
  return false;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { isAdmin, isEmployee, hasAccess, hasCommandCenter, tier, devTier } = useAccess();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<UpdateInfo | null>(null);
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // Standalone mode: show "newer version available" banner when the running
  // server is older than LATEST_STANDALONE_VERSION (port 7474 = standalone).
  const [standaloneOldVer, setStandaloneOldVer] = useState<string | null>(null);
  const [standaloneUpdateDismissed, setStandaloneUpdateDismissed] = useState(false);

  const { notifications, unreadCount, newAlert, markRead, markAllRead, dismissAlert } = useNotifications(30_000);
  const [alertVisible, setAlertVisible] = useState(false);

  // Show payment alert banner when a new confirmed notification arrives
  useEffect(() => {
    if (!newAlert) return;
    setAlertVisible(true);
    const t = setTimeout(() => { setAlertVisible(false); setTimeout(dismissAlert, 400); }, 8000);
    return () => clearTimeout(t);
  }, [newAlert, dismissAlert]);

  // Register the callback that Electron calls when a background update finishes downloading
  useEffect(() => {
    (window as any).__proxhqShowUpdateBanner = (info: UpdateInfo) => {
      setPendingUpdate(info);
      setUpdateDismissed(false);
    };
    return () => { delete (window as any).__proxhqShowUpdateBanner; };
  }, []);

  // Standalone update check — only runs when loaded from the standalone server
  // (port 7474). Compares the running server version to LATEST_STANDALONE_VERSION
  // and surfaces a banner if the user needs to re-download.
  useEffect(() => {
    const port = window.location.port;
    if (port !== "7474") return;
    const DISMISS_KEY = `proxhq_standalone_update_dismissed_${LATEST_STANDALONE_VERSION}`;
    if (localStorage.getItem(DISMISS_KEY) === "1") return;
    fetch("/api/update/check")
      .then((r) => r.json())
      .then((data: { version?: string }) => {
        const running = data.version ?? "0.0.0";
        if (semverGt(LATEST_STANDALONE_VERSION, running)) {
          setStandaloneOldVer(running);
        }
      })
      .catch(() => {/* offline or API unavailable — silently ignore */});
  }, []);

  function updateNow() {
    setRestarting(true);
    // Give the UI a moment to show "Restarting…" before Electron kills the window
    setTimeout(() => {
      (window as any).proxhq?.installUpdateNow?.();
    }, 600);
  }

  const showBanner = pendingUpdate && !updateDismissed;
  const showStandaloneBanner = standaloneOldVer !== null && !standaloneUpdateDismissed;

  function dismissStandaloneUpdate() {
    const DISMISS_KEY = `proxhq_standalone_update_dismissed_${LATEST_STANDALONE_VERSION}`;
    localStorage.setItem(DISMISS_KEY, "1");
    setStandaloneUpdateDismissed(true);
  }

  const pageName = PAGE_NAMES[location] ?? "ProxhqVPN";
  const closeSidebar = () => setSidebarOpen(false);

  const SidebarContent = () => {
    const [location] = useLocation();

    // Determine which section contains the current route so it opens by default
    const getDefaultSection = () => {
      if (USER_NAV.some((i) => i.href === location)) return "myvpn";
      if (AMBASSADOR_NAV.some((i) => i.href === location)) return "ambassadors";
      if (PROTECTION_NAV.some((i) => i.href === location)) return "protection";
      if (PRIVACY_SUITE_NAV.some((i) => i.href === location)) return "privacysuite";
      if (NETWORK_NAV.some((i) => i.href === location)) return "network";
      if (FIREWALL_NAV.some((i) => i.href.split("?")[0] === location)) return "firewall";
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
        <NavSection label="My VPN" items={USER_NAV} onNav={closeSidebar} isOpen={openSection === "myvpn"} onToggle={() => toggle("myvpn")} />
        {/* Ambassadors — only shown to subscribers and staff; free accounts are not eligible */}
        {(hasAccess || isAdmin || isEmployee) && (
          <NavSection label="Ambassadors" items={AMBASSADOR_NAV} onNav={closeSidebar} isOpen={openSection === "ambassadors"} onToggle={() => toggle("ambassadors")} />
        )}
        {hasAccess && (
          <>
            <NavSection label="Protection"    items={PROTECTION_NAV}    onNav={closeSidebar} isOpen={openSection === "protection"}    onToggle={() => toggle("protection")} />
            <NavSection label="Privacy Suite" items={PRIVACY_SUITE_NAV} onNav={closeSidebar} isOpen={openSection === "privacysuite"} onToggle={() => toggle("privacysuite")} />
            <NavSection label="Network"       items={NETWORK_NAV}       onNav={closeSidebar} isOpen={openSection === "network"}       onToggle={() => toggle("network")} />
            <NavSection label="🔥 Firewall"  items={FIREWALL_NAV}      onNav={closeSidebar} isOpen={openSection === "firewall"}      onToggle={() => toggle("firewall")} />
          </>
        )}
        {hasCommandCenter && (
          <NavSection label="Command Center" items={ADVANCED_NAV} onNav={closeSidebar} isOpen={openSection === "commandcenter"} onToggle={() => toggle("commandcenter")} userDevTier={devTier} />
        )}
        {/* Admin section — visible to owners and employees only */}
        {(isAdmin || isEmployee) && (
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
      <div className="px-4 py-2.5 border-t border-white/[0.04] shrink-0 text-center">
        <div className="text-[9px] text-white/25 leading-snug">© {new Date().getFullYear()} Alpha Unlimited Technologies LLC</div>
        <div className="text-[8px] text-white/15 mt-0.5">All rights reserved.</div>
      </div>
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
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-[11px] text-white/70 tabular-nums font-mono">
              {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>

            {/* ── Notification bell ── */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => { setNotifOpen(v => !v); setUserMenuOpen(false); }}
                  className="relative w-7 h-7 rounded-lg flex items-center justify-center text-white/50 hover:text-white/80 hover:bg-white/[0.07] transition-all"
                  title="Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-orange-500 text-[8px] font-bold text-black flex items-center justify-center leading-none">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
                    <div className="absolute right-0 top-9 w-80 bg-[#0a0f0c] border border-white/[0.08] rounded-xl shadow-2xl z-50 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                        <div className="text-[12px] font-semibold text-white/80">Notifications</div>
                        {unreadCount > 0 && (
                          <button onClick={markAllRead} className="text-[10px] text-primary/70 hover:text-primary transition-colors font-mono">
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-72 overflow-y-auto divide-y divide-white/[0.04]">
                        {notifications.length === 0 ? (
                          <div className="px-4 py-6 text-center text-[11px] text-white/30 font-mono">No notifications yet</div>
                        ) : notifications.map((n) => (
                          <div
                            key={n.id}
                            onClick={() => markRead(n.id)}
                            className={`px-4 py-3 cursor-pointer transition-all hover:bg-white/[0.03] ${!n.read ? "bg-orange-500/5" : ""}`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                                n.type === "crypto_payment_confirmed"
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-white/[0.07] text-white/40"
                              }`}>
                                <CheckCircle2 className="w-3 h-3" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-[11px] font-semibold text-white/88 leading-snug">{n.title}</div>
                                <div className="text-[10px] text-white/50 mt-0.5 leading-relaxed">{n.body}</div>
                                <div className="text-[9px] text-white/25 font-mono mt-1">
                                  {new Date(n.createdAt).toLocaleString()}
                                </div>
                              </div>
                              {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-orange-400 shrink-0 mt-1.5" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {user && (
              <div className="relative">
                <button
                  onClick={() => { setUserMenuOpen(v => !v); setNotifOpen(false); }}
                  className="w-7 h-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center hover:bg-primary/25 transition-all"
                  title="Account menu"
                >
                  <span className="text-primary text-[11px] font-bold leading-none">
                    {(user.firstName?.[0] ?? user.username?.[0] ?? "U").toUpperCase()}
                  </span>
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-[#0d1a0f] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/70 z-50 overflow-hidden">
                      <div className="px-3 py-2.5 border-b border-white/[0.06]">
                        <div className="text-[12px] font-semibold text-white/90 truncate leading-tight">
                          {user.firstName
                            ? `${user.firstName} ${user.lastName ?? ""}`.trim()
                            : (user.username ?? "User")}
                        </div>
                        <div className="text-[10px] text-white/83 truncate mt-0.5">
                          {user.primaryEmailAddress?.emailAddress ?? ""}
                        </div>
                        <div className="mt-1.5">
                          {tier === "command_center" && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-yellow-400 bg-yellow-500/10 px-1.5 py-0.5 rounded-full">Pro</span>
                          )}
                          {tier === "vpn" && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">VPN Basic</span>
                          )}
                          {!tier && (
                            <span className="text-[9px] font-bold uppercase tracking-widest text-white/40 bg-white/5 px-1.5 py-0.5 rounded-full">No Plan</span>
                          )}
                        </div>
                      </div>
                      <Link
                        href="/account"
                        onClick={() => { setUserMenuOpen(false); closeSidebar(); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[12px] text-white/78 hover:text-white hover:bg-white/[0.05] transition-colors"
                      >
                        <User className="w-3.5 h-3.5 shrink-0" /> Account Settings
                      </Link>
                      <div className="border-t border-white/[0.06]" />
                      <button
                        onClick={() => { setUserMenuOpen(false); signOut(); }}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[12px] text-white/78 hover:text-red-400 hover:bg-red-900/[0.12] transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5 shrink-0" /> Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="p-5 lg:p-7">
            {children}
          </div>
        </main>
      </div>

      {/* ── Payment confirmed banner ────────────────────────────────────────── */}
      {newAlert && (
        <div className={`fixed top-14 right-4 z-50 w-80 transition-all duration-400 ${alertVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2 pointer-events-none"}`}>
          <div className="bg-[#0a1a0d] border border-green-500/40 rounded-xl shadow-2xl shadow-black/60 p-4 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-green-500/15 border border-green-500/25 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-white leading-tight">{newAlert.title}</div>
              <div className="text-[10px] text-white/60 mt-1 leading-relaxed">{newAlert.body}</div>
            </div>
            <button
              onClick={() => { setAlertVisible(false); setTimeout(dismissAlert, 400); if (newAlert) markRead(newAlert.id); }}
              className="text-white/30 hover:text-white/60 transition-colors shrink-0 mt-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Standalone update banner — shown when running an older local server build */}
      {showStandaloneBanner && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-full max-w-lg px-4 animate-in slide-in-from-top-4 duration-300">
          <div className="bg-[#0d1a0f] border border-primary/40 rounded-xl shadow-2xl shadow-black/60 p-4 flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-white leading-tight">
                  ProxhqVPN {LATEST_STANDALONE_VERSION} is available
                </div>
                <div className="text-[11px] text-white/60 mt-0.5 leading-snug">
                  You are running v{standaloneOldVer}. New in v{LATEST_STANDALONE_VERSION}: All fake/synthetic data eliminated, real standalone auth system (login + lockout), CORS hardened to localhost-only, Ghost Chain real probes, QuantumAudit real address validation, and all security hardening from v2.2.
                </div>
              </div>
              <button
                onClick={dismissStandaloneUpdate}
                className="text-white/30 hover:text-white/60 transition-colors shrink-0 mt-0.5"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex gap-2">
              <a
                href="/downloads"
                className="flex-1 bg-primary text-black text-[12px] font-semibold py-2 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download Update
              </a>
              <button
                onClick={dismissStandaloneUpdate}
                className="px-4 text-[12px] font-medium text-white/60 hover:text-white/50 border border-white/10 rounded-lg hover:border-white/20 transition-colors"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Firewall Connection Approval Overlay — per-user persistent allow/block decisions */}
      <FirewallPromptOverlay />
    </div>
  );
}
