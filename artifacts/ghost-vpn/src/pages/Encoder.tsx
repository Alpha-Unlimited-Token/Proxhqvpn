import React, { useState, useCallback } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

type Mode = "encode" | "decode";

interface Transform {
  key: string;
  label: string;
  encode: (s: string) => string;
  decode: (s: string) => string;
}

function safeB64Decode(s: string): string {
  try { return atob(s.trim()); } catch { return "[Invalid Base64]"; }
}

function hexEncode(s: string): string {
  return Array.from(new TextEncoder().encode(s)).map(b => b.toString(16).padStart(2, "0")).join(" ");
}

function hexDecode(s: string): string {
  try {
    const bytes = s.trim().replace(/\s+/g, "").match(/.{2}/g) ?? [];
    return new TextDecoder().decode(new Uint8Array(bytes.map(b => parseInt(b, 16))));
  } catch { return "[Invalid Hex]"; }
}

function htmlEntityEncode(s: string): string {
  return s.replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#x27;" }[c]!));
}

function htmlEntityDecode(s: string): string {
  const ta = document.createElement("textarea");
  ta.innerHTML = s;
  return ta.value;
}

function decodeJWT(s: string): string {
  try {
    const parts = s.trim().split(".");
    if (parts.length !== 3) return "[Not a valid JWT — expected 3 parts]";
    const pad = (t: string) => t + "=".repeat((4 - t.length % 4) % 4);
    const header  = JSON.parse(atob(pad(parts[0].replace(/-/g, "+").replace(/_/g, "/"))));
    const payload = JSON.parse(atob(pad(parts[1].replace(/-/g, "+").replace(/_/g, "/"))));
    return `HEADER:\n${JSON.stringify(header, null, 2)}\n\nPAYLOAD:\n${JSON.stringify(payload, null, 2)}\n\nSIGNATURE (base64url):\n${parts[2]}`;
  } catch { return "[Invalid JWT]"; }
}

async function sha(algo: string, s: string): Promise<string> {
  const buf = await crypto.subtle.digest(algo, new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

const TRANSFORMS: Transform[] = [
  {
    key: "url",
    label: "URL",
    encode: s => encodeURIComponent(s),
    decode: s => { try { return decodeURIComponent(s); } catch { return "[Invalid URL encoding]"; } },
  },
  {
    key: "base64",
    label: "Base64",
    encode: s => btoa(unescape(encodeURIComponent(s))),
    decode: s => safeB64Decode(s),
  },
  {
    key: "base64url",
    label: "Base64 URL",
    encode: s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
    decode: s => safeB64Decode(s.replace(/-/g, "+").replace(/_/g, "/")),
  },
  {
    key: "html",
    label: "HTML Entity",
    encode: htmlEntityEncode,
    decode: htmlEntityDecode,
  },
  {
    key: "hex",
    label: "Hex",
    encode: hexEncode,
    decode: hexDecode,
  },
  {
    key: "unicode",
    label: "Unicode Escape",
    encode: s => Array.from(s).map(c => `\\u${c.codePointAt(0)!.toString(16).padStart(4, "0")}`).join(""),
    decode: s => { try { return JSON.parse(`"${s}"`); } catch { return "[Invalid Unicode escape]"; } },
  },
];

const HASH_ALGOS = [
  { key: "SHA-1",   label: "SHA-1"   },
  { key: "SHA-256", label: "SHA-256" },
  { key: "SHA-384", label: "SHA-384" },
  { key: "SHA-512", label: "SHA-512" },
];

export default function Encoder() {
  const [input, setInput]         = usePersistedState<string>("encoder-input", "");
  const [output, setOutput]       = useState("");
  const [mode, setMode]           = usePersistedState<Mode>("encoder-mode", "encode");
  const [transform, setTransform] = useState("url");
  const [hashAlgo, setHashAlgo]   = useState("SHA-256");
  const [hashOut, setHashOut]     = useState("");
  const [jwtOut, setJwtOut]       = useState("");
  const [copied, setCopied]       = useState<"output"|"hash"|null>(null);

  const run = useCallback(() => {
    const t = TRANSFORMS.find(x => x.key === transform);
    if (!t) return;
    setOutput(mode === "encode" ? t.encode(input) : t.decode(input));
  }, [input, mode, transform]);

  const runHash = useCallback(async () => {
    setHashOut(await sha(hashAlgo, input));
  }, [input, hashAlgo]);

  const runJWT = useCallback(() => {
    setJwtOut(decodeJWT(input));
  }, [input]);

  const copy = (text: string, target: "output"|"hash") => {
    navigator.clipboard.writeText(text);
    setCopied(target);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Data Encoder / Decoder</h1>
        <p className="text-white/60 text-sm mt-1">
          URL · Base64 · HTML Entity · Hex · Unicode · JWT · SHA hashes — Burp Suite Decoder equivalent
        </p>
      </div>

      {/* Input */}
      <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 space-y-3">
        <label className="block text-xs font-semibold text-white/60 uppercase tracking-widest">Input</label>
        <textarea
          className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-sm text-white/90 font-mono resize-none focus:outline-none focus:border-primary/40 h-32"
          placeholder="Paste any string here…"
          value={input}
          onChange={e => setInput(e.target.value)}
        />
      </div>

      {/* Encode / Decode transforms */}
      <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">Transform</span>
          <div className="flex gap-1 bg-black/30 rounded-lg p-0.5">
            {(["encode","decode"] as Mode[]).map(m => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`px-3 py-1 rounded-md text-xs font-semibold capitalize transition-colors ${
                  mode === m ? "bg-primary text-black" : "text-white/60 hover:text-white"
                }`}
              >{m}</button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {TRANSFORMS.map(t => (
            <button
              key={t.key}
              onClick={() => setTransform(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                transform === t.key
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white hover:border-white/20"
              }`}
            >{t.label}</button>
          ))}
        </div>

        <button
          onClick={run}
          className="px-5 py-2 bg-primary text-black text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors"
        >
          {mode === "encode" ? "Encode →" : "Decode →"}
        </button>

        {output && (
          <div className="relative">
            <div className="bg-black/40 border border-white/10 rounded-lg p-3 font-mono text-sm text-green-400 whitespace-pre-wrap break-all">{output}</div>
            <button
              onClick={() => copy(output, "output")}
              className="absolute top-2 right-2 text-xs text-white/40 hover:text-white/70 bg-black/40 px-2 py-0.5 rounded transition-colors"
            >{copied === "output" ? "Copied!" : "Copy"}</button>
          </div>
        )}
      </div>

      {/* Hash */}
      <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 space-y-4">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">Hash Generator</span>
        <div className="flex flex-wrap gap-2">
          {HASH_ALGOS.map(a => (
            <button
              key={a.key}
              onClick={() => setHashAlgo(a.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                hashAlgo === a.key
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white hover:border-white/20"
              }`}
            >{a.label}</button>
          ))}
        </div>
        <button onClick={runHash} className="px-5 py-2 bg-primary text-black text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors">
          Generate Hash
        </button>
        {hashOut && (
          <div className="relative">
            <div className="bg-black/40 border border-white/10 rounded-lg p-3 font-mono text-sm text-yellow-400 break-all">{hashOut}</div>
            <button
              onClick={() => copy(hashOut, "hash")}
              className="absolute top-2 right-2 text-xs text-white/40 hover:text-white/70 bg-black/40 px-2 py-0.5 rounded transition-colors"
            >{copied === "hash" ? "Copied!" : "Copy"}</button>
          </div>
        )}
      </div>

      {/* JWT Decoder */}
      <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 space-y-4">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-widest">JWT Inspector</span>
        <p className="text-xs text-white/40">Paste a JWT into the input above, then click Inspect.</p>
        <button onClick={runJWT} className="px-5 py-2 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-500 transition-colors">
          Inspect JWT
        </button>
        {jwtOut && (
          <div className="bg-black/40 border border-purple-500/20 rounded-lg p-3 font-mono text-sm text-purple-300 whitespace-pre">{jwtOut}</div>
        )}
      </div>
    </div>
  );
}
