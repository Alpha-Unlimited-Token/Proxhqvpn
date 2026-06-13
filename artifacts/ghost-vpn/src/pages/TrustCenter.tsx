// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Public Trust Center — customer-facing security posture page.
// DOES NOT expose: raw vulnerabilities, internal IPs, private node details, WireGuard configs.
import { useState, useEffect } from "react";
import { Shield, RefreshCw, Mail, Lock, AlertTriangle } from "lucide-react";
import TrustScoreCard from "@/components/trust/TrustScoreCard";
import ValidationSummaryCard from "@/components/trust/ValidationSummaryCard";
import UptimeMetricsCard from "@/components/trust/UptimeMetricsCard";
import ComplianceRoadmapCard from "@/components/trust/ComplianceRoadmapCard";
import TrustDocumentList from "@/components/trust/TrustDocumentList";
import SecurityProgramCard from "@/components/trust/SecurityProgramCard";
import IncidentHistoryCard from "@/components/trust/IncidentHistoryCard";

interface TrustSummary {
  trustScore: number;
  maxScore: number;
  validationStatus: "trusted" | "monitoring" | "incident" | "initializing";
  lastValidationRun: string | null;
  uptime30d: number;
  uptime90d: number;
  uptime365d: number;
  complianceStatus: { name: string; status: "active" | "in_progress" | "planned" }[];
  openPublicIncidents: number;
  resolvedIncidentsCount: number;
  securityProgramSummary: string;
  lastUpdated: string;
}

interface ValidationSummary {
  latestScore: number;
  maxScore: number;
  lastValidationAt: string | null;
  checksPerformed: number;
  passed: number;
  failed: number;
  warning: number;
  checksTypes: string[];
}

interface TrustDocument {
  id: string;
  title: string;
  type: string;
  summary: string;
  publishedAt: string;
  publicDownloadUrl: string | null;
}

const CONTACT_EMAIL = import.meta.env.VITE_SECURITY_CONTACT_EMAIL ?? "security@proxhqvpn.com";

export default function TrustCenter() {
  const [summary, setSummary] = useState<TrustSummary | null>(null);
  const [validation, setValidation] = useState<ValidationSummary | null>(null);
  const [documents, setDocuments] = useState<TrustDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState<Date>(new Date());

  async function load() {
    setLoading(true);
    try {
      const [s, v, d] = await Promise.all([
        fetch("/api/trust-center/summary").then(r => r.json()),
        fetch("/api/trust-center/validation-summary").then(r => r.json()),
        fetch("/api/trust-center/documents").then(r => r.json()),
      ]);
      setSummary(s as TrustSummary);
      setValidation(v as ValidationSummary);
      setDocuments((d as { documents: TrustDocument[] }).documents ?? []);
      setRefreshedAt(new Date());
    } catch {
      // silent — default cards handle missing data gracefully
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="min-h-screen bg-[#070c08] text-white">
      {/* Hero */}
      <div className="bg-gradient-to-b from-[#0a120b] to-[#070c08] border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 py-14 flex flex-col items-center text-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-center">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
              ProxhqVPN Trust Center
            </h1>
            <p className="mt-3 text-base text-white/50 max-w-xl leading-relaxed">
              ProxhqVPN is continuously monitored, validated, and hardened through automated security
              checks, infrastructure health monitoring, VPN node validation, and audit-chain-backed reporting.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <span className="text-xs text-white/30">
              Last updated: {refreshedAt.toLocaleString()}
            </span>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-primary/70 hover:text-primary transition-colors disabled:opacity-40"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* Row 1 — Score + Uptime */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <TrustScoreCard
            score={summary?.trustScore ?? 0}
            maxScore={summary?.maxScore ?? 100}
            status={summary?.validationStatus ?? "initializing"}
            lastUpdated={summary?.lastValidationRun ?? null}
          />
          <UptimeMetricsCard
            uptime30d={summary?.uptime30d ?? 0}
            uptime90d={summary?.uptime90d ?? 0}
            uptime365d={summary?.uptime365d ?? 0}
          />
        </div>

        {/* Row 2 — Validation + Incidents */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <ValidationSummaryCard
            checksPerformed={validation?.checksPerformed ?? 0}
            passed={validation?.passed ?? 0}
            failed={validation?.failed ?? 0}
            warning={validation?.warning ?? 0}
            lastValidationAt={validation?.lastValidationAt ?? null}
            checksTypes={validation?.checksTypes ?? []}
          />
          <IncidentHistoryCard
            openCount={summary?.openPublicIncidents ?? 0}
            resolvedCount={summary?.resolvedIncidentsCount ?? 0}
            activeIncidents={[]}
          />
        </div>

        {/* Security Program */}
        <SecurityProgramCard
          summary={
            summary?.securityProgramSummary ??
            "ProxhqVPN is continuously monitored, validated, and hardened through automated security checks, " +
            "infrastructure health monitoring, VPN node validation, and audit-chain-backed reporting."
          }
        />

        {/* Compliance Roadmap */}
        <ComplianceRoadmapCard items={summary?.complianceStatus ?? []} />

        {/* Trust Documents */}
        <TrustDocumentList documents={documents} />

        {/* Pentest Summary */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-3">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-white/90">Penetration Testing</span>
          </div>
          <p className="text-sm text-white/55 leading-relaxed">
            ProxhqVPN undergoes regular penetration testing of its API endpoints, authentication
            flows, WireGuard configuration generation, and VPN node infrastructure. Findings are
            tracked, remediated, and verified before each testing cycle is closed. Detailed reports
            are available under NDA to enterprise customers.
          </p>
        </div>

        {/* Privacy Program */}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-3">
          <div className="flex items-center gap-2.5">
            <Lock className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-white/90">Privacy Program</span>
          </div>
          <ul className="text-sm text-white/55 space-y-1.5">
            {[
              "Strict no-log policy — no VPN activity or connection logs stored",
              "RAM-only WireGuard keys — private keys never written to disk",
              "Data minimization — only necessary data collected for service operation",
              "GDPR-compliant data processing and deletion workflows",
              "User data export and deletion available from account settings",
            ].map(item => (
              <li key={item} className="flex items-start gap-2">
                <span className="text-primary mt-0.5 shrink-0">›</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Vulnerability Disclosure Policy */}
        <div id="disclosure" className="rounded-xl border border-primary/20 bg-primary/[0.04] p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Mail className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-white/90">Vulnerability Disclosure Policy</span>
          </div>
          <div className="text-sm text-white/60 space-y-3 leading-relaxed">
            <p>
              We welcome responsible disclosure of security vulnerabilities in ProxhqVPN-owned systems.
              If you discover a security issue, please report it to us before public disclosure.
            </p>
            <div>
              <p className="text-white/80 font-medium mb-1">How to report</p>
              <p>
                Email{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
                  {CONTACT_EMAIL}
                </a>{" "}
                with a clear description, steps to reproduce, and potential impact.
                We aim to acknowledge reports within 72 hours.
              </p>
            </div>
            <div>
              <p className="text-white/80 font-medium mb-1">Safe Harbor</p>
              <p>
                Security researchers acting in good faith under this policy will not face legal action
                from Alpha Unlimited Technologies LLC. We commit to working with you to understand and
                remediate valid findings promptly.
              </p>
            </div>
            <div>
              <p className="text-white/80 font-medium mb-1">Rules of Engagement</p>
              <ul className="space-y-1">
                {[
                  "Testing must be limited to ProxhqVPN-owned assets only",
                  "No unauthorized testing against third parties or customers",
                  "No destructive testing, DoS attacks, or data exfiltration",
                  "No social engineering of ProxhqVPN employees or customers",
                  "Do not access, modify, or delete user data",
                ].map(rule => (
                  <li key={rule} className="flex items-start gap-2">
                    <span className="text-primary shrink-0 mt-0.5">›</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center pb-6 space-y-1">
          <p className="text-xs text-white/25">© 2024–2026 Alpha Unlimited Technologies LLC. All rights reserved.</p>
          <p className="text-[11px] text-white/15">
            Questions?{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white/30">
              {CONTACT_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
