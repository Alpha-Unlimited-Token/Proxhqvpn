import { useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { PageSEO } from "@/components/PageSEO";
import {
  Award, ChevronRight, DollarSign, Users, Share2,
  BarChart2, BookOpen, CheckCircle, AlertCircle,
  TrendingUp, Link, Zap, Shield, Gift, Info,
  Copy, Check, Globe, MessageSquare, Star,
} from "lucide-react";

function CopyBtn({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 2000); }}
      className="ml-1.5 opacity-40 hover:opacity-100 transition-opacity">
      {done ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
    </button>
  );
}

function CB({ children }: { children: string }) {
  return (
    <pre className="relative group font-mono text-[10px] bg-black border border-primary/15 rounded p-3 text-green-400/80 overflow-x-auto whitespace-pre-wrap leading-relaxed my-2">
      {children}
      <button onClick={() => navigator.clipboard.writeText(children)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-primary/30 hover:text-primary">
        <Copy className="w-3 h-3" />
      </button>
    </pre>
  );
}

function Note({ children, type = "info" }: { children: React.ReactNode; type?: "info" | "warn" | "success" }) {
  const s: Record<string, string> = {
    info:    "border-blue-500/20 bg-blue-900/10 text-blue-400/80",
    warn:    "border-yellow-500/20 bg-yellow-900/10 text-yellow-400/80",
    success: "border-green-500/20 bg-green-900/10 text-green-400/80",
  };
  const icons: Record<string, React.ElementType> = { info: Info, warn: AlertCircle, success: CheckCircle };
  const Icon = icons[type];
  return (
    <div className={`flex items-start gap-2 text-[9px] font-mono border rounded px-3 py-2 my-2 ${s[type]}`}>
      <Icon className="w-3 h-3 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

interface Section { id: string; title: string; icon: React.ElementType; content: React.ReactNode }

const SECTIONS: Section[] = [
  {
    id: "welcome", title: "Welcome to the Ambassador Program", icon: Award,
    content: (
      <div className="space-y-3">
        <p>Congratulations on joining the <strong>ProxhqVPN Ambassador Program</strong>, operated by <strong>ALPHA UNLIMITED TECHNOLOGIES LLC</strong>. As an Ambassador, you are a trusted representative of ProxhqVPN — earning real commissions by sharing a product you believe in with your audience.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          {[
            { t: "10% Commission", d: "Earn 10% of every subscription payment made through your personal referral link, every month the customer remains subscribed.", icon: DollarSign },
            { t: "Unique Promo Code", d: "Your personal promo code (e.g. YOURNAME2024) gives customers a discount and automatically credits you with the referral.", icon: Gift },
            { t: "Lifetime Attribution", d: "When a customer subscribes using your code, you earn commission on every renewal — not just the first payment.", icon: TrendingUp },
          ].map(({ t, d, icon: Icon }) => (
            <div key={t} className="border border-primary/15 rounded p-3">
              <Icon className="w-4 h-4 text-primary mb-1.5" />
              <div className="text-[10px] font-mono font-bold text-primary mb-0.5">{t}</div>
              <div className="text-[9px] text-primary/83 font-mono">{d}</div>
            </div>
          ))}
        </div>
        <Note type="success">Ambassador status is reviewed monthly. Top ambassadors earn bonus tiers and early access to new features.</Note>
      </div>
    ),
  },
  {
    id: "commission", title: "Commission Structure & Payouts", icon: DollarSign,
    content: (
      <div className="space-y-3">
        <p>You earn <strong>10% of every payment</strong> made by customers you refer — including monthly renewals and annual plans.</p>
        <div className="space-y-2">
          {[
            { plan: "VPN Basic Monthly ($6.99/mo)", commission: "$0.70 per month per customer" },
            { plan: "VPN Basic Annual ($59.99/yr)", commission: "$6.00 per year per customer" },
            { plan: "Command Center Pro Monthly ($39.99/mo)", commission: "$4.00 per month per customer" },
            { plan: "Command Center Pro Annual ($349.99/yr)", commission: "$35.00 per year per customer" },
          ].map(({ plan, commission }) => (
            <div key={plan} className="grid grid-cols-2 gap-3 border border-primary/10 rounded px-3 py-2">
              <div className="text-[9px] font-mono text-primary/83">{plan}</div>
              <div className="text-[10px] font-mono font-bold text-green-400">{commission}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Payout Schedule</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• Commissions are calculated on the <strong>1st of each month</strong> for the previous month's payments.</div>
          <div>• Payouts are processed via <strong>Stripe</strong> to your linked bank account or debit card.</div>
          <div>• Minimum payout threshold: <strong>$25.00</strong>. Balances below this roll over to the next month.</div>
          <div>• Commissions on refunded subscriptions are reversed. Fraud or chargebacks result in clawback.</div>
        </div>
        <Note type="info">To set up your payout method, go to Ambassador Dashboard → Payout Settings → Connect Bank Account via Stripe Connect.</Note>
      </div>
    ),
  },
  {
    id: "promolink", title: "Your Promo Code & Referral Link", icon: Link,
    content: (
      <div className="space-y-3">
        <p>You have two tools for referring customers: a <strong>promo code</strong> they enter at checkout, and a <strong>referral link</strong> that pre-fills the code automatically.</p>
        <h4 className="font-bold text-primary text-[11px]">Finding Your Code & Link</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Go to <strong>Ambassador Dashboard</strong> (<code>/ambassador/dashboard</code>).</li>
          <li><span className="text-primary/30">2.</span> Your promo code is shown prominently at the top (e.g. <code>YOURNAME2024</code>).</li>
          <li><span className="text-primary/30">3.</span> Your referral link is: <code>https://proxhqvpn.com/pricing?code=YOURNAME2024</code></li>
          <li><span className="text-primary/30">4.</span> Share either the link or just the promo code — both track referrals to you.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">How the Attribution Works</h4>
        <div className="space-y-2 text-[10px] font-mono text-primary/83">
          <div>• When a customer enters your code at checkout, the Stripe session is tagged with your ambassador ID.</div>
          <div>• The webhook fires when payment succeeds — your commission is credited instantly to your dashboard.</div>
          <div>• If a customer cancels and re-subscribes later using your code, you earn commission on the new subscription.</div>
        </div>
        <Note type="warn">Do not share your code publicly on coupon aggregator sites. This violates program terms and may result in account termination.</Note>
      </div>
    ),
  },
  {
    id: "promoting", title: "How to Promote ProxhqVPN", icon: Share2,
    content: (
      <div className="space-y-3">
        <p>The best ambassadors promote ProxhqVPN authentically — sharing real benefits with audiences who genuinely value privacy and security. Below are proven promotional strategies by channel.</p>
        <h4 className="font-bold text-primary text-[11px]">YouTube / Video Content</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Tutorial videos</strong>: "How to set up ProxhqVPN on Fire Stick in 5 minutes" — high search volume, clear value proposition.</div>
          <div>• <strong>Security explainers</strong>: "How WireGuard VPN works" with ProxhqVPN as the hands-on example.</div>
          <div>• <strong>Comparison videos</strong>: "ProxhqVPN vs NordVPN" or "Self-hosted VPN vs commercial VPN" — great for tech audiences.</div>
          <div>• Always include your promo code in the video description and mention it verbally: <em>"Use code YOURNAME2024 at checkout."</em></div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Blog / Written Content</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Reviews and tutorials</strong>: Detailed setup guides rank well on Google.</div>
          <div>• <strong>SEO keywords</strong>: "best VPN for Fire Stick", "WireGuard VPN setup", "self-hosted VPN", "secure developer VPN".</div>
          <div>• Include a disclosure: <em>"This post contains affiliate links. I earn a commission at no extra cost to you."</em></div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Social Media</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Twitter/X</strong>: Security tips, privacy news, linking to your ProxhqVPN tutorials.</div>
          <div>• <strong>Reddit</strong>: Participate authentically in r/VPN, r/privacy, r/selfhosted, r/HomeNetworking. Add your code in comments where helpful, but don't spam.</div>
          <div>• <strong>Telegram / Discord</strong>: Tech communities, security groups. Share setup guides.</div>
        </div>
        <Note type="info">ProxhqVPN converts best with tech-savvy audiences: developers, privacy advocates, Kodi/Plex users, security researchers, IT professionals.</Note>
      </div>
    ),
  },
  {
    id: "content", title: "Approved Content & Messaging", icon: MessageSquare,
    content: (
      <div className="space-y-3">
        <p>Use these approved talking points when promoting ProxhqVPN. Do not make claims beyond what's listed here.</p>
        <h4 className="font-bold text-primary text-[11px]">What You Can Say</h4>
        <div className="space-y-2">
          {[
            { claim: "Military-grade WireGuard encryption", detail: "AES-256-GCM and ChaCha20-Poly1305 — the same protocols used by major VPN providers and the U.S. military." },
            { claim: "Zero-log privacy policy", detail: "ProxhqVPN does not log user activity, connection timestamps, or DNS queries." },
            { claim: "Works on every device", detail: "Windows, Mac, Linux, iPhone, Android, Fire Stick, Android TV, routers, Raspberry Pi, gaming consoles via router. Setup guides and download bundles available for every platform." },
            { claim: "Full offensive security toolkit for pentesters and developers", detail: "Command Center Pro includes the Alpha Toolkit, SQLMap scanner, HTTP Probe, Directory Fuzzer, Subdomain Scout, Ghost Chain Exploit Arsenal, Exploit Importer, OSINT Recon, Canary Tokens, SIEM, and more — all routed through the VPN for operational security." },
            { claim: "Built-in vulnerability education library", detail: "The Exploit Importer includes step-by-step exploitation guides for 24 vulnerability types — covering tools required, attack walkthroughs, verification steps, and how to fix each issue with real code examples. Downloadable as a full Markdown report." },
            { claim: "Downloadable exploit reports for any scan", detail: "Upload any Nessus, Burp Suite, ZAP, Nikto, or OpenVAS report and get a complete downloadable .md report covering every finding, its impact, PoC code, and remediation. Perfect for client deliverables." },
            { claim: "Honeypot + threat detection built in", detail: "SilkWeb honeypot, DNS Sinkhole, Firewall Manager, and Canary Tokens form a complete defensive layer — not just a privacy tool." },
            { claim: "Double-hop + Tor anonymity", detail: "Route traffic through VPN Gate relay servers or Tor for extra anonymity layers." },
          ].map(({ claim, detail }) => (
            <div key={claim} className="border border-primary/10 rounded px-3 py-2">
              <div className="flex items-center gap-2 mb-0.5">
                <CheckCircle className="w-3 h-3 text-green-400 shrink-0" />
                <div className="text-[10px] font-mono font-bold text-primary">{claim}</div>
              </div>
              <div className="text-[9px] font-mono text-primary/83 ml-5">{detail}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">What You Must NOT Claim</h4>
        <div className="space-y-1.5">
          {[
            "100% anonymous — no VPN can guarantee complete anonymity",
            "Hides illegal activity from law enforcement",
            "Protects against all hacking attempts",
            "Specific download speed guarantees",
          ].map(c => (
            <div key={c} className="flex items-center gap-2 text-[9px] font-mono text-red-400/80">
              <AlertCircle className="w-3 h-3 shrink-0" /> {c}
            </div>
          ))}
        </div>
        <Note type="warn">False advertising claims can result in program termination and legal liability. When in doubt, contact support before publishing.</Note>
      </div>
    ),
  },
  {
    id: "dashboard", title: "Ambassador Dashboard", icon: BarChart2,
    content: (
      <div className="space-y-3">
        <p>Your <strong>Ambassador Dashboard</strong> (<code>/ambassador/dashboard</code>) is your mission control — track referrals, earnings, and your public ambassador profile.</p>
        <h4 className="font-bold text-primary text-[11px]">Dashboard Features</h4>
        <div className="space-y-2">
          {[
            { t: "Referral Counter", d: "Live count of total referrals and active subscribers credited to your code." },
            { t: "Earnings Summary", d: "Total lifetime earnings, pending payout amount, and month-over-month chart." },
            { t: "Referral History", d: "Every referral with date, plan purchased, and commission earned. Anonymized by Stripe (no personal customer info)." },
            { t: "Profile Editor", d: "Update your display name, bio, social links, and avatar shown on the public Ambassadors page." },
            { t: "Video Links", d: "Add YouTube/TikTok/blog URLs to your ambassador profile so potential customers can see your content." },
            { t: "Payout Settings", d: "Connect your bank account via Stripe Connect for direct payouts." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <Note type="info">Earnings update in near-real-time via Stripe webhooks. New referrals appear within 1–2 minutes of the customer's payment.</Note>
      </div>
    ),
  },
  {
    id: "rules", title: "Program Rules & Compliance", icon: Shield,
    content: (
      <div className="space-y-3">
        <p>Ambassadors must follow these rules to remain in the program. Violations may result in suspension, termination, and commission clawback.</p>
        <h4 className="font-bold text-primary text-[11px]">Mandatory Requirements</h4>
        <div className="space-y-2">
          {[
            { t: "Disclose the Relationship", d: "All promotional content must include a clear disclosure: 'I earn a commission if you use my link/code.' This is required by FTC guidelines (US) and similar laws globally." },
            { t: "No Spam or Mass Messaging", d: "Do not use automated tools, mass email blasts, or bot accounts to distribute your promo code." },
            { t: "No Self-Referrals", d: "Creating accounts to refer yourself (or family) to earn commission is prohibited and will be detected." },
            { t: "No PPC Bidding on Brand Terms", d: "Do not run paid ads (Google, Meta) bidding on 'ProxhqVPN', 'Proxhq', or 'Alpha Unlimited Technologies'." },
            { t: "Accurate Claims Only", d: "Only make claims that appear in the approved messaging section above. Do not fabricate reviews, testimonials, or certifications." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Grounds for Termination</h4>
        <div className="space-y-1.5 text-[9px] font-mono text-red-400/80">
          {["Promoting competing VPN services while in the program", "Sharing your promo code with known coupon/spam sites", "Fraud, self-referral, or commission manipulation", "Defamatory or damaging public statements about ALPHA UNLIMITED TECHNOLOGIES LLC"].map(r => (
            <div key={r} className="flex items-start gap-2"><AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />{r}</div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "tips", title: "Top Performer Tips", icon: Star,
    content: (
      <div className="space-y-3">
        <p>Based on the highest-earning ambassadors in the program, here are proven strategies that consistently drive subscriptions.</p>
        <div className="space-y-3">
          {[
            {
              num: "1", tip: "Focus on Fire Stick and Streaming Audiences",
              detail: "The #1 use case that converts is 'VPN for Fire Stick'. Cord-cutters who want to bypass geo-blocks and protect streaming are highly motivated buyers. A 5-minute setup tutorial on YouTube for this audience converts at 3–5x the rate of general privacy content.",
            },
            {
              num: "2", tip: "Target Security Researchers & Bug Bounty Hunters",
              detail: "Command Center Pro at $39.99/mo competes with tools costing hundreds of dollars individually. Lead with the Exploit Importer's built-in vulnerability education library — 24 step-by-step exploitation guides covering SQLi, XSS, RCE, SSRF, JWT attacks, and more, each with tool install commands, attack walkthroughs, and downloadable client-ready reports. Content like 'Full pentest lab + 24 exploit guides for $40/mo' resonates strongly. Bug bounty write-up channels, cybersecurity TikTok, and InfoSec Reddit are high-conversion audiences for this angle.",
            },
            {
              num: "3", tip: "Create Comparison Content",
              detail: "'ProxhqVPN vs [Big VPN Brand]' articles and videos capture high-intent searchers. Focus on the self-hosted control aspect and the developer toolkit differentiators — these are unique to ProxhqVPN.",
            },
            {
              num: "4", tip: "Build Email / Newsletter Lists",
              detail: "One-time social media posts have limited reach. Ambassadors who build email lists and include their promo code in monthly newsletters generate the most consistent passive income.",
            },
            {
              num: "5", tip: "Engage Your Dashboard Weekly",
              detail: "Check which referrals converted to annual plans — those customers are most valuable. Engage your audience with follow-up content specifically about features they'd use on Pro.",
            },
          ].map(({ num, tip, detail }) => (
            <div key={num} className="border border-primary/10 rounded px-3 py-2.5">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[9px] font-mono font-bold text-primary shrink-0">{num}</div>
                <div className="text-[10px] font-mono font-bold text-primary">{tip}</div>
              </div>
              <div className="text-[9px] font-mono text-primary/83 ml-7">{detail}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "support", title: "Support & Contact", icon: Globe,
    content: (
      <div className="space-y-3">
        <p>For ambassador-specific issues, use the dedicated channels below. Do not use the general customer support queue — you have priority access.</p>
        <div className="space-y-2">
          {[
            { t: "Ambassador Support Email", d: "ambassadors@proxhqvpn.com — Response within 24 hours on business days." },
            { t: "Missing Commission", d: "Email with your promo code, the approximate date, and the subscription plan. Include 'MISSING COMMISSION' in the subject line." },
            { t: "Technical Issues with Dashboard", d: "Screenshot the error, include your account email, and send to ambassadors@proxhqvpn.com." },
            { t: "Program Changes", d: "Major changes to commission rates or program terms will be communicated via email with 30 days notice." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <Note type="info">By participating in the Ambassador Program, you agree to the ProxhqVPN Ambassador Terms of Service, which form a binding agreement with ALPHA UNLIMITED TECHNOLOGIES LLC.</Note>
      </div>
    ),
  },
];

export default function AmbassadorHandbook() {
  const [active, setActive] = usePersistedState<string>("ambhandbook-active", "welcome");
  const section = SECTIONS.find(s => s.id === active) ?? SECTIONS[0];

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      <PageSEO
        title="Ambassador Handbook — ProxhqVPN"
        description="Complete guide for ProxhqVPN ambassadors: commission structure, promo codes, promotional guidelines, program rules, and performance tips."
        path="/handbook/ambassador"
      />

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
          <Award className="w-5 h-5 text-yellow-400/80" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white leading-tight">Ambassador Handbook</h1>
          <p className="text-xs text-white/78">ALPHA UNLIMITED TECHNOLOGIES LLC — ProxhqVPN Ambassador Program</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-1">
          <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-2 space-y-0.5 sticky top-4">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              const isActive = s.id === active;
              return (
                <button key={s.id} onClick={() => setActive(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all text-[11px] font-mono ${
                    isActive ? "bg-primary/10 text-primary border border-primary/20" : "text-white/78 hover:bg-white/[0.04] hover:text-white/90 border border-transparent"
                  }`}>
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-primary" : "text-white/70"}`} />
                  <span className="leading-snug">{s.title}</span>
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-6">
            <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-white/[0.06]">
              {(() => { const Icon = section.icon; return <Icon className="w-4 h-4 text-yellow-400/80 shrink-0" />; })()}
              <h2 className="text-sm font-bold text-white">{section.title}</h2>
            </div>
            <div className="text-[10px] font-mono text-primary/83 leading-relaxed space-y-3">
              {section.content}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
