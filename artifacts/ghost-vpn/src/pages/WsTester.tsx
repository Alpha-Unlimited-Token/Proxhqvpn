import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plug, Send, Trash2, Loader2, Circle, DownloadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type MsgDir = "sent" | "received" | "info" | "error";

interface Msg {
  id: number;
  dir: MsgDir;
  text: string;
  ts: number;
}

const DIR_STYLE: Record<MsgDir, string> = {
  sent:     "text-primary/90 bg-primary/5 border-primary/20",
  received: "text-white/80 bg-black/30 border-white/10",
  info:     "text-blue-400/80 bg-blue-900/10 border-blue-400/20",
  error:    "text-red-400/80 bg-red-900/10 border-red-500/20",
};

const DIR_LABEL: Record<MsgDir, string> = {
  sent:     "→ SENT",
  received: "← RECV",
  info:     "ℹ INFO",
  error:    "✕ ERR",
};

let msgCounter = 0;

export default function WsTester() {
  const { toast } = useToast();
  const [wsUrl, setWsUrl] = useState("wss://echo.websocket.org");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msgInput, setMsgInput] = useState('{"action":"ping","data":"hello"}');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [customHeaders, setCustomHeaders] = useState("");
  const logsRef = useRef<HTMLDivElement>(null);

  function addMsg(dir: MsgDir, text: string) {
    setMessages(prev => [...prev, { id: ++msgCounter, dir, text, ts: Date.now() }]);
  }

  useEffect(() => {
    logsRef.current?.scrollTo({ top: logsRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  async function connect() {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (customHeaders.trim()) {
        customHeaders.split("\n").forEach(line => {
          const [k, ...v] = line.split(":");
          if (k && v.length) headers[k.trim()] = v.join(":").trim();
        });
      }
      const r = await fetch(`${BASE}/api/ws-tester/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: wsUrl, headers }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      setSessionId(d.sessionId);
      setConnected(true);
      setMessages([]);
      addMsg("info", `Connected to ${wsUrl} (session ${d.sessionId})`);
    } catch (e: any) {
      addMsg("error", e.message);
      toast({ title: "Connection failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function disconnect() {
    if (!sessionId) return;
    setLoading(true);
    try {
      await fetch(`${BASE}/api/ws-tester/disconnect/${sessionId}`, { method: "DELETE" });
    } catch { /* ignore */ } finally {
      setConnected(false);
      setSessionId(null);
      addMsg("info", "Disconnected");
      setLoading(false);
    }
  }

  async function sendMessage() {
    if (!sessionId || !msgInput.trim()) return;
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/ws-tester/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: msgInput }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      addMsg("sent", msgInput);
      if (d.response) addMsg("received", typeof d.response === "string" ? d.response : JSON.stringify(d.response, null, 2));
    } catch (e: any) {
      addMsg("error", e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fuzz() {
    if (!sessionId) return;
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/ws-tester/fuzz`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      addMsg("info", `Fuzz complete — ${d.payloadsSent} payloads sent, ${d.anomalies} anomalies detected`);
      d.results?.forEach((res: any) => {
        addMsg(res.anomaly ? "error" : "received", `[${res.payload.slice(0,30)}…] → ${res.response?.slice(0,80) ?? "timeout"}`);
      });
    } catch (e: any) {
      addMsg("error", e.message);
    } finally {
      setLoading(false);
    }
  }

  function clearLogs() {
    setMessages([]);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-mono">
      <div>
        <h1 className="text-xl font-bold text-primary tracking-tight">WebSocket Tester</h1>
        <p className="text-xs text-white/40 mt-1">Connect, send, intercept &amp; fuzz WebSocket connections — completes Burp Suite Pro feature parity</p>
      </div>

      {/* Connection controls */}
      <Card className="bg-black/40 border-primary/15">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest text-white/40">WebSocket Target</div>
            <div className="flex items-center gap-2">
              <Circle className={`w-2.5 h-2.5 ${connected ? "fill-primary text-primary animate-pulse" : "fill-white/20 text-white/20"}`} />
              <span className={`text-[11px] ${connected ? "text-primary" : "text-white/30"}`}>{connected ? "Connected" : "Disconnected"}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Input value={wsUrl} onChange={e => setWsUrl(e.target.value)} disabled={connected}
              className="bg-black/60 border-primary/20 text-primary text-xs font-mono flex-1"
              placeholder="wss://target.example.com/ws" />
            {!connected ? (
              <Button onClick={connect} disabled={loading} className="bg-primary text-black font-bold hover:bg-primary/85 shrink-0">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4 mr-1" />}
                Connect
              </Button>
            ) : (
              <Button onClick={disconnect} disabled={loading} variant="outline"
                className="border-red-500/30 text-red-400 hover:bg-red-900/20 shrink-0">
                Disconnect
              </Button>
            )}
          </div>
          <div>
            <label className="text-[10px] text-white/30 mb-1 block">Custom Headers (key: value, one per line)</label>
            <textarea value={customHeaders} onChange={e => setCustomHeaders(e.target.value)} disabled={connected} rows={2}
              className="w-full bg-black/60 border border-primary/20 text-primary/70 text-xs font-mono px-3 py-2 rounded-lg resize-none"
              placeholder="Authorization: Bearer eyJ..." />
          </div>
        </CardContent>
      </Card>

      {/* Send message */}
      {connected && (
        <Card className="bg-black/40 border-primary/15">
          <CardContent className="p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Send Message</div>
            <div className="flex gap-2">
              <Input value={msgInput} onChange={e => setMsgInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
                className="bg-black/60 border-primary/20 text-primary text-xs font-mono flex-1"
                placeholder='{"action":"test"}' />
              <Button onClick={sendMessage} disabled={loading} className="bg-primary text-black font-bold hover:bg-primary/85 shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
            <Button onClick={fuzz} disabled={loading} variant="outline"
              className="border-orange-400/30 text-orange-400 hover:bg-orange-900/15 w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <DownloadCloud className="w-4 h-4 mr-1" />}
              Auto-Fuzz (XSS, SQLi, proto pollution)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Message log */}
      <Card className="bg-black/40 border-primary/15">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Message Log</div>
            <Button variant="outline" size="sm" onClick={clearLogs} className="border-white/10 text-white/30 hover:bg-white/5 text-[10px]">
              <Trash2 className="w-3 h-3 mr-1" /> Clear
            </Button>
          </div>
          <div ref={logsRef} className="h-64 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-primary/20">
            {messages.length === 0 ? (
              <div className="text-xs text-white/20 text-center py-10">Connect to start intercepting WebSocket messages</div>
            ) : (
              messages.map(m => (
                <div key={m.id} className={`p-2 rounded-lg border text-[11px] ${DIR_STYLE[m.dir]}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">{DIR_LABEL[m.dir]}</span>
                    <span className="text-[9px] opacity-40">{new Date(m.ts).toLocaleTimeString()}</span>
                  </div>
                  <pre className="whitespace-pre-wrap break-all font-mono leading-relaxed">{m.text}</pre>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
