// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Send, Bot, User, Loader2, Trash2, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const STARTERS = [
  "Summarize alert: Failed login from 185.220.101.45 — 400 attempts in 5 min targeting /api/auth",
  "Write a Sigma rule to detect Mimikatz execution via LSASS memory access",
  "What is the MITRE ATT&CK technique for T1059.001 and how do I detect it in Splunk?",
  "Triage: User downloaded 4GB at 3am and accessed finance share. Is this a DLP incident?",
  "Write a KQL query for Azure Sentinel to detect impossible travel logins",
  "Create an incident response playbook for a ransomware attack",
];

interface Msg { role: "user" | "assistant"; content: string; }

export default function SocCopilot() {
  const { toast } = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streaming]);

  async function send(text?: string) {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setInput("");
    const newMsgs: Msg[] = [...messages, { role: "user", content: msg }];
    setMessages(newMsgs);
    setLoading(true); setStreaming("");
    try {
      const res = await fetch(`${BASE}/api/ai-security/soc-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs, context }),
      });
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let full = ""; let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const d = JSON.parse(line.slice(6));
            if (d.chunk) { full += d.chunk; setStreaming(full); }
            if (d.done) { setMessages(m => [...m, { role: "assistant", content: full }]); setStreaming(""); }
            if (d.error) toast({ title: "Error: " + d.error, variant: "destructive" });
          } catch {}
        }
      }
    } catch (e: any) { toast({ title: "Error: " + e.message, variant: "destructive" }); }
    finally { setLoading(false); }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto flex flex-col h-[calc(100vh-120px)] gap-4">
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
          <MessageSquare className="w-5 h-5 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">SOC Copilot</h1>
          <p className="text-xs text-white/40">AI Security Operations Assistant · Alert Triage · MITRE ATT&CK · Detection Engineering</p>
        </div>
        <div className="ml-auto flex gap-2">
          <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20 text-xs">AI AGENT</Badge>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setMessages([])} className="h-7 px-2 text-white/40 hover:text-white/70">
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-1">
        <label className="text-xs text-white/40">Environment context (optional)</label>
        <Input value={context} onChange={e => setContext(e.target.value)}
          placeholder="e.g. Azure Sentinel, Windows endpoints, 500 users, financial sector..."
          className="bg-black/40 border-white/10 text-white text-xs h-8" />
      </div>

      <div className="flex-1 overflow-y-auto rounded-lg border border-white/10 bg-black/40 p-4 space-y-4 min-h-0">
        {messages.length === 0 && !streaming && (
          <div className="h-full flex flex-col items-center justify-center gap-4">
            <Bot className="w-12 h-12 text-cyan-400/40" />
            <p className="text-sm text-white/30 text-center">Your AI SOC analyst. Ask about alerts, write detection rules, triage incidents.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 w-full max-w-2xl">
              {STARTERS.map((s, i) => (
                <button key={i} onClick={() => send(s)}
                  className="text-left text-xs text-white/50 hover:text-white/80 rounded border border-white/10 hover:border-cyan-500/30 bg-black/30 hover:bg-cyan-900/10 p-2 transition-colors flex items-start gap-2">
                  <BookOpen className="w-3 h-3 shrink-0 mt-0.5 text-cyan-400/60" />{s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-1"><Bot className="w-3 h-3 text-cyan-400" /></div>}
            <div className={`max-w-[85%] rounded-lg p-3 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-cyan-900/20 border border-cyan-500/20 text-white" : "bg-white/5 border border-white/10 text-white/80"}`}>
              {m.content}
            </div>
            {m.role === "user" && <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 mt-1"><User className="w-3 h-3 text-white/60" /></div>}
          </div>
        ))}
        {streaming && (
          <div className="flex gap-3 justify-start">
            <div className="w-6 h-6 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 mt-1"><Bot className="w-3 h-3 text-cyan-400" /></div>
            <div className="max-w-[85%] rounded-lg p-3 text-sm bg-white/5 border border-white/10 text-white/80 whitespace-pre-wrap">
              {streaming}<span className="animate-pulse text-cyan-400">▌</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 shrink-0">
        <Input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Ask about alerts, write detection rules, triage incidents, explain CVEs..."
          className="bg-black/40 border-white/10 text-white flex-1" />
        <Button onClick={() => send()} disabled={loading || !input.trim()} className="bg-cyan-700 hover:bg-cyan-800 text-white gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}
