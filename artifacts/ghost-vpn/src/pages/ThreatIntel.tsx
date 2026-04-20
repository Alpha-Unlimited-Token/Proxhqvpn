import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Search, Shield, Trash2, Plus, RefreshCw, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Feed { name: string; url: string; category: string; free: boolean }
interface BLEntry { ip: string; source: string; category: string; addedAt: string; notes: string }
interface CheckResult {
  ip: string; score: number; risk: "low" | "medium" | "high" | "critical";
  flags: string[]; isTorExit: boolean; isKnownMalicious: boolean; inLocalBlocklist: boolean;
  geo?: { country: string; city: string; org: string } | null;
  recommendation: string; checkedAt: string;
}
interface Summary { feeds: number; activeFeedsWithFreeAccess: number; torExitNodesTracked: number; localBlocklistEntries: number; vpnRangesTracked: number }

const RISK_COLORS = {
  low:      "text-green-400 border-green-400/50",
  medium:   "text-yellow-400 border-yellow-400/50",
  high:     "text-orange-400 border-orange-400/50",
  critical: "text-red-400 border-red-400/50",
};

export default function ThreatIntel() {
  const { toast } = useToast();
  const [summary, setSummary]     = useState<Summary | null>(null);
  const [feeds, setFeeds]         = useState<Feed[]>([]);
  const [blocklist, setBlocklist] = useState<BLEntry[]>([]);
  const [checkIp, setCheckIp]     = useState("");
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [addIp, setAddIp]         = useState("");
  const [addNotes, setAddNotes]   = useState("");
  const [checking, setChecking]   = useState(false);
  const [adding, setAdding]       = useState(false);
  const [torExits, setTorExits]   = useState<string[]>([]);
  const [loadingExits, setLoadingExits] = useState(false);

  const loadAll = useCallback(async () => {
    const [sumR, feedsR, blR] = await Promise.allSettled([
      fetch(`${BASE}/api/threatintel/summary`).then(r => r.json()),
      fetch(`${BASE}/api/threatintel/feeds`).then(r => r.json()),
      fetch(`${BASE}/api/threatintel/blocklist`).then(r => r.json()),
    ]);
    if (sumR.status === "fulfilled")   setSummary(sumR.value);
    if (feedsR.status === "fulfilled") setFeeds(feedsR.value.feeds ?? []);
    if (blR.status === "fulfilled")    setBlocklist(blR.value.entries ?? []);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const doCheck = async () => {
    if (!checkIp.trim()) return;
    setChecking(true);
    setCheckResult(null);
    try {
      const r = await fetch(`${BASE}/api/threatintel/check-ip`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: checkIp.trim() }),
      });
      const d = await r.json();
      setCheckResult(d);
    } catch (e: any) { toast({ title: "Check failed", description: e.message, variant: "destructive" }); }
    finally { setChecking(false); }
  };

  const doAdd = async () => {
    if (!addIp.trim()) return;
    setAdding(true);
    try {
      const r = await fetch(`${BASE}/api/threatintel/blocklist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: addIp.trim(), notes: addNotes }),
      });
      if (r.ok) {
        setAddIp(""); setAddNotes("");
        loadAll();
        toast({ title: "IP added to blocklist" });
      } else {
        const d = await r.json();
        toast({ title: "Error", description: d.error, variant: "destructive" });
      }
    } finally { setAdding(false); }
  };

  const doRemove = async (ip: string) => {
    await fetch(`${BASE}/api/threatintel/blocklist/${ip}`, { method: "DELETE" });
    loadAll();
    toast({ title: "Removed from blocklist" });
  };

  const loadTorExits = async () => {
    setLoadingExits(true);
    try {
      const r = await fetch(`${BASE}/api/threatintel/tor-exits`);
      const d = await r.json();
      setTorExits(d.exits ?? []);
      toast({ title: `Loaded ${d.count} Tor exit nodes`, description: `Source: ${d.source}` });
    } finally { setLoadingExits(false); }
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="border border-primary/10 bg-black/20 rounded-sm px-3 py-2.5 flex items-center justify-between flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" /> Threat Intelligence
          </h2>
          {summary && (
            <>
              <Badge variant="outline" className="text-primary/50 border-primary/20 font-mono text-xs">{summary.feeds} FEEDS</Badge>
              <Badge variant="outline" className="text-red-400 border-red-400/50 font-mono text-xs">{summary.torExitNodesTracked} TOR EXITS</Badge>
              <Badge variant="outline" className="text-orange-400 border-orange-400/50 font-mono text-xs">{summary.localBlocklistEntries} BLOCKED</Badge>
            </>
          )}
        </div>
        <Button
          onClick={loadTorExits}
          disabled={loadingExits}
          variant="outline"
          className="border-primary/30 text-primary hover:bg-primary/10 font-mono text-xs"
        >
          <RefreshCw className={`w-3 h-3 mr-1.5 ${loadingExits ? "animate-spin" : ""}`} />
          FETCH TOR EXITS
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="bg-black border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 pb-2 border-b border-primary/10 flex items-center gap-2">
              <Search className="w-3 h-3" /> IP Reputation Check
            </div>
            <div className="flex gap-2">
              <Input
                value={checkIp}
                onChange={e => setCheckIp(e.target.value)}
                onKeyDown={e => e.key === "Enter" && doCheck()}
                placeholder="Enter IP address..."
                className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8"
              />
              <Button
                onClick={doCheck}
                disabled={checking || !checkIp.trim()}
                className="h-8 text-xs font-mono bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20"
                variant="outline"
              >
                {checking ? "..." : "CHECK"}
              </Button>
            </div>

            {checkResult && (
              <div className={`border rounded-sm p-3 space-y-2 ${RISK_COLORS[checkResult.risk].split(" ")[1] ? `border-${RISK_COLORS[checkResult.risk].split(" ")[1].replace("border-","")}` : "border-primary/20"}`}
                   style={{ borderColor: checkResult.risk === "critical" ? "rgba(239,68,68,0.4)" : checkResult.risk === "high" ? "rgba(249,115,22,0.4)" : checkResult.risk === "medium" ? "rgba(234,179,8,0.4)" : "rgba(74,222,128,0.4)" }}>
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-primary">{checkResult.ip}</span>
                  <Badge variant="outline" className={`text-[9px] font-mono ${RISK_COLORS[checkResult.risk]}`}>
                    {checkResult.risk.toUpperCase()} ({checkResult.score}/100)
                  </Badge>
                </div>
                {checkResult.flags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {checkResult.flags.map(f => (
                      <span key={f} className="text-[9px] font-mono bg-red-900/20 border border-red-500/30 text-red-400 px-1.5 py-0.5 rounded">{f}</span>
                    ))}
                  </div>
                )}
                {checkResult.geo && (
                  <div className="text-[9px] font-mono text-primary/50">
                    {checkResult.geo.city}, {checkResult.geo.country} — {checkResult.geo.org}
                  </div>
                )}
                <p className="text-[9px] font-mono text-primary/60">{checkResult.recommendation}</p>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    className="h-6 text-[9px] font-mono bg-red-900/20 border border-red-500/30 text-red-400 hover:bg-red-900/30"
                    variant="outline"
                    onClick={() => { setAddIp(checkResult.ip); }}
                  >
                    ADD TO BLOCKLIST
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-black border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 pb-2 border-b border-primary/10 flex items-center gap-2">
              <Shield className="w-3 h-3" /> Local Blocklist ({blocklist.length})
            </div>
            <div className="flex gap-2">
              <Input
                value={addIp}
                onChange={e => setAddIp(e.target.value)}
                placeholder="IP to block..."
                className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8"
              />
              <Input
                value={addNotes}
                onChange={e => setAddNotes(e.target.value)}
                placeholder="Notes..."
                className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-8 w-28"
              />
              <Button
                onClick={doAdd}
                disabled={adding || !addIp.trim()}
                className="h-8 text-xs font-mono bg-red-900/20 border border-red-500/30 text-red-400 hover:bg-red-900/30"
                variant="outline"
              >
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            <div className="overflow-y-auto max-h-48 space-y-1">
              {blocklist.length === 0 && (
                <div className="text-center py-6 text-[10px] font-mono text-primary/30">NO BLOCKED IPs YET</div>
              )}
              {blocklist.map((e) => (
                <div key={e.ip} className="flex items-center justify-between px-2 py-1.5 border border-red-500/20 bg-red-900/5 rounded-sm">
                  <div>
                    <span className="text-xs font-mono text-primary">{e.ip}</span>
                    {e.notes && <span className="text-[9px] font-mono text-primary/40 ml-2">{e.notes}</span>}
                    <span className="text-[9px] font-mono text-red-400/60 ml-2">{e.category}</span>
                  </div>
                  <button onClick={() => doRemove(e.ip)} className="text-primary/40 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-black border-primary/20">
        <CardContent className="p-4 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 pb-2 border-b border-primary/10">
            Intelligence Feeds
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {feeds.map((f, i) => (
              <div key={i} className="flex items-start justify-between px-3 py-2 border border-primary/10 bg-black/40 rounded-sm gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-primary truncate">{f.name}</span>
                    <Badge variant="outline" className={`text-[9px] font-mono ${f.free ? "text-green-400 border-green-400/40" : "text-yellow-400 border-yellow-400/40"}`}>
                      {f.free ? "FREE" : "API KEY"}
                    </Badge>
                    <Badge variant="outline" className="text-[9px] font-mono text-primary/40 border-primary/20">
                      {f.category}
                    </Badge>
                  </div>
                  <p className="text-[9px] font-mono text-primary/40 truncate mt-0.5">{f.url}</p>
                </div>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-primary/40 hover:text-primary flex-shrink-0 mt-0.5">
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {torExits.length > 0 && (
        <Card className="bg-black border-purple-500/20">
          <CardContent className="p-4 space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-widest text-purple-400/60 pb-2 border-b border-purple-500/20">
              Live Tor Exit Nodes ({torExits.length})
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1 max-h-48 overflow-y-auto">
              {torExits.map((ip, i) => (
                <span key={i} className="text-[9px] font-mono text-purple-300/70 px-1.5 py-0.5 border border-purple-500/20 rounded truncate">{ip}</span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
