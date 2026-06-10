import { useEffect, useState } from "react";
import { FileText, RefreshCw, Clock, ChevronDown, ChevronUp } from "lucide-react";

interface LifecycleEvent {
  config_id: string;
  device_id: string;
  device_name?: string;
  platform?: string;
  state: string;
  metadata?: any;
  created_at: string;
}

const STATE_COLORS: Record<string, string> = {
  created:    "bg-blue-500/20 text-blue-300 border-blue-500/30",
  downloaded: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  activated:  "bg-green-500/20 text-green-300 border-green-500/30",
  rotated:    "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  revoked:    "bg-red-500/20 text-red-300 border-red-500/30",
  deleted:    "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const STATE_DOTS: Record<string, string> = {
  created: "bg-blue-400", downloaded: "bg-purple-400", activated: "bg-green-400",
  rotated: "bg-yellow-400", revoked: "bg-red-400", deleted: "bg-gray-500",
};

function StateBadge({ state }: { state: string }) {
  const cls = STATE_COLORS[state] ?? "bg-gray-700 text-gray-400 border-gray-600";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-mono ${cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${STATE_DOTS[state] ?? "bg-gray-500"}`} />
      {state}
    </span>
  );
}

function EventRow({ ev }: { ev: LifecycleEvent }) {
  const [open, setOpen] = useState(false);
  const hasMetadata = ev.metadata && Object.keys(ev.metadata).length > 0;
  return (
    <div className="border-b border-gray-800 last:border-0">
      <div className="flex items-center gap-3 py-3 px-4 hover:bg-gray-800/30 transition-colors cursor-pointer" onClick={() => hasMetadata && setOpen(o => !o)}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATE_DOTS[ev.state] ?? "bg-gray-500"}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-gray-400">{ev.config_id.substring(0, 20)}…</span>
            <StateBadge state={ev.state} />
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {ev.device_name ?? ev.device_id} {ev.platform ? `(${ev.platform})` : ""}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-gray-500 flex items-center gap-1 justify-end">
            <Clock className="w-3 h-3" />
            {new Date(ev.created_at).toLocaleString()}
          </div>
        </div>
        {hasMetadata && (
          <button className="text-gray-600 hover:text-gray-400 flex-shrink-0">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>
      {open && hasMetadata && (
        <div className="px-9 pb-3">
          <pre className="bg-gray-900 rounded p-3 text-xs font-mono text-gray-400 overflow-x-auto">
            {JSON.stringify(ev.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

const STATES = ["all", "created", "downloaded", "activated", "rotated", "revoked", "deleted"];

export default function ConfigLifecycle() {
  const [events, setEvents]   = useState<LifecycleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState("");
  const [filter, setFilter]   = useState("all");

  async function load() {
    setLoading(true); setErr("");
    try {
      const r = await fetch("/api/config-lifecycle-events");
      if (!r.ok) throw new Error(await r.text());
      const d = await r.json();
      setEvents(d.events ?? []);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const filtered = filter === "all" ? events : events.filter(e => e.state === filter);

  const counts = Object.fromEntries(
    STATES.slice(1).map(s => [s, events.filter(e => e.state === s).length])
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-green-400 flex items-center gap-2">
            <FileText className="w-6 h-6" /> VPN Config Lifecycle
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Full audit trail for every config: created → downloaded → activated → rotated → revoked → deleted.
          </p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-2 text-sm text-gray-400 hover:text-green-400 transition-colors border border-gray-700 rounded-lg px-3 py-2 disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* State summary pills */}
      <div className="flex flex-wrap gap-2">
        {STATES.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${filter === s ? "bg-green-700/30 border-green-600 text-green-300" : "bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-600"}`}>
            {s === "all" ? `All (${events.length})` : `${s} (${counts[s] ?? 0})`}
          </button>
        ))}
      </div>

      {err && <div className="bg-red-900/20 border border-red-700/40 text-red-300 rounded-lg px-4 py-3 text-sm">{err}</div>}

      <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-500">Loading lifecycle events…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500 gap-2">
            <FileText className="w-8 h-8 text-gray-700" />
            <span className="text-sm">No lifecycle events yet. Issue your first WireGuard config to begin tracking.</span>
          </div>
        ) : (
          <div>
            {filtered.map((ev, i) => <EventRow key={ev.config_id + ev.state + i} ev={ev} />)}
          </div>
        )}
      </div>
    </div>
  );
}
