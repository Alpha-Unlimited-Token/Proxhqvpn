// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { PageSEO } from "@/components/PageSEO";
import {
  Award, ChevronRight, DollarSign, Users, Share2,
  BarChart2, BookOpen, CheckCircle, AlertCircle,
  TrendingUp, Link, Zap, Shield, Gift, Info,
  Copy, Check, Globe, MessageSquare, Star, Download,
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
            { claim: "Full offensive security toolkit for pentesters and developers", detail: "Command Center Pro includes the Alpha Toolkit, SQLMap scanner, HTTP Probe, Directory Fuzzer, Subdomain Scout, Ghost Chain Exploit Arsenal, Exploit Importer, OSINT Recon, Canary Tokens, SIEM, OAST Tester, Dependency Scanner, Token Sequencer, WebSocket Tester, SAST Scanner, and more — all routed through the VPN for operational security." },
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
              detail: "Command Center Pro at $39.99/mo competes with tools costing hundreds of dollars individually. Lead with the Exploit Importer's built-in vulnerability education library — 24 step-by-step exploitation guides covering SQLi, XSS, RCE, SSRF, JWT attacks, and more. Also highlight the 5 new dev security tools added in 2026: OAST Tester (out-of-band callback testing), Dependency Scanner (CVE checks across all package managers), Token Sequencer (session token entropy analysis), WebSocket Tester (Burp WS equivalent), and SAST Scanner (static code analysis). Content like 'Full pentest lab + 29 security tools for $40/mo' resonates strongly. Bug bounty write-up channels, cybersecurity TikTok, and InfoSec Reddit are high-conversion audiences for this angle.",
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
            {
              num: "6", tip: "Target the Web3 / Crypto Audience with QuantumAudit",
              detail: "QuantumAudit is a unique angle no competitor offers. Smart contract developers, DeFi protocol teams, and Web3 security researchers all need blockchain security auditing — and post-quantum cryptographic risk is a growing concern as quantum computing advances. Content like 'Is your smart contract vulnerable to a quantum computer?' or 'How to audit your DeFi protocol for ECDSA nonce reuse' reaches an audience that is actively spending on security tools. The Signature Mining Engine (5 independent blockchain forensics engines) is particularly compelling for crypto OSINT audiences. This is the strongest differentiator for blockchain-native content channels.",
            },
            {
              num: "7", tip: "Highlight v2.1.0 Security Hardening for Trust-Focused Audiences",
              detail: "Privacy-conscious buyers want to know that ProxhqVPN takes its own security seriously. v2.1.0 fixed 6 vulnerabilities found in a comprehensive audit — including timing attack protection, SSL certificate pinning in the desktop app, and an IP auto-ban brute force layer. A short video or thread: 'ProxhqVPN found and fixed 6 security vulnerabilities — here's what changed and why it matters' builds credibility with security-aware buyers who are skeptical of VPN marketing claims. The public warrant canary at /api/warrant-canary (signed, refreshes every 30 days) is another trust signal worth mentioning.",
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
    id: "faq", title: "Frequently Asked Questions", icon: MessageSquare,
    content: (
      <div className="space-y-3">
        <p>Common questions we hear from ambassadors and potential customers. Bookmark these answers for your content and conversations.</p>
        {[
          { q: "Is ProxhqVPN really no-log?", a: "Yes. ProxhqVPN doesn't log user activity, DNS queries, connection timestamps, or IP addresses. Unlike most commercial VPNs, our warrant canary (/api/warrant-canary) is publicly accessible and cryptographically signed — confirming no NSLs, FISC orders, gag orders, or backdoors exist. The canary refreshes every 30 days." },
          { q: "How is ProxhqVPN different from NordVPN / ExpressVPN?", a: "The biggest difference is the Command Center Pro tier — it includes a full penetration testing platform (SQLMap, Ghost Chain, OSINT Recon, OAST Server, WAF Bypass, Exploit Importer, etc.) that no consumer VPN provider offers. ProxhqVPN is built for developers and security professionals, not just streaming. It also includes a SilkWeb honeypot network, DNS Sinkhole, and QuantumAudit (blockchain smart contract scanner) — features in a completely different category." },
          { q: "What's WireGuard and why does it matter?", a: "WireGuard is the most modern VPN protocol — only ~4,000 lines of code vs OpenVPN's 100,000+, which means a smaller attack surface and faster speeds. ProxhqVPN uses AES-256-GCM and ChaCha20-Poly1305 depending on hardware. It's the same protocol used by Mullvad, NordVPN (when they updated from OpenVPN), and the Linux kernel." },
          { q: "Does it work on Fire Stick / smart TVs / game consoles?", a: "Yes. Full setup guides exist for Amazon Fire Stick, Fire TV, Android TV, Google TV, Samsung Smart TVs, LG webOS TVs, Xbox (via router), PS5 (via router), Roku, and Apple TV. All of these work through the Smart DNS mode or router-level WireGuard config. The Downloads page also has OS-specific .txt setup guides." },
          { q: "Can I run ProxhqVPN alongside another VPN like NordVPN?", a: "Yes — the VPN Coexistence page (/vpn-coexist) covers four coexistence modes: fwmark-based routing, double-hop chaining, network namespaces, and routing table isolation. It auto-detects any running commercial VPN and generates the appropriate scripts." },
          { q: "Is my commission tracked automatically?", a: "Yes. When a customer enters your promo code at Stripe checkout, the session is tagged with your ambassador ID. When payment succeeds, the webhook fires instantly and your commission is credited. You can verify every referral in your dashboard under Referral History." },
          { q: "What happens if a customer asks for a refund?", a: "If Stripe processes a refund, the commission for that transaction is reversed from your dashboard. Commissions are only paid out on confirmed, non-refunded payments. Payouts are processed monthly for balances over $25." },
          { q: "Can I promote ProxhqVPN on YouTube as a sponsor?", a: "Yes — read-through and integrated sponsorships are both approved. Always include a disclosure (FTC-compliant: 'I earn a commission from ProxhqVPN at no extra cost to you'). Use only approved claims from the Approved Content section of this handbook. For scripts or talking points, email ambassadors@proxhqvpn.com." },
          { q: "What if a viewer asks about security incidents?", a: "Direct them to our public warrant canary at proxhqvpn.com/api/warrant-canary which provides a signed transparency statement. Security questions can be escalated to security@proxhqvpn.com." },
          { q: "Is the Command Center legal?", a: "All tools in the Command Center are standard industry security tools used by professional penetration testers daily. They are legal to own and use for authorized testing. They are comparable to (and in many ways beyond) Burp Suite Pro, OWASP ZAP, Metasploit, and Caido. ProxhqVPN includes HackAnon — an educational exploit guide — and all tools include prominent legal disclaimers." },
          { q: "Does ProxhqVPN work in China / UAE / Iran?", a: "ProxhqVPN includes multiple DPI obfuscation protocols: obfs4, Shadowsocks, V2Ray-WS, Meek, Snowflake, and XOR. These disguise VPN traffic as regular HTTPS traffic, helping bypass deep packet inspection in restrictive regions. Results vary by ISP and region — we cannot guarantee access in all situations." },
          { q: "How do I get my first sale?", a: "Start with your existing audience — even a single video or post mentioning your experience with ProxhqVPN. The Command Center Pro is a strong selling point for developer/security audiences who are tired of paying for Burp Suite Pro ($449/yr) separately. ProxhqVPN Pro at $39.99/mo covers both VPN and the full security toolkit." },
          { q: "What is QuantumAudit and who should I pitch it to?", a: "QuantumAudit is ProxhqVPN's standalone blockchain security auditing platform. It scans smart contracts and DeFi protocols for classical vulnerabilities (reentrancy, oracle manipulation, flash loan attacks) AND post-quantum cryptographic weaknesses — things like ECDSA nonce reuse that could be exploited by quantum computers running Shor's algorithm. Your best audiences: smart contract developers, DeFi protocol teams, Web3 security researchers, and anyone building on Ethereum, BSC, Polygon, Solana, or Avalanche. The Signature Mining Engine (5 independent blockchain forensics engines with cross-engine intelligence sharing) is the most unique offering — no consumer tool does this." },
          { q: "What changed in ProxhqVPN v2.1.0?", a: "v2.1.0 is ProxhqVPN's most security-focused release. Six vulnerabilities were patched following a comprehensive internal audit: (1) Timing attack on session secret comparison — now uses constant-time crypto.timingSafeEqual(); (2) External database SSL MitM vulnerability — rejectUnauthorized now defaults to true; (3) Shell chain injection via ; && || metacharacters in the terminal — now blocked by a 14-pattern regex set; (4) SSRF redirect chain bypass in the HTTP client — now re-validates every redirect hop (max 5); (5) IP auto-ban for brute force — 20 failures in 5 minutes triggers a 30-minute block; (6) WAF double-URL-encoding bypass — WAF now decodes twice before checking. The desktop app (Windows/macOS/Linux) also adds TLS certificate pinning in v2.1.0, preventing MitM even with a compromised root CA. All fixes apply automatically to web app users. Desktop users receive the update via auto-updater." },
          { q: "What is Ghost Trace and how do I explain it to non-technical audiences?", a: "Ghost Trace is ProxhqVPN's behavioral analysis engine. It watches every device connected to your VPN for signs of compromise — malware checking in with its command-and-control server, data being secretly exfiltrated, connections to known malicious IPs — without needing to install anything on the device itself. For non-technical audiences: 'Imagine a security camera aimed at what your devices send out, not just what comes in. If your phone suddenly starts sending huge amounts of data at 3am to a server in Russia, Ghost Trace catches it and blocks it instantly.' This is especially compelling for business/enterprise audiences and IT teams managing devices on a company VPN." },
        ].map(({ q, a }) => (
          <div key={q} className="border border-primary/10 rounded px-3 py-2.5">
            <div className="text-[10px] font-mono font-bold text-primary mb-1">Q: {q}</div>
            <div className="text-[9px] font-mono text-primary/75 leading-relaxed">A: {a}</div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "platform-rundown", title: "Product Deep Dive", icon: BookOpen,
    content: (
      <div className="space-y-3">
        <p>Everything you need to confidently pitch every tier and feature. This section covers what each plan includes, how to explain it to non-technical and technical audiences, and specific use cases to highlight.</p>
        <h4 className="font-bold text-primary text-[11px]">VPN Basic — $6.99/month</h4>
        <p className="text-[9px] text-primary/75">Who to pitch: Privacy-first consumers, streamers, travelers, smart TV users.<br/>What's included:</p>
        {[
          "60-node WireGuard mesh (50 outer + 10 inner hidden nodes) — more nodes than many premium VPNs",
          "Kill switch + IPv6 leak protection — zero exposure even if VPN drops",
          "DNS Sinkhole — blocks ads, trackers, malware, phishing, cryptominers, botnet C2 at the DNS level (like Pi-hole, built-in)",
          "Smart DNS for TVs/consoles — Fire Stick, Samsung/LG/Roku/Apple TV, Xbox, PS5",
          "Multi-device WireGuard configs — unlimited devices",
          "Tor + SOCKS5 proxy — double-hop anonymity",
          "VPN Gate integration — 6,000+ relay nodes in 100+ countries for extra hops",
          "Multi-platform support — Windows, Mac, Linux, iOS, Android, routers, browser extension",
        ].map(f => <div key={f} className="text-[9px] font-mono text-primary/75 flex gap-2"><span className="text-primary/30 shrink-0">✓</span>{f}</div>)}

        <h4 className="font-bold text-primary text-[11px] mt-3">Command Center Pro — $39.99/month</h4>
        <p className="text-[9px] text-primary/75">Who to pitch: Penetration testers, bug bounty hunters, security researchers, developers, IT teams.<br/>Everything in VPN Basic, plus:</p>
        {[
          "Alpha Toolkit / OmniStrike — complete web app attack suite (replaces Burp Suite Pro $449/yr)",
          "SQLMap integration — automated SQL injection scanner with full dump capability",
          "Ghost Chain — automated kill chain discovery: 5-stage attack path correlation engine",
          "OSINT Recon — passive DNS, TLS cert, HTTP header, ASN, email security analysis",
          "SIEM Security Event Log — unified threat timeline from all platform sensors",
          "Ghost Trace — WireGuard peer behavioral analysis, C2 detection, exfiltration detection",
          "Canary Tokens — URL, DNS, email, web bug, UNC, AWS Key, SQL, PowerShell trackers",
          "Exploit Importer — upload Burp/Nessus/ZAP reports, get step-by-step exploitation guides + PoC code",
          "JWT Analyzer — 5 attack classes including JWKS injection, kid SQL injection, claim escalation",
          "Subdomain Scout — 9 passive OSINT sources, deduplication, source breakdown",
          "Directory Fuzzer — recursive scanning depth 3, response-size filtering",
          "SAST Analyzer, Dependency Scanner, SQL Injection Scanner, SSL/TLS Analyzer",
          "Social & Game Account Breach Tester, Bug Bounty Hub",
          "Network Monitor — real-time traffic flow analysis across all VPN nodes",
        ].map(f => <div key={f} className="text-[9px] font-mono text-primary/75 flex gap-2"><span className="text-orange-400/60 shrink-0">✦</span>{f}</div>)}

        <h4 className="font-bold text-primary text-[11px] mt-3">Arsenal Tier (Tier 3 — admin/employee preview)</h4>
        {[
          "WAF Analyzer + WAF Bypass Generator — detect and defeat web application firewalls",
          "HTTP Interceptor — full request/response manipulation proxy",
          "API Security Tester — REST/GraphQL security scanner",
          "OAST Blind Tester + OAST Callback Server — detect blind SSRF, XXE, Log4Shell callbacks",
          "WebSocket Security Tester — ws/wss message manipulation and injection",
          "Token Sequencer — statistical randomness analysis of session tokens",
          "IaC Scanner — Terraform/CloudFormation/Kubernetes security misconfig scanner",
          "QuantumAudit — blockchain smart contract scanner for classical + post-quantum vulnerabilities",
          "Ghost PenTest, Request Mind, SOC Co-Pilot, Code Sentinel, Agent Strike, LLM Probe, AI Shield",
        ].map(f => <div key={f} className="text-[9px] font-mono text-primary/75 flex gap-2"><span className="text-purple-400/60 shrink-0">◆</span>{f}</div>)}
      </div>
    ),
  },
  {
    id: "hacker-defense", title: "Explaining Hacker Defense to Customers", icon: Shield,
    content: (
      <div className="space-y-3">
        <p>This section helps you explain ProxhqVPN's defensive capabilities to non-technical customers. Use these talking points for demos, videos, and conversations.</p>
        <h4 className="font-bold text-primary text-[11px]">The Threat Landscape (keep it simple)</h4>
        <div className="text-[9px] text-primary/75 leading-relaxed">
          "Every device on your network — phone, TV, laptop, even your smart refrigerator — constantly communicates with servers. Hackers intercept that traffic to steal passwords, inject malware, or track your location. Your ISP sells your browsing history. Advertisers fingerprint your device across every site you visit. Without protection, all of this happens invisibly."
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-2">Explaining the Kill Switch</h4>
        <div className="text-[9px] text-primary/75">"If your VPN connection drops for even a millisecond, your real IP address is exposed. ProxhqVPN's kill switch uses iptables and ip6tables rules to cut all internet traffic the instant the tunnel drops — so your real IP never leaks. No other VPN protects IPv6 by default. This matters because your device has both IPv4 and IPv6 addresses — blocking only one leaves a backdoor."</div>
        <h4 className="font-bold text-primary text-[11px] mt-2">Explaining the SilkWeb Honeypot</h4>
        <div className="text-[9px] text-primary/75">"ProxhqVPN deploys an invisible trap network — fake services that look like real targets. When a hacker or bot probes your network and touches one of these traps, they're immediately identified, logged, and blocked. It's the same technology used by government cyber teams to catch intruders before they cause damage."</div>
        <h4 className="font-bold text-primary text-[11px] mt-2">Explaining Canary Tokens</h4>
        <div className="text-[9px] text-primary/75">"Imagine planting an invisible dye pack in your bank vault. If someone steals the money, the dye explodes and marks them. Canary Tokens work the same way — invisible tracking tripwires. If a hacker opens your fake 'AWS credentials' file, accesses a planted URL, or opens a booby-trapped PDF, you get an instant alert with their IP address, browser, and location."</div>
        <h4 className="font-bold text-primary text-[11px] mt-2">Explaining the DNS Sinkhole</h4>
        <div className="text-[9px] text-primary/75">"Your device is constantly making DNS requests — every app, every website, every ad network. The DNS Sinkhole intercepts these requests and blocks the ones going to known malware servers, trackers, and ad networks before your device even makes a connection. It's like having a bouncer checking every guest list before they enter your network. Works on Fire Stick, Smart TVs, game consoles — everything on your WiFi."</div>
        <h4 className="font-bold text-primary text-[11px] mt-2">Explaining OSINT Recon (for security content creators)</h4>
        <div className="text-[9px] text-primary/75">"OSINT stands for Open Source Intelligence — intelligence gathered from publicly available sources without touching the target. Our OSINT Recon tool shows you everything a hacker can see about any domain: every DNS record, every TLS certificate ever issued (revealing hidden subdomains), HTTP security headers, email security misconfigurations (SPF/DKIM/DMARC), and your hosting provider's fingerprint. This is the first step hackers take before any attack."</div>
        <Note type="info">Customer support email for your audience's questions: <strong>support@proxhqvpn.com</strong></Note>
      </div>
    ),
  },
  {
    id: "downloads-sales", title: "Sales Downloads", icon: Download,
    content: (
      <div className="space-y-4">
        <p>Download these materials to support your ambassador content creation and sales pitches. All materials are pre-approved for ambassador use.</p>
        {[
          {
            title: "Ambassador Sales Pitch Deck",
            desc: "Full HTML presentation: 10 slides covering ProxhqVPN overview, pricing tiers, competitive advantages, target market, and closing script. Open in any browser. Printable.",
            color: "border-yellow-500/20 bg-yellow-900/8",
            badgeColor: "text-yellow-400",
            badge: "SALES DECK",
            fn: () => {
              const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>ProxhqVPN — Ambassador Sales Presentation</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;background:#0a0f0a;color:#e5e5e5}@media print{body{background:#fff;color:#111}.slide{page-break-after:always;border:none!important}}.slide{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:60px;border-bottom:2px solid #1a2a1a;text-align:center}.slide h1{font-size:3em;color:#00ff88;margin-bottom:20px;font-weight:900}.slide h2{font-size:2em;color:#00ff88;margin-bottom:20px}.slide p,.slide li{font-size:1.1em;line-height:1.8;color:#c5c5c5;max-width:800px;text-align:left}.slide ul{text-align:left;max-width:800px}.slide li{margin:8px 0;padding-left:4px}.badge{display:inline-block;padding:6px 18px;border:1px solid #00ff88;color:#00ff88;font-size:.8em;letter-spacing:.15em;text-transform:uppercase;margin-bottom:20px}.tier{display:inline-block;padding:4px 12px;border-radius:4px;font-size:.9em;font-weight:700;margin:4px}.t1{background:#1a3a3a;color:#00ff88;border:1px solid #00ff88}.t2{background:#2a1a0a;color:#ff8800;border:1px solid #ff8800}.t3{background:#1a0a2a;color:#aa66ff;border:1px solid #aa66ff}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:900px;text-align:left}.card{background:#111;border:1px solid #222;padding:20px;border-radius:8px}.card h3{color:#00ff88;margin-bottom:8px;font-size:1em}.card p{font-size:.9em}.green{color:#00ff88}.orange{color:#ff8800}</style></head><body>
<div class="slide"><div class="badge">Ambassador Presentation</div><h1>ProxhqVPN</h1><p style="text-align:center;font-size:1.3em;color:#888">The world's most advanced VPN + security platform<br><strong style="color:#00ff88">ALPHA UNLIMITED TECHNOLOGIES LLC</strong></p><p style="text-align:center;margin-top:40px;font-size:.9em;color:#555">Your promo code: ______________________ | proxhqvpn.com</p></div>
<div class="slide"><h2>What is ProxhqVPN?</h2><p>ProxhqVPN is not just a VPN — it's a complete privacy and security operations platform for individuals, developers, and security professionals.</p><br><div class="grid"><div class="card"><h3>🔒 Privacy Layer</h3><p>60-node WireGuard mesh, kill switch, DNS Sinkhole, Tor integration, no-log policy, warrant canary</p></div><div class="card"><h3>🛡️ Defense Layer</h3><p>SilkWeb honeypot, Canary Tokens, Firewall Manager, Ghost Trace behavioral analysis, Beacon Monitor</p></div><div class="card"><h3>⚔️ Offense Layer</h3><p>Full penetration testing platform: SQLMap, Ghost Chain, OSINT Recon, Exploit Importer, OAST Server</p></div><div class="card"><h3>🔗 Infrastructure Layer</h3><p>QuantumAudit blockchain scanner, IaC Scanner, API Security Tester, WAF Analyzer, LLM Probe</p></div></div></div>
<div class="slide"><h2>Pricing — Simple, Transparent</h2><br><div class="grid" style="grid-template-columns:1fr 1fr 1fr"><div class="card"><div class="tier t1">Recon</div><h3 class="green">$6.99/mo</h3><p>VPN Basic — all privacy and protection features. Works on every device. DNS Sinkhole, Kill Switch, Tor, Smart DNS.</p></div><div class="card"><h3 class="orange">$39.99/mo</h3><div class="tier t2">Strike</div><p>Command Center Pro — VPN Basic + full penetration testing suite. Replaces Burp Suite Pro ($449/yr).</p></div><div class="card"><h3 style="color:#aa66ff">Contact Us</h3><div class="tier t3">Arsenal</div><p>Elite tier — WAF Bypass, HTTP Interceptor, QuantumAudit, AI Shield, Ghost PenTest, SOC Co-Pilot.</p></div></div></div>
<div class="slide"><h2>Who Buys ProxhqVPN?</h2><br><ul><li><strong class="green">Security Researchers & Bug Bounty Hunters</strong> — Command Center Pro replaces $449/yr Burp Suite Pro. Ghost Chain + OSINT Recon + Exploit Importer is a complete offensive security stack.</li><li><strong class="green">Developers</strong> — Test APIs, inspect requests, audit dependencies, scan IaC configs — all from inside a VPN tunnel with opsec.</li><li><strong class="green">Privacy-First Users</strong> — DNS Sinkhole (built-in Pi-hole), kill switch, no-log warrant canary. Works on Fire Stick, smart TVs, game consoles.</li><li><strong class="green">IT Professionals & Red Teams</strong> — OmniStrike, Ghost Pentest, SOC Co-Pilot, Agent Strike, Code Sentinel.</li><li><strong class="green">Crypto & Web3 Security Teams</strong> — QuantumAudit scans smart contracts for classical and post-quantum cryptographic vulnerabilities.</li></ul></div>
<div class="slide"><h2>vs. The Competition</h2><br><div class="grid"><div class="card"><h3 style="color:#ff4444">NordVPN / ExpressVPN</h3><p>✗ No security tools whatsoever<br>✗ Shared IP pools with abuse history<br>✗ No honeypot / canary / SIEM<br>✗ No blockchain security audit<br>✓ Brand recognition only</p></div><div class="card"><h3 style="color:#ff8800">Burp Suite Pro</h3><p>✗ $449/year — no VPN included<br>✗ No opsec / anonymity layer<br>✗ No OSINT / threat intel<br>✓ Industry standard intercepting proxy<br><em class="green">ProxhqVPN Strike tier = Burp Pro + VPN + 40+ more tools</em></p></div><div class="card"><h3 style="color:#ffaa00">Mullvad / ProtonVPN</h3><p>✗ Privacy-only, no security tools<br>✗ No offensive research capability<br>✓ Strongest consumer VPN privacy<br><em class="green">ProxhqVPN adds the full security platform on top</em></p></div><div class="card"><h3 style="color:#00ff88">ProxhqVPN</h3><p>✓ Full VPN + complete security platform<br>✓ 60-node mesh + Tor + VPN Gate<br>✓ No-log + warrant canary<br>✓ SilkWeb honeypot + Canary Tokens<br>✓ SQLMap + Ghost Chain + OSINT + OAST<br>✓ QuantumAudit blockchain scanner</p></div></div></div>
<div class="slide"><h2>Your Commission Structure</h2><br><ul><li><strong class="green">10% commission</strong> on every paid subscription you refer</li><li>VPN Basic ($6.99/mo): <strong class="green">$0.70/mo per subscriber</strong> — grows with their tenure</li><li>Command Center Pro ($39.99/mo): <strong class="green">$4.00/mo per subscriber</strong></li><li>Commissions tracked automatically — every promo code use is logged to your dashboard</li><li>Monthly payouts via Stripe Connect — direct to your bank account</li><li>No cap on earnings — top ambassadors with 1,000 CC Pro subscribers = $4,000/month passive income</li><li>Stack subscribers over time — your earnings grow every month as your audience builds</li></ul></div>
<div class="slide"><h2>The Pitch Script</h2><br><p>Adapt this for your content style:</p><br><p style="background:#0f1f0f;border:1px solid #00ff8833;padding:20px;border-radius:8px;font-style:italic;max-width:700px">"I've been using ProxhqVPN for [X time] and it's become my go-to security stack. Unlike normal VPNs, it's got a full penetration testing suite built in — I use the Ghost Chain tool for recon and OSINT Recon to map attack surfaces on authorized targets. The kill switch and DNS Sinkhole run 24/7. If you're a developer or security researcher, the $39.99/month Command Center Pro tier replaces Burp Suite Pro at a fraction of the cost — and you get the VPN, DNS Sinkhole, honeypot, and everything else on top. Use code [YOUR CODE] for [discount or mention]. Link in description."</p></div>
<div class="slide"><h2>Key FAQs to Address in Content</h2><br><ul><li><strong class="green">Is it legal?</strong> — All tools are legal for authorized security testing, comparable to Burp Suite Pro, OWASP ZAP, and Metasploit. Legal disclaimers on every page.</li><li><strong class="green">Does it work on [device]?</strong> — Yes. Guides for 20+ device types: Fire Stick, Smart TVs, consoles, routers, Raspberry Pi, everything.</li><li><strong class="green">No-log proof?</strong> — Public warrant canary at proxhqvpn.com/api/warrant-canary — cryptographically signed, refreshes monthly.</li><li><strong class="green">Can I use it with my other VPN?</strong> — Yes, VPN Coexistence page covers 4 modes (double-hop, namespace, fwmark, routing table).</li><li><strong class="green">Works in China / restricted regions?</strong> — DPI obfuscation: obfs4, Shadowsocks, V2Ray-WS, Meek, Snowflake, XOR.</li></ul></div>
<div class="slide"><h2>Call to Action</h2><br><p style="text-align:center;font-size:1.4em">Your link: <strong class="green">proxhqvpn.com/pricing?code=[YOUR_CODE]</strong></p><br><p style="text-align:center;font-size:1.1em;color:#888">Say at the end of every video:<br><em style="color:#e5e5e5">"Use code [YOUR_CODE] at checkout to get started. The link is in the description."</em></p><br><p style="text-align:center;font-size:.9em;color:#555">Questions? ambassadors@proxhqvpn.com | Customer support: support@proxhqvpn.com</p><br><p style="text-align:center;font-size:.8em;color:#333">© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC — Ambassador materials confidential. For ambassador use only.</p></div>
</body></html>`;
              const blob = new Blob([html], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "proxhqvpn_ambassador_pitch_deck.html"; a.click(); URL.revokeObjectURL(url);
            },
          },
          {
            title: "Ambassador Program Overview PDF",
            desc: "Printable one-page overview of the ambassador program — commission rates, promo code instructions, approved claims, and contact info. Print and use as a quick reference.",
            color: "border-blue-500/20 bg-blue-900/8",
            badgeColor: "text-blue-400",
            badge: "PDF",
            fn: () => {
              const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ambassador Program Overview</title><style>body{font-family:'Segoe UI',sans-serif;max-width:800px;margin:40px auto;padding:40px;color:#111;line-height:1.6}h1{color:#0a5c2a;font-size:2em;border-bottom:3px solid #0a5c2a;padding-bottom:10px}h2{color:#0a5c2a;font-size:1.2em;margin-top:24px}p,li{font-size:.95em;color:#333}.badge{display:inline-block;padding:2px 10px;background:#0a5c2a;color:#fff;border-radius:3px;font-size:.8em;margin-bottom:8px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}.card{border:1px solid #ccc;padding:12px;border-radius:6px}footer{margin-top:40px;font-size:.8em;color:#888;border-top:1px solid #eee;padding-top:16px}@media print{body{margin:0}}</style></head><body>
<h1>ProxhqVPN Ambassador Program</h1><p><strong>ALPHA UNLIMITED TECHNOLOGIES LLC</strong> | ambassadors@proxhqvpn.com</p>
<div class="badge">Your Commission: 10% of every subscription you refer</div>
<h2>Pricing & Your Earnings</h2><div class="grid"><div class="card"><strong>VPN Basic — $6.99/mo</strong><br>Your commission: $0.70/mo per subscriber<br>Privacy + DNS Sinkhole + Smart DNS + Kill Switch</div><div class="card"><strong>Command Center Pro — $39.99/mo</strong><br>Your commission: $4.00/mo per subscriber<br>VPN Basic + full penetration testing platform</div></div>
<h2>How to Get Your Referral Link</h2><ol><li>Log into your account at proxhqvpn.com</li><li>Go to Ambassador Dashboard (/ambassador/dashboard)</li><li>Your promo code is shown at the top (e.g. YOURNAME2024)</li><li>Your referral link: proxhqvpn.com/pricing?code=YOURNAME2024</li></ol>
<h2>Approved Claims</h2><ul><li>Military-grade WireGuard encryption (AES-256-GCM + ChaCha20-Poly1305)</li><li>Zero-log policy + public warrant canary (proxhqvpn.com/api/warrant-canary)</li><li>Works on every device: Windows, Mac, Linux, iOS, Android, Fire Stick, Smart TV, router, console</li><li>Full offensive security toolkit — replaces Burp Suite Pro ($449/yr)</li><li>60-node VPN mesh, Tor integration, DPI obfuscation, VPN Gate (6,000+ relay nodes)</li><li>Built-in honeypot + DNS Sinkhole + Canary Tokens — complete defensive stack</li></ul>
<h2>Program Rules (Key Points)</h2><ul><li>Always include FTC-required disclosure in content</li><li>Do not share code on coupon aggregator sites</li><li>Do not make unsupported technical claims</li><li>Monthly payouts via Stripe Connect (minimum $25 balance)</li></ul>
<footer>© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC. Ambassador materials are confidential. For ambassador use only. Customer support: support@proxhqvpn.com</footer></body></html>`;
              const blob = new Blob([html], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "proxhqvpn_ambassador_overview.html"; a.click(); URL.revokeObjectURL(url);
            },
          },
        ].map(({ title, desc, color, badgeColor, badge, fn }) => (
          <div key={title} className={`border rounded p-4 ${color}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className={`text-[8px] font-mono font-bold uppercase tracking-widest mb-1 ${badgeColor}`}>{badge}</div>
                <div className="text-[11px] font-bold text-primary mb-1">{title}</div>
                <div className="text-[9px] font-mono text-primary/70">{desc}</div>
              </div>
              <button
                onClick={fn}
                className="shrink-0 flex items-center gap-1.5 text-[10px] border border-primary/30 text-primary px-3 py-2 hover:bg-primary/10 transition-colors"
              >
                <Download className="w-3 h-3" /> Download
              </button>
            </div>
          </div>
        ))}
        <Note type="info">These files download as .html — open in any browser to view or print. To save as PDF: File → Print → Save as PDF in your browser.</Note>
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
