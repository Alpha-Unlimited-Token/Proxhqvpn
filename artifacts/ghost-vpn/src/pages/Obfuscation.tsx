import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Eye, EyeOff, RefreshCw, Copy, CheckCheck, ExternalLink, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type ObfsMode = "none" | "obfs4" | "shadowsocks" | "v2ray-ws" | "meek" | "snowflake" | "xor-pad";

interface ModeInfo { id: ObfsMode; name: string; description: string; antiDpi: boolean; difficulty: string }
interface ObfsConfig {
  mode: ObfsMode; enabled: boolean; listenPort: number;
  upstreamHost: string; upstreamPort: number;
  password: string; method: string; wsPath: string; iatMode: number;
  modeInfo: ModeInfo;
}
interface ServerConfig { mode: ObfsMode; serverConfig: any; dockerCompose: string; dpiBypassLevel: string; recommendation: string }
interface DpiTool { name: string; platform: string; url: string; description: string }

const DIFFICULTY_COLORS: Record<string, string> = {
  none: "text-primary/40", easy: "text-green-400", moderate: "text-yellow-400", advanced: "text-red-400",
};

const METHODS = ["chacha20-ietf-poly1305","aes-256-gcm","aes-128-gcm","xchacha20-ietf-poly1305"];

export default function Obfuscation() {
  const { toast } = useToast();
  const [config, setConfig]       = useState<ObfsConfig | null>(null);
  const [modes, setModes]         = useState<ModeInfo[]>([]);
  const [genConfig, setGenConfig] = useState<ServerConfig | null>(null);
  const [dpiGuide, setDpiGuide]   = useState<{ tools: DpiTool[]; steps: string[] } | null>(null);
  const [copied, setCopied]       = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [rotating, setRotating]   = useState(false);
  const [localConfig, setLocalConfig] = useState<Partial<ObfsConfig>>({});

  const load = useCallback(async () => {
    const [cfgR, modesR, guideR] = await Promise.allSettled([
      fetch(`${BASE}/api/obfuscation/config`).then(r => r.json()),
      fetch(`${BASE}/api/obfuscation/modes`).then(r => r.json()),
      fetch(`${BASE}/api/obfuscation/dpi-test-guide`).then(r => r.json()),
    ]);
    if (cfgR.status === "fulfilled") { setConfig(cfgR.value); setLocalConfig(cfgR.value); }
    if (modesR.status === "fulfilled") setModes(modesR.value.modes ?? []);
    if (guideR.status === "fulfilled") setDpiGuide(guideR.value);
  }, []);

  const loadGenConfig = useCallback(async () => {
    const r = await fetch(`${BASE}/api/obfuscation/generate-server-config`);
    setGenConfig(await r.json());
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (config) loadGenConfig(); }, [config, loadGenConfig]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${BASE}/api/obfuscation/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(localConfig),
      });
      const d = await r.json();
      setConfig(d); setLocalConfig(d);
      await loadGenConfig();
      toast({ title: "Obfuscation config saved" });
    } finally { setSaving(false); }
  };

  const rotatePassword = async () => {
    setRotating(true);
    try {
      const r = await fetch(`${BASE}/api/obfuscation/rotate-password`, { method: "POST" });
      const d = await r.json();
      setLocalConfig(lc => ({ ...lc, password: d.password }));
      toast({ title: "Password rotated" });
    } finally { setRotating(false); }
  };

  const copy = async (text: string, key: string) => {
    await navigator.clipboard.writeText(typeof text === "object" ? JSON.stringify(text, null, 2) : text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const isEnabled = config?.enabled ?? false;
  const currentMode = (localConfig.mode ?? config?.mode) as ObfsMode | undefined;

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="border border-primary/10 bg-black/20 rounded-sm px-3 py-2.5 flex items-center justify-between flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
            {isEnabled ? <EyeOff className="w-5 h-5 text-primary" /> : <Eye className="w-5 h-5 text-red-400" />}
            Traffic Obfuscation
          </h2>
          {config?.modeInfo && (
            <Badge variant="outline" className={`font-mono text-xs ${config.modeInfo.antiDpi ? "text-primary border-primary/50" : "text-yellow-400 border-yellow-400/50"}`}>
              {config.modeInfo.antiDpi ? "DPI BYPASS ACTIVE" : "DPI VISIBLE"}
            </Badge>
          )}
          {config?.mode !== "none" && (
            <Badge variant="outline" className="text-primary/50 border-primary/20 font-mono text-xs">
              {config?.modeInfo?.name}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-primary/50">ENABLED</span>
          <Switch
            checked={isEnabled}
            onCheckedChange={(v) => setLocalConfig(lc => ({ ...lc, enabled: v }))}
          />
        </div>
      </div>

      {genConfig && (
        <div className={`border rounded-sm px-4 py-2.5 flex items-center gap-3 text-xs font-mono ${genConfig.dpiBypassLevel === "high" ? "border-primary/30 bg-primary/5 text-primary" : "border-yellow-500/30 bg-yellow-900/10 text-yellow-400"}`}>
          <Zap className="w-4 h-4 flex-shrink-0" />
          <span>{genConfig.recommendation}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="flex flex-col gap-4">
          <Card className="bg-black border-primary/20">
            <CardContent className="p-4 space-y-2">
              <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 pb-2 border-b border-primary/10">
                Select Mode
              </div>
              {modes.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setLocalConfig(lc => ({ ...lc, mode: m.id }))}
                  className={`w-full text-left px-3 py-2 border rounded-sm transition-all text-[10px] font-mono ${currentMode === m.id ? "border-primary/60 bg-primary/10" : "border-primary/10 hover:border-primary/30 hover:bg-primary/5"}`}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className={`font-bold ${currentMode === m.id ? "text-primary" : "text-primary/70"}`}>{m.name}</span>
                    <div className="flex items-center gap-1">
                      {m.antiDpi && <Badge variant="outline" className="text-[8px] text-primary border-primary/40 px-1">DPI-BYPASS</Badge>}
                      <span className={`text-[8px] ${DIFFICULTY_COLORS[m.difficulty]}`}>{m.difficulty}</span>
                    </div>
                  </div>
                  <p className="text-primary/40 leading-relaxed">{m.description}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card className="bg-black border-primary/20">
            <CardContent className="p-4 space-y-3">
              <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 pb-2 border-b border-primary/10">
                Connection Settings
              </div>
              <div className="space-y-2 text-[10px] font-mono">
                <div className="flex items-center gap-2">
                  <span className="text-primary/50 w-24 flex-shrink-0">LISTEN PORT</span>
                  <Input value={localConfig.listenPort ?? ""} onChange={e => setLocalConfig(lc => ({ ...lc, listenPort: parseInt(e.target.value)||8388 }))}
                    type="number" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-7 flex-1" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-primary/50 w-24 flex-shrink-0">UPSTREAM</span>
                  <Input value={localConfig.upstreamHost ?? ""} onChange={e => setLocalConfig(lc => ({ ...lc, upstreamHost: e.target.value }))}
                    placeholder="host" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-7 flex-1" />
                  <Input value={localConfig.upstreamPort ?? ""} onChange={e => setLocalConfig(lc => ({ ...lc, upstreamPort: parseInt(e.target.value)||51820 }))}
                    type="number" placeholder="port" className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-7 w-20" />
                </div>
                {currentMode === "shadowsocks" && (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-primary/50 w-24 flex-shrink-0">PASSWORD</span>
                      <Input value={localConfig.password ?? ""} onChange={e => setLocalConfig(lc => ({ ...lc, password: e.target.value }))}
                        className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-7 flex-1" />
                      <button onClick={rotatePassword} disabled={rotating} className="text-primary/50 hover:text-primary flex-shrink-0">
                        <RefreshCw className={`w-3 h-3 ${rotating ? "animate-spin" : ""}`} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-primary/50 w-24 flex-shrink-0">METHOD</span>
                      <select value={localConfig.method ?? "chacha20-ietf-poly1305"}
                        onChange={e => setLocalConfig(lc => ({ ...lc, method: e.target.value }))}
                        className="border border-primary/20 bg-black text-primary font-mono text-[10px] h-7 flex-1 px-2 rounded-none">
                        {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </>
                )}
                {currentMode === "v2ray-ws" && (
                  <div className="flex items-center gap-2">
                    <span className="text-primary/50 w-24 flex-shrink-0">WS PATH</span>
                    <Input value={localConfig.wsPath ?? ""} onChange={e => setLocalConfig(lc => ({ ...lc, wsPath: e.target.value }))}
                      className="border-primary/20 bg-black/50 text-primary font-mono text-xs h-7 flex-1" />
                  </div>
                )}
                {currentMode === "obfs4" && (
                  <div className="flex items-center gap-2">
                    <span className="text-primary/50 w-24 flex-shrink-0">IAT MODE</span>
                    <div className="flex border border-primary/20 text-[9px] font-mono">
                      {[0,1,2].map(i => (
                        <button key={i} onClick={() => setLocalConfig(lc => ({ ...lc, iatMode: i }))}
                          className={`px-3 py-1 ${localConfig.iatMode === i ? "bg-primary text-black" : "text-primary/60 hover:text-primary"}`}>{i}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <Button onClick={save} disabled={saving} className="w-full h-8 text-xs font-mono bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 mt-2" variant="outline">
                {saving ? "SAVING..." : "SAVE CONFIG"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          {genConfig && (
            <Card className="bg-black border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-primary/10">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-primary/50">Server Config</span>
                  <button onClick={() => copy(JSON.stringify(genConfig.serverConfig?.content ?? genConfig.serverConfig, null, 2), "server")}
                    className="text-[9px] font-mono text-primary/50 hover:text-primary flex items-center gap-1">
                    {copied === "server" ? <><CheckCheck className="w-3 h-3" /> Copied</> : <><Copy className="w-3 h-3" /> Copy</>}
                  </button>
                </div>
                <pre className="text-[8.5px] font-mono text-primary/70 bg-black/60 border border-primary/10 rounded p-2 overflow-x-auto max-h-48 whitespace-pre-wrap">
                  {JSON.stringify(genConfig.serverConfig?.content ?? genConfig.serverConfig, null, 2)}
                </pre>
              </CardContent>
            </Card>
          )}

          {dpiGuide && (
            <Card className="bg-black border-primary/20">
              <CardContent className="p-4 space-y-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-primary/50 pb-2 border-b border-primary/10">
                  DPI Test Tools
                </div>
                <div className="space-y-2">
                  {dpiGuide.tools.map((t, i) => (
                    <div key={i} className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-primary">{t.name}</span>
                          <Badge variant="outline" className="text-[8px] font-mono text-primary/40 border-primary/20">{t.platform}</Badge>
                        </div>
                        <p className="text-[9px] font-mono text-primary/40">{t.description}</p>
                      </div>
                      <a href={t.url} target="_blank" rel="noopener noreferrer" className="text-primary/40 hover:text-primary flex-shrink-0">
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
