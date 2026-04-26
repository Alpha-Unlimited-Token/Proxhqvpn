import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Shield, ShieldAlert, Plus, Trash2, RefreshCw, Download,
  AlertTriangle, CheckCircle, Info, Search, ToggleLeft, ToggleRight, Eye
} from "lucide-react";

const API = "/api/waf";

const ATTACK_TYPES = ["sqli","xss","lfi","rfi","cmdi","xxe","ssrf","ssti","pathtraversal","sqlmap","ratelimit","other"];
const SEVERITIES = ["critical","high","medium","low","info"];
const TARGETS = ["any","url","ua","header","body"];
const ACTIONS = ["block","alert","log","challenge"];

const SEV_COLOR: Record<string, string> = {
  critical: "bg-red-600 text-white",
  high: "bg-orange-500 text-white",
  medium: "bg-yellow-500 text-black",
  low: "bg-blue-500 text-white",
  info: "bg-gray-600 text-white",
};

const TYPE_COLOR: Record<string, string> = {
  sqlmap: "bg-red-900 text-red-300 border-red-800",
  sqli: "bg-orange-900 text-orange-300 border-orange-800",
  xss: "bg-yellow-900 text-yellow-300 border-yellow-800",
  cmdi: "bg-red-900 text-red-300 border-red-800",
  lfi: "bg-purple-900 text-purple-300 border-purple-800",
  rfi: "bg-purple-900 text-purple-300 border-purple-800",
  ssrf: "bg-blue-900 text-blue-300 border-blue-800",
  xxe: "bg-pink-900 text-pink-300 border-pink-800",
  ssti: "bg-cyan-900 text-cyan-300 border-cyan-800",
  pathtraversal: "bg-amber-900 text-amber-300 border-amber-800",
  default: "bg-gray-800 text-gray-300 border-gray-700",
};

type WafRule = {
  id: number;
  name: string;
  attackType: string;
  severity: string;
  action: string;
  pattern: string;
  target: string;
  enabled: boolean;
  hitCount: number;
  description?: string;
};

type WafEvent = {
  id: number;
  ruleName?: string;
  attackType?: string;
  severity?: string;
  action?: string;
  sourceIp?: string;
  method?: string;
  path?: string;
  matchedOn?: string;
  payload?: string;
  blocked: boolean;
  anomalyScore: number;
  detectedAt: string;
};

type Stats = {
  totalEvents: number;
  totalBlocked: number;
  totalAlerted: number;
  enabledRules: number;
  totalRules: number;
  byAttackType: Record<string, number>;
  topAttackedPaths: [string, number][];
};

export default function WafAnalyzer() {
  const { toast } = useToast();
  const [tab, setTab] = usePersistedState<"rules" | "analyze" | "events" | "export">("waf-tab", "rules");
  const [rules, setRules] = useState<WafRule[]>([]);
  const [events, setEvents] = useState<WafEvent[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filter, setFilter] = usePersistedState<string>("waf-filter", "");
  const [filterType, setFilterType] = usePersistedState<string>("waf-filtertype", "all");
  const [seeding, setSeeding] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [wafConfig, setWafConfig] = useState<any>(null);

  // Analyzer state
  const [aMethod, setAMethod] = useState("GET");
  const [aPath, setAPath] = useState("/");
  const [aUA, setAUA] = useState("");
  const [aBody, setABody] = useState("");
  const [aSource, setASource] = useState("1.2.3.4");
  const [aResult, setAResult] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);

  // Create rule form
  const [newRule, setNewRule] = useState({ name: "", attackType: "sqli", severity: "high", action: "block", pattern: "", target: "any", description: "" });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const [rR, eR, sR] = await Promise.all([
        fetch(`${API}/rules`), fetch(`${API}/events`), fetch(`${API}/stats`),
      ]);
      const [rd, ed, sd] = await Promise.all([rR.json(), eR.json(), sR.json()]);
      setRules(rd.rules ?? []);
      setEvents(ed.events ?? []);
      setStats(sd);
    } catch (e: any) {
      toast({ title: "Load error", description: e.message, variant: "destructive" });
    }
  };

  const seedRules = async () => {
    setSeeding(true);
    try {
      const r = await fetch(`${API}/seed`, { method: "POST" });
      const d = await r.json();
      toast({ title: d.message ?? `Seeded ${d.seeded} OWASP rules` });
      loadAll();
    } finally { setSeeding(false); }
  };

  const resetRules = async () => {
    if (!confirm("Reset all WAF rules to defaults? Custom rules will be lost.")) return;
    await fetch(`${API}/reset`, { method: "POST" });
    toast({ title: "Rules reset to OWASP defaults" });
    loadAll();
  };

  const toggleRule = async (rule: WafRule) => {
    await fetch(`${API}/rules/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !rule.enabled }),
    });
    setRules(prev => prev.map(r => r.id === rule.id ? { ...r, enabled: !r.enabled } : r));
  };

  const deleteRule = async (id: number) => {
    await fetch(`${API}/rules/${id}`, { method: "DELETE" });
    setRules(prev => prev.filter(r => r.id !== id));
    toast({ title: "Rule deleted" });
  };

  const createRule = async () => {
    if (!newRule.name || !newRule.pattern) { toast({ title: "Name and pattern required", variant: "destructive" }); return; }
    try { new RegExp(newRule.pattern); } catch { toast({ title: "Invalid regex pattern", variant: "destructive" }); return; }
    const r = await fetch(`${API}/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newRule),
    });
    const rule = await r.json();
    setRules(prev => [rule, ...prev]);
    setShowCreate(false);
    setNewRule({ name: "", attackType: "sqli", severity: "high", action: "block", pattern: "", target: "any", description: "" });
    toast({ title: "WAF rule created" });
  };

  const analyze = async () => {
    setAnalyzing(true);
    setAResult(null);
    try {
      const r = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: aMethod, path: aPath,
          headers: { "User-Agent": aUA, "Content-Type": "application/json" },
          body: aBody, sourceIp: aSource,
        }),
      });
      setAResult(await r.json());
      loadAll();
    } finally { setAnalyzing(false); }
  };

  const clearEvents = async () => {
    if (!confirm("Clear all WAF event logs?")) return;
    await fetch(`${API}/events`, { method: "DELETE" });
    setEvents([]);
    toast({ title: "Event log cleared" });
  };

  const loadConfig = async () => {
    const r = await fetch(`${API}/generate-config`);
    setWafConfig(await r.json());
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const filtered = rules.filter(r => {
    const matchText = !filter || r.name.toLowerCase().includes(filter.toLowerCase()) || r.pattern.toLowerCase().includes(filter.toLowerCase());
    const matchType = filterType === "all" || r.attackType === filterType;
    return matchText && matchType;
  });

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Shield className="h-7 w-7 text-cyan-400" />
          <h1 className="text-2xl font-bold text-white">WAF Analyzer</h1>
          <Badge className="bg-cyan-900 text-cyan-300 border-cyan-700">Web Application Firewall</Badge>
        </div>
        <p className="text-gray-400 text-sm">
          Signature-based WAF engine with OWASP CRS rules — analyzes HTTP requests, detects SQLMap, SQL injection, XSS, LFI, CMDi, SSRF, XXE, SSTI attacks. Exports ModSecurity, Nginx, Apache configs.
        </p>
      </div>

      {/* Stats Bar */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Events", value: stats.totalEvents, color: "text-white" },
            { label: "Blocked", value: stats.totalBlocked, color: "text-red-400" },
            { label: "Active Rules", value: stats.enabledRules, color: "text-green-400" },
            { label: "Total Rules", value: stats.totalRules, color: "text-cyan-400" },
          ].map(s => (
            <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-800 overflow-x-auto">
        {[["rules","Signature Rules"], ["analyze","Request Analyzer"], ["events","Attack Log"], ["export","Export Config"]].map(([id, label]) => (
          <button key={id} onClick={() => { setTab(id as any); if (id === "export") loadConfig(); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${tab === id ? "border-cyan-500 text-cyan-400" : "border-transparent text-gray-400 hover:text-gray-200"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Rules Tab ────────────────────────────────────────────────────────── */}
      {tab === "rules" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
              <Input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search rules..."
                className="pl-9 bg-gray-800 border-gray-700 text-white text-sm" />
            </div>
            <select value={filterType} onChange={e => setFilterType(e.target.value)}
              className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-2">
              <option value="all">All Types</option>
              {ATTACK_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
            <Button size="sm" onClick={() => setShowCreate(p => !p)} className="bg-cyan-700 hover:bg-cyan-600">
              <Plus className="h-4 w-4 mr-1" /> Add Rule
            </Button>
            {rules.length === 0 && (
              <Button size="sm" onClick={seedRules} disabled={seeding} className="bg-gray-700 hover:bg-gray-600">
                <Shield className="h-4 w-4 mr-1" />{seeding ? "Seeding..." : "Load OWASP Rules"}
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={resetRules} className="border-gray-600 text-gray-400">
              Reset Defaults
            </Button>
            <Button size="sm" variant="ghost" onClick={loadAll} className="text-gray-400">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Create rule form */}
          {showCreate && (
            <div className="bg-gray-900 border border-cyan-800 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-cyan-400">New WAF Rule</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input placeholder="Rule name" value={newRule.name} onChange={e => setNewRule(p => ({...p, name: e.target.value}))}
                  className="bg-gray-800 border-gray-700 text-white text-sm" />
                <Input placeholder="Regex pattern (e.g. (?i)union.*select)" value={newRule.pattern}
                  onChange={e => setNewRule(p => ({...p, pattern: e.target.value}))}
                  className="bg-gray-800 border-gray-700 text-white font-mono text-sm" />
                {[
                  { label: "Attack Type", key: "attackType", opts: ATTACK_TYPES },
                  { label: "Severity", key: "severity", opts: SEVERITIES },
                  { label: "Action", key: "action", opts: ACTIONS },
                  { label: "Match Target", key: "target", opts: TARGETS },
                ].map(({label, key, opts}) => (
                  <select key={key} value={(newRule as any)[key]} onChange={e => setNewRule(p => ({...p, [key]: e.target.value}))}
                    className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-2">
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ))}
              </div>
              <Input placeholder="Description (optional)" value={newRule.description} onChange={e => setNewRule(p => ({...p, description: e.target.value}))}
                className="bg-gray-800 border-gray-700 text-white text-sm" />
              <div className="flex gap-2">
                <Button onClick={createRule} size="sm" className="bg-cyan-700 hover:bg-cyan-600">Create Rule</Button>
                <Button onClick={() => setShowCreate(false)} size="sm" variant="outline" className="border-gray-600 text-gray-400">Cancel</Button>
              </div>
            </div>
          )}

          <div className="text-xs text-gray-500">{filtered.length} rules</div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filtered.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center">
                <Shield className="h-10 w-10 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400">No rules yet — click "Load OWASP Rules" to seed 35 production-ready signatures</p>
              </div>
            ) : filtered.map(rule => (
              <div key={rule.id} className={`bg-gray-900 border rounded-lg p-3 flex items-start gap-3 ${rule.enabled ? "border-gray-700" : "border-gray-800 opacity-50"}`}>
                <button onClick={() => toggleRule(rule)} className="mt-0.5 shrink-0">
                  {rule.enabled
                    ? <ToggleRight className="h-5 w-5 text-green-400" />
                    : <ToggleLeft className="h-5 w-5 text-gray-600" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-white">{rule.name}</span>
                    <Badge className={`text-xs ${SEV_COLOR[rule.severity] ?? SEV_COLOR.info}`}>{rule.severity}</Badge>
                    <Badge className={`text-xs border ${TYPE_COLOR[rule.attackType] ?? TYPE_COLOR.default}`}>{rule.attackType}</Badge>
                    <Badge className={`text-xs ${rule.action === "block" ? "bg-red-900 text-red-300" : "bg-yellow-900 text-yellow-300"} border-0`}>
                      {rule.action}
                    </Badge>
                    <span className="text-xs text-gray-500">on: {rule.target}</span>
                    {rule.hitCount > 0 && <span className="text-xs text-orange-400">{rule.hitCount} hits</span>}
                  </div>
                  <code className="text-xs text-cyan-300 bg-gray-800 px-2 py-0.5 rounded break-all">{rule.pattern}</code>
                  {rule.description && <p className="text-xs text-gray-500 mt-1">{rule.description}</p>}
                </div>
                <button onClick={() => deleteRule(rule.id)} className="text-gray-600 hover:text-red-400 shrink-0 ml-1">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Analyzer Tab ─────────────────────────────────────────────────────── */}
      {tab === "analyze" && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">HTTP Request to Analyze</h3>
              <p className="text-xs text-gray-500">Paste any real or suspected request — the WAF engine checks every active rule against it</p>
              <div className="grid grid-cols-2 gap-3">
                <select value={aMethod} onChange={e => setAMethod(e.target.value)}
                  className="bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded px-3 py-2">
                  {["GET","POST","PUT","DELETE","PATCH","OPTIONS"].map(m => <option key={m}>{m}</option>)}
                </select>
                <Input value={aPath} onChange={e => setAPath(e.target.value)} placeholder="/search?q=test"
                  className="bg-gray-800 border-gray-700 text-white font-mono text-sm" />
              </div>
              <Input value={aUA} onChange={e => setAUA(e.target.value)} placeholder="User-Agent (leave blank for default)"
                className="bg-gray-800 border-gray-700 text-white text-sm" />
              <Input value={aSource} onChange={e => setASource(e.target.value)} placeholder="Source IP"
                className="bg-gray-800 border-gray-700 text-white font-mono text-sm" />
              <textarea value={aBody} onChange={e => setABody(e.target.value)} placeholder="Request body (JSON, form data, XML...)"
                className="w-full bg-gray-800 border border-gray-700 text-white font-mono text-sm rounded px-3 py-2 min-h-[80px] resize-y" />

              {/* Quick test presets */}
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-500">Quick test:</span>
                {[
                  { label: "SQLMap UA", ua: "sqlmap/1.7.2#stable", path: "/", body: "" },
                  { label: "UNION SELECT", ua: "", path: "/?id=1' UNION SELECT NULL--", body: "" },
                  { label: "XSS", ua: "", path: "/?q=<script>alert(1)</script>", body: "" },
                  { label: "LFI", ua: "", path: "/?file=../../../../etc/passwd", body: "" },
                  { label: "SSRF", ua: "", path: "/?url=http://169.254.169.254/", body: "" },
                  { label: "XXE", ua: "", path: "/api", body: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>` },
                ].map(preset => (
                  <button key={preset.label} onClick={() => { setAUA(preset.ua); setAPath(preset.path); setABody(preset.body); }}
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded border border-gray-700">
                    {preset.label}
                  </button>
                ))}
              </div>

              <Button onClick={analyze} disabled={analyzing} className="w-full bg-cyan-700 hover:bg-cyan-600">
                {analyzing ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Analyzing...</> : <><Eye className="h-4 w-4 mr-2" />Analyze Request</>}
              </Button>
            </div>
          </div>

          <div>
            {aResult ? (
              <div className="space-y-4">
                <div className={`border rounded-lg p-4 ${aResult.blocked ? "bg-red-950 border-red-700" : aResult.hits?.length > 0 ? "bg-yellow-950 border-yellow-700" : "bg-green-950 border-green-800"}`}>
                  <div className="flex items-center gap-3 mb-2">
                    {aResult.blocked ? <ShieldAlert className="h-6 w-6 text-red-400" /> :
                     aResult.hits?.length > 0 ? <AlertTriangle className="h-6 w-6 text-yellow-400" /> :
                     <CheckCircle className="h-6 w-6 text-green-400" />}
                    <div>
                      <div className={`text-lg font-bold ${aResult.blocked ? "text-red-400" : aResult.hits?.length > 0 ? "text-yellow-400" : "text-green-400"}`}>
                        {aResult.blocked ? "BLOCKED" : aResult.hits?.length > 0 ? "ALERT — DETECTED" : "CLEAN"}
                      </div>
                      <div className="text-sm text-gray-300">
                        Threat Level: <span className="font-medium uppercase">{aResult.threatLevel}</span> | Anomaly Score: <span className="font-mono text-white">{aResult.anomalyScore}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-400">{aResult.totalRulesChecked} rules checked</div>
                </div>

                {aResult.hits?.length > 0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Rules Triggered ({aResult.hits.length})</h4>
                    <div className="space-y-2">
                      {aResult.hits.map((hit: any, i: number) => (
                        <div key={i} className="bg-gray-800 rounded p-3 text-sm">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className={`text-xs ${SEV_COLOR[hit.severity] ?? SEV_COLOR.info}`}>{hit.severity}</Badge>
                            <Badge className={`text-xs border ${TYPE_COLOR[hit.attackType] ?? TYPE_COLOR.default}`}>{hit.attackType}</Badge>
                            <span className="text-white font-medium">{hit.name}</span>
                          </div>
                          <div className="text-xs text-gray-400">Matched on: <span className="text-cyan-300">{hit.matchedOn}</span></div>
                          <div className="text-xs text-gray-400">Payload: <span className="font-mono text-red-300 break-all">{hit.payload}</span></div>
                          <div className="text-xs text-gray-400">Action: <span className={hit.action === "block" ? "text-red-400" : "text-yellow-400"}>{hit.action}</span></div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center">
                <Shield className="h-12 w-12 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Configure a request and click Analyze to run it through all active WAF rules</p>
                <p className="text-gray-600 text-xs mt-2">Use the quick-test presets to instantly test common attack signatures</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Events Tab ───────────────────────────────────────────────────────── */}
      {tab === "events" && (
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <h3 className="text-sm font-semibold text-gray-300 flex-1">Attack Event Log ({events.length})</h3>
            <Button size="sm" variant="ghost" onClick={loadAll} className="text-gray-400"><RefreshCw className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={clearEvents} className="border-red-900 text-red-400 hover:bg-red-950">Clear Log</Button>
          </div>
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {events.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-12 text-center text-gray-400">
                No attack events logged yet — use the Request Analyzer to test payloads
              </div>
            ) : events.map(ev => (
              <div key={ev.id} className={`bg-gray-900 border rounded-lg p-3 text-sm ${ev.blocked ? "border-red-900" : "border-yellow-900"}`}>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {ev.blocked ? <Badge className="bg-red-700 text-white text-xs">BLOCKED</Badge> : <Badge className="bg-yellow-700 text-white text-xs">ALERTED</Badge>}
                  {ev.severity && <Badge className={`text-xs ${SEV_COLOR[ev.severity] ?? SEV_COLOR.info}`}>{ev.severity}</Badge>}
                  {ev.attackType && <Badge className={`text-xs border ${TYPE_COLOR[ev.attackType] ?? TYPE_COLOR.default}`}>{ev.attackType}</Badge>}
                  <span className="text-gray-300 font-medium">{ev.ruleName}</span>
                  <span className="text-gray-500 ml-auto text-xs">{new Date(ev.detectedAt).toLocaleString()}</span>
                </div>
                <div className="text-xs text-gray-400 flex flex-wrap gap-3">
                  <span>IP: <span className="text-white font-mono">{ev.sourceIp}</span></span>
                  <span>{ev.method} <span className="text-blue-300 font-mono">{ev.path}</span></span>
                  <span>Score: <span className="text-white">{ev.anomalyScore}</span></span>
                  {ev.payload && <span>Match: <span className="text-red-300 font-mono break-all">{ev.payload}</span></span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Export Tab ───────────────────────────────────────────────────────── */}
      {tab === "export" && (
        <div className="space-y-4">
          {!wafConfig ? (
            <div className="text-center py-12 text-gray-400"><RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2" />Loading config...</div>
          ) : (
            ["modsecConfig", "nginxConfig", "apacheConfig"].map(key => {
              const labels: Record<string, string> = { modsecConfig: "ModSecurity Rules", nginxConfig: "Nginx Config", apacheConfig: "Apache .htaccess" };
              return (
                <div key={key} className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-300">{labels[key]}</h3>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" className="border-gray-600 text-gray-300 text-xs"
                        onClick={() => copyText(wafConfig[key])}>
                        <Download className="h-3 w-3 mr-1" /> Copy
                      </Button>
                    </div>
                  </div>
                  <pre className="bg-black rounded p-3 text-xs text-green-400 overflow-x-auto max-h-[300px] whitespace-pre-wrap">
                    {wafConfig[key]}
                  </pre>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
