// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Loader2, Copy, Share2, Wifi, Monitor, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function Meshnet() {
  const { toast } = useToast();
  const [devices, setDevices] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [newName, setNewName] = useState("");
  const [newOs, setNewOs] = useState("Desktop");
  const [loading, setLoading] = useState(false);

  async function load() {
    const [d, i] = await Promise.all([
      fetch(`${BASE}/api/meshnet/devices`).then(r => r.json()),
      fetch(`${BASE}/api/meshnet/invites`).then(r => r.json()),
    ]);
    setDevices(d.devices ?? []);
    setInvites(d.invites ?? i.invites ?? []);
  }

  useEffect(() => { load(); }, []);

  async function addDevice() {
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/meshnet/device`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), os: newOs }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setDevices(prev => [...prev, d.device]);
      setNewName("");
      toast({ title: `${d.device.name} added to Meshnet` });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  async function removeDevice(id: string) {
    await fetch(`${BASE}/api/meshnet/device/${id}`, { method: "DELETE" });
    setDevices(prev => prev.filter(d => d.id !== id));
    toast({ title: "Device removed" });
  }

  async function toggleRouting(device: any) {
    const r = await fetch(`${BASE}/api/meshnet/device/${device.id}/routing`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allow: !device.allowTrafficRouting }),
    });
    const d = await r.json();
    setDevices(prev => prev.map(dev => dev.id === device.id ? d.device : dev));
  }

  async function createInvite() {
    const r = await fetch(`${BASE}/api/meshnet/invite`, { method: "POST" });
    const d = await r.json();
    if (r.ok) {
      setInvites(prev => [...prev, d.invite]);
      navigator.clipboard.writeText(d.link).catch(() => {});
      toast({ title: "Invite link copied to clipboard", description: d.link });
    }
  }

  const ownDevice = devices.find(d => d.isOwn);
  const peers = devices.filter(d => !d.isOwn);

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-mono">
      <div>
        <h1 className="text-xl font-bold text-primary tracking-tight">Meshnet</h1>
        <p className="text-xs text-white/40 mt-1">Private peer-to-peer encrypted mesh network — NordVPN Meshnet parity (up to 60 devices)</p>
      </div>

      {/* This device */}
      {ownDevice && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Monitor className="w-4.5 h-4.5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{ownDevice.name}</span>
                <Badge className="bg-primary/20 text-primary border-primary/30 border text-[9px]">THIS DEVICE</Badge>
                <Badge className="bg-green-900/20 text-green-400 border-green-500/20 border text-[9px]">ONLINE</Badge>
              </div>
              <div className="text-[11px] text-primary/60 font-mono mt-0.5">{ownDevice.vpnIp}</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] text-white/30 uppercase">Mesh Network</div>
              <div className="text-xs text-white/50">{devices.length}/60 devices</div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Peers */}
      <Card className="bg-black/40 border-primary/15">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Peer Devices ({peers.length})</div>
            <Button variant="outline" size="sm" onClick={createInvite}
              className="border-primary/30 text-primary/70 hover:bg-primary/10 text-xs">
              <Share2 className="w-3.5 h-3.5 mr-1" /> Invite Device
            </Button>
          </div>

          {/* Add peer form */}
          <div className="flex gap-2 mb-4 pb-4 border-b border-primary/10">
            <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Device name"
              className="flex-1 bg-black/60 border-primary/20 text-primary text-sm font-mono"
              onKeyDown={e => e.key === "Enter" && addDevice()} />
            <select value={newOs} onChange={e => setNewOs(e.target.value)}
              className="bg-black/60 border border-primary/20 text-primary text-sm font-mono rounded-lg px-2 focus:outline-none w-32">
              {["Desktop", "macOS", "Linux", "Android", "iOS", "Windows"].map(os => <option key={os}>{os}</option>)}
            </select>
            <Button onClick={addDevice} disabled={loading || !newName.trim()} className="bg-primary text-black font-bold">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </Button>
          </div>

          {peers.length === 0 ? (
            <div className="text-center text-white/30 text-sm py-4">No peer devices. Add one above or send an invite.</div>
          ) : (
            <div className="space-y-2">
              {peers.map(dev => (
                <div key={dev.id} className="flex items-center gap-3 p-3 bg-black/30 border border-primary/8 rounded-lg">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${dev.status === "online" ? "bg-green-400 animate-pulse" : "bg-white/20"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-white/80">{dev.name}</span>
                      <span className="text-[10px] text-white/30">{dev.os}</span>
                    </div>
                    <div className="text-[10px] text-primary/50 font-mono">{dev.vpnIp}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => toggleRouting(dev)}
                      className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${dev.allowTrafficRouting ? "border-primary/40 text-primary/80 bg-primary/10" : "border-white/10 text-white/30 hover:border-primary/20"}`}>
                      {dev.allowTrafficRouting ? "Routing: ON" : "Routing: OFF"}
                    </button>
                    <Badge className={`text-[9px] border ${dev.status === "online" ? "bg-green-900/20 border-green-500/20 text-green-400" : "bg-white/5 border-white/10 text-white/30"}`}>
                      {dev.status}
                    </Badge>
                    <button onClick={() => removeDevice(dev.id)} className="text-red-400/40 hover:text-red-400 transition-colors p-1">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pending invites */}
      {invites.length > 0 && (
        <Card className="bg-black/40 border-primary/15">
          <CardContent className="p-4">
            <div className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Pending Invites</div>
            <div className="space-y-2">
              {invites.map(inv => (
                <div key={inv.code} className="flex items-center gap-3 text-xs text-white/50">
                  <code className="font-mono text-primary/70 bg-primary/5 px-2 py-0.5 rounded">{inv.code}</code>
                  <span>Expires {new Date(inv.expiresAt).toLocaleString()}</span>
                  <Badge className={`ml-auto text-[9px] border ${inv.used ? "bg-white/5 border-white/10 text-white/30" : "bg-green-900/20 border-green-500/20 text-green-400"}`}>
                    {inv.used ? "Used" : "Pending"}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
