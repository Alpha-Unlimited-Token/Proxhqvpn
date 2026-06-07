// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// GhostOS™ Firewall — ProxhqVPN Next-Generation Firewall System
import { useState, useRef, useEffect } from "react";
import {
  Shield, Terminal, AlertTriangle, Globe2, Rss, Layers, Link2,
  Ban, BarChart3, Download, Trash2, RefreshCw, Zap, Eye,
  Play, Plus, Search, Copy, Check,
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
};
const TABS = [
  { id:"overview", label:"Overview" }, { id:"ghostos", label:"GhostOS™" }, { id:"ips", label:"IPS Engine" },
  { id:"dpi", label:"DPI Engine" }, { id:"threat", label:"Threat Intel" }, { id:"zones", label:"Zones" },
  { id:"rules", label:"Rules" }, { id:"blacklist", label:"Blacklist" }, { id:"analytics", label:"Analytics" }, { id:"export", label:"Export" },
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
    </div>
  );
}
