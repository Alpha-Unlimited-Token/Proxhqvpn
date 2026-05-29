// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Globe, Lock, Server, Loader2, Mail, Code2, ChevronRight,
  Atom, Key, Hash, User, ExternalLink, CheckCircle2, XCircle,
  AlertCircle, HelpCircle, Search, Copy, Eye, Shield, Database,
  Flame, Clock,
} from "lucide-react";

const QA_BASE = import.meta.env.BASE_URL?.replace(/\/ghost-vpn\/?$/, "") ?? "";
const ETH_ADDR_RE = /^0x[0-9a-fA-F]{40}$/i;
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}/api${path}`, {
    credentials: "include", ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ── Blockchain enrichment (for domain tab ETH addresses) ─────────────────────

interface QaAddrMatch {
  signatures: number;
  chains: string[];
  hasKeyRecovered: boolean;
  findings: Array<{ kind: string; detail: string; discoveredAt: string }>;
}

function BlockchainEnrichment({ target }: { target: string }) {
  const [match, setMatch] = useState<QaAddrMatch | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!ETH_ADDR_RE.test(target.trim())) { setChecked(true); return; }
    const lower = target.trim().toLowerCase();
    (async () => {
      try {
        const r = await fetch(`${QA_BASE}/api/quantum-audit/cc-summary`, { credentials: "include" });
        if (!r.ok) return;
        const d = await r.json();
        const addrFindings = (d.recentFindings ?? []).filter((f: any) => f.address?.toLowerCase() === lower);
        if (addrFindings.length > 0) {
          setMatch({
            signatures: addrFindings.length,
            chains: [...new Set<string>(addrFindings.map((f: any) => String(f.engine)))],
            hasKeyRecovered: addrFindings.some((f: any) => f.hasKey),
            findings: addrFindings.slice(0, 5).map((f: any) => ({ kind: f.kind, detail: f.detail, discoveredAt: f.discoveredAt })),
          });
        }
      } catch { } finally { setChecked(true); }
    })();
  }, [target]);
  if (!checked || !ETH_ADDR_RE.test(target.trim())) return null;
  if (!match) return (
    <div className="border border-cyan-500/10 bg-cyan-900/5 p-3 rounded-sm flex items-center gap-2">
      <Atom className="w-3.5 h-3.5 text-cyan-400/40 shrink-0" />
      <span className="text-[10px] font-mono text-cyan-400/40">QuantumAudit: No blockchain findings for this address.</span>
    </div>
  );
  return (
    <div className={`border rounded-sm p-3 space-y-2 font-mono ${match.hasKeyRecovered ? "border-red-500/30 bg-red-900/8" : "border-cyan-500/20 bg-cyan-900/5"}`}>
      <div className="flex items-center gap-2">
        <Atom className={`w-3.5 h-3.5 shrink-0 ${match.hasKeyRecovered ? "text-red-400" : "text-cyan-400"}`} />
        <span className={`text-[10px] uppercase tracking-widest font-bold ${match.hasKeyRecovered ? "text-red-400" : "text-cyan-400"}`}>QuantumAudit · Blockchain Intelligence</span>
        {match.hasKeyRecovered && <span className="text-[9px] border border-red-400/40 text-red-400 px-1 uppercase bg-red-900/20">PRIVATE KEY COMPROMISED</span>}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div><span className="text-primary/40">Signatures found</span> <span className="text-cyan-400 ml-1">{match.signatures}</span></div>
        <div><span className="text-primary/40">Key recovered</span> <span className={`ml-1 ${match.hasKeyRecovered ? "text-red-400 font-bold" : "text-primary/30"}`}>{match.hasKeyRecovered ? "YES" : "No"}</span></div>
      </div>
      {match.findings.map((f, i) => (
        <div key={i} className="flex items-center gap-2 text-[10px]">
          {match.hasKeyRecovered ? <Key className="w-2.5 h-2.5 text-red-400 shrink-0" /> : <Hash className="w-2.5 h-2.5 text-cyan-400/50 shrink-0" />}
          <span className="border border-current/20 px-1 text-[9px] uppercase">{f.kind}</span>
          <span className="text-primary/50 truncate">{f.detail}</span>
        </div>
      ))}
    </div>
  );
}

// ── Shared UI components ──────────────────────────────────────────────────────

function RiskPill({ risk }: { risk: string }) {
  const color = risk === "critical" ? "border-red-400/30 bg-red-400/10 text-red-400"
    : risk === "high" ? "border-orange-400/30 bg-orange-400/10 text-orange-400"
    : risk === "medium" ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
    : "border-[#00ff88]/20 bg-[#00ff88]/5 text-[#00ff88]";
  return <span className={`text-[9px] font-bold uppercase border px-1.5 py-0.5 rounded font-mono ${color}`}>{risk}</span>;
}

function Section({ title, icon: Icon, children, defaultOpen = true }: { title: string; icon: React.ElementType; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-primary/10 rounded-sm overflow-hidden">
      <button className="w-full flex items-center gap-2 p-3 bg-primary/3 hover:bg-primary/5 transition-colors text-left" onClick={() => setOpen(o => !o)}>
        <Icon className="w-3.5 h-3.5 text-[#00ff88]" />
        <span className="text-xs font-bold text-primary uppercase tracking-wide flex-1">{title}</span>
        <ChevronRight className={`w-3.5 h-3.5 text-primary/30 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="p-3 pt-2 text-xs font-mono">{children}</div>}
    </div>
  );
}

function KV({ k, v, highlight }: { k: string; v: React.ReactNode; highlight?: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 border-b border-primary/5 last:border-0">
      <span className="text-primary/40 shrink-0">{k}</span>
      <span className={`text-right break-all ${highlight || "text-primary/80"}`}>{v}</span>
    </div>
  );
}

// ── Username tab result types ─────────────────────────────────────────────────

interface PlatformResult {
  name: string;
  category: string;
  url: string;
  status: "found" | "not_found" | "possible" | "timeout" | "error" | "manual";
  statusCode: number | null;
  snippet?: { title?: string; description?: string } | null;
  manualNote?: string;
}

interface DarkWebResult {
  source: string;
  type: "dark_web" | "paste" | "breach_index";
  status: "found" | "not_found" | "possible" | "error";
  resultCount?: number;
  snippets?: Array<{ title: string; url?: string; description?: string }>;
}

interface EmailPattern {
  email: string;
  hasGravatar: boolean;
}

interface DiscordLookupResult {
  username: string | null;
  resolvedUserId: string | null;
  resolvedSource: string | null;
  displayName: string | null;
  avatar: string | null;
  defaultAvatarUrl: string | null;
  profileUrl: string | null;
  accountAgeDays: number | null;
  lookupAttempts: Array<{ source: string; status: "found" | "not_found" | "error"; note?: string }>;
  selfLookupSteps: string[];
  snowflake: { createdAt: string; timestampMs: number; workerId: number; processId: number; increment: number } | null;
  profile: { displayName?: string; username?: string; avatar?: string; source?: string; createdAt?: string; accountAgeDays?: number | null } | null;
  lanyardPresence: { username?: string; avatar?: string; status?: string; activities?: string[] } | null;
  pasteExposures: Array<{ source: string; userId: string; context: string }> | null;
  idBreachHits: Array<{ source: string; found: boolean; resultCount?: number; note?: string }> | null;
  idDorkQueries: string[] | null;
}

interface UsernameResult {
  username: string;
  found: number;
  possible: number;
  total: number;
  results: PlatformResult[];
  darkWeb: DarkWebResult[];
  emailPatterns: EmailPattern[];
  dorkQueries: string[];
  exposedData: Array<{ platform: string; field: string; value: string }>;
}

// ── Username tab components ───────────────────────────────────────────────────

const STATUS_ICON: Record<PlatformResult["status"], React.ReactNode> = {
  found:     <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff88] shrink-0" />,
  not_found: <XCircle className="w-3.5 h-3.5 text-primary/20 shrink-0" />,
  possible:  <AlertCircle className="w-3.5 h-3.5 text-yellow-400 shrink-0" />,
  timeout:   <Clock className="w-3.5 h-3.5 text-primary/20 shrink-0" />,
  error:     <HelpCircle className="w-3.5 h-3.5 text-primary/20 shrink-0" />,
  manual:    <HelpCircle className="w-3.5 h-3.5 text-blue-400/60 shrink-0" />,
};

const STATUS_LABEL: Record<PlatformResult["status"], string> = {
  found: "FOUND", not_found: "CLEAR", possible: "POSSIBLE",
  timeout: "TIMEOUT", error: "ERROR", manual: "MANUAL CHECK",
};

const STATUS_COLOR: Record<PlatformResult["status"], string> = {
  found: "text-[#00ff88]",
  not_found: "text-primary/25",
  possible: "text-yellow-400",
  timeout: "text-primary/20",
  error: "text-primary/20",
  manual: "text-blue-400/60",
};

// ── Discord Lookup Panel ──────────────────────────────────────────────────────

const STATUS_PRESENCE: Record<string, string> = {
  online: "🟢 Online", idle: "🟡 Idle", dnd: "🔴 Do Not Disturb", offline: "⚫ Offline",
};

function DiscordLookupPanel({
  discordUsername, setDiscordUsername,
  discordUserId, setDiscordUserId,
  discordResult, discordMut, showSteps, setShowSteps,
}: {
  discordUsername: string; setDiscordUsername: (v: string) => void;
  discordUserId: string; setDiscordUserId: (v: string) => void;
  discordResult: DiscordLookupResult | null;
  discordMut: { mutate: (b: { username?: string; userId?: string }) => void; isPending: boolean };
  showSteps: boolean; setShowSteps: (v: boolean) => void;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const copyText = (t: string, key: string) => {
    navigator.clipboard.writeText(t);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const canRun = (discordUsername.trim().length > 0 || /^\d{17,20}$/.test(discordUserId.trim()));

  const dr = discordResult;
  const hasBreachHit = dr?.idBreachHits?.some(h => h.found) ?? false;
  const avatarSrc = dr?.avatar ?? dr?.lanyardPresence?.avatar ?? dr?.defaultAvatarUrl;

  return (
    <div className="border border-indigo-500/20 rounded-sm bg-indigo-950/10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-500/15">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-400/60" />
          <span className="text-[11px] font-bold text-indigo-300/80 uppercase tracking-widest">Discord Deep Lookup</span>
        </div>
        <button onClick={() => setShowSteps(!showSteps)} className="text-[10px] text-indigo-300/40 hover:text-indigo-300/80 transition-colors">
          {showSteps ? "Hide" : "How to find my ID →"}
        </button>
      </div>

      {/* How to find your ID (collapsible) */}
      {showSteps && (
        <div className="px-4 py-3 border-b border-indigo-500/10 bg-indigo-950/20 space-y-1.5">
          <div className="text-[10px] text-indigo-300/60 font-bold mb-2 uppercase tracking-wide">How to find your Discord User ID</div>
          {(dr?.selfLookupSteps ?? [
            "Open Discord (desktop or mobile)",
            "Settings → Advanced → Enable 'Developer Mode'",
            "Right-click your username anywhere → 'Copy User ID'",
            "Paste the 18-digit number into the User ID field below",
          ]).map((step, i) => (
            <div key={i} className="flex items-start gap-2 text-[10px] text-indigo-200/40">
              <span className="text-indigo-400/50 font-mono shrink-0">{i + 1}.</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}

      {/* Inputs */}
      <div className="px-4 py-3 space-y-2">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div>
            <div className="text-[9px] text-indigo-300/40 uppercase tracking-widest mb-1">Username (optional)</div>
            <input
              value={discordUsername}
              onChange={e => setDiscordUsername(e.target.value.replace(/^@+/, ""))}
              placeholder="slovakian.t3eny"
              className="w-full bg-black/40 border border-indigo-500/20 text-primary text-xs font-mono px-3 py-2 focus:outline-none focus:border-indigo-400/40 placeholder:text-primary/15 rounded-sm"
            />
          </div>
          <div>
            <div className="text-[9px] text-indigo-300/40 uppercase tracking-widest mb-1">User ID — 18-digit Snowflake</div>
            <input
              value={discordUserId}
              onChange={e => setDiscordUserId(e.target.value.replace(/\D/g, "").slice(0, 20))}
              placeholder="123456789012345678"
              className="w-full bg-black/40 border border-indigo-500/20 text-primary text-xs font-mono px-3 py-2 focus:outline-none focus:border-indigo-400/40 placeholder:text-primary/15 rounded-sm"
            />
          </div>
        </div>
        <Button
          onClick={() => discordMut.mutate({
            username: discordUsername.trim() || undefined,
            userId: discordUserId.trim() || undefined,
          })}
          disabled={discordMut.isPending || !canRun}
          className="w-full bg-indigo-600/70 hover:bg-indigo-500/80 text-white font-bold font-mono text-xs py-2 rounded-sm"
        >
          {discordMut.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1.5" />Scanning Discord...</> : "Run Discord Lookup & Breach Check"}
        </Button>
      </div>

      {/* Results */}
      {dr && !discordMut.isPending && (
        <div className="px-4 pb-4 space-y-3 border-t border-indigo-500/10 pt-3">

          {/* Alert banner */}
          {hasBreachHit && (
            <div className="flex items-center gap-2 p-2.5 border border-red-400/30 bg-red-900/10 rounded-sm">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <div className="text-[11px] text-red-300 font-bold">⚠ Discord User ID found in paste / dark web sources — review breach hits below</div>
            </div>
          )}
          {!hasBreachHit && dr.resolvedUserId && (
            <div className="flex items-center gap-2 p-2.5 border border-[#00ff88]/15 bg-[#00ff88]/3 rounded-sm">
              <CheckCircle2 className="w-4 h-4 text-[#00ff88] shrink-0" />
              <div className="text-[11px] text-[#00ff88]/80">No breach / paste hits found for this User ID</div>
            </div>
          )}

          {/* Profile card */}
          {dr.resolvedUserId && (
            <div className="border border-indigo-500/20 rounded-sm p-3 bg-indigo-950/10">
              <div className="text-[9px] text-indigo-300/40 uppercase tracking-widest mb-2">Discord Profile</div>
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <img
                  src={avatarSrc ?? `https://cdn.discordapp.com/embed/avatars/0.png`}
                  alt="avatar"
                  className="w-12 h-12 rounded-full border border-indigo-500/30 shrink-0 bg-indigo-950/30"
                  onError={e => { (e.target as HTMLImageElement).src = "https://cdn.discordapp.com/embed/avatars/0.png"; }}
                />
                <div className="flex-1 min-w-0 space-y-1">
                  {(dr.profile?.displayName || dr.displayName) && (
                    <div className="text-sm font-bold text-primary">{dr.profile?.displayName ?? dr.displayName}</div>
                  )}
                  {(dr.profile?.username || dr.lanyardPresence?.username) && (
                    <div className="text-[11px] text-indigo-300/60 font-mono">@{dr.profile?.username ?? dr.lanyardPresence?.username}</div>
                  )}
                  {dr.lanyardPresence?.status && (
                    <div className="text-[10px] text-indigo-200/50">{STATUS_PRESENCE[dr.lanyardPresence.status] ?? dr.lanyardPresence.status}</div>
                  )}
                  {dr.lanyardPresence?.activities && dr.lanyardPresence.activities.length > 0 && (
                    <div className="text-[10px] text-indigo-200/40">Currently: {dr.lanyardPresence.activities.join(", ")}</div>
                  )}
                </div>
                {dr.profileUrl && (
                  <a href={dr.profileUrl} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 text-indigo-400/30 hover:text-indigo-400/80 transition-colors" title="Open Discord profile">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>

              {/* Snowflake data */}
              {dr.snowflake && (
                <div className="mt-3 pt-2 border-t border-indigo-500/10 grid grid-cols-2 gap-x-4 gap-y-1.5">
                  <div>
                    <div className="text-[9px] text-indigo-300/30 uppercase tracking-wide">User ID</div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono text-primary/80">{dr.resolvedUserId}</span>
                      <button onClick={() => copyText(dr.resolvedUserId!, "uid")} className="text-primary/20 hover:text-primary/60 transition-colors">
                        {copied === "uid" ? <CheckCircle2 className="w-3 h-3 text-[#00ff88]" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-indigo-300/30 uppercase tracking-wide">Account Created</div>
                    <div className="text-[11px] font-mono text-primary/80">{new Date(dr.snowflake.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</div>
                  </div>
                  <div>
                    <div className="text-[9px] text-indigo-300/30 uppercase tracking-wide">Account Age</div>
                    <div className="text-[11px] font-mono text-primary/80">
                      {dr.accountAgeDays !== null ? `${Math.floor(dr.accountAgeDays / 365)}y ${Math.floor((dr.accountAgeDays % 365) / 30)}mo` : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[9px] text-indigo-300/30 uppercase tracking-wide">Resolved Via</div>
                    <div className="text-[11px] font-mono text-indigo-300/50">{dr.resolvedSource ?? "—"}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Paste / breach ID exposure — most alarming finding, shown prominently */}
          {dr.pasteExposures && dr.pasteExposures.length > 0 && (
            <div className="border border-orange-400/25 bg-orange-900/8 rounded-sm p-3 space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                <span className="text-[11px] font-bold text-orange-300">
                  User ID exposed in public paste / source data ({dr.pasteExposures.length} hit{dr.pasteExposures.length !== 1 ? "s" : ""})
                </span>
              </div>
              <div className="text-[10px] text-orange-200/50 leading-relaxed">
                Your Discord username was found alongside a Snowflake User ID in publicly accessible paste or code data.
                This means your ID has been leaked or publicly shared somewhere.
              </div>
              {dr.pasteExposures.map((ex, i) => (
                <div key={i} className="border border-orange-400/15 rounded-sm p-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-orange-300/50 uppercase tracking-wide font-bold">{ex.source}</span>
                    <span className="text-[10px] font-mono text-orange-200/70 font-bold">ID: {ex.userId}</span>
                    <button onClick={() => copyText(ex.userId, `pe${i}`)} className="text-primary/20 hover:text-orange-300 transition-colors">
                      {copied === `pe${i}` ? <CheckCircle2 className="w-3 h-3 text-[#00ff88]" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="text-[10px] text-orange-200/30 font-mono break-all leading-relaxed">{ex.context}</div>
                </div>
              ))}
            </div>
          )}

          {/* ID resolution attempts */}
          {dr.lookupAttempts.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] text-primary/25 uppercase tracking-widest mb-1">ID Resolution Scan</div>
              {dr.lookupAttempts.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-[10px]">
                  {a.status === "found" ? <CheckCircle2 className="w-3 h-3 text-[#00ff88] shrink-0" />
                    : a.status === "not_found" ? <XCircle className="w-3 h-3 text-primary/20 shrink-0" />
                    : <AlertCircle className="w-3 h-3 text-yellow-400/50 shrink-0" />}
                  <span className="text-primary/50 font-mono">{a.source}</span>
                  <span className={a.status === "found" ? "text-[#00ff88]/70" : "text-primary/25"}>
                    {a.status === "found" ? (a.note ?? "ID resolved") : a.status === "not_found" ? "Not found" : "Error"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Breach / paste hits */}
          {dr.idBreachHits && (
            <div className="space-y-1">
              <div className="text-[9px] text-primary/25 uppercase tracking-widest">Breach & Paste Scan for User ID</div>
              {dr.idBreachHits.map((h, i) => (
                <div key={i} className={`flex items-center gap-2 p-2 rounded-sm border text-[10px] ${h.found ? "border-red-400/20 bg-red-900/5" : "border-primary/5"}`}>
                  {h.found ? <AlertCircle className="w-3 h-3 text-red-400 shrink-0" /> : <XCircle className="w-3 h-3 text-primary/15 shrink-0" />}
                  <span className={`font-mono ${h.found ? "text-primary/80 font-bold" : "text-primary/30"}`}>{h.source}</span>
                  {h.found ? (
                    <span className="text-red-300/70">{h.resultCount ? `${h.resultCount} result${h.resultCount !== 1 ? "s" : ""}` : "HIT"}{h.note ? ` — ${h.note}` : ""}</span>
                  ) : (
                    <span className="text-primary/20">No matches</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Dork queries */}
          {dr.idDorkQueries && dr.idDorkQueries.length > 0 && (
            <div className="space-y-1">
              <div className="text-[9px] text-primary/25 uppercase tracking-widest mb-1.5">Google Dork Queries for User ID</div>
              {dr.idDorkQueries.map((q, i) => (
                <div key={i} className="flex items-center gap-2 group">
                  <code className="flex-1 text-[10px] text-primary/50 font-mono bg-black/30 border border-primary/8 px-2 py-1 rounded-sm break-all">{q}</code>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => copyText(q, `dq${i}`)} className="text-primary/15 hover:text-primary/50 transition-colors p-1">
                      {copied === `dq${i}` ? <CheckCircle2 className="w-3 h-3 text-[#00ff88]" /> : <Copy className="w-3 h-3" />}
                    </button>
                    <a href={`https://www.google.com/search?q=${encodeURIComponent(q)}`} target="_blank" rel="noopener noreferrer"
                      className="text-primary/15 hover:text-indigo-400/60 transition-colors p-1">
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Not resolved */}
          {!dr.resolvedUserId && (
            <div className="text-[11px] text-primary/30 text-center py-2">
              Could not resolve a User ID from the username automatically.
              Enable Developer Mode in Discord, copy your User ID, and paste it in the field above.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const CATEGORY_ORDER = ["Social", "Video", "Dev", "Pro", "Creative", "Gaming", "Messaging", "Community"];

function PlatformGrid({ results }: { results: PlatformResult[] }) {
  const [showAll, setShowAll] = useState(false);
  const byCategory: Record<string, PlatformResult[]> = {};
  for (const r of results) {
    (byCategory[r.category] ??= []).push(r);
  }
  return (
    <div className="space-y-4">
      {CATEGORY_ORDER.map(cat => {
        const group = byCategory[cat];
        if (!group?.length) return null;
        const HIDE = new Set(["not_found", "error", "timeout"] as PlatformResult["status"][]);
        const visible = showAll ? group : group.filter(r => !HIDE.has(r.status));
        const hidden = group.filter(r => HIDE.has(r.status));
        return (
          <div key={cat}>
            <div className="text-[9px] uppercase tracking-widest text-primary/30 mb-1.5 border-b border-primary/8 pb-1">{cat}</div>
            <div className="grid grid-cols-1 gap-1">
              {visible.map(r => (
                <div key={r.name} className={`flex items-start gap-2 p-2 rounded-sm border transition-colors
                  ${r.status === "found"   ? "border-[#00ff88]/15 bg-[#00ff88]/3"
                  : r.status === "possible" ? "border-yellow-400/10 bg-yellow-400/3"
                  : r.status === "manual"   ? "border-blue-400/10 bg-blue-900/5"
                  : "border-primary/5 opacity-40"}`}>
                  <div className="mt-0.5">{STATUS_ICON[r.status]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold ${r.status === "found" ? "text-primary" : r.status === "manual" ? "text-blue-300/70" : "text-primary/40"}`}>{r.name}</span>
                      <span className={`text-[9px] font-mono font-bold ${STATUS_COLOR[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                      {r.statusCode !== null && r.status !== "not_found" && r.status !== "manual" && (
                        <span className="text-[9px] text-primary/20">{r.statusCode}</span>
                      )}
                    </div>
                    {r.status === "manual" && r.manualNote && (
                      <div className="text-[10px] text-blue-300/50 mt-0.5 leading-relaxed">{r.manualNote}</div>
                    )}
                    {r.snippet?.title && !r.snippet.title.toLowerCase().includes("not found") && (
                      <div className="text-[10px] text-primary/50 mt-0.5 truncate">{r.snippet.title}</div>
                    )}
                    {r.snippet?.description && (
                      <div className="text-[10px] text-primary/30 mt-0.5 line-clamp-2">{r.snippet.description}</div>
                    )}
                    {r.status === "possible" && r.url && (
                      <div className="text-[10px] text-yellow-400/40 mt-0.5">
                        Bot-blocked or inconclusive — click to verify manually
                      </div>
                    )}
                  </div>
                  {/* Link for found AND possible (so user can verify manually) */}
                  {(r.status === "found" || r.status === "possible") && r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer"
                      className={`shrink-0 transition-colors ${r.status === "found" ? "text-primary/20 hover:text-[#00ff88]" : "text-primary/15 hover:text-yellow-400"}`}
                      title={`Open ${r.name} profile`}>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
              {!showAll && hidden.length > 0 && (
                <button onClick={() => setShowAll(true)} className="text-[10px] text-primary/20 hover:text-primary/50 text-left py-1 pl-2">
                  + {hidden.length} not found / timed out — click to show
                </button>
              )}
            </div>
          </div>
        );
      })}
      {showAll && (
        <button onClick={() => setShowAll(false)} className="text-[10px] text-primary/30 hover:text-primary/60 pl-2">
          ↑ Collapse not-found results
        </button>
      )}
    </div>
  );
}

function DarkWebSection({ darkWeb }: { darkWeb: DarkWebResult[] }) {
  const found = darkWeb.filter(d => d.status === "found");
  const possible = darkWeb.filter(d => d.status === "possible");
  return (
    <div className="space-y-2">
      {darkWeb.map(d => (
        <div key={d.source} className={`p-2.5 rounded-sm border ${d.status === "found" ? "border-red-500/25 bg-red-900/8" : d.status === "possible" ? "border-orange-400/15 bg-orange-900/5" : "border-primary/8 opacity-40"}`}>
          <div className="flex items-center gap-2 mb-1">
            {d.status === "found" ? <Flame className="w-3.5 h-3.5 text-red-400 shrink-0" />
              : d.status === "possible" ? <AlertCircle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              : <Shield className="w-3.5 h-3.5 text-primary/20 shrink-0" />}
            <span className={`text-[10px] font-bold ${d.status === "found" ? "text-red-400" : d.status === "possible" ? "text-orange-400" : "text-primary/30"}`}>{d.source}</span>
            <span className="text-[9px] border border-current/20 px-1 text-[9px] uppercase ml-auto">
              {d.type === "dark_web" ? "TOR INDEX" : d.type === "paste" ? "PASTE SITE" : "BREACH DB"}
            </span>
            {d.resultCount !== undefined && d.resultCount > 0 && (
              <span className="text-[9px] font-mono text-red-400">{d.resultCount} results</span>
            )}
          </div>
          {d.snippets?.map((s, i) => (
            <div key={i} className="ml-5 text-[10px] border-l border-primary/10 pl-2 mb-1">
              <div className="text-primary/60 font-bold truncate">{s.title}</div>
              {s.description && <div className="text-primary/30 line-clamp-2">{s.description}</div>}
              {s.url && <div className="text-primary/20 text-[9px] truncate">{s.url}</div>}
            </div>
          ))}
        </div>
      ))}
      {found.length === 0 && possible.length === 0 && (
        <div className="text-[10px] text-primary/30 text-center py-3">No dark web / paste site hits detected</div>
      )}
    </div>
  );
}

function EmailCorrelation({ emailPatterns }: { emailPatterns: EmailPattern[] }) {
  const { toast } = useToast();
  const gravatarHits = emailPatterns.filter(e => e.hasGravatar);
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] text-primary/30 mb-2">
        Derived from username pattern · Gravatar lookup confirms profile photo linked to email
      </div>
      {emailPatterns.map(ep => (
        <div key={ep.email} className={`flex items-center gap-2 p-2 rounded-sm border ${ep.hasGravatar ? "border-orange-400/25 bg-orange-900/5" : "border-primary/8"}`}>
          <Mail className={`w-3.5 h-3.5 shrink-0 ${ep.hasGravatar ? "text-orange-400" : "text-primary/20"}`} />
          <span className={`text-[10px] flex-1 font-mono ${ep.hasGravatar ? "text-orange-300" : "text-primary/30"}`}>{ep.email}</span>
          {ep.hasGravatar ? (
            <span className="text-[9px] border border-orange-400/30 text-orange-400 px-1 font-bold">GRAVATAR HIT — email likely active</span>
          ) : (
            <span className="text-[9px] text-primary/20">no gravatar</span>
          )}
          <button onClick={() => { navigator.clipboard.writeText(ep.email); toast({ title: "Copied" }); }} className="text-primary/20 hover:text-primary/60 transition-colors">
            <Copy className="w-3 h-3" />
          </button>
        </div>
      ))}
      {gravatarHits.length > 0 && (
        <div className="mt-2 p-2 border border-orange-400/20 bg-orange-900/5 rounded-sm text-[10px] text-orange-300">
          ⚠ {gravatarHits.length} email pattern{gravatarHits.length > 1 ? "s" : ""} confirmed via Gravatar —
          these email addresses are likely real and active. Consider locking them down.
        </div>
      )}
    </div>
  );
}

function ExposedDataSection({ exposedData }: { exposedData: Array<{ platform: string; field: string; value: string }> }) {
  if (!exposedData.length) return (
    <div className="text-[10px] text-primary/30 text-center py-3">No personal data extracted from found profiles</div>
  );
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] text-primary/30 mb-2">Data extracted from public profile pages of found accounts</div>
      {exposedData.map((d, i) => (
        <div key={i} className="p-2 border border-primary/10 rounded-sm">
          <div className="flex items-center gap-2 mb-0.5">
            <Eye className="w-3 h-3 text-yellow-400 shrink-0" />
            <span className="text-[9px] text-primary/40 uppercase">{d.platform}</span>
            <span className="text-[9px] border border-primary/15 text-primary/30 px-1">{d.field}</span>
          </div>
          <div className="text-[10px] text-primary/70 ml-5 break-words">{d.value}</div>
        </div>
      ))}
    </div>
  );
}

function DorkQueries({ queries }: { queries: string[] }) {
  const { toast } = useToast();
  return (
    <div className="space-y-1.5">
      <div className="text-[10px] text-primary/30 mb-2">
        Copy and paste into Google, Bing, or DuckDuckGo. Use these to find more exposures manually.
      </div>
      {queries.map((q, i) => (
        <div key={i} className="flex items-center gap-2 p-2 border border-primary/8 rounded-sm hover:border-primary/20 transition-colors group">
          <Search className="w-3 h-3 text-primary/20 shrink-0 group-hover:text-primary/50 transition-colors" />
          <code className="text-[10px] text-primary/50 flex-1 break-all">{q}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(q); toast({ title: "Query copied" }); }}
            className="text-primary/20 hover:text-[#00ff88] transition-colors opacity-0 group-hover:opacity-100"
          >
            <Copy className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OsintRecon() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = usePersistedState<"domain" | "username">("osint-active-tab", "domain");

  // Domain/IP tab
  const [target, setTarget] = usePersistedState<string>("osint-target", "");
  const [domainResult, setDomainResult] = useState<any>(null);

  // Username tab
  const [username, setUsername] = usePersistedState<string>("osint-username", "");
  const [userResult, setUserResult] = useState<UsernameResult | null>(null);

  // Discord lookup
  const [discordUsername, setDiscordUsername] = useState("");
  const [discordUserId, setDiscordUserId] = useState("");
  const [discordResult, setDiscordResult] = useState<DiscordLookupResult | null>(null);
  const [showDiscordSteps, setShowDiscordSteps] = useState(false);

  const discordMut = useMutation({
    mutationFn: (body: { username?: string; userId?: string }) =>
      apiFetch("/osint/discord-lookup", { method: "POST", body: JSON.stringify(body) }),
    onSuccess: (data) => setDiscordResult(data),
    onError: (err: Error) => toast({ title: "Discord lookup failed", description: err.message, variant: "destructive" }),
  });

  const lookupMut = useMutation({
    mutationFn: (t: string) => apiFetch("/osint/lookup", { method: "POST", body: JSON.stringify({ target: t }) }),
    onSuccess: (data) => setDomainResult(data),
    onError: (err: Error) => toast({ title: "Lookup failed", description: err.message, variant: "destructive" }),
  });

  const usernameMut = useMutation({
    mutationFn: (u: string) => apiFetch("/osint/username", { method: "POST", body: JSON.stringify({ username: u }) }),
    onSuccess: (data) => setUserResult(data),
    onError: (err: Error) => toast({ title: "Username scan failed", description: err.message, variant: "destructive" }),
  });

  const dns = domainResult?.dns;
  const http = domainResult?.http;
  const tlsCert = domainResult?.tls;
  const ip = domainResult?.ip;
  const email = domainResult?.email;
  const exposure = domainResult?.exposure;

  return (
    <div className="p-4 md:p-6 space-y-5 font-mono min-h-screen">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Globe className="w-5 h-5 text-[#00ff88]" />
          <h1 className="text-lg font-bold text-primary tracking-tight">OSINT Recon</h1>
          <Badge className="text-[9px] border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88] font-mono uppercase tracking-widest px-1.5">Passive</Badge>
        </div>
        <p className="text-xs text-primary/40 max-w-xl leading-relaxed">
          Passive intelligence gathering — domain recon, username enumeration across 35+ platforms, dark web indexer searches, email correlation, and breach surface mapping.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-primary/15">
        {(["domain", "username"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wide border-b-2 transition-colors ${
              activeTab === tab
                ? "border-[#00ff88] text-[#00ff88]"
                : "border-transparent text-primary/30 hover:text-primary/60"
            }`}
          >
            {tab === "domain" ? <Globe className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
            {tab === "domain" ? "Domain / IP" : "Username & Exposure"}
          </button>
        ))}
      </div>

      {/* ── Domain / IP tab ── */}
      {activeTab === "domain" && (
        <>
          <div className="border border-primary/20 p-4 rounded-sm bg-primary/2">
            <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-2">Target</div>
            <div className="flex gap-2">
              <input
                value={target}
                onChange={e => setTarget(e.target.value)}
                onKeyDown={e => e.key === "Enter" && target.trim() && lookupMut.mutate(target.trim())}
                placeholder="example.com or 1.2.3.4"
                className="flex-1 bg-black/40 border border-primary/20 text-primary text-sm font-mono px-3 py-2 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm"
              />
              <Button
                onClick={() => target.trim() && lookupMut.mutate(target.trim())}
                disabled={lookupMut.isPending || !target.trim()}
                className="bg-[#00ff88] hover:bg-[#00ff88]/80 text-black font-bold font-mono text-xs px-5 rounded-sm"
              >
                {lookupMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Recon"}
              </Button>
            </div>
            <div className="mt-2 text-[10px] text-primary/20">DNS · TLS · HTTP headers · Email security records · CDN detection</div>
          </div>

          {target.trim() && <BlockchainEnrichment target={target} />}

          {lookupMut.isPending && (
            <div className="border border-primary/10 p-8 text-center rounded-sm">
              <Loader2 className="w-6 h-6 text-[#00ff88] mx-auto mb-2 animate-spin" />
              <div className="text-xs text-primary/40">Gathering passive intelligence...</div>
              <div className="text-[10px] text-primary/20 mt-1">DNS · TLS · HTTP · Email Security</div>
            </div>
          )}

          {domainResult && !lookupMut.isPending && (
            <div className="space-y-3">
              {exposure && (
                <div className="border border-primary/20 p-4 rounded-sm bg-primary/3">
                  <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-3">Exposure Summary — {domainResult.target}</div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="text-[10px] text-primary/40 mb-1">TLS Risk</div>
                      <RiskPill risk={exposure.tlsRisk?.risk || "info"} />
                      <div className="text-[10px] text-primary/30 mt-1 leading-relaxed">{exposure.tlsRisk?.reason}</div>
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-primary/40 mb-1">Header Risk</div>
                      <RiskPill risk={exposure.headerRisk?.risk || "info"} />
                      {exposure.headerRisk?.missingHeaders?.length > 0 && (
                        <div className="text-[10px] text-primary/30 mt-1">Missing: {exposure.headerRisk.missingHeaders.join(", ")}</div>
                      )}
                    </div>
                    <div className="text-center">
                      <div className="text-[10px] text-primary/40 mb-1">Email Security</div>
                      <div className="flex justify-center gap-1.5 mt-1">
                        {["DKIM", "DMARC", "SPF"].map((rec, i) => {
                          const has = i === 0 ? exposure.emailSecurity?.hasDkim : i === 1 ? exposure.emailSecurity?.hasDmarc : exposure.emailSecurity?.hasSpf;
                          return (
                            <span key={rec} className={`text-[9px] font-bold border px-1 py-0.5 rounded ${has ? "border-[#00ff88]/30 text-[#00ff88]" : "border-red-400/30 text-red-400/70 line-through"}`}>{rec}</span>
                          );
                        })}
                      </div>
                      <div className={`text-[10px] mt-1 font-bold ${(exposure.emailSecurity?.score || 0) >= 66 ? "text-[#00ff88]" : (exposure.emailSecurity?.score || 0) >= 33 ? "text-yellow-400" : "text-red-400"}`}>
                        {exposure.emailSecurity?.score || 0}/100
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {ip && (
                <Section title="IP & Hosting" icon={Server}>
                  <KV k="Primary IP" v={ip.primary} highlight="text-[#00ff88] font-bold" />
                  {ip.all.length > 1 && <KV k="All IPs" v={ip.all.join(", ")} />}
                  <KV k="ASN" v={ip.asn} />
                  {ip.isCloudflare && <KV k="CDN" v={<span className="text-orange-400">Cloudflare</span>} />}
                  {ip.isAws && <KV k="CDN" v={<span className="text-yellow-400">Amazon AWS</span>} />}
                </Section>
              )}
              {dns && (
                <Section title="DNS Records" icon={Globe}>
                  {dns.a?.length > 0 && <KV k="A" v={dns.a.join(", ")} />}
                  {dns.aaaa?.length > 0 && <KV k="AAAA" v={dns.aaaa.join(", ")} />}
                  {dns.cname?.length > 0 && <KV k="CNAME" v={dns.cname.join(", ")} />}
                  {dns.ns?.length > 0 && <KV k="NS" v={dns.ns.join(", ")} />}
                  {dns.mx?.length > 0 && <KV k="MX" v={dns.mx.map((m: any) => `${m.exchange} (${m.priority})`).join(", ")} />}
                  {dns.txt?.length > 0 && (
                    <div className="mt-1">
                      <div className="text-primary/40 mb-1">TXT Records</div>
                      {dns.txt.slice(0, 5).map((t: string, i: number) => (
                        <div key={i} className="text-primary/60 text-[10px] py-0.5 border-b border-primary/5 last:border-0 break-all">{t}</div>
                      ))}
                    </div>
                  )}
                  {dns.ptr?.length > 0 && <KV k="PTR (reverse)" v={dns.ptr.join(", ")} />}
                </Section>
              )}
              {tlsCert && (
                <Section title="TLS Certificate" icon={Lock}>
                  <KV k="Subject (CN)" v={tlsCert.subject} highlight="text-[#00ff88]" />
                  <KV k="Issuer" v={tlsCert.issuer} />
                  <KV k="Protocol" v={tlsCert.protocol} />
                  <KV k="Valid Until" v={`${tlsCert.validTo} (${tlsCert.daysLeft}d left)`} highlight={tlsCert.daysLeft < 30 ? "text-yellow-400" : "text-primary/80"} />
                  {tlsCert.sans?.length > 0 && (
                    <div className="mt-1">
                      <div className="text-primary/40 mb-1">SANs ({tlsCert.sans.length})</div>
                      <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                        {tlsCert.sans.map((s: string) => (
                          <span key={s} className="text-[9px] border border-primary/15 text-primary/50 px-1 py-0.5 rounded">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </Section>
              )}
              {http && (
                <Section title="HTTP Headers" icon={Code2}>
                  <KV k="Status" v={http.status} />
                  {http.server && <KV k="Server" v={http.server} highlight="text-yellow-400" />}
                  {http.poweredBy && <KV k="X-Powered-By" v={http.poweredBy} highlight="text-yellow-400" />}
                  {http.cdn && <KV k="CDN Detected" v={http.cdn} highlight="text-orange-400" />}
                  <KV k="HSTS" v={http.hasHsts ? <span className="text-[#00ff88]">✓ Present</span> : <span className="text-red-400">✗ Missing</span>} />
                  <KV k="CSP" v={http.hasCsp ? <span className="text-[#00ff88]">✓ Present</span> : <span className="text-yellow-400">✗ Missing</span>} />
                  {http.hasCors && <KV k="CORS" v={<span className="text-yellow-400">Access-Control-Allow-Origin set</span>} />}
                  {http.contentType && <KV k="Content-Type" v={http.contentType} />}
                </Section>
              )}
              {email && (
                <Section title="Email Security" icon={Mail}>
                  <KV k="MX Records" v={`${email.mxCount} found`} />
                  <KV k="SPF" v={email.hasSpf ? <span className="text-[#00ff88]">✓ Configured</span> : <span className="text-red-400">✗ Missing — domain spoofing possible</span>} />
                  <KV k="DKIM" v={email.hasDkim ? <span className="text-[#00ff88]">✓ Configured</span> : <span className="text-yellow-400">✗ Not detected</span>} />
                  <KV k="DMARC" v={email.hasDmarc ? <span className="text-[#00ff88]">✓ Configured</span> : <span className="text-red-400">✗ Missing — phishing attacks unprotected</span>} />
                </Section>
              )}
            </div>
          )}

          {!domainResult && !lookupMut.isPending && (
            <div className="border border-primary/10 p-10 text-center rounded-sm">
              <Globe className="w-8 h-8 text-primary/15 mx-auto mb-3" />
              <div className="text-sm text-primary/25">Enter a domain or IP to begin passive recon</div>
              <div className="text-xs text-primary/15 mt-1">DNS · TLS · HTTP · Email Security · CDN · Hosting</div>
            </div>
          )}
        </>
      )}

      {/* ── Username & Exposure tab ── */}
      {activeTab === "username" && (
        <>
          <div className="border border-primary/20 p-4 rounded-sm bg-primary/2 space-y-3">
            <div className="text-[10px] text-primary/40 uppercase tracking-widest">Screen Name / Username</div>
            <div className="flex gap-2">
              <input
                value={username}
                onChange={e => setUsername(e.target.value.replace(/^@+/, ""))}
                onKeyDown={e => e.key === "Enter" && username.trim() && usernameMut.mutate(username.trim())}
                placeholder="yourhandle  (@ is stripped automatically)"
                className="flex-1 bg-black/40 border border-primary/20 text-primary text-sm font-mono px-3 py-2 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm"
              />
              <Button
                onClick={() => username.trim() && usernameMut.mutate(username.trim())}
                disabled={usernameMut.isPending || !username.trim()}
                className="bg-[#00ff88] hover:bg-[#00ff88]/80 text-black font-bold font-mono text-xs px-5 rounded-sm"
              >
                {usernameMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Scan"}
              </Button>
            </div>
            <div className="text-[10px] text-primary/20 leading-relaxed">
              Checks 35+ platforms · Ahmia & DarkSearch Tor indexers · 3 paste site monitors ·
              Gravatar email correlation · Profile data extraction · Google dork queries
            </div>
          </div>

          {usernameMut.isPending && (
            <div className="border border-primary/10 p-8 text-center rounded-sm space-y-2">
              <Loader2 className="w-6 h-6 text-[#00ff88] mx-auto animate-spin" />
              <div className="text-xs text-primary/40">Running full exposure scan...</div>
              <div className="text-[10px] text-primary/20">Checking platforms · dark web indexers · email correlation · profile extraction</div>
              <div className="text-[10px] text-primary/15">This may take 15–30 seconds</div>
            </div>
          )}

          {userResult && !usernameMut.isPending && (
            <div className="space-y-3">

              {/* Summary bar */}
              <div className="border border-primary/20 p-4 rounded-sm bg-primary/3">
                <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-3">
                  Exposure Summary — @{userResult.username}
                </div>
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div>
                    <div className={`text-2xl font-bold font-mono ${userResult.found > 0 ? "text-[#00ff88]" : "text-primary/20"}`}>{userResult.found}</div>
                    <div className="text-[9px] text-primary/40 uppercase tracking-wide">Confirmed</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold font-mono ${userResult.possible > 0 ? "text-yellow-400" : "text-primary/20"}`}>{userResult.possible}</div>
                    <div className="text-[9px] text-primary/40 uppercase tracking-wide">Possible</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold font-mono ${(userResult.darkWeb?.filter(d => d.status === "found").length ?? 0) > 0 ? "text-red-400" : "text-primary/20"}`}>
                      {userResult.darkWeb?.filter(d => d.status === "found").length ?? 0}
                    </div>
                    <div className="text-[9px] text-primary/40 uppercase tracking-wide">Dark Web Hits</div>
                  </div>
                  <div>
                    <div className={`text-2xl font-bold font-mono ${(userResult.emailPatterns?.filter(e => e.hasGravatar).length ?? 0) > 0 ? "text-orange-400" : "text-primary/20"}`}>
                      {userResult.emailPatterns?.filter(e => e.hasGravatar).length ?? 0}
                    </div>
                    <div className="text-[9px] text-primary/40 uppercase tracking-wide">Email Hits</div>
                  </div>
                </div>
                {userResult.exposedData?.length > 0 && (
                  <div className="mt-3 p-2 border border-yellow-400/20 bg-yellow-900/5 rounded-sm text-[10px] text-yellow-300">
                    ⚠ {userResult.exposedData.length} piece{userResult.exposedData.length !== 1 ? "s" : ""} of personal data extracted from found public profiles — see "Extracted Profile Data" below
                  </div>
                )}
              </div>

              {/* Platform results */}
              <Section title={`Platform Scan (${userResult.found} found / ${userResult.total} checked)`} icon={User}>
                <PlatformGrid results={userResult.results} />
              </Section>

              {/* Dark web */}
              {userResult.darkWeb?.length > 0 && (
                <Section title={`Dark Web & Paste Sites (${userResult.darkWeb.filter(d => d.status === "found").length} hits)`} icon={Flame} defaultOpen={userResult.darkWeb.some(d => d.status === "found")}>
                  <DarkWebSection darkWeb={userResult.darkWeb} />
                </Section>
              )}

              {/* Extracted profile data */}
              {userResult.exposedData !== undefined && (
                <Section title={`Extracted Profile Data (${userResult.exposedData.length} fields)`} icon={Eye} defaultOpen={userResult.exposedData.length > 0}>
                  <ExposedDataSection exposedData={userResult.exposedData} />
                </Section>
              )}

              {/* Email correlation */}
              {userResult.emailPatterns?.length > 0 && (
                <Section title={`Email Correlation (${userResult.emailPatterns.filter(e => e.hasGravatar).length} gravatar hits)`} icon={Mail} defaultOpen={userResult.emailPatterns.some(e => e.hasGravatar)}>
                  <EmailCorrelation emailPatterns={userResult.emailPatterns} />
                </Section>
              )}

              {/* Dork queries */}
              {userResult.dorkQueries?.length > 0 && (
                <Section title="OSINT Search Queries" icon={Search} defaultOpen={false}>
                  <DorkQueries queries={userResult.dorkQueries} />
                </Section>
              )}

              {/* HIBP note */}
              <div className="border border-primary/10 p-3 rounded-sm bg-primary/2">
                <div className="flex items-start gap-2">
                  <Database className="w-3.5 h-3.5 text-primary/30 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-primary/30 leading-relaxed">
                    <span className="font-bold text-primary/50">Breach database check (HaveIBeenPwned):</span> Add your{" "}
                    <code className="text-primary/60">HIBP_API_KEY</code> environment variable to enable live breach checking for the derived email patterns above.
                    Visit <span className="text-primary/50">haveibeenpwned.com/API/Key</span> to obtain a key.
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* ── Discord Deep Lookup — always visible in username tab ── */}
          <DiscordLookupPanel
            discordUsername={discordUsername} setDiscordUsername={setDiscordUsername}
            discordUserId={discordUserId}     setDiscordUserId={setDiscordUserId}
            discordResult={discordResult}     discordMut={discordMut}
            showSteps={showDiscordSteps}      setShowSteps={setShowDiscordSteps}
          />

          {!userResult && !usernameMut.isPending && (
            <div className="border border-primary/10 p-10 text-center rounded-sm">
              <User className="w-8 h-8 text-primary/15 mx-auto mb-3" />
              <div className="text-sm text-primary/25">Enter a screen name to scan for exposure</div>
              <div className="text-xs text-primary/15 mt-1">35+ platforms · Dark web indexers · Email correlation · Profile data · Dork queries</div>
            </div>
          )}
        </>
      )}

    </div>
  );
}
