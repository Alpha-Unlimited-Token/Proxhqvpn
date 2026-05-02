// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import QRCode from "react-qr-code";
import {
  Monitor, Smartphone, Tv, Router, Globe, Plus, Trash2,
  Copy, CheckCheck, QrCode, ChevronDown, ChevronUp, RefreshCw
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type DeviceType = "windows"|"macos"|"linux"|"ios"|"android"|"android-tv"|"fire-tv"|"apple-tv"|"smart-tv"|"router"|"browser"|"other";
type DeviceStatus = "active"|"inactive"|"blocked";

interface Device {
  id: number;
  name: string;
  type: DeviceType;
  publicKey: string | null;
  assignedIp: string;
  allowedIps: string;
  status: DeviceStatus;
  dataUsedMb: number;
  lastSeen: string | null;
  createdAt: string;
}

interface DeviceConfig {
  clientConfig: string;
  serverPeerSnippet: string;
  assignedIp: string;
}

const TYPE_ICONS: Record<DeviceType, React.ElementType> = {
  windows: Monitor, macos: Monitor, linux: Monitor, chromebook: Monitor,
  ios: Smartphone, android: Smartphone,
  "android-tv": Tv, "fire-tv": Tv, "apple-tv": Tv, "smart-tv": Tv,
  router: Router, browser: Globe, other: Globe,
} as any;

const TYPE_LABELS: Record<DeviceType, string> = {
  windows: "Windows", macos: "macOS", linux: "Linux",
  ios: "iOS / iPadOS", android: "Android",
  "android-tv": "Android TV", "fire-tv": "Fire TV",
  "apple-tv": "Apple TV", "smart-tv": "Smart TV",
  router: "Router", browser: "Browser", other: "Other",
};

const STATUS_COLORS: Record<DeviceStatus, string> = {
  active:   "text-green-400 border-green-500/40",
  inactive: "text-yellow-400 border-yellow-500/40",
  blocked:  "text-red-400 border-red-500/40",
};

export default function DeviceManager() {
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [expandedConfig, setExpandedConfig] = useState<number | null>(null);
  const [configs, setConfigs] = useState<Record<number, DeviceConfig>>({});
  const [showQr, setShowQr] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", type: "android" as DeviceType, publicKey: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/devices`);
      const data = await r.json();
      setDevices(Array.isArray(data) ? data : []);
      setLoaded(true);
    } catch {
      toast({ title: "Failed to load devices", variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  if (!loaded && !loading) load();

  const addDevice = async () => {
    if (!form.name.trim()) return;
    try {
      const r = await fetch(`${BASE}/api/devices`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, type: form.type, publicKey: form.publicKey || undefined }),
      });
      const data = await r.json();
      if (!r.ok) { toast({ title: data.error || "Failed to add device", variant: "destructive" }); return; }
      setDevices(prev => [...prev, data]);
      setForm({ name: "", type: "android", publicKey: "" });
      setAdding(false);
      toast({ title: `Device "${data.name}" added — IP: ${data.assignedIp}` });
    } catch { toast({ title: "Network error", variant: "destructive" }); }
  };

  const deleteDevice = async (id: number, name: string) => {
    if (!confirm(`Remove device "${name}"?`)) return;
    try {
      await fetch(`${BASE}/api/devices/${id}`, { method: "DELETE" });
      setDevices(prev => prev.filter(d => d.id !== id));
      toast({ title: `Device "${name}" removed` });
    } catch { toast({ title: "Failed to remove device", variant: "destructive" }); }
  };

  const loadConfig = async (id: number) => {
    if (configs[id]) { setExpandedConfig(prev => prev === id ? null : id); return; }
    try {
      const r = await fetch(`${BASE}/api/devices/${id}/config`);
      const data = await r.json();
      setConfigs(prev => ({ ...prev, [id]: data }));
      setExpandedConfig(id);
    } catch { toast({ title: "Failed to load config", variant: "destructive" }); }
  };

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-5 font-mono">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-widest uppercase text-primary">Device Manager</h1>
          <p className="text-xs text-primary/40 mt-0.5">Manage WireGuard configs for all your devices</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/40 px-2 py-1.5 transition-colors">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} /> REFRESH
          </button>
          <button onClick={() => setAdding(!adding)}
            className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-black bg-primary hover:bg-primary/80 px-3 py-1.5 transition-colors">
            <Plus className="w-3 h-3" /> ADD DEVICE
          </button>
        </div>
      </div>

      {adding && (
        <Card className="bg-black border-primary/30">
          <CardContent className="p-4 space-y-3">
            <div className="text-[9px] tracking-widest text-primary/40 uppercase mb-3">New Device</div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[9px] text-primary/40 block mb-1">DEVICE NAME</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="My iPhone"
                  className="w-full bg-black border border-primary/30 text-primary font-mono text-xs px-2 py-1.5 focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="text-[9px] text-primary/40 block mb-1">PLATFORM</label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as DeviceType }))}
                  className="w-full bg-black border border-primary/30 text-primary font-mono text-xs px-2 py-1.5 focus:outline-none focus:border-primary"
                >
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] text-primary/40 block mb-1">PUBLIC KEY (optional)</label>
                <input
                  value={form.publicKey}
                  onChange={e => setForm(f => ({ ...f, publicKey: e.target.value }))}
                  placeholder="Leave blank to fill later"
                  className="w-full bg-black border border-primary/30 text-primary font-mono text-xs px-2 py-1.5 focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={addDevice}
                className="text-[9px] uppercase tracking-widest text-black bg-primary hover:bg-primary/80 px-3 py-1.5 transition-colors">
                ADD DEVICE
              </button>
              <button onClick={() => setAdding(false)}
                className="text-[9px] uppercase tracking-widest text-primary/60 hover:text-primary border border-primary/20 px-3 py-1.5 transition-colors">
                CANCEL
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {devices.length === 0 && loaded && (
        <div className="border border-primary/10 p-8 text-center">
          <p className="text-xs text-primary/30 font-mono">No devices added yet. Click ADD DEVICE to create a WireGuard config for your phone, TV, or computer.</p>
        </div>
      )}

      <div className="space-y-2">
        {devices.map(device => {
          const Icon = TYPE_ICONS[device.type] ?? Globe;
          const cfg = configs[device.id];
          const isExpanded = expandedConfig === device.id;
          const isQrOpen = showQr === device.id;

          return (
            <Card key={device.id} className="bg-black border-primary/20">
              <CardContent className="p-3">
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4 text-primary/50 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-primary">{device.name}</span>
                      <span className={`text-[8px] border px-1 ${STATUS_COLORS[device.status]}`}>{device.status.toUpperCase()}</span>
                      <span className="text-[8px] text-primary/30">{TYPE_LABELS[device.type]}</span>
                    </div>
                    <div className="text-[9px] text-primary/40 mt-0.5">
                      IP: {device.assignedIp} · Added: {new Date(device.createdAt).toLocaleDateString()}
                      {device.lastSeen && ` · Last seen: ${new Date(device.lastSeen).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => loadConfig(device.id)}
                      className="flex items-center gap-1 text-[9px] uppercase text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/40 px-2 py-1 transition-colors">
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      CONFIG
                    </button>
                    {cfg && (
                      <button onClick={() => setShowQr(isQrOpen ? null : device.id)}
                        className="flex items-center gap-1 text-[9px] uppercase text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/40 px-2 py-1 transition-colors">
                        <QrCode className="w-3 h-3" />
                      </button>
                    )}
                    <button onClick={() => deleteDevice(device.id, device.name)}
                      className="text-[9px] text-red-400/60 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 px-2 py-1 transition-colors">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {isExpanded && cfg && (
                  <div className="mt-3 space-y-3 border-t border-primary/10 pt-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-primary/40 uppercase tracking-widest">Client Config (save as .conf)</span>
                        <button onClick={() => copy(cfg.clientConfig, `cfg-${device.id}`)}
                          className="flex items-center gap-1 text-[9px] text-primary/50 hover:text-primary">
                          {copied === `cfg-${device.id}` ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copied === `cfg-${device.id}` ? "COPIED" : "COPY"}
                        </button>
                      </div>
                      <pre className="bg-primary/5 border border-primary/10 p-2 text-[9px] text-primary/70 overflow-x-auto whitespace-pre font-mono leading-relaxed">
                        {cfg.clientConfig}
                      </pre>
                    </div>
                    {cfg.serverPeerSnippet && !cfg.serverPeerSnippet.startsWith("#") && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-primary/40 uppercase tracking-widest">Server Peer Snippet (add to wg0.conf on server)</span>
                          <button onClick={() => copy(cfg.serverPeerSnippet, `peer-${device.id}`)}
                            className="flex items-center gap-1 text-[9px] text-primary/50 hover:text-primary">
                            {copied === `peer-${device.id}` ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            {copied === `peer-${device.id}` ? "COPIED" : "COPY"}
                          </button>
                        </div>
                        <pre className="bg-primary/5 border border-primary/10 p-2 text-[9px] text-primary/70 overflow-x-auto whitespace-pre font-mono">
                          {cfg.serverPeerSnippet}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {isQrOpen && cfg && (
                  <div className="mt-3 border-t border-primary/10 pt-3 flex flex-col items-center gap-2">
                    <p className="text-[9px] text-primary/40 uppercase tracking-widest">Scan with WireGuard mobile app</p>
                    <div className="bg-white p-3 inline-block">
                      <QRCode value={cfg.clientConfig} size={160} />
                    </div>
                    <p className="text-[9px] text-primary/30">WireGuard app → + → Scan QR Code</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
