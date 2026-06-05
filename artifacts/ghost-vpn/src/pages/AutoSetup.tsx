// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Auto-setup page: triggered after sign-in from the Windows installer.
// Automatically downloads all server configs — no manual steps required.
import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/react";
import { Shield, CheckCircle, Loader2, RefreshCw, Monitor } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Stage = "auth" | "fetching" | "done" | "error";

export default function AutoSetup() {
  const { user, isLoaded } = useUser();
  const [stage, setStage] = useState<Stage>("auth");
  const [errorMsg, setErrorMsg] = useState("");
  const [retrying, setRetrying] = useState(false);
  const didRun = useRef(false);

  const params = new URLSearchParams(window.location.search);
  const tunnelMode = params.get("tunnelmode") ?? "split";
  const hostname = params.get("hostname") ?? "";

  async function doDownload() {
    setStage("fetching");
    setErrorMsg("");
    try {
      const res = await fetch(`${BASE}/api/wireguard/all-configs-zip`, {
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "proxhqvpn-all-servers.zip";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 2000);
      setStage("done");
    } catch (e: any) {
      setErrorMsg(e.message ?? "Download failed");
      setStage("error");
    }
  }

  useEffect(() => {
    if (!isLoaded || !user || didRun.current) return;
    didRun.current = true;
    // Small delay so the page renders before triggering download
    setTimeout(doDownload, 800);
  }, [isLoaded, user]);

  const handleRetry = async () => {
    setRetrying(true);
    await doDownload();
    setRetrying(false);
  };

  return (
    <div className="min-h-screen bg-[#040a06] flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="flex items-center gap-3 mb-10">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-primary font-bold text-lg leading-tight">ProxhqVPN</div>
            <div className="text-white/40 text-xs">ALPHA UNLIMITED TECHNOLOGIES LLC</div>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-8 text-center">

          {/* Icon ring */}
          <div className={`w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center transition-all duration-500 ${
            stage === "done"
              ? "bg-primary/10 border-2 border-primary/40 shadow-[0_0_40px_rgba(0,255,136,0.2)]"
              : stage === "error"
                ? "bg-red-500/10 border-2 border-red-500/30"
                : "bg-primary/[0.06] border-2 border-primary/20"
          }`}>
            {stage === "done" ? (
              <CheckCircle className="w-10 h-10 text-primary" />
            ) : stage === "error" ? (
              <Shield className="w-10 h-10 text-red-400" />
            ) : (
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
            )}
          </div>

          {/* Stage-specific content */}
          {stage === "auth" && (
            <>
              <div className="text-xl font-bold text-white mb-2">Signing you in…</div>
              <div className="text-sm text-white/50 leading-relaxed">
                Verifying your account before setting up your tunnels.
              </div>
            </>
          )}

          {stage === "fetching" && (
            <>
              <div className="text-xl font-bold text-white mb-2">Setting Up Your VPN</div>
              <div className="text-sm text-white/50 leading-relaxed mb-6">
                Generating your personal configs for all 4 servers and packaging them for your device…
              </div>
              {/* Progress steps */}
              <div className="text-left space-y-3">
                {[
                  { label: "Los Angeles, US", done: true },
                  { label: "Chicago, US", done: true },
                  { label: "London, GB", done: true },
                  { label: "Tokyo, JP", done: true },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                    </div>
                    <span className="text-sm text-white/60">{s.label}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {stage === "done" && (
            <>
              <div className="text-xl font-bold text-primary mb-2">All Servers Ready!</div>
              <div className="text-sm text-white/60 leading-relaxed mb-6">
                <span className="font-mono text-primary/80">proxhqvpn-all-servers.zip</span> has been downloaded.<br />
                Your installer is detecting it now and will finish automatically.
              </div>

              <div className="bg-[#040a06] border border-primary/10 rounded-xl p-4 text-left space-y-2 mb-6">
                {[
                  { flag: "🇺🇸", label: "Los Angeles, US" },
                  { flag: "🇺🇸", label: "Chicago, US" },
                  { flag: "🇬🇧", label: "London, GB" },
                  { flag: "🇯🇵", label: "Tokyo, JP" },
                ].map((s, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm text-white/70">
                    <span>{s.flag}</span>
                    <span>{s.label}</span>
                    <CheckCircle className="w-3.5 h-3.5 text-primary ml-auto" />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 text-xs text-white/35 justify-center">
                <Monitor className="w-3.5 h-3.5" />
                Your installer is finishing up — you can close this window.
              </div>
            </>
          )}

          {stage === "error" && (
            <>
              <div className="text-xl font-bold text-white mb-2">Download Failed</div>
              <div className="text-sm text-red-400/80 mb-6 font-mono text-xs">{errorMsg}</div>
              <button
                onClick={handleRetry}
                disabled={retrying}
                className="w-full py-3 rounded-xl bg-primary text-black font-semibold text-sm flex items-center justify-center gap-2 hover:brightness-110 transition-all disabled:opacity-50"
              >
                {retrying
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Retrying…</>
                  : <><RefreshCw className="w-4 h-4" /> Try Again</>
                }
              </button>
            </>
          )}
        </div>

        {/* Tunnel mode / hostname info */}
        <div className="mt-4 flex items-center justify-center gap-4 text-xs text-white/25">
          {hostname && <span>Device: {hostname}</span>}
          <span>Mode: {tunnelMode === "split" ? "Split Tunnel" : "Full Tunnel"}</span>
        </div>
      </div>
    </div>
  );
}
