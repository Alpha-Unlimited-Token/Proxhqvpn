// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Award, Copy, Check, Plus, Trash2, Loader2, Play,
  DollarSign, Users, TrendingUp, Clock, Youtube,
  ExternalLink, ChevronDown, ChevronUp, Globe,
  CheckCircle, XCircle, AlertCircle, Edit3, Save,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AmbassadorVideo {
  id:          number;
  title:       string;
  description: string | null;
  videoUrl:    string;
  embedUrl:    string | null;
}

interface Referral {
  id:            number;
  customerUserId: string;
  plan:          string | null;
  amountCents:   number;
  commissionCents: number;
  createdAt:     string;
}

interface AmbassadorProfile {
  id:                 number;
  name:               string;
  bio:                string | null;
  promoCode:          string;
  avatarUrl:          string | null;
  socialUrls:         Record<string, string>;
  status:             "pending" | "approved" | "rejected";
  totalEarningsCents: number;
  videos:             AmbassadorVideo[];
  referrals:          Referral[];
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { label: string; cls: string; icon: React.ElementType }> = {
    pending:  { label: "Pending Review",  cls: "text-yellow-400 border-yellow-500/30 bg-yellow-900/10", icon: Clock },
    approved: { label: "Approved — Live", cls: "text-green-400 border-green-500/30 bg-green-900/10",  icon: CheckCircle },
    rejected: { label: "Rejected",        cls: "text-red-400 border-red-500/30 bg-red-900/10",        icon: XCircle },
  };
  const { label, cls, icon: Icon } = cfg[status] ?? cfg.pending;
  return (
    <span className={`flex items-center gap-1.5 text-[10px] font-mono border rounded px-2 py-0.5 ${cls}`}>
      <Icon className="w-3 h-3" /> {label}
    </span>
  );
}

function VideoRow({ v, onDelete }: { v: AmbassadorVideo; onDelete: (id: number) => void }) {
  const [deleting, setDeleting] = useState(false);
  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`${BASE}/api/ambassadors/me/videos/${v.id}`, { method: "DELETE", credentials: "include" });
    onDelete(v.id);
    setDeleting(false);
  };
  return (
    <div className="flex items-center gap-3 border border-primary/15 rounded px-3 py-2.5">
      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center shrink-0">
        <Play className="w-3.5 h-3.5 text-primary/50" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono text-primary/80 font-semibold truncate">{v.title}</div>
        {v.description && <div className="text-[9px] text-primary/30 truncate">{v.description}</div>}
        <a href={v.videoUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1 text-[9px] text-primary/30 hover:text-primary/60 font-mono mt-0.5">
          <ExternalLink className="w-2.5 h-2.5" /> {v.videoUrl.substring(0, 50)}{v.videoUrl.length > 50 ? "…" : ""}
        </a>
      </div>
      <button onClick={handleDelete} disabled={deleting}
        className="text-red-400/40 hover:text-red-400 transition-colors shrink-0 disabled:opacity-40">
        {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

export default function AmbassadorDashboard() {
  const { toast }                 = useToast();
  const [profile, setProfile]     = useState<AmbassadorProfile | null>(null);
  const [loading, setLoading]     = useState(true);
  const [notFound, setNotFound]   = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  // Video add form
  const [addingVideo, setAddingVideo]   = useState(false);
  const [videoForm, setVideoForm]       = useState({ title: "", description: "", videoUrl: "" });
  const [savingVideo, setSavingVideo]   = useState(false);

  // Edit profile
  const [editingBio, setEditingBio]     = useState(false);
  const [bioValue, setBioValue]         = useState("");
  const [savingBio, setSavingBio]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/ambassadors/me`, { credentials: "include" });
      if (r.status === 404) { setNotFound(true); return; }
      if (!r.ok) throw new Error("Failed to load");
      const d = await r.json();
      setProfile(d);
      setBioValue(d.bio || "");
    } catch {
      toast({ title: "Could not load ambassador profile", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const copyCode = async () => {
    if (!profile) return;
    await navigator.clipboard.writeText(profile.promoCode).catch(() => {});
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
    toast({ title: "Promo code copied!", description: `${profile.promoCode} is now in your clipboard` });
  };

  const addVideo = async () => {
    if (!videoForm.title.trim() || !videoForm.videoUrl.trim()) {
      toast({ title: "Title and URL are required", variant: "destructive" }); return;
    }
    setSavingVideo(true);
    try {
      const r = await fetch(`${BASE}/api/ambassadors/me/videos`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(videoForm),
      });
      const d = await r.json();
      if (!r.ok) { toast({ title: d.error || "Failed to add video", variant: "destructive" }); return; }
      setProfile(p => p ? { ...p, videos: [...p.videos, d.video] } : p);
      setVideoForm({ title: "", description: "", videoUrl: "" });
      setAddingVideo(false);
      toast({ title: "Video added!", description: videoForm.title });
    } catch (e: any) {
      toast({ title: "Error: " + e.message, variant: "destructive" });
    } finally {
      setSavingVideo(false);
    }
  };

  const saveBio = async () => {
    setSavingBio(true);
    try {
      const r = await fetch(`${BASE}/api/ambassadors/me`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio: bioValue }),
      });
      if (!r.ok) { toast({ title: "Failed to save bio", variant: "destructive" }); return; }
      setProfile(p => p ? { ...p, bio: bioValue } : p);
      setEditingBio(false);
      toast({ title: "Profile updated" });
    } finally {
      setSavingBio(false);
    }
  };

  if (loading) return (
    <div className="flex items-center gap-2 text-[10px] font-mono text-primary/30 animate-pulse py-8">
      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading ambassador profile...
    </div>
  );

  if (notFound) return (
    <div className="max-w-lg text-center py-16 space-y-4">
      <Award className="w-12 h-12 text-primary/15 mx-auto" />
      <h2 className="text-xl font-bold text-primary">You're not an ambassador yet</h2>
      <p className="text-sm text-primary/40">Apply to become an ambassador and start earning 10% commission on every subscriber you refer.</p>
      <a href="/ambassador/apply"
        className="inline-flex items-center gap-2 px-5 py-2 bg-primary text-black text-xs font-mono font-bold uppercase tracking-widest hover:bg-primary/80 rounded transition-colors">
        Apply Now
      </a>
    </div>
  );

  if (!profile) return null;

  const totalReferrals  = profile.referrals.length;
  const totalCommission = profile.referrals.reduce((s, r) => s + r.commissionCents, 0);
  const pendingPayout   = profile.referrals.filter(r => !(r as any).paidOut).reduce((s, r) => s + r.commissionCents, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold tracking-widest uppercase text-primary">Ambassador Dashboard</h1>
          </div>
          <p className="text-xs text-primary/40 mt-0.5">Manage your profile, videos, and track your earnings</p>
        </div>
        <StatusBadge status={profile.status} />
      </div>

      {/* Status notice */}
      {profile.status === "pending" && (
        <div className="flex items-start gap-2 border border-yellow-500/20 bg-yellow-900/10 rounded px-4 py-3">
          <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
          <div className="text-[10px] font-mono text-yellow-400/80">
            <strong>Application under review.</strong> Your profile will go live once approved (usually within 24-48 hours).
            You can add videos and content now — they'll appear once approved.
          </div>
        </div>
      )}
      {profile.status === "rejected" && (
        <div className="flex items-start gap-2 border border-red-500/20 bg-red-900/10 rounded px-4 py-3">
          <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <div className="text-[10px] font-mono text-red-400/80">
            <strong>Application not approved.</strong> Contact us at support@proxhqvpn.com for more information.
          </div>
        </div>
      )}

      {/* Promo code */}
      <div className="border border-primary/20 rounded-lg p-5 bg-primary/5">
        <div className="text-[9px] font-mono text-primary/30 uppercase tracking-widest mb-2">Your Promo Code</div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-3xl font-mono font-bold text-primary tracking-[0.2em]">{profile.promoCode}</span>
          <button onClick={copyCode}
            className="flex items-center gap-2 border border-primary/30 hover:border-primary bg-black px-3 py-1.5 text-[10px] font-mono text-primary/60 hover:text-primary rounded transition-colors">
            {codeCopied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
            {codeCopied ? "Copied!" : "Copy Code"}
          </button>
        </div>
        <p className="text-[10px] text-primary/30 font-mono mt-2">
          Share this code with your audience. When they enter it at checkout, you earn 10% of their subscription.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { icon: Users,     label: "Referrals",       val: totalReferrals,                              cls: "" },
          { icon: DollarSign, label: "Total Earned",   val: `$${(totalCommission / 100).toFixed(2)}`,   cls: "text-green-400" },
          { icon: Clock,     label: "Pending Payout",  val: `$${(pendingPayout / 100).toFixed(2)}`,     cls: "text-yellow-400" },
          { icon: Play,      label: "Videos",          val: profile.videos.length,                      cls: "" },
        ].map(({ icon: Icon, label, val, cls }) => (
          <div key={label} className="border border-primary/15 rounded p-4 text-center">
            <Icon className="w-4 h-4 text-primary/30 mx-auto mb-1" />
            <div className={`text-2xl font-bold font-mono ${cls || "text-primary"}`}>{val}</div>
            <div className="text-[8px] text-primary/30 font-mono uppercase mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Profile / Bio */}
      <div className="border border-primary/15 rounded-lg p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-[9px] font-mono text-primary/30 uppercase tracking-widest">Your Profile</div>
          {!editingBio ? (
            <button onClick={() => setEditingBio(true)}
              className="flex items-center gap-1 text-[9px] font-mono text-primary/40 hover:text-primary border border-primary/20 hover:border-primary/40 px-2 py-1 rounded transition-colors">
              <Edit3 className="w-2.5 h-2.5" /> Edit Bio
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => setEditingBio(false)}
                className="text-[9px] font-mono text-primary/40 hover:text-primary transition-colors">Cancel</button>
              <button onClick={saveBio} disabled={savingBio}
                className="flex items-center gap-1 text-[9px] font-mono bg-primary text-black px-2 py-1 rounded hover:bg-primary/80 disabled:opacity-50 transition-colors">
                {savingBio ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Save className="w-2.5 h-2.5" />}
                Save
              </button>
            </div>
          )}
        </div>
        <div className="text-sm font-bold text-primary">{profile.name}</div>
        {editingBio ? (
          <textarea value={bioValue} onChange={e => setBioValue(e.target.value)} rows={3}
            className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-3 py-2 focus:outline-none focus:border-primary/50 rounded resize-y" />
        ) : (
          <p className="text-xs text-primary/50 leading-relaxed">
            {profile.bio || <span className="text-primary/20 italic">No bio yet — click Edit to add one</span>}
          </p>
        )}
        {/* Profile link */}
        {profile.status === "approved" && (
          <a href="/ambassadors" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[9px] font-mono text-primary/30 hover:text-primary/70 transition-colors">
            <ExternalLink className="w-2.5 h-2.5" /> View your public profile
          </a>
        )}
      </div>

      {/* Videos */}
      <div className="border border-primary/15 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[9px] font-mono text-primary/30 uppercase tracking-widest">
            Tutorial Videos ({profile.videos.length})
          </div>
          <button onClick={() => setAddingVideo(v => !v)}
            className="flex items-center gap-1.5 text-[9px] font-mono border border-primary/30 text-primary/60 hover:border-primary hover:text-primary px-3 py-1.5 rounded transition-colors">
            <Plus className="w-3 h-3" /> Add Video
          </button>
        </div>

        {/* Add video form */}
        {addingVideo && (
          <div className="border border-primary/20 bg-primary/5 rounded p-4 space-y-3">
            <div className="text-[9px] font-mono text-primary/50 uppercase">Add YouTube / Vimeo Tutorial</div>
            <div>
              <label className="text-[8px] font-mono text-primary/30 uppercase block mb-1">Video URL *</label>
              <input value={videoForm.videoUrl}
                onChange={e => setVideoForm(f => ({ ...f, videoUrl: e.target.value }))}
                placeholder="https://youtube.com/watch?v=... or https://vimeo.com/..."
                className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-3 py-1.5 focus:outline-none focus:border-primary/50 rounded" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[8px] font-mono text-primary/30 uppercase block mb-1">Title *</label>
                <input value={videoForm.title}
                  onChange={e => setVideoForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Getting Started with ProxhqVPN"
                  className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-3 py-1.5 focus:outline-none focus:border-primary/50 rounded" />
              </div>
              <div>
                <label className="text-[8px] font-mono text-primary/30 uppercase block mb-1">Description (optional)</label>
                <input value={videoForm.description}
                  onChange={e => setVideoForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="A quick overview of how to set up..."
                  className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-3 py-1.5 focus:outline-none focus:border-primary/50 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={addVideo} disabled={savingVideo}
                className="flex items-center gap-2 px-4 py-1.5 bg-primary text-black text-[10px] font-mono uppercase hover:bg-primary/80 disabled:opacity-50 rounded transition-colors">
                {savingVideo ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Add Video
              </button>
              <button onClick={() => setAddingVideo(false)}
                className="text-[9px] font-mono text-primary/40 hover:text-primary transition-colors">Cancel</button>
            </div>
          </div>
        )}

        {profile.videos.length === 0 ? (
          <div className="text-center py-6 border border-dashed border-primary/15 rounded">
            <Youtube className="w-8 h-8 text-primary/15 mx-auto mb-2" />
            <div className="text-[10px] font-mono text-primary/30">
              No videos yet. Add your first tutorial to attract subscribers!
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {profile.videos.map(v => (
              <VideoRow key={v.id} v={v} onDelete={id => setProfile(p => p ? { ...p, videos: p.videos.filter(x => x.id !== id) } : p)} />
            ))}
          </div>
        )}
      </div>

      {/* Referrals */}
      {profile.referrals.length > 0 && (
        <div className="border border-primary/15 rounded-lg p-5 space-y-3">
          <div className="text-[9px] font-mono text-primary/30 uppercase tracking-widest">Referrals & Earnings</div>
          <div className="space-y-1.5">
            {profile.referrals.map(r => (
              <div key={r.id} className="flex items-center gap-3 border border-primary/10 rounded px-3 py-2">
                <Users className="w-3.5 h-3.5 text-primary/20 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-mono text-primary/60">
                    {r.plan || "Subscriber"} — {new Date(r.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-bold text-green-400">
                    +${(r.commissionCents / 100).toFixed(2)}
                  </div>
                  <div className="text-[8px] font-mono text-primary/20">
                    of ${(r.amountCents / 100).toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between border-t border-primary/10 pt-3">
            <span className="text-[10px] font-mono text-primary/40">Total Commission Earned</span>
            <span className="text-sm font-mono font-bold text-green-400">
              ${(totalCommission / 100).toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
