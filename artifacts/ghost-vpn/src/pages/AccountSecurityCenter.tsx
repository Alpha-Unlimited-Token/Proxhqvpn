import { useEffect, useState } from "react";
import { Shield, Cpu, Wifi, AlertTriangle, CheckCircle2, RefreshCw, Trash2, Plus } from "lucide-react";

type Device = {
  id: string;
  display_name: string;
  platform: string | null;
  trust_state: string;
  last_seen_at: string | null;
  created_at: string;
};

type SecurityEvent = {
  event_type: string;
  severity: string;
  created_at: string;
};

type Summary = {
  userId: string;
  activeDevices: number;
  activeVpnConfigs: number;
  recentSecurityEvents: SecurityEvent[];
  recommendedActions: string[];
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "text-red-400",
  high: "text-orange-400",
  medium: "text-yellow-400",
  low: "text-cyan-400",
  info: "text-green-400",
};

const TRUST_COLOR: Record<string, string> = {
  trusted: "text-green-400",
  pending: "text-yellow-400",
  limited: "text-orange-400",
  blocked: "text-red-400",
  revoked: "text-gray-500",
};

export default function AccountSecurityCenter() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newDevice, setNewDevice] = useState({ displayName: "", platform: "", fingerprint: "" });

  async function load() {
    setLoading(true);
    const [s, d] = await Promise.all([
      fetch("/api/account-security/summary", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/account-security/devices",  { credentials: "include" }).then((r) => r.json()),
    ]);
    setSummary(s);
    setDevices(d.devices ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function revoke(id: string) {
    setRevoking(id);
    await fetch(`/api/account-security/devices/${id}/revoke`, { method: "POST", credentials: "include" });
    await load();
    setRevoking(null);
  }

  async function addDevice() {
    await fetch("/api/account-security/devices", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newDevice),
    });
    setAddOpen(false);
    setNewDevice({ displayName: "", platform: "", fingerprint: "" });
    await load();
  }

  if (loading) {
    return (
      <div className="p-6 font-mono text-green-400 flex items-center gap-2">
        <RefreshCw className="w-4 h-4 animate-spin" />
        Loading account security...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 font-mono">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-green-400" />
        <h1 className="text-xl font-bold text-green-300">Account Security Center</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard icon={<Cpu className="w-5 h-5 text-cyan-400" />} label="Active Devices" value={String(summary?.activeDevices ?? 0)} />
        <StatCard icon={<Wifi className="w-5 h-5 text-green-400" />} label="VPN Configs" value={String(summary?.activeVpnConfigs ?? 0)} />
        <StatCard icon={<AlertTriangle className="w-5 h-5 text-yellow-400" />} label="Security Events" value={String(summary?.recentSecurityEvents?.length ?? 0)} />
      </div>

      {/* Recommended actions */}
      {summary?.recommendedActions && summary.recommendedActions.length > 0 && (
        <div className="rounded border border-yellow-500/30 bg-yellow-500/5 p-4">
          <h2 className="text-yellow-400 font-semibold mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Recommended Actions
          </h2>
          <ul className="space-y-1">
            {summary.recommendedActions.map((a) => (
              <li key={a} className="text-sm text-gray-300 flex items-start gap-2">
                <span className="text-yellow-500 mt-0.5">›</span>{a}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Devices */}
      <div className="rounded border border-green-500/20 bg-black/40">
        <div className="flex items-center justify-between px-4 py-3 border-b border-green-500/20">
          <h2 className="text-green-300 font-semibold">Registered Devices</h2>
          <button
            onClick={() => setAddOpen(!addOpen)}
            className="flex items-center gap-1 text-xs text-green-400 border border-green-500/30 rounded px-2 py-1 hover:bg-green-500/10"
          >
            <Plus className="w-3 h-3" /> Add Device
          </button>
        </div>

        {addOpen && (
          <div className="p-4 border-b border-green-500/10 space-y-2">
            <input className="w-full bg-black border border-green-500/30 rounded px-3 py-1.5 text-sm text-green-300 placeholder-gray-600 focus:outline-none focus:border-green-400" placeholder="Display name (e.g. MacBook Pro)" value={newDevice.displayName} onChange={(e) => setNewDevice((p) => ({ ...p, displayName: e.target.value }))} />
            <input className="w-full bg-black border border-green-500/30 rounded px-3 py-1.5 text-sm text-green-300 placeholder-gray-600 focus:outline-none focus:border-green-400" placeholder="Platform (linux / macos / windows)" value={newDevice.platform} onChange={(e) => setNewDevice((p) => ({ ...p, platform: e.target.value }))} />
            <input className="w-full bg-black border border-green-500/30 rounded px-3 py-1.5 text-sm text-green-300 placeholder-gray-600 focus:outline-none focus:border-green-400" placeholder="Device fingerprint / public key hash" value={newDevice.fingerprint} onChange={(e) => setNewDevice((p) => ({ ...p, fingerprint: e.target.value }))} />
            <button onClick={addDevice} className="w-full rounded border border-green-500/40 py-1.5 text-sm text-green-400 hover:bg-green-500/10">Register Device</button>
          </div>
        )}

        {devices.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">No devices registered yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-green-500/10">
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Platform</th>
                <th className="text-left px-4 py-2">Trust</th>
                <th className="text-left px-4 py-2">Last Seen</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => (
                <tr key={d.id} className="border-b border-green-500/5 hover:bg-green-500/5">
                  <td className="px-4 py-2 text-green-300">{d.display_name}</td>
                  <td className="px-4 py-2 text-gray-400">{d.platform ?? "—"}</td>
                  <td className={`px-4 py-2 ${TRUST_COLOR[d.trust_state] ?? "text-gray-400"}`}>{d.trust_state}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleDateString() : "Never"}</td>
                  <td className="px-4 py-2 text-right">
                    {d.trust_state !== "revoked" && (
                      <button onClick={() => revoke(d.id)} disabled={revoking === d.id} className="text-red-400 hover:text-red-300 disabled:opacity-50">
                        {revoking === d.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Security event log */}
      {summary?.recentSecurityEvents && summary.recentSecurityEvents.length > 0 && (
        <div className="rounded border border-green-500/20 bg-black/40">
          <h2 className="px-4 py-3 text-green-300 font-semibold border-b border-green-500/20">Recent Security Events</h2>
          <div className="divide-y divide-green-500/5">
            {summary.recentSecurityEvents.map((e, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-2 text-sm">
                <CheckCircle2 className={`w-4 h-4 flex-shrink-0 ${SEVERITY_COLOR[e.severity] ?? "text-gray-400"}`} />
                <span className="text-gray-300 flex-1">{e.event_type.replace(/_/g, " ")}</span>
                <span className={`text-xs ${SEVERITY_COLOR[e.severity] ?? "text-gray-500"}`}>{e.severity}</span>
                <span className="text-xs text-gray-600">{new Date(e.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded border border-green-500/20 bg-black/40 p-4 flex items-center gap-3">
      {icon}
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-2xl font-bold text-green-300">{value}</div>
      </div>
    </div>
  );
}
