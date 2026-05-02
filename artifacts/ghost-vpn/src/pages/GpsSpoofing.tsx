// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Power, Trash2, Loader2, Globe } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

export default function GpsSpoofing() {
  const { toast } = useToast();
  const [status, setStatus] = useState<any>(null);
  const [presets, setPresets] = useState<any[]>([]);
  const [lat, setLat] = useState("40.7128");
  const [lng, setLng] = useState("-74.0060");
  const [customCity, setCustomCity] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadStatus() {
    const r = await fetch(`${BASE}/api/gps-spoof/status`);
    const d = await r.json();
    setStatus(d);
  }

  async function loadPresets() {
    const r = await fetch(`${BASE}/api/gps-spoof/presets`);
    const d = await r.json();
    setPresets(d.presets ?? []);
  }

  useEffect(() => { loadStatus(); loadPresets(); }, []);

  async function applyPreset(idx: number) {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/gps-spoof/preset/${idx}`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setStatus({ enabled: true, profile: d.profile });
      toast({ title: `GPS spoofed to ${d.profile.city}` });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  async function applyCustom() {
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    if (isNaN(latitude) || isNaN(longitude)) return toast({ title: "Invalid coordinates", variant: "destructive" });
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/gps-spoof/set`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude, longitude, city: customCity || "Custom", country: "XX" }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setStatus({ enabled: true, profile: d.profile });
      toast({ title: "Custom GPS location set" });
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  async function clear() {
    setLoading(true);
    try {
      await fetch(`${BASE}/api/gps-spoof/clear`, { method: "DELETE" });
      setStatus({ enabled: false, profile: null });
      toast({ title: "GPS spoofing disabled — real location restored" });
    } catch { /* ignore */ } finally { setLoading(false); }
  }

  const profile = status?.profile;

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-mono">
      <div>
        <h1 className="text-xl font-bold text-primary tracking-tight">GPS Spoofing</h1>
        <p className="text-xs text-white/40 mt-1">Override your GPS location to any city in the world — matches Surfshark Override</p>
      </div>

      {/* Status card */}
      <Card className={`border ${status?.enabled ? "border-primary/30 bg-primary/5" : "border-white/10 bg-black/30"}`}>
        <CardContent className="p-4 flex items-center gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${status?.enabled ? "bg-primary/20" : "bg-white/5"}`}>
            <MapPin className={`w-5 h-5 ${status?.enabled ? "text-primary" : "text-white/30"}`} />
          </div>
          <div className="flex-1">
            {status?.enabled && profile ? (
              <>
                <div className="text-sm font-semibold text-white">{profile.city}, {profile.country}</div>
                <div className="text-[11px] text-white/40 font-mono">{profile.latitude.toFixed(6)}, {profile.longitude.toFixed(6)} · Accuracy ±{profile.accuracy}m</div>
              </>
            ) : (
              <>
                <div className="text-sm font-semibold text-white/50">GPS Spoofing Inactive</div>
                <div className="text-[11px] text-white/30">Your real GPS location is being used</div>
              </>
            )}
          </div>
          {status?.enabled && (
            <Button variant="outline" size="sm" onClick={clear} disabled={loading}
              className="border-red-500/30 text-red-400 hover:bg-red-900/20 text-xs">
              <Trash2 className="w-3.5 h-3.5 mr-1" /> Disable
            </Button>
          )}
          <Badge className={`text-[10px] ${status?.enabled ? "bg-primary/20 text-primary border-primary/30" : "bg-white/5 text-white/30 border-white/10"} border`}>
            {status?.enabled ? "ACTIVE" : "INACTIVE"}
          </Badge>
        </CardContent>
      </Card>

      {/* City presets */}
      <Card className="bg-black/40 border-primary/15">
        <CardContent className="p-4">
          <div className="text-[10px] uppercase tracking-widest text-white/40 mb-4">Quick Select — City Presets</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
            {presets.map((p, idx) => (
              <button key={p.city} onClick={() => applyPreset(idx)} disabled={loading}
                className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all text-center group ${
                  profile?.city === p.city ? "border-primary/50 bg-primary/10" : "border-white/10 bg-black/30 hover:border-primary/30 hover:bg-primary/5"
                }`}>
                <Globe className={`w-4 h-4 ${profile?.city === p.city ? "text-primary" : "text-white/40 group-hover:text-primary/60"}`} />
                <span className="text-[11px] font-semibold text-white/80">{p.city}</span>
                <span className="text-[9px] text-white/30">{p.country}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom coordinates */}
      <Card className="bg-black/40 border-primary/15">
        <CardContent className="p-4 space-y-3">
          <div className="text-[10px] uppercase tracking-widest text-white/40">Custom Coordinates</div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Latitude</label>
              <Input value={lat} onChange={e => setLat(e.target.value)}
                className="bg-black/60 border-primary/20 text-primary text-sm font-mono" placeholder="-90 to 90" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Longitude</label>
              <Input value={lng} onChange={e => setLng(e.target.value)}
                className="bg-black/60 border-primary/20 text-primary text-sm font-mono" placeholder="-180 to 180" />
            </div>
            <div>
              <label className="text-[10px] text-white/30 mb-1 block">Label (optional)</label>
              <Input value={customCity} onChange={e => setCustomCity(e.target.value)}
                className="bg-black/60 border-primary/20 text-primary text-sm font-mono" placeholder="My Location" />
            </div>
          </div>
          <Button onClick={applyCustom} disabled={loading} className="bg-primary text-black font-bold hover:bg-primary/85">
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <MapPin className="w-4 h-4 mr-1" />}
            Set Custom Location
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
