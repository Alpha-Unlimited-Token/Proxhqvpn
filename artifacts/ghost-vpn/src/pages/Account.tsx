import { useState, useCallback } from "react";
import { useUser } from "@clerk/react";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import {
  Shield, Zap, CheckCircle, XCircle,
  CreditCard, ArrowRight, Wifi, Smartphone, Router, Monitor,
  RefreshCw, AlertCircle, ExternalLink, Lock, KeyRound, ShieldCheck, ShieldOff, Eye, EyeOff
} from "lucide-react";
import QRCode from "react-qr-code";
import { useWireGuardSubscription } from "@/hooks/useWireGuardSubscription";
import WireGuardModal from "@/components/WireGuardModal";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const QUICKLINKS = [
  { href: "/devices",      label: "Device Manager",   icon: Smartphone, desc: "Add devices & scan QR codes" },
  { href: "/router-config",label: "Router Config",    icon: Router,     desc: "Setup WireGuard on your router" },
  { href: "/smart-dns",    label: "Smart DNS",         icon: Wifi,       desc: "Configure TVs & consoles" },
  { href: "/platforms",    label: "All Platforms",     icon: Monitor,    desc: "Setup guides for every device" },
  { href: "/dns-shield",   label: "DNS Shield",        icon: Shield,     desc: "Block ads & trackers" },
];

function formatDate(ts: number) {
  return new Date(ts * 1000).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

type TotpStep = "idle" | "setup" | "verify" | "done" | "disabling";

function SecuritySection() {
  const { user } = useUser();
  const is2faEnabled = user?.twoFactorEnabled ?? false;

  const [step, setStep] = useState<TotpStep>("idle");
  const [totpUri, setTotpUri] = useState<string>("");
  const [totpSecret, setTotpSecret] = useState<string>("");
  const [code, setCode] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const startSetup = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      const totp = await user!.createTOTP();
      setTotpUri(totp.uri ?? "");
      setTotpSecret(totp.secret ?? "");
      setStep("setup");
    } catch (e: any) {
      setErr(e?.errors?.[0]?.message ?? e?.message ?? "Failed to start 2FA setup.");
    } finally {
      setBusy(false);
    }
  }, [user]);

  const verifyCode = useCallback(async () => {
    if (code.trim().length < 6) { setErr("Enter the 6-digit code from your authenticator app."); return; }
    setBusy(true);
    setErr(null);
    try {
      await user!.verifyTOTP({ code: code.trim() });
      await user!.reload();
      setStep("done");
      setCode("");
    } catch (e: any) {
      setErr(e?.errors?.[0]?.message ?? e?.message ?? "Invalid code. Please try again.");
    } finally {
      setBusy(false);
    }
  }, [user, code]);

  const disable2fa = useCallback(async () => {
    setBusy(true);
    setErr(null);
    try {
      await user!.disableTOTP();
      await user!.reload();
      setStep("idle");
      setTotpUri("");
      setTotpSecret("");
    } catch (e: any) {
      setErr(e?.errors?.[0]?.message ?? e?.message ?? "Failed to disable 2FA.");
    } finally {
      setBusy(false);
    }
  }, [user]);

  return (
    <Card className="bg-black border-primary/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <KeyRound className="w-4 h-4 text-primary/60" />
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Two-Factor Authentication</span>
          {is2faEnabled && step !== "disabling" && (
            <span className="ml-auto text-[8px] bg-green-900/30 border border-green-500/30 text-green-400 px-2 py-0.5">ENABLED</span>
          )}
          {!is2faEnabled && (
            <span className="ml-auto text-[8px] border border-primary/20 text-primary/30 px-2 py-0.5">DISABLED</span>
          )}
        </div>
        <p className="text-[8px] text-primary/40 leading-relaxed">
          Add a second layer of security. After enabling, you'll need a 6-digit code from your authenticator app every time you sign in.
        </p>

        {err && (
          <div className="flex items-center gap-1.5 text-[8px] text-red-400 border border-red-500/20 bg-red-900/10 px-2 py-1.5">
            <AlertCircle className="w-3 h-3 shrink-0" /> {err}
          </div>
        )}

        {/* Idle — not enabled */}
        {!is2faEnabled && step === "idle" && (
          <button
            onClick={startSetup}
            disabled={busy}
            className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-black bg-primary hover:bg-primary/80 px-4 py-2 transition-colors disabled:opacity-50"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            {busy ? "PREPARING..." : "ENABLE 2FA AUTHENTICATOR"}
          </button>
        )}

        {/* Step 1: Show QR code */}
        {step === "setup" && !is2faEnabled && (
          <div className="space-y-3">
            <div className="text-[8px] text-primary/50 leading-relaxed">
              <span className="text-primary/70 font-bold">Step 1.</span> Open <span className="text-primary">Google Authenticator</span>, <span className="text-primary">Authy</span>, or any TOTP app and scan this QR code:
            </div>
            <div className="flex justify-center py-3 bg-white p-3 w-fit mx-auto">
              {totpUri ? <QRCode value={totpUri} size={140} /> : <div className="w-[140px] h-[140px] bg-primary/5 animate-pulse" />}
            </div>
            <div className="text-[7px] text-primary/30 text-center">Can't scan? Use the manual key below</div>
            <div className="flex items-center gap-2 border border-primary/15 bg-primary/5 px-3 py-2">
              <code className="text-[8px] text-primary/60 flex-1 break-all font-mono">
                {showSecret ? totpSecret : "•".repeat(totpSecret.length)}
              </code>
              <button onClick={() => setShowSecret(v => !v)} className="text-primary/30 hover:text-primary shrink-0">
                {showSecret ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
            <div className="text-[8px] text-primary/50 leading-relaxed">
              <span className="text-primary/70 font-bold">Step 2.</span> Enter the 6-digit code your app shows now:
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={e => { setCode(e.target.value.replace(/\D/g, "")); setErr(null); }}
                placeholder="000000"
                className="flex-1 bg-black border border-primary/30 text-primary font-mono text-center text-lg tracking-[0.4em] px-3 py-2 focus:outline-none focus:border-primary placeholder:text-primary/20"
              />
              <button
                onClick={verifyCode}
                disabled={busy || code.length < 6}
                className="px-4 text-[9px] uppercase tracking-widest text-black bg-primary hover:bg-primary/80 transition-colors disabled:opacity-40"
              >
                {busy ? "..." : "VERIFY"}
              </button>
            </div>
            <button onClick={() => { setStep("idle"); setErr(null); setCode(""); }} className="text-[8px] text-primary/30 hover:text-primary/60 underline">
              Cancel setup
            </button>
          </div>
        )}

        {/* Step done — just enabled */}
        {step === "done" && is2faEnabled && (
          <div className="flex items-center gap-2 text-[9px] text-green-400 border border-green-500/20 bg-green-900/10 px-3 py-2">
            <CheckCircle className="w-3.5 h-3.5 shrink-0" />
            2FA is now active. Your account is secured with an authenticator app.
          </div>
        )}

        {/* Already enabled — option to disable */}
        {is2faEnabled && step !== "setup" && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[9px] text-green-400 border border-green-500/20 bg-green-900/10 px-3 py-2">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              Authenticator app 2FA is active on your account.
            </div>
            {step !== "disabling" ? (
              <button
                onClick={() => setStep("disabling")}
                className="flex items-center gap-2 text-[8px] uppercase tracking-widest text-primary/40 hover:text-red-400 border border-primary/15 hover:border-red-500/30 px-3 py-1.5 transition-colors"
              >
                <ShieldOff className="w-3 h-3" /> DISABLE 2FA
              </button>
            ) : (
              <div className="border border-red-500/20 bg-red-900/10 p-3 space-y-2">
                <div className="text-[8px] text-red-400">Disabling 2FA will make your account less secure. Are you sure?</div>
                <div className="flex gap-2">
                  <button onClick={disable2fa} disabled={busy} className="text-[8px] uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 px-3 py-1.5 transition-colors disabled:opacity-50">
                    {busy ? "DISABLING..." : "YES, DISABLE"}
                  </button>
                  <button onClick={() => { setStep("idle"); setErr(null); }} className="text-[8px] uppercase tracking-widest text-primary/50 border border-primary/20 px-3 py-1.5 hover:border-primary/40 transition-colors">
                    CANCEL
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Account() {
  const { user } = useUser();
  const { hasWireGuard, subscription, loading, error, refetch, openPortal, checkingOut } = useWireGuardSubscription();
  const [showModal, setShowModal] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);

  const handlePortal = async () => {
    setPortalLoading(true);
    await openPortal();
    setPortalLoading(false);
  };

  const periodEnd = subscription?.current_period_end ? formatDate(subscription.current_period_end) : null;

  return (
    <div className="space-y-5 font-mono max-w-3xl">
      <div>
        <h1 className="text-lg font-bold tracking-widest uppercase text-primary">Account</h1>
        <p className="text-xs text-primary/40 mt-0.5">Your ProxhqVPN subscription and add-on status</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="md:col-span-2 bg-black border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              {user?.imageUrl ? (
                <img src={user.imageUrl} alt="" className="w-10 h-10 rounded-full border border-primary/20" />
              ) : (
                <div className="w-10 h-10 border border-primary/30 flex items-center justify-center text-sm font-bold text-primary bg-primary/5">
                  {user?.firstName?.[0] ?? user?.emailAddresses?.[0]?.emailAddress?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-bold text-primary">{user?.fullName ?? "ProxhqVPN User"}</div>
                <div className="text-[9px] text-primary/40 mt-0.5 truncate">{user?.primaryEmailAddress?.emailAddress}</div>
                <div className="text-[8px] text-primary/20 mt-0.5">Member since {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-black border-primary/20">
          <CardContent className="p-4 flex flex-col justify-between h-full min-h-[80px]">
            <div className="text-[9px] text-primary/30 uppercase tracking-widest">VPN Access</div>
            <div className="flex items-center gap-1.5 mt-2">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-[10px] text-green-400 font-bold">ACTIVE</span>
            </div>
            <div className="text-[8px] text-primary/20 mt-1">ProxhqVPN core access</div>
          </CardContent>
        </Card>
      </div>

      <Card className={`bg-black border ${hasWireGuard ? "border-primary/30" : "border-primary/15"}`}>
        <CardContent className="p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-[9px] text-primary/40 animate-pulse">
              <RefreshCw className="w-3 h-3 animate-spin" /> Checking subscription...
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-[9px] text-yellow-400">
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{error}</span>
              <button onClick={refetch} className="underline hover:no-underline">Retry</button>
            </div>
          ) : hasWireGuard ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-primary">WireGuard Add-on</div>
                    <div className="text-[8px] text-primary/40">ProxhqVPN WireGuard Add-on</div>
                  </div>
                </div>
                <span className="text-[9px] bg-green-900/30 border border-green-500/40 text-green-400 px-2 py-0.5">
                  {subscription?.status?.toUpperCase() ?? "ACTIVE"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[9px]">
                {subscription?.cancel_at_period_end ? (
                  <div className="border border-yellow-500/20 p-2">
                    <div className="text-primary/30">CANCELS ON</div>
                    <div className="text-yellow-400 font-bold">{periodEnd ?? "—"}</div>
                  </div>
                ) : (
                  <div className="border border-primary/10 p-2">
                    <div className="text-primary/30">RENEWS ON</div>
                    <div className="text-primary font-bold">{periodEnd ?? "—"}</div>
                  </div>
                )}
                <div className="border border-primary/10 p-2">
                  <div className="text-primary/30">DEVICES</div>
                  <Link href="/devices" className="text-primary font-bold hover:underline">Manage →</Link>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <Link href="/devices"
                  className="flex flex-col items-center gap-1 border border-primary/15 hover:border-primary/40 p-2 text-center transition-colors">
                  <Smartphone className="w-4 h-4 text-primary/50" />
                  <span className="text-[8px] text-primary/50">DEVICE MGR</span>
                </Link>
                <Link href="/router-config"
                  className="flex flex-col items-center gap-1 border border-primary/15 hover:border-primary/40 p-2 text-center transition-colors">
                  <Router className="w-4 h-4 text-primary/50" />
                  <span className="text-[8px] text-primary/50">ROUTER CFG</span>
                </Link>
                <Link href="/wireguard"
                  className="flex flex-col items-center gap-1 border border-primary/15 hover:border-primary/40 p-2 text-center transition-colors">
                  <Wifi className="w-4 h-4 text-primary/50" />
                  <span className="text-[8px] text-primary/50">WG CONFIG</span>
                </Link>
              </div>

              <button
                onClick={handlePortal}
                disabled={portalLoading}
                className="flex items-center gap-2 text-[9px] uppercase tracking-widest text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/40 px-3 py-1.5 transition-colors"
              >
                <CreditCard className="w-3 h-3" />
                {portalLoading ? "OPENING..." : "MANAGE BILLING / CANCEL"}
                <ExternalLink className="w-3 h-3 ml-auto" />
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-primary/5 border border-primary/15 flex items-center justify-center">
                    <Zap className="w-4 h-4 text-primary/30" />
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-primary/60">WireGuard Add-on</div>
                    <div className="text-[8px] text-primary/30">Not activated</div>
                  </div>
                </div>
                <span className="text-[9px] border border-primary/15 text-primary/30 px-2 py-0.5">NOT ACTIVE</span>
              </div>

              <p className="text-[9px] text-primary/40 leading-relaxed">
                Unlock WireGuard on all your devices — auto-configure with a QR scan, protect your entire home network via your router, and manage all devices from one place. Starting at $5/mo.
              </p>

              <div className="grid grid-cols-3 gap-1 text-[8px] text-primary/30 mb-2">
                {["QR code setup", "Router configs", "All platforms", "DNS shield", "Kill switch", "AES-256-GCM"].map(f => (
                  <div key={f} className="flex items-center gap-1">
                    <XCircle className="w-2.5 h-2.5 text-primary/20 shrink-0" /> {f}
                  </div>
                ))}
              </div>

              <button
                onClick={() => setShowModal(true)}
                className="flex items-center justify-center gap-2 w-full text-[10px] uppercase tracking-[0.2em] font-bold text-black bg-primary hover:bg-primary/80 py-2.5 transition-colors"
              >
                <Lock className="w-3.5 h-3.5" />
                ACTIVATE WIREGUARD — FROM $5/MO
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {hasWireGuard && (
        <div>
          <div className="text-[9px] tracking-[0.25em] text-primary/30 uppercase mb-2">Quick Access</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {QUICKLINKS.map(({ href, label, icon: Icon, desc }) => (
              <Link key={href} href={href}
                className="flex items-center gap-3 border border-primary/15 hover:border-primary/40 p-3 transition-colors group">
                <Icon className="w-4 h-4 text-primary/40 group-hover:text-primary/70 shrink-0" />
                <div>
                  <div className="text-[9px] font-bold text-primary/60 group-hover:text-primary uppercase">{label}</div>
                  <div className="text-[8px] text-primary/25">{desc}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Security / 2FA */}
      <div>
        <div className="text-[9px] tracking-[0.25em] text-primary/30 uppercase mb-2">Security</div>
        <SecuritySection />
      </div>

      <WireGuardModal open={showModal} onClose={() => setShowModal(false)} />
    </div>
  );
}
