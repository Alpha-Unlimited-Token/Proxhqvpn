// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Lock, ShieldCheck, ScanLine, Eye, KeyRound, Wifi } from "lucide-react";

interface Props {
  summary: string;
}

const PILLARS = [
  { icon: ShieldCheck, label: "Continuous Validation",    desc: "Automated security checks run around the clock"         },
  { icon: ScanLine,    label: "Penetration Testing",      desc: "Regular third-party and automated pen tests"            },
  { icon: Lock,        label: "Encryption at Rest + Transit", desc: "AES-256-GCM keys, WireGuard TLS everywhere"        },
  { icon: Eye,         label: "Audit Chain",              desc: "SHA3-256 hash chain with HMAC-SHA512 tamper detection"   },
  { icon: KeyRound,    label: "Zero-Knowledge Keys",      desc: "RAM-only WireGuard keys — never written to disk"        },
  { icon: Wifi,        label: "60-Node Mesh",             desc: "Distributed WireGuard mesh with honeypot overlay"       },
];

export default function SecurityProgramCard({ summary }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 flex flex-col gap-5">
      <div className="flex items-center gap-2.5">
        <Lock className="w-5 h-5 text-primary" />
        <span className="text-sm font-semibold text-white/90">Security Program</span>
      </div>

      <p className="text-sm text-white/60 leading-relaxed">{summary}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {PILLARS.map(({ icon: Icon, label, desc }) => (
          <div key={label} className="flex items-start gap-3 rounded-lg bg-white/[0.03] border border-white/[0.06] p-3">
            <div className="shrink-0 w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center mt-0.5">
              <Icon className="w-3.5 h-3.5 text-primary" />
            </div>
            <div>
              <div className="text-xs font-semibold text-white/80">{label}</div>
              <div className="text-[11px] text-white/40 mt-0.5 leading-relaxed">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
