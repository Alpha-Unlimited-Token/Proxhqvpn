import { useEffect } from "react";
import { ShieldCheck, ExternalLink, Cpu, AlertTriangle, Atom } from "lucide-react";

export default function QuantumAudit() {
  const BASE = import.meta.env.BASE_URL?.replace(/\/ghost-vpn\/?$/, "") ?? "";
  const qaUrl = `${BASE}/quantum-audit/`;

  useEffect(() => {
    window.location.replace(qaUrl);
  }, [qaUrl]);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-8 p-8 font-mono">
      <div className="flex items-center gap-3">
        <Atom className="text-cyan-400" size={36} />
        <h1 className="text-2xl font-bold tracking-widest text-cyan-400 uppercase">QuantumAudit</h1>
      </div>

      <p className="text-white/50 text-sm uppercase tracking-widest">Redirecting to QuantumAudit platform...</p>

      <div className="border border-cyan-400/20 bg-cyan-900/10 p-6 max-w-md w-full text-center">
        <p className="text-white/60 text-xs mb-4">
          QuantumAudit is a dedicated blockchain security auditing platform integrated into your Command Center.
          It scans smart contracts and protocols for both classical and post-quantum vulnerabilities.
        </p>
        <a
          href={qaUrl}
          className="inline-flex items-center gap-2 bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs uppercase tracking-widest px-4 py-2 hover:bg-cyan-500/30 transition-colors"
        >
          <ExternalLink size={14} />
          Open QuantumAudit
        </a>
      </div>

      <div className="grid grid-cols-3 gap-4 max-w-md w-full">
        {[
          { icon: ShieldCheck, label: "Smart Contract Audits", color: "text-cyan-400" },
          { icon: Cpu, label: "Post-Quantum Analysis", color: "text-orange-400" },
          { icon: AlertTriangle, label: "Vulnerability Reports", color: "text-red-400" },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className="border border-white/5 bg-white/3 p-4 flex flex-col items-center gap-2">
            <Icon size={20} className={color} />
            <span className="text-white/40 text-[10px] uppercase tracking-widest text-center">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
