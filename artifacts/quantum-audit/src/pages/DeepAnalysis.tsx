import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  Code2, ShieldAlert, AlertTriangle, Download, ChevronDown, ChevronRight,
  CheckCircle, XCircle, Info, Zap, Bug, Lock, RefreshCw
} from "lucide-react";

const SEV_STYLE: Record<string, string> = {
  critical: "text-red-400 border-red-500/40 bg-red-500/10",
  high: "text-orange-400 border-orange-500/40 bg-orange-500/10",
  medium: "text-yellow-400 border-yellow-500/40 bg-yellow-500/10",
  low: "text-blue-400 border-blue-500/40 bg-blue-500/10",
};

const CONF_STYLE: Record<string, string> = {
  confirmed: "bg-red-500/20 text-red-400 border-red-500/30",
  likely: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  possible: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
};

const CAT_ICON: Record<string, string> = {
  reentrancy: "🔁",
  "access-control": "🔐",
  integer: "🔢",
  "flash-loan": "⚡",
  signature: "✍️",
  oracle: "📡",
  logic: "⚙️",
  gas: "⛽",
  quantum: "⚛️",
};

const CHAINS = [
  { value: "ethereum", label: "Ethereum" },
  { value: "polygon", label: "Polygon" },
  { value: "bsc", label: "BNB Chain" },
  { value: "arbitrum", label: "Arbitrum" },
  { value: "avalanche", label: "Avalanche" },
  { value: "optimism", label: "Optimism" },
];

type Finding = {
  id: string; name: string; category: string; severity: string;
  lineNumber: number; lineContent: string; codeSnippet: string;
  confidence: string; description: string; howToExploit: string;
  howToFix: string; exploitDetail: string; cweId: string; swcId: string;
};

type Report = {
  contractAddress: string; chain: string; contractName: string;
  compilerVersion: string; isVerified: boolean; sourceLines: number;
  analysisTimestamp: string; findings: Finding[];
  summary: {
    totalFindings: number; critical: number; high: number; medium: number; low: number;
    riskScore: number; riskLevel: string; categories: Record<string, number>;
    isAuditReady: boolean; auditReadinessNotes: string[];
  };
  contractInfo: {
    name: string; inheritsFrom: string[]; hasOwnable: boolean;
    hasReentrancyGuard: boolean; hasSafeMath: boolean; hasAccessControl: boolean;
    isERC20: boolean; isERC721: boolean; isUpgradeable: boolean; isProxy: boolean;
    totalFunctions: number; payableFunctions: number; externalFunctions: number;
    events: string[];
    functions: { name: string; visibility: string; isPayable: boolean; modifiers: string[] }[];
  };
  bugBountyReport: string;
};

export default function DeepAnalysis() {
  const [mode, setMode] = useState<"address" | "source">("address");
  const [chain, setChain] = useState("ethereum");
  const [address, setAddress] = useState("");
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [activeTab, setActiveTab] = useState<"findings" | "contract" | "functions">("findings");
  const [filterSev, setFilterSev] = useState<string>("all");

  const toggle = (k: string) => setExpanded(p => ({ ...p, [k]: !p[k] }));

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const base = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const body = mode === "address"
        ? { address, chain }
        : { address: "paste-source", chain, source };
      const res = await fetch(`${base}/api/quantum-audit/deep-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.detail ?? json.error ?? "Analysis failed");
      setReport(json as Report);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([report.bugBountyReport], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deep-analysis-${report.contractName}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredFindings = report?.findings.filter(f =>
    filterSev === "all" ? true : f.severity === filterSev
  ) ?? [];

  const riskColor = report ? (
    report.summary.riskLevel === "critical" ? "border-red-500 bg-red-500/5 text-red-400" :
    report.summary.riskLevel === "high" ? "border-orange-500 bg-orange-500/5 text-orange-400" :
    report.summary.riskLevel === "medium" ? "border-yellow-500 bg-yellow-500/5 text-yellow-400" :
    "border-green-500 bg-green-500/5 text-green-400"
  ) : "";

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
            <Code2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-mono">Deep Contract Analysis</h1>
            <p className="text-sm text-muted-foreground">
              Line-level vulnerability detection — reentrancy · access control · flash loans · integer bugs · signature exploits · quantum
            </p>
          </div>
        </div>
        {report && (
          <Button onClick={downloadReport} variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
            <Download className="w-4 h-4" /> Bug Bounty Report
          </Button>
        )}
      </div>

      {/* Input */}
      <Card className="border-primary/30 bg-card/80">
        <CardContent className="p-6 space-y-4">
          {/* Mode toggle */}
          <div className="flex gap-2">
            {(["address", "source"] as const).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-4 py-1.5 rounded text-sm font-mono transition-colors ${mode === m ? "bg-primary text-black font-bold" : "bg-card border border-border/50 text-muted-foreground hover:text-foreground"}`}
              >
                {m === "address" ? "📍 By Contract Address" : "📄 Paste Source Code"}
              </button>
            ))}
          </div>

          {mode === "address" ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <Select value={chain} onValueChange={setChain}>
                <SelectTrigger className="font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CHAINS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="md:col-span-3">
                <Input
                  placeholder="0x... contract address (must be verified on Etherscan)"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="font-mono text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-mono text-muted-foreground">PASTE SOLIDITY SOURCE CODE</label>
              <Textarea
                placeholder={`// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract MyContract {\n    ...`}
                value={source}
                onChange={e => setSource(e.target.value)}
                className="font-mono text-xs h-48 resize-y"
              />
              <p className="text-xs text-muted-foreground">Paste your full Solidity source — the analyzer reads every line and flags issues with exact line numbers.</p>
            </div>
          )}

          <Button
            onClick={runAnalysis}
            disabled={loading || (mode === "address" ? !address.trim() : !source.trim())}
            className="bg-primary text-black hover:bg-primary/90 font-bold gap-2"
          >
            {loading
              ? <><RefreshCw className="w-4 h-4 animate-spin" /> Analyzing Source Code…</>
              : <><Bug className="w-4 h-4" /> Run Deep Analysis</>}
          </Button>

          {mode === "address" && (
            <p className="text-xs text-muted-foreground font-mono">
              ℹ Source code is fetched automatically from Etherscan. Unverified contracts can still be scanned via "Paste Source Code" mode.
            </p>
          )}
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="p-4 flex gap-3 items-start">
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-destructive">Analysis Error</p>
              <p className="text-sm text-muted-foreground mt-1">{error}</p>
              {error.includes("not verified") || error.includes("fetch") ? (
                <p className="text-xs text-muted-foreground mt-2">Try using "Paste Source Code" mode if the contract source is not verified on Etherscan.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      )}

      {report && (
        <>
          {/* Risk banner */}
          <div className={`p-5 rounded-xl border-2 ${riskColor}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <ShieldAlert className="w-7 h-7 flex-shrink-0" />
                <div>
                  <p className="font-bold font-mono text-xl">{report.contractName} — Risk Score: {report.summary.riskScore}/100</p>
                  <p className="text-sm mt-0.5 opacity-80">
                    {report.summary.critical} critical · {report.summary.high} high · {report.summary.medium} medium · {report.summary.low} low
                    {" "}| {report.sourceLines} lines analyzed | Compiler: {report.compilerVersion}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {report.isVerified
                  ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1"><CheckCircle className="w-3 h-3" />Source Verified</Badge>
                  : <Badge className="bg-red-500/20 text-red-400 border-red-500/30 gap-1"><XCircle className="w-3 h-3" />Unverified</Badge>}
                <Badge className={`${report.summary.isAuditReady ? "bg-green-500/20 text-green-400 border-green-500/30" : "bg-red-500/20 text-red-400 border-red-500/30"}`}>
                  {report.summary.isAuditReady ? "Audit Ready" : "Needs Remediation"}
                </Badge>
              </div>
            </div>

            {/* Risk bars */}
            <div className="grid grid-cols-4 gap-2 mt-4">
              {[
                { label: "Critical", count: report.summary.critical, color: "bg-red-500" },
                { label: "High", count: report.summary.high, color: "bg-orange-500" },
                { label: "Medium", count: report.summary.medium, color: "bg-yellow-500" },
                { label: "Low", count: report.summary.low, color: "bg-blue-500" },
              ].map(({ label, count, color }) => (
                <div key={label} className="text-center bg-black/30 rounded p-2">
                  <div className="text-2xl font-bold font-mono">{count}</div>
                  <div className="text-xs font-mono opacity-70">{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Audit readiness notes */}
          {report.summary.auditReadinessNotes.length > 0 && (
            <Card className="border-yellow-500/30 bg-yellow-500/5">
              <CardContent className="p-4 space-y-1">
                <p className="text-xs font-mono text-yellow-400 font-bold mb-2">AUDIT READINESS NOTES</p>
                {report.summary.auditReadinessNotes.map((n, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <Info className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">{n}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Tabs */}
          <div className="flex gap-2 border-b border-border/50 pb-0">
            {([
              { key: "findings", label: `Findings (${report.findings.length})` },
              { key: "contract", label: "Contract Info" },
              { key: "functions", label: `Functions (${report.contractInfo.totalFunctions})` },
            ] as const).map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-mono transition-colors border-b-2 -mb-px ${activeTab === tab.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Findings tab */}
          {activeTab === "findings" && (
            <div className="space-y-3">
              {/* Filter */}
              <div className="flex gap-2 flex-wrap">
                {["all", "critical", "high", "medium", "low"].map(sev => (
                  <button
                    key={sev}
                    onClick={() => setFilterSev(sev)}
                    className={`px-3 py-1 rounded text-xs font-mono transition-colors ${filterSev === sev ? "bg-primary text-black font-bold" : "bg-card border border-border/50 text-muted-foreground"}`}
                  >
                    {sev === "all" ? `All (${report.findings.length})` : `${sev.charAt(0).toUpperCase() + sev.slice(1)} (${report.summary[sev as "critical" | "high" | "medium" | "low"]})`}
                  </button>
                ))}
              </div>

              {filteredFindings.length === 0 && (
                <Card className="border-green-500/30 bg-green-500/5">
                  <CardContent className="p-6 text-center">
                    <CheckCircle className="w-8 h-8 text-green-400 mx-auto mb-2" />
                    <p className="text-green-400 font-mono font-bold">No {filterSev === "all" ? "" : filterSev + " "}findings detected</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {filterSev === "all"
                        ? "The analyzer found no known vulnerability patterns in this source code."
                        : `No ${filterSev} severity issues found. Try viewing all findings.`}
                    </p>
                  </CardContent>
                </Card>
              )}

              {filteredFindings.map((f, i) => (
                <div key={i} className={`border rounded-xl overflow-hidden ${SEV_STYLE[f.severity]}`}>
                  {/* Finding header */}
                  <button
                    onClick={() => toggle(`finding-${i}`)}
                    className="w-full flex items-start justify-between p-4 hover:bg-white/5 text-left gap-3"
                  >
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-2xl flex-shrink-0">{CAT_ICON[f.category] ?? "🔍"}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className={`text-xs font-mono ${SEV_STYLE[f.severity]}`}>
                            {f.severity.toUpperCase()}
                          </Badge>
                          <Badge variant="outline" className={`text-xs font-mono ${CONF_STYLE[f.confidence]}`}>
                            {f.confidence}
                          </Badge>
                          <span className="text-xs font-mono text-muted-foreground">{f.id}</span>
                          <span className="text-xs font-mono text-muted-foreground">{f.cweId}</span>
                          <span className="text-xs font-mono text-muted-foreground">{f.swcId}</span>
                        </div>
                        <p className="font-bold text-sm">{f.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Line {f.lineNumber} — {f.lineContent.slice(0, 80)}{f.lineContent.length > 80 ? "…" : ""}</p>
                      </div>
                    </div>
                    {expanded[`finding-${i}`] ? <ChevronDown className="w-4 h-4 flex-shrink-0 mt-1" /> : <ChevronRight className="w-4 h-4 flex-shrink-0 mt-1" />}
                  </button>

                  {/* Finding details */}
                  {expanded[`finding-${i}`] && (
                    <div className="border-t border-current/20 bg-background/60 space-y-0">
                      {/* Code snippet */}
                      <div className="p-4 border-b border-border/30">
                        <p className="text-xs font-mono text-muted-foreground mb-2">📍 AFFECTED CODE (Line {f.lineNumber})</p>
                        <pre className="text-xs font-mono bg-black/60 rounded p-3 overflow-x-auto text-orange-300 whitespace-pre-wrap">
                          {f.codeSnippet}
                        </pre>
                      </div>

                      {/* Description */}
                      <div className="p-4 border-b border-border/30">
                        <p className="text-xs font-mono text-muted-foreground mb-2">📋 WHAT IS THIS VULNERABILITY?</p>
                        <p className="text-sm">{f.description}</p>
                      </div>

                      {/* How to exploit */}
                      <div className="p-4 border-b border-border/30 bg-red-500/5">
                        <p className="text-xs font-mono text-red-400 mb-2">💥 HOW AN ATTACKER WOULD EXPLOIT THIS</p>
                        <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap bg-black/40 rounded p-3">{f.howToExploit}</pre>
                        <p className="text-xs text-red-400/70 mt-2 font-mono">{f.exploitDetail}</p>
                      </div>

                      {/* How to fix */}
                      <div className="p-4 bg-primary/5">
                        <p className="text-xs font-mono text-primary mb-2">✅ HOW TO FIX THIS</p>
                        <p className="text-sm">{f.howToFix}</p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Contract info tab */}
          {activeTab === "contract" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: "ERC-20 Token", value: report.contractInfo.isERC20, bool: true },
                  { label: "ERC-721 NFT", value: report.contractInfo.isERC721, bool: true },
                  { label: "Ownable", value: report.contractInfo.hasOwnable, bool: true },
                  { label: "ReentrancyGuard", value: report.contractInfo.hasReentrancyGuard, bool: true },
                  { label: "SafeMath", value: report.contractInfo.hasSafeMath, bool: true },
                  { label: "Access Control", value: report.contractInfo.hasAccessControl, bool: true },
                  { label: "Upgradeable", value: report.contractInfo.isUpgradeable, bool: true },
                  { label: "Proxy Contract", value: report.contractInfo.isProxy, bool: true },
                ].map(({ label, value, bool }) => (
                  <Card key={label} className="border-border/50">
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground font-mono">{label}</p>
                      <p className={`font-bold text-sm mt-1 font-mono ${bool ? (value ? "text-green-400" : "text-muted-foreground") : "text-foreground"}`}>
                        {bool ? (value ? "✓ Yes" : "No") : String(value)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {report.contractInfo.inheritsFrom.length > 0 && (
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <p className="text-xs font-mono text-muted-foreground mb-2">INHERITS FROM</p>
                    <div className="flex gap-2 flex-wrap">
                      {report.contractInfo.inheritsFrom.map((c, i) => (
                        <Badge key={i} variant="outline" className="font-mono text-xs">{c}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {report.contractInfo.events.length > 0 && (
                <Card className="border-border/50">
                  <CardContent className="p-4">
                    <p className="text-xs font-mono text-muted-foreground mb-2">EVENTS ({report.contractInfo.events.length})</p>
                    <div className="space-y-1">
                      {report.contractInfo.events.slice(0, 10).map((e, i) => (
                        <code key={i} className="block text-xs font-mono text-muted-foreground">{e}</code>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card className="border-border/50">
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs font-mono text-muted-foreground mb-2">VULNERABILITY CATEGORIES BREAKDOWN</p>
                  {Object.entries(report.summary.categories).map(([cat, count]) => (
                    <div key={cat} className="flex items-center gap-3">
                      <span className="w-5">{CAT_ICON[cat] ?? "🔍"}</span>
                      <span className="text-sm font-mono flex-1 capitalize">{cat.replace(/-/g, " ")}</span>
                      <span className="font-bold font-mono text-primary">{count}</span>
                      <div className="w-32 bg-border/30 rounded-full h-1.5">
                        <div className="bg-primary h-1.5 rounded-full" style={{ width: `${Math.min(100, count * 20)}%` }} />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}

          {/* Functions tab */}
          {activeTab === "functions" && (
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="space-y-2">
                  {report.contractInfo.functions.map((fn, i) => {
                    const fnFindings = report.findings.filter(f => f.lineContent.toLowerCase().includes(fn.name.toLowerCase()));
                    return (
                      <div key={i} className={`flex items-center gap-3 p-2 rounded border text-xs font-mono ${fnFindings.length > 0 ? "border-orange-500/30 bg-orange-500/5" : "border-border/30 bg-card/30"}`}>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${fn.visibility === "external" || fn.visibility === "public" ? "bg-primary/20 text-primary" : "bg-border/30 text-muted-foreground"}`}>
                          {fn.visibility}
                        </span>
                        <span className="text-foreground font-bold flex-1">{fn.name}()</span>
                        {fn.isPayable && <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">payable</Badge>}
                        {fn.modifiers.map(m => <Badge key={m} className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">{m}</Badge>)}
                        {fnFindings.length > 0 && (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">
                            {fnFindings.length} finding{fnFindings.length > 1 ? "s" : ""}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
