import { useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useMutation } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Globe, Lock, Server, Shield, AlertTriangle, CheckCircle,
  Loader2, Mail, Network, Code2, ChevronRight,
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

function RiskPill({ risk }: { risk: string }) {
  const color = risk === "critical" ? "border-red-400/30 bg-red-400/10 text-red-400"
    : risk === "high" ? "border-orange-400/30 bg-orange-400/10 text-orange-400"
    : risk === "medium" ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-400"
    : "border-[#00ff88]/20 bg-[#00ff88]/5 text-[#00ff88]";
  return <span className={`text-[9px] font-bold uppercase border px-1.5 py-0.5 rounded font-mono ${color}`}>{risk}</span>;
}

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-primary/10 rounded-sm overflow-hidden">
      <button
        className="w-full flex items-center gap-2 p-3 bg-primary/3 hover:bg-primary/5 transition-colors text-left"
        onClick={() => setOpen(o => !o)}
      >
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

export default function OsintRecon() {
  const { toast } = useToast();
  const [target, setTarget] = usePersistedState<string>("osint-target", "");
  const [result, setResult] = useState<any>(null);

  const lookupMut = useMutation({
    mutationFn: (t: string) => apiFetch("/osint/lookup", { method: "POST", body: JSON.stringify({ target: t }) }),
    onSuccess: (data) => setResult(data),
    onError: (err: Error) => toast({ title: "Lookup failed", description: err.message, variant: "destructive" }),
  });

  const dns = result?.dns;
  const http = result?.http;
  const tlsCert = result?.tls;
  const ip = result?.ip;
  const email = result?.email;
  const exposure = result?.exposure;

  return (
    <div className="p-4 md:p-6 space-y-6 font-mono min-h-screen">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Globe className="w-5 h-5 text-[#00ff88]" />
          <h1 className="text-lg font-bold text-primary tracking-tight">OSINT Recon</h1>
          <Badge className="text-[9px] border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88] font-mono uppercase tracking-widest px-1.5">Passive</Badge>
        </div>
        <p className="text-xs text-primary/40 max-w-xl leading-relaxed">
          Passive intelligence gathering — DNS records, TLS certificates, HTTP headers, CDN detection, email security, and exposure analysis. No active probing.
        </p>
      </div>

      {/* Input */}
      <div className="border border-primary/20 p-4 rounded-sm bg-primary/2">
        <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-2">Target</div>
        <div className="flex gap-2">
          <input
            value={target}
            onChange={e => setTarget(e.target.value)}
            onKeyDown={e => e.key === "Enter" && target.trim() && lookupMut.mutate(target.trim())}
            placeholder="example.com"
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
        <div className="mt-2 text-[10px] text-primary/20">
          Performs passive reconnaissance: DNS resolution, TLS inspection, HTTP headers, email security records
        </div>
      </div>

      {lookupMut.isPending && (
        <div className="border border-primary/10 p-8 text-center rounded-sm">
          <Loader2 className="w-6 h-6 text-[#00ff88] mx-auto mb-2 animate-spin" />
          <div className="text-xs text-primary/40">Gathering passive intelligence...</div>
          <div className="text-[10px] text-primary/20 mt-1">DNS · TLS · HTTP · Email Security</div>
        </div>
      )}

      {result && !lookupMut.isPending && (
        <div className="space-y-3">

          {/* Exposure summary */}
          {exposure && (
            <div className="border border-primary/20 p-4 rounded-sm bg-primary/3">
              <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-3">Exposure Summary — {result.target}</div>
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
                  {exposure.headerRisk?.corsWildcard && <div className="text-[10px] text-yellow-400/80 mt-1">CORS wildcard (*)</div>}
                </div>
                <div className="text-center">
                  <div className="text-[10px] text-primary/40 mb-1">Email Security</div>
                  <div className="flex justify-center gap-1.5 mt-1">
                    {["DKIM", "DMARC", "SPF"].map((rec, i) => {
                      const has = i === 0 ? exposure.emailSecurity?.hasDkim : i === 1 ? exposure.emailSecurity?.hasDmarc : exposure.emailSecurity?.hasSpf;
                      return (
                        <span key={rec} className={`text-[9px] font-bold border px-1 py-0.5 rounded ${has ? "border-[#00ff88]/30 text-[#00ff88]" : "border-red-400/30 text-red-400/70 line-through"}`}>
                          {rec}
                        </span>
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

          {/* IP info */}
          {ip && (
            <Section title="IP & Hosting" icon={Server}>
              <KV k="Primary IP" v={ip.primary} highlight="text-[#00ff88] font-bold" />
              {ip.all.length > 1 && <KV k="All IPs" v={ip.all.join(", ")} />}
              <KV k="ASN" v={ip.asn} />
              {ip.isCloudflare && <KV k="CDN" v={<span className="text-orange-400">Cloudflare</span>} />}
              {ip.isAws && <KV k="CDN" v={<span className="text-yellow-400">Amazon AWS</span>} />}
            </Section>
          )}

          {/* DNS records */}
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

          {/* TLS */}
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

          {/* HTTP */}
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

          {/* Email security */}
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

      {!result && !lookupMut.isPending && (
        <div className="border border-primary/10 p-10 text-center rounded-sm">
          <Globe className="w-8 h-8 text-primary/15 mx-auto mb-3" />
          <div className="text-sm text-primary/25">Enter a domain or IP to begin passive recon</div>
          <div className="text-xs text-primary/15 mt-1">DNS · TLS · HTTP · Email Security · CDN · Hosting</div>
        </div>
      )}
    </div>
  );
}
