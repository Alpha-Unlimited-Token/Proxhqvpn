// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import React, { useState, useMemo } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

interface DiffSpan {
  text: string;
  type: "same" | "add" | "del";
}

function lineDiff(a: string, b: string): { left: DiffSpan[]; right: DiffSpan[] } {
  const la = a.split("\n");
  const lb = b.split("\n");
  const len = Math.max(la.length, lb.length);
  const left: DiffSpan[]  = [];
  const right: DiffSpan[] = [];
  for (let i = 0; i < len; i++) {
    const al = la[i] ?? "";
    const bl = lb[i] ?? "";
    if (al === bl) {
      left.push({ text: al, type: "same" });
      right.push({ text: bl, type: "same" });
    } else {
      left.push({ text: al, type: "del" });
      right.push({ text: bl, type: "add" });
    }
  }
  return { left, right };
}

function charDiff(a: string, b: string): { left: DiffSpan[]; right: DiffSpan[] } {
  const left: DiffSpan[]  = [];
  const right: DiffSpan[] = [];
  let i = 0, j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      const s = a[i]; i++; j++;
      left.push({ text: s, type: "same" });
      right.push({ text: s, type: "same" });
    } else {
      let advanced = false;
      if (i < a.length) { left.push({ text: a[i], type: "del" }); i++; advanced = true; }
      if (j < b.length) { right.push({ text: b[j], type: "add" }); j++; advanced = true; }
      if (!advanced) break;
    }
  }
  return { left, right };
}

function DiffPanel({ spans, side }: { spans: DiffSpan[]; side: "left"|"right" }) {
  return (
    <pre className="font-mono text-xs leading-5 whitespace-pre-wrap break-all text-white/80 h-full">
      {spans.map((s, i) => (
        <span
          key={i}
          className={
            s.type === "same" ? "" :
            s.type === "del"  ? "bg-red-900/50 text-red-300" :
                                "bg-green-900/50 text-green-300"
          }
        >{s.text}</span>
      ))}
    </pre>
  );
}

export default function Comparer() {
  const [left, setLeft]     = usePersistedState<string>("comparer-left", "");
  const [right, setRight]   = usePersistedState<string>("comparer-right", "");
  const [mode, setMode]     = usePersistedState<"line"|"char">("comparer-mode", "line");
  const [compared, setCompared] = useState(false);
  const [diff, setDiff]     = useState<{ left: DiffSpan[]; right: DiffSpan[] } | null>(null);

  const stats = useMemo(() => {
    if (!diff) return null;
    const dels  = diff.left.filter(s  => s.type === "del").length;
    const adds  = diff.right.filter(s => s.type === "add").length;
    const sames = diff.left.filter(s  => s.type === "same").length;
    return { dels, adds, sames };
  }, [diff]);

  function run() {
    const d = mode === "line" ? lineDiff(left, right) : charDiff(left, right);
    setDiff(d);
    setCompared(true);
  }

  function reset() {
    setDiff(null);
    setCompared(false);
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Request Comparer</h1>
        <p className="text-white/60 text-sm mt-1">
          Paste two HTTP responses, payloads, or any text blocks and see exactly what changed — Burp Suite Comparer equivalent
        </p>
      </div>

      {!compared ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { label: "Left (A)", value: left, set: setLeft, color: "red" },
              { label: "Right (B)", value: right, set: setRight, color: "green" },
            ].map(({ label, value, set, color }) => (
              <div key={label} className="bg-white/[0.04] border border-white/10 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-white/60 uppercase tracking-widest">{label}</label>
                  <span className={`text-xs text-white/30`}>{value.length} chars</span>
                </div>
                <textarea
                  className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-xs text-white/90 font-mono resize-none focus:outline-none focus:border-primary/40 h-72"
                  placeholder={`Paste ${label} here…`}
                  value={value}
                  onChange={e => set(e.target.value)}
                />
              </div>
            ))}
          </div>

          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex gap-1 bg-white/[0.04] border border-white/10 rounded-lg p-0.5">
              {(["line","char"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-4 py-1.5 rounded-md text-xs font-semibold capitalize transition-colors ${
                    mode === m ? "bg-primary text-black" : "text-white/60 hover:text-white"
                  }`}
                >{m === "line" ? "Line diff" : "Character diff"}</button>
              ))}
            </div>
            <button
              onClick={run}
              disabled={!left || !right}
              className="px-6 py-2 bg-primary text-black text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              Compare →
            </button>
          </div>
        </>
      ) : (
        <>
          {stats && (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex gap-3">
                <span className="text-xs font-semibold text-red-400 bg-red-900/20 px-2 py-1 rounded-lg">
                  − {stats.dels} removed
                </span>
                <span className="text-xs font-semibold text-green-400 bg-green-900/20 px-2 py-1 rounded-lg">
                  + {stats.adds} added
                </span>
                <span className="text-xs font-semibold text-white/40 bg-white/[0.04] px-2 py-1 rounded-lg">
                  = {stats.sames} unchanged
                </span>
              </div>
              <button onClick={reset} className="px-4 py-1.5 text-xs font-semibold border border-white/10 text-white/60 hover:text-white rounded-lg transition-colors">
                ← New Comparison
              </button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 overflow-auto max-h-[70vh]">
              <div className="text-xs font-semibold text-red-400/70 uppercase tracking-widest mb-3">A (Left)</div>
              {diff && <DiffPanel spans={diff.left} side="left" />}
            </div>
            <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 overflow-auto max-h-[70vh]">
              <div className="text-xs font-semibold text-green-400/70 uppercase tracking-widest mb-3">B (Right)</div>
              {diff && <DiffPanel spans={diff.right} side="right" />}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
