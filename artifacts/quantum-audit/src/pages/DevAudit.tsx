// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ShieldAlert, CheckCircle, AlertTriangle, Loader2, ExternalLink,
  Radio, Globe, FileCode, KeyRound, ChevronDown, ChevronUp,
  Info, Flame, ShieldCheck, Zap, Lock, Copy, Activity,
  ServerCrash, BarChart3, Eye, Swords, Target, Network,
  Package, ShieldX, Bug, Layers, Wifi, Search, Cpu, Coins,
  ArrowDownLeft, ArrowUpRight, CircleDot,
  Play, Square, RefreshCw, Database, Terminal, TrendingUp, Fingerprint,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Severity = "critical" | "high" | "medium" | "low" | "info" | "pass";

function sevColor(s: Severity) {
  if (s === "critical") return "bg-red-500/15 border-red-500/40 text-red-300";
  if (s === "high")     return "bg-orange-500/15 border-orange-500/40 text-orange-300";
  if (s === "medium")   return "bg-yellow-500/15 border-yellow-500/40 text-yellow-300";
  if (s === "low")      return "bg-blue-500/15 border-blue-500/40 text-blue-300";
  if (s === "pass")     return "bg-green-500/15 border-green-500/40 text-green-300";
  return "bg-muted/50 border-border text-muted-foreground";
}

function sevBadge(s: Severity) {
  const colors: Record<Severity, string> = {
    critical: "bg-red-500/20 text-red-300 border-red-500/30",
    high:     "bg-orange-500/20 text-orange-300 border-orange-500/30",
    medium:   "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    low:      "bg-blue-500/20 text-blue-300 border-blue-500/30",
    info:     "bg-muted/50 text-muted-foreground border-border",
    pass:     "bg-green-500/20 text-green-300 border-green-500/30",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${colors[s]}`}>
      {s.toUpperCase()}
    </span>
  );
}

function RiskBar({ score }: { score: number }) {
  const color = score >= 70 ? "bg-red-500" : score >= 40 ? "bg-orange-500" : score >= 20 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-bold w-10 text-right">{score}/100</span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const { toast } = useToast();
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); toast({ title: "Copied" }); }}
      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
      <Copy className="w-3.5 h-3.5" />
    </button>
  );
}

// ── RPC Probe Tab ─────────────────────────────────────────────────────────────
interface RpcMethodResult {
  method: string; category: string; exposed: boolean; requiresAuth: boolean;
  responseTime: number; result?: unknown; rawError?: string; risk: string; impact: string;
}
interface RpcProbeResult {
  endpoint: string; reachable: boolean; serverBanner?: string; tlsEnabled: boolean;
  corsOrigin?: string; corsAllowAll: boolean;
  rateLimit?: { detected: boolean; header?: string; limit?: string };
  methods: RpcMethodResult[]; criticalExposures: string[];
  totalExposed: number; riskScore: number; probeTimeMs: number;
}

function RpcProbeTab() {
  const [endpoint, setEndpoint] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const mutation = useMutation<RpcProbeResult, Error, string>({
    mutationFn: async (ep) => {
      const resp = await fetch(`${BASE}/api/dev-audit/rpc-probe`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: ep }),
      });
      if (!resp.ok) throw new Error((await resp.json() as { error: string }).error);
      return resp.json();
    },
  });
  const r = mutation.data;
  const catOrder = ["dangerous", "internal", "info-leak", "operational"];
  const sortedMethods = r ? [...r.methods].sort((a, b) => {
    const oa = catOrder.indexOf(a.category), ob = catOrder.indexOf(b.category);
    if (a.exposed !== b.exposed) return a.exposed ? -1 : 1;
    return oa - ob;
  }) : [];

  return (
    <div className="space-y-6">
      <Alert className="border-yellow-500/30 bg-yellow-500/5">
        <Radio className="w-4 h-4 text-yellow-400" />
        <AlertDescription className="text-xs">
          This makes <strong>real JSON-RPC calls</strong> from our server to your endpoint — exactly what an attacker does when they discover your node. Only external/public URLs are accepted.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Radio className="w-5 h-5 text-cyan-400" />External RPC Endpoint Probe</CardTitle>
          <CardDescription>
            Enter your wallet node's JSON-RPC URL. We call every dangerous method an attacker would try —
            eth_accounts, personal_listAccounts, txpool_content, debug namespace, admin namespace — and report exactly what responds.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={endpoint} onChange={e => setEndpoint(e.target.value)}
              placeholder="https://your-node.example.com:8545" className="font-mono flex-1" />
            <Button onClick={() => mutation.mutate(endpoint)} disabled={!endpoint.trim() || mutation.isPending}>
              {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Probing…</> : "Run Probe"}
            </Button>
          </div>
          {mutation.error && (
            <Alert className="border-red-500/40 bg-red-500/5">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <AlertDescription className="text-sm text-red-300">{mutation.error.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {r && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Reachable",     value: r.reachable ? "Yes" : "No",         color: r.reachable ? "text-green-400" : "text-red-400" },
              { label: "TLS",           value: r.tlsEnabled ? "HTTPS ✓" : "HTTP ✗", color: r.tlsEnabled ? "text-green-400" : "text-red-400" },
              { label: "Methods Exposed", value: r.totalExposed,                   color: r.totalExposed > 0 ? "text-red-400" : "text-green-400" },
              { label: "Risk Score",    value: `${r.riskScore}/100`,               color: r.riskScore >= 60 ? "text-red-400" : r.riskScore >= 30 ? "text-yellow-400" : "text-green-400" },
            ].map(({ label, value, color }) => (
              <Card key={label}><CardContent className="pt-4 pb-3">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </CardContent></Card>
            ))}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Exposure Risk</p>
            <RiskBar score={r.riskScore} />
          </div>

          {r.serverBanner && (
            <div className="flex items-center gap-2 text-xs text-orange-300 bg-orange-500/8 border border-orange-500/20 rounded p-2.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span><strong>Server version disclosed:</strong> {r.serverBanner} — attackers use version banners to target known CVEs</span>
            </div>
          )}

          {r.corsAllowAll && (
            <Alert className="border-red-500/50 bg-red-500/8">
              <Flame className="w-4 h-4 text-red-400" />
              <AlertDescription className="text-xs text-red-300">
                <strong>CORS wildcard (*) enabled</strong> — any website can make cross-origin RPC calls to this endpoint.
                A malicious page visited by one of your users can silently call your node on their behalf.
              </AlertDescription>
            </Alert>
          )}

          {r.criticalExposures.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-red-400">Critical Exposures</p>
              {r.criticalExposures.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-red-300 bg-red-500/8 border border-red-500/20 rounded p-2.5">
                  <ServerCrash className="w-3.5 h-3.5 shrink-0 mt-0.5" />{e}
                </div>
              ))}
            </div>
          )}

          {/* Method results */}
          <div className="space-y-2">
            <p className="text-sm font-semibold">Method Probe Results ({r.methods.length} tested)</p>
            {sortedMethods.map(m => {
              const key = m.method;
              const isExp = expanded[key];
              return (
                <div key={key} className={`rounded border p-3 space-y-2 ${m.exposed
                  ? m.category === "dangerous" || m.category === "internal"
                    ? "border-red-500/40 bg-red-500/5"
                    : "border-orange-500/30 bg-orange-500/5"
                  : "border-border/40 bg-card/40"}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-mono font-semibold ${m.exposed ? "text-foreground" : "text-muted-foreground"}`}>{m.method}</span>
                      {m.exposed
                        ? <span className="px-1.5 py-0.5 rounded text-xs bg-red-500/20 text-red-300 border border-red-500/30 font-semibold">EXPOSED</span>
                        : <span className="px-1.5 py-0.5 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/20">blocked</span>}
                      <span className="px-1.5 py-0.5 rounded text-xs border border-border/50 text-muted-foreground capitalize">{m.category}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{m.responseTime}ms</span>
                      <button onClick={() => setExpanded(p => ({ ...p, [key]: !p[key] }))}
                        className="flex items-center gap-1 hover:text-foreground transition-colors">
                        {isExp ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        detail
                      </button>
                    </div>
                  </div>
                  {(isExp || m.exposed) && (
                    <div className="space-y-1.5 text-xs">
                      <p className="text-muted-foreground leading-relaxed"><span className="font-semibold text-foreground">Risk: </span>{m.risk}</p>
                      {m.exposed && <p className="text-orange-300 leading-relaxed"><span className="font-semibold">Impact: </span>{m.impact}</p>}
                      {m.exposed && m.result !== undefined && (
                        <div className="p-2 rounded bg-muted/50 font-mono text-xs text-red-300 flex items-start gap-2">
                          <Eye className="w-3 h-3 mt-0.5 shrink-0" />
                          <span className="break-all">{JSON.stringify(m.result).slice(0, 300)}</span>
                          <CopyButton text={JSON.stringify(m.result)} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── HTTP Headers Tab ──────────────────────────────────────────────────────────
interface HeaderResult {
  header: string; present: boolean; value?: string; severity: Severity;
  title: string; description: string; attackEnabled: string; recommendation: string; score: number;
}
interface HeadersScanResult {
  url: string; finalUrl: string; statusCode: number; tlsEnabled: boolean;
  serverBanner?: string; poweredBy?: string; responseTimeMs: number;
  grade: string; score: number; headers: HeaderResult[];
  corsAnalysis?: { allowOrigin?: string; allowCredentials?: string; allowMethods?: string; wildcardWithCredentials: boolean; risk: string };
  cookieAnalysis: Array<{ name: string; secure: boolean; httpOnly: boolean; sameSite?: string; risk: string }>;
  criticalMissing: string[];
}

function HeadersTab() {
  const [url, setUrl] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const mutation = useMutation<HeadersScanResult, Error, string>({
    mutationFn: async (u) => {
      const resp = await fetch(`${BASE}/api/dev-audit/headers-check`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: u }),
      });
      if (!resp.ok) throw new Error((await resp.json() as { error: string }).error);
      return resp.json();
    },
  });
  const r = mutation.data;
  const gradeColor = (g: string) => {
    if (g === "A+" || g === "A") return "text-green-400";
    if (g === "B") return "text-yellow-400";
    if (g === "C") return "text-orange-400";
    return "text-red-400";
  };

  return (
    <div className="space-y-6">
      <Alert className="border-blue-500/30 bg-blue-500/5">
        <Globe className="w-4 h-4 text-blue-400" />
        <AlertDescription className="text-xs">
          We make a <strong>real HTTP request from our server</strong> to your dApp URL and analyze every security header in the actual response — the same check every automated attacker runs before targeting a web app.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Globe className="w-5 h-5 text-blue-400" />HTTP Security Header Scanner</CardTitle>
          <CardDescription>
            Enter your wallet dApp's public URL. We check Content-Security-Policy, HSTS, X-Frame-Options, CORS,
            cookie flags, server version disclosure, and 10 other critical headers — all from real server responses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input value={url} onChange={e => setUrl(e.target.value)}
              placeholder="https://your-wallet-app.com" className="flex-1" />
            <Button onClick={() => mutation.mutate(url)} disabled={!url.trim() || mutation.isPending}>
              {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning…</> : "Scan Headers"}
            </Button>
          </div>
          {mutation.error && (
            <Alert className="border-red-500/40 bg-red-500/5">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <AlertDescription className="text-sm text-red-300">{mutation.error.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {r && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="pt-4 pb-3">
              <p className={`text-3xl font-bold font-mono ${gradeColor(r.grade)}`}>{r.grade}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Security Grade</p>
            </CardContent></Card>
            {[
              { label: "Score",       value: `${r.score}/100`, color: r.score >= 70 ? "text-green-400" : r.score >= 50 ? "text-yellow-400" : "text-red-400" },
              { label: "TLS",         value: r.tlsEnabled ? "HTTPS ✓" : "HTTP ✗", color: r.tlsEnabled ? "text-green-400" : "text-red-400" },
              { label: "Status Code", value: r.statusCode, color: r.statusCode < 400 ? "text-green-400" : "text-red-400" },
            ].map(({ label, value, color }) => (
              <Card key={label}><CardContent className="pt-4 pb-3">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </CardContent></Card>
            ))}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Security Score</p>
            <RiskBar score={100 - r.score} />
          </div>

          {(r.serverBanner || r.poweredBy) && (
            <Alert className="border-orange-500/30 bg-orange-500/5">
              <AlertTriangle className="w-4 h-4 text-orange-400" />
              <AlertDescription className="text-xs text-orange-300">
                <strong>Technology disclosure:</strong>{" "}
                {[r.serverBanner && `Server: ${r.serverBanner}`, r.poweredBy && `X-Powered-By: ${r.poweredBy}`].filter(Boolean).join(" · ")}
                {" — "}attackers use this to target known vulnerabilities in your exact stack version.
              </AlertDescription>
            </Alert>
          )}

          {r.criticalMissing.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-red-400">Critical Issues</p>
              {r.criticalMissing.map((m, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-red-300 bg-red-500/8 border border-red-500/20 rounded p-2.5">
                  <Flame className="w-3.5 h-3.5 shrink-0 mt-0.5" />{m}
                </div>
              ))}
            </div>
          )}

          {r.corsAnalysis && (
            <div className={`rounded border p-3 text-xs space-y-1 ${r.corsAnalysis.wildcardWithCredentials ? "border-red-500/40 bg-red-500/5" : "border-border/40"}`}>
              <p className="font-semibold">CORS Configuration</p>
              <p><span className="text-muted-foreground">Access-Control-Allow-Origin:</span> {r.corsAnalysis.allowOrigin ?? "not set"}</p>
              {r.corsAnalysis.allowCredentials && <p><span className="text-muted-foreground">Allow-Credentials:</span> {r.corsAnalysis.allowCredentials}</p>}
              <p className={r.corsAnalysis.wildcardWithCredentials ? "text-red-300 font-semibold" : "text-muted-foreground"}>{r.corsAnalysis.risk}</p>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm font-semibold">Header Analysis ({r.headers.length} checked)</p>
            {r.headers.map(h => {
              const isExp = expanded[h.header];
              return (
                <div key={h.header} className={`rounded border p-3 space-y-2 ${h.present && h.severity === "pass" ? "border-green-500/20 bg-green-500/5" : !h.present ? sevColor(h.severity) : "border-yellow-500/30 bg-yellow-500/5"}`}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      {h.present && h.severity === "pass"
                        ? <CheckCircle className="w-3.5 h-3.5 text-green-400 shrink-0" />
                        : !h.present ? <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                        : <Info className="w-3.5 h-3.5 text-yellow-400 shrink-0" />}
                      <span className="text-xs font-mono font-semibold">{h.header}</span>
                      {sevBadge(h.severity)}
                    </div>
                    <button onClick={() => setExpanded(p => ({ ...p, [h.header]: !p[h.header] }))}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                      {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} detail
                    </button>
                  </div>
                  {h.value && <p className="font-mono text-xs text-muted-foreground break-all">{h.value}</p>}
                  {(isExp || !h.present) && (
                    <div className="space-y-1.5 text-xs">
                      <p className="text-muted-foreground"><span className="font-semibold text-foreground">{h.title}: </span>{h.description}</p>
                      {!h.present && <p className="text-red-300 leading-relaxed"><span className="font-semibold">Attack enabled: </span>{h.attackEnabled}</p>}
                      {!h.present && <p className="text-blue-300 font-mono break-all"><span className="font-sans font-semibold">Fix: </span>{h.recommendation}</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {r.cookieAnalysis.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Cookie Security</p>
              {r.cookieAnalysis.map(c => (
                <div key={c.name} className={`rounded border p-3 text-xs space-y-1 ${!c.secure || !c.httpOnly ? "border-orange-500/30 bg-orange-500/5" : "border-green-500/20 bg-green-500/5"}`}>
                  <div className="flex items-center gap-2 font-mono font-semibold">{c.name}
                    {[
                      c.secure ? <span key="s" className="text-green-400 font-sans text-xs">Secure</span> : <span key="s" className="text-red-400 font-sans text-xs">No Secure</span>,
                      c.httpOnly ? <span key="h" className="text-green-400 font-sans text-xs">HttpOnly</span> : <span key="h" className="text-red-400 font-sans text-xs">No HttpOnly</span>,
                      c.sameSite ? <span key="ss" className="text-muted-foreground font-sans text-xs">SameSite={c.sameSite}</span> : <span key="ss" className="text-yellow-400 font-sans text-xs">No SameSite</span>,
                    ]}
                  </div>
                  {c.risk !== "No issues detected" && <p className="text-orange-300">{c.risk}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Live Contract Test Tab ────────────────────────────────────────────────────
interface ContractFinding {
  id: string; severity: Severity; title: string; detail: string;
  attackVector: string; remediation: string; evidence?: string;
}
interface LiveContractResult {
  address: string; chain: string; contractName?: string; isContract: boolean; bytecodeSize: number;
  isProxy: boolean; implementationAddress?: string; isVerified: boolean;
  isERC20: boolean; isERC721: boolean; hasPermit: boolean; hasSetApprovalForAll: boolean;
  hasTransferOwnership: boolean; hasInitialize: boolean; hasUpgradeTo: boolean; hasSelfDestruct: boolean;
  ownerAddress?: string; tokenName?: string; tokenSymbol?: string; totalSupply?: string;
  recentApprovalCount: number; recentPermitCount: number;
  findings: ContractFinding[]; riskScore: number; scanTimeMs: number;
}

function ContractTestTab() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const mutation = useMutation<LiveContractResult, Error, { address: string; chain: string }>({
    mutationFn: async ({ address, chain }) => {
      const resp = await fetch(`${BASE}/api/dev-audit/contract-test`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chain }),
      });
      if (!resp.ok) throw new Error((await resp.json() as { error: string }).error);
      return resp.json();
    },
  });
  const r = mutation.data;

  return (
    <div className="space-y-6">
      <Alert className="border-purple-500/30 bg-purple-500/5">
        <Zap className="w-4 h-4 text-purple-400" />
        <AlertDescription className="text-xs">
          We make <strong>real on-chain calls</strong> (eth_call, eth_getCode, eth_getLogs) against your deployed contract.
          We scan actual bytecode, probe function selectors, read real on-chain state, and retrieve real event history.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Zap className="w-5 h-5 text-purple-400" />Live On-Chain Contract Audit</CardTitle>
          <CardDescription>
            Enter a deployed contract address. We read its real bytecode to detect dangerous function selectors,
            probe proxy/upgrade patterns, read actual owner state, and pull real approval event history from the chain.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <Input value={address} onChange={e => setAddress(e.target.value)}
              placeholder="0x… contract address" className="font-mono flex-1 min-w-0" />
            <Select value={chain} onValueChange={setChain}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["ethereum","polygon","bsc","arbitrum","optimism"].map(c => (
                  <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => mutation.mutate({ address, chain })}
              disabled={!address.trim() || mutation.isPending}>
              {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning chain…</> : "Audit Contract"}
            </Button>
          </div>
          {mutation.error && (
            <Alert className="border-red-500/40 bg-red-500/5">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <AlertDescription className="text-sm text-red-300">{mutation.error.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {r && (
        <div className="space-y-4">
          {!r.isContract ? (
            <Alert className="border-blue-500/30 bg-blue-500/5">
              <Info className="w-4 h-4 text-blue-400" />
              <AlertDescription>This address is an EOA (wallet), not a smart contract.</AlertDescription>
            </Alert>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Contract",    value: r.contractName ?? "Unverified", color: r.isVerified ? "text-green-400" : "text-orange-400" },
                  { label: "Bytecode",    value: `${r.bytecodeSize.toLocaleString()} bytes`, color: "text-foreground" },
                  { label: "Verified",    value: r.isVerified ? "Yes" : "No", color: r.isVerified ? "text-green-400" : "text-red-400" },
                  { label: "Risk Score",  value: `${r.riskScore}/100`, color: r.riskScore >= 60 ? "text-red-400" : r.riskScore >= 30 ? "text-yellow-400" : "text-green-400" },
                ].map(({ label, value, color }) => (
                  <Card key={label}><CardContent className="pt-4 pb-3">
                    <p className={`text-base font-bold truncate ${color}`}>{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </CardContent></Card>
                ))}
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Contract Risk Score</p>
                <RiskBar score={r.riskScore} />
              </div>

              {/* Capability flags */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { label: "ERC-20",            active: r.isERC20,              neutral: true },
                  { label: "ERC-721",           active: r.isERC721,             neutral: true },
                  { label: "permit() (EIP-2612)",active: r.hasPermit,           neutral: false },
                  { label: "setApprovalForAll", active: r.hasSetApprovalForAll, neutral: false },
                  { label: "Proxy/Upgradeable", active: r.isProxy,              neutral: false },
                  { label: "initialize()",      active: r.hasInitialize,        neutral: false },
                  { label: "upgradeTo()",       active: r.hasUpgradeTo,         neutral: false },
                  { label: "selfdestruct",      active: r.hasSelfDestruct,      neutral: false },
                ].map(({ label, active, neutral }) => (
                  <div key={label} className={`flex items-center gap-1.5 text-xs p-2 rounded border ${
                    active
                      ? neutral ? "border-blue-500/30 bg-blue-500/8 text-blue-300" : "border-orange-500/30 bg-orange-500/8 text-orange-300"
                      : "border-border/30 text-muted-foreground"
                  }`}>
                    {active
                      ? neutral ? <CheckCircle className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />
                      : <span className="w-3 h-3 inline-block" />}
                    {label}
                  </div>
                ))}
              </div>

              {r.ownerAddress && (
                <div className="flex items-center gap-2 text-xs bg-muted/40 border border-border/50 rounded p-2.5">
                  <Lock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                  <span className="text-muted-foreground">Owner:</span>
                  <span className="font-mono text-foreground">{r.ownerAddress}</span>
                  <CopyButton text={r.ownerAddress} />
                </div>
              )}

              {r.implementationAddress && (
                <div className="flex items-center gap-2 text-xs bg-purple-500/8 border border-purple-500/20 rounded p-2.5">
                  <Activity className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                  <span className="text-muted-foreground">Implementation:</span>
                  <span className="font-mono text-foreground">{r.implementationAddress}</span>
                  <CopyButton text={r.implementationAddress} />
                </div>
              )}

              {(r.recentApprovalCount > 0 || r.recentPermitCount > 0) && (
                <div className={`rounded border p-3 text-xs space-y-1 ${r.recentPermitCount > 0 ? "border-red-500/40 bg-red-500/5" : "border-orange-500/30 bg-orange-500/5"}`}>
                  <p className="font-semibold">Live On-Chain Activity (last 5,000 blocks)</p>
                  <p><span className="text-muted-foreground">Total approval events:</span> <span className="font-bold text-orange-300">{r.recentApprovalCount}</span></p>
                  {r.recentPermitCount > 0 && (
                    <p><span className="text-muted-foreground">Unlimited-amount approvals (permit/drain pattern):</span> <span className="font-bold text-red-300">{r.recentPermitCount}</span></p>
                  )}
                </div>
              )}

              {/* Findings */}
              {r.findings.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Security Findings ({r.findings.length})</p>
                  {r.findings.map(f => {
                    const isExp = expanded[f.id];
                    return (
                      <div key={f.id} className={`rounded border p-3.5 space-y-2 ${sevColor(f.severity)}`}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {sevBadge(f.severity)}
                            <span className="text-sm font-semibold">{f.title}</span>
                          </div>
                          <button onClick={() => setExpanded(p => ({ ...p, [f.id]: !p[f.id] }))}
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0">
                            {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>
                        </div>
                        <p className="text-xs leading-relaxed">{f.detail}</p>
                        {(isExp || f.severity === "critical") && (
                          <div className="space-y-1.5 text-xs pt-1">
                            <p className="text-orange-300 leading-relaxed"><span className="font-semibold">Attack vector: </span>{f.attackVector}</p>
                            <p className="text-blue-300 leading-relaxed"><span className="font-semibold">Remediation: </span>{f.remediation}</p>
                            {f.evidence && <p className="text-muted-foreground font-mono"><span className="font-sans">Evidence: </span>{f.evidence}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Key Entropy Audit Tab ─────────────────────────────────────────────────────
interface EntropyFinding {
  id: string; severity: string; title: string; detail: string;
  attackVector: string; remediation: string; evidence?: string;
}
interface KeyEntropyResult {
  addressCount: number; validAddresses: string[]; invalidAddresses: string[];
  findings: EntropyFinding[];
  stats: {
    chiSquaredStatistic: number; chiSquaredPValue: string; bitBias: number;
    avgHammingDistance: number; minHammingDistance: number;
    leadingZeroAddresses: number; sequentialAddresses: number;
    duplicateAddresses: number; nullByteHeavyAddresses: number;
    profanityPattern: boolean; knownWeakPatterns: string[];
  };
  riskScore: number;
}

function KeyEntropyTab() {
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const mutation = useMutation<KeyEntropyResult, Error, string>({
    mutationFn: async (raw) => {
      const addresses = raw.split(/[\n,\s]+/).filter(a => a.trim().length > 0);
      const resp = await fetch(`${BASE}/api/dev-audit/key-entropy`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses }),
      });
      if (!resp.ok) throw new Error((await resp.json() as { error: string }).error);
      return resp.json();
    },
  });
  const r = mutation.data;

  return (
    <div className="space-y-6">
      <Alert className="border-green-500/30 bg-green-500/5">
        <BarChart3 className="w-4 h-4 text-green-400" />
        <AlertDescription className="text-xs">
          Paste <strong>real addresses generated by your wallet system</strong>. We run chi-squared uniformity tests,
          bit-level bias analysis, Hamming distance checks, sequential address detection, and Profanity-pattern matching
          on your actual output — the same statistical analysis researchers use to find Profanity-style vulnerabilities.
          <strong> No private keys — addresses only.</strong>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="w-5 h-5 text-green-400" />Wallet Key Generation Entropy Audit</CardTitle>
          <CardDescription>
            Paste the Ethereum addresses your wallet system generated (one per line, or comma/space separated).
            Minimum 3 for analysis, 20+ recommended for reliable statistical results.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={input} onChange={e => setInput(e.target.value)}
            placeholder={"0xAbC123...\n0xDeF456...\n0x789..."}
            rows={8} className="font-mono text-xs resize-none" />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">
              {input.split(/[\n,\s]+/).filter(a => a.trim().length > 0).length} addresses detected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setInput(""); mutation.reset(); }}>Clear</Button>
              <Button onClick={() => mutation.mutate(input)} disabled={!input.trim() || mutation.isPending}>
                {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing…</> : "Audit Entropy"}
              </Button>
            </div>
          </div>
          {mutation.error && (
            <Alert className="border-red-500/40 bg-red-500/5">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <AlertDescription className="text-sm text-red-300">{mutation.error.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {r && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Addresses",    value: r.validAddresses.length, color: "text-foreground" },
              { label: "Risk Score",   value: `${r.riskScore}/100`, color: r.riskScore >= 50 ? "text-red-400" : r.riskScore >= 25 ? "text-yellow-400" : "text-green-400" },
              { label: "Duplicates",   value: r.stats.duplicateAddresses, color: r.stats.duplicateAddresses > 0 ? "text-red-400" : "text-green-400" },
              { label: "Chi-Squared p", value: r.stats.chiSquaredPValue, color: r.stats.chiSquaredPValue.includes("<0.00") ? "text-red-400" : r.stats.chiSquaredPValue.includes("<0.01") ? "text-yellow-400" : "text-green-400" },
            ].map(({ label, value, color }) => (
              <Card key={label}><CardContent className="pt-4 pb-3">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </CardContent></Card>
            ))}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Entropy Risk Score</p>
            <RiskBar score={r.riskScore} />
          </div>

          {/* Stats */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Statistical Analysis Results</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
              {[
                { label: "Bit Bias",            value: `${(r.stats.bitBias * 100).toFixed(3)}%`,       warn: r.stats.bitBias > 0.05 },
                { label: "Avg Hamming Dist",    value: `${r.stats.avgHammingDistance.toFixed(1)} bits`, warn: r.stats.avgHammingDistance < 60 },
                { label: "Min Hamming Dist",    value: `${r.stats.minHammingDistance} bits`,            warn: r.stats.minHammingDistance < 20 },
                { label: "Chi² Statistic",      value: r.stats.chiSquaredStatistic.toFixed(2),         warn: r.stats.chiSquaredStatistic > 274 },
                { label: "Leading-Zero Addrs",  value: r.stats.leadingZeroAddresses,                   warn: r.stats.leadingZeroAddresses > r.validAddresses.length * 0.05 },
                { label: "Profanity Pattern",   value: r.stats.profanityPattern ? "DETECTED" : "Clean", warn: r.stats.profanityPattern },
              ].map(({ label, value, warn }) => (
                <div key={label} className={`p-2.5 rounded border ${warn ? "border-orange-500/30 bg-orange-500/8" : "border-border/30 bg-card/30"}`}>
                  <p className={`font-bold ${warn ? "text-orange-300" : "text-foreground"}`}>{value}</p>
                  <p className="text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {r.stats.knownWeakPatterns.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-red-400">Weak Patterns Detected</p>
              {r.stats.knownWeakPatterns.map((p, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-red-300 bg-red-500/8 border border-red-500/20 rounded p-2.5">
                  <Flame className="w-3.5 h-3.5 shrink-0" />{p}
                </div>
              ))}
            </div>
          )}

          {/* Findings */}
          {r.findings.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Findings ({r.findings.length})</p>
              {r.findings.map(f => {
                const sev = f.severity as Severity;
                const isExp = expanded[f.id];
                return (
                  <div key={f.id} className={`rounded border p-3.5 space-y-2 ${sevColor(sev)}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {sevBadge(sev)}
                        <span className="text-sm font-semibold">{f.title}</span>
                      </div>
                      <button onClick={() => setExpanded(p => ({ ...p, [f.id]: !p[f.id] }))}
                        className="text-xs text-muted-foreground hover:text-foreground">
                        {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed">{f.detail}</p>
                    {(isExp || sev === "critical") && (
                      <div className="space-y-1.5 text-xs pt-1">
                        <p className="text-orange-300 leading-relaxed"><span className="font-semibold">Attack vector: </span>{f.attackVector}</p>
                        <p className="text-blue-300 leading-relaxed"><span className="font-semibold">Remediation: </span>{f.remediation}</p>
                        {f.evidence && <p className="text-muted-foreground"><span className="font-semibold">Evidence: </span>{f.evidence}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Source Analysis Tab ───────────────────────────────────────────────────────
interface SrcFinding {
  id: string; severity: Severity; title: string; description: string;
  attackVector: string; line?: number; snippet?: string; remediation: string; cwe?: string; swc?: string;
}
interface SrcResult {
  findingCount: number; critical: number; high: number; medium: number; low: number; info: number;
  riskScore: number; findings: SrcFinding[]; linesScanned: number; detectedPatterns: string[];
}

function SourceAnalysisTab() {
  const [src, setSrc] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const mutation = useMutation<SrcResult, Error, string>({
    mutationFn: async (source) => {
      const resp = await fetch(`${BASE}/api/dev-audit/contract-source`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source }),
      });
      if (!resp.ok) throw new Error((await resp.json() as { error: string }).error);
      return resp.json();
    },
  });
  const r = mutation.data;

  return (
    <div className="space-y-6">
      <Alert className="border-orange-500/30 bg-orange-500/5">
        <FileCode className="w-4 h-4 text-orange-400" />
        <AlertDescription className="text-xs">
          Paste your Solidity source code. We scan for the 14 most-exploited vulnerability classes: reentrancy,
          signature replay, tx.origin auth, ecrecover without zero-check, weak randomness, selfdestruct, unprotected
          delegatecall, permit misconfigs, unchecked arithmetic, access control gaps, and more.
          <strong> Source code is not stored.</strong>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><FileCode className="w-5 h-5 text-orange-400" />Solidity Source Code Vulnerability Scanner</CardTitle>
          <CardDescription>
            Paste your smart contract source code below. The scanner identifies the same vulnerability patterns
            that security auditors and automated exploit bots look for before attacking a contract.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea value={src} onChange={e => setSrc(e.target.value)}
            placeholder={"// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract YourContract {\n    ...\n}"}
            rows={12} className="font-mono text-xs resize-y" />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs text-muted-foreground">{src.split("\n").length} lines</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => { setSrc(""); mutation.reset(); }}>Clear</Button>
              <Button onClick={() => mutation.mutate(src)} disabled={!src.trim() || mutation.isPending}>
                {mutation.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning…</> : "Scan Source"}
              </Button>
            </div>
          </div>
          {mutation.error && (
            <Alert className="border-red-500/40 bg-red-500/5">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <AlertDescription className="text-sm text-red-300">{mutation.error.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {r && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {[
              { label: "Critical", value: r.critical, color: "text-red-400" },
              { label: "High",     value: r.high,     color: "text-orange-400" },
              { label: "Medium",   value: r.medium,   color: "text-yellow-400" },
              { label: "Low",      value: r.low,      color: "text-blue-400" },
              { label: "Info",     value: r.info,     color: "text-muted-foreground" },
              { label: "Lines",    value: r.linesScanned, color: "text-foreground" },
            ].map(({ label, value, color }) => (
              <Card key={label}><CardContent className="pt-3 pb-2.5">
                <p className={`text-lg font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </CardContent></Card>
            ))}
          </div>

          <div>
            <p className="text-xs text-muted-foreground mb-1">Source Risk Score</p>
            <RiskBar score={r.riskScore} />
          </div>

          {r.findingCount === 0 ? (
            <Alert className="border-green-500/40 bg-green-500/5">
              <ShieldCheck className="w-4 h-4 text-green-400" />
              <AlertDescription>No vulnerability patterns detected in {r.linesScanned} lines scanned.</AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-semibold">Findings ({r.findingCount})</p>
              {r.findings.map((f, idx) => {
                const key = f.id + idx;
                const isExp = expanded[key];
                return (
                  <div key={key} className={`rounded border p-3.5 space-y-2 ${sevColor(f.severity)}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {sevBadge(f.severity)}
                        <span className="text-sm font-semibold">{f.title}</span>
                        {f.line && <span className="text-xs text-muted-foreground font-mono">Line {f.line}</span>}
                        {f.swc && <span className="text-xs text-muted-foreground">SWC-{f.swc.replace("SWC-","")}</span>}
                      </div>
                      <button onClick={() => setExpanded(p => ({ ...p, [key]: !p[key] }))}
                        className="text-xs text-muted-foreground hover:text-foreground shrink-0">
                        {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                    </div>
                    <p className="text-xs leading-relaxed">{f.description}</p>
                    {f.snippet && (
                      <div className="font-mono text-xs bg-black/30 rounded p-2 border border-border/30 overflow-x-auto whitespace-pre">
                        {f.snippet}
                      </div>
                    )}
                    {(isExp || f.severity === "critical") && (
                      <div className="space-y-1.5 text-xs pt-1">
                        <p className="text-orange-300 leading-relaxed"><span className="font-semibold">Attack vector: </span>{f.attackVector}</p>
                        <p className="text-blue-300 leading-relaxed"><span className="font-semibold">Remediation: </span>{f.remediation}</p>
                        {f.cwe && <p className="text-muted-foreground"><span className="font-semibold">CWE: </span>{f.cwe}</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pentest Suite Tab ──────────────────────────────────────────────────────────
interface PentestFinding {
  id: string; category: string; title: string; severity: Severity;
  description: string; evidence?: string; attackVector: string;
  remediation: string; cwe?: string;
}
interface ClickFixResult {
  url: string; scanTimeMs: number; reachable: boolean; htmlSize: number;
  findings: PentestFinding[]; riskScore: number;
  detectedPatterns: Array<{ pattern: string; context: string }>;
}
interface C2Event {
  txHash: string; blockNumber: number; rawData: string; decoded: string;
  pattern: string; severity: Severity;
}
interface BlockchainC2Result {
  contractAddress: string; chain: string; scanTimeMs: number;
  totalEventsScanned: number; suspiciousEvents: C2Event[];
  findings: PentestFinding[]; riskScore: number;
}
interface SsrfProbe {
  paramName: string; injectedUrl: string; statusCode?: number;
  responseSnippet: string; vulnerable: boolean; indicator: string;
}
interface SsrfResult {
  targetApi: string; scanTimeMs: number;
  findings: PentestFinding[]; probes: SsrfProbe[]; riskScore: number;
}
interface AuthTest {
  technique: string; path: string; method: string;
  statusCode?: number; expectedStatus: number; bypassed: boolean; detail: string;
}
interface AuthBypassResult {
  targetBase: string; scanTimeMs: number;
  findings: PentestFinding[]; tests: AuthTest[]; riskScore: number;
}
interface DiscoveredPath {
  path: string; status: number; size: number; note: string; severity: Severity;
}
interface EndpointDiscoveryResult {
  targetBase: string; scanTimeMs: number;
  discovered: DiscoveredPath[]; findings: PentestFinding[]; riskScore: number;
}
interface DnsCheck {
  check: string; result: string; vulnerable: boolean; detail: string;
}
interface DnsRebindingResult {
  targetUrl: string; scanTimeMs: number;
  findings: PentestFinding[]; checks: DnsCheck[]; riskScore: number;
}

function FindingsList({ findings }: { findings: PentestFinding[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  if (!findings.length) return null;
  return (
    <div className="space-y-2">
      {findings.map(f => {
        const cls = sevColor(f.severity);
        const isExp = expanded[f.id];
        return (
          <div key={f.id} className={`border rounded-lg p-3 space-y-1.5 ${cls}`}>
            <div className="flex items-start gap-2 justify-between">
              <div className="flex items-center gap-2 flex-wrap">
                {sevBadge(f.severity)}
                <span className="text-xs font-semibold">{f.title}</span>
                {f.cwe && <span className="text-xs opacity-60">{f.cwe}</span>}
              </div>
              <button onClick={() => setExpanded(p => ({ ...p, [f.id]: !p[f.id] }))}
                className="shrink-0 opacity-60 hover:opacity-100">
                {isExp ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>
            <p className="text-xs leading-relaxed">{f.description}</p>
            {f.evidence && (
              <pre className="text-xs font-mono bg-black/30 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">{f.evidence}</pre>
            )}
            {isExp && (
              <div className="space-y-1 text-xs pt-1 border-t border-white/10 mt-1">
                <p className="text-orange-300"><span className="font-semibold">Attack vector: </span>{f.attackVector}</p>
                <p className="text-blue-300"><span className="font-semibold">Remediation: </span>{f.remediation}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const PENTEST_TOOLS = [
  { id: "clickfix",   icon: ShieldX,    color: "text-red-400",    label: "ClickFix Scanner",     desc: "Detect UI deception & clipboard injection in your dApp" },
  { id: "c2",         icon: Wifi,       color: "text-purple-400", label: "Blockchain C2",        desc: "Find Command & Control patterns in contract event logs" },
  { id: "ssrf",       icon: ServerCrash,color: "text-orange-400", label: "SSRF Probe",           desc: "Test for Server-Side Request Forgery in your API" },
  { id: "authbypass", icon: Lock,       color: "text-yellow-400", label: "Auth Bypass",          desc: "JWT none, header spoofing, IDOR, admin path exposure" },
  { id: "discovery",  icon: Eye,        color: "text-blue-400",   label: "Endpoint Discovery",   desc: "Bruteforce 60+ sensitive paths (.env, /admin, /actuator)" },
  { id: "dnsrebind",  icon: Network,    color: "text-cyan-400",   label: "DNS Rebinding",        desc: "CORS + Host header rebinding vulnerability" },
] as const;
type PentestToolId = typeof PENTEST_TOOLS[number]["id"];

function PentestSuiteTab() {
  const [activeTool, setActiveTool] = useState<PentestToolId>("clickfix");
  const [inputs, setInputs] = useState<Record<string, string>>({
    clickfix_url: "", c2_address: "", c2_chain: "ethereum",
    ssrf_url: "", auth_url: "", discovery_url: "", dns_url: "",
  });
  const setInput = (k: string, v: string) => setInputs(p => ({ ...p, [k]: v }));

  const clickfixMut   = useMutation<ClickFixResult, Error, void>({ mutationFn: async () => { const r = await fetch(`${BASE}/api/dev-audit/pentest/clickfix`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: inputs.clickfix_url }) }); if (!r.ok) throw new Error((await r.json() as { error: string }).error); return r.json(); } });
  const c2Mut         = useMutation<BlockchainC2Result, Error, void>({ mutationFn: async () => { const r = await fetch(`${BASE}/api/dev-audit/pentest/blockchain-c2`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contractAddress: inputs.c2_address, chain: inputs.c2_chain }) }); if (!r.ok) throw new Error((await r.json() as { error: string }).error); return r.json(); } });
  const ssrfMut       = useMutation<SsrfResult, Error, void>({ mutationFn: async () => { const r = await fetch(`${BASE}/api/dev-audit/pentest/ssrf`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetApi: inputs.ssrf_url }) }); if (!r.ok) throw new Error((await r.json() as { error: string }).error); return r.json(); } });
  const authMut       = useMutation<AuthBypassResult, Error, void>({ mutationFn: async () => { const r = await fetch(`${BASE}/api/dev-audit/pentest/auth-bypass`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetBase: inputs.auth_url }) }); if (!r.ok) throw new Error((await r.json() as { error: string }).error); return r.json(); } });
  const discMut       = useMutation<EndpointDiscoveryResult, Error, void>({ mutationFn: async () => { const r = await fetch(`${BASE}/api/dev-audit/pentest/endpoint-discovery`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetBase: inputs.discovery_url }) }); if (!r.ok) throw new Error((await r.json() as { error: string }).error); return r.json(); } });
  const dnsMut        = useMutation<DnsRebindingResult, Error, void>({ mutationFn: async () => { const r = await fetch(`${BASE}/api/dev-audit/pentest/dns-rebinding`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUrl: inputs.dns_url }) }); if (!r.ok) throw new Error((await r.json() as { error: string }).error); return r.json(); } });

  return (
    <div className="space-y-5">
      {/* Tool selector grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {PENTEST_TOOLS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTool(t.id)}
            className={`border rounded-lg p-3 text-left transition-colors ${activeTool === t.id ? "border-red-500/60 bg-red-500/10" : "border-border/50 bg-muted/10 hover:bg-muted/30"}`}
          >
            <div className="flex items-center gap-2">
              <t.icon className={`w-4 h-4 shrink-0 ${t.color}`} />
              <span className="text-xs font-bold">{t.label}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-tight">{t.desc}</p>
          </button>
        ))}
      </div>

      {/* ── ClickFix Scanner ── */}
      {activeTool === "clickfix" && (
        <div className="space-y-4">
          <div className="border border-red-500/30 bg-red-500/5 rounded-lg p-3 space-y-1">
            <p className="text-xs font-bold text-red-400 flex items-center gap-2"><ShieldX className="w-4 h-4" /> ClickFix / UI Deception Scanner</p>
            <p className="text-xs text-muted-foreground">Based on the <strong>HellsUchecker</strong> research: fetches your dApp's live HTML and scans for auto-clipboard injection, Windows command prompts (Win+R/mshta/PowerShell/cmd), fake CAPTCHA patterns, forced redirects, obfuscated eval() calls, and supply chain injection vectors — the exact patterns used in ClickFix blockchain backdoor attacks.</p>
          </div>
          <div className="flex gap-2">
            <Input className="flex-1 font-mono text-sm" placeholder="https://your-dapp.com" value={inputs.clickfix_url} onChange={e => setInput("clickfix_url", e.target.value)} />
            <Button variant="destructive" onClick={() => clickfixMut.mutate()} disabled={clickfixMut.isPending || !inputs.clickfix_url}>{clickfixMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldX className="w-4 h-4" />} Scan</Button>
          </div>
          {clickfixMut.isError && <Alert className="border-red-500/40"><AlertDescription className="text-xs text-red-300">{clickfixMut.error.message}</AlertDescription></Alert>}
          {clickfixMut.isPending && <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Fetching HTML and scanning for deception patterns…</div>}
          {clickfixMut.data && (() => { const d = clickfixMut.data; return (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Reachable", value: d.reachable ? "Yes" : "No", color: d.reachable ? "text-green-400" : "text-red-400" },
                  { label: "Findings", value: d.findings.length, color: d.findings.some(f => f.severity === "critical") ? "text-red-400" : d.findings.length > 0 ? "text-orange-400" : "text-green-400" },
                  { label: "Risk Score", value: `${d.riskScore}/100`, color: d.riskScore >= 60 ? "text-red-400" : d.riskScore >= 30 ? "text-orange-400" : "text-green-400" },
                ].map(({ label, value, color }) => (
                  <Card key={label} className="border-border/50"><CardContent className="pt-3 pb-3 text-center"><div className={`text-xl font-bold ${color}`}>{value}</div><div className="text-xs text-muted-foreground">{label}</div></CardContent></Card>
                ))}
              </div>
              <RiskBar score={d.riskScore} />
              <FindingsList findings={d.findings} />
              {d.detectedPatterns.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Detected Pattern Evidence</p>
                  {d.detectedPatterns.map((p, i) => (
                    <div key={i} className="font-mono text-xs bg-black/30 border border-border/30 rounded p-2 break-all"><span className="text-red-400">[{p.pattern}] </span>{p.context}</div>
                  ))}
                </div>
              )}
            </div>
          );})()}
        </div>
      )}

      {/* ── Blockchain C2 Detector ── */}
      {activeTool === "c2" && (
        <div className="space-y-4">
          <div className="border border-purple-500/30 bg-purple-500/5 rounded-lg p-3 space-y-1">
            <p className="text-xs font-bold text-purple-400 flex items-center gap-2"><Wifi className="w-4 h-4" /> Blockchain C2 Detector</p>
            <p className="text-xs text-muted-foreground">Scans a contract's event logs for encoded Command & Control patterns — the <strong>HellsUchecker technique</strong>. Attackers use the blockchain's immutability as a C2 channel that cannot be taken down via DNS or IP blocking. Looks for embedded URLs, IP:port pairs, shell commands, base64 payloads, and executable extensions in decoded event data.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input className="col-span-2 font-mono text-sm" placeholder="0x... contract address" value={inputs.c2_address} onChange={e => setInput("c2_address", e.target.value)} />
            <select className="bg-muted border border-border rounded px-2 text-sm" value={inputs.c2_chain} onChange={e => setInput("c2_chain", e.target.value)}>
              {["ethereum","polygon","bsc","arbitrum","optimism"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Button variant="destructive" onClick={() => c2Mut.mutate()} disabled={c2Mut.isPending || !inputs.c2_address} className="gap-2">
            {c2Mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />} Scan Contract Events
          </Button>
          {c2Mut.isError && <Alert className="border-red-500/40"><AlertDescription className="text-xs text-red-300">{c2Mut.error.message}</AlertDescription></Alert>}
          {c2Mut.isPending && <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Fetching last 10,000 blocks of events and decoding…</div>}
          {c2Mut.data && (() => { const d = c2Mut.data; return (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Events Scanned", value: d.totalEventsScanned, color: "text-foreground" },
                  { label: "Suspicious Events", value: d.suspiciousEvents.length, color: d.suspiciousEvents.length > 0 ? "text-red-400" : "text-green-400" },
                  { label: "Risk Score", value: `${d.riskScore}/100`, color: d.riskScore >= 60 ? "text-red-400" : "text-green-400" },
                ].map(({ label, value, color }) => (
                  <Card key={label} className="border-border/50"><CardContent className="pt-3 pb-3 text-center"><div className={`text-xl font-bold ${color}`}>{value}</div><div className="text-xs text-muted-foreground">{label}</div></CardContent></Card>
                ))}
              </div>
              <FindingsList findings={d.findings} />
              {d.suspiciousEvents.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-red-400">Suspicious Events</p>
                  {d.suspiciousEvents.map((e, i) => (
                    <div key={i} className="border border-red-500/30 bg-red-500/8 rounded p-3 space-y-1 text-xs">
                      <div className="flex gap-2 flex-wrap">
                        {sevBadge(e.severity)}
                        <span className="font-mono text-muted-foreground">Block {e.blockNumber}</span>
                        <span className="font-mono text-muted-foreground truncate">{e.txHash.slice(0, 18)}…</span>
                      </div>
                      <p className="text-orange-300 font-semibold">{e.pattern}</p>
                      {e.decoded && <p className="font-mono bg-black/30 p-1.5 rounded break-all">{e.decoded.slice(0, 200)}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );})()}
        </div>
      )}

      {/* ── SSRF Probe ── */}
      {activeTool === "ssrf" && (
        <div className="space-y-4">
          <div className="border border-orange-500/30 bg-orange-500/5 rounded-lg p-3 space-y-1">
            <p className="text-xs font-bold text-orange-400 flex items-center gap-2"><ServerCrash className="w-4 h-4" /> SSRF Probe</p>
            <p className="text-xs text-muted-foreground">Tests your API for <strong>Server-Side Request Forgery</strong>. Injects AWS IMDS, GCP metadata, Azure IMDS, and localhost URLs into 23 common parameter names (url, callback, redirect, proxy, webhook, dest…) and checks if the server fetches them — exposing cloud credentials and internal services.</p>
          </div>
          <div className="flex gap-2">
            <Input className="flex-1 font-mono text-sm" placeholder="https://your-api.com/api/endpoint" value={inputs.ssrf_url} onChange={e => setInput("ssrf_url", e.target.value)} />
            <Button variant="destructive" onClick={() => ssrfMut.mutate()} disabled={ssrfMut.isPending || !inputs.ssrf_url}>{ssrfMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ServerCrash className="w-4 h-4" />} Probe</Button>
          </div>
          {ssrfMut.isError && <Alert className="border-red-500/40"><AlertDescription className="text-xs text-red-300">{ssrfMut.error.message}</AlertDescription></Alert>}
          {ssrfMut.isPending && <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Injecting internal URLs into all parameter names…</div>}
          {ssrfMut.data && (() => { const d = ssrfMut.data; return (
            <div className="space-y-4">
              <FindingsList findings={d.findings} />
              {d.probes.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Probe Results ({d.probes.length} non-404 responses)</p>
                  {d.probes.map((p, i) => (
                    <div key={i} className={`border rounded p-2.5 text-xs space-y-1 ${p.vulnerable ? "border-red-500/40 bg-red-500/10" : "border-orange-500/30 bg-orange-500/8"}`}>
                      <div className="flex items-center gap-2">
                        {p.vulnerable ? <span className="text-red-400 font-bold">VULNERABLE</span> : <span className="text-orange-400 font-bold">SUSPICIOUS</span>}
                        <span className="font-mono">?{p.paramName}={p.injectedUrl.slice(0, 40)}</span>
                        <span className="text-muted-foreground">HTTP {p.statusCode}</span>
                      </div>
                      <p className="text-muted-foreground">{p.indicator}</p>
                      {p.responseSnippet && <pre className="font-mono bg-black/30 p-1 rounded text-xs overflow-x-auto">{p.responseSnippet.slice(0, 150)}</pre>}
                    </div>
                  ))}
                </div>
              )}
              {d.probes.length === 0 && d.findings.every(f => f.severity === "pass") && (
                <Alert className="border-green-500/40 bg-green-500/8"><ShieldCheck className="w-4 h-4 text-green-400" /><AlertDescription className="text-xs text-green-300">No SSRF indicators detected.</AlertDescription></Alert>
              )}
            </div>
          );})()}
        </div>
      )}

      {/* ── Auth Bypass ── */}
      {activeTool === "authbypass" && (
        <div className="space-y-4">
          <div className="border border-yellow-500/30 bg-yellow-500/5 rounded-lg p-3 space-y-1">
            <p className="text-xs font-bold text-yellow-400 flex items-center gap-2"><Lock className="w-4 h-4" /> Authentication Bypass Scanner</p>
            <p className="text-xs text-muted-foreground">Tests your API for <strong>JWT algorithm:none bypass</strong> (unsigned admin token), IP spoofing via X-Forwarded-For, X-Original-URL override, Bearer null/undefined/0 coercion, admin path exposure, and sensitive endpoint discovery — all from the HackTricks pentest cheat sheet.</p>
          </div>
          <div className="flex gap-2">
            <Input className="flex-1 font-mono text-sm" placeholder="https://your-api.com" value={inputs.auth_url} onChange={e => setInput("auth_url", e.target.value)} />
            <Button variant="destructive" onClick={() => authMut.mutate()} disabled={authMut.isPending || !inputs.auth_url}>{authMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />} Scan</Button>
          </div>
          {authMut.isError && <Alert className="border-red-500/40"><AlertDescription className="text-xs text-red-300">{authMut.error.message}</AlertDescription></Alert>}
          {authMut.isPending && <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Testing JWT none, header spoofing, sensitive paths…</div>}
          {authMut.data && (() => { const d = authMut.data; const bypassed = d.tests.filter(t => t.bypassed); return (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Tests Run", value: d.tests.length, color: "text-foreground" },
                  { label: "Bypassed", value: bypassed.length, color: bypassed.length > 0 ? "text-red-400" : "text-green-400" },
                  { label: "Risk Score", value: `${d.riskScore}/100`, color: d.riskScore >= 50 ? "text-red-400" : "text-green-400" },
                ].map(({ label, value, color }) => (
                  <Card key={label} className="border-border/50"><CardContent className="pt-3 pb-3 text-center"><div className={`text-xl font-bold ${color}`}>{value}</div><div className="text-xs text-muted-foreground">{label}</div></CardContent></Card>
                ))}
              </div>
              <FindingsList findings={d.findings} />
              {bypassed.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-red-400">Bypassed Tests</p>
                  {bypassed.map((t, i) => (
                    <div key={i} className="border border-red-500/30 bg-red-500/8 rounded p-2.5 text-xs space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-red-400 font-bold">BYPASSED</span>
                        <span className="font-mono">{t.method} {t.path}</span>
                        <span className="text-muted-foreground">HTTP {t.statusCode} (expected {t.expectedStatus})</span>
                      </div>
                      <p className="font-semibold">{t.technique}</p>
                      <p className="text-muted-foreground">{t.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );})()}
        </div>
      )}

      {/* ── Endpoint Discovery ── */}
      {activeTool === "discovery" && (
        <div className="space-y-4">
          <div className="border border-blue-500/30 bg-blue-500/5 rounded-lg p-3 space-y-1">
            <p className="text-xs font-bold text-blue-400 flex items-center gap-2"><Eye className="w-4 h-4" /> Sensitive Endpoint Discovery</p>
            <p className="text-xs text-muted-foreground">Bruteforces 60+ common sensitive paths: <code className="bg-muted px-1 rounded">/.env</code>, <code className="bg-muted px-1 rounded">/.git/config</code>, <code className="bg-muted px-1 rounded">/actuator/env</code>, <code className="bg-muted px-1 rounded">/api/keys</code>, <code className="bg-muted px-1 rounded">/swagger</code>, <code className="bg-muted px-1 rounded">/graphql</code>, <code className="bg-muted px-1 rounded">/api/mnemonic</code>, <code className="bg-muted px-1 rounded">/dump.sql</code>, and more — the same list attackers run with gobuster/ffuf.</p>
          </div>
          <div className="flex gap-2">
            <Input className="flex-1 font-mono text-sm" placeholder="https://your-system.com" value={inputs.discovery_url} onChange={e => setInput("discovery_url", e.target.value)} />
            <Button variant="destructive" onClick={() => discMut.mutate()} disabled={discMut.isPending || !inputs.discovery_url}>{discMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} Discover</Button>
          </div>
          {discMut.isError && <Alert className="border-red-500/40"><AlertDescription className="text-xs text-red-300">{discMut.error.message}</AlertDescription></Alert>}
          {discMut.isPending && <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Probing 60+ sensitive paths in parallel…</div>}
          {discMut.data && (() => { const d = discMut.data; return (
            <div className="space-y-4">
              <FindingsList findings={d.findings} />
              {d.discovered.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-semibold">Discovered Paths ({d.discovered.length})</p>
                  {d.discovered.sort((a, b) => {
                    const o: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4, pass: 5 };
                    return (o[a.severity] ?? 6) - (o[b.severity] ?? 6);
                  }).map((p, i) => (
                    <div key={i} className={`flex items-center gap-2 rounded px-2 py-1.5 border text-xs ${
                      p.severity === "critical" ? "border-red-500/30 bg-red-500/10 text-red-300"
                      : p.severity === "high" ? "border-orange-500/30 bg-orange-500/10 text-orange-300"
                      : p.severity === "medium" ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                      : "border-border/30 bg-muted/10 text-muted-foreground"}`}>
                      {sevBadge(p.severity)}
                      <span className="font-mono flex-1">{p.path}</span>
                      <span>HTTP {p.status}</span>
                      <span className="text-muted-foreground">{p.note}</span>
                      <span className="text-muted-foreground">{(p.size / 1024).toFixed(1)}KB</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert className="border-green-500/40 bg-green-500/8"><ShieldCheck className="w-4 h-4 text-green-400" /><AlertDescription className="text-xs text-green-300">No sensitive paths discovered. All probed paths returned 404.</AlertDescription></Alert>
              )}
            </div>
          );})()}
        </div>
      )}

      {/* ── DNS Rebinding ── */}
      {activeTool === "dnsrebind" && (
        <div className="space-y-4">
          <div className="border border-cyan-500/30 bg-cyan-500/5 rounded-lg p-3 space-y-1">
            <p className="text-xs font-bold text-cyan-400 flex items-center gap-2"><Network className="w-4 h-4" /> DNS Rebinding Vulnerability Test</p>
            <p className="text-xs text-muted-foreground">Tests whether your endpoint is vulnerable to <strong>DNS rebinding attacks</strong> — checks CORS wildcard with arbitrary Origin headers, Host header validation bypass, and unauthenticated JSON-RPC access. Historically exploited against CryptoNote wallets (localhost:18082) and all JSON-RPC nodes with misconfigured CORS.</p>
          </div>
          <div className="flex gap-2">
            <Input className="flex-1 font-mono text-sm" placeholder="https://your-rpc-or-api.com" value={inputs.dns_url} onChange={e => setInput("dns_url", e.target.value)} />
            <Button variant="destructive" onClick={() => dnsMut.mutate()} disabled={dnsMut.isPending || !inputs.dns_url}>{dnsMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Network className="w-4 h-4" />} Test</Button>
          </div>
          {dnsMut.isError && <Alert className="border-red-500/40"><AlertDescription className="text-xs text-red-300">{dnsMut.error.message}</AlertDescription></Alert>}
          {dnsMut.isPending && <div className="flex items-center gap-2 py-4 justify-center text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Testing CORS, Host header, and unauthenticated access…</div>}
          {dnsMut.data && (() => { const d = dnsMut.data; return (
            <div className="space-y-4">
              <FindingsList findings={d.findings} />
              {d.checks.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Check Results</p>
                  {d.checks.map((c, i) => (
                    <div key={i} className={`border rounded p-2.5 text-xs space-y-0.5 ${c.vulnerable ? "border-red-500/30 bg-red-500/8" : "border-green-500/30 bg-green-500/8"}`}>
                      <div className="flex items-center gap-2">
                        {c.vulnerable ? <span className="text-red-400 font-bold">VULNERABLE</span> : <span className="text-green-400 font-bold">PASS</span>}
                        <span className="font-semibold">{c.check}</span>
                      </div>
                      <p className="text-muted-foreground font-mono">{c.result}</p>
                    </div>
                  ))}
                </div>
              )}
              {d.checks.length === 0 && d.findings.every(f => f.severity === "pass") && (
                <Alert className="border-green-500/40 bg-green-500/8"><ShieldCheck className="w-4 h-4 text-green-400" /><AlertDescription className="text-xs text-green-300">No DNS rebinding indicators found.</AlertDescription></Alert>
              )}
            </div>
          );})()}
        </div>
      )}
    </div>
  );
}

// ── RPC Attack Suite Tab ───────────────────────────────────────────────────────
interface AttackMethodResult {
  method: string; namespace: string;
  status: "exposed" | "auth-required" | "not-found" | "error" | "fuzz-hit";
  errorCode?: number; errorMessage?: string; responseTime: number;
  result?: unknown; isInfoLeak: boolean; params: unknown[];
}
interface FuzzResult {
  method: string; payload: string; payloadDescription: string;
  triggered: boolean; statusCode?: number; errorCode?: number;
  errorMessage?: string; unexpectedBehaviour: string;
}
interface BatchAttackResult {
  batchSize: number; responding: number; rateLimitBypassed: boolean;
  batchRejected: boolean; rejectionReason?: string;
  responseTimeMs: number; respondingMethods: string[]; batchError?: string;
}
interface RpcAttackSuiteResult {
  endpoint: string; scanTimeMs: number; totalProbed: number;
  fullyExposed: string[]; authRequired: string[]; notFound: number;
  discoveredNamespaces: string[]; methods: AttackMethodResult[];
  batchAttack: BatchAttackResult; fuzzResults: FuzzResult[];
  responseDifferential: Record<string, string[]>;
  criticalFindings: string[]; riskScore: number;
}

const NS_DANGER: Record<string, { color: string; label: string; threat: string }> = {
  personal: { color: "text-red-400 border-red-500/40 bg-red-500/10",   label: "CRITICAL", threat: "Account unlocking & signing" },
  admin:    { color: "text-red-400 border-red-500/40 bg-red-500/10",   label: "CRITICAL", threat: "Node admin & peer topology" },
  debug:    { color: "text-red-400 border-red-500/40 bg-red-500/10",   label: "CRITICAL", threat: "Full EVM traces & state dumps" },
  miner:    { color: "text-red-400 border-red-500/40 bg-red-500/10",   label: "CRITICAL", threat: "Miner control & coinbase set" },
  devnode:  { color: "text-red-400 border-red-500/40 bg-red-500/10",   label: "CRITICAL", threat: "Hardhat/Anvil dev node exposed" },
  txpool:   { color: "text-orange-400 border-orange-500/40 bg-orange-500/10", label: "HIGH", threat: "Full mempool enumeration" },
  parity:   { color: "text-orange-400 border-orange-500/40 bg-orange-500/10", label: "HIGH", threat: "Parity-specific account access" },
  trace:    { color: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10", label: "MEDIUM", threat: "Transaction trace data" },
  erigon:   { color: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10", label: "MEDIUM", threat: "Erigon-specific endpoints" },
  bor:      { color: "text-blue-400 border-blue-500/40 bg-blue-500/10",  label: "INFO",   threat: "Polygon validator info" },
  alchemy:  { color: "text-blue-400 border-blue-500/40 bg-blue-500/10",  label: "INFO",   threat: "Alchemy enhanced API" },
  eth:      { color: "text-green-400 border-green-500/40 bg-green-500/10", label: "STD",  threat: "Standard Ethereum API" },
  net:      { color: "text-green-400 border-green-500/40 bg-green-500/10", label: "STD",  threat: "Network meta" },
  web3:     { color: "text-muted-foreground border-border bg-muted/30",   label: "STD",   threat: "Web3 utility (version leak)" },
};

const TECHNIQUE_EXPLAINERS = [
  {
    icon: Layers,
    title: "Batch Request Amplification",
    color: "text-red-400",
    desc: "JSON-RPC allows multiple calls in one HTTP request. Attackers bundle 150+ methods into a single POST to bypass per-request rate limits that only count HTTP requests, not the RPC calls inside the batch.",
    source: "HackTricks Rate Limit Bypass / StackHawk",
  },
  {
    icon: Eye,
    title: "Cache Probe / API Surface Enumeration",
    color: "text-orange-400",
    desc: '"Method not found" (-32601) vs "Unauthorized" (-32001) is the key differential. Even on a "secured" node, Unauthorized reveals the method EXISTS — attackers use this to map the full hidden API surface without ever getting a result.',
    source: "StackHawk JSON-RPC Security Guide (March 2026)",
  },
  {
    icon: Bug,
    title: "Loose Parameter Type Fuzzing",
    color: "text-yellow-400",
    desc: "Without strict schema enforcement, sending null, objects, arrays, or prototype-pollution payloads where strings are expected can bypass input validation, trigger unexpected code paths, or cause parser panics.",
    source: "StackHawk / Alchemy RPC Security",
  },
  {
    icon: Network,
    title: "Namespace Discovery",
    color: "text-blue-400",
    desc: "Probing all known namespaces (eth, personal, admin, debug, txpool, miner, parity, trace, erigon, bor, alchemy, hardhat, anvil) reveals which client software is running and what private APIs are unintentionally exposed.",
    source: "Ethereum Node Configuration Research",
  },
];

function RpcAttackSuiteTab() {
  const [endpoint, setEndpoint] = useState("");
  const [showMethods, setShowMethods] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showFuzz, setShowFuzz] = useState(false);
  const [nsFilter, setNsFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const mutation = useMutation<RpcAttackSuiteResult, Error, string>({
    mutationFn: async (ep) => {
      const resp = await fetch(`${BASE}/api/dev-audit/rpc-attack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: ep }),
      });
      if (!resp.ok) throw new Error((await resp.json() as { error: string }).error);
      return resp.json();
    },
  });

  const r = mutation.data;

  const filteredMethods = r ? r.methods.filter(m => {
    if (nsFilter !== "all" && m.namespace !== nsFilter) return false;
    if (statusFilter !== "all" && m.status !== statusFilter) return false;
    return true;
  }).sort((a, b) => {
    const order = { exposed: 0, "auth-required": 1, error: 2, "fuzz-hit": 3, "not-found": 4 };
    return (order[a.status] ?? 5) - (order[b.status] ?? 5);
  }) : [];

  const namespaces = r ? [...new Set(r.methods.map(m => m.namespace))] : [];

  return (
    <div className="space-y-6">
      {/* Technique explainers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {TECHNIQUE_EXPLAINERS.map(t => (
          <div key={t.title} className="border border-border/50 rounded-lg p-3 bg-muted/20 space-y-1">
            <div className="flex items-center gap-2">
              <t.icon className={`w-4 h-4 shrink-0 ${t.color}`} />
              <span className="text-xs font-bold">{t.title}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{t.desc}</p>
            <p className="text-xs text-muted-foreground/60 italic">Source: {t.source}</p>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Wifi className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9 font-mono text-sm"
              placeholder="https://your-node.example.com:8545"
              value={endpoint}
              onChange={e => setEndpoint(e.target.value)}
            />
          </div>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate(endpoint.trim())}
            disabled={mutation.isPending || !endpoint.trim()}
            className="gap-2 shrink-0"
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Swords className="w-4 h-4" />}
            {mutation.isPending ? "Attacking…" : "Run Full Attack Suite"}
          </Button>
        </div>
        <Alert className="border-orange-500/40 bg-orange-500/8">
          <Target className="w-4 h-4 text-orange-400" />
          <AlertDescription className="text-xs">
            <strong className="text-orange-400">What this does:</strong> Sends {170}+ real JSON-RPC calls, one batch amplification test
            (all methods in a single HTTP request), and 17 fuzzing payloads per exposed method — the exact same
            sequence a real attacker runs. Only point this at systems you own or have written permission to test.
          </AlertDescription>
        </Alert>
      </div>

      {mutation.isError && (
        <Alert className="border-red-500/40 bg-red-500/8">
          <ShieldX className="w-4 h-4 text-red-400" />
          <AlertDescription className="text-sm text-red-300">{mutation.error.message}</AlertDescription>
        </Alert>
      )}

      {mutation.isPending && (
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <Swords className="w-10 h-10 text-red-400 animate-pulse" />
          <div className="text-center">
            <p className="font-semibold text-sm">Attack suite running…</p>
            <p className="text-xs text-muted-foreground mt-1">
              Probing 170+ methods across 14 namespaces, running batch amplification test,
              fuzzing exposed endpoints. This may take 30–90 seconds.
            </p>
          </div>
          <div className="flex gap-2 flex-wrap justify-center">
            {["Batch amplification","Cache probing","Namespace enumeration","Parameter fuzzing","Auth escalation"].map(s => (
              <span key={s} className="text-xs border border-border/40 rounded px-2 py-0.5 text-muted-foreground animate-pulse">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}

      {r && (
        <div className="space-y-6">
          {/* ── Summary Stats ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: "Methods Probed",   value: r.totalProbed,          color: "text-foreground" },
              { label: "Fully Exposed",    value: r.fullyExposed.length,  color: r.fullyExposed.length > 0 ? "text-red-400" : "text-green-400" },
              { label: "Auth-Required (Info Leak)", value: r.authRequired.length, color: r.authRequired.length > 0 ? "text-orange-400" : "text-green-400" },
              { label: "Namespaces Found", value: r.discoveredNamespaces.length, color: "text-blue-400" },
              { label: "Scan Time",        value: `${(r.scanTimeMs / 1000).toFixed(1)}s`, color: "text-muted-foreground" },
            ].map(({ label, value, color }) => (
              <Card key={label} className="border-border/50">
                <CardContent className="pt-3 pb-3 text-center">
                  <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-tight">{label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* ── Risk Score ── */}
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-red-400" />
                Risk Score
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  (based on exposed dangerous namespaces, rate-limit bypass, info leaks, fuzzing hits)
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              <RiskBar score={r.riskScore} />
            </CardContent>
          </Card>

          {/* ── Critical Findings ── */}
          {r.criticalFindings.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Flame className="w-4 h-4 text-red-400" />
                Critical Findings ({r.criticalFindings.length})
              </h3>
              {r.criticalFindings.map((f, i) => {
                const isCrit = f.startsWith("CRITICAL");
                const isHigh = f.startsWith("HIGH");
                const cls = isCrit
                  ? "border-red-500/50 bg-red-500/10 text-red-300"
                  : isHigh
                  ? "border-orange-500/50 bg-orange-500/10 text-orange-300"
                  : "border-yellow-500/50 bg-yellow-500/10 text-yellow-300";
                return (
                  <Alert key={i} className={`${cls}`}>
                    <ShieldAlert className="w-4 h-4" />
                    <AlertDescription className="text-xs leading-relaxed">{f}</AlertDescription>
                  </Alert>
                );
              })}
            </div>
          )}

          {r.criticalFindings.length === 0 && (
            <Alert className="border-green-500/40 bg-green-500/8">
              <ShieldCheck className="w-4 h-4 text-green-400" />
              <AlertDescription className="text-xs text-green-300">
                No critical findings detected. All dangerous namespaces appear to be properly locked down.
              </AlertDescription>
            </Alert>
          )}

          {/* ── Batch Amplification Result ── */}
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-orange-400" />
                Batch Request Amplification Attack
                {r.batchAttack.rateLimitBypassed
                  ? <span className="text-xs text-red-400 font-semibold ml-auto">⚠ RATE-LIMIT BYPASS CONFIRMED</span>
                  : r.batchAttack.batchRejected
                  ? <span className="text-xs text-green-400 font-semibold ml-auto">✓ Batch Rejected</span>
                  : <span className="text-xs text-yellow-400 font-semibold ml-auto">Batch Accepted (monitor volume)</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "Methods in Batch",  value: r.batchAttack.batchSize },
                  { label: "Responded",         value: r.batchAttack.responding },
                  { label: "Response Time",     value: `${r.batchAttack.responseTimeMs}ms` },
                  { label: "Rate-Limit Bypass", value: r.batchAttack.rateLimitBypassed ? "YES" : "No" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-muted/30 rounded p-2 text-center">
                    <div className="font-mono font-bold text-sm">{value}</div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
              {r.batchAttack.batchRejected && r.batchAttack.rejectionReason && (
                <p className="text-xs text-green-300 bg-green-500/10 border border-green-500/30 rounded p-2">
                  Server protection: {r.batchAttack.rejectionReason}
                </p>
              )}
              {r.batchAttack.rateLimitBypassed && r.batchAttack.respondingMethods.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-orange-300 font-semibold">Methods that bypassed rate-limiting via batch:</p>
                  <div className="flex flex-wrap gap-1">
                    {r.batchAttack.respondingMethods.slice(0, 30).map(m => (
                      <span key={m} className="text-xs font-mono bg-orange-500/10 border border-orange-500/30 text-orange-300 rounded px-1.5 py-0.5">
                        {m}
                      </span>
                    ))}
                    {r.batchAttack.respondingMethods.length > 30 && (
                      <span className="text-xs text-muted-foreground">+{r.batchAttack.respondingMethods.length - 30} more</span>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Namespace Discovery ── */}
          {r.discoveredNamespaces.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Network className="w-4 h-4 text-blue-400" />
                Discovered Namespaces ({r.discoveredNamespaces.length})
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {r.discoveredNamespaces.map(ns => {
                  const info = NS_DANGER[ns] ?? { color: "text-muted-foreground border-border bg-muted/20", label: "UNK", threat: "Unknown namespace" };
                  const exposed = r.fullyExposed.filter(m => m.startsWith(`${ns}_`));
                  const authReq = r.authRequired.filter(m => m.startsWith(`${ns}_`));
                  return (
                    <div key={ns} className={`border rounded-lg p-3 space-y-1 ${info.color}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm">{ns}_*</span>
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded border ${info.color}`}>{info.label}</span>
                      </div>
                      <p className="text-xs opacity-80">{info.threat}</p>
                      <div className="flex gap-2 text-xs flex-wrap">
                        {exposed.length > 0 && <span className="text-red-400">{exposed.length} exposed</span>}
                        {authReq.length > 0 && <span className="text-orange-400">{authReq.length} auth-required (info leak)</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Response Differential (Cache Probe) ── */}
          {Object.keys(r.responseDifferential).length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4">
                <button
                  className="flex items-center justify-between w-full"
                  onClick={() => setShowDiff(v => !v)}
                >
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Eye className="w-4 h-4 text-orange-400" />
                    Response Differential Map — Cache Probe Results
                    <span className="text-xs text-muted-foreground font-normal">
                      ({Object.keys(r.responseDifferential).length} error signatures)
                    </span>
                  </CardTitle>
                  {showDiff ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
              </CardHeader>
              {showDiff && (
                <CardContent className="pb-4 space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-orange-400">The hacker technique:</strong> Different error codes for the same
                    "failed" request reveal the API structure. A <code className="bg-muted px-1 rounded">-32601 Method not found</code> means
                    the method doesn't exist. A <code className="bg-muted px-1 rounded">-32001 Unauthorized</code> means it DOES exist but is
                    auth-protected — leaking the full API surface even to unauthenticated attackers.
                  </p>
                  {Object.entries(r.responseDifferential).map(([sig, methods]) => (
                    <div key={sig} className="space-y-1">
                      <p className="text-xs font-mono font-semibold text-orange-300">{sig}</p>
                      <div className="flex flex-wrap gap-1">
                        {methods.slice(0, 20).map(m => (
                          <span key={m} className="text-xs font-mono bg-muted/40 border border-border/40 rounded px-1.5 py-0.5 text-muted-foreground">
                            {m}
                          </span>
                        ))}
                        {methods.length > 20 && (
                          <span className="text-xs text-muted-foreground">+{methods.length - 20} more</span>
                        )}
                      </div>
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* ── Parameter Fuzzing Results ── */}
          {r.fuzzResults.filter(f => f.triggered).length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4">
                <button className="flex items-center justify-between w-full" onClick={() => setShowFuzz(v => !v)}>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Bug className="w-4 h-4 text-yellow-400" />
                    Parameter Fuzzing Hits
                    <span className="text-xs text-red-400 font-semibold">
                      {r.fuzzResults.filter(f => f.triggered).length} unexpected behaviours triggered
                    </span>
                  </CardTitle>
                  {showFuzz ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
              </CardHeader>
              {showFuzz && (
                <CardContent className="pb-4 space-y-2">
                  {r.fuzzResults.filter(f => f.triggered).map((f, i) => (
                    <div key={i} className="border border-yellow-500/30 bg-yellow-500/8 rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-yellow-300">{f.method}</span>
                        <span className="text-xs text-muted-foreground">←</span>
                        <span className="text-xs text-yellow-200">{f.payloadDescription}</span>
                      </div>
                      <p className="text-xs text-orange-300 font-semibold">{f.unexpectedBehaviour}</p>
                      {f.errorMessage && (
                        <p className="text-xs font-mono text-muted-foreground">{f.errorMessage.slice(0, 150)}</p>
                      )}
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )}

          {/* ── All Methods Table ── */}
          <Card className="border-border/50">
            <CardHeader className="pb-2 pt-4">
              <button className="flex items-center justify-between w-full" onClick={() => setShowMethods(v => !v)}>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  Full Method Probe Results ({r.totalProbed} methods)
                </CardTitle>
                {showMethods ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </button>
            </CardHeader>
            {showMethods && (
              <CardContent className="pb-4 space-y-3">
                {/* Filters */}
                <div className="flex gap-2 flex-wrap">
                  <select
                    className="text-xs bg-muted border border-border rounded px-2 py-1"
                    value={nsFilter}
                    onChange={e => setNsFilter(e.target.value)}
                  >
                    <option value="all">All namespaces</option>
                    {namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}
                  </select>
                  <select
                    className="text-xs bg-muted border border-border rounded px-2 py-1"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All statuses</option>
                    <option value="exposed">Exposed</option>
                    <option value="auth-required">Auth-Required (Info Leak)</option>
                    <option value="error">Error</option>
                    <option value="not-found">Not Found</option>
                  </select>
                  <span className="text-xs text-muted-foreground self-center">
                    Showing {filteredMethods.length} methods
                  </span>
                </div>
                <ScrollArea className="h-80">
                  <div className="space-y-1">
                    {filteredMethods.map(m => {
                      const statusCls = m.status === "exposed"
                        ? "text-red-400 bg-red-500/10 border-red-500/30"
                        : m.status === "auth-required"
                        ? "text-orange-400 bg-orange-500/10 border-orange-500/30"
                        : m.status === "error"
                        ? "text-yellow-400 bg-yellow-500/10 border-yellow-500/30"
                        : "text-muted-foreground bg-muted/10 border-border/20";
                      return (
                        <div key={m.method} className={`flex items-center gap-2 rounded px-2 py-1.5 border text-xs font-mono ${statusCls}`}>
                          <span className="flex-1 truncate">{m.method}</span>
                          <span className="shrink-0 text-muted-foreground">{m.responseTime}ms</span>
                          {m.isInfoLeak && (
                            <span className="shrink-0 text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30 rounded px-1">
                              INFO LEAK
                            </span>
                          )}
                          <span className={`shrink-0 text-xs rounded px-1 border ${statusCls}`}>
                            {m.status}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// ── Advanced Wallet Scanner Tab (Profanity · Weak-RNG · Contract Escape Hatches) ──

interface AdvFinding { severity: string; title: string; detail: string; }
interface AdvProfanity {
  address: string; isVanity: boolean; vanityType: string; vanityLength: number;
  profanityRisk: string; riskReason: string; entropy: number;
  knownVulnMatch: boolean; findings: AdvFinding[];
}
interface AdvWeakRng {
  address: string; rValuesAnalyzed: number; weakRngSignals: string[];
  javaSecureRandom: boolean; lowEntropyR: boolean; sequentialR: boolean;
  overallRisk: string; findings: AdvFinding[];
}
interface AdvContract {
  address: string; isContract: boolean; isEip7702: boolean; delegateTo?: string;
  bytecodeSize: number; proxied: boolean; implementationSlot?: string;
  hasSelfDestruct: boolean; hasDelegateCall: boolean;
  dangerousSelectors: Array<{ sig: string; name: string; risk: string }>;
  upgradePattern?: string; findings: AdvFinding[];
}
interface AdvScanResult {
  address: string; profanity: AdvProfanity; weakRng: AdvWeakRng;
  contract: AdvContract; overallRisk: number; scanTimeMs: number;
}
interface AdvBatchResult { results: AdvScanResult[]; scanned: number; }

const ADV_SEV_COLOR: Record<string, string> = {
  critical: "bg-red-500/15 border-red-500/40 text-red-300",
  high:     "bg-orange-500/15 border-orange-500/40 text-orange-300",
  medium:   "bg-yellow-500/15 border-yellow-500/40 text-yellow-300",
  low:      "bg-blue-500/15 border-blue-500/40 text-blue-300",
  pass:     "bg-green-500/15 border-green-500/40 text-green-300",
  info:     "bg-muted/50 border-border text-muted-foreground",
};

function AdvFindingRow({ f }: { f: AdvFinding }) {
  return (
    <div className={`rounded p-3 border text-xs ${ADV_SEV_COLOR[f.severity] ?? ADV_SEV_COLOR["info"]}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${ADV_SEV_COLOR[f.severity] ?? ""}`}>
          {f.severity.toUpperCase()}
        </span>
        <span className="font-semibold">{f.title}</span>
      </div>
      <p className="opacity-80">{f.detail}</p>
    </div>
  );
}

function AdvancedScannerTab() {
  const [input, setInput] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const { toast } = useToast();

  const mutation = useMutation<AdvBatchResult, Error, string[]>({
    mutationFn: (addresses) =>
      fetch(`${BASE}/api/dev-audit/advanced-batch`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses }),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
  });

  const run = () => {
    const addrs = input.split(/[\n,\s]+/).map(a => a.trim()).filter(a => /^0x[0-9a-fA-F]{40}$/.test(a));
    if (!addrs.length) { toast({ title: "No valid EVM addresses", variant: "destructive" }); return; }
    if (addrs.length > 20) { toast({ title: "Max 20 addresses per batch", variant: "destructive" }); return; }
    mutation.mutate(addrs);
  };

  const data = mutation.data;
  const criticalCount = data?.results.filter(r =>
    r.profanity.profanityRisk === "critical" || r.weakRng.javaSecureRandom || r.contract.hasSelfDestruct
  ).length ?? 0;

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldAlert className="w-5 h-5 text-orange-400" />Advanced Cryptographic Vulnerability Scanner
          </CardTitle>
          <CardDescription className="text-xs space-y-1">
            <span className="block">Three deep-scan vectors run in parallel for each address:</span>
            <span className="block text-orange-300 font-medium">① Profanity/Vanity CVE-2022-39391</span>
            <span className="block text-red-300 font-medium">② Weak-RNG r-value fingerprinting (Java SecureRandom, sequential patterns, low entropy)</span>
            <span className="block text-yellow-300 font-medium">③ Contract escape hatch analysis (EIP-7702, proxy upgrade slots, SELFDESTRUCT, dangerous selectors)</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder={"0x0D5c41C609Fe1Ec073C3b4Fa10949d602Ed059Bb\n0xb98E8eeFBa0f7476B85Cd9716Cb5b38a935AA872\n...one per line, up to 20"}
            value={input} onChange={e => setInput(e.target.value)}
            className="font-mono text-xs min-h-[120px] bg-background"
          />
          <div className="flex items-center gap-3">
            <Button onClick={run} disabled={mutation.isPending} className="gap-2 bg-orange-600 hover:bg-orange-700">
              {mutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />Running 3 scan vectors…</>
                : <><ShieldAlert className="w-4 h-4" />Run Advanced Scan</>}
            </Button>
            {data && <span className="text-xs text-muted-foreground">{data.scanned} address{data.scanned !== 1 ? "es" : ""} scanned</span>}
          </div>
          {mutation.isError && (
            <Alert className="border-red-500/40 bg-red-500/8">
              <AlertDescription className="text-xs text-red-400">{mutation.error.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {data && (
        <div className="space-y-3">
          {/* Summary tiles */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Addresses Scanned",   value: data.scanned,       color: "text-foreground" },
              { label: "Critical / High Risk", value: criticalCount,      color: criticalCount > 0 ? "text-red-400" : "text-green-400" },
              { label: "Profanity Vanity",     value: data.results.filter(r => r.profanity.isVanity).length,          color: "text-orange-400" },
              { label: "Contracts Found",      value: data.results.filter(r => r.contract.isContract).length,         color: "text-purple-400" },
            ].map(({ label, value, color }) => (
              <Card key={label} className="border-border/50">
                <CardContent className="pt-3 pb-2 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Per-address results */}
          <div className="space-y-2">
            {data.results.map(result => {
              const open = expanded === result.address;
              const profRisk = result.profanity.profanityRisk;
              const topRisk = result.overallRisk;
              const statusColor = topRisk >= 70 ? "text-red-400" : topRisk >= 40 ? "text-orange-400" : topRisk >= 20 ? "text-yellow-400" : "text-green-400";
              const borderColor = topRisk >= 70 ? "border-red-500/50 bg-red-500/5" : topRisk >= 40 ? "border-orange-500/30" : "";

              return (
                <Card key={result.address}
                  className={`border-border/50 cursor-pointer hover:border-border transition-colors ${borderColor}`}
                  onClick={() => setExpanded(open ? null : result.address)}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {topRisk >= 70 ? <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                          : topRisk >= 20 ? <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                          : <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />}
                        <span className="font-mono text-xs truncate">{result.address}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                        {result.profanity.isVanity && (
                          <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">
                            {profRisk.toUpperCase()} VANITY
                          </Badge>
                        )}
                        {result.weakRng.javaSecureRandom && (
                          <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">JAVA RNG</Badge>
                        )}
                        {result.contract.isContract && (
                          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                            {result.contract.proxied ? "PROXY" : "CONTRACT"}
                          </Badge>
                        )}
                        {result.contract.isEip7702 && (
                          <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">EIP-7702</Badge>
                        )}
                        {!result.profanity.isVanity && !result.weakRng.javaSecureRandom && !result.contract.isContract && (
                          <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">EOA CLEAN</Badge>
                        )}
                        <span className={`text-sm font-bold ${statusColor}`}>{topRisk}/100</span>
                        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {open && (
                      <div className="mt-4 space-y-4" onClick={e => e.stopPropagation()}>

                        {/* ① Profanity */}
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-orange-400 flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5" /> ① Profanity / Vanity-Address Vulnerability (CVE-2022-39391)
                          </p>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-muted/30 rounded p-2">
                              <p className="font-bold">{result.profanity.isVanity ? result.profanity.vanityType.replace("-", " ") : "none"}</p>
                              <p className="text-muted-foreground">Vanity Type</p>
                            </div>
                            <div className="bg-muted/30 rounded p-2">
                              <p className="font-bold">{(result.profanity.entropy * 100).toFixed(1)}%</p>
                              <p className="text-muted-foreground">Address Entropy</p>
                            </div>
                            <div className="bg-muted/30 rounded p-2">
                              <p className={`font-bold ${result.profanity.knownVulnMatch ? "text-red-400" : "text-green-400"}`}>
                                {result.profanity.knownVulnMatch ? "YES" : "NO"}
                              </p>
                              <p className="text-muted-foreground">Known Vuln Match</p>
                            </div>
                          </div>
                          {result.profanity.findings.map((f, i) => <AdvFindingRow key={i} f={f} />)}
                        </div>

                        {/* ② Weak-RNG */}
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-red-400 flex items-center gap-1">
                            <Activity className="w-3.5 h-3.5" /> ② Weak-RNG R-Value Fingerprinting
                          </p>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-muted/30 rounded p-2">
                              <p className="font-bold">{result.weakRng.rValuesAnalyzed}</p>
                              <p className="text-muted-foreground">R-Values Analyzed</p>
                            </div>
                            <div className="bg-muted/30 rounded p-2">
                              <p className={`font-bold ${result.weakRng.javaSecureRandom ? "text-red-400" : "text-green-400"}`}>
                                {result.weakRng.javaSecureRandom ? "DETECTED" : "Clean"}
                              </p>
                              <p className="text-muted-foreground">Java SecureRandom</p>
                            </div>
                            <div className="bg-muted/30 rounded p-2">
                              <p className={`font-bold ${result.weakRng.sequentialR ? "text-red-400" : "text-green-400"}`}>
                                {result.weakRng.sequentialR ? "YES" : "NO"}
                              </p>
                              <p className="text-muted-foreground">Sequential R</p>
                            </div>
                          </div>
                          {result.weakRng.weakRngSignals.length > 0 && result.weakRng.weakRngSignals.map((s, i) => (
                            <div key={i} className="text-xs bg-red-500/8 border border-red-500/20 rounded px-3 py-2 text-red-300">⚠ {s}</div>
                          ))}
                          {result.weakRng.findings.map((f, i) => <AdvFindingRow key={i} f={f} />)}
                        </div>

                        {/* ③ Contract */}
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-purple-400 flex items-center gap-1">
                            <Layers className="w-3.5 h-3.5" /> ③ Contract / EIP-7702 Escape Hatch Analysis
                          </p>
                          <div className="grid grid-cols-3 gap-2 text-center text-xs">
                            <div className="bg-muted/30 rounded p-2">
                              <p className="font-bold">{result.contract.isContract ? `${result.contract.bytecodeSize}b` : "EOA"}</p>
                              <p className="text-muted-foreground">Account Type</p>
                            </div>
                            <div className="bg-muted/30 rounded p-2">
                              <p className={`font-bold ${result.contract.hasSelfDestruct ? "text-red-400" : "text-green-400"}`}>
                                {result.contract.hasSelfDestruct ? "FOUND" : "None"}
                              </p>
                              <p className="text-muted-foreground">SELFDESTRUCT</p>
                            </div>
                            <div className="bg-muted/30 rounded p-2">
                              <p className={`font-bold ${result.contract.proxied ? "text-orange-400" : "text-green-400"}`}>
                                {result.contract.proxied ? result.contract.upgradePattern ?? "Proxied" : "No"}
                              </p>
                              <p className="text-muted-foreground">Upgrade Proxy</p>
                            </div>
                          </div>
                          {result.contract.dangerousSelectors.length > 0 && (
                            <div className="text-xs space-y-1">
                              {result.contract.dangerousSelectors.map((s, i) => (
                                <div key={i} className="bg-orange-500/8 border border-orange-500/20 rounded px-3 py-1.5 flex justify-between">
                                  <span className="font-mono text-orange-300">{s.sig}</span>
                                  <span className="text-orange-200">{s.name}</span>
                                  <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">{s.risk}</Badge>
                                </div>
                              ))}
                            </div>
                          )}
                          {result.contract.findings.map((f, i) => <AdvFindingRow key={i} f={f} />)}
                        </div>

                        <div className="flex gap-2 pt-1 text-xs text-muted-foreground">
                          <span>Scan time: {result.scanTimeMs}ms</span>
                          <a href={`https://etherscan.io/address/${result.address}`} target="_blank" rel="noopener noreferrer"
                            className="text-cyan-400 hover:underline flex items-center gap-1 ml-2">
                            <ExternalLink className="w-3 h-3" /> Etherscan
                          </a>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ECDSA Nonce / Signature Scanner Tab ───────────────────────────────────────

interface EcdsaFinding { id: string; severity: Severity; title: string; detail: string; }
interface NonceReuseResult {
  tx1Hash: string; tx2Hash: string; sharedR: string;
  derivedK: string; derivedPrivKey: string; confidence: string; note: string;
}
interface EcdsaScanResult {
  address: string; chain: string; txsAnalyzed: number; signaturesOk: number;
  nonceReuseFound: boolean; nonceReuseResults: NonceReuseResult[];
  lowRvalueCount: number; sMalleableCount: number;
  rValueCollisions: Array<{ r: string; txHashes: string[] }>;
  weakPatterns: string[]; riskScore: number; scanTimeMs: number;
  findings: EcdsaFinding[];
}
interface EcdsaBatchResult { results: EcdsaScanResult[]; scanned: number; }

function EcdsaScannerTab() {
  const [input, setInput] = useState("");
  const [expandedAddr, setExpandedAddr] = useState<string | null>(null);
  const { toast } = useToast();

  const mutation = useMutation<EcdsaBatchResult, Error, string[]>({
    mutationFn: (addresses) =>
      fetch(`${BASE}/api/dev-audit/ecdsa-batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses }),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
  });

  const run = () => {
    const addrs = input.split(/[\n,\s]+/).map(a => a.trim()).filter(a => /^0x[0-9a-fA-F]{40}$/.test(a));
    if (!addrs.length) { toast({ title: "No valid EVM addresses found", description: "Enter 0x… addresses, one per line.", variant: "destructive" }); return; }
    if (addrs.length > 20) { toast({ title: "Max 20 addresses per batch", variant: "destructive" }); return; }
    mutation.mutate(addrs);
  };

  const data = mutation.data;

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Cpu className="w-5 h-5 text-red-400" />ECDSA Nonce Reuse &amp; Signature Vulnerability Scanner
          </CardTitle>
          <CardDescription className="text-xs">
            Fetches real transaction signatures (r, s, v) from Ethereum for each address. Checks for ECDSA k-nonce reuse
            (same r-value in two transactions = private key is mathematically derivable), low r-values, malleable
            s-values, and nonce gaps. Paste up to 20 EVM addresses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder={"0x0D5c41C609Fe1Ec073C3b4Fa10949d602Ed059Bb\n0xb98E8eeFBa0f7476B85Cd9716Cb5b38a935AA872\n...one address per line"}
            value={input} onChange={e => setInput(e.target.value)}
            className="font-mono text-xs min-h-[120px] bg-background"
          />
          <div className="flex items-center gap-3">
            <Button onClick={run} disabled={mutation.isPending} className="gap-2 bg-red-600 hover:bg-red-700">
              {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Scanning signatures…</> : <><Cpu className="w-4 h-4" />Run ECDSA Scan</>}
            </Button>
            {data && <span className="text-xs text-muted-foreground">{data.scanned} address{data.scanned !== 1 ? "es" : ""} scanned</span>}
          </div>
          {mutation.isError && (
            <Alert className="border-red-500/40 bg-red-500/8">
              <AlertDescription className="text-xs text-red-400">{mutation.error.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {data && (
        <div className="space-y-3">
          {/* Summary row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Addresses Scanned",  value: data.scanned,                                                    color: "text-foreground" },
              { label: "Nonce Reuse Found",   value: data.results.filter(r => r.nonceReuseFound).length,             color: data.results.some(r=>r.nonceReuseFound) ? "text-red-400" : "text-green-400" },
              { label: "Total Sigs Analyzed", value: data.results.reduce((s,r)=>s+r.signaturesOk, 0),               color: "text-cyan-400" },
              { label: "Total Weak Patterns", value: data.results.reduce((s,r)=>s+r.weakPatterns.length, 0),        color: data.results.some(r=>r.weakPatterns.length>0) ? "text-orange-400" : "text-green-400" },
            ].map(({ label, value, color }) => (
              <Card key={label} className="border-border/50">
                <CardContent className="pt-3 pb-2 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Per-address results */}
          <div className="space-y-2">
            {data.results.map(result => {
              const isOpen = expandedAddr === result.address;
              const critical = result.nonceReuseFound;
              const hasWeakness = result.weakPatterns.length > 0 || result.lowRvalueCount > 0 || result.sMalleableCount > 0;
              return (
                <Card key={result.address}
                  className={`border-border/50 cursor-pointer hover:border-border transition-colors ${critical ? "border-red-500/50 bg-red-500/5" : ""}`}
                  onClick={() => setExpandedAddr(isOpen ? null : result.address)}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {critical
                          ? <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                          : hasWeakness
                            ? <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                            : <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />}
                        <span className="font-mono text-xs truncate">{result.address}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {critical && <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">NONCE REUSE</Badge>}
                        {!critical && hasWeakness && <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-xs">WEAK PATTERN</Badge>}
                        {!critical && !hasWeakness && result.signaturesOk > 0 && <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">CLEAN</Badge>}
                        {result.signaturesOk === 0 && <Badge className="bg-muted/50 text-muted-foreground text-xs">NO OUTBOUND TXS</Badge>}
                        <span className="text-xs text-muted-foreground">{result.signaturesOk} sigs</span>
                        <RiskBar score={result.riskScore} />
                        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-4 space-y-3" onClick={e => e.stopPropagation()}>
                        {/* Stats row */}
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-center">
                          {[
                            { k: "Txs Found",      v: result.txsAnalyzed },
                            { k: "Sigs Decoded",   v: result.signaturesOk },
                            { k: "R Collisions",   v: result.rValueCollisions.length },
                            { k: "Low R-value",    v: result.lowRvalueCount },
                            { k: "Malleable S",    v: result.sMalleableCount },
                          ].map(({ k, v }) => (
                            <div key={k} className="bg-muted/30 rounded p-2">
                              <p className="text-sm font-bold">{v}</p>
                              <p className="text-xs text-muted-foreground">{k}</p>
                            </div>
                          ))}
                        </div>

                        {/* Findings */}
                        <div className="space-y-2">
                          {result.findings.map(f => (
                            <div key={f.id} className={`rounded p-3 border text-xs ${sevColor(f.severity)}`}>
                              <div className="flex items-center gap-2 mb-1">
                                {sevBadge(f.severity)}
                                <span className="font-semibold">{f.title}</span>
                              </div>
                              <p className="text-xs opacity-80">{f.detail}</p>
                            </div>
                          ))}
                        </div>

                        {/* Nonce reuse detail */}
                        {result.nonceReuseResults.map((nr, i) => (
                          <Card key={i} className="border-red-500/50 bg-red-500/5">
                            <CardContent className="pt-3 pb-3 space-y-2 text-xs">
                              <p className="font-bold text-red-400">⚠ Nonce Reuse Instance #{i + 1} — R-Value Collision</p>
                              <div className="space-y-1 font-mono">
                                <div className="flex gap-2"><span className="text-muted-foreground w-20 shrink-0">TX 1:</span><span className="truncate">{nr.tx1Hash}</span><CopyButton text={nr.tx1Hash} /></div>
                                <div className="flex gap-2"><span className="text-muted-foreground w-20 shrink-0">TX 2:</span><span className="truncate">{nr.tx2Hash}</span><CopyButton text={nr.tx2Hash} /></div>
                                <div className="flex gap-2"><span className="text-muted-foreground w-20 shrink-0">Shared r:</span><span className="truncate text-red-300">{nr.sharedR}</span><CopyButton text={nr.sharedR} /></div>
                                <div className="flex gap-2"><span className="text-muted-foreground w-20 shrink-0">Derived k:</span><span className="truncate text-orange-300">{nr.derivedK}</span><CopyButton text={nr.derivedK} /></div>
                                <div className="flex gap-2"><span className="text-muted-foreground w-20 shrink-0">Priv key:</span><span className="truncate text-yellow-300">{nr.derivedPrivKey}</span><CopyButton text={nr.derivedPrivKey} /></div>
                              </div>
                              <p className="text-muted-foreground opacity-70">{nr.note}</p>
                            </CardContent>
                          </Card>
                        ))}

                        {/* Weak patterns */}
                        {result.weakPatterns.length > 0 && (
                          <div className="space-y-1">
                            {result.weakPatterns.map((p, i) => (
                              <div key={i} className="text-xs text-yellow-300 bg-yellow-500/8 border border-yellow-500/20 rounded px-3 py-2">
                                ⚠ {p}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          <a href={`https://etherscan.io/address/${result.address}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Etherscan
                          </a>
                          <a href={`https://eth.blockscout.com/address/${result.address}`} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-cyan-400 hover:underline flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> Blockscout
                          </a>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Universal Wallet Scanner Tab ──────────────────────────────────────────────

type AddressFamily = "evm"|"bitcoin"|"solana"|"tron"|"xrp"|"litecoin"|"dogecoin"|"cardano"|"cosmos"|"unknown";

interface ChainActivity {
  chain: string; label: string; symbol: string; chainId?: number;
  active: boolean; isContract: boolean;
  balanceRaw: string; balanceFormatted: string; nativeSymbol: string;
  txCount: number; error?: string;
}
interface ApprovalRecord {
  chain: string; tokenContract: string; tokenName?: string; tokenSymbol?: string;
  spender: string; txHash: string; blockNumber?: number;
}
interface TokenHolding {
  chain: string; name?: string; symbol?: string; type: string; balance: string; contract?: string;
}
interface TransferRecord {
  chain: string; direction: "in"|"out"; tokenSymbol?: string; tokenName?: string;
  amount: string; counterparty: string; txHash?: string; timestamp?: string;
}
interface UniversalWalletScanResult {
  address: string; normalizedAddress: string;
  detectedFamily: AddressFamily; detectedFamilyLabel: string;
  confidence: "definitive"|"high"|"medium"|"low";
  chainsProbed: string[]; activeChains: ChainActivity[]; inactiveChains: ChainActivity[];
  approvals: ApprovalRecord[]; tokenHoldings: TokenHolding[]; recentTransfers: TransferRecord[];
  securityFindings: Array<{ id: string; severity: Severity; title: string; detail: string; chain?: string }>;
  riskScore: number; scanTimeMs: number; scanErrors: string[];
}

const CHAIN_ICONS: Record<string, string> = {
  ethereum: "⟠", polygon: "⬡", bsc: "●", arbitrum: "🔷", optimism: "🔴",
  base: "🔵", avalanche: "🔺", fantom: "👻", zksync: "⚡", linea: "↗",
  "bitcoin-mainnet": "₿", "solana-mainnet": "◎", "tron-mainnet": "♦",
  "xrpl-mainnet": "✕", "cosmos-hub": "⚛",
};

const FAMILY_COLORS: Record<AddressFamily, string> = {
  evm:      "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",
  bitcoin:  "text-orange-400 bg-orange-500/10 border-orange-500/30",
  solana:   "text-purple-400 bg-purple-500/10 border-purple-500/30",
  tron:      "text-red-400 bg-red-500/10 border-red-500/30",
  xrp:      "text-blue-400 bg-blue-500/10 border-blue-500/30",
  litecoin: "text-gray-300 bg-gray-500/10 border-gray-500/30",
  dogecoin: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  cardano:  "text-indigo-400 bg-indigo-500/10 border-indigo-500/30",
  cosmos:   "text-violet-400 bg-violet-500/10 border-violet-500/30",
  unknown:  "text-muted-foreground bg-muted/20 border-border",
};

function formatBalance(val: string, symbol: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return `${val} ${symbol}`;
  if (n === 0) return `0 ${symbol}`;
  if (n >= 1000) return `${n.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`;
  if (n >= 0.01) return `${n.toFixed(4)} ${symbol}`;
  return `${val} ${symbol}`;
}

function shortAddr(addr: string): string {
  if (addr.length <= 14) return addr;
  return `${addr.slice(0, 8)}…${addr.slice(-6)}`;
}

function UniversalWalletScannerTab() {
  const [address, setAddress] = useState("");
  const mutation = useMutation<UniversalWalletScanResult, Error, string>({
    mutationFn: async (addr) => {
      const resp = await fetch(`${BASE}/api/dev-audit/universal-scan`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr }),
      });
      if (!resp.ok) throw new Error((await resp.json() as { error: string }).error);
      return resp.json();
    },
  });
  const { toast } = useToast();
  const r = mutation.data;

  const [showInactive, setShowInactive] = useState(false);
  const [showTransfers, setShowTransfers] = useState(false);
  const [showTokens, setShowTokens] = useState(false);

  return (
    <div className="space-y-6">
      <Alert className="border-cyan-500/30 bg-cyan-500/5">
        <Cpu className="w-4 h-4 text-cyan-400" />
        <AlertDescription className="text-xs">
          <strong>Self-adaptive blockchain detection.</strong> Paste any wallet address — EVM (0x…), Bitcoin, Solana, TRON, XRP, Cardano, Cosmos, Litecoin, Dogecoin.
          The engine auto-identifies the chain family, probes all relevant networks in parallel, and runs the correct real scans automatically. No chain selection required.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="w-5 h-5 text-cyan-400" />Universal Wallet Address Scanner
          </CardTitle>
          <CardDescription>
            Paste any cryptocurrency wallet address. The system detects the blockchain automatically and fires all applicable security scans: balance probes, approval scans, token holdings, transfer history, entropy analysis, and active-chain discovery — all from real live queries.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="0x… / bc1… / 1… / sol… / T… / r… / addr1… / cosmos1…"
              className="font-mono flex-1 text-sm"
              onKeyDown={e => e.key === "Enter" && address.trim() && mutation.mutate(address.trim())}
            />
            <Button
              onClick={() => mutation.mutate(address.trim())}
              disabled={!address.trim() || mutation.isPending}
              className="shrink-0"
            >
              {mutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning…</>
                : <><Search className="w-4 h-4 mr-1.5" />Scan</>}
            </Button>
          </div>
          {mutation.error && (
            <Alert className="border-red-500/40 bg-red-500/5">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <AlertDescription className="text-sm text-red-300">{mutation.error.message}</AlertDescription>
            </Alert>
          )}
          {mutation.isPending && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Detecting chain family, probing all networks in parallel…
              </div>
              <div className="grid grid-cols-5 gap-1.5">
                {["ETH","POL","BSC","ARB","OPT","BASE","AVAX","FTM","ZK","LINEA"].map(c => (
                  <div key={c} className="h-1.5 rounded-full bg-cyan-500/30 animate-pulse" style={{ animationDelay: `${Math.random()*400}ms` }} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {r && (
        <div className="space-y-5">

          {/* ── Detection header ── */}
          <div className="flex flex-wrap items-start gap-3">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-semibold ${FAMILY_COLORS[r.detectedFamily]}`}>
              <CircleDot className="w-3.5 h-3.5" />
              {r.detectedFamilyLabel}
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-muted/20 text-xs text-muted-foreground">
              Confidence: <span className="text-foreground font-semibold">{r.confidence}</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-muted/20 text-xs text-muted-foreground">
              {r.chainsProbed.length} chain{r.chainsProbed.length !== 1 ? "s" : ""} probed in {(r.scanTimeMs / 1000).toFixed(1)}s
            </div>
            {r.scanErrors.length > 0 && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-yellow-500/30 bg-yellow-500/8 text-xs text-yellow-300">
                {r.scanErrors.length} probe error{r.scanErrors.length !== 1 ? "s" : ""}
              </div>
            )}
          </div>

          {/* ── Summary stats ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Active Chains",   value: r.activeChains.length,   color: r.activeChains.length > 0 ? "text-green-400" : "text-muted-foreground" },
              { label: "Total Txns",      value: r.activeChains.reduce((s, c) => s + c.txCount, 0).toLocaleString(), color: "text-foreground" },
              { label: "Standing Approvals", value: r.approvals.length,  color: r.approvals.length > 0 ? "text-red-400" : "text-green-400" },
              { label: "Risk Score",      value: `${r.riskScore}/100`,   color: r.riskScore >= 60 ? "text-red-400" : r.riskScore >= 30 ? "text-yellow-400" : "text-green-400" },
            ].map(({ label, value, color }) => (
              <Card key={label}><CardContent className="pt-4 pb-3">
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
              </CardContent></Card>
            ))}
          </div>

          {/* ── Active chains ── */}
          {r.activeChains.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Activity className="w-4 h-4 text-green-400" />
                Active Networks ({r.activeChains.length})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {r.activeChains.map(c => (
                  <div key={c.chain} className="flex items-center gap-3 rounded-lg border border-green-500/20 bg-green-500/5 p-3">
                    <span className="text-lg w-7 text-center">{CHAIN_ICONS[c.chain] ?? "◆"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold">{c.label}</span>
                        {c.isContract && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">CONTRACT</span>
                        )}
                        {c.chainId && (
                          <span className="text-xs text-muted-foreground">chain {c.chainId}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs font-mono text-green-300">{formatBalance(c.balanceFormatted, c.symbol)}</span>
                        <span className="text-xs text-muted-foreground">{c.txCount.toLocaleString()} txns</span>
                      </div>
                    </div>
                    <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Security findings ── */}
          {r.securityFindings.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-orange-400" />
                Security Findings
              </p>
              {r.securityFindings.map(f => (
                <div key={f.id} className={`rounded-lg border p-3 space-y-1 ${sevColor(f.severity)}`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {sevBadge(f.severity)}
                    <span className="text-xs font-semibold">{f.title}</span>
                    {f.chain && <span className="text-xs text-muted-foreground">({f.chain})</span>}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{f.detail}</p>
                </div>
              ))}
            </div>
          )}

          {/* ── Standing approvals ── */}
          {r.approvals.length > 0 && (
            <Card className="border-red-500/30 bg-red-500/5">
              <CardHeader className="pb-2 pt-4">
                <CardTitle className="text-sm flex items-center gap-2 text-red-300">
                  <ShieldX className="w-4 h-4" />
                  Standing ERC-20 Approvals — {r.approvals.length} found
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 space-y-2">
                <p className="text-xs text-muted-foreground">Each approval below is a standing permission for a spender contract to drain tokens without further user confirmation. Revoke unused approvals at <strong>revoke.cash</strong>.</p>
                <ScrollArea className="h-48">
                  <div className="space-y-1.5">
                    {r.approvals.map((a, i) => (
                      <div key={i} className="rounded border border-red-500/20 bg-card p-2 text-xs space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-red-300 font-semibold">{CHAIN_ICONS[a.chain] ?? "◆"} {a.chain}</span>
                          {a.tokenSymbol && <span className="font-mono text-orange-300">{a.tokenSymbol}</span>}
                        </div>
                        <p className="font-mono text-muted-foreground">Token: {shortAddr(a.tokenContract)}</p>
                        <p className="font-mono text-muted-foreground">Spender: <span className="text-red-300">{shortAddr(a.spender.replace(/^0x000000000000000000000000/, "0x"))}</span></p>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Block {a.blockNumber?.toLocaleString()}</span>
                          <CopyButton text={a.txHash} />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* ── Token holdings ── */}
          {r.tokenHoldings.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4">
                <button className="flex items-center justify-between w-full" onClick={() => setShowTokens(v => !v)}>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Coins className="w-4 h-4 text-yellow-400" />
                    Token Holdings ({r.tokenHoldings.length})
                  </CardTitle>
                  {showTokens ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
              </CardHeader>
              {showTokens && (
                <CardContent className="pb-4">
                  <ScrollArea className="h-64">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                      {r.tokenHoldings.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 rounded border border-border/40 bg-card/60 px-3 py-2">
                          <span className="text-sm">{CHAIN_ICONS[t.chain] ?? "◆"}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold truncate">{t.name ?? "Unknown Token"}</p>
                            <p className="text-xs text-muted-foreground font-mono">{t.symbol} · {t.type}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              )}
            </Card>
          )}

          {/* ── Transfer history ── */}
          {r.recentTransfers.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4">
                <button className="flex items-center justify-between w-full" onClick={() => setShowTransfers(v => !v)}>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-blue-400" />
                    Recent Transfers ({r.recentTransfers.length})
                  </CardTitle>
                  {showTransfers ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
              </CardHeader>
              {showTransfers && (
                <CardContent className="pb-4">
                  <ScrollArea className="h-64">
                    <div className="space-y-1.5">
                      {r.recentTransfers.map((t, i) => (
                        <div key={i} className={`flex items-center gap-3 rounded border px-3 py-2 text-xs ${t.direction === "in" ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"}`}>
                          {t.direction === "in"
                            ? <ArrowDownLeft className="w-3.5 h-3.5 text-green-400 shrink-0" />
                            : <ArrowUpRight className="w-3.5 h-3.5 text-red-400 shrink-0" />}
                          <span className="text-sm">{CHAIN_ICONS[t.chain] ?? "◆"}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`font-semibold ${t.direction === "in" ? "text-green-300" : "text-red-300"}`}>
                                {t.direction === "in" ? "+" : "-"}{t.amount} {t.tokenSymbol ?? ""}
                              </span>
                            </div>
                            <p className="text-muted-foreground font-mono truncate">
                              {t.direction === "in" ? "from" : "to"}: {shortAddr(t.counterparty)}
                            </p>
                          </div>
                          {t.timestamp && (
                            <span className="text-muted-foreground shrink-0 text-right">
                              {new Date(t.timestamp).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              )}
            </Card>
          )}

          {/* ── Inactive chains toggle ── */}
          {r.inactiveChains.length > 0 && (
            <div>
              <button
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowInactive(v => !v)}
              >
                {showInactive ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                {r.inactiveChains.length} inactive / undeployed chain{r.inactiveChains.length !== 1 ? "s" : ""}
              </button>
              {showInactive && (
                <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-1.5">
                  {r.inactiveChains.map(c => (
                    <div key={c.chain} className="flex items-center gap-2 rounded border border-border/30 bg-muted/20 px-3 py-2 text-xs">
                      <span>{CHAIN_ICONS[c.chain] ?? "◆"}</span>
                      <span className="text-muted-foreground">{c.label}</span>
                      {c.error && <AlertTriangle className="w-3 h-3 text-yellow-400 ml-auto" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {r.scanErrors.length > 0 && (
            <div className="space-y-1">
              {r.scanErrors.map((e, i) => (
                <p key={i} className="text-xs text-yellow-400/70">{e}</p>
              ))}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

// ── Nonce Audit Tab ───────────────────────────────────────────────────────────

interface NonceTxRecord { hash: string; nonce: number; blockNumber: number | null; value: string; }
interface NonceFinding  { severity: string; check: string; title: string; detail: string; evidence: string; }
interface NonceResult {
  address: string; confirmedNonce: number; pendingNonce: number; txsAnalyzed: number;
  pendingTxs: NonceTxRecord[]; nonceGaps: number[]; preEip155Txs: string[];
  nonceCollisions: Array<{ nonce: number; txHashes: string[] }>;
  findings: NonceFinding[]; riskScore: number; scanTimeMs: number;
}
interface NonceBatchResult { results: NonceResult[]; scanned: number; scanTimeMs: number; }

const NONCE_SEV: Record<string, string> = {
  critical: "bg-red-500/15 border-red-500/40 text-red-300",
  high:     "bg-orange-500/15 border-orange-500/40 text-orange-300",
  medium:   "bg-yellow-500/15 border-yellow-500/40 text-yellow-300",
  low:      "bg-blue-500/15 border-blue-500/40 text-blue-300",
  info:     "bg-muted/50 border-border text-muted-foreground",
};

const DEFAULT_NONCE_ADDRS = [
  "0x0d5c41c609fe1ec073c3b4fa10949d602ed059bb",
  "0xb98e8eefba0f7476b85cd9716cb5b38a935aa872",
  "0xb01fed2f701695992a4f7ffdb53f3af099e140d7",
  "0xf70da97812cb96acdf810712aa562db8dfa3dbef",
  "0xc600d76b5bfe058d6e52d2c08ceba6c85774f9b6",
  "0xbcd263db9c9ed9215bcb07897f9da582129dd7da",
  "0xea7fc58e112fb3607d8a7694e1f71c6894c72d3c",
  "0xacd1f4e274d1a4bb686a41549a90253cf152dd6d",
  "0xe205e85068704ecf1c3c55b76bcb466ff0798526",
  "0x9b9fd485e94c73af3bc8b9a630c4de7203bc96cb",
  "0x610e10ed49f57591abe16d919b6d15aaf4557237",
  "0xa5cc3e44ed97f8c94df27822c85303a3bd4e8134",
  "0x7aebc630f301f15baddf160103dc3bd8f9baf043",
  "0x487663784c77ba56e32d9fe60485d93c4c319385",
].join("\n");

function NonceAuditTab() {
  const [input, setInput]     = useState(DEFAULT_NONCE_ADDRS);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { toast } = useToast();

  const mutation = useMutation<NonceBatchResult, Error, string[]>({
    mutationFn: (addresses) =>
      fetch(`${BASE}/api/dev-audit/nonce-scan`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses }),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
  });

  const run = () => {
    const addrs = input.split(/[\n,\s]+/).map(a => a.trim()).filter(a => /^0x[0-9a-fA-F]{40}$/.test(a));
    if (!addrs.length) { toast({ title: "No valid EVM addresses", variant: "destructive" }); return; }
    if (addrs.length > 20) { toast({ title: "Max 20 addresses", variant: "destructive" }); return; }
    mutation.mutate(addrs);
  };

  const data = mutation.data;
  const totalFindings  = data?.results.flatMap(r => r.findings.filter(f => f.severity !== "info")).length ?? 0;
  const criticalCount  = data?.results.flatMap(r => r.findings).filter(f => f.severity === "critical").length ?? 0;
  const preEip155Count = data?.results.reduce((n, r) => n + r.preEip155Txs.length, 0) ?? 0;
  const gapCount       = data?.results.reduce((n, r) => n + r.nonceGaps.length, 0) ?? 0;

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ArrowDownLeft className="w-5 h-5 text-cyan-400" />Transaction Nonce Audit
          </CardTitle>
          <CardDescription className="text-xs space-y-1">
            <span className="block">Five on-chain nonce checks per address — all real Ethereum mainnet data:</span>
            <span className="block text-orange-300 font-medium">① Nonce gap detection (stuck txs, front-run windows)</span>
            <span className="block text-red-300 font-medium">② Pending mempool collision (double-spend / cancel conflicts)</span>
            <span className="block text-yellow-300 font-medium">③ Cross-chain replay risk (pre-EIP155 signatures v=27/28)</span>
            <span className="block text-blue-300 font-medium">④ Nonce sequence integrity (on-chain history verification)</span>
            <span className="block text-purple-300 font-medium">⑤ Front-run window size (pending queue depth analysis)</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            placeholder="0x... one address per line, up to 20"
            value={input} onChange={e => setInput(e.target.value)}
            className="font-mono text-xs min-h-[120px] bg-background"
          />
          <div className="flex items-center gap-3">
            <Button onClick={run} disabled={mutation.isPending} className="gap-2 bg-cyan-700 hover:bg-cyan-800">
              {mutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />Scanning nonces…</>
                : <><ArrowDownLeft className="w-4 h-4" />Run Nonce Audit</>}
            </Button>
            {data && <span className="text-xs text-muted-foreground">{data.scanned} addresses — {data.scanTimeMs}ms</span>}
          </div>
          {mutation.isError && (
            <Alert className="border-red-500/40 bg-red-500/8">
              <AlertDescription className="text-xs text-red-400">{mutation.error.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {data && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Addresses",     value: data.scanned,    color: "text-foreground" },
              { label: "Critical",      value: criticalCount,   color: criticalCount > 0 ? "text-red-400" : "text-green-400" },
              { label: "Nonce Gaps",    value: gapCount,        color: gapCount > 0 ? "text-orange-400" : "text-green-400" },
              { label: "Pre-EIP155",    value: preEip155Count,  color: preEip155Count > 0 ? "text-orange-400" : "text-green-400" },
            ].map(({ label, value, color }) => (
              <Card key={label} className="border-border/50">
                <CardContent className="pt-3 pb-2 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {data.results.map(r => {
            const open = expanded === r.address;
            const worst = r.findings.find(f => f.severity !== "info")?.severity ?? "info";
            const bc = worst === "critical" ? "border-red-500/50 bg-red-500/5" : worst === "high" ? "border-orange-500/30" : worst === "medium" ? "border-yellow-500/20" : "";
            return (
              <Card key={r.address} className={`border-border/50 cursor-pointer hover:border-border transition-colors ${bc}`}
                onClick={() => setExpanded(open ? null : r.address)}>
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {r.riskScore >= 50 ? <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                        : r.riskScore >= 20 ? <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
                        : <ShieldCheck className="w-4 h-4 text-green-400 shrink-0" />}
                      <span className="font-mono text-xs truncate">{r.address}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      <span className="text-xs text-muted-foreground">nonce {r.confirmedNonce}</span>
                      {r.nonceGaps.length > 0 && <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">{r.nonceGaps.length} GAP{r.nonceGaps.length > 1 ? "S" : ""}</Badge>}
                      {r.preEip155Txs.length > 0 && <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">PRE-EIP155</Badge>}
                      {r.pendingNonce > r.confirmedNonce && <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-xs">{r.pendingNonce - r.confirmedNonce} PENDING</Badge>}
                      {r.riskScore === 0 && <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">CLEAN</Badge>}
                      <span className={`text-sm font-bold ${r.riskScore >= 50 ? "text-red-400" : r.riskScore >= 20 ? "text-yellow-400" : "text-green-400"}`}>{r.riskScore}/100</span>
                      {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                  </div>
                  {open && (
                    <div className="mt-4 space-y-3" onClick={e => e.stopPropagation()}>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="bg-muted/30 rounded p-2"><p className="font-bold">{r.confirmedNonce}</p><p className="text-muted-foreground">Confirmed Nonce</p></div>
                        <div className="bg-muted/30 rounded p-2"><p className="font-bold">{r.pendingNonce}</p><p className="text-muted-foreground">Pending Nonce</p></div>
                        <div className="bg-muted/30 rounded p-2"><p className="font-bold">{r.txsAnalyzed}</p><p className="text-muted-foreground">Txs Analyzed</p></div>
                      </div>
                      {r.nonceGaps.length > 0 && (
                        <div className="text-xs bg-orange-500/8 border border-orange-500/20 rounded p-2">
                          <p className="font-bold text-orange-300 mb-1">Missing nonces: {r.nonceGaps.slice(0,15).join(", ")}{r.nonceGaps.length > 15 ? "…" : ""}</p>
                        </div>
                      )}
                      {r.preEip155Txs.length > 0 && (
                        <div className="text-xs bg-red-500/8 border border-red-500/20 rounded p-2">
                          <p className="font-bold text-red-300 mb-1">Pre-EIP155 (v=27/28) transactions:</p>
                          {r.preEip155Txs.slice(0,5).map(h => (
                            <a key={h} href={`https://etherscan.io/tx/${h}`} target="_blank" rel="noopener noreferrer"
                              className="block font-mono text-red-200 hover:underline truncate">{h}</a>
                          ))}
                        </div>
                      )}
                      <div className="space-y-2">
                        {r.findings.map((f, i) => (
                          <div key={i} className={`rounded p-3 border text-xs ${NONCE_SEV[f.severity] ?? NONCE_SEV["info"]}`}>
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${NONCE_SEV[f.severity] ?? ""}`}>{f.severity.toUpperCase()}</span>
                              <span className="font-semibold">{f.check}</span>
                              <span className="opacity-70 truncate">{f.title}</span>
                            </div>
                            <p className="opacity-80">{f.detail}</p>
                            {f.evidence && <p className="font-mono text-xs opacity-60 mt-1 break-all">{f.evidence}</p>}
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 pt-1 text-xs text-muted-foreground">
                        <span>Scan: {r.scanTimeMs}ms</span>
                        <a href={`https://etherscan.io/address/${r.address}`} target="_blank" rel="noopener noreferrer"
                          className="text-cyan-400 hover:underline flex items-center gap-1 ml-2"><ExternalLink className="w-3 h-3" /> Etherscan</a>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── RPC Injection Fuzzer Tab ──────────────────────────────────────────────────

interface RpcFinding { severity: string; title: string; detail: string; evidence: string; }
interface RpcProbeResult {
  probe: { id: string; vector: string; method: string; description: string };
  statusCode: number | null; responseMs: number; raw: string;
  error: string | null; finding: RpcFinding | null;
}
interface RpcFuzzResult {
  endpoint: string; probesRun: number; findings: RpcFinding[];
  probeResults: RpcProbeResult[]; riskScore: number; scanTimeMs: number;
}

const FUZZ_SEV: Record<string, string> = {
  critical: "bg-red-500/15 border-red-500/40 text-red-300",
  high:     "bg-orange-500/15 border-orange-500/40 text-orange-300",
  medium:   "bg-yellow-500/15 border-yellow-500/40 text-yellow-300",
  low:      "bg-blue-500/15 border-blue-500/40 text-blue-300",
  info:     "bg-muted/50 border-border text-muted-foreground",
};

const PRESET_ENDPOINTS = [
  { label: "Ethereum Mainnet (publicnode)", url: "https://ethereum.publicnode.com" },
  { label: "Ethereum Mainnet (cloudflare)", url: "https://cloudflare-eth.com" },
  { label: "Polygon Mainnet",              url: "https://polygon-bor.publicnode.com" },
  { label: "BSC Mainnet",                  url: "https://bsc.publicnode.com" },
  { label: "Arbitrum One",                 url: "https://arbitrum-one.publicnode.com" },
  { label: "Optimism",                     url: "https://optimism.publicnode.com" },
];

const ALL_VECTORS = ["admin", "injection", "batch", "info"] as const;
type FuzzVector = (typeof ALL_VECTORS)[number];
const VECTOR_LABELS: Record<FuzzVector, string> = {
  admin:     "Admin Methods (20 probes)",
  injection: "Parameter Injection (17 probes)",
  batch:     "Batch Abuse (1 probe)",
  info:      "Info Leakage (10 probes)",
};

function RpcFuzzTab() {
  const [endpoint, setEndpoint] = useState("https://ethereum.publicnode.com");
  const [vectors,  setVectors]  = useState<FuzzVector[]>([...ALL_VECTORS]);
  const [showRaw,  setShowRaw]  = useState(false);
  const { toast } = useToast();

  const mutation = useMutation<RpcFuzzResult, Error, { endpoint: string; vectors: string[] }>({
    mutationFn: (body) =>
      fetch(`${BASE}/api/dev-audit/rpc-fuzz`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
  });

  const toggleVector = (v: FuzzVector) =>
    setVectors(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]);

  const run = () => {
    if (!endpoint.trim()) { toast({ title: "Endpoint required", variant: "destructive" }); return; }
    if (!vectors.length)  { toast({ title: "Select at least one attack vector", variant: "destructive" }); return; }
    mutation.mutate({ endpoint: endpoint.trim(), vectors });
  };

  const data = mutation.data;
  const criticalFindings = data?.findings.filter(f => f.severity === "critical") ?? [];
  const highFindings     = data?.findings.filter(f => f.severity === "high")     ?? [];

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="w-5 h-5 text-red-400" />JSON-RPC Injection Fuzzer
          </CardTitle>
          <CardDescription className="text-xs space-y-1">
            <span className="block">The blockchain equivalent of SQLmap — real probe injection against live JSON-RPC nodes.</span>
            <span className="block text-red-300 font-medium">48 attack probes across 4 vectors: admin method exposure, parameter injection, batch DoS, info leakage</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Target Endpoint</p>
            <Input value={endpoint} onChange={e => setEndpoint(e.target.value)}
              placeholder="https://your-node.example.com" className="font-mono text-xs" />
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_ENDPOINTS.map(p => (
              <Button key={p.url} size="sm" variant={endpoint === p.url ? "default" : "outline"}
                className="text-xs h-7" onClick={() => setEndpoint(p.url)}>{p.label}</Button>
            ))}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Attack Vectors</p>
            <div className="flex flex-wrap gap-2">
              {ALL_VECTORS.map(v => (
                <button key={v} onClick={() => toggleVector(v)}
                  className={`text-xs px-3 py-1 rounded border transition-colors ${vectors.includes(v) ? "bg-red-500/20 border-red-500/40 text-red-300" : "bg-muted/30 border-border text-muted-foreground"}`}>
                  {VECTOR_LABELS[v]}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button onClick={run} disabled={mutation.isPending} className="gap-2 bg-red-700 hover:bg-red-800">
              {mutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" />Fuzzing node…</>
                : <><Target className="w-4 h-4" />Launch Fuzz Attack</>}
            </Button>
            {data && <span className="text-xs text-muted-foreground">{data.probesRun} probes in {data.scanTimeMs}ms</span>}
          </div>
          {mutation.isError && (
            <Alert className="border-red-500/40 bg-red-500/8">
              <AlertDescription className="text-xs text-red-400">{mutation.error.message}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {data && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Probes Run",      value: data.probesRun,                             color: "text-foreground" },
              { label: "Risk Score",      value: data.riskScore + "/100",                    color: data.riskScore >= 50 ? "text-red-400" : data.riskScore >= 25 ? "text-orange-400" : "text-green-400" },
              { label: "Critical",        value: criticalFindings.length,                    color: criticalFindings.length > 0 ? "text-red-400" : "text-green-400" },
              { label: "High",            value: highFindings.length,                        color: highFindings.length > 0 ? "text-orange-400" : "text-green-400" },
            ].map(({ label, value, color }) => (
              <Card key={label} className="border-border/50">
                <CardContent className="pt-3 pb-2 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {data.findings.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-red-400">{data.findings.length} Finding{data.findings.length !== 1 ? "s" : ""} — {data.endpoint}</p>
              {data.findings.map((f, i) => (
                <div key={i} className={`rounded p-3 border text-xs ${FUZZ_SEV[f.severity] ?? FUZZ_SEV["info"]}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${FUZZ_SEV[f.severity] ?? ""}`}>{f.severity.toUpperCase()}</span>
                    <span className="font-semibold">{f.title}</span>
                  </div>
                  <p className="opacity-80 mb-1">{f.detail}</p>
                  {f.evidence && <p className="font-mono text-xs opacity-50 break-all mt-1">Evidence: {f.evidence.slice(0, 300)}</p>}
                </div>
              ))}
            </div>
          ) : (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="py-4 text-center">
                <ShieldCheck className="w-8 h-8 text-green-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-green-400">No vulnerabilities found</p>
                <p className="text-xs text-muted-foreground mt-1">{data.probesRun} probes returned no exploitable findings on {data.endpoint}</p>
              </CardContent>
            </Card>
          )}

          {showRaw && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">All Probe Results ({data.probeResults.length})</p>
              {data.probeResults.map((pr, i) => (
                <div key={i} className="bg-muted/20 rounded border border-border/40 p-2 text-xs font-mono">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs ${pr.finding ? (FUZZ_SEV[pr.finding.severity]?.split(" ")[2] ?? "") : "text-muted-foreground"}`}>
                      {pr.finding ? `[${pr.finding.severity.toUpperCase()}]` : "[ OK ]"}
                    </span>
                    <span>{pr.probe.method}</span>
                    <span className="text-muted-foreground ml-auto">{pr.responseMs}ms</span>
                    {pr.error && <span className="text-red-400">{pr.error}</span>}
                  </div>
                  {pr.raw && <p className="text-muted-foreground truncate">{pr.raw.slice(0, 120)}</p>}
                </div>
              ))}
            </div>
          )}
          <Button size="sm" variant="outline" className="text-xs" onClick={() => setShowRaw(v => !v)}>
            {showRaw ? "Hide" : "Show"} all {data.probeResults.length} probe results
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Exploit Engines Tab ───────────────────────────────────────────────────────

const EXPLOIT_ENDPOINTS = [
  { label: "Ethereum (publicnode)", url: "https://ethereum.publicnode.com" },
  { label: "Ethereum (cloudflare)", url: "https://cloudflare-eth.com" },
  { label: "Polygon",               url: "https://polygon-bor.publicnode.com" },
  { label: "BSC",                   url: "https://bsc.publicnode.com" },
  { label: "Arbitrum One",          url: "https://arbitrum-one.publicnode.com" },
  { label: "Optimism",              url: "https://optimism.publicnode.com" },
];

function SevBadge({ sev }: { sev: string }) {
  const c = sev === "critical" ? "bg-red-500/20 text-red-300 border-red-500/30"
           : sev === "high"    ? "bg-orange-500/20 text-orange-300 border-orange-500/30"
           : sev === "medium"  ? "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
           : sev === "low"     ? "bg-blue-500/20 text-blue-300 border-blue-500/30"
           : sev === "pass"    ? "bg-green-500/20 text-green-300 border-green-500/30"
           : "bg-muted/50 text-muted-foreground border-border";
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold border ${c}`}>{sev.toUpperCase()}</span>;
}

function RiskMeter({ score }: { score: number }) {
  const color = score >= 70 ? "bg-red-500" : score >= 40 ? "bg-orange-500" : score >= 20 ? "bg-yellow-500" : "bg-green-500";
  const label = score >= 70 ? "CRITICAL" : score >= 40 ? "HIGH" : score >= 20 ? "MEDIUM" : "LOW";
  const lc    = score >= 70 ? "text-red-400" : score >= 40 ? "text-orange-400" : score >= 20 ? "text-yellow-400" : "text-green-400";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-sm font-bold w-20 text-right ${lc}`}>{score}/100 {label}</span>
    </div>
  );
}

// ── Engine 1: Mempool Surveillance ────────────────────────────────────────────

interface MempoolTx {
  hash?: string; sender: string; senderLabel: string; to: string; toLabel: string;
  nonce: number; value: string; gasPrice: string; gas: number; input: string;
  callSelector: string; decoded: { name: string; type: string; risk: string } | null;
  isFrontRunnable: boolean; isHighValue: boolean; isMultisig: boolean;
}
interface MempoolSnapshot {
  timestamp: number; endpoint: string;
  pendingCount: number; queuedCount: number;
  frontRunnableCount: number; highValueCount: number; multisigCount: number;
  sampleTxs: MempoolTx[];
  topSenders: Array<{ address: string; label: string; txCount: number; totalValueEth: number }>;
  gasPriceStats: { min: number; max: number; median: number; mean: number };
}

function MempoolEngine({ endpoint }: { endpoint: string }) {
  const [streaming, setStreaming]     = useState(false);
  const [snapshots, setSnapshots]     = useState<MempoolSnapshot[]>([]);
  const [status, setStatus]           = useState<string>("");
  const [filter, setFilter]           = useState<"all" | "frontrun" | "highvalue" | "multisig">("all");
  const esRef = useRef<EventSource | null>(null);

  const start = useCallback(() => {
    if (esRef.current) { esRef.current.close(); }
    setSnapshots([]); setStreaming(true); setStatus("Connecting…");
    const url = `${BASE}/api/dev-audit/exploit/mempool-stream?endpoint=${encodeURIComponent(endpoint)}`;
    const es = new EventSource(url);
    esRef.current = es;
    es.addEventListener("status",   e => setStatus((JSON.parse(e.data) as { message: string }).message));
    es.addEventListener("snapshot", e => {
      const snap = JSON.parse(e.data) as MempoolSnapshot;
      setSnapshots(prev => [snap, ...prev].slice(0, 25));
      setStatus(`Live — last update ${new Date(snap.timestamp).toLocaleTimeString()}`);
    });
    es.addEventListener("error",    e => setStatus(`Error: ${ (JSON.parse((e as MessageEvent).data || "{}") as { message?: string }).message ?? "stream error"}`));
    es.addEventListener("done",     () => { setStreaming(false); setStatus("Stream completed (90s window)"); es.close(); });
    es.onerror = () => { setStreaming(false); setStatus("Connection lost"); es.close(); };
  }, [endpoint]);

  const stop = () => { esRef.current?.close(); setStreaming(false); setStatus("Stopped"); };
  useEffect(() => () => { esRef.current?.close(); }, []);

  const latest = snapshots[0];
  const txs = (latest?.sampleTxs ?? []).filter(t =>
    filter === "frontrun"  ? t.isFrontRunnable :
    filter === "highvalue" ? t.isHighValue :
    filter === "multisig"  ? t.isMultisig : true,
  );

  const RISK_COLORS: Record<string, string> = {
    frontrun: "text-orange-300", critical: "text-red-300", monitor: "text-blue-300",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button onClick={streaming ? stop : start}
          className={`gap-2 ${streaming ? "bg-red-700 hover:bg-red-800" : "bg-green-700 hover:bg-green-800"}`}>
          {streaming ? <><Square className="w-4 h-4" />Stop Stream</> : <><Play className="w-4 h-4" />Start Live Feed</>}
        </Button>
        {streaming && <span className="flex items-center gap-1.5 text-xs text-green-400"><CircleDot className="w-3 h-3 animate-pulse" />LIVE</span>}
        <span className="text-xs text-muted-foreground">{status}</span>
      </div>

      {latest && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {[
              { label: "Pending",     value: latest.pendingCount.toLocaleString(),      color: "text-foreground" },
              { label: "Queued",      value: latest.queuedCount.toLocaleString(),       color: "text-foreground" },
              { label: "Front-Run ⚡", value: latest.frontRunnableCount.toLocaleString(), color: latest.frontRunnableCount > 0 ? "text-orange-400" : "text-green-400" },
              { label: "High Value",  value: latest.highValueCount.toLocaleString(),    color: latest.highValueCount > 0 ? "text-yellow-400" : "text-green-400" },
              { label: "Multisig",    value: latest.multisigCount.toLocaleString(),     color: latest.multisigCount > 0 ? "text-red-400" : "text-green-400" },
            ].map(({ label, value, color }) => (
              <Card key={label} className="border-border/50">
                <CardContent className="py-2 text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            <div className="bg-muted/20 rounded border border-border/40 p-2">
              <p className="text-muted-foreground">Gas Min</p>
              <p className="font-mono font-bold">{latest.gasPriceStats.min.toFixed(2)} Gwei</p>
            </div>
            <div className="bg-muted/20 rounded border border-border/40 p-2">
              <p className="text-muted-foreground">Gas Median</p>
              <p className="font-mono font-bold">{latest.gasPriceStats.median.toFixed(2)} Gwei</p>
            </div>
            <div className="bg-muted/20 rounded border border-border/40 p-2">
              <p className="text-muted-foreground">Gas Mean</p>
              <p className="font-mono font-bold">{latest.gasPriceStats.mean.toFixed(2)} Gwei</p>
            </div>
            <div className="bg-muted/20 rounded border border-border/40 p-2">
              <p className="text-muted-foreground">Gas Max</p>
              <p className="font-mono font-bold">{latest.gasPriceStats.max.toFixed(2)} Gwei</p>
            </div>
          </div>

          {/* top senders */}
          {latest.topSenders.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Top Senders by Tx Count</p>
              <div className="space-y-1">
                {latest.topSenders.slice(0, 6).map(s => (
                  <div key={s.address} className="flex items-center gap-2 text-xs bg-muted/20 rounded px-2 py-1">
                    <span className="font-mono text-cyan-300 truncate flex-1">{s.address}</span>
                    <span className="text-muted-foreground shrink-0">{s.label !== s.address ? s.label : ""}</span>
                    <Badge className="bg-muted/50 text-foreground border-border text-xs shrink-0">{s.txCount} txs</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* tx filter */}
          <div className="flex gap-1.5 flex-wrap">
            {(["all","frontrun","highvalue","multisig"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${filter === f ? "bg-orange-500/20 border-orange-500/40 text-orange-300" : "bg-muted/30 border-border text-muted-foreground"}`}>
                {f === "all" ? `All (${latest.sampleTxs.length})` : f === "frontrun" ? `⚡ Front-Run (${latest.frontRunnableCount})` : f === "highvalue" ? `💰 High Value (${latest.highValueCount})` : `🔴 Multisig (${latest.multisigCount})`}
              </button>
            ))}
          </div>

          <ScrollArea className="h-72">
            <div className="space-y-1 pr-2">
              {txs.slice(0, 30).map((tx, i) => (
                <div key={i} className={`rounded border p-2 text-xs ${
                  tx.isMultisig    ? "border-red-500/30 bg-red-500/5" :
                  tx.isFrontRunnable ? "border-orange-500/30 bg-orange-500/5" :
                  tx.isHighValue   ? "border-yellow-500/30 bg-yellow-500/5" :
                  "border-border/40 bg-muted/10"
                }`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    {tx.decoded && <span className={`font-semibold ${RISK_COLORS[tx.decoded.risk] ?? "text-foreground"}`}>{tx.decoded.type}</span>}
                    <span className="font-mono text-muted-foreground">{tx.senderLabel}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="font-mono text-cyan-300">{tx.toLabel}</span>
                    <span className="ml-auto font-bold">{tx.value}</span>
                    <span className="text-muted-foreground">{tx.gasPrice}</span>
                  </div>
                  {tx.decoded && (
                    <p className="text-muted-foreground mt-0.5 truncate">{tx.decoded.name}</p>
                  )}
                  {tx.hash && (
                    <a href={`https://etherscan.io/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer"
                      className="font-mono text-xs text-blue-400 hover:underline truncate block mt-0.5">{tx.hash}</a>
                  )}
                </div>
              ))}
              {txs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No transactions match this filter</p>}
            </div>
          </ScrollArea>
          <p className="text-xs text-muted-foreground">{snapshots.length} snapshots collected — showing top 50 txs by gas price</p>
        </>
      )}
      {!latest && !streaming && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Eye className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>Click Start Live Feed to begin real-time mempool surveillance</p>
          <p className="text-xs mt-1">Streams live pending transactions every 4 seconds for 90 seconds</p>
        </div>
      )}
    </div>
  );
}

// ── Engine 2: Admin Method Scanner ────────────────────────────────────────────

interface AdminProbeResult {
  method: string; category: string; severity: string; exposed: boolean;
  ms: number; result: unknown; errorMessage: string | null;
  attackVector: string; impact: string;
}
interface AdminScanResult {
  endpoint: string; probesRun: number;
  criticalExposed: AdminProbeResult[]; highExposed: AdminProbeResult[];
  mediumExposed: AdminProbeResult[]; infoExposed: AdminProbeResult[];
  blocked: AdminProbeResult[];
  riskScore: number; scanTimeMs: number; summary: string;
}

function AdminScanEngine({ endpoint }: { endpoint: string }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const mutation = useMutation<AdminScanResult, Error, string>({
    mutationFn: (ep) => fetch(`${BASE}/api/dev-audit/exploit/admin-scan`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: ep }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
  });

  const data = mutation.data;
  const allExposed = data ? [
    ...data.criticalExposed, ...data.highExposed,
    ...data.mediumExposed, ...data.infoExposed,
  ] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button onClick={() => mutation.mutate(endpoint)} disabled={mutation.isPending}
          className="gap-2 bg-red-800 hover:bg-red-900">
          {mutation.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" />Probing {data ? "" : "40+"} methods…</>
            : <><Terminal className="w-4 h-4" />Scan All Admin Methods</>}
        </Button>
        {data && <span className="text-xs text-muted-foreground">{data.probesRun} probes in {data.scanTimeMs}ms</span>}
      </div>
      {mutation.isError && <Alert className="border-red-500/40 bg-red-500/8"><AlertDescription className="text-xs text-red-400">{mutation.error.message}</AlertDescription></Alert>}

      {data && (
        <div className="space-y-4">
          <RiskMeter score={data.riskScore} />
          <p className={`text-sm font-semibold ${data.criticalExposed.length > 0 ? "text-red-400" : data.highExposed.length > 0 ? "text-orange-400" : "text-green-400"}`}>{data.summary}</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: "Critical",  value: data.criticalExposed.length, color: data.criticalExposed.length > 0 ? "text-red-400" : "text-green-400" },
              { label: "High",      value: data.highExposed.length,     color: data.highExposed.length > 0 ? "text-orange-400" : "text-green-400" },
              { label: "Medium",    value: data.mediumExposed.length,   color: data.mediumExposed.length > 0 ? "text-yellow-400" : "text-green-400" },
              { label: "Blocked",   value: data.blocked.length,         color: "text-green-400" },
            ].map(({ label, value, color }) => (
              <Card key={label} className="border-border/50">
                <CardContent className="py-2 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {allExposed.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-red-400">{allExposed.length} METHOD{allExposed.length !== 1 ? "S" : ""} EXPOSED</p>
              {allExposed.map(r => {
                const open = expanded === r.method;
                return (
                  <div key={r.method}
                    className={`rounded border cursor-pointer transition-colors ${
                      r.severity === "critical" ? "border-red-500/50 bg-red-500/8 hover:bg-red-500/12" :
                      r.severity === "high"     ? "border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/8" :
                      "border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/8"}`}
                    onClick={() => setExpanded(open ? null : r.method)}>
                    <div className="flex items-center gap-2 p-3">
                      <SevBadge sev={r.severity} />
                      <span className="font-mono text-sm font-bold flex-1">{r.method}</span>
                      <span className="text-xs text-muted-foreground">{r.category}</span>
                      <span className="text-xs text-muted-foreground">{r.ms}ms</span>
                      {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </div>
                    {open && (
                      <div className="px-3 pb-3 space-y-2 border-t border-border/40 pt-2" onClick={e => e.stopPropagation()}>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-0.5">Impact</p>
                          <p className="text-xs text-foreground">{r.impact}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-0.5">Attack Vector (exact curl command)</p>
                          <pre className="text-xs font-mono bg-muted/30 rounded p-2 overflow-x-auto whitespace-pre-wrap break-all">{r.attackVector}</pre>
                        </div>
                        {r.result !== null && r.result !== undefined && (
                          <div>
                            <p className="text-xs font-semibold text-red-400 mb-0.5">Live Response Data</p>
                            <pre className="text-xs font-mono bg-red-500/10 border border-red-500/20 rounded p-2 overflow-x-auto max-h-32 whitespace-pre-wrap break-all">
                              {typeof r.result === "string" ? r.result : JSON.stringify(r.result, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {allExposed.length === 0 && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="py-6 text-center">
                <ShieldCheck className="w-10 h-10 text-green-400 mx-auto mb-2" />
                <p className="font-semibold text-green-400">All admin methods blocked</p>
                <p className="text-xs text-muted-foreground mt-1">{data.probesRun} privileged methods tested — none accessible</p>
              </CardContent>
            </Card>
          )}

          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show {data.blocked.length} blocked methods</summary>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-3 gap-1">
              {data.blocked.map(r => (
                <div key={r.method} className="flex items-center gap-1.5 bg-green-500/5 border border-green-500/10 rounded px-2 py-1">
                  <ShieldCheck className="w-3 h-3 text-green-400 shrink-0" />
                  <span className="font-mono text-xs truncate">{r.method}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
      {!data && !mutation.isPending && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Terminal className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>Probes 40+ privileged RPC methods against the target node</p>
          <p className="text-xs mt-1">personal_*, admin_*, debug_*, miner_*, eth_accounts, eth_sign — all tested with real payloads</p>
        </div>
      )}
    </div>
  );
}

// ── Engine 3: Batch DoS Tester ────────────────────────────────────────────────

interface BatchTestRow {
  batchSize: number; sentRequests: number; returnedResponses: number;
  completionRate: number; totalMs: number; msPerRequest: number;
  amplificationRatio: number; finding: string;
  severity: "critical" | "high" | "medium" | "low" | "pass";
}
interface BatchDosResult {
  endpoint: string; tests: BatchTestRow[]; batchLimitDetected: number | null;
  riskScore: number; scanTimeMs: number;
}

function BatchDosEngine({ endpoint }: { endpoint: string }) {
  const mutation = useMutation<BatchDosResult, Error, string>({
    mutationFn: (ep) => fetch(`${BASE}/api/dev-audit/exploit/batch-dos`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: ep }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
  });
  const data = mutation.data;

  const SEV_ROW: Record<string, string> = {
    critical: "border-red-500/40 bg-red-500/8",
    high:     "border-orange-500/30 bg-orange-500/5",
    medium:   "border-yellow-500/20 bg-yellow-500/5",
    low:      "border-blue-500/20 bg-blue-500/5",
    pass:     "border-green-500/15 bg-green-500/5",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button onClick={() => mutation.mutate(endpoint)} disabled={mutation.isPending}
          className="gap-2 bg-orange-800 hover:bg-orange-900">
          {mutation.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" />Testing 7 batch sizes…</>
            : <><ServerCrash className="w-4 h-4" />Run Batch DoS Test</>}
        </Button>
        {data && <span className="text-xs text-muted-foreground">7 sizes tested in {data.scanTimeMs}ms</span>}
      </div>
      {mutation.isError && <Alert className="border-red-500/40 bg-red-500/8"><AlertDescription className="text-xs text-red-400">{mutation.error.message}</AlertDescription></Alert>}

      {data && (
        <div className="space-y-4">
          <RiskMeter score={data.riskScore} />
          {data.batchLimitDetected !== null
            ? <p className="text-sm text-yellow-300">Batch cap detected near <span className="font-bold">{data.batchLimitDetected}</span> requests</p>
            : <p className="text-sm text-red-400 font-semibold">No batch size cap detected — unlimited amplification possible</p>}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border/40">
                  <th className="text-left pb-2 font-medium">Batch Size</th>
                  <th className="text-right pb-2 font-medium">Returned</th>
                  <th className="text-right pb-2 font-medium">Total ms</th>
                  <th className="text-right pb-2 font-medium">ms/req</th>
                  <th className="text-right pb-2 font-medium">Completion</th>
                  <th className="text-left pb-2 font-medium pl-3">Severity</th>
                </tr>
              </thead>
              <tbody className="space-y-1">
                {data.tests.map(t => (
                  <tr key={t.batchSize} className={`border rounded ${SEV_ROW[t.severity] ?? ""}`}>
                    <td className="py-2 px-2 font-mono font-bold">{t.batchSize}</td>
                    <td className="py-2 text-right font-mono">{t.returnedResponses}/{t.sentRequests}</td>
                    <td className="py-2 text-right font-mono">{t.totalMs}</td>
                    <td className="py-2 text-right font-mono">{t.msPerRequest.toFixed(1)}</td>
                    <td className="py-2 text-right font-mono">{t.completionRate.toFixed(0)}%</td>
                    <td className="py-2 pl-3"><SevBadge sev={t.severity} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            {data.tests.filter(t => t.severity !== "pass").map(t => (
              <div key={t.batchSize} className={`rounded border p-3 text-xs ${SEV_ROW[t.severity] ?? ""}`}>
                <div className="flex items-center gap-2 mb-1">
                  <SevBadge sev={t.severity} />
                  <span className="font-bold">Batch-{t.batchSize}</span>
                  <span className="text-muted-foreground">{t.returnedResponses}/{t.batchSize} responses in {t.totalMs}ms</span>
                </div>
                <p className="leading-relaxed">{t.finding}</p>
              </div>
            ))}
          </div>

          <Alert className="border-orange-500/30 bg-orange-500/8">
            <AlertDescription className="text-xs">
              <strong className="text-orange-300">Attack scenario:</strong> An attacker sends 1,000 HTTP connections × batch-500 = 500,000 eth_call executions in one round. Replace eth_blockNumber with <code>eth_call</code> on a contract with a gas-intensive fallback() and the node CPU is saturated in under 10 seconds.
            </AlertDescription>
          </Alert>
        </div>
      )}
      {!data && !mutation.isPending && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <ServerCrash className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>Tests batch sizes 5, 10, 25, 50, 100, 200, 500</p>
          <p className="text-xs mt-1">Measures amplification ratio — one HTTP request processing N×server workload</p>
        </div>
      )}
    </div>
  );
}

// ── Engine 4: eth_call Abuse Engine ───────────────────────────────────────────

interface CallAbuseProbe {
  id: string; name: string; description: string;
  payload: { method: string; params: unknown[] };
  accepted: boolean; ms: number; result: unknown; errorMessage: string | null;
  severity: "critical" | "high" | "medium" | "low" | "pass";
  attackPath: string; recommendation: string;
}
interface CallAbuseResult { endpoint: string; probes: CallAbuseProbe[]; riskScore: number; scanTimeMs: number; }

function CallAbuseEngine({ endpoint }: { endpoint: string }) {
  const mutation = useMutation<CallAbuseResult, Error, string>({
    mutationFn: (ep) => fetch(`${BASE}/api/dev-audit/exploit/call-abuse`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: ep }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
  });
  const data = mutation.data;
  const [showAll, setShowAll] = useState(false);
  const probes = data ? (showAll ? data.probes : data.probes.filter(p => p.accepted)) : [];

  const SEV_BG: Record<string, string> = {
    critical: "border-red-500/40 bg-red-500/8", high: "border-orange-500/30 bg-orange-500/5",
    medium: "border-yellow-500/20 bg-yellow-500/5", low: "border-blue-500/20 bg-blue-500/5",
    pass: "border-green-500/15 bg-green-500/5",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button onClick={() => mutation.mutate(endpoint)} disabled={mutation.isPending}
          className="gap-2 bg-yellow-800 hover:bg-yellow-900">
          {mutation.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" />Running {11} abuse probes…</>
            : <><Zap className="w-4 h-4" />Run eth_call Abuse Tests</>}
        </Button>
        {data && <span className="text-xs text-muted-foreground">{data.probes.length} probes in {data.scanTimeMs}ms</span>}
      </div>
      {mutation.isError && <Alert className="border-red-500/40 bg-red-500/8"><AlertDescription className="text-xs text-red-400">{mutation.error.message}</AlertDescription></Alert>}

      {data && (
        <div className="space-y-4">
          <RiskMeter score={data.riskScore} />
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: "Accepted",  value: data.probes.filter(p => p.accepted).length, color: "text-red-400" },
              { label: "Rejected",  value: data.probes.filter(p => !p.accepted).length, color: "text-green-400" },
              { label: "Total",     value: data.probes.length, color: "text-foreground" },
            ].map(({ label, value, color }) => (
              <Card key={label} className="border-border/50">
                <CardContent className="py-2 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={() => setShowAll(v => !v)}
              className="text-xs px-2 py-1 rounded border border-border bg-muted/30 text-muted-foreground hover:text-foreground">
              {showAll ? "Show accepted only" : "Show all probes"}
            </button>
          </div>

          <div className="space-y-3">
            {probes.map(p => (
              <div key={p.id} className={`rounded border p-3 text-xs ${SEV_BG[p.accepted ? p.severity : "pass"] ?? ""}`}>
                <div className="flex items-center gap-2 mb-2">
                  {p.accepted ? <SevBadge sev={p.severity} /> : <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold border bg-green-500/20 text-green-300 border-green-500/30">BLOCKED</span>}
                  <span className="font-semibold">{p.name}</span>
                  <span className="text-muted-foreground ml-auto">{p.ms}ms</span>
                </div>
                <p className="text-muted-foreground mb-2">{p.description}</p>
                {p.accepted && (
                  <>
                    <div className="mb-2">
                      <p className="font-semibold text-orange-300 mb-0.5">Attack Path</p>
                      <p>{p.attackPath}</p>
                    </div>
                    {p.result !== null && (
                      <div className="mb-2">
                        <p className="font-semibold text-red-300 mb-0.5">Node Response</p>
                        <pre className="font-mono bg-red-500/10 border border-red-500/15 rounded p-1.5 overflow-x-auto break-all whitespace-pre-wrap">
                          {typeof p.result === "string" ? p.result : JSON.stringify(p.result)}
                        </pre>
                      </div>
                    )}
                  </>
                )}
                <div className="border-t border-border/30 pt-2 mt-2">
                  <p className="text-green-300 font-semibold mb-0.5">Fix</p>
                  <p className="text-muted-foreground">{p.recommendation}</p>
                </div>
              </div>
            ))}
            {probes.length === 0 && (
              <Card className="border-green-500/30 bg-green-500/5">
                <CardContent className="py-6 text-center">
                  <ShieldCheck className="w-10 h-10 text-green-400 mx-auto mb-2" />
                  <p className="font-semibold text-green-400">All {data.probes.length} abuse probes rejected</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
      {!data && !mutation.isPending && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>11 abuse probes: null-to, 1/4/32KB calldata, MAX gas, historical call, full getLogs, negative blocks</p>
          <p className="text-xs mt-1">Each probe shows attack path, live node response, and exact fix</p>
        </div>
      )}
    </div>
  );
}

// ── Engine 5: Node Intelligence ────────────────────────────────────────────────

interface NodeIntelResult {
  endpoint: string; clientVersion: string | null; gethVersion: string | null;
  goVersion: string | null; os: string | null; buildCommit: string | null;
  networkId: string | null; chainId: string | null; chainName: string | null;
  peerCount: number | null; blockNumber: number | null;
  gasPrice: string | null; gasPriceGwei: number | null;
  syncing: boolean | object | null; isMining: boolean | null;
  hashrate: number | null; coinbase: string | null; protocolVersion: string | null;
  exposedModules: string[]; cveLookupUrl: string | null; fingerprint: string;
  securityNotes: Array<{ severity: string; note: string }>;
  scanTimeMs: number;
}

function NodeIntelEngine({ endpoint }: { endpoint: string }) {
  const mutation = useMutation<NodeIntelResult, Error, string>({
    mutationFn: (ep) => fetch(`${BASE}/api/dev-audit/exploit/node-intel`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: ep }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error); return d; }),
  });
  const data = mutation.data;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button onClick={() => mutation.mutate(endpoint)} disabled={mutation.isPending}
          className="gap-2 bg-purple-800 hover:bg-purple-900">
          {mutation.isPending
            ? <><Loader2 className="w-4 h-4 animate-spin" />Fingerprinting node…</>
            : <><Fingerprint className="w-4 h-4" />Run Node Intelligence</>}
        </Button>
        {data && <span className="text-xs text-muted-foreground">{data.scanTimeMs}ms</span>}
      </div>
      {mutation.isError && <Alert className="border-red-500/40 bg-red-500/8"><AlertDescription className="text-xs text-red-400">{mutation.error.message}</AlertDescription></Alert>}

      {data && (
        <div className="space-y-4">
          {/* Fingerprint banner */}
          <Card className="border-purple-500/30 bg-purple-500/8">
            <CardContent className="py-3">
              <p className="text-xs font-semibold text-purple-300 mb-1">Node Fingerprint</p>
              <p className="font-mono text-xs break-all text-foreground">{data.fingerprint}</p>
            </CardContent>
          </Card>

          {/* Core stats grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {[
              { label: "Client",        value: data.clientVersion ?? "Unknown" },
              { label: "Geth Version",  value: data.gethVersion ?? "N/A" },
              { label: "Go Runtime",    value: data.goVersion ?? "N/A" },
              { label: "OS / Arch",     value: data.os ?? "N/A" },
              { label: "Build Commit",  value: data.buildCommit ?? "N/A" },
              { label: "Chain",         value: data.chainName ?? data.chainId ?? "Unknown" },
              { label: "Network ID",    value: data.networkId ?? "N/A" },
              { label: "Block Height",  value: data.blockNumber?.toLocaleString() ?? "N/A" },
              { label: "Gas Price",     value: data.gasPrice ?? "N/A" },
              { label: "Peer Count",    value: data.peerCount !== null ? String(data.peerCount) : "N/A" },
              { label: "Mining",        value: data.isMining ? "YES ⚠" : "No" },
              { label: "Syncing",       value: data.syncing ? "YES ⚠" : "Fully synced" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/20 border border-border/40 rounded p-2">
                <p className="text-muted-foreground text-xs">{label}</p>
                <p className="font-mono font-semibold truncate text-xs mt-0.5" title={value}>{value}</p>
              </div>
            ))}
          </div>

          {/* Exposed modules */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Exposed API Modules</p>
            <div className="flex flex-wrap gap-1">
              {data.exposedModules.map(m => (
                <Badge key={m} className="bg-orange-500/15 text-orange-300 border-orange-500/20 text-xs">{m}</Badge>
              ))}
            </div>
          </div>

          {/* Security notes */}
          {data.securityNotes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground">Security Notes</p>
              {data.securityNotes.map((n, i) => (
                <div key={i} className={`rounded border p-2 text-xs ${
                  n.severity === "critical" ? "border-red-500/40 bg-red-500/8 text-red-300" :
                  n.severity === "high"     ? "border-orange-500/30 bg-orange-500/5 text-orange-300" :
                  n.severity === "medium"   ? "border-yellow-500/20 bg-yellow-500/5 text-yellow-300" :
                  "border-border/40 bg-muted/20 text-muted-foreground"}`}>
                  <SevBadge sev={n.severity} /> <span className="ml-1">{n.note}</span>
                </div>
              ))}
            </div>
          )}

          {/* CVE lookup */}
          {data.cveLookupUrl && (
            <a href={data.cveLookupUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-purple-300 hover:underline">
              <ExternalLink className="w-3 h-3" />
              Search NVD for CVEs against Geth {data.gethVersion}
            </a>
          )}
        </div>
      )}
      {!data && !mutation.isPending && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Fingerprint className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>Full node fingerprint: version, chain, peers, gas price, sync state, exposed modules</p>
          <p className="text-xs mt-1">Results include CVE lookup URL and security risk notes</p>
        </div>
      )}
    </div>
  );
}

// ── Autonomous Report Tab ─────────────────────────────────────────────────────

const AUTO_CHAINS_META = [
  { id: "eth",  chain: "Ethereum Mainnet",  url: "https://ethereum.publicnode.com" },
  { id: "bsc",  chain: "BNB Smart Chain",   url: "https://bsc.publicnode.com" },
  { id: "poly", chain: "Polygon Mainnet",   url: "https://polygon-bor.publicnode.com" },
  { id: "arb",  chain: "Arbitrum One",      url: "https://arbitrum-one.publicnode.com" },
  { id: "op",   chain: "Optimism",          url: "https://optimism.publicnode.com" },
  { id: "base", chain: "Base",              url: "https://base.publicnode.com" },
  { id: "avax", chain: "Avalanche C-Chain", url: "https://avalanche-c-chain.publicnode.com" },
];

const AUTO_WALLET_LIST = [
  "0x0d5c41c609fe1ec073c3b4fa10949d602ed059bb",
  "0xb98e8eefba0f7476b85cd9716cb5b38a935aa872",
  "0xb01fed2f701695992a4f7ffdb53f3af099e140d7",
  "0xf70da97812cb96acdf810712aa562db8dfa3dbef",
  "0xc600d76b5bfe058d6e52d2c08ceba6c85774f9b6",
  "0xbcd263db9c9ed9215bcb07897f9da582129dd7da",
  "0xea7fc58e112fb3607d8a7694e1f71c6894c72d3c",
  "0xacd1f4e274d1a4bb686a41549a90253cf152dd6d",
  "0xe205e85068704ecf1c3c55b76bcb466ff0798526",
  "0x9b9fd485e94c73af3bc8b9a630c4de7203bc96cb",
  "0x610e10ed49f57591abe16d919b6d15aaf4557237",
  "0xa5cc3e44ed97f8c94df27822c85303a3bd4e8134",
  "0x7aebc630f301f15baddf160103dc3bd8f9baf043",
  "0x487663784c77ba56e32d9fe60485d93c4c319385",
];

interface AutoProgressEvent { phase: string; chain?: string; pct: number; msg: string; type: string; data?: unknown; }
interface AutoChainResult {
  chain: string; url: string; id: string; riskScore: number;
  nodeIntel: any; adminScan: any; batchDos: any; callAbuse: any; mempool: any;
  criticalFindings: string[]; highFindings: string[]; elapsedMs: number;
}
interface AutoWalletResult { address: string; findings: {severity:string;title:string;detail:string}[]; riskScore: number; nonceGap: any; }
interface AutoReport {
  generatedAt: string; scanDurationMs: number; totalChains: number; totalWallets: number;
  overallRisk: number; criticalCount: number; highCount: number; mediumCount: number;
  chains: AutoChainResult[]; wallets: AutoWalletResult[];
  topFindings: {severity:string;chain?:string;wallet?:string;title:string;detail:string}[];
  summary: string;
}

function RiskRing({ score, size = 64 }: { score: number; size?: number }) {
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const fill = circ * (1 - score / 100);
  const color = score >= 70 ? "#ef4444" : score >= 40 ? "#f97316" : score >= 20 ? "#eab308" : "#22c55e";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1f2937" strokeWidth={6}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={circ} strokeDashoffset={fill}
        transform={`rotate(-90 ${size/2} ${size/2})`} strokeLinecap="round"
        style={{transition:"stroke-dashoffset 0.6s ease"}}/>
      <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle"
        fontSize={size < 60 ? 10 : 13} fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

function FindingCard({ sev, title, detail, chain, wallet }: { sev: string; title: string; detail?: string; chain?: string; wallet?: string }) {
  const [open, setOpen] = useState(false);
  const cls = sev === "critical" ? "border-red-500/50 bg-red-500/8"
    : sev === "high" ? "border-orange-500/50 bg-orange-500/8"
    : sev === "medium" ? "border-yellow-500/50 bg-yellow-500/8"
    : "border-blue-500/30 bg-blue-500/5";
  return (
    <div className={`border rounded-lg p-3 cursor-pointer ${cls}`} onClick={() => setOpen(o => !o)}>
      <div className="flex items-start gap-2">
        <span className="shrink-0 mt-0.5">{sevBadge(sev as Severity)}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{title}</p>
          {(chain || wallet) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {chain && <span className="mr-2">⛓ {chain}</span>}
              {wallet && <span className="font-mono">{wallet.slice(0,10)}…{wallet.slice(-6)}</span>}
            </p>
          )}
        </div>
        <span className="text-muted-foreground text-xs">{open ? "▲" : "▼"}</span>
      </div>
      {open && detail && <p className="text-xs text-muted-foreground mt-2 leading-relaxed border-t border-border/50 pt-2">{detail}</p>}
    </div>
  );
}

function ChainResultCard({ r }: { r: AutoChainResult }) {
  const [expanded, setExpanded] = useState(false);
  const admin = r.adminScan as any;
  const batch = r.batchDos  as any;
  const call  = r.callAbuse as any;
  const intel = r.nodeIntel as any;
  const pool  = r.mempool   as any;

  const exposedMethods: string[] = [
    ...(admin?.criticalExposed ?? []).map((m:any) => m.method),
    ...(admin?.highExposed ?? []).map((m:any) => m.method),
    ...(admin?.mediumExposed ?? []).map((m:any) => m.method),
  ];
  const acceptedProbes: string[] = (call?.probes ?? []).filter((p:any)=>p.accepted).map((p:any)=>p.id);
  const blockedProbes:  string[] = (call?.probes ?? []).filter((p:any)=>!p.accepted).map((p:any)=>p.id);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/20" onClick={() => setExpanded(e => !e)}>
        <RiskRing score={r.riskScore} size={52} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{r.chain}</p>
          <p className="text-xs text-muted-foreground font-mono truncate">{r.url}</p>
          <div className="flex gap-2 mt-1 flex-wrap">
            {r.criticalFindings.length > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-300">{r.criticalFindings.length} critical</span>}
            {r.highFindings.length    > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">{r.highFindings.length} high</span>}
            {exposedMethods.length    > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-300">{exposedMethods.length} exposed methods</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-muted-foreground">{(r.elapsedMs/1000).toFixed(1)}s</p>
          <p className="text-xs text-muted-foreground mt-0.5">{expanded ? "▲ collapse" : "▼ expand"}</p>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/10">
          {/* Node Intel */}
          {intel && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Engine 5 — Node Intelligence</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {intel.clientVersion && <div className="col-span-2 font-mono bg-muted/40 rounded px-2 py-1 break-all">{intel.clientVersion}</div>}
                {intel.blockNumber   && <div><span className="text-muted-foreground">Block: </span>{Number(intel.blockNumber).toLocaleString()}</div>}
                {intel.peerCount     != null && <div><span className="text-muted-foreground">Peers: </span>{intel.peerCount}</div>}
                {intel.exposedModules?.length > 0 && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Exposed modules: </span>
                    {intel.exposedModules.map((m:string) => (
                      <code key={m} className="text-orange-300 bg-orange-500/10 px-1 rounded text-xs mr-1">{m}</code>
                    ))}
                  </div>
                )}
                {intel.securityNotes?.map((n:string, i:number) => (
                  <div key={i} className="col-span-2 text-yellow-300 text-xs">⚠ {n}</div>
                ))}
              </div>
            </div>
          )}

          {/* Admin Scan */}
          {admin && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Engine 2 — Admin Method Scanner ({(admin.methodsProbed ?? 0)} methods probed)</p>
              <div className="space-y-1">
                {[...(admin.criticalExposed??[]), ...(admin.highExposed??[]), ...(admin.mediumExposed??[])].map((m:any) => (
                  <div key={m.method} className="flex items-start gap-2 text-xs">
                    <span className="shrink-0">{sevBadge(m.severity as Severity)}</span>
                    <code className="text-orange-200">{m.method}</code>
                    <span className="text-muted-foreground">— {m.attackVector ?? m.impact ?? "exposed"}</span>
                  </div>
                ))}
                {(admin.blockedCount ?? 0) > 0 && (
                  <p className="text-xs text-muted-foreground">{admin.blockedCount} methods blocked ✓</p>
                )}
              </div>
            </div>
          )}

          {/* Batch DoS */}
          {batch && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Engine 3 — Batch DoS Tester</p>
              <div className="text-xs space-y-1">
                {(batch.batchResults ?? []).map((br:any, i:number) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-muted-foreground">Batch-{br.batchSize}:</span>
                    <span>{br.returned ?? br.batchSize}/{br.batchSize} returned in {br.ms}ms</span>
                  </div>
                ))}
                <div className="flex gap-2 mt-1">
                  <span className="text-muted-foreground">Batch cap:</span>
                  <span className={batch.batchLimitDetected ? "text-green-400" : "text-red-400"}>
                    {batch.batchLimitDetected ? `${batch.batchLimitDetected} (cap enforced ✓)` : "No cap detected — DoS risk"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="text-muted-foreground">Risk:</span>
                  <span className={batch.riskScore >= 70 ? "text-red-400" : batch.riskScore >= 40 ? "text-orange-400" : "text-green-400"}>{batch.riskScore}/100</span>
                </div>
              </div>
            </div>
          )}

          {/* eth_call Abuse */}
          {call && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Engine 4 — eth_call Abuse Engine ({(call.probes ?? []).length} probes)</p>
              <div className="text-xs space-y-1">
                {acceptedProbes.length > 0 && (
                  <div><span className="text-red-400 font-semibold">Accepted: </span>{acceptedProbes.join(", ")}</div>
                )}
                {blockedProbes.length > 0 && (
                  <div><span className="text-green-400">Blocked: </span>{blockedProbes.join(", ")}</div>
                )}
                {call.riskScore != null && (
                  <div><span className="text-muted-foreground">Risk: </span><span className={call.riskScore>=70?"text-red-400":call.riskScore>=40?"text-orange-400":"text-green-400"}>{call.riskScore}/100</span></div>
                )}
              </div>
            </div>
          )}

          {/* Mempool */}
          {pool && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Engine 1 — Mempool Surveillance</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                {pool.pendingCount      != null && <div><span className="text-muted-foreground">Pending: </span>{Number(pool.pendingCount).toLocaleString()}</div>}
                {pool.queuedCount       != null && <div><span className="text-muted-foreground">Queued: </span>{Number(pool.queuedCount).toLocaleString()}</div>}
                {pool.frontRunnableCount != null && <div><span className="text-red-400 font-semibold">Front-runnable DEX swaps: </span>{Number(pool.frontRunnableCount).toLocaleString()}</div>}
                {pool.highValueCount    != null && <div><span className="text-muted-foreground">High-value transfers: </span>{Number(pool.highValueCount).toLocaleString()}</div>}
                {pool.multisigCount     != null && <div><span className="text-muted-foreground">Multisig executions: </span>{Number(pool.multisigCount).toLocaleString()}</div>}
              </div>
            </div>
          )}

          {/* Critical Findings */}
          {(r.criticalFindings.length > 0 || r.highFindings.length > 0) && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Findings Summary</p>
              <div className="space-y-1">
                {r.criticalFindings.map((f,i) => <div key={i} className="text-xs text-red-300">🔴 {f}</div>)}
                {r.highFindings.map((f,i)    => <div key={i} className="text-xs text-orange-300">🟠 {f}</div>)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WalletResultCard({ w }: { w: AutoWalletResult }) {
  const [expanded, setExpanded] = useState(false);
  const nonce = w.nonceGap as any;
  const hasFindings = w.findings.length > 0;
  return (
    <div className={`border rounded-lg overflow-hidden ${hasFindings ? "border-orange-500/40" : "border-border"}`}>
      <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpanded(e => !e)}>
        <div className={`w-2 h-2 rounded-full shrink-0 ${w.riskScore >= 70 ? "bg-red-500" : w.riskScore >= 40 ? "bg-orange-500" : w.riskScore > 0 ? "bg-yellow-500" : "bg-green-500"}`}/>
        <code className="text-xs flex-1 truncate">{w.address}</code>
        <div className="flex gap-2 items-center">
          {w.findings.filter(f=>f.severity==="critical").length > 0 && <span className="text-xs text-red-400">{w.findings.filter(f=>f.severity==="critical").length} critical</span>}
          {w.findings.filter(f=>f.severity==="high").length > 0    && <span className="text-xs text-orange-400">{w.findings.filter(f=>f.severity==="high").length} high</span>}
          {!hasFindings && <span className="text-xs text-green-400">CLEAN</span>}
          <span className="text-muted-foreground text-xs">{expanded ? "▲" : "▼"}</span>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border p-3 bg-muted/10 text-xs space-y-2">
          {nonce && (
            <div className="space-y-1">
              <p className="text-muted-foreground">Confirmed nonce: <span className="text-foreground font-mono">{nonce.confirmedNonce ?? "N/A"}</span></p>
              <p className="text-muted-foreground">Pending nonce: <span className="text-foreground font-mono">{nonce.pendingNonce ?? "N/A"}</span></p>
              {nonce.preEip155Txs?.length > 0 && <p className="text-yellow-400">⚠ {nonce.preEip155Txs.length} pre-EIP155 txs (replay risk)</p>}
            </div>
          )}
          {w.findings.map((f, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="shrink-0">{sevBadge(f.severity as Severity)}</span>
              <div>
                <p className="font-semibold">{f.title}</p>
                {f.detail && <p className="text-muted-foreground mt-0.5">{f.detail}</p>}
              </div>
            </div>
          ))}
          {!hasFindings && <p className="text-green-400">No nonce gaps, no pre-EIP155 transactions, clean sequence ✓</p>}
        </div>
      )}
    </div>
  );
}

function AutonomousReportTab() {
  const [status, setStatus]   = useState<"idle" | "running" | "done" | "error">("idle");
  const [logs, setLogs]       = useState<string[]>([]);
  const [pct, setPct]         = useState(0);
  const [report, setReport]   = useState<AutoReport | null>(null);
  const [chainResults, setChainResults] = useState<AutoChainResult[]>([]);
  const [walletResults, setWalletResults] = useState<AutoWalletResult[]>([]);
  const [activeSection, setActiveSection] = useState<"overview" | "chains" | "wallets" | "matrix">("overview");
  const esRef   = useRef<EventSource | null>(null);
  const logRef  = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const pushLog = (msg: string) => {
    setLogs(prev => [...prev.slice(-200), `[${new Date().toLocaleTimeString()}] ${msg}`]);
    setTimeout(() => { logRef.current?.scrollTo({ top: 99999, behavior: "smooth" }); }, 50);
  };

  const launch = () => {
    if (esRef.current) { esRef.current.close(); }
    setStatus("running");
    setLogs([]);
    setPct(0);
    setReport(null);
    setChainResults([]);
    setWalletResults([]);
    pushLog("Launching autonomous scan — 7 chains × 5 engines + 14 wallets…");

    const url = `${BASE}/api/dev-audit/exploit/autonomous-stream`;
    const es  = new EventSource(url);
    esRef.current = es;

    const handle = (type: string) => (e: MessageEvent) => {
      const evt: AutoProgressEvent = JSON.parse(e.data);
      if (evt.pct) setPct(evt.pct);

      if (type === "progress" || type === "error") {
        pushLog(evt.msg);
      } else if (type === "engine-result") {
        pushLog(`✓ ${evt.chain}: risk ${(evt.data as any)?.riskScore ?? "?"}/100 — ${(evt.data as any)?.criticalFindings?.length ?? 0} critical, ${(evt.data as any)?.highFindings?.length ?? 0} high`);
        setChainResults(prev => [...prev, evt.data as AutoChainResult]);
      } else if (type === "wallet-result") {
        const ws = evt.data as AutoWalletResult[];
        setWalletResults(ws);
        pushLog(`Wallet scan complete — ${ws.filter(w=>w.findings.length>0).length}/${ws.length} wallets with findings`);
      } else if (type === "done") {
        const r = evt.data as AutoReport;
        setReport(r);
        setStatus("done");
        pushLog(`━━ SCAN COMPLETE ━━ Risk: ${r.overallRisk}/100 · ${r.criticalCount} critical · ${r.highCount} high · ${((r.scanDurationMs)/1000).toFixed(1)}s`);
        es.close();
        toast({ title: "Autonomous Scan Complete", description: r.summary });
      }
    };

    es.addEventListener("progress",      handle("progress"));
    es.addEventListener("engine-result", handle("engine-result"));
    es.addEventListener("wallet-result", handle("wallet-result"));
    es.addEventListener("done",          handle("done"));
    es.addEventListener("error",         (e: MessageEvent) => { try { handle("error")(e); } catch {} });

    es.onerror = () => {
      if (status !== "done") {
        setStatus("error");
        pushLog("SSE connection error — scan may have completed.");
        es.close();
      }
    };
  };

  const stop = () => {
    esRef.current?.close();
    setStatus("idle");
    pushLog("Scan stopped by user.");
  };

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([JSON.stringify({ ...report, chains: chainResults, wallets: walletResults }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `QuantumAudit-Autonomous-Report-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
  };

  const sevCount = (s: string) => report?.topFindings.filter(f=>f.severity===s).length ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-5 h-5 text-emerald-400"/>
                <h2 className="font-bold text-lg">Autonomous Full-Spectrum Report</h2>
              </div>
              <p className="text-sm text-muted-foreground">
                Runs all 5 Exploit Engines against {AUTO_CHAINS_META.length} major chains
                + nonce audit on all {AUTO_WALLET_LIST.length} pre-loaded wallets. Zero mocked data — every call is live.
              </p>
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                <span>⛓ {AUTO_CHAINS_META.map(c=>c.chain).join(" · ")}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {status === "running" ? (
                <Button variant="destructive" size="sm" onClick={stop}><Square className="w-3.5 h-3.5 mr-1.5"/>Stop</Button>
              ) : (
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={launch}>
                  <Play className="w-3.5 h-3.5 mr-1.5"/>
                  {status === "done" ? "Re-run Scan" : "Launch Autonomous Scan"}
                </Button>
              )}
              {report && (
                <Button variant="outline" size="sm" onClick={downloadReport}><Database className="w-3.5 h-3.5 mr-1.5"/>Download JSON</Button>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          {(status === "running" || status === "done") && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{status === "done" ? "Scan complete" : "Scanning…"}</span>
                <span>{pct}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-500 ${status==="done" ? "bg-emerald-500" : "bg-emerald-400 animate-pulse"}`} style={{ width: `${pct}%` }}/>
              </div>
              <div className="flex gap-4 mt-1.5 text-xs text-muted-foreground">
                <span>✓ {chainResults.length}/{AUTO_CHAINS_META.length} chains</span>
                <span>✓ {walletResults.length}/{AUTO_WALLET_LIST.length} wallets</span>
                {report && <span className="text-red-400">{report.criticalCount} critical</span>}
                {report && <span className="text-orange-400">{report.highCount} high</span>}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Live Log */}
      {logs.length > 0 && (
        <Card>
          <CardHeader className="py-2 px-4">
            <CardTitle className="text-xs text-muted-foreground flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5"/>Live Scan Log
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div ref={logRef} className="h-40 overflow-y-auto font-mono text-xs p-3 bg-black/40 rounded-b-xl space-y-0.5">
              {logs.map((l, i) => (
                <div key={i} className={`${l.includes("COMPLETE") ? "text-emerald-400 font-bold" : l.includes("critical") || l.includes("error") ? "text-red-400" : l.includes("✓") ? "text-emerald-400" : "text-muted-foreground"}`}>{l}</div>
              ))}
              {status === "running" && <div className="text-emerald-400 animate-pulse">▌</div>}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Idle state — info cards */}
      {status === "idle" && !report && (
        <div className="grid grid-cols-1 gap-3">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-400"/>What the Autonomous Scan Executes</h3>
              <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground">
                {[
                  ["Engine 1 — Mempool Surveillance",  "Snapshots txpool_content, txpool_inspect, txpool_status. Decodes calldata, identifies front-runnable DEX swaps, high-value transfers, multisig executions."],
                  ["Engine 2 — Admin Method Scanner",  "Probes 55+ privileged methods (eth_accounts, personal_*, admin_*, debug_*). Rates each by CVSS-equivalent severity. Shows exact attack vector per exposed method."],
                  ["Engine 3 — Batch DoS Tester",      "Sends batch-100, batch-200, batch-500 requests. Measures amplification factor, detects missing batch size caps, scores DoS risk 0–100."],
                  ["Engine 4 — eth_call Abuse Engine", "Probes null-to, 1KB/4KB/32KB calldata, MAX_UINT64 gas, estimateGas. Identifies missing input validation that enables CPU exhaustion attacks."],
                  ["Engine 5 — Node Intelligence",     "Fingerprints client version (Geth/Besu/Nethermind), Go/Java runtime, OS, block height, peer count, exposed API modules. CVE lookup URLs generated."],
                  ["Wallet Nonce Audit",               "Runs eth_getTransactionCount (confirmed + pending) on all 14 wallets. Fetches tx history via Blockscout. Detects nonce gaps, pre-EIP155 transactions, EIP-7702 delegation risks."],
                ].map(([title, desc]) => (
                  <div key={title} className="flex gap-3 p-2 border border-border/40 rounded-lg">
                    <span className="text-emerald-400 shrink-0">▶</span>
                    <div><p className="font-semibold text-foreground">{title}</p><p className="mt-0.5">{desc}</p></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Network className="w-4 h-4 text-blue-400"/>Target Chains</h3>
              <div className="grid grid-cols-2 gap-1.5">
                {AUTO_CHAINS_META.map(c => (
                  <div key={c.id} className="text-xs flex items-center gap-2 p-2 border border-border/30 rounded">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"/>
                    <div><p className="font-medium">{c.chain}</p><p className="text-muted-foreground font-mono text-[10px]">{c.url}</p></div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <h3 className="font-semibold text-sm mb-2 flex items-center gap-2"><Fingerprint className="w-4 h-4 text-purple-400"/>Pre-Loaded Wallets ({AUTO_WALLET_LIST.length})</h3>
              <div className="space-y-1">
                {AUTO_WALLET_LIST.map(a => (
                  <div key={a} className="font-mono text-xs text-muted-foreground flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 shrink-0"/>
                    {a}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full Report — shown when done (or during run with partial data) */}
      {(chainResults.length > 0 || report) && (
        <div className="space-y-4">
          {/* Executive Summary */}
          {report && (
            <Card className={`border-2 ${report.overallRisk >= 70 ? "border-red-500/50" : report.overallRisk >= 40 ? "border-orange-500/50" : "border-yellow-500/50"}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <RiskRing score={report.overallRisk} size={80}/>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-base">Executive Summary</h3>
                    <p className="text-xs text-muted-foreground mt-1">{report.summary}</p>
                    <p className="text-xs text-muted-foreground mt-1">Generated: {new Date(report.generatedAt).toLocaleString()} · Duration: {(report.scanDurationMs/1000).toFixed(1)}s</p>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-2 mt-4">
                  {[
                    { label: "CRITICAL", count: report.criticalCount, cls: "bg-red-500/20 border-red-500/40 text-red-300" },
                    { label: "HIGH",     count: report.highCount,     cls: "bg-orange-500/20 border-orange-500/40 text-orange-300" },
                    { label: "MEDIUM",   count: report.mediumCount,   cls: "bg-yellow-500/20 border-yellow-500/40 text-yellow-300" },
                    { label: "WALLETS WITH FINDINGS", count: report.wallets.filter(w=>w.findings.length>0).length, cls: "bg-purple-500/20 border-purple-500/40 text-purple-300" },
                  ].map(({ label, count, cls }) => (
                    <div key={label} className={`border rounded-lg p-2 text-center ${cls}`}>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-[10px] font-semibold mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Section Nav */}
          <div className="flex gap-1 flex-wrap">
            {(["overview","chains","wallets","matrix"] as const).map(s => (
              <button key={s} onClick={() => setActiveSection(s)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${activeSection===s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                {s === "overview" ? "🔍 Top Findings" : s === "chains" ? `⛓ Chains (${chainResults.length})` : s === "wallets" ? `👛 Wallets (${walletResults.length})` : "📋 Remediation"}
              </button>
            ))}
          </div>

          {/* Top Findings */}
          {activeSection === "overview" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">All critical and high severity findings across all chains and wallets, ranked by severity:</p>
              {(report?.topFindings ?? chainResults.flatMap(c => [
                ...c.criticalFindings.map(f => ({ severity:"critical", chain:c.chain, title:f, detail:"" })),
                ...c.highFindings.map(f => ({ severity:"high", chain:c.chain, title:f, detail:"" })),
              ])).length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No critical or high findings yet — scan in progress…</p>}
              {(report?.topFindings ?? chainResults.flatMap(c => [
                ...c.criticalFindings.map(f => ({ severity:"critical", chain:c.chain, title:f, detail:"", wallet:undefined })),
                ...c.highFindings.map(f => ({ severity:"high", chain:c.chain, title:f, detail:"", wallet:undefined })),
              ])).map((f,i) => (
                <FindingCard key={i} sev={f.severity} title={f.title} detail={f.detail} chain={f.chain} wallet={(f as any).wallet}/>
              ))}
            </div>
          )}

          {/* Chain Results */}
          {activeSection === "chains" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Click any chain to expand full engine output. Sorted by risk score (highest first).</p>
              {[...chainResults].sort((a,b) => b.riskScore - a.riskScore).map(r => (
                <ChainResultCard key={r.id ?? r.chain} r={r}/>
              ))}
              {chainResults.length < AUTO_CHAINS_META.length && status === "running" && (
                <div className="text-xs text-muted-foreground text-center py-4 animate-pulse">
                  Scanning {AUTO_CHAINS_META.length - chainResults.length} remaining chains…
                </div>
              )}
            </div>
          )}

          {/* Wallet Results */}
          {activeSection === "wallets" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Nonce sequence audit across all {AUTO_WALLET_LIST.length} pre-loaded wallets on Ethereum Mainnet.</p>
              {walletResults.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {status === "running" ? "Wallet scan running…" : "No wallet results yet."}
                </p>
              )}
              {[...walletResults].sort((a,b) => b.riskScore - a.riskScore).map(w => (
                <WalletResultCard key={w.address} w={w}/>
              ))}
            </div>
          )}

          {/* Remediation Matrix */}
          {activeSection === "matrix" && report && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Remediation Priority Matrix</CardTitle>
                <CardDescription className="text-xs">Ordered by severity and effort. Address P0 items immediately.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  {[
                    { priority: "P0 — IMMEDIATE", sev: "critical", items: report.topFindings.filter(f=>f.severity==="critical") },
                    { priority: "P1 — THIS WEEK", sev: "high",     items: report.topFindings.filter(f=>f.severity==="high") },
                    { priority: "P2 — THIS SPRINT",sev: "medium",  items: [] },
                  ].map(({ priority, sev, items }) => items.length > 0 && (
                    <div key={priority} className="p-3">
                      <p className={`text-xs font-bold mb-2 ${sev==="critical"?"text-red-400":sev==="high"?"text-orange-400":"text-yellow-400"}`}>{priority}</p>
                      <div className="space-y-1.5">
                        {items.map((f,i) => (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <span className="shrink-0">{sevBadge(f.severity as Severity)}</span>
                            <div>
                              <p className="font-medium">{f.title}</p>
                              {f.chain  && <p className="text-muted-foreground">Chain: {f.chain}</p>}
                              {(f as any).wallet && <p className="text-muted-foreground font-mono">{(f as any).wallet}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="p-3">
                    <p className="text-xs font-bold text-muted-foreground mb-2">HARDENED NODE CONFIGURATION</p>
                    <pre className="text-xs bg-black/40 rounded-lg p-3 overflow-x-auto text-green-400 font-mono whitespace-pre">{`geth \\
  --mainnet \\
  --http.api "eth" \\
  --http.addr "127.0.0.1" \\
  --http.vhosts "localhost" \\
  --rpc.gascap 25000000 \\
  --rpc.batch-request-limit 10 \\
  --rpc.batch-response-max-size 10485760`}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {activeSection === "matrix" && !report && (
            <p className="text-xs text-muted-foreground text-center py-8">Remediation matrix will be generated when the scan completes.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Exploit Engines Tab ───────────────────────────────────────────────────

function ExploitEnginesTab() {
  const [endpoint, setEndpoint] = useState("https://ethereum.publicnode.com");
  const [activeEngine, setActiveEngine] = useState<"mempool" | "admin" | "batch" | "callabuse" | "intel">("intel");

  const ENGINES = [
    { id: "mempool",   label: "Mempool Surveillance", icon: Eye,         desc: "Live pending tx feed with front-run detection",  color: "text-orange-400" },
    { id: "admin",     label: "Admin Method Scanner",  icon: Terminal,    desc: "40+ privileged methods probed live",             color: "text-red-400"    },
    { id: "batch",     label: "Batch DoS Tester",      icon: ServerCrash, desc: "Amplification ratio across 7 batch sizes",       color: "text-orange-300" },
    { id: "callabuse", label: "eth_call Abuse",        icon: Zap,         desc: "11 input validation probes with attack paths",   color: "text-yellow-400" },
    { id: "intel",     label: "Node Intelligence",     icon: Fingerprint, desc: "Full fingerprint, CVE lookup, peer risk",        color: "text-purple-400" },
  ] as const;

  return (
    <div className="space-y-4">
      {/* Endpoint selector */}
      <Card className="border-red-500/30 bg-red-500/5">
        <CardContent className="pt-4 pb-3 space-y-2">
          <p className="text-xs font-semibold text-red-300 flex items-center gap-1.5">
            <Target className="w-4 h-4" /> Target RPC Endpoint
          </p>
          <Input value={endpoint} onChange={e => setEndpoint(e.target.value)}
            placeholder="https://your-node:8545" className="font-mono text-xs" />
          <div className="flex flex-wrap gap-1.5">
            {EXPLOIT_ENDPOINTS.map(p => (
              <button key={p.url} onClick={() => setEndpoint(p.url)}
                className={`text-xs px-2 py-0.5 rounded border transition-colors ${endpoint === p.url ? "bg-red-500/25 border-red-500/50 text-red-300" : "bg-muted/30 border-border text-muted-foreground hover:text-foreground"}`}>
                {p.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Engine selector */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
        {ENGINES.map(e => {
          const Icon = e.icon;
          return (
            <button key={e.id} onClick={() => setActiveEngine(e.id)}
              className={`rounded border p-3 text-left transition-all ${activeEngine === e.id ? "border-border bg-muted/40" : "border-border/40 bg-muted/10 hover:bg-muted/20"}`}>
              <Icon className={`w-5 h-5 mb-1.5 ${e.color}`} />
              <p className="text-xs font-semibold leading-tight">{e.label}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{e.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Active engine */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            {activeEngine === "mempool"   && <><Eye        className="w-5 h-5 text-orange-400" />Mempool Surveillance Engine</>}
            {activeEngine === "admin"     && <><Terminal   className="w-5 h-5 text-red-400"    />Admin Method Scanner</>}
            {activeEngine === "batch"     && <><ServerCrash className="w-5 h-5 text-orange-300"/>Batch DoS Amplification Tester</>}
            {activeEngine === "callabuse" && <><Zap        className="w-5 h-5 text-yellow-400" />eth_call Abuse Engine</>}
            {activeEngine === "intel"     && <><Fingerprint className="w-5 h-5 text-purple-400"/>Node Intelligence Engine</>}
          </CardTitle>
          <CardDescription className="text-xs">
            {activeEngine === "mempool"   && "Real-time Server-Sent Events stream of live pending transactions. Decodes calldata, identifies front-runnable swaps, multisig executions, and high-value transfers."}
            {activeEngine === "admin"     && "Probes every privileged RPC method with a real payload — personal_unlockAccount, admin_peers, debug_dumpBlock, miner_setEtherbase and 36 more. Shows live response data for any that succeed."}
            {activeEngine === "batch"     && "Tests batch request amplification at 7 sizes (5→500). Measures response time, completion rate, and calculates amplification ratio. Identifies the exact batch size at which the node's DoS protection kicks in (or doesn't)."}
            {activeEngine === "callabuse" && "11 probes testing eth_call input validation: null to-address, 1KB/4KB/32KB calldata, MAX_UINT64 gas, genesis block call, 100K-block getLogs, and more. Shows attack path + fix for each."}
            {activeEngine === "intel"     && "Full node intelligence dump: client version, Geth build commit, OS, Go runtime, chain ID, peer count, sync state, gas price, exposed API modules. Includes NVD CVE lookup URL for the detected version."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeEngine === "mempool"   && <MempoolEngine   endpoint={endpoint} />}
          {activeEngine === "admin"     && <AdminScanEngine endpoint={endpoint} />}
          {activeEngine === "batch"     && <BatchDosEngine  endpoint={endpoint} />}
          {activeEngine === "callabuse" && <CallAbuseEngine endpoint={endpoint} />}
          {activeEngine === "intel"     && <NodeIntelEngine endpoint={endpoint} />}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function DevAudit() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <ShieldAlert className="w-7 h-7 text-red-400" />
          <h1 className="text-2xl font-bold">Developer External Security Audit</h1>
        </div>
        <p className="text-muted-foreground mt-1 text-sm">
          Real external scanning tools — no simulators. Every tool makes live network calls, real blockchain queries,
          or real statistical analysis against your actual system, returning the same data an attacker would collect.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          { icon: Search,     color: "text-cyan-400",    label: "Universal Scanner", desc: "Auto-detect chain, probe all networks" },
          { icon: Cpu,        color: "text-red-400",     label: "ECDSA Scanner",     desc: "Nonce reuse & r-value collision detection" },
          { icon: Radio,      color: "text-cyan-400",    label: "RPC Probe",         desc: "Live JSON-RPC method exposure" },
          { icon: Globe,      color: "text-blue-400",    label: "Header Scanner",    desc: "Real HTTP response analysis" },
          { icon: Zap,        color: "text-purple-400",  label: "Live Contract",     desc: "On-chain bytecode & event audit" },
          { icon: KeyRound,   color: "text-green-400",   label: "Key Entropy",       desc: "Statistical RNG weakness detection" },
          { icon: Swords,     color: "text-red-400",     label: "RPC Attack Suite",  desc: "Batch amplification, cache probe, fuzzing" },
          { icon: Bug,        color: "text-orange-400",  label: "Pentest Suite",     desc: "ClickFix, SSRF, Auth Bypass, C2, DNS rebinding" },
        ].map(({ icon: Icon, color, label, desc }) => (
          <Card key={label} className="border-border/50">
            <CardContent className="pt-4 pb-3 flex items-start gap-2">
              <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${color}`} />
              <div>
                <p className="text-xs font-semibold">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Alert className="border-red-500/40 bg-red-500/8">
        <ShieldAlert className="w-4 h-4 text-red-400" />
        <AlertDescription className="text-xs">
          <strong className="text-red-400">Authorized use only.</strong> These tools make real external network requests.
          Only scan systems you own or have written permission to test. These are the exact techniques used by
          real attackers — use them to fix your system before they do.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="auto">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="auto"      className="flex items-center gap-1 text-xs font-bold text-emerald-300 data-[state=active]:bg-emerald-500/20"><Activity   className="w-3 h-3" /> Auto Report</TabsTrigger>
          <TabsTrigger value="exploit"   className="flex items-center gap-1 text-xs font-bold text-red-300    data-[state=active]:bg-red-500/20"    ><Flame      className="w-3 h-3" /> Exploit Engines</TabsTrigger>
          <TabsTrigger value="universal" className="flex items-center gap-1 text-xs"><Search        className="w-3 h-3" /> Wallet Scanner</TabsTrigger>
          <TabsTrigger value="advanced"  className="flex items-center gap-1 text-xs"><ShieldAlert   className="w-3 h-3" /> Advanced</TabsTrigger>
        </TabsList>
        <TabsList className="grid grid-cols-5 w-full mt-1">
          <TabsTrigger value="ecdsa"    className="flex items-center gap-1 text-xs"><Cpu           className="w-3 h-3" /> ECDSA</TabsTrigger>
          <TabsTrigger value="nonce"    className="flex items-center gap-1 text-xs"><ArrowDownLeft className="w-3 h-3" /> Nonce Audit</TabsTrigger>
          <TabsTrigger value="rpcfuzz"  className="flex items-center gap-1 text-xs"><Target        className="w-3 h-3" /> RPC Fuzz</TabsTrigger>
          <TabsTrigger value="pentest"  className="flex items-center gap-1 text-xs"><Bug           className="w-3 h-3" /> Pentest</TabsTrigger>
          <TabsTrigger value="attack"   className="flex items-center gap-1 text-xs"><Swords        className="w-3 h-3" /> RPC Attack</TabsTrigger>
        </TabsList>
        <TabsList className="grid grid-cols-4 w-full mt-1">
          <TabsTrigger value="rpc"      className="flex items-center gap-1 text-xs"><Radio         className="w-3 h-3" /> RPC Probe</TabsTrigger>
          <TabsTrigger value="headers"  className="flex items-center gap-1 text-xs"><Globe         className="w-3 h-3" /> Headers</TabsTrigger>
          <TabsTrigger value="contract" className="flex items-center gap-1 text-xs"><Zap           className="w-3 h-3" /> Live Contract</TabsTrigger>
          <TabsTrigger value="entropy"  className="flex items-center gap-1 text-xs"><KeyRound      className="w-3 h-3" /> Key Entropy</TabsTrigger>
        </TabsList>
        <TabsContent value="auto"      className="mt-6"><AutonomousReportTab        /></TabsContent>
        <TabsContent value="exploit"   className="mt-6"><ExploitEnginesTab          /></TabsContent>
        <TabsContent value="universal" className="mt-6"><UniversalWalletScannerTab  /></TabsContent>
        <TabsContent value="advanced"  className="mt-6"><AdvancedScannerTab         /></TabsContent>
        <TabsContent value="ecdsa"     className="mt-6"><EcdsaScannerTab            /></TabsContent>
        <TabsContent value="nonce"     className="mt-6"><NonceAuditTab              /></TabsContent>
        <TabsContent value="rpcfuzz"   className="mt-6"><RpcFuzzTab                 /></TabsContent>
        <TabsContent value="pentest"   className="mt-6"><PentestSuiteTab            /></TabsContent>
        <TabsContent value="attack"    className="mt-6"><RpcAttackSuiteTab          /></TabsContent>
        <TabsContent value="rpc"       className="mt-6"><RpcProbeTab                /></TabsContent>
        <TabsContent value="headers"   className="mt-6"><HeadersTab                 /></TabsContent>
        <TabsContent value="contract"  className="mt-6"><ContractTestTab            /></TabsContent>
        <TabsContent value="entropy"   className="mt-6"><KeyEntropyTab              /></TabsContent>
      </Tabs>
    </div>
  );
}
