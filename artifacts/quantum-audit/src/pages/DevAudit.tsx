import { useState } from "react";
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
  ServerCrash, BarChart3, Eye,
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Radio,    color: "text-cyan-400",    label: "RPC Probe",         desc: "Live JSON-RPC method exposure" },
          { icon: Globe,    color: "text-blue-400",    label: "Header Scanner",    desc: "Real HTTP response analysis" },
          { icon: Zap,      color: "text-purple-400",  label: "Live Contract",     desc: "On-chain bytecode & event audit" },
          { icon: KeyRound, color: "text-green-400",   label: "Key Entropy",       desc: "Statistical RNG weakness detection" },
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

      <Tabs defaultValue="rpc">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="rpc"     className="flex items-center gap-1 text-xs"><Radio    className="w-3 h-3" /> RPC Probe</TabsTrigger>
          <TabsTrigger value="headers" className="flex items-center gap-1 text-xs"><Globe    className="w-3 h-3" /> Headers</TabsTrigger>
          <TabsTrigger value="contract"className="flex items-center gap-1 text-xs"><Zap      className="w-3 h-3" /> Live Contract</TabsTrigger>
          <TabsTrigger value="entropy" className="flex items-center gap-1 text-xs"><KeyRound className="w-3 h-3" /> Key Entropy</TabsTrigger>
        </TabsList>
        <TabsContent value="rpc"      className="mt-6"><RpcProbeTab      /></TabsContent>
        <TabsContent value="headers"  className="mt-6"><HeadersTab       /></TabsContent>
        <TabsContent value="contract" className="mt-6"><ContractTestTab  /></TabsContent>
        <TabsContent value="entropy"  className="mt-6"><KeyEntropyTab    /></TabsContent>
      </Tabs>
    </div>
  );
}
