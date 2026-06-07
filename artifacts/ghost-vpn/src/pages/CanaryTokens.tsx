// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Bell, BellRing, Plus, Trash2, Copy, ChevronRight,
  Globe, FileText, Mail, Code2, Link2, Clock, AlertTriangle,
  MapPin, Building2, Network, Wifi,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}/api${path}`, {
    credentials: "include", ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

const TOKEN_TYPES = [
  { key: "url",           label: "URL Token",      icon: Globe,     desc: "A unique URL that alerts when visited — embed in documents, emails, or web pages" },
  { key: "web_bug",       label: "Web Bug",         icon: Code2,     desc: "1x1 tracking pixel — undetectable in HTML emails and web pages" },
  { key: "dns",           label: "DNS Token",       icon: Link2,     desc: "A hostname that alerts on DNS resolution — works even behind firewalls" },
  { key: "email",         label: "Email Address",   icon: Mail,      desc: "An email address that alerts when emailed — detect data leaks in contact lists" },
  { key: "file_path",     label: "UNC Path",        icon: FileText,  desc: "Windows UNC path that alerts when accessed — detect file system intrusions" },
  { key: "aws_key",       label: "AWS Key",         icon: Code2,     desc: "Fake AWS access key — plant in source code or configs; AWS CloudTrail logs any usage attempt" },
  { key: "redirect",      label: "Redirect URL",    icon: Globe,     desc: "Tracking redirect — records hits then bounces user to a destination; ideal for phishing detection" },
  { key: "sql",           label: "SQL Token",       icon: FileText,  desc: "Canary value embedded in DB — detects database exfiltration via OOB or pattern matching" },
  { key: "powershell",    label: "PowerShell",      icon: Code2,     desc: "PS download cradle — embed in WMI, scheduled tasks, or scripts; triggers HTTP callback on execution" },
  { key: "pdf",           label: "PDF Token",       icon: FileText,  desc: "Instructions + URL for embedding in PDFs — triggers when document is opened with internet access" },
  { key: "slack_webhook", label: "Slack Webhook",   icon: Link2,     desc: "Fake Slack webhook URL — planted in configs; any POST triggers alert (attacker testing integrations)" },
];

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}d ago`;
  if (h > 0) return `${h}h ago`;
  if (m > 0) return `${m}m ago`;
  return "just now";
}

function TriggerBadge({ count }: { count: number }) {
  return count > 0
    ? <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-400 border border-red-400/30 bg-red-400/10 px-1.5 py-0.5 rounded animate-pulse">
        <BellRing className="w-3 h-3" />{count}
      </span>
    : <span className="text-[10px] text-primary/25 font-mono">never</span>;
}

function TriggerRow({ tr }: { tr: any }) {
  const [showHeaders, setShowHeaders] = useState(false);

  let parsedHeaders: Record<string, string> | null = null;
  if (tr.headers) {
    try { parsedHeaders = JSON.parse(tr.headers); } catch {}
  }

  return (
    <div className="border border-red-400/15 bg-red-400/5 rounded-sm overflow-hidden">
      {/* Main trigger line */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2">
        <Clock className="w-3 h-3 text-red-400/50 shrink-0" />
        <span className="text-red-400/70 text-[10px] font-mono">{new Date(tr.triggeredAt).toLocaleString()}</span>
        <span className="text-primary/60 text-[10px] font-mono font-bold">{tr.sourceIp || "unknown"}</span>
        {tr.reverseDns && (
          <span className="flex items-center gap-1 text-[10px] text-amber-400/70 font-mono">
            <Network className="w-3 h-3" />{tr.reverseDns}
          </span>
        )}
      </div>

      {/* Enrichment row */}
      {(tr.geoCountry || tr.geoCity || tr.geoOrg || tr.geoAsn || tr.cfRay) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 pb-2 border-t border-red-400/10 pt-1.5">
          {(tr.geoCountry || tr.geoCity) && (
            <span className="flex items-center gap-1 text-[10px] text-primary/50 font-mono">
              <MapPin className="w-3 h-3 text-primary/30" />
              {[tr.geoCity, tr.geoCountry].filter(Boolean).join(", ")}
            </span>
          )}
          {tr.geoOrg && (
            <span className="flex items-center gap-1 text-[10px] text-primary/50 font-mono">
              <Building2 className="w-3 h-3 text-primary/30" />{tr.geoOrg}
            </span>
          )}
          {tr.geoAsn && (
            <span className="flex items-center gap-1 text-[10px] text-primary/40 font-mono">
              <Wifi className="w-3 h-3 text-primary/25" />{tr.geoAsn}
            </span>
          )}
          {tr.cfRay && (
            <span className="text-[10px] text-cyan-400/40 font-mono">CF-Ray: {tr.cfRay}</span>
          )}
        </div>
      )}

      {/* UA + referer */}
      {(tr.userAgent || tr.referer) && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-2 pb-2">
          {tr.userAgent && (
            <span className="text-[10px] text-primary/25 font-mono truncate max-w-[340px]" title={tr.userAgent}>
              UA: {tr.userAgent.slice(0, 60)}{tr.userAgent.length > 60 ? "…" : ""}
            </span>
          )}
          {tr.referer && (
            <span className="text-[10px] text-primary/25 font-mono truncate max-w-[240px]" title={tr.referer}>
              Ref: {tr.referer.slice(0, 50)}{tr.referer.length > 50 ? "…" : ""}
            </span>
          )}
          {tr.acceptLanguage && (
            <span className="text-[10px] text-primary/20 font-mono">Lang: {tr.acceptLanguage}</span>
          )}
        </div>
      )}

      {/* Full headers toggle */}
      {parsedHeaders && (
        <div className="px-2 pb-2">
          <button
            onClick={() => setShowHeaders(s => !s)}
            className="text-[10px] text-primary/25 hover:text-primary/50 font-mono transition-colors"
          >
            {showHeaders ? "▲ hide headers" : "▼ show all headers"}
          </button>
          {showHeaders && (
            <pre className="mt-1 text-[9px] text-primary/30 font-mono bg-black/30 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-48">
              {Object.entries(parsedHeaders).map(([k, v]) => `${k}: ${v}`).join("\n")}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function CanaryTokens() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedType, setSelectedType] = useState("url");
  const [label, setLabel] = useState("");
  const [memo, setMemo] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [expandedPayload, setExpandedPayload] = useState<any>(null);

  const { data: tokens = [], isLoading } = useQuery<any[]>({
    queryKey: ["canary-tokens"],
    queryFn: () => apiFetch("/canary/tokens"),
    refetchInterval: 15_000,
  });

  const { data: triggers = [] } = useQuery<any[]>({
    queryKey: ["canary-triggers", expanded],
    queryFn: () => apiFetch(`/canary/tokens/${expanded}/triggers`),
    enabled: !!expanded,
    refetchInterval: 10_000,
  });

  const createMut = useMutation({
    mutationFn: (d: { tokenType: string; label: string; memo: string }) =>
      apiFetch("/canary/tokens", { method: "POST", body: JSON.stringify(d) }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["canary-tokens"] });
      setShowCreate(false);
      setLabel("");
      setMemo("");
      setExpandedPayload(data);
      toast({ title: "Token Created", description: `${data.tokenType} canary deployed` });
    },
    onError: () => toast({ title: "Failed to create token", variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/canary/tokens/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["canary-tokens"] });
      toast({ title: "Token deleted" });
    },
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const IconFor = (type: string) => {
    const t = TOKEN_TYPES.find(t => t.key === type);
    return t?.icon || Globe;
  };

  return (
    <div className="p-4 md:p-6 space-y-6 font-mono min-h-screen">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Bell className="w-5 h-5 text-[#00ff88]" />
            <h1 className="text-lg font-bold text-primary tracking-tight">Canary Tokens</h1>
            <Badge className="text-[9px] border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88] font-mono uppercase tracking-widest px-1.5">Trap</Badge>
          </div>
          <p className="text-xs text-primary/40 max-w-xl leading-relaxed">
            Deploy invisible tracking tokens. Every trigger captures IP, reverse DNS hostname, ISP/org, ASN, geo location, browser fingerprint, and all request headers — even behind proxies and VPNs.
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(s => !s)}
          className="bg-[#00ff88] hover:bg-[#00ff88]/80 text-black font-bold font-mono text-xs px-4 rounded-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />New Token
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="border border-primary/10 bg-primary/2 p-3 rounded-sm">
          <div className="text-[10px] text-primary/40 uppercase tracking-wider mb-1">Active Tokens</div>
          <span className="text-xl font-bold text-[#00ff88]">{tokens.filter(t => t.active).length}</span>
        </div>
        <div className="border border-primary/10 bg-primary/2 p-3 rounded-sm">
          <div className="text-[10px] text-primary/40 uppercase tracking-wider mb-1">Total Triggers</div>
          <span className={`text-xl font-bold ${tokens.some(t => t.triggerCount > 0) ? "text-red-400" : "text-primary/30"}`}>
            {tokens.reduce((s, t) => s + t.triggerCount, 0)}
          </span>
        </div>
        <div className="border border-primary/10 bg-primary/2 p-3 rounded-sm">
          <div className="text-[10px] text-primary/40 uppercase tracking-wider mb-1">Types Available</div>
          <span className="text-xl font-bold text-[#00ff88]">{TOKEN_TYPES.length}</span>
        </div>
      </div>

      {/* What gets captured info box */}
      <div className="border border-primary/10 bg-primary/3 p-3 rounded-sm">
        <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-2">Captured on every trigger</div>
        <div className="flex flex-wrap gap-2">
          {[
            { icon: Network, label: "Source IP" },
            { icon: Network, label: "Reverse DNS (PTR)" },
            { icon: Building2, label: "ISP / Organization" },
            { icon: Wifi, label: "ASN" },
            { icon: MapPin, label: "Country & City" },
            { icon: Globe, label: "User Agent" },
            { icon: Link2, label: "Referer" },
            { icon: FileText, label: "All HTTP Headers" },
            { icon: Globe, label: "Accept-Language" },
            { icon: Globe, label: "CF-Ray (if Cloudflare)" },
          ].map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1 text-[10px] text-primary/50 border border-primary/10 px-2 py-0.5 rounded-sm">
              <Icon className="w-3 h-3 text-[#00ff88]/50" />{label}
            </span>
          ))}
        </div>
      </div>

      {/* Create token form */}
      {showCreate && (
        <div className="border border-[#00ff88]/20 bg-[#00ff88]/3 p-4 rounded-sm space-y-4">
          <div className="text-[10px] text-[#00ff88]/60 uppercase tracking-widest">Deploy New Canary Token</div>

          <div>
            <div className="text-[10px] text-primary/40 uppercase tracking-wider mb-2">Token Type</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {TOKEN_TYPES.map(t => (
                <button
                  key={t.key}
                  onClick={() => setSelectedType(t.key)}
                  className={`flex items-start gap-2.5 p-2.5 border rounded-sm text-left transition-all ${
                    selectedType === t.key
                      ? "border-[#00ff88]/40 bg-[#00ff88]/8"
                      : "border-primary/15 hover:border-primary/25"
                  }`}
                >
                  <t.icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${selectedType === t.key ? "text-[#00ff88]" : "text-primary/40"}`} />
                  <div>
                    <div className={`text-xs font-bold ${selectedType === t.key ? "text-[#00ff88]" : "text-primary/70"}`}>{t.label}</div>
                    <div className="text-[10px] text-primary/30 leading-snug mt-0.5">{t.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] text-primary/40 uppercase tracking-wider mb-1">Label</div>
              <input
                value={label}
                onChange={e => setLabel(e.target.value)}
                placeholder="e.g. Board meeting report Q4"
                className="w-full bg-black/40 border border-primary/20 text-primary text-xs font-mono px-3 py-2 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm"
              />
            </div>
            <div>
              <div className="text-[10px] text-primary/40 uppercase tracking-wider mb-1">Memo (optional)</div>
              <input
                value={memo}
                onChange={e => setMemo(e.target.value)}
                placeholder="Where is this deployed?"
                className="w-full bg-black/40 border border-primary/20 text-primary text-xs font-mono px-3 py-2 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => label.trim() && createMut.mutate({ tokenType: selectedType, label: label.trim(), memo })}
              disabled={!label.trim() || createMut.isPending}
              className="bg-[#00ff88] hover:bg-[#00ff88]/80 text-black font-bold font-mono text-xs rounded-sm"
            >
              Deploy Token
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowCreate(false)}
              className="border-primary/20 text-primary/50 font-mono text-xs rounded-sm"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* New token payload display */}
      {expandedPayload && (
        <div className="border border-[#00ff88]/30 bg-[#00ff88]/5 p-4 rounded-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] text-[#00ff88]/60 uppercase tracking-widest">Token Deployed — Copy Payload</div>
            <button onClick={() => setExpandedPayload(null)} className="text-[10px] text-primary/30 hover:text-primary/60">Dismiss</button>
          </div>
          <pre className="text-xs text-[#00ff88]/80 bg-black/40 p-3 rounded overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(expandedPayload.payload, null, 2)}
          </pre>
          {expandedPayload.payload?.url && (
            <button
              onClick={() => copy(expandedPayload.payload.url)}
              className="mt-2 flex items-center gap-2 text-[10px] border border-[#00ff88]/20 text-[#00ff88]/60 hover:text-[#00ff88] px-2 py-1 rounded transition-colors"
            >
              <Copy className="w-3 h-3" />Copy URL
            </button>
          )}
        </div>
      )}

      {/* Token list */}
      <div className="space-y-2">
        <div className="text-[10px] text-primary/40 uppercase tracking-widest">Deployed Tokens ({tokens.length})</div>

        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 border border-primary/10 animate-pulse rounded-sm" />)
        ) : tokens.length === 0 ? (
          <div className="border border-primary/10 p-8 text-center rounded-sm">
            <Bell className="w-6 h-6 text-primary/15 mx-auto mb-2" />
            <div className="text-xs text-primary/20">No tokens deployed yet</div>
            <div className="text-[10px] text-primary/15 mt-1">Create a token to begin monitoring for unauthorized access</div>
          </div>
        ) : (
          tokens.map(token => {
            const TokenIcon = IconFor(token.tokenType);
            const isTriggered = token.triggerCount > 0;
            const meta = token.metadataJson ? (() => { try { return JSON.parse(token.metadataJson); } catch { return null; } })() : null;

            return (
              <div key={token.id} className={`border rounded-sm overflow-hidden ${isTriggered ? "border-red-400/30" : "border-primary/10"}`}>
                <div
                  className="flex items-center gap-3 p-3 cursor-pointer hover:bg-primary/3 transition-colors"
                  onClick={() => setExpanded(expanded === token.id ? null : token.id)}
                >
                  <TokenIcon className={`w-4 h-4 shrink-0 ${isTriggered ? "text-red-400" : "text-primary/40"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-primary">{token.label}</span>
                      {isTriggered && <AlertTriangle className="w-3 h-3 text-red-400 animate-pulse" />}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-primary/30">{TOKEN_TYPES.find(t => t.key === token.tokenType)?.label}</span>
                      {token.memo && <span className="text-[10px] text-primary/20">— {token.memo}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <TriggerBadge count={token.triggerCount} />
                    {token.lastTriggeredAt && (
                      <span className="text-[10px] text-primary/30">{timeAgo(token.lastTriggeredAt)}</span>
                    )}
                    {meta?.url && (
                      <button
                        onClick={e => { e.stopPropagation(); copy(meta.url); }}
                        className="text-primary/25 hover:text-[#00ff88] transition-colors"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={e => { e.stopPropagation(); deleteMut.mutate(token.id); }}
                      className="text-primary/20 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <ChevronRight className={`w-3.5 h-3.5 text-primary/20 transition-transform ${expanded === token.id ? "rotate-90" : ""}`} />
                  </div>
                </div>

                {expanded === token.id && (
                  <div className="border-t border-primary/10 bg-black/20 p-3 space-y-3">
                    {meta && (
                      <div>
                        <div className="text-[10px] text-primary/30 uppercase tracking-wider mb-2">Token Payload</div>
                        <pre className="text-[10px] text-[#00ff88]/70 bg-black/30 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(meta, null, 2)}
                        </pre>
                      </div>
                    )}

                    {triggers.length > 0 && (
                      <div>
                        <div className="text-[10px] text-red-400/70 uppercase tracking-wider mb-2 flex items-center gap-1">
                          <BellRing className="w-3 h-3" />Trigger Log ({triggers.length}) — full intel captured
                        </div>
                        <div className="space-y-1.5">
                          {triggers.slice(0, 20).map((tr: any) => (
                            <TriggerRow key={tr.id} tr={tr} />
                          ))}
                          {triggers.length > 20 && (
                            <div className="text-[10px] text-primary/25 text-center py-1">
                              + {triggers.length - 20} older triggers
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {token.triggerCount === 0 && (
                      <div className="text-center py-3 text-[#00ff88]/30 text-xs">
                        <Bell className="w-4 h-4 mx-auto mb-1 opacity-40" />
                        Token active — waiting for trigger
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
