// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { Shield, ShieldAlert, ShieldOff, RefreshCw, ToggleLeft, ToggleRight, Search, Zap, AlertTriangle, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

import { apiFetch } from "@/lib/apiClient";

interface CategoryStat {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  domainCount: number;
  lastUpdated: string | null;
  loaded: boolean;
}

interface ThreatStatus {
  enabled: boolean;
  totalBlockedDomains: number;
  blockedRequestsToday: number;
  categories: CategoryStat[];
  recentBlocks: Array<{ domain: string; category: string; ts: string }>;
  lastRefresh: string | null;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return n.toString();
}

export default function ThreatProtection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [domainCheck, setDomainCheck] = useState("");
  const [checkResult, setCheckResult] = useState<{ domain: string; blocked: boolean; threats: { category: string; label: string }[] } | null>(null);

  const { data: status, isLoading } = useQuery<ThreatStatus>({
    queryKey: ["threat-protection-status"],
    queryFn: () => apiFetch("/threat-protection/status"),
    refetchInterval: 8000,
  });

  const toggleMain = useMutation({
    mutationFn: (enabled: boolean) =>
      apiFetch("/threat-protection/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: (data) => {
      toast({ title: data.enabled ? "Threat Protection ACTIVE" : "Threat Protection DISABLED", description: data.message });
      qc.invalidateQueries({ queryKey: ["threat-protection-status"] });
    },
  });

  const toggleCategory = useMutation({
    mutationFn: (id: string) => apiFetch(`/threat-protection/categories/${id}/toggle`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["threat-protection-status"] }),
  });

  const refresh = useMutation({
    mutationFn: () => apiFetch("/threat-protection/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }),
    onSuccess: () => {
      toast({ title: "Blocklists Refreshed", description: "All categories updated from live sources." });
      qc.invalidateQueries({ queryKey: ["threat-protection-status"] });
    },
  });

  const checkDomain = async () => {
    if (!domainCheck.trim()) return;
    try {
      const res = await apiFetch("/threat-protection/check-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainCheck.trim() }),
      });
      setCheckResult(res);
    } catch {
      toast({ title: "Check failed", variant: "destructive" });
    }
  };

  const categoryColors: Record<string, string> = {
    malware: "border-red-500/40 text-red-400",
    ads: "border-yellow-500/40 text-yellow-400",
    phishing: "border-orange-500/40 text-orange-400",
    combined: "border-primary/40 text-primary",
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
          <ShieldAlert className="w-6 h-6" />
          Threat Protection
        </h2>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-primary/40 text-primary hover:bg-primary/20 text-xs"
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending}
          >
            <RefreshCw className={`w-3 h-3 mr-1 ${refresh.isPending ? "animate-spin" : ""}`} />
            REFRESH LISTS
          </Button>
          <Button
            variant={status?.enabled ? "default" : "destructive"}
            className={status?.enabled ? "bg-primary text-black hover:bg-primary/80" : ""}
            onClick={() => toggleMain.mutate(!status?.enabled)}
            disabled={toggleMain.isPending}
          >
            {status?.enabled ? <ToggleRight className="w-4 h-4 mr-2" /> : <ToggleLeft className="w-4 h-4 mr-2" />}
            {status?.enabled ? "ENABLED" : "DISABLED"}
          </Button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="border border-primary/20 bg-black p-4 rounded">
          <span className="text-xs text-primary/50 uppercase">Status</span>
          <div className={`font-mono font-bold mt-1 ${status?.enabled ? "text-primary" : "text-destructive"}`}>
            {isLoading ? "..." : status?.enabled ? "ACTIVE" : "INACTIVE"}
          </div>
        </div>
        <div className="border border-primary/20 bg-black p-4 rounded">
          <span className="text-xs text-primary/50 uppercase">Domains Blocked</span>
          <div className="font-mono font-bold mt-1 text-primary">
            {isLoading ? "..." : formatCount(status?.totalBlockedDomains ?? 0)}
          </div>
        </div>
        <div className="border border-primary/20 bg-black p-4 rounded">
          <span className="text-xs text-primary/50 uppercase">Blocked Today</span>
          <div className="font-mono font-bold mt-1 text-destructive">
            {isLoading ? "..." : (status?.blockedRequestsToday ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="border border-primary/20 bg-black p-4 rounded">
          <span className="text-xs text-primary/50 uppercase">Categories Active</span>
          <div className="font-mono font-bold mt-1 text-primary">
            {isLoading ? "..." : `${status?.categories?.filter(c => c.enabled).length ?? 0} / ${status?.categories?.length ?? 0}`}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Blocklist categories */}
        <div className="border border-primary/20 bg-black rounded p-4 space-y-4">
          <h3 className="text-sm font-bold text-primary/70 uppercase tracking-widest border-b border-primary/20 pb-2">
            Blocklist Categories
          </h3>
          <div className="space-y-3">
            {(status?.categories ?? []).map((cat) => (
              <div key={cat.id} className="flex items-start justify-between gap-3 p-3 border border-primary/10 rounded hover:border-primary/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs font-bold text-primary">{cat.label}</span>
                    {cat.loaded ? (
                      <Badge variant="outline" className={`text-[9px] px-1 py-0 ${categoryColors[cat.id] ?? "border-primary/30 text-primary"}`}>
                        {formatCount(cat.domainCount)} domains
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[9px] px-1 py-0 border-primary/20 text-primary/40 animate-pulse">
                        Loading...
                      </Badge>
                    )}
                  </div>
                  <p className="text-[10px] text-primary/40 mt-0.5">{cat.description}</p>
                  {cat.lastUpdated && (
                    <p className="text-[9px] text-primary/25 mt-1">
                      Updated {new Date(cat.lastUpdated).toLocaleString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => toggleCategory.mutate(cat.id)}
                  disabled={toggleCategory.isPending}
                  className={`shrink-0 text-xs font-mono px-3 py-1 rounded border transition-colors ${
                    cat.enabled
                      ? "border-primary/40 text-primary hover:bg-primary/10"
                      : "border-primary/10 text-primary/30 hover:border-primary/30 hover:text-primary/60"
                  }`}
                >
                  {cat.enabled ? "ON" : "OFF"}
                </button>
              </div>
            ))}
            {!status?.categories?.length && (
              <div className="text-center text-primary/30 font-mono text-xs py-6">Loading blocklists...</div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Domain checker */}
          <div className="border border-primary/20 bg-black rounded p-4 space-y-4">
            <h3 className="text-sm font-bold text-primary/70 uppercase tracking-widest border-b border-primary/20 pb-2">
              Domain Threat Check
            </h3>
            <div className="flex gap-2">
              <Input
                value={domainCheck}
                onChange={e => setDomainCheck(e.target.value)}
                onKeyDown={e => e.key === "Enter" && checkDomain()}
                placeholder="Enter domain to check..."
                className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8 focus-visible:ring-primary/40"
              />
              <Button size="sm" onClick={checkDomain} className="bg-primary text-black hover:bg-primary/80 text-xs h-8 px-3">
                <Search className="w-3 h-3" />
              </Button>
            </div>
            {checkResult && (
              <div className={`p-3 rounded border font-mono text-xs ${checkResult.blocked ? "border-destructive/50 bg-destructive/10" : "border-primary/30 bg-primary/5"}`}>
                <div className="flex items-center gap-2 mb-2">
                  {checkResult.blocked
                    ? <><ShieldOff className="w-4 h-4 text-destructive" /><span className="text-destructive font-bold">THREAT DETECTED</span></>
                    : <><Check className="w-4 h-4 text-primary" /><span className="text-primary font-bold">CLEAN</span></>
                  }
                </div>
                <div className="text-primary/60">{checkResult.domain}</div>
                {checkResult.threats.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {checkResult.threats.map((t, i) => (
                      <div key={i} className="text-destructive/70 text-[10px]">• {t.label}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Recent blocks */}
          <div className="border border-primary/20 bg-black rounded p-4 space-y-3">
            <h3 className="text-sm font-bold text-primary/70 uppercase tracking-widest border-b border-primary/20 pb-2">
              Recent Blocks
            </h3>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {(status?.recentBlocks ?? []).length === 0 ? (
                <div className="text-center text-primary/25 font-mono text-xs py-4">No blocks recorded yet</div>
              ) : (
                status?.recentBlocks?.slice(0, 20).map((b, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px] font-mono py-1 border-b border-primary/5">
                    <span className="text-destructive/80 truncate max-w-[160px]">{b.domain}</span>
                    <span className="text-primary/30 shrink-0">{new Date(b.ts).toLocaleTimeString()}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="border border-primary/10 bg-black/50 rounded p-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-primary/50 uppercase tracking-widest">
          <Zap className="w-3 h-3" />
          How Threat Protection Works
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[11px] text-primary/50 font-mono">
          <div>
            <div className="text-primary/70 font-bold mb-1">DNS-Layer Blocking</div>
            Cross-references every DNS lookup against {formatCount(status?.totalBlockedDomains ?? 0)}+ known malware, phishing, and tracking domains. Matching requests are dropped before a connection is established.
          </div>
          <div>
            <div className="text-primary/70 font-bold mb-1">Live Blocklists</div>
            Lists are sourced from StevenBlack's open-source host lists, refreshed every 6 hours automatically. Covers ransomware C&C, ad networks, phishing infrastructure, and spam servers.
          </div>
          <div>
            <div className="text-primary/70 font-bold mb-1">Zero Trust Blocking</div>
            New domains are evaluated on every request. No cached allowances. Unknown domains are allowed by default; flagged domains are dropped at the firewall level before reaching your device.
          </div>
        </div>
      </div>
    </div>
  );
}
