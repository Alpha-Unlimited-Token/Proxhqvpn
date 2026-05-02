// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { PageSEO } from "@/components/PageSEO";
import { useToast } from "@/hooks/use-toast";
import {
  Star, Play, Copy, Check, Users, ChevronRight,
  Youtube, Globe, Twitter, Instagram, ExternalLink,
  Search, Award, TrendingUp, LogIn,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface AmbassadorVideo {
  id:          number;
  title:       string;
  description: string | null;
  videoUrl:    string;
  embedUrl:    string | null;
}

interface Ambassador {
  id:          number;
  name:        string;
  bio:         string | null;
  promoCode:   string;
  avatarUrl:   string | null;
  socialUrls:  Record<string, string>;
  videos:      AmbassadorVideo[];
}

function VideoEmbed({ video }: { video: AmbassadorVideo }) {
  const [playing, setPlaying] = useState(false);
  const embed = video.embedUrl;

  if (!embed) {
    return (
      <a href={video.videoUrl} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 border border-primary/20 rounded px-3 py-2 text-[10px] font-mono text-primary/60 hover:border-primary/40 hover:text-primary transition-colors">
        <ExternalLink className="w-3 h-3" /> Watch Video
      </a>
    );
  }

  if (playing) {
    return (
      <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={embed + "?autoplay=1"}
          className="absolute inset-0 w-full h-full rounded"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button onClick={() => setPlaying(true)}
      className="relative w-full group rounded overflow-hidden border border-primary/20 hover:border-primary/40 transition-colors"
      style={{ paddingBottom: "56.25%" }}>
      <div className="absolute inset-0 bg-black flex items-center justify-center">
        <img
          src={`https://img.youtube.com/vi/${embed.match(/embed\/([^?]+)/)?.[1] || ""}/hqdefault.jpg`}
          className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          alt=""
        />
        <div className="relative z-10 w-12 h-12 rounded-full bg-primary/90 flex items-center justify-center group-hover:bg-primary transition-colors">
          <Play className="w-5 h-5 text-black ml-0.5 fill-black" />
        </div>
      </div>
    </button>
  );
}

function PromoCodeBadge({ code, onCopy }: { code: string; onCopy: (c: string) => void }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    onCopy(code);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handle}
      className="flex items-center gap-2 border border-primary/30 bg-primary/5 hover:bg-primary/10 rounded px-3 py-1.5 transition-colors group">
      <span className="text-[10px] text-primary/40 font-mono uppercase tracking-widest">Promo Code</span>
      <span className="text-sm font-mono font-bold text-primary tracking-widest">{code}</span>
      {copied
        ? <Check className="w-3.5 h-3.5 text-green-400" />
        : <Copy className="w-3.5 h-3.5 text-primary/40 group-hover:text-primary transition-colors" />}
    </button>
  );
}

function AmbassadorCard({ amb }: { amb: Ambassador }) {
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const avatar = amb.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(amb.name)}&backgroundColor=00ff88&textColor=000000`;

  const socialIcon: Record<string, React.ElementType> = {
    youtube:   Youtube,
    twitter:   Twitter,
    instagram: Instagram,
    website:   Globe,
  };

  return (
    <div className="border border-primary/15 rounded-lg overflow-hidden bg-black hover:border-primary/30 transition-colors">
      {/* Header */}
      <div className="p-5 flex items-start gap-4">
        <img src={avatar} alt={amb.name}
          className="w-16 h-16 rounded-full border-2 border-primary/30 object-cover shrink-0 bg-primary/10" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-primary text-base">{amb.name}</h3>
            <Award className="w-4 h-4 text-yellow-400" />
          </div>
          {amb.bio && (
            <p className="text-xs text-primary/50 mt-1 leading-relaxed line-clamp-2">{amb.bio}</p>
          )}
          {/* Social links */}
          {Object.keys(amb.socialUrls || {}).length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {Object.entries(amb.socialUrls).map(([platform, url]) => {
                const Icon = socialIcon[platform] || Globe;
                return (
                  <a key={platform} href={url} target="_blank" rel="noopener noreferrer"
                    className="text-primary/30 hover:text-primary/70 transition-colors">
                    <Icon className="w-3.5 h-3.5" />
                  </a>
                );
              })}
            </div>
          )}
        </div>
        {/* Promo code */}
        <PromoCodeBadge code={amb.promoCode} onCopy={(code) => {
          toast({
            title: "Promo code copied!",
            description: `Use ${code} at checkout to support ${amb.name} and save 10%`,
          });
        }} />
      </div>

      {/* Videos */}
      {amb.videos.length > 0 && (
        <div className="border-t border-primary/10 px-5 pb-5">
          <button onClick={() => setExpanded(e => !e)}
            className="flex items-center gap-2 py-3 text-[10px] font-mono text-primary/40 uppercase tracking-widest hover:text-primary/70 transition-colors w-full">
            <Play className="w-3 h-3" />
            {amb.videos.length} Tutorial{amb.videos.length !== 1 ? "s" : ""}
            <ChevronRight className={`w-3 h-3 ml-auto transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
          {expanded && (
            <div className="space-y-4">
              {amb.videos.map(v => (
                <div key={v.id} className="space-y-2">
                  <div className="text-xs font-mono text-primary/70 font-semibold">{v.title}</div>
                  {v.description && <div className="text-[10px] text-primary/40">{v.description}</div>}
                  <VideoEmbed video={v} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="border-t border-primary/10 px-5 py-3 flex items-center justify-between bg-primary/5">
        <span className="text-[9px] font-mono text-primary/30">
          Copy promo code · use at checkout · {amb.name} earns 10%
        </span>
        <a href="/pricing" className="flex items-center gap-1 text-[9px] font-mono text-primary hover:text-primary/70 transition-colors">
          Subscribe <ChevronRight className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

export default function Ambassadors() {
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = usePersistedState<string>("ambassadors-search", "");
  const [, setLocation] = useLocation();
  const { isSignedIn } = useUser();

  useEffect(() => {
    fetch(`${BASE}/api/ambassadors`, { credentials: "include" })
      .then(r => r.json())
      .then(d => setAmbassadors(Array.isArray(d) ? d : []))
      .catch(() => setAmbassadors([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = ambassadors.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.promoCode.toLowerCase().includes(search.toLowerCase()) ||
    (a.bio || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8 max-w-5xl">
      <PageSEO
        title="Ambassadors — Earn 10% Commission on Every Referral"
        description="Join the ProxhqVPN Ambassador Program. Earn 10% commission on every subscription you refer. Create your promo code, share tutorial videos, and grow your audience."
        path="/ambassadors"
      />
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold tracking-widest uppercase text-primary">Ambassador Community</h1>
        </div>
        <p className="text-sm text-primary/83">
          Find an ambassador you trust, watch their tutorials, copy their promo code and use it at checkout.
          They earn 10% of your subscription — and you support someone who's genuinely helping the ProxhqVPN community grow.
        </p>
      </div>

      {/* How it works for visitors */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { step: "1", title: "Find an Ambassador", desc: "Browse the creators below. Watch their tutorials to learn how to get the most out of ProxhqVPN." },
          { step: "2", title: "Copy Their Promo Code", desc: "Click the promo code badge on any ambassador card. It copies instantly to your clipboard." },
          { step: "3", title: "Enter Code at Checkout", desc: "Paste the code when subscribing on the Pricing page. The ambassador earns 10% — no extra cost to you." },
        ].map(({ step, title, desc }) => (
          <div key={step} className="border border-primary/15 rounded p-4 bg-primary/5">
            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 text-primary text-[11px] font-mono font-bold flex items-center justify-center mb-2">
              {step}
            </div>
            <div className="text-[11px] font-bold text-primary mb-1">{title}</div>
            <div className="text-[10px] text-primary/83 leading-relaxed">{desc}</div>
          </div>
        ))}
      </div>

      {/* Stats banner */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Users, label: "Active Ambassadors", val: ambassadors.length },
          { icon: Play,  label: "Tutorials Available", val: ambassadors.reduce((s, a) => s + a.videos.length, 0) },
          { icon: TrendingUp, label: "Commission Rate", val: "10%" },
        ].map(({ icon: Icon, label, val }) => (
          <div key={label} className="border border-primary/15 rounded p-4 text-center bg-primary/5">
            <Icon className="w-4 h-4 text-primary/40 mx-auto mb-1" />
            <div className="text-2xl font-bold font-mono text-primary">{val}</div>
            <div className="text-[9px] text-primary/30 font-mono uppercase tracking-widest mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Become an ambassador CTA */}
      <div className="flex items-center justify-between border border-primary/20 rounded-lg px-5 py-4 bg-primary/5 gap-4 flex-wrap">
        <div>
          <div className="font-semibold text-primary text-sm">Want to become an ambassador?</div>
          <div className="text-[11px] text-primary/40 mt-0.5">Get your own promo code, upload YouTube tutorials, earn 10% on every subscriber you bring in.</div>
        </div>
        {isSignedIn ? (
          <button onClick={() => setLocation("/ambassador/apply")}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-black text-[11px] font-mono font-bold uppercase tracking-widest hover:bg-primary/80 rounded transition-colors shrink-0">
            Apply Now <ChevronRight className="w-3.5 h-3.5" />
          </button>
        ) : (
          <a href={`${BASE}/sign-up`}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-black text-[11px] font-mono font-bold uppercase tracking-widest hover:bg-primary/80 rounded transition-colors shrink-0">
            <LogIn className="w-3 h-3" /> Sign up to Apply
          </a>
        )}
      </div>

      {/* Search */}
      {ambassadors.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/30" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search ambassadors by name or promo code..."
            className="w-full bg-black border border-primary/20 text-primary text-xs font-mono pl-9 pr-4 py-2 focus:outline-none focus:border-primary/50 rounded" />
        </div>
      )}

      {/* Ambassador list */}
      {loading ? (
        <div className="flex items-center gap-2 text-[10px] font-mono text-primary/30 uppercase animate-pulse">
          Loading ambassadors...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 border border-primary/10 rounded-lg">
          <Users className="w-10 h-10 text-primary/15 mx-auto mb-3" />
          <div className="text-sm text-primary/30 font-mono">
            {ambassadors.length === 0 ? "No ambassadors yet — be the first!" : "No ambassadors match your search"}
          </div>
          {ambassadors.length === 0 && (
            isSignedIn ? (
              <button onClick={() => setLocation("/ambassador/apply")}
                className="mt-4 px-4 py-2 border border-primary/30 text-primary/60 text-[11px] font-mono uppercase hover:border-primary hover:text-primary rounded transition-colors">
                Apply to Join
              </button>
            ) : (
              <a href={`${BASE}/sign-up`}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 border border-primary/30 text-primary/60 text-[11px] font-mono uppercase hover:border-primary hover:text-primary rounded transition-colors">
                <LogIn className="w-3 h-3" /> Sign up to be first
              </a>
            )
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(a => <AmbassadorCard key={a.id} amb={a} />)}
        </div>
      )}
    </div>
  );
}
