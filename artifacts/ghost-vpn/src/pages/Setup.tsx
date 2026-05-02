// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useRef } from "react";
import { CheckCircle, XCircle, Loader, Zap, RefreshCw, Shield, Package, Upload, Link, Trash2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface Dep {
  name: string;
  label: string;
  installed: boolean;
  version?: string;
  purpose: string;
}

interface StatusResponse {
  allInstalled: boolean;
  readyForProduction: boolean;
  dependencies: Dep[];
}

interface InstallEvent {
  step: string;
  name?: string;
  message: string;
  dependencies?: Dep[];
  allInstalled?: boolean;
}

type Platform = "win" | "mac" | "linux";

interface VersionEntry {
  version: string;
  releaseDate: string;
  filename: string;
  storedLocally: boolean;
  size: number;
}

interface VersionsConfig {
  win?: VersionEntry;
  mac?: VersionEntry;
  linux?: VersionEntry;
}

const PLATFORMS: { id: Platform; label: string; ext: string; yml: string }[] = [
  { id: "win",   label: "Windows",  ext: ".exe",      yml: "latest.yml" },
  { id: "mac",   label: "macOS",    ext: ".dmg/.pkg", yml: "latest-mac.yml" },
  { id: "linux", label: "Linux",    ext: ".AppImage/.deb/.rpm", yml: "latest-linux.yml" },
];

export default function Setup() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [log, setLog] = useState<InstallEvent[]>([]);
  const [done, setDone] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Software updates state
  const [versions, setVersions] = useState<VersionsConfig>({});
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [publishMode, setPublishMode] = useState<"upload" | "url">("upload");
  const [publishPlatform, setPublishPlatform] = useState<Platform>("win");
  const [publishVersion, setPublishVersion] = useState("");
  const [publishUrl, setPublishUrl] = useState("");
  const [publishSha512, setPublishSha512] = useState("");
  const [publishSize, setPublishSize] = useState("");
  const [publishFile, setPublishFile] = useState<File | null>(null);
  const [publishing, setPublishing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadStatus() {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/setup/status`);
      const d: StatusResponse = await r.json();
      setStatus(d);
    } catch {
      toast({ title: "Status check failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadStatus(); loadVersions(); }, []);

  async function loadVersions() {
    setVersionsLoading(true);
    try {
      const r = await fetch(`${BASE}/api/updates/admin/versions`);
      const d: VersionsConfig = await r.json();
      setVersions(d);
    } catch {
      // silently fail — update server might not have any versions yet
    } finally {
      setVersionsLoading(false);
    }
  }

  async function publishUpload() {
    if (!publishVersion.trim() || !publishFile) {
      toast({ title: "Version number and file are required", variant: "destructive" });
      return;
    }
    setPublishing(true);
    try {
      const form = new FormData();
      form.append("version", publishVersion.trim());
      form.append("platform", publishPlatform);
      form.append("installer", publishFile);
      const r = await fetch(`${BASE}/api/updates/publish/upload`, { method: "POST", body: form });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: `v${publishVersion} published for ${publishPlatform}`, description: "All users will auto-update within 4 hours." });
      setPublishVersion("");
      setPublishFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadVersions();
    } catch (e: any) {
      toast({ title: "Publish failed", description: e.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  }

  async function publishExternalUrl() {
    if (!publishVersion.trim() || !publishUrl.trim() || !publishSha512.trim()) {
      toast({ title: "Version, URL, and SHA512 are required", variant: "destructive" });
      return;
    }
    setPublishing(true);
    try {
      const r = await fetch(`${BASE}/api/updates/publish/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          version: publishVersion.trim(),
          platform: publishPlatform,
          url: publishUrl.trim(),
          sha512: publishSha512.trim(),
          size: Number(publishSize) || 0,
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      toast({ title: `v${publishVersion} published for ${publishPlatform}`, description: "All users will auto-update within 4 hours." });
      setPublishVersion("");
      setPublishUrl("");
      setPublishSha512("");
      setPublishSize("");
      loadVersions();
    } catch (e: any) {
      toast({ title: "Publish failed", description: e.message, variant: "destructive" });
    } finally {
      setPublishing(false);
    }
  }

  async function deleteVersion(platform: Platform) {
    try {
      await fetch(`${BASE}/api/updates/admin/${platform}`, { method: "DELETE" });
      toast({ title: `${platform} update removed` });
      loadVersions();
    } catch {
      toast({ title: "Delete failed", variant: "destructive" });
    }
  }

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  async function runInstall() {
    setInstalling(true);
    setLog([]);
    setDone(false);

    try {
      const r = await fetch(`${BASE}/api/setup/install`, { method: "POST" });
      const reader = r.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error("No response stream");

      let buffer = "";
      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event: InstallEvent = JSON.parse(line.slice(6));
              setLog((prev) => [...prev, event]);
              if (event.step === "complete") {
                setDone(true);
                if (event.dependencies) {
                  setStatus({
                    allInstalled: event.allInstalled ?? false,
                    readyForProduction: event.allInstalled ?? false,
                    dependencies: event.dependencies,
                  });
                }
              }
            } catch {}
          }
        }
      }
    } catch (e: any) {
      toast({ title: "Install error", description: e.message, variant: "destructive" });
    } finally {
      setInstalling(false);
    }
  }

  const stepColor: Record<string, string> = {
    start:      "text-cyan-400",
    progress:   "text-primary/60",
    info:       "text-primary/50",
    installing: "text-yellow-400",
    done:       "text-green-400",
    skip:       "text-primary/40",
    service:    "text-cyan-400/70",
    config:     "text-primary/60",
    warn:       "text-yellow-400/70",
    error:      "text-red-400",
    complete:   "text-green-400",
  };

  const stepPrefix: Record<string, string> = {
    start:      "▶",
    progress:   "·",
    info:       "·",
    installing: "⟳",
    done:       "✓",
    skip:       "–",
    service:    "⚙",
    config:     "⚙",
    warn:       "⚠",
    error:      "✗",
    complete:   "✓",
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div className="border border-primary/10 bg-black/20 rounded-sm px-3 py-2.5 flex items-center justify-between flex-wrap gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <Package className="w-5 h-5 text-cyan-400" />
            Auto-Installer
          </h2>
          {status && (
            <span className={`text-xs font-mono px-2 py-0.5 border uppercase ${
              status.allInstalled
                ? "text-green-400 border-green-400/40"
                : "text-yellow-400 border-yellow-400/40"
            }`}>
              {status.allInstalled ? "FULLY INSTALLED" : "PARTIAL"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadStatus}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 border border-primary/20 text-primary/60 hover:text-primary hover:border-primary/40 transition-colors uppercase"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            CHECK STATUS
          </button>
          <button
            onClick={runInstall}
            disabled={installing}
            className="flex items-center gap-1.5 text-xs font-mono px-4 py-1.5 border border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10 transition-colors uppercase disabled:opacity-40"
          >
            {installing ? (
              <><Loader className="w-3 h-3 animate-spin" /> INSTALLING…</>
            ) : (
              <><Zap className="w-3 h-3" /> AUTO-INSTALL ALL</>
            )}
          </button>
        </div>
      </div>

      <div className="text-xs font-mono text-primary/40 border border-primary/10 bg-black/20 px-3 py-2">
        All VPN dependencies are installed automatically when ProxhqVPN starts. This page lets you
        check status and trigger a manual install if needed. Users never need to install anything manually.
      </div>

      {/* Dependency Status Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-primary/30 font-mono text-xs gap-3">
          <Loader className="w-4 h-4 animate-spin" />
          <span>Checking installed components...</span>
        </div>
      ) : status ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {status.dependencies.map((dep) => (
            <div key={dep.name} className={`border p-3 space-y-2 bg-black/20 ${
              dep.installed ? "border-green-400/20" : "border-yellow-400/20"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Shield className={`w-3.5 h-3.5 ${dep.installed ? "text-green-400" : "text-yellow-400"}`} />
                  <span className="text-sm font-mono font-bold text-primary">{dep.label}</span>
                </div>
                {dep.installed ? (
                  <CheckCircle className="w-4 h-4 text-green-400" />
                ) : (
                  <XCircle className="w-4 h-4 text-yellow-400/70" />
                )}
              </div>
              <div className="text-[10px] font-mono text-primary/40 leading-relaxed">{dep.purpose}</div>
              {dep.version && (
                <div className="text-[9px] font-mono text-primary/30 truncate">{dep.version}</div>
              )}
              <div className={`text-[9px] font-mono uppercase tracking-wider ${
                dep.installed ? "text-green-400/70" : "text-yellow-400/60"
              }`}>
                {dep.installed ? "INSTALLED" : "WILL BE AUTO-INSTALLED"}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Install Log */}
      {log.length > 0 && (
        <div className="border border-primary/10 bg-black rounded-sm">
          <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10">
            <span className="text-[10px] font-mono text-primary/40 uppercase tracking-widest">Install Log</span>
            {done && (
              <span className="text-[10px] font-mono text-green-400 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> COMPLETE
              </span>
            )}
          </div>
          <div ref={logRef} className="p-3 max-h-72 overflow-y-auto space-y-0.5">
            {log.map((evt, i) => (
              <div key={i} className={`text-[10px] font-mono ${stepColor[evt.step] ?? "text-primary/50"}`}>
                <span className="mr-2 opacity-60">{stepPrefix[evt.step] ?? "·"}</span>
                {evt.name ? <span className="mr-1 opacity-80">[{evt.name}]</span> : null}
                {evt.message}
              </div>
            ))}
            {installing && (
              <div className="text-[10px] font-mono text-yellow-400/60 flex items-center gap-1 mt-1">
                <Loader className="w-2.5 h-2.5 animate-spin" /> Running...
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Software Updates ────────────────────────────────────────────── */}
      <div className="border border-cyan-400/20 bg-black/20 rounded-sm overflow-hidden mt-2">
        <div className="px-3 py-2.5 border-b border-cyan-400/10 flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-bold font-mono uppercase tracking-tight flex items-center gap-2 text-cyan-400">
            <Download className="w-4 h-4" />
            Desktop App Updates
          </h3>
          <button
            onClick={loadVersions}
            disabled={versionsLoading}
            className="text-[10px] font-mono px-2 py-1 border border-primary/20 text-primary/50 hover:text-primary hover:border-primary/40 flex items-center gap-1 uppercase"
          >
            <RefreshCw className={`w-3 h-3 ${versionsLoading ? "animate-spin" : ""}`} />
            REFRESH
          </button>
        </div>

        <div className="p-3 text-[10px] font-mono text-primary/40 border-b border-primary/10">
          When you publish a new version here, all installed desktop apps silently download and install the
          update automatically within 4 hours — no action needed from users.
          <span className="text-green-400 ml-1">Web app updates are always instant automatically.</span>
        </div>

        {/* Current published versions */}
        <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-primary/10">
          {PLATFORMS.map((p) => {
            const entry = versions[p.id];
            return (
              <div key={p.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-primary/50 uppercase tracking-widest">{p.label}</span>
                  {entry && (
                    <button
                      onClick={() => deleteVersion(p.id)}
                      className="text-red-400/60 hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                {entry ? (
                  <div className="space-y-0.5">
                    <div className="text-sm font-mono font-bold text-green-400">v{entry.version}</div>
                    <div className="text-[9px] font-mono text-primary/30">{entry.releaseDate}</div>
                    <div className="text-[9px] font-mono text-primary/30 truncate">{entry.filename}</div>
                    <div className="text-[9px] font-mono text-primary/30">
                      {entry.storedLocally ? "Hosted on server" : "External URL"} · {(entry.size / 1024 / 1024).toFixed(1)} MB
                    </div>
                    <div className="text-[9px] font-mono text-cyan-400/60">LIVE — users auto-updating</div>
                  </div>
                ) : (
                  <div className="text-[9px] font-mono text-primary/30 italic">No version published</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Publish new version */}
        <div className="border-t border-primary/10 p-3 space-y-3">
          <div className="text-[10px] font-mono text-primary/50 uppercase tracking-widest">Publish New Version</div>

          {/* Mode toggle */}
          <div className="flex gap-1">
            {(["upload", "url"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setPublishMode(m)}
                className={`text-[10px] font-mono px-3 py-1 border uppercase flex items-center gap-1.5 transition-colors ${
                  publishMode === m
                    ? "border-cyan-400/50 text-cyan-400 bg-cyan-400/5"
                    : "border-primary/20 text-primary/40 hover:text-primary/60"
                }`}
              >
                {m === "upload" ? <Upload className="w-3 h-3" /> : <Link className="w-3 h-3" />}
                {m === "upload" ? "Upload File" : "External URL"}
              </button>
            ))}
          </div>

          {/* Common fields */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-primary/40 uppercase">Platform</label>
              <select
                value={publishPlatform}
                onChange={(e) => setPublishPlatform(e.target.value as Platform)}
                className="w-full bg-black border border-primary/20 text-primary text-[10px] font-mono px-2 py-1.5 focus:outline-none focus:border-cyan-400/50"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.id} value={p.id}>{p.label} ({p.ext})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-primary/40 uppercase">Version Number</label>
              <input
                type="text"
                placeholder="e.g. 1.0.2"
                value={publishVersion}
                onChange={(e) => setPublishVersion(e.target.value)}
                className="w-full bg-black border border-primary/20 text-primary text-[10px] font-mono px-2 py-1.5 focus:outline-none focus:border-cyan-400/50 placeholder-primary/20"
              />
            </div>
          </div>

          {publishMode === "upload" ? (
            <div className="space-y-1">
              <label className="text-[9px] font-mono text-primary/40 uppercase">Installer File ({PLATFORMS.find(p => p.id === publishPlatform)?.ext})</label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".exe,.dmg,.pkg,.AppImage,.deb,.rpm"
                onChange={(e) => setPublishFile(e.target.files?.[0] ?? null)}
                className="w-full bg-black border border-primary/20 text-primary text-[10px] font-mono px-2 py-1.5 focus:outline-none focus:border-cyan-400/50 file:bg-black file:border-0 file:text-cyan-400 file:font-mono file:text-[10px] file:mr-2 file:cursor-pointer"
              />
              {publishFile && (
                <div className="text-[9px] font-mono text-primary/30">
                  {publishFile.name} · {(publishFile.size / 1024 / 1024).toFixed(1)} MB
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-primary/40 uppercase">Download URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={publishUrl}
                  onChange={(e) => setPublishUrl(e.target.value)}
                  className="w-full bg-black border border-primary/20 text-primary text-[10px] font-mono px-2 py-1.5 focus:outline-none focus:border-cyan-400/50 placeholder-primary/20"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-primary/40 uppercase">SHA512 Hash (base64)</label>
                  <input
                    type="text"
                    placeholder="from electron-builder output"
                    value={publishSha512}
                    onChange={(e) => setPublishSha512(e.target.value)}
                    className="w-full bg-black border border-primary/20 text-primary text-[10px] font-mono px-2 py-1.5 focus:outline-none focus:border-cyan-400/50 placeholder-primary/20"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-primary/40 uppercase">File Size (bytes)</label>
                  <input
                    type="number"
                    placeholder="optional"
                    value={publishSize}
                    onChange={(e) => setPublishSize(e.target.value)}
                    className="w-full bg-black border border-primary/20 text-primary text-[10px] font-mono px-2 py-1.5 focus:outline-none focus:border-cyan-400/50 placeholder-primary/20"
                  />
                </div>
              </div>
            </div>
          )}

          <button
            onClick={publishMode === "upload" ? publishUpload : publishExternalUrl}
            disabled={publishing}
            className="flex items-center gap-1.5 text-[10px] font-mono px-4 py-2 border border-cyan-400/50 text-cyan-400 hover:bg-cyan-400/10 transition-colors uppercase disabled:opacity-40"
          >
            {publishing ? (
              <><Loader className="w-3 h-3 animate-spin" /> PUBLISHING…</>
            ) : (
              <><Upload className="w-3 h-3" /> PUBLISH UPDATE — ALL USERS AUTO-UPDATE</>
            )}
          </button>
        </div>
      </div>

      {/* What gets installed */}
      <div className="border border-primary/10 bg-black/20 p-4 space-y-3">
        <div className="text-[10px] font-mono uppercase tracking-widest text-primary/40">What Auto-Install Covers</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            {
              title: "OpenVPN",
              desc: "Required for VPNGate double-hop and Ghost Chain relay connections. Installed server-side — users never install this.",
            },
            {
              title: "Proxychains4",
              desc: "Enables Ghost Chain multi-veil routing. Configured automatically with the Tor SOCKS proxy. No user action needed.",
            },
            {
              title: "WireGuard Tools",
              desc: "Server-side WireGuard management. Subscriber client apps are pre-built — they just scan a QR code.",
            },
            {
              title: "Tor Daemon",
              desc: "Starts automatically on port 9050 at server boot. Powers Ghost Chain Mask 1 (Tor Veil). Zero user config.",
            },
            {
              title: "iptables",
              desc: "Kill switch and firewall rules applied server-side. Toggled from the dashboard — no user commands needed.",
            },
            {
              title: "Proxychains Config",
              desc: "Ghost Chain proxychains4.conf is written to /etc/proxychains4.conf automatically. One-click activation in UI.",
            },
          ].map(({ title, desc }) => (
            <div key={title} className="flex gap-2">
              <CheckCircle className="w-3.5 h-3.5 text-green-400/60 shrink-0 mt-0.5" />
              <div>
                <div className="text-[10px] font-mono text-primary font-bold">{title}</div>
                <div className="text-[9px] font-mono text-primary/40 leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
