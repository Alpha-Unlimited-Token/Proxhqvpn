// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { useLocation } from "wouter";
import { PageSEO } from "@/components/PageSEO";
import { useToast } from "@/hooks/use-toast";
import {
  Award, ChevronRight, Loader2, CheckCircle,
  Youtube, Twitter, Instagram, Globe, Info,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function AmbassadorApply() {
  const { toast }         = useToast();
  const [, setLocation]   = useLocation();
  const [loading, setLoading] = useState(false);
  const [done, setDone]   = useState(false);

  const [form, setForm] = useState({
    name:        "",
    bio:         "",
    promoCode:   "",
    avatarUrl:   "",
    youtube:     "",
    twitter:     "",
    instagram:   "",
    website:     "",
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const slugify = (s: string) =>
    s.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 12);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setForm(f => ({
      ...f,
      name,
      promoCode: f.promoCode || slugify(name),
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.promoCode.trim()) {
      toast({ title: "Name and promo code are required", variant: "destructive" }); return;
    }
    if (form.promoCode.length < 3) {
      toast({ title: "Promo code must be at least 3 characters", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/ambassadors/apply`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:      form.name.trim(),
          bio:       form.bio.trim() || undefined,
          promoCode: form.promoCode.trim().toUpperCase(),
          avatarUrl: form.avatarUrl.trim() || undefined,
          socialUrls: Object.fromEntries(
            Object.entries({ youtube: form.youtube, twitter: form.twitter, instagram: form.instagram, website: form.website })
              .filter(([, v]) => v.trim())
              .map(([k, v]) => [k, v.trim()])
          ),
        }),
      });
      const d = await r.json();
      if (!r.ok) { toast({ title: d.error || "Application failed", variant: "destructive" }); return; }
      setDone(true);
    } catch (e: any) {
      toast({ title: "Error: " + e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="max-w-lg mx-auto py-12 text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-900/20 border border-green-500/30 flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-primary">Application Submitted!</h2>
        <p className="text-sm text-primary/50 leading-relaxed">
          Your ambassador application is under review. We'll notify you by email once it's approved.
          In the meantime you can check your ambassador dashboard.
        </p>
        <div className="flex items-center gap-3 justify-center pt-2">
          <button onClick={() => setLocation("/ambassador/dashboard")}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-black text-xs font-mono font-bold uppercase tracking-widest hover:bg-primary/80 rounded transition-colors">
            Go to Dashboard <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setLocation("/ambassadors")}
            className="px-5 py-2 border border-primary/30 text-primary/60 text-xs font-mono uppercase hover:border-primary hover:text-primary rounded transition-colors">
            Browse Ambassadors
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <PageSEO
        title="Apply to Become a ProxhqVPN Ambassador"
        description="Apply for the ProxhqVPN Ambassador Program. Earn a 10% commission on every subscription from your referral code. Content creators, YouTubers, and security enthusiasts welcome."
        path="/ambassadors/apply"
      />
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Award className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold tracking-widest uppercase text-primary">Become an Ambassador</h1>
        </div>
        <p className="text-sm text-primary/40">
          Share ProxhqVPN with your audience. Get a unique promo code, upload tutorials, and earn <strong className="text-primary/70">10% commission</strong> on every subscription through your code.
        </p>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { step: "1", title: "Apply", desc: "Fill this form — name, promo code, bio, social links. Reviewed within 24–48 hours." },
          { step: "2", title: "Go Live", desc: "Once approved, your profile and tutorial videos are visible on the Ambassadors page publicly." },
          { step: "3", title: "Earn 10%", desc: "Every subscriber who uses your promo code at checkout earns you 10% recurring commission." },
        ].map(({ step, title, desc }) => (
          <div key={step} className="border border-primary/15 rounded p-3 text-center">
            <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/30 text-primary text-[11px] font-mono font-bold flex items-center justify-center mx-auto mb-2">
              {step}
            </div>
            <div className="text-[11px] font-mono font-semibold text-primary">{title}</div>
            <div className="text-[9px] text-primary/83 mt-0.5">{desc}</div>
          </div>
        ))}
      </div>

      {/* Ambassador Handbook Summary */}
      <div className="border border-primary/15 rounded-lg p-4 bg-primary/5 space-y-3">
        <div className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest">Ambassador Handbook — What to Expect</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[9px] font-mono">
          {[
            { t: "Commission Rate", d: "10% of every subscription payment from subscribers who used your promo code — monthly and annual renewals included." },
            { t: "Promo Code", d: "Your unique code (up to 12 chars, letters & numbers). Subscribers enter it at checkout on the Pricing page." },
            { t: "Tutorial Videos", d: "Add YouTube or Vimeo links from your Ambassador Dashboard. Videos appear on your public profile card and attract more subscribers." },
            { t: "Dashboard Access", d: "Your Ambassador Dashboard shows live stats: referral count, total earned, pending payout, and a line-by-line referral history." },
            { t: "Approval Timeline", d: "Applications are reviewed within 24–48 hours. You can pre-load tutorial videos while pending — they go live when approved." },
            { t: "Payout", d: "Commission is tracked in real-time per subscription payment. Payout details are communicated via email after approval." },
            { t: "Profile Page", d: "Your ambassador card is publicly visible on /ambassadors. Anyone can find you, watch your tutorials, and copy your code — no login required." },
            { t: "New Features to Cover", d: "Auto-IP whitelisting, kill switch for all platforms, WireGuard router configs, Ghost Chain (Tor VPN), Alpha Toolkit, SilkWeb honeypot, VPN Gate double-hop." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="font-bold text-primary">{t}</div>
              <div className="text-primary/83 mt-0.5 leading-relaxed">{d}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <form onSubmit={submit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] font-mono text-primary/40 uppercase block mb-1">Display Name *</label>
            <input required value={form.name} onChange={handleNameChange}
              placeholder="Your name or handle"
              className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-3 py-2 focus:outline-none focus:border-primary/50 rounded" />
          </div>
          <div>
            <label className="text-[9px] font-mono text-primary/40 uppercase block mb-1">
              Promo Code * <span className="text-primary/20">(letters & numbers only)</span>
            </label>
            <input required value={form.promoCode}
              onChange={e => setForm(f => ({ ...f, promoCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 12) }))}
              placeholder="MYCODE10"
              className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-3 py-2 focus:outline-none focus:border-primary/50 rounded tracking-widest" />
            <div className="text-[8px] text-primary/20 mt-1">Customers enter this at checkout. Max 12 characters.</div>
          </div>
        </div>

        <div>
          <label className="text-[9px] font-mono text-primary/40 uppercase block mb-1">Bio / About You</label>
          <textarea value={form.bio} onChange={set("bio")} rows={3}
            placeholder="Tell potential subscribers who you are and why you love ProxhqVPN..."
            className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-3 py-2 focus:outline-none focus:border-primary/50 rounded resize-y" />
        </div>

        <div>
          <label className="text-[9px] font-mono text-primary/40 uppercase block mb-1">Profile Photo URL (optional)</label>
          <input value={form.avatarUrl} onChange={set("avatarUrl")}
            placeholder="https://example.com/your-photo.jpg"
            className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-3 py-2 focus:outline-none focus:border-primary/50 rounded" />
        </div>

        {/* Social links */}
        <div>
          <label className="text-[9px] font-mono text-primary/40 uppercase block mb-2">Social Links (optional)</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: "youtube", icon: Youtube, placeholder: "https://youtube.com/@yourchannel" },
              { key: "twitter", icon: Twitter, placeholder: "https://twitter.com/yourhandle" },
              { key: "instagram", icon: Instagram, placeholder: "https://instagram.com/yourhandle" },
              { key: "website", icon: Globe, placeholder: "https://yourwebsite.com" },
            ].map(({ key, icon: Icon, placeholder }) => (
              <div key={key} className="relative">
                <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/20" />
                <input value={form[key as keyof typeof form]} onChange={set(key as keyof typeof form)}
                  placeholder={placeholder}
                  className="w-full bg-black border border-primary/20 text-primary text-xs font-mono pl-9 pr-3 py-2 focus:outline-none focus:border-primary/50 rounded" />
              </div>
            ))}
          </div>
        </div>

        {/* Info note */}
        <div className="flex items-start gap-2 border border-primary/10 rounded px-3 py-2.5 bg-primary/5">
          <Info className="w-3.5 h-3.5 text-primary/30 shrink-0 mt-0.5" />
          <p className="text-[10px] text-primary/40 font-mono leading-relaxed">
            Applications are reviewed within 24-48 hours. Once approved, your profile goes live on the Ambassadors page.
            You'll be able to add video tutorials from your dashboard. Commission is tracked per subscriber and displayed in your dashboard.
          </p>
        </div>

        <button type="submit" disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 bg-primary text-black text-xs font-mono font-bold uppercase tracking-widest hover:bg-primary/80 disabled:opacity-50 rounded transition-colors">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Award className="w-4 h-4" />}
          {loading ? "Submitting..." : "Submit Application"}
        </button>
      </form>
    </div>
  );
}
