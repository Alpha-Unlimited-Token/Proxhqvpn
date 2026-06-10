import { useEffect, useState } from "react";
import { Shield, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from "lucide-react";

interface ScoreComponent {
  label: string;
  points: number;
  maxPoints: number;
  status: string;
}

interface SecurityScoreData {
  score: number;
  maxScore: number;
  grade: string;
  components: ScoreComponent[];
  recommendations: string[];
  userId: string;
}

function CircleScore({ score, max, grade }: { score: number; max: number; grade: string }) {
  const pct   = max > 0 ? score / max : 0;
  const r     = 70;
  const circ  = 2 * Math.PI * r;
  const dash  = circ * pct;
  const color = score >= 90 ? "#22c55e" : score >= 70 ? "#eab308" : "#ef4444";
  return (
    <div className="relative flex items-center justify-center w-44 h-44">
      <svg className="absolute top-0 left-0 -rotate-90" width="176" height="176" viewBox="0 0 176 176">
        <circle cx="88" cy="88" r={r} fill="none" stroke="#1f2937" strokeWidth="12" />
        <circle
          cx="88" cy="88" r={r} fill="none"
          stroke={color} strokeWidth="12"
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 0.8s ease" }}
        />
      </svg>
      <div className="text-center z-10">
        <div className="text-4xl font-bold text-white font-mono">{score}</div>
        <div className="text-gray-400 text-xs">/ {max}</div>
        <div className={`text-xl font-bold mt-1 ${score >= 90 ? "text-green-400" : score >= 70 ? "text-yellow-400" : "text-red-400"}`}>
          {grade}
        </div>
      </div>
    </div>
  );
}

function ComponentRow({ c }: { c: ScoreComponent }) {
  const pct   = c.maxPoints > 0 ? c.points / c.maxPoints : 0;
  const color = pct >= 1 ? "bg-green-500" : pct >= 0.5 ? "bg-yellow-500" : "bg-red-500";
  const icon  = pct >= 1
    ? <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
    : pct >= 0.5
    ? <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
    : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />;
  return (
    <div className="flex items-center gap-3">
      {icon}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-300">{c.label}</span>
          <span className="text-gray-400 font-mono">{c.points} / {c.maxPoints}</span>
        </div>
        <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${pct * 100}%`, transition: "width 0.6s ease" }} />
        </div>
      </div>
    </div>
  );
}

export default function CustomerSecurityDashboard() {
  const [data, setData]       = useState<SecurityScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");

  async function load() {
    try {
      setLoading(true);
      const r = await fetch("/api/security-score");
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  if (loading) return <div className="flex h-64 items-center justify-center text-gray-500">Loading security score…</div>;
  if (err)     return <div className="flex h-64 items-center justify-center text-red-400">{err}</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-green-400 flex items-center gap-2">
            <Shield className="w-6 h-6" /> Security Score
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Your account security posture across devices, configs, and activity.
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 text-sm text-gray-400 hover:text-green-400 transition-colors border border-gray-700 rounded-lg px-3 py-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Score circle */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 flex flex-col items-center justify-center gap-4">
          <CircleScore score={data!.score} max={data!.maxScore} grade={data!.grade} />
          <p className="text-center text-xs text-gray-500 max-w-xs">
            {data!.score >= 90
              ? "Excellent security posture. Keep it up."
              : data!.score >= 70
              ? "Good posture. A few improvements recommended."
              : "Security posture needs attention. Review recommendations below."}
          </p>
        </div>

        {/* Breakdown */}
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Score Breakdown</h2>
          {data!.components.map(c => <ComponentRow key={c.label} c={c} />)}
        </div>
      </div>

      {/* Recommendations */}
      {data!.recommendations.length > 0 && (
        <div className="bg-yellow-900/10 border border-yellow-700/40 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Recommendations
          </h2>
          <ul className="space-y-2">
            {data!.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                <span className="text-yellow-400 mt-0.5">→</span> {r}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data!.recommendations.length === 0 && (
        <div className="bg-green-900/10 border border-green-700/40 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
          <span className="text-sm text-green-300">No action items — your security posture is fully optimised.</span>
        </div>
      )}
    </div>
  );
}
