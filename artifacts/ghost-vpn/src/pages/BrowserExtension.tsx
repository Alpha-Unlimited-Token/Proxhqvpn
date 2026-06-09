import { useState } from "react";
import { Chrome, Globe, Shield, Zap, Lock, Eye, Download, ExternalLink, CheckCircle2, Puzzle } from "lucide-react";

const FEATURES = [
  {
    icon: Shield,
    title: "SOCKS5 Proxy Routing",
    desc: "Route all browser traffic through your ProxhqVPN node with one click. Switches your exit IP instantly without affecting system-wide traffic.",
  },
  {
    icon: Eye,
    title: "WebRTC Leak Blocker",
    desc: "Prevents browsers from exposing your real IP through WebRTC — the leak method that defeats most VPNs. Uses chrome.privacy API to disable non-proxied UDP.",
  },
  {
    icon: Lock,
    title: "DNS-over-HTTPS",
    desc: "Forces encrypted DNS queries so your ISP can't see what sites you're visiting. Prevents DNS-based traffic analysis and sinkholing.",
  },
  {
    icon: Zap,
    title: "Real-Time Status Badge",
    desc: "Green ON / Red OFF badge on the extension icon. Always know at a glance whether your browser traffic is protected.",
  },
  {
    icon: Globe,
    title: "Quick Dashboard Access",
    desc: "One-click links to your ProxhqVPN dashboard, leak test, canary tokens, and node manager — directly from the browser toolbar.",
  },
  {
    icon: CheckCircle2,
    title: "Auto-Enable on Startup",
    desc: "Optionally re-engage the proxy every time your browser opens so you're never accidentally unprotected.",
  },
];

const STEPS_CHROME = [
  "Download the extension .zip below and unzip it anywhere on your machine.",
  "Open Chrome and navigate to chrome://extensions",
  "Toggle on Developer Mode (top-right corner).",
  'Click "Load unpacked" and select the unzipped folder.',
  "Pin the ProxhqVPN extension from the Extensions menu (puzzle icon).",
  "Open the extension → Settings → enter your node's SOCKS5 host:port.",
];

const STEPS_FIREFOX = [
  "Download the .zip below and extract it.",
  "Open Firefox and navigate to about:debugging",
  'Click "This Firefox" → "Load Temporary Add-on".',
  "Select the manifest.json file inside the extracted folder.",
  "Open the extension popup → Settings → configure your proxy.",
  "(For permanent install, the extension must be signed via AMO.)",
];

export default function BrowserExtension() {
  const [tab, setTab] = useState<"chrome" | "firefox">("chrome");
  const [copied, setCopied] = useState(false);

  function copyLoadPath() {
    navigator.clipboard.writeText("chrome://extensions").catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-[#050a05] text-gray-200 font-mono">
      {/* Hero */}
      <div className="border-b border-[#0d2a0d] bg-[#070e07] px-6 py-10">
        <div className="max-w-3xl mx-auto flex flex-col items-center text-center gap-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 rounded-xl bg-[#001a00] border border-[#00ff88]">
              <Puzzle className="w-8 h-8 text-[#00ff88]" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-[#00ff88] tracking-tight">
            ProxhqVPN Browser Extension
          </h1>
          <p className="text-[#3a6a3a] text-sm max-w-xl leading-relaxed">
            Privacy, stealth and control — directly in your browser toolbar.
            SOCKS5 proxy routing, WebRTC leak protection, encrypted DNS, and
            one-click access to your Command Center.
          </p>
          <div className="flex items-center gap-2 text-xs text-[#2a4a2a] mt-1">
            <span className="px-2 py-1 rounded border border-[#0d2a0d] bg-[#050a05]">Chrome</span>
            <span className="px-2 py-1 rounded border border-[#0d2a0d] bg-[#050a05]">Firefox</span>
            <span className="px-2 py-1 rounded border border-[#0d2a0d] bg-[#050a05]">Edge</span>
            <span className="px-2 py-1 rounded border border-[#0d2a0d] bg-[#050a05]">Brave</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10 space-y-12">

        {/* Download */}
        <section>
          <div className="text-[9px] uppercase tracking-[3px] text-[#2a5a2a] mb-4">Download</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <a
              href="/proxhq-extension.zip"
              download="proxhq-extension.zip"
              className="flex items-center gap-3 p-4 rounded-xl border border-[#00cc66] bg-[#001a00] hover:bg-[#002800] transition-colors group"
            >
              <div className="p-2 rounded-lg bg-[#003300]">
                <Download className="w-5 h-5 text-[#00ff88]" />
              </div>
              <div>
                <div className="text-[#00ff88] font-bold text-sm">Download Extension</div>
                <div className="text-[#2a5a2a] text-[10px] mt-0.5">Chrome · Edge · Brave · Firefox</div>
              </div>
            </a>

            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 rounded-xl border border-[#0d2a0d] bg-[#070e07] hover:border-[#2a5a2a] transition-colors"
            >
              <div className="p-2 rounded-lg bg-[#0a1a0a]">
                <ExternalLink className="w-5 h-5 text-[#3a6a3a]" />
              </div>
              <div>
                <div className="text-[#5a8a5a] font-bold text-sm">View Source</div>
                <div className="text-[#2a4a2a] text-[10px] mt-0.5">Open source · Inspect the code</div>
              </div>
            </a>
          </div>
        </section>

        {/* Features */}
        <section>
          <div className="text-[9px] uppercase tracking-[3px] text-[#2a5a2a] mb-4">What It Does</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="p-4 rounded-xl border border-[#0d2a0d] bg-[#07100a] hover:border-[#1a4a1a] transition-colors"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="w-4 h-4 text-[#00cc66]" />
                  <span className="text-[#00cc66] font-bold text-xs">{title}</span>
                </div>
                <p className="text-[#3a5a3a] text-[11px] leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Installation */}
        <section>
          <div className="text-[9px] uppercase tracking-[3px] text-[#2a5a2a] mb-4">Installation</div>

          {/* Tab picker */}
          <div className="flex gap-2 mb-5">
            {(["chrome", "firefox"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors ${
                  tab === t
                    ? "bg-[#001a00] border-[#00cc66] text-[#00ff88]"
                    : "bg-[#07100a] border-[#0d2a0d] text-[#3a6a3a] hover:border-[#2a5a2a]"
                }`}
              >
                {t === "chrome" ? "Chrome / Edge / Brave" : "Firefox"}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {(tab === "chrome" ? STEPS_CHROME : STEPS_FIREFOX).map((step, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-6 h-6 rounded-full bg-[#001a00] border border-[#00cc66] text-[#00ff88] text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </div>
                <div className="text-[#5a8a5a] text-xs leading-relaxed pt-0.5">
                  {step}
                  {step.includes("chrome://extensions") && (
                    <button
                      onClick={copyLoadPath}
                      className="ml-2 text-[#00cc66] underline text-[10px]"
                    >
                      {copied ? "copied!" : "copy"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Config callout */}
        <section>
          <div className="p-5 rounded-xl border border-[#0d2a0d] bg-[#07100a]">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-[#00cc66]" />
              <span className="text-[#00cc66] font-bold text-xs uppercase tracking-widest">Configure Your Proxy</span>
            </div>
            <p className="text-[#3a5a3a] text-[11px] leading-relaxed mb-3">
              After installing, open the extension and click ⚙ Settings. Enter your ProxhqVPN node's
              IP address and the SOCKS5 port. You can find or enable SOCKS5 on your nodes via the
              Proxy Config page in the dashboard.
            </p>
            <div className="flex gap-3 flex-wrap">
              <a
                href="/proxy"
                className="text-[10px] text-[#00cc66] border border-[#0d3a0d] bg-[#001a00] px-3 py-1.5 rounded-lg hover:bg-[#002a00] transition-colors"
              >
                → Proxy Config
              </a>
              <a
                href="/nodes"
                className="text-[10px] text-[#3a6a3a] border border-[#0d2a0d] px-3 py-1.5 rounded-lg hover:border-[#2a5a2a] transition-colors"
              >
                → Node Manager
              </a>
              <a
                href="/wireguard"
                className="text-[10px] text-[#3a6a3a] border border-[#0d2a0d] px-3 py-1.5 rounded-lg hover:border-[#2a5a2a] transition-colors"
              >
                → WireGuard Config
              </a>
            </div>
          </div>
        </section>

        {/* vs Competitors callout */}
        <section>
          <div className="text-[9px] uppercase tracking-[3px] text-[#2a5a2a] mb-4">vs. Nord / Express / Surfshark Extensions</div>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] border-collapse">
              <thead>
                <tr className="border-b border-[#0d2a0d]">
                  <th className="text-left py-2 pr-4 text-[#2a5a2a]">Feature</th>
                  <th className="text-center py-2 px-3 text-[#2a5a2a]">Nord / Express</th>
                  <th className="text-center py-2 px-3 text-[#00cc66]">ProxhqVPN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#0a1a0a]">
                {[
                  ["SOCKS5 Proxy Routing", "✅", "✅"],
                  ["WebRTC Leak Blocker", "✅", "✅"],
                  ["DNS-over-HTTPS", "Some", "✅"],
                  ["Status Badge", "✅", "✅"],
                  ["Canary Token Quick Access", "❌", "✅"],
                  ["Leak Test Quick Access", "❌", "✅"],
                  ["Open Source", "❌", "✅"],
                  ["No Third-Party Telemetry", "❌", "✅"],
                  ["Works Without Paid Subscription", "❌", "✅"],
                ].map(([feat, them, us]) => (
                  <tr key={feat}>
                    <td className="py-2 pr-4 text-[#5a8a5a]">{feat}</td>
                    <td className="text-center py-2 px-3 text-[#3a5a3a]">{them}</td>
                    <td className={`text-center py-2 px-3 font-bold ${us === "✅" ? "text-[#00ff88]" : "text-[#3a5a3a]"}`}>{us}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <div className="text-center text-[10px] text-[#1a3a1a] pb-4">
          © 2026 Alpha Unlimited Technologies LLC · ProxhqVPN Browser Extension v1.0.0
        </div>
      </div>
    </div>
  );
}
