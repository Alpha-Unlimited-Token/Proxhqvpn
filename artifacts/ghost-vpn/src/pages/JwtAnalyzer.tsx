import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Key, AlertTriangle, CheckCircle, Copy, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const SAMPLE_JWT =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

const SEV_COLOR: Record<string, string> = {
  critical: "bg-red-900/20 border-red-500/30 text-red-400",
  high:     "bg-orange-900/20 border-orange-400/30 text-orange-400",
  medium:   "bg-yellow-900/20 border-yellow-400/30 text-yellow-400",
  low:      "bg-blue-900/20 border-blue-400/30 text-blue-400",
  info:     "bg-primary/5 border-primary/20 text-primary/60",
};

function JsonView({ data }: { data: any }) {
  return (
    <pre className="text-[11px] text-primary/80 whitespace-pre-wrap break-all font-mono bg-black/40 rounded p-3 border border-primary/10 overflow-auto max-h-48">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

export default function JwtAnalyzer() {
  const { toast } = useToast();
  const [token, setToken] = useState(SAMPLE_JWT);
  const [secret, setSecret] = useState("");
  const [jwksUrl, setJwksUrl] = useState("https://attacker.com/.well-known/jwks.json");
  const [x5uUrl, setX5uUrl] = useState("https://attacker.com/attacker.crt");
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [activeOp, setActiveOp] = useState<string>("");

  async function call(op: string, extra: Record<string, any> = {}) {
    if (!token.trim()) return;
    setLoading(op);
    setActiveOp(op);
    setResult(null);
    try {
      const res = await fetch(`${BASE}/api/jwt-analyzer/${op}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      setResult(data);
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setLoading(null);
    }
  }

  function copyToken() {
    navigator.clipboard.writeText(token).then(() => toast({ title: "Copied" }));
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-mono">
      <div>
        <h1 className="text-xl font-bold text-primary tracking-tight">JWT Analyzer</h1>
        <p className="text-xs text-white/40 mt-1">Decode, exploit alg:none, brute-force HMAC secrets, key confusion attacks</p>
      </div>

      {/* Token input */}
      <Card className="bg-black/40 border-primary/15">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] uppercase tracking-widest text-white/40">JWT Token</label>
            <button onClick={copyToken} className="flex items-center gap-1 text-[10px] text-primary/50 hover:text-primary transition-colors">
              <Copy className="w-3 h-3" /> Copy
            </button>
          </div>
          <textarea
            value={token}
            onChange={e => setToken(e.target.value)}
            rows={4}
            placeholder="Paste JWT token here…"
            className="w-full bg-black/60 border border-primary/20 text-primary text-[11px] font-mono rounded-lg p-3 resize-none focus:outline-none focus:border-primary/50 placeholder:text-white/20"
          />
          <button onClick={() => setToken(SAMPLE_JWT)} className="text-[10px] text-primary/40 hover:text-primary/60 transition-colors">
            Load sample JWT
          </button>

          {/* Secret for signing/confusion */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-white/40 mb-1 block">HMAC Secret (for sign/key-confusion)</label>
            <input
              value={secret}
              onChange={e => setSecret(e.target.value)}
              placeholder="your-256-bit-secret"
              className="w-full bg-black/60 border border-primary/20 text-primary text-sm font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50 placeholder:text-white/20"
            />
          </div>

          {/* JWKS/X5U URL inputs (shown for relevant attacks) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-white/40 mb-1 block">JWKS URL (jku injection)</label>
              <input value={jwksUrl} onChange={e => setJwksUrl(e.target.value)}
                className="w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50 placeholder:text-white/20"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-white/40 mb-1 block">X5U URL (x5u injection)</label>
              <input value={x5uUrl} onChange={e => setX5uUrl(e.target.value)}
                className="w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono rounded-lg px-3 py-2 focus:outline-none focus:border-primary/50 placeholder:text-white/20"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Analysis</div>
            <div className="flex flex-wrap gap-2">
              {[
                { op: "decode",        label: "Decode", extra: {} },
                { op: "crack",         label: "Crack Secret", extra: {} },
              ].map(({ op, label, extra }) => (
                <Button key={op} variant="outline" size="sm"
                  className={`text-xs border-primary/25 text-primary/80 hover:bg-primary/10 font-mono ${activeOp === op && result ? "border-primary/50 bg-primary/10" : ""}`}
                  onClick={() => call(op, extra)} disabled={!!loading}>
                  {loading === op ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}{label}
                </Button>
              ))}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-white/30 mb-1 mt-2">Forgery Attacks</div>
            <div className="flex flex-wrap gap-2">
              {[
                { op: "alg-none",      label: "Alg:None", extra: {} },
                { op: "key-confusion", label: "Key Confusion", extra: { publicKey: secret } },
                { op: "embedded-jwk",  label: "Embedded JWK", extra: {} },
                { op: "jwks-inject",   label: "JWKS Injection (jku)", extra: { jwksUrl } },
                { op: "x5u-inject",    label: "X5U Injection", extra: { x5uUrl } },
                { op: "kid-injection", label: "kid SQL/Path Inject", extra: {} },
                { op: "claim-escalate",label: "Claim Escalation", extra: {} },
                { op: "sign",          label: "Re-sign", extra: { secret } },
              ].map(({ op, label, extra }) => (
                <Button key={op} variant="outline" size="sm"
                  className={`text-xs border-orange-500/25 text-orange-400/80 hover:bg-orange-500/10 font-mono ${activeOp === op && result ? "border-orange-500/50 bg-orange-500/10" : ""}`}
                  onClick={() => call(op, extra)} disabled={!!loading}>
                  {loading === op ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}{label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card className="bg-black/40 border-primary/15">
          <CardContent className="p-4 space-y-4">
            <div className="text-[10px] uppercase tracking-widest text-white/40">
              {activeOp === "decode" ? "Token Decoded" :
               activeOp === "alg-none" ? "Alg:None Attack" :
               activeOp === "crack" ? "HMAC Secret Crack" :
               activeOp === "key-confusion" ? "Key Confusion Attack" : "Re-signed Token"}
            </div>

            {/* Decode result */}
            {activeOp === "decode" && result.header && (
              <div className="space-y-3">
                <div>
                  <div className="text-[9px] text-white/30 uppercase mb-1">Header</div>
                  <JsonView data={result.header} />
                </div>
                <div>
                  <div className="text-[9px] text-white/30 uppercase mb-1">Payload</div>
                  <JsonView data={result.payload} />
                </div>
                {result.expiry && (
                  <div className={`text-xs px-3 py-2 rounded border ${result.expiry.expired ? "bg-red-900/20 border-red-500/30 text-red-400" : "bg-green-900/20 border-green-500/20 text-green-400"}`}>
                    {result.expiry.expired ? "⚠ Token EXPIRED" : "✓ Token not expired"} — {result.expiry.label}
                  </div>
                )}
                {result.issues?.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[9px] text-white/30 uppercase">Issues Detected</div>
                    {result.issues.map((iss: any, i: number) => (
                      <div key={i} className={`flex items-start gap-2 p-2 rounded border text-xs ${SEV_COLOR[iss.severity]}`}>
                        <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold">{iss.title}</span>
                          <span className="opacity-70 ml-2">{iss.detail}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Alg-none result */}
            {activeOp === "alg-none" && (
              <div className="space-y-2">
                <div className={`flex items-center gap-2 p-3 rounded border text-sm font-semibold ${result.vulnerable ? "bg-red-900/20 border-red-500/30 text-red-400" : "bg-green-900/20 border-green-500/20 text-green-400"}`}>
                  {result.vulnerable ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  {result.vulnerable ? "Potentially vulnerable to alg:none attack" : "Not immediately exploitable via alg:none"}
                </div>
                {result.variants?.map((v: any, i: number) => (
                  <div key={i} className="space-y-1">
                    <div className="text-[9px] text-white/30 uppercase">{v.label}</div>
                    <pre className="text-[10px] text-primary/60 bg-black/40 p-2 rounded border border-primary/10 break-all whitespace-pre-wrap font-mono">{v.token}</pre>
                  </div>
                ))}
              </div>
            )}

            {/* Crack result */}
            {activeOp === "crack" && (
              <div className="space-y-2">
                <div className={`flex items-center gap-2 p-3 rounded border text-sm font-semibold ${result.cracked ? "bg-red-900/20 border-red-500/30 text-red-400" : "bg-green-900/20 border-green-500/20 text-green-400"}`}>
                  {result.cracked ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                  {result.cracked ? `Secret found: "${result.secret}"` : "Secret not in common wordlist"}
                </div>
                <div className="text-xs text-white/40">Tested {result.tested} common secrets</div>
              </div>
            )}

            {/* Key confusion result */}
            {activeOp === "key-confusion" && (
              <div className="space-y-2">
                {result.error ? (
                  <div className="text-xs text-red-400 p-2 bg-red-900/10 border border-red-500/20 rounded">{result.error}</div>
                ) : (
                  <>
                    <div className="text-[9px] text-white/30 uppercase mb-1">Forged Token (RSA public key used as HMAC secret)</div>
                    <pre className="text-[10px] text-primary/60 bg-black/40 p-2 rounded border border-primary/10 break-all whitespace-pre-wrap font-mono">{result.forgedToken}</pre>
                    <div className="text-xs text-orange-400/80 p-2 bg-orange-900/10 border border-orange-400/15 rounded">{result.note}</div>
                  </>
                )}
              </div>
            )}

            {/* Sign result */}
            {activeOp === "sign" && (
              <div className="space-y-2">
                {result.error ? (
                  <div className="text-xs text-red-400 p-2 bg-red-900/10 border border-red-500/20 rounded">{result.error}</div>
                ) : (
                  <>
                    <div className="text-[9px] text-white/30 uppercase mb-1">Re-signed Token ({result.algorithm})</div>
                    <pre className="text-[10px] text-primary/60 bg-black/40 p-2 rounded border border-primary/10 break-all whitespace-pre-wrap font-mono">{result.token}</pre>
                  </>
                )}
              </div>
            )}

            {/* Generic advanced attack renderer */}
            {["jwks-inject","embedded-jwk","kid-injection","claim-escalate","x5u-inject"].includes(activeOp) && (
              <div className="space-y-3">
                {result.description && (
                  <div className="text-xs text-orange-300/80 p-3 bg-orange-900/10 border border-orange-400/20 rounded leading-relaxed">
                    {result.description}
                  </div>
                )}
                {result.forgedToken && (
                  <div>
                    <div className="text-[9px] text-white/30 uppercase mb-1">Forged Token</div>
                    <pre className="text-[10px] text-primary/60 bg-black/40 p-2 rounded border border-primary/10 break-all whitespace-pre-wrap font-mono cursor-pointer select-all"
                      onClick={() => navigator.clipboard.writeText(result.forgedToken).then(() => toast({ title: "Token copied" }))}>
                      {result.forgedToken}
                    </pre>
                  </div>
                )}
                {result.results && (
                  <div className="space-y-2">
                    {result.results.map((r: any, i: number) => (
                      <div key={i} className="border border-primary/10 rounded p-2 space-y-1">
                        <div className="text-[9px] font-bold text-orange-400 uppercase">{r.label}</div>
                        <div className="text-[9px] text-white/30">kid: <span className="text-primary/60 font-mono">{r.kid}</span></div>
                        <pre className="text-[9px] text-primary/50 bg-black/40 p-1.5 rounded break-all whitespace-pre-wrap font-mono">{r.forgedToken}</pre>
                      </div>
                    ))}
                  </div>
                )}
                {result.escalatedClaims && (
                  <div>
                    <div className="text-[9px] text-white/30 uppercase mb-1">Escalated Claims</div>
                    <JsonView data={result.escalatedClaims} />
                  </div>
                )}
                {result.exampleJwks && (
                  <div>
                    <div className="text-[9px] text-white/30 uppercase mb-1">Example JWKS to Host</div>
                    <JsonView data={result.exampleJwks} />
                  </div>
                )}
                {(result.step1 || result.step2 || result.step3) && (
                  <div className="space-y-1 text-xs text-primary/50">
                    {result.step1 && <div>① {result.step1}</div>}
                    {result.step2 && <div>② {result.step2}</div>}
                    {result.step3 && <div>③ {result.step3}</div>}
                  </div>
                )}
                {result.warning && (
                  <div className="text-[9px] text-yellow-400/60 italic">{result.warning}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
