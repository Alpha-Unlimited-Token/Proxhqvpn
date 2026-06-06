// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useRef, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Crosshair, Search, Loader2, CheckCircle2, XCircle, Copy, ExternalLink,
  Mail, MapPin, User, Globe, Building2, Link2, AlertTriangle,
  ChevronRight, Shield, RefreshCw, Eye, Hash, Clock, Star,
  Network, Database, Zap, ArrowRight, Users,
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

// ── Types ─────────────────────────────────────────────────────────────────────

interface PlatformResult {
  platform: string;
  platformId: string;
  category: string;
  url: string;
  found: boolean;
  confidence: "confirmed" | "likely" | "possible" | "blocked";
  profileData?: {
    displayName?: string;
    bio?: string;
    location?: string;
    email?: string;
    website?: string;
    company?: string;
    joinedAt?: string;
    followers?: number;
    following?: number;
    verified?: boolean;
    karma?: number;
    repos?: number;
    linkedAccounts?: Array<{ platform: string; username: string; url: string }>;
  };
  checkedAt: string;
}

interface EmailResult {
  email: string;
  source: string;
  confidence: "high" | "medium" | "low";
  notes?: string;
}

interface DataPoint {
  value: string;
  source: string;
}

interface UsernameJob {
  jobId: string;
  username: string;
  hops: number;
  status: "running" | "complete" | "error";
  startedAt: string;
  completedAt?: string;
  progress: number;
  currentTask: string;
  platformsChecked: number;
  platforms: PlatformResult[];
  emails: EmailResult[];
  names: DataPoint[];
  locations: DataPoint[];
  websites: DataPoint[];
  bios: DataPoint[];
  companies: DataPoint[];
  linkedUsernames: Array<{ platform: string; username: string; url: string; discoveredVia: string }>;
  riskScore: number;
  exposureCategories: string[];
  summary: string;
}

// ── UI Helpers ────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  social:    "text-blue-400 border-blue-400/30 bg-blue-400/8",
  developer: "text-purple-400 border-purple-400/30 bg-purple-400/8",
  creative:  "text-pink-400 border-pink-400/30 bg-pink-400/8",
  gaming:    "text-yellow-400 border-yellow-400/30 bg-yellow-400/8",
  messaging: "text-cyan-400 border-cyan-400/30 bg-cyan-400/8",
  other:     "text-gray-400 border-gray-400/30 bg-gray-400/8",
};

const CONF_COLORS: Record<string, string> = {
  confirmed: "text-[#00ff88] border-[#00ff88]/30",
  likely:    "text-cyan-400 border-cyan-400/30",
  possible:  "text-yellow-400/70 border-yellow-400/20",
  blocked:   "text-gray-500 border-gray-500/20",
};

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {});
}

function RiskMeter({ score }: { score: number }) {
  const color = score >= 70 ? "#ff4444" : score >= 40 ? "#ff8800" : score >= 20 ? "#ffcc00" : "#00ff88";
  const label = score >= 70 ? "HIGH EXPOSURE" : score >= 40 ? "MODERATE" : score >= 20 ? "LOW" : "MINIMAL";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-primary/40 uppercase tracking-widest">Exposure Risk</span>
        <span style={{ color }} className="font-bold">{label} — {score}/100</span>
      </div>
      <div className="h-2 bg-primary/10 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  );
}

function ConfidenceBadge({ conf }: { conf: string }) {
  const label = conf === "confirmed" ? "✓ API confirmed" : conf === "likely" ? "≈ Likely" : conf === "possible" ? "? Possible" : "✗ Not found";
  return <span className={`text-[9px] font-mono border px-1.5 py-0.5 rounded uppercase ${CONF_COLORS[conf] ?? CONF_COLORS["possible"]}`}>{label}</span>;
}

function EmailConfBadge({ conf }: { conf: string }) {
  const color = conf === "high" ? "text-[#00ff88] border-[#00ff88]/30" : conf === "medium" ? "text-yellow-400 border-yellow-400/30" : "text-gray-400 border-gray-400/30";
  return <span className={`text-[9px] font-mono border px-1.5 py-0.5 rounded uppercase ${color}`}>{conf} conf</span>;
}

function PlatformCard({ p }: { p: PlatformResult }) {
  const [open, setOpen] = useState(false);
  const hasProfile = p.found && p.profileData && Object.keys(p.profileData).some(k => (p.profileData as any)[k]);
  const catColor = CATEGORY_COLORS[p.category] ?? CATEGORY_COLORS["other"];
  return (
    <div className={`border rounded-sm transition-colors ${p.found ? "border-primary/15 bg-primary/2 hover:bg-primary/5" : "border-primary/5 opacity-50"}`}>
      <button className="w-full flex items-center gap-3 p-2.5 text-left" onClick={() => hasProfile && setOpen(o => !o)}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${p.found ? p.confidence === "confirmed" ? "bg-[#00ff88]" : p.confidence === "likely" ? "bg-cyan-400" : "bg-yellow-400/70" : "bg-gray-600"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono font-bold text-primary/80">{p.platform}</span>
            <span className={`text-[9px] border px-1 rounded uppercase ${catColor}`}>{p.category}</span>
            <ConfidenceBadge conf={p.found ? p.confidence : "blocked"} />
          </div>
          {p.found && p.profileData?.displayName && (
            <div className="text-[10px] text-primary/50 mt-0.5 truncate">"{p.profileData.displayName}"</div>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {p.found && (
            <a href={p.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              className="text-[#00ff88]/60 hover:text-[#00ff88] transition-colors">
              <ExternalLink className="w-3 h-3" />
            </a>
          )}
          {hasProfile && <ChevronRight className={`w-3 h-3 text-primary/30 transition-transform ${open ? "rotate-90" : ""}`} />}
        </div>
      </button>
      {open && hasProfile && (
        <div className="px-3 pb-3 pt-0 border-t border-primary/8 space-y-1.5 font-mono text-[10px]">
          {p.profileData!.bio && <div className="text-primary/50 italic">"{p.profileData!.bio}"</div>}
          {p.profileData!.location && <div className="flex items-center gap-1.5 text-primary/60"><MapPin className="w-2.5 h-2.5 text-[#00ff88]/50" />{p.profileData!.location}</div>}
          {p.profileData!.email && <div className="flex items-center gap-1.5"><Mail className="w-2.5 h-2.5 text-[#00ff88]/50" /><span className="text-[#00ff88]">{p.profileData!.email}</span></div>}
          {p.profileData!.website && <div className="flex items-center gap-1.5 text-cyan-400/70"><Globe className="w-2.5 h-2.5" />{p.profileData!.website}</div>}
          {p.profileData!.company && <div className="flex items-center gap-1.5 text-primary/60"><Building2 className="w-2.5 h-2.5" />{p.profileData!.company}</div>}
          {(p.profileData!.followers != null || p.profileData!.repos != null || p.profileData!.karma != null) && (
            <div className="flex gap-3 text-primary/40">
              {p.profileData!.followers != null && <span>Followers: <span className="text-primary/70">{p.profileData!.followers.toLocaleString()}</span></span>}
              {p.profileData!.repos != null && <span>Repos: <span className="text-primary/70">{p.profileData!.repos}</span></span>}
              {p.profileData!.karma != null && <span>Karma: <span className="text-primary/70">{p.profileData!.karma.toLocaleString()}</span></span>}
            </div>
          )}
          {p.profileData!.joinedAt && <div className="flex items-center gap-1.5 text-primary/40"><Clock className="w-2.5 h-2.5" />Joined {new Date(p.profileData!.joinedAt).toLocaleDateString()}</div>}
          {p.profileData!.linkedAccounts && p.profileData!.linkedAccounts.length > 0 && (
            <div className="space-y-0.5 pt-1">
              <div className="text-primary/30 uppercase tracking-widest text-[9px]">Linked accounts</div>
              {p.profileData!.linkedAccounts.map((la, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Link2 className="w-2 h-2 text-cyan-400/50" />
                  <span className="text-cyan-400/70">{la.platform}</span>
                  <span className="text-primary/50">@{la.username}</span>
                  <a href={la.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-2 h-2 text-primary/30 hover:text-cyan-400" /></a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DataChip({ icon: Icon, value, source, href, onCopy }: { icon: React.ElementType; value: string; source: string; href?: string; onCopy?: () => void }) {
  return (
    <div className="flex items-start gap-2 p-2 border border-primary/10 rounded-sm bg-primary/2 group hover:bg-primary/5 transition-colors">
      <Icon className="w-3 h-3 text-[#00ff88]/60 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono text-primary/80 break-all">{value}</div>
        <div className="text-[9px] text-primary/30 font-mono mt-0.5">via {source}</div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        {onCopy && <button onClick={onCopy}><Copy className="w-2.5 h-2.5 text-primary/40 hover:text-[#00ff88]" /></button>}
        {href && <a href={href} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-2.5 h-2.5 text-primary/40 hover:text-cyan-400" /></a>}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

const CATEGORIES = ["social", "developer", "creative", "gaming", "messaging", "other"] as const;

export default function UsernameIntel() {
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [hops, setHops] = useState(2);
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<UsernameJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "platforms" | "data" | "linked">("overview");
  const [catFilter, setCatFilter] = useState<string>("all");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  useEffect(() => () => { stopPolling(); }, [stopPolling]);

  const startSearch = async () => {
    const u = username.trim().replace(/^@/, "");
    if (!u) return;
    try {
      setLoading(true);
      setJob(null);
      setActiveTab("overview");
      const resp = await apiFetch("/username-intel/search", {
        method: "POST",
        body: JSON.stringify({ username: u, hops }),
      });
      setJobId(resp.jobId);
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const data: UsernameJob = await apiFetch(`/username-intel/status/${resp.jobId}`);
          setJob(data);
          if (data.status !== "running") { stopPolling(); setLoading(false); }
        } catch { stopPolling(); setLoading(false); }
      }, 1200);
    } catch (err) {
      toast({ variant: "destructive", title: "Search failed", description: String(err) });
      setLoading(false);
    }
  };

  const reset = () => {
    if (jobId) apiFetch(`/username-intel/status/${jobId}`, { method: "DELETE" }).catch(() => {});
    stopPolling();
    setJobId(null);
    setJob(null);
    setLoading(false);
    setUsername("");
  };

  const foundPlatforms = job?.platforms.filter(p => p.found) ?? [];
  const notFoundPlatforms = job?.platforms.filter(p => !p.found) ?? [];
  const filteredPlatforms = catFilter === "all"
    ? job?.platforms ?? []
    : (job?.platforms ?? []).filter(p => p.category === catFilter);

  const tabs = [
    { id: "overview", label: "Overview", icon: Eye },
    { id: "platforms", label: `Platforms (${foundPlatforms.length})`, icon: Network },
    { id: "data", label: `Extracted Data`, icon: Database },
    { id: "linked", label: `Linked Accounts (${job?.linkedUsernames.length ?? 0})`, icon: Link2 },
  ] as const;

  return (
    <div className="min-h-screen bg-background text-primary font-mono p-4 space-y-4">

      {/* ── Header ── */}
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-sm border border-[#00ff88]/25 bg-[#00ff88]/8 flex items-center justify-center flex-shrink-0">
          <Crosshair className="w-5 h-5 text-[#00ff88]" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-primary tracking-wide uppercase">Username Intelligence</h1>
          <p className="text-[11px] text-primary/40 mt-0.5">
            Multi-hop screen name OSINT — probes 35+ platforms, mines emails from commit history, Gravatar, Keybase proofs, and bio text. Cross-platform pivoting across discovered accounts.
          </p>
        </div>
      </div>

      {/* ── Input panel ── */}
      <div className="border border-primary/15 rounded-sm p-4 bg-primary/2 space-y-3">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 flex items-center gap-2 border border-primary/20 rounded-sm px-3 bg-background focus-within:border-[#00ff88]/40 transition-colors">
            <Search className="w-3.5 h-3.5 text-primary/30 flex-shrink-0" />
            <input
              className="flex-1 bg-transparent text-sm font-mono py-2.5 outline-none placeholder:text-primary/25"
              placeholder="TikTok, Instagram, Reddit, GitHub screen name…"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !loading && startSearch()}
              disabled={loading}
            />
            {username && (
              <button className="text-primary/30 hover:text-primary/60" onClick={() => setUsername("")}>✕</button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 border border-primary/15 rounded-sm px-2 bg-background">
              <Zap className="w-3 h-3 text-yellow-400/60" />
              <span className="text-[10px] text-primary/40 mr-1">Hops</span>
              {[1, 2, 3].map(n => (
                <button key={n} onClick={() => setHops(n)}
                  className={`text-[10px] font-bold w-5 h-7 transition-colors ${hops === n ? "text-[#00ff88]" : "text-primary/30 hover:text-primary/60"}`}>
                  {n}
                </button>
              ))}
            </div>
            {loading ? (
              <Button size="sm" variant="destructive" className="text-xs" onClick={() => { stopPolling(); setLoading(false); }}>
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Cancel
              </Button>
            ) : (
              <Button size="sm" className="text-xs bg-[#00ff88] text-black hover:bg-[#00ff88]/90 font-bold"
                onClick={startSearch} disabled={!username.trim()}>
                <Crosshair className="w-3 h-3 mr-1.5" />Hunt
              </Button>
            )}
            {job && !loading && (
              <Button size="sm" variant="outline" className="text-xs border-primary/20" onClick={reset}>
                <RefreshCw className="w-3 h-3 mr-1.5" />Clear
              </Button>
            )}
          </div>
        </div>

        {/* Hop explanation */}
        <div className="text-[9px] text-primary/30 flex gap-4">
          <span><span className="text-[#00ff88]/60">Hop 1</span> — Platform sweep (35+ sites)</span>
          <span><span className="text-[#00ff88]/60">Hop 2</span> — API enrichment + GitHub commit email mining + Gravatar probe</span>
          <span><span className="text-[#00ff88]/60">Hop 3</span> — Cross-platform pivot via discovered linked accounts</span>
        </div>
      </div>

      {/* ── Progress bar ── */}
      {loading && job && (
        <div className="border border-primary/10 rounded-sm p-3 space-y-2">
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="flex items-center gap-1.5 text-[#00ff88]/80">
              <Loader2 className="w-3 h-3 animate-spin" />
              {job.currentTask}
            </span>
            <span className="text-primary/40">{job.progress}%</span>
          </div>
          <div className="h-1.5 bg-primary/8 rounded-full overflow-hidden">
            <div className="h-full bg-[#00ff88] rounded-full transition-all duration-500" style={{ width: `${job.progress}%` }} />
          </div>
          <div className="text-[9px] text-primary/30">
            {job.platforms.filter(p => p.found).length} found · {job.platforms.length} checked · {job.emails.length} email(s) detected
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {job && (
        <>
          {/* Status banner */}
          <div className={`border rounded-sm p-3 ${job.status === "complete" ? "border-[#00ff88]/20 bg-[#00ff88]/4" : job.status === "error" ? "border-red-400/20 bg-red-400/4" : "border-primary/10"}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  {job.status === "complete" ? <CheckCircle2 className="w-4 h-4 text-[#00ff88]" /> : job.status === "error" ? <AlertTriangle className="w-4 h-4 text-red-400" /> : <Loader2 className="w-4 h-4 animate-spin text-[#00ff88]/60" />}
                  <span className="text-xs font-bold font-mono text-primary/80">
                    @{job.username} — {job.status === "complete" ? "Scan complete" : job.status === "error" ? "Error" : "Scanning…"}
                  </span>
                  {job.status === "complete" && (
                    <span className="text-[9px] border border-[#00ff88]/30 text-[#00ff88]/70 px-1 rounded uppercase">
                      {hops} hop{hops !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-primary/50 font-mono">{job.summary}</p>
              </div>
              {job.status === "complete" && <RiskMeter score={job.riskScore} />}
            </div>
            {job.exposureCategories.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {job.exposureCategories.map(cat => (
                  <span key={cat} className="text-[9px] border border-orange-400/25 bg-orange-400/8 text-orange-400/80 px-1.5 py-0.5 rounded font-mono">{cat}</span>
                ))}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-0 border-b border-primary/10 overflow-x-auto">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[10px] font-mono uppercase tracking-wide border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? "border-[#00ff88] text-[#00ff88]" : "border-transparent text-primary/40 hover:text-primary/60"}`}>
                <tab.icon className="w-3 h-3" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab: Overview ── */}
          {activeTab === "overview" && (
            <div className="space-y-3">
              {/* Quick stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Platforms Found", value: foundPlatforms.length, color: "text-[#00ff88]", icon: Network },
                  { label: "Emails Discovered", value: job.emails.length, color: "text-orange-400", icon: Mail },
                  { label: "Real Names", value: job.names.length, color: "text-cyan-400", icon: User },
                  { label: "Linked Accounts", value: job.linkedUsernames.length, color: "text-purple-400", icon: Link2 },
                ].map(s => (
                  <div key={s.label} className="border border-primary/10 rounded-sm p-3 bg-primary/2">
                    <s.icon className={`w-4 h-4 ${s.color} mb-1.5`} />
                    <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
                    <div className="text-[9px] text-primary/35 uppercase tracking-wide mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Top emails */}
              {job.emails.length > 0 && (
                <div className="border border-primary/10 rounded-sm">
                  <div className="flex items-center gap-2 p-3 border-b border-primary/8">
                    <Mail className="w-3.5 h-3.5 text-[#00ff88]" />
                    <span className="text-xs font-bold uppercase tracking-wide">Email Addresses Found</span>
                    <Badge className="ml-auto text-[9px] bg-orange-400/15 text-orange-400 border-orange-400/30">{job.emails.length}</Badge>
                  </div>
                  <div className="divide-y divide-primary/5">
                    {job.emails.map((e, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 group hover:bg-primary/3 transition-colors">
                        <Mail className="w-3 h-3 text-orange-400/60 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-mono font-bold text-orange-400 break-all">{e.email}</span>
                            <EmailConfBadge conf={e.confidence} />
                          </div>
                          <div className="text-[9px] text-primary/35 mt-0.5">Source: {e.source}</div>
                          {e.notes && <div className="text-[9px] text-primary/25 mt-0.5 italic">{e.notes}</div>}
                        </div>
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => { copyToClipboard(e.email); toast({ title: "Copied", description: e.email }); }}>
                          <Copy className="w-3 h-3 text-primary/40 hover:text-[#00ff88]" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Names / locations / companies */}
              {(job.names.length > 0 || job.locations.length > 0 || job.companies.length > 0) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {job.names.length > 0 && (
                    <div className="border border-primary/10 rounded-sm p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] text-primary/40 uppercase mb-2"><User className="w-3 h-3" />Real Names</div>
                      {job.names.map((n, i) => (
                        <div key={i}>
                          <div className="text-xs font-mono text-primary/80">{n.value}</div>
                          <div className="text-[9px] text-primary/30">via {n.source}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {job.locations.length > 0 && (
                    <div className="border border-primary/10 rounded-sm p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] text-primary/40 uppercase mb-2"><MapPin className="w-3 h-3" />Locations</div>
                      {job.locations.map((l, i) => (
                        <div key={i}>
                          <div className="text-xs font-mono text-primary/80">{l.value}</div>
                          <div className="text-[9px] text-primary/30">via {l.source}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {job.companies.length > 0 && (
                    <div className="border border-primary/10 rounded-sm p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] text-primary/40 uppercase mb-2"><Building2 className="w-3 h-3" />Companies</div>
                      {job.companies.map((c, i) => (
                        <div key={i}>
                          <div className="text-xs font-mono text-primary/80">{c.value}</div>
                          <div className="text-[9px] text-primary/30">via {c.source}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Bio snippets */}
              {job.bios.length > 0 && (
                <div className="border border-primary/10 rounded-sm">
                  <div className="flex items-center gap-2 p-3 border-b border-primary/8">
                    <Hash className="w-3.5 h-3.5 text-[#00ff88]" />
                    <span className="text-xs font-bold uppercase tracking-wide">Bio / About Text</span>
                  </div>
                  <div className="divide-y divide-primary/5">
                    {job.bios.slice(0, 5).map((b, i) => (
                      <div key={i} className="p-3 text-[11px] font-mono">
                        <div className="text-primary/60 italic line-clamp-3">"{b.value}"</div>
                        <div className="text-[9px] text-primary/25 mt-1">via {b.source}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Websites */}
              {job.websites.length > 0 && (
                <div className="border border-primary/10 rounded-sm p-3 space-y-2">
                  <div className="flex items-center gap-1.5 text-[10px] text-primary/40 uppercase"><Globe className="w-3 h-3" />Personal Websites & Links</div>
                  {job.websites.map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <ArrowRight className="w-2.5 h-2.5 text-cyan-400/50" />
                      <a href={w.value.startsWith("http") ? w.value : `https://${w.value}`} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-mono text-cyan-400/80 hover:text-cyan-400 truncate">{w.value}</a>
                      <span className="text-[9px] text-primary/25">via {w.source}</span>
                    </div>
                  ))}
                </div>
              )}

              {job.status === "complete" && job.emails.length === 0 && job.names.length === 0 && foundPlatforms.length === 0 && (
                <div className="border border-primary/10 rounded-sm p-6 text-center">
                  <XCircle className="w-8 h-8 text-primary/20 mx-auto mb-2" />
                  <div className="text-sm font-mono text-primary/40">No significant public data found for @{job.username}</div>
                  <div className="text-[10px] text-primary/25 mt-1">Try a different username variant, or the account may use strong privacy settings.</div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Platforms ── */}
          {activeTab === "platforms" && (
            <div className="space-y-3">
              {/* Category filter */}
              <div className="flex gap-1.5 flex-wrap">
                {["all", ...CATEGORIES].map(cat => (
                  <button key={cat} onClick={() => setCatFilter(cat)}
                    className={`text-[9px] font-mono uppercase px-2 py-1 border rounded transition-colors ${catFilter === cat ? "border-[#00ff88]/40 bg-[#00ff88]/10 text-[#00ff88]" : "border-primary/15 text-primary/40 hover:text-primary/70"}`}>
                    {cat === "all" ? `All (${job.platforms.length})` : `${cat} (${job.platforms.filter(p => p.category === cat).length})`}
                  </button>
                ))}
              </div>

              {/* Found first */}
              {filteredPlatforms.some(p => p.found) && (
                <div className="space-y-1.5">
                  <div className="text-[9px] text-[#00ff88]/60 uppercase tracking-widest font-mono flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" /> Found ({filteredPlatforms.filter(p => p.found).length})
                  </div>
                  {filteredPlatforms.filter(p => p.found).map(p => <PlatformCard key={p.platformId} p={p} />)}
                </div>
              )}

              {/* Not found */}
              {filteredPlatforms.some(p => !p.found) && (
                <div className="space-y-1">
                  <div className="text-[9px] text-primary/25 uppercase tracking-widest font-mono flex items-center gap-2">
                    <XCircle className="w-3 h-3" /> Not Found ({filteredPlatforms.filter(p => !p.found).length})
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1">
                    {filteredPlatforms.filter(p => !p.found).map(p => (
                      <div key={p.platformId} className="flex items-center gap-2 px-2 py-1.5 border border-primary/5 rounded-sm opacity-40">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-600 flex-shrink-0" />
                        <span className="text-[10px] font-mono text-primary/50 truncate">{p.platform}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Extracted Data ── */}
          {activeTab === "data" && (
            <div className="space-y-3">
              {job.emails.length === 0 && job.names.length === 0 && job.locations.length === 0 && (
                <div className="text-center p-8 text-primary/30 text-sm font-mono">No extractable data found yet.</div>
              )}

              {job.emails.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[9px] text-orange-400/70 uppercase tracking-widest font-mono flex items-center gap-2"><Mail className="w-3 h-3" />Emails ({job.emails.length})</div>
                  {job.emails.map((e, i) => (
                    <div key={i} className="border border-primary/10 rounded-sm p-3 group hover:bg-primary/3 transition-colors">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-mono font-bold text-orange-400">{e.email}</span>
                        <EmailConfBadge conf={e.confidence} />
                        <button className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => { copyToClipboard(e.email); toast({ title: "Copied email", description: e.email }); }}>
                          <Copy className="w-3 h-3 text-primary/40 hover:text-[#00ff88]" />
                        </button>
                      </div>
                      <div className="text-[9px] text-primary/30 mt-1">Source: {e.source}</div>
                      {e.notes && <div className="text-[9px] text-primary/20 mt-0.5 italic">{e.notes}</div>}
                    </div>
                  ))}
                </div>
              )}

              {job.names.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[9px] text-cyan-400/70 uppercase tracking-widest font-mono flex items-center gap-2"><User className="w-3 h-3" />Real Names ({job.names.length})</div>
                  {job.names.map((n, i) => (
                    <DataChip key={i} icon={User} value={n.value} source={n.source} onCopy={() => { copyToClipboard(n.value); toast({ title: "Copied", description: n.value }); }} />
                  ))}
                </div>
              )}

              {job.locations.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[9px] text-yellow-400/70 uppercase tracking-widest font-mono flex items-center gap-2"><MapPin className="w-3 h-3" />Locations ({job.locations.length})</div>
                  {job.locations.map((l, i) => (
                    <DataChip key={i} icon={MapPin} value={l.value} source={l.source} onCopy={() => { copyToClipboard(l.value); toast({ title: "Copied", description: l.value }); }} />
                  ))}
                </div>
              )}

              {job.companies.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[9px] text-primary/50 uppercase tracking-widest font-mono flex items-center gap-2"><Building2 className="w-3 h-3" />Companies / Employers ({job.companies.length})</div>
                  {job.companies.map((c, i) => (
                    <DataChip key={i} icon={Building2} value={c.value} source={c.source} />
                  ))}
                </div>
              )}

              {job.websites.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[9px] text-cyan-400/70 uppercase tracking-widest font-mono flex items-center gap-2"><Globe className="w-3 h-3" />Websites & Links ({job.websites.length})</div>
                  {job.websites.map((w, i) => (
                    <DataChip key={i} icon={Globe} value={w.value} source={w.source}
                      href={w.value.startsWith("http") ? w.value : `https://${w.value}`}
                      onCopy={() => { copyToClipboard(w.value); toast({ title: "Copied", description: w.value }); }} />
                  ))}
                </div>
              )}

              {job.bios.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[9px] text-primary/50 uppercase tracking-widest font-mono flex items-center gap-2"><Hash className="w-3 h-3" />Bio Text ({job.bios.length})</div>
                  {job.bios.map((b, i) => (
                    <div key={i} className="border border-primary/8 rounded-sm p-3">
                      <p className="text-[11px] font-mono text-primary/60 italic leading-relaxed">"{b.value}"</p>
                      <div className="text-[9px] text-primary/25 mt-1.5">via {b.source}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Linked Accounts ── */}
          {activeTab === "linked" && (
            <div className="space-y-2">
              {job.linkedUsernames.length === 0 ? (
                <div className="text-center p-8 text-primary/30 text-sm font-mono">No cross-platform linked accounts discovered.</div>
              ) : (
                <>
                  <div className="text-[10px] text-primary/35 font-mono mb-2">
                    Linked accounts discovered via API enrichment, Keybase proofs, and profile cross-referencing.
                  </div>
                  {job.linkedUsernames.map((lu, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 border border-primary/10 rounded-sm hover:bg-primary/3 transition-colors group">
                      <Link2 className="w-3.5 h-3.5 text-purple-400/60 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-bold text-purple-400">{lu.platform}</span>
                          <span className="text-xs font-mono text-primary/60">@{lu.username}</span>
                        </div>
                        <div className="text-[9px] text-primary/25 mt-0.5">Discovered via: {lu.discoveredVia}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {lu.url && (
                          <a href={lu.url} target="_blank" rel="noopener noreferrer" className="text-primary/30 hover:text-cyan-400 transition-colors">
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                        <button className="opacity-0 group-hover:opacity-100 transition-opacity text-primary/30 hover:text-[#00ff88]"
                          onClick={() => { copyToClipboard(lu.username); toast({ title: "Copied", description: lu.username }); }}>
                          <Copy className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="mt-3 p-3 border border-yellow-400/15 bg-yellow-400/4 rounded-sm">
                    <div className="flex items-start gap-2">
                      <Star className="w-3.5 h-3.5 text-yellow-400/70 flex-shrink-0 mt-0.5" />
                      <div className="text-[10px] font-mono text-primary/50">
                        <span className="text-yellow-400/70 font-bold">Pro tip:</span> Run OSINT Recon on discovered websites, or paste found emails into Canary Tokens to track if they open phishing-test bait.
                        Use Ghost Chain to trace the full attack surface from any linked domain.
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Empty state ── */}
      {!job && !loading && (
        <div className="border border-primary/8 rounded-sm p-8 text-center space-y-2">
          <Users className="w-10 h-10 text-primary/15 mx-auto" />
          <div className="text-sm font-mono text-primary/30">Enter a screen name above to begin</div>
          <div className="text-[10px] text-primary/20 max-w-md mx-auto">
            Searches TikTok, Instagram, Reddit, GitHub, Keybase, HackerNews, Twitch, and 28 more platforms.
            Mines commit history, Gravatar, and profile APIs for email addresses.
            Pivots across discovered linked accounts for multi-hop intelligence.
          </div>
          <div className="flex justify-center gap-4 mt-4 text-[9px] text-primary/20 font-mono">
            <span>✓ 35+ platforms</span>
            <span>✓ GitHub commit email mining</span>
            <span>✓ Gravatar probe</span>
            <span>✓ Keybase cross-links</span>
            <span>✓ Bio text extraction</span>
          </div>
        </div>
      )}
    </div>
  );
}
