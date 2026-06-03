// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Modern Platform Automation Studio — evolved from classic Win32 IM bot techniques
// Supports: Discord (webhook + bot DM/channel), Telegram (bot broadcast), Slack (webhook + bot), Email (SMTP)

import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  MessageSquare, Send, Users, Mail, Hash, ChevronDown, ChevronRight,
  CheckCircle, XCircle, Loader2, Copy, Trash2, Plus, RefreshCw,
  Eye, EyeOff, AlertCircle, Download, Bot, Zap, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}/api${path}`, {
    credentials: "include", ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers ?? {}) },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Platform = "discord" | "telegram" | "slack" | "email";
type LogEntry = { ts: string; ok: boolean; msg: string; detail?: string };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useSession<T>(key: string, initial: T): [T, (v: T) => void] {
  const [val, setVal] = useState<T>(() => {
    try { const s = sessionStorage.getItem(key); return s ? JSON.parse(s) : initial; } catch { return initial; }
  });
  const set = (v: T) => { setVal(v); try { sessionStorage.setItem(key, JSON.stringify(v)); } catch {} };
  return [val, set];
}

function ts() { return new Date().toLocaleTimeString(); }

function Label({ children }: { children: React.ReactNode }) {
  return <div className="text-[9px] uppercase tracking-widest text-primary/30 font-bold mb-1">{children}</div>;
}
function Input({ className = "", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full bg-black/40 border border-primary/20 text-primary text-xs font-mono px-2.5 py-1.5 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm ${className}`} />;
}
function Textarea({ className = "", ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full bg-black/40 border border-primary/20 text-primary text-xs font-mono px-2.5 py-1.5 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm resize-none ${className}`} />;
}
function Select({ className = "", children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return <select {...props} className={`w-full bg-black/60 border border-primary/20 text-primary text-xs font-mono px-2.5 py-1.5 focus:outline-none focus:border-[#00ff88]/40 rounded-sm ${className}`}>{children}</select>;
}
function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-primary/15 rounded-sm">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-primary/50 hover:text-primary/80 transition-colors">
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        {title}
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}
function LogPanel({ entries, onClear }: { entries: LogEntry[]; onClear: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.scrollTo(0, ref.current.scrollHeight); }, [entries]);
  return (
    <div className="border border-primary/15 rounded-sm">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-primary/10">
        <span className="text-[9px] font-bold uppercase tracking-widest text-primary/30">Operation Log</span>
        <button onClick={onClear} className="text-[9px] text-primary/20 hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
      </div>
      <div ref={ref} className="h-40 overflow-y-auto p-2 space-y-0.5 font-mono text-[10px]">
        {entries.length === 0 && <div className="text-primary/20 text-center mt-8">No operations yet</div>}
        {entries.map((e, i) => (
          <div key={i} className={`flex gap-2 ${e.ok ? "text-[#00ff88]/70" : "text-red-400/80"}`}>
            <span className="text-primary/20 shrink-0">{e.ts}</span>
            {e.ok ? <CheckCircle className="w-3 h-3 shrink-0 mt-0.5" /> : <XCircle className="w-3 h-3 shrink-0 mt-0.5" />}
            <span>{e.msg}</span>
            {e.detail && <span className="text-primary/30 truncate">{e.detail}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function TokenInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || "Token / API key"} className="pr-8" />
      <button onClick={() => setShow(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-primary/20 hover:text-primary/60">
        {show ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
      </button>
    </div>
  );
}

// ─── Discord Tab ──────────────────────────────────────────────────────────────

function DiscordTab({ log, setLog }: { log: LogEntry[]; setLog: React.Dispatch<React.SetStateAction<LogEntry[]>> }) {
  const addLog = (e: LogEntry) => setLog(prev => [...prev.slice(-200), e]);

  const [mode, setMode] = useSession("dc-mode", "webhook" as "webhook" | "bot");
  const [token, setToken] = useSession("dc-token", "");
  const [webhook, setWebhook] = useSession("dc-webhook", "");
  const [webhookUser, setWebhookUser] = useSession("dc-wh-user", "");
  const [channelId, setChannelId] = useSession("dc-channel", "");
  const [guildId, setGuildId] = useSession("dc-guild", "");
  const [content, setContent] = useState("");
  const [embedTitle, setEmbedTitle] = useState("");
  const [embedDesc, setEmbedDesc] = useState("");
  const [embedColor, setEmbedColor] = useState("#00ff88");
  const [useEmbed, setUseEmbed] = useState(false);
  const [userIds, setUserIds] = useState("");
  const [historyLimit, setHistoryLimit] = useState("50");
  const [guilds, setGuilds] = useState<any[]>([]);
  const [channels, setChannels] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [botInfo, setBotInfo] = useState<any>(null);

  const buildBody = (extra: any = {}) => {
    const body: any = { ...extra };
    if (content) body.content = content;
    if (useEmbed && (embedTitle || embedDesc)) {
      const colorInt = parseInt(embedColor.replace("#", ""), 16);
      body.embeds = [{ title: embedTitle || undefined, description: embedDesc || undefined, color: colorInt }];
    }
    return body;
  };

  const sendWebhook = useMutation({
    mutationFn: () => apiFetch("/im-auto/discord/webhook", { method: "POST", body: JSON.stringify({ webhookUrl: webhook, username: webhookUser || undefined, ...buildBody() }) }),
    onSuccess: (d: any) => { addLog({ ts: ts(), ok: d.ok !== false, msg: d.ok !== false ? "Webhook message sent" : `Failed: ${d.data?.message}`, detail: d.data?.id }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const sendChannel = useMutation({
    mutationFn: () => apiFetch("/im-auto/discord/bot/send", { method: "POST", body: JSON.stringify({ token, channelId, ...buildBody() }) }),
    onSuccess: (d: any) => { addLog({ ts: ts(), ok: d.ok !== false, msg: d.ok !== false ? `Message sent to #${channelId}` : `Failed: ${d.data?.message}` }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const massDm = useMutation({
    mutationFn: () => apiFetch("/im-auto/discord/bot/mass", { method: "POST", body: JSON.stringify({ token, userIds: userIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean), ...buildBody() }) }),
    onSuccess: (d: any) => { addLog({ ts: ts(), ok: true, msg: `Mass DM: ${d.sent} sent, ${d.failed} failed`, detail: String(d.results?.length) + " total" }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const getBotInfo = useMutation({
    mutationFn: () => apiFetch("/im-auto/discord/bot/info", { method: "POST", body: JSON.stringify({ token }) }),
    onSuccess: (d: any) => { setBotInfo(d.data); addLog({ ts: ts(), ok: d.ok !== false, msg: d.data?.username ? `Bot: @${d.data.username}#${d.data.discriminator}` : "Failed to get bot info" }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const getGuilds = useMutation({
    mutationFn: () => apiFetch("/im-auto/discord/bot/guilds", { method: "POST", body: JSON.stringify({ token }) }),
    onSuccess: (d: any) => { setGuilds(Array.isArray(d.data) ? d.data : []); addLog({ ts: ts(), ok: Array.isArray(d.data), msg: `Fetched ${Array.isArray(d.data) ? d.data.length : 0} guilds` }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const getChannels = useMutation({
    mutationFn: () => apiFetch("/im-auto/discord/bot/channels", { method: "POST", body: JSON.stringify({ token, guildId }) }),
    onSuccess: (d: any) => { setChannels(Array.isArray(d.data) ? d.data.filter((c: any) => c.type === 0) : []); addLog({ ts: ts(), ok: Array.isArray(d.data), msg: `Fetched ${Array.isArray(d.data) ? d.data.filter((c: any) => c.type === 0).length : 0} text channels` }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const getHistory = useMutation({
    mutationFn: () => apiFetch("/im-auto/discord/bot/history", { method: "POST", body: JSON.stringify({ token, channelId, limit: Number(historyLimit) }) }),
    onSuccess: (d: any) => { setHistory(Array.isArray(d.data) ? d.data : []); addLog({ ts: ts(), ok: Array.isArray(d.data), msg: `Fetched ${Array.isArray(d.data) ? d.data.length : 0} messages` }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const anyPending = sendWebhook.isPending || sendChannel.isPending || massDm.isPending;

  return (
    <div className="space-y-3">
      {/* Mode selector */}
      <div className="flex gap-2">
        {(["webhook", "bot"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-sm border transition-colors ${mode === m ? "border-[#5865F2]/50 text-[#5865F2] bg-[#5865F2]/10" : "border-primary/15 text-primary/30 hover:text-primary/60"}`}>
            {m === "webhook" ? "⚡ Webhook" : "🤖 Bot Token"}
          </button>
        ))}
      </div>

      {/* Config */}
      {mode === "webhook" ? (
        <Section title="Webhook Config" defaultOpen>
          <Label>Discord Webhook URL</Label>
          <Input value={webhook} onChange={e => setWebhook(e.target.value)} placeholder="https://discord.com/api/webhooks/..." />
          <Label>Override Username (optional)</Label>
          <Input value={webhookUser} onChange={e => setWebhookUser(e.target.value)} placeholder="ProxhqBot" />
        </Section>
      ) : (
        <Section title="Bot Token Config" defaultOpen>
          <Label>Bot Token</Label>
          <TokenInput value={token} onChange={setToken} placeholder="Bot token from Discord Developer Portal" />
          {botInfo && (
            <div className="flex items-center gap-2 p-2 bg-[#5865F2]/5 border border-[#5865F2]/20 rounded-sm text-[10px]">
              {botInfo.avatar && <img src={`https://cdn.discordapp.com/avatars/${botInfo.id}/${botInfo.avatar}.png?size=32`} className="w-6 h-6 rounded-full" alt="" />}
              <div><span className="text-[#5865F2]">@{botInfo.username}</span>{botInfo.discriminator !== "0" && <span className="text-primary/40">#{botInfo.discriminator}</span>} <span className="text-primary/30 ml-2">ID: {botInfo.id}</span></div>
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => getBotInfo.mutate()} disabled={!token || getBotInfo.isPending} className="text-[10px] h-7">
              {getBotInfo.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Verify Token"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => getGuilds.mutate()} disabled={!token || getGuilds.isPending} className="text-[10px] h-7">
              {getGuilds.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "List Servers"}
            </Button>
          </div>
          {guilds.length > 0 && (
            <div className="space-y-1.5">
              <Label>Select Server → Load Channels</Label>
              <Select value={guildId} onChange={e => setGuildId(e.target.value)}>
                <option value="">— select server —</option>
                {guilds.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </Select>
              {guildId && (
                <Button size="sm" variant="outline" onClick={() => getChannels.mutate()} disabled={getChannels.isPending} className="text-[10px] h-7 w-full">
                  {getChannels.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Load Text Channels"}
                </Button>
              )}
              {channels.length > 0 && (
                <Select value={channelId} onChange={e => setChannelId(e.target.value)}>
                  <option value="">— select channel —</option>
                  {channels.map((c: any) => <option key={c.id} value={c.id}>#{c.name}</option>)}
                </Select>
              )}
            </div>
          )}
          {!guilds.length && (
            <div className="space-y-1.5">
              <Label>Channel ID (manual)</Label>
              <Input value={channelId} onChange={e => setChannelId(e.target.value)} placeholder="Channel ID" />
            </div>
          )}
        </Section>
      )}

      {/* Message Composer */}
      <Section title="Message Composer" defaultOpen>
        <Label>Message Content</Label>
        <Textarea value={content} onChange={e => setContent(e.target.value)} rows={3} placeholder="Your message here... supports Discord markdown **bold** __underline__ `code`" />
        <label className="flex items-center gap-2 text-[10px] text-primary/50 cursor-pointer mt-1">
          <input type="checkbox" checked={useEmbed} onChange={e => setUseEmbed(e.target.checked)} className="accent-[#5865F2]" />
          Attach Rich Embed
        </label>
        {useEmbed && (
          <div className="space-y-1.5 p-2 border border-[#5865F2]/20 rounded-sm bg-[#5865F2]/5">
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2"><Label>Embed Title</Label><Input value={embedTitle} onChange={e => setEmbedTitle(e.target.value)} placeholder="Title" /></div>
              <div><Label>Color</Label><input type="color" value={embedColor} onChange={e => setEmbedColor(e.target.value)} className="w-full h-8 bg-transparent border border-primary/20 rounded-sm cursor-pointer" /></div>
            </div>
            <Label>Embed Description</Label>
            <Textarea value={embedDesc} onChange={e => setEmbedDesc(e.target.value)} rows={2} placeholder="Embed body text..." />
          </div>
        )}
      </Section>

      {/* Send Actions */}
      <div className="flex flex-wrap gap-2">
        {mode === "webhook" ? (
          <Button onClick={() => sendWebhook.mutate()} disabled={!webhook || (!content && !useEmbed) || anyPending} className="bg-[#5865F2]/20 border border-[#5865F2]/40 text-[#5865F2] hover:bg-[#5865F2]/30 text-[10px] h-8">
            {sendWebhook.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />} Send Webhook
          </Button>
        ) : (
          <>
            <Button onClick={() => sendChannel.mutate()} disabled={!token || !channelId || (!content && !useEmbed) || anyPending} className="bg-[#5865F2]/20 border border-[#5865F2]/40 text-[#5865F2] hover:bg-[#5865F2]/30 text-[10px] h-8">
              {sendChannel.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />} Send to Channel
            </Button>
            <Button onClick={() => getHistory.mutate()} disabled={!token || !channelId || getHistory.isPending} variant="outline" className="text-[10px] h-8">
              {getHistory.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />} Read Messages
            </Button>
          </>
        )}
      </div>

      {/* Mass DM (bot only) */}
      {mode === "bot" && (
        <Section title="Mass DM — Broadcast to User List">
          <div className="p-2 border border-yellow-500/20 bg-yellow-900/5 rounded-sm text-[9px] text-yellow-400/60 mb-2">
            ⚠ Rate-limited at 1.2s/user. Discord may restrict bots from DMing users who haven't shared a server with the bot. Max 200 per run.
          </div>
          <Label>User IDs (one per line or comma-separated)</Label>
          <Textarea value={userIds} onChange={e => setUserIds(e.target.value)} rows={4} placeholder={"123456789012345678\n987654321098765432\n..."} />
          <Button onClick={() => massDm.mutate()} disabled={!token || !userIds.trim() || anyPending} className="bg-[#5865F2]/20 border border-[#5865F2]/40 text-[#5865F2] hover:bg-[#5865F2]/30 text-[10px] h-8 w-full mt-1">
            {massDm.isPending ? <><Loader2 className="w-3 h-3 animate-spin mr-1" /> Sending...</> : <><Users className="w-3 h-3 mr-1" /> Mass DM</>}
          </Button>
        </Section>
      )}

      {/* Message History */}
      {history.length > 0 && (
        <Section title={`Channel History (${history.length} messages)`} defaultOpen>
          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {history.map((m: any) => (
              <div key={m.id} className="p-2 border border-primary/10 rounded-sm text-[10px]">
                <div className="flex items-center gap-2 mb-0.5">
                  {m.author?.avatar && <img src={`https://cdn.discordapp.com/avatars/${m.author.id}/${m.author.avatar}.png?size=24`} className="w-4 h-4 rounded-full" alt="" />}
                  <span className="text-[#5865F2]">@{m.author?.username}</span>
                  <span className="text-primary/25 text-[9px] ml-auto">{new Date(m.timestamp).toLocaleString()}</span>
                </div>
                <div className="text-primary/60">{m.content || <span className="text-primary/20 italic">[embed/attachment]</span>}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Telegram Tab ─────────────────────────────────────────────────────────────

function TelegramTab({ log, setLog }: { log: LogEntry[]; setLog: React.Dispatch<React.SetStateAction<LogEntry[]>> }) {
  const addLog = (e: LogEntry) => setLog(prev => [...prev.slice(-200), e]);

  const [token, setToken] = useSession("tg-token", "");
  const [chatId, setChatId] = useSession("tg-chat", "");
  const [parseMode, setParseMode] = useSession<"HTML" | "Markdown" | "MarkdownV2">("tg-parse", "HTML");
  const [message, setMessage] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [sendPhoto, setSendPhoto] = useState(false);
  const [chatIds, setChatIds] = useState("");
  const [botInfo, setBotInfo] = useState<any>(null);
  const [updates, setUpdates] = useState<any[]>([]);
  const [chatInfoId, setChatInfoId] = useState("");
  const [chatInfoResult, setChatInfoResult] = useState<any>(null);

  const getMeMut = useMutation({
    mutationFn: () => apiFetch("/im-auto/telegram/me", { method: "POST", body: JSON.stringify({ token }) }),
    onSuccess: (d: any) => { setBotInfo(d.data?.result); addLog({ ts: ts(), ok: d.data?.ok, msg: d.data?.ok ? `Bot: @${d.data.result.username}` : "Auth failed" }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const getUpdatesMut = useMutation({
    mutationFn: () => apiFetch("/im-auto/telegram/updates", { method: "POST", body: JSON.stringify({ token, limit: 50 }) }),
    onSuccess: (d: any) => {
      const msgs = (d.data?.result ?? []).map((u: any) => u.message ?? u.channel_post ?? u.edited_message).filter(Boolean);
      setUpdates(msgs);
      addLog({ ts: ts(), ok: d.data?.ok, msg: `${msgs.length} recent messages fetched` });
    },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const sendMut = useMutation({
    mutationFn: () => sendPhoto
      ? apiFetch("/im-auto/telegram/send-photo", { method: "POST", body: JSON.stringify({ token, chatId, photoUrl, caption, parseMode }) })
      : apiFetch("/im-auto/telegram/send", { method: "POST", body: JSON.stringify({ token, chatId, text: message, parseMode, disablePreview: true }) }),
    onSuccess: (d: any) => { addLog({ ts: ts(), ok: d.data?.ok, msg: d.data?.ok ? `Message sent (id:${d.data?.result?.message_id})` : `Error: ${d.data?.description}` }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const massMut = useMutation({
    mutationFn: () => apiFetch("/im-auto/telegram/mass", { method: "POST", body: JSON.stringify({ token, chatIds: chatIds.split(/[\n,]+/).map(s => s.trim()).filter(Boolean), text: message, parseMode }) }),
    onSuccess: (d: any) => { addLog({ ts: ts(), ok: true, msg: `Broadcast: ${d.sent} sent, ${d.failed} failed` }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const getChatInfo = useMutation({
    mutationFn: () => apiFetch("/im-auto/telegram/chat-info", { method: "POST", body: JSON.stringify({ token, chatId: chatInfoId }) }),
    onSuccess: (d: any) => { setChatInfoResult(d.data?.result); addLog({ ts: ts(), ok: d.data?.ok, msg: d.data?.ok ? `Chat: ${d.data.result?.title ?? d.data.result?.username}` : "Not found" }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const anyPending = sendMut.isPending || massMut.isPending;

  return (
    <div className="space-y-3">
      {/* Config */}
      <Section title="Bot Config" defaultOpen>
        <Label>Bot Token</Label>
        <TokenInput value={token} onChange={setToken} placeholder="123456789:ABCDEFabcdef..." />
        {botInfo && (
          <div className="p-2 bg-[#26A5E4]/5 border border-[#26A5E4]/20 rounded-sm text-[10px]">
            <span className="text-[#26A5E4]">@{botInfo.username}</span>
            <span className="text-primary/30 ml-2">ID: {botInfo.id}</span>
            {botInfo.can_join_groups && <span className="text-primary/25 ml-2">· can join groups</span>}
          </div>
        )}
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => getMeMut.mutate()} disabled={!token || getMeMut.isPending} className="text-[10px] h-7">
            {getMeMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Verify Bot"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => getUpdatesMut.mutate()} disabled={!token || getUpdatesMut.isPending} className="text-[10px] h-7">
            {getUpdatesMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Get Updates"}
          </Button>
        </div>
        <Label>Chat/Group ID</Label>
        <Input value={chatId} onChange={e => setChatId(e.target.value)} placeholder="@username, -100123456789, or chat_id from updates" />
        <div className="flex items-center gap-2">
          <Label>Parse Mode</Label>
          <Select value={parseMode} onChange={e => setParseMode(e.target.value as any)} className="w-40">
            <option value="HTML">HTML</option>
            <option value="Markdown">Markdown</option>
            <option value="MarkdownV2">MarkdownV2</option>
          </Select>
        </div>
      </Section>

      {/* Message Composer */}
      <Section title="Message Composer" defaultOpen>
        <label className="flex items-center gap-2 text-[10px] text-primary/50 cursor-pointer mb-2">
          <input type="checkbox" checked={sendPhoto} onChange={e => setSendPhoto(e.target.checked)} className="accent-[#26A5E4]" />
          Send Photo/Image
        </label>
        {sendPhoto ? (
          <>
            <Label>Photo URL</Label>
            <Input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} placeholder="https://example.com/image.jpg" />
            <Label>Caption (optional)</Label>
            <Textarea value={caption} onChange={e => setCaption(e.target.value)} rows={2} placeholder="Image caption..." />
          </>
        ) : (
          <>
            <Label>Message Text</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder={`HTML: <b>bold</b> <i>italic</i> <code>code</code> <a href="url">link</a>`} />
            <div className="text-[9px] text-primary/20 mt-1">Template vars: <span className="font-mono">{"{{name}}"}</span> <span className="font-mono">{"{{username}}"}</span> — replaced per recipient in mass send</div>
          </>
        )}
      </Section>

      {/* Send Actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => sendMut.mutate()} disabled={!token || !chatId || (sendPhoto ? !photoUrl : !message) || anyPending} className="bg-[#26A5E4]/20 border border-[#26A5E4]/40 text-[#26A5E4] hover:bg-[#26A5E4]/30 text-[10px] h-8">
          {sendMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />} Send Message
        </Button>
      </div>

      {/* Mass Broadcast */}
      <Section title="Mass Broadcast — Multi-Chat Send">
        <div className="p-2 border border-yellow-500/20 bg-yellow-900/5 rounded-sm text-[9px] text-yellow-400/60 mb-2">
          ⚠ Rate-limited at 500ms/message. Telegram enforces 30 messages/second globally. Bot must be admin in groups. Max 500 per run.
        </div>
        <Label>Chat IDs / Usernames (one per line or comma-separated)</Label>
        <Textarea value={chatIds} onChange={e => setChatIds(e.target.value)} rows={4} placeholder={"@channel1\n-100123456789\n@group2\n..."} />
        <Button onClick={() => massMut.mutate()} disabled={!token || !chatIds.trim() || !message || anyPending} className="bg-[#26A5E4]/20 border border-[#26A5E4]/40 text-[#26A5E4] hover:bg-[#26A5E4]/30 text-[10px] h-8 w-full mt-1">
          {massMut.isPending ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Broadcasting...</> : <><Users className="w-3 h-3 mr-1" />Broadcast</>}
        </Button>
      </Section>

      {/* Chat/Group Lookup */}
      <Section title="Chat / Group Info Lookup">
        <Label>Chat ID or @username</Label>
        <div className="flex gap-2">
          <Input value={chatInfoId} onChange={e => setChatInfoId(e.target.value)} placeholder="@channelusername or -100123456789" />
          <Button size="sm" variant="outline" onClick={() => getChatInfo.mutate()} disabled={!token || !chatInfoId || getChatInfo.isPending} className="text-[10px] h-8 shrink-0">
            {getChatInfo.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Lookup"}
          </Button>
        </div>
        {chatInfoResult && (
          <div className="p-2 border border-[#26A5E4]/20 rounded-sm text-[10px] space-y-0.5 mt-1">
            <div><span className="text-primary/30">Type</span> <span className="text-[#26A5E4] ml-2">{chatInfoResult.type}</span></div>
            {chatInfoResult.title && <div><span className="text-primary/30">Title</span> <span className="text-primary/70 ml-2">{chatInfoResult.title}</span></div>}
            {chatInfoResult.username && <div><span className="text-primary/30">Username</span> <span className="text-primary/70 font-mono ml-2">@{chatInfoResult.username}</span></div>}
            {chatInfoResult.member_count !== undefined && <div><span className="text-primary/30">Members</span> <span className="text-primary/70 ml-2">{chatInfoResult.member_count?.toLocaleString()}</span></div>}
            <div><span className="text-primary/30">ID</span> <span className="text-primary/50 font-mono ml-2">{chatInfoResult.id}</span></div>
          </div>
        )}
      </Section>

      {/* Updates viewer */}
      {updates.length > 0 && (
        <Section title={`Recent Messages (${updates.length})`} defaultOpen>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {updates.map((m: any, i: number) => (
              <div key={i} className="p-2 border border-primary/10 rounded-sm text-[10px]">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[#26A5E4]">{m.from?.username ? `@${m.from.username}` : `${m.from?.first_name ?? "?"}`}</span>
                  <span className="text-primary/25 text-[9px] ml-auto">{m.date ? new Date(m.date * 1000).toLocaleString() : ""}</span>
                  <button onClick={() => { setChatId(String(m.chat?.id)); setChatInfoId(String(m.chat?.id)); }} className="text-[#26A5E4]/50 hover:text-[#26A5E4] text-[9px]" title="Use this chat ID">Use</button>
                </div>
                <div className="text-primary/60">{m.text || m.caption || <span className="text-primary/20 italic">[{m.sticker ? "sticker" : m.photo ? "photo" : "media"}]</span>}</div>
                <div className="text-primary/20 text-[9px] mt-0.5">chat: {m.chat?.title ?? m.chat?.username ?? m.chat?.id}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Slack Tab ────────────────────────────────────────────────────────────────

function SlackTab({ log, setLog }: { log: LogEntry[]; setLog: React.Dispatch<React.SetStateAction<LogEntry[]>> }) {
  const addLog = (e: LogEntry) => setLog(prev => [...prev.slice(-200), e]);

  const [mode, setMode] = useSession("sl-mode", "webhook" as "webhook" | "bot");
  const [token, setToken] = useSession("sl-token", "");
  const [webhook, setWebhook] = useSession("sl-webhook", "");
  const [channel, setChannel] = useSession("sl-channel", "");
  const [message, setMessage] = useState("");
  const [username, setUsername] = useSession("sl-username", "");
  const [iconEmoji, setIconEmoji] = useSession("sl-emoji", "");
  const [channels, setChannels] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [workspaceInfo, setWorkspaceInfo] = useState<any>(null);

  const sendWebhookMut = useMutation({
    mutationFn: () => apiFetch("/im-auto/slack/webhook", { method: "POST", body: JSON.stringify({ webhookUrl: webhook, text: message, username: username || undefined, iconEmoji: iconEmoji || undefined }) }),
    onSuccess: (d: any) => { addLog({ ts: ts(), ok: d.ok, msg: d.ok ? "Webhook sent" : `Failed: ${d.data}` }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const sendBotMut = useMutation({
    mutationFn: () => apiFetch("/im-auto/slack/bot/send", { method: "POST", body: JSON.stringify({ token, channel, text: message }) }),
    onSuccess: (d: any) => { addLog({ ts: ts(), ok: d.data?.ok, msg: d.data?.ok ? `Sent to ${channel}` : `Error: ${d.data?.error}` }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const getInfoMut = useMutation({
    mutationFn: () => apiFetch("/im-auto/slack/bot/info", { method: "POST", body: JSON.stringify({ token }) }),
    onSuccess: (d: any) => { setWorkspaceInfo(d.data); addLog({ ts: ts(), ok: d.data?.ok, msg: d.data?.ok ? `Workspace: ${d.data?.team} · Bot: ${d.data?.user}` : `Auth failed: ${d.data?.error}` }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const getChannelsMut = useMutation({
    mutationFn: () => apiFetch("/im-auto/slack/bot/channels", { method: "POST", body: JSON.stringify({ token }) }),
    onSuccess: (d: any) => { setChannels(d.data?.channels ?? []); addLog({ ts: ts(), ok: d.data?.ok, msg: `${d.data?.channels?.length ?? 0} channels loaded` }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const getUsersMut = useMutation({
    mutationFn: () => apiFetch("/im-auto/slack/bot/users", { method: "POST", body: JSON.stringify({ token }) }),
    onSuccess: (d: any) => { setUsers((d.data?.members ?? []).filter((u: any) => !u.deleted && !u.is_bot)); addLog({ ts: ts(), ok: d.data?.ok, msg: `${d.data?.members?.filter((u: any) => !u.deleted && !u.is_bot).length ?? 0} human members` }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const getHistoryMut = useMutation({
    mutationFn: () => apiFetch("/im-auto/slack/bot/history", { method: "POST", body: JSON.stringify({ token, channel, limit: 50 }) }),
    onSuccess: (d: any) => { setHistory(d.data?.messages ?? []); addLog({ ts: ts(), ok: d.data?.ok, msg: `${d.data?.messages?.length ?? 0} messages` }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const anyPending = sendWebhookMut.isPending || sendBotMut.isPending;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(["webhook", "bot"] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 text-[10px] font-bold uppercase rounded-sm border transition-colors ${mode === m ? "border-[#4A154B]/80 text-[#E01E5A] bg-[#4A154B]/20" : "border-primary/15 text-primary/30 hover:text-primary/60"}`}>
            {m === "webhook" ? "⚡ Incoming Webhook" : "🤖 Bot Token"}
          </button>
        ))}
      </div>

      {mode === "webhook" ? (
        <Section title="Webhook Config" defaultOpen>
          <Label>Slack Incoming Webhook URL</Label>
          <Input value={webhook} onChange={e => setWebhook(e.target.value)} placeholder="https://hooks.slack.com/services/T.../B.../..." />
          <Label>Override Username (optional)</Label>
          <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="ProxhqBot" />
          <Label>Icon Emoji (optional)</Label>
          <Input value={iconEmoji} onChange={e => setIconEmoji(e.target.value)} placeholder=":robot_face:" />
        </Section>
      ) : (
        <Section title="Bot Token Config" defaultOpen>
          <Label>Bot Token (xoxb-...)</Label>
          <TokenInput value={token} onChange={setToken} placeholder="xoxb-..." />
          {workspaceInfo?.ok && (
            <div className="p-2 bg-[#E01E5A]/5 border border-[#E01E5A]/20 rounded-sm text-[10px]">
              <span className="text-[#E01E5A]">{workspaceInfo.team}</span> · Bot: <span className="text-primary/60">{workspaceInfo.user}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => getInfoMut.mutate()} disabled={!token || getInfoMut.isPending} className="text-[10px] h-7">
              {getInfoMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Verify Token"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => getChannelsMut.mutate()} disabled={!token || getChannelsMut.isPending} className="text-[10px] h-7">
              {getChannelsMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "List Channels"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => getUsersMut.mutate()} disabled={!token || getUsersMut.isPending} className="text-[10px] h-7">
              {getUsersMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "List Members"}
            </Button>
          </div>
          {channels.length > 0 && (
            <div className="space-y-1">
              <Label>Select Channel</Label>
              <Select value={channel} onChange={e => setChannel(e.target.value)}>
                <option value="">— select channel —</option>
                {channels.map((c: any) => <option key={c.id} value={c.id}>#{c.name} ({c.num_members ?? "?"} members)</option>)}
              </Select>
            </div>
          )}
          {!channels.length && (
            <div><Label>Channel ID / Name</Label><Input value={channel} onChange={e => setChannel(e.target.value)} placeholder="C1234567890 or #general" /></div>
          )}
          {users.length > 0 && (
            <div className="text-[10px] p-2 border border-primary/10 rounded-sm">
              <div className="text-primary/30 mb-1">{users.length} human members:</div>
              <div className="flex flex-wrap gap-1">
                {users.slice(0, 30).map((u: any) => <span key={u.id} className="text-primary/50 bg-primary/5 px-1 rounded text-[9px]">@{u.name}</span>)}
                {users.length > 30 && <span className="text-primary/25 text-[9px]">+{users.length - 30} more</span>}
              </div>
            </div>
          )}
        </Section>
      )}

      <Section title="Message Composer" defaultOpen>
        <Label>Message Text (supports Slack mrkdwn: *bold* _italic_ `code` ~strike~)</Label>
        <Textarea value={message} onChange={e => setMessage(e.target.value)} rows={4} placeholder="Your message here..." />
      </Section>

      <div className="flex flex-wrap gap-2">
        {mode === "webhook" ? (
          <Button onClick={() => sendWebhookMut.mutate()} disabled={!webhook || !message || anyPending} className="bg-[#E01E5A]/15 border border-[#E01E5A]/40 text-[#E01E5A] hover:bg-[#E01E5A]/25 text-[10px] h-8">
            {sendWebhookMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />} Post to Slack
          </Button>
        ) : (
          <>
            <Button onClick={() => sendBotMut.mutate()} disabled={!token || !channel || !message || anyPending} className="bg-[#E01E5A]/15 border border-[#E01E5A]/40 text-[#E01E5A] hover:bg-[#E01E5A]/25 text-[10px] h-8">
              {sendBotMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Send className="w-3 h-3 mr-1" />} Post Message
            </Button>
            {channel && (
              <Button onClick={() => getHistoryMut.mutate()} disabled={!token || getHistoryMut.isPending} variant="outline" className="text-[10px] h-8">
                {getHistoryMut.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RefreshCw className="w-3 h-3 mr-1" />} Read History
              </Button>
            )}
          </>
        )}
      </div>

      {history.length > 0 && (
        <Section title={`Channel History (${history.length})`} defaultOpen>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {history.map((m: any, i: number) => (
              <div key={i} className="p-2 border border-primary/10 rounded-sm text-[10px]">
                <div className="flex gap-2 mb-0.5">
                  <span className="text-[#E01E5A]">{m.user ?? m.username ?? "bot"}</span>
                  <span className="text-primary/25 text-[9px] ml-auto">{m.ts ? new Date(Number(m.ts) * 1000).toLocaleString() : ""}</span>
                </div>
                <div className="text-primary/60">{m.text || <span className="text-primary/20 italic">[no text]</span>}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

// ─── Email Tab ────────────────────────────────────────────────────────────────

function EmailTab({ log, setLog }: { log: LogEntry[]; setLog: React.Dispatch<React.SetStateAction<LogEntry[]>> }) {
  const addLog = (e: LogEntry) => setLog(prev => [...prev.slice(-200), e]);

  const [host, setHost] = useSession("em-host", "smtp.gmail.com");
  const [port, setPort] = useSession("em-port", "465");
  const [user, setUser] = useSession("em-user", "");
  const [pass, setPass] = useSession("em-pass", "");
  const [from, setFrom] = useSession("em-from", "");
  const [replyTo, setReplyTo] = useSession("em-replyto", "");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isHtml, setIsHtml] = useState(true);
  const [recipients, setRecipients] = useState("");
  const [massSubject, setMassSubject] = useState("");
  const [massBody, setMassBody] = useState("");
  const [verified, setVerified] = useState<boolean | null>(null);

  const testMut = useMutation({
    mutationFn: () => apiFetch("/im-auto/email/test", { method: "POST", body: JSON.stringify({ host, port: Number(port), user, pass }) }),
    onSuccess: (d: any) => { setVerified(d.ok); addLog({ ts: ts(), ok: d.ok, msg: d.ok ? "SMTP connection verified ✓" : `SMTP error: ${d.error}` }); },
    onError: (e: Error) => { setVerified(false); addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const sendMut = useMutation({
    mutationFn: () => apiFetch("/im-auto/email/send", { method: "POST", body: JSON.stringify({ host, port: Number(port), user, pass, from: from || undefined, to, subject, ...(isHtml ? { html: body } : { text: body }), replyTo: replyTo || undefined }) }),
    onSuccess: (d: any) => { addLog({ ts: ts(), ok: d.ok, msg: d.ok ? `Email sent · ID: ${d.messageId}` : `Failed: ${d.error}` }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const massMut = useMutation({
    mutationFn: () => {
      const recips = recipients.split(/[\n]+/).map(line => {
        const [toAddr, ...rest] = line.split(",").map(s => s.trim());
        const vars: Record<string, string> = {};
        for (const kv of rest) { const [k, v] = kv.split("="); if (k && v) vars[k.trim()] = v.trim(); }
        return { to: toAddr, vars };
      }).filter(r => r.to.includes("@"));
      return apiFetch("/im-auto/email/mass", { method: "POST", body: JSON.stringify({ host, port: Number(port), user, pass, from: from || undefined, subject: massSubject, ...(isHtml ? { html: massBody } : { text: massBody }), replyTo: replyTo || undefined, recipients: recips }) });
    },
    onSuccess: (d: any) => { addLog({ ts: ts(), ok: true, msg: `Mass send: ${d.sent} sent, ${d.failed} failed` }); },
    onError: (e: Error) => { addLog({ ts: ts(), ok: false, msg: e.message }); },
  });

  const anyPending = sendMut.isPending || massMut.isPending || testMut.isPending;

  return (
    <div className="space-y-3">
      <Section title="SMTP Config" defaultOpen>
        <div className="grid grid-cols-3 gap-2">
          <div className="col-span-2"><Label>SMTP Host</Label><Input value={host} onChange={e => setHost(e.target.value)} placeholder="smtp.gmail.com" /></div>
          <div><Label>Port</Label><Input value={port} onChange={e => setPort(e.target.value)} placeholder="465" /></div>
        </div>
        <Label>Username (email address)</Label>
        <Input value={user} onChange={e => setUser(e.target.value)} placeholder="you@gmail.com" />
        <Label>Password / App Password</Label>
        <TokenInput value={pass} onChange={setPass} placeholder="Gmail app password or SMTP password" />
        <Label>From Address (optional, defaults to username)</Label>
        <Input value={from} onChange={e => setFrom(e.target.value)} placeholder="ProxhqVPN <you@gmail.com>" />
        <Label>Reply-To (optional)</Label>
        <Input value={replyTo} onChange={e => setReplyTo(e.target.value)} placeholder="noreply@yourdomain.com" />
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => testMut.mutate()} disabled={!host || !user || !pass || testMut.isPending} className="text-[10px] h-7">
            {testMut.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Test Connection"}
          </Button>
          {verified !== null && (
            <span className={`text-[10px] ${verified ? "text-[#00ff88]" : "text-red-400"}`}>
              {verified ? <><CheckCircle className="w-3 h-3 inline mr-1" />Connected</> : <><XCircle className="w-3 h-3 inline mr-1" />Failed</>}
            </span>
          )}
        </div>
        <div className="text-[9px] text-primary/20 leading-relaxed p-2 border border-primary/10 rounded-sm">
          💡 Gmail: use an <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-[#00ff88]/60 underline">App Password</a> (requires 2FA). Port 465 = SSL, 587 = TLS/STARTTLS, 25 = plain.
        </div>
      </Section>

      {/* Single Send */}
      <Section title="Single Email" defaultOpen>
        <label className="flex items-center gap-2 text-[10px] text-primary/50 cursor-pointer mb-2">
          <input type="checkbox" checked={isHtml} onChange={e => setIsHtml(e.target.checked)} className="accent-[#00ff88]" />
          HTML Body
        </label>
        <Label>To</Label>
        <Input value={to} onChange={e => setTo(e.target.value)} placeholder="recipient@example.com" />
        <Label>Subject</Label>
        <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject" />
        <Label>Body</Label>
        <Textarea value={body} onChange={e => setBody(e.target.value)} rows={5} placeholder={isHtml ? "<h1>Hello</h1><p>Your message here...</p>" : "Plain text message..."} />
        <Button onClick={() => sendMut.mutate()} disabled={!user || !pass || !to || !subject || !body || anyPending} className="bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] hover:bg-[#00ff88]/20 text-[10px] h-8 w-full mt-1">
          {sendMut.isPending ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Sending...</> : <><Send className="w-3 h-3 mr-1" />Send Email</>}
        </Button>
      </Section>

      {/* Mass Campaign */}
      <Section title="Mass Email Campaign">
        <div className="p-2 border border-yellow-500/20 bg-yellow-900/5 rounded-sm text-[9px] text-yellow-400/60 mb-2">
          ⚠ Rate-limited at 1.5s/email. Uses shared SMTP above. Template vars supported: <span className="font-mono">{"{{name}}"}</span> <span className="font-mono">{"{{company}}"}</span> etc. Format: <span className="font-mono">email@addr.com, name=John, company=Acme</span>
        </div>
        <Label>Subject (supports template vars)</Label>
        <Input value={massSubject} onChange={e => setMassSubject(e.target.value)} placeholder="Hello {{name}}, important update from {{company}}" />
        <Label>Body (supports template vars)</Label>
        <Textarea value={massBody} onChange={e => setMassBody(e.target.value)} rows={5} placeholder={`<p>Hi <b>{{name}}</b>,</p>\n<p>Your message here...</p>`} />
        <Label>Recipients (one per line: email, key=value, key=value)</Label>
        <Textarea value={recipients} onChange={e => setRecipients(e.target.value)} rows={5} placeholder={"alice@example.com, name=Alice, company=Acme\nbob@example.com, name=Bob, company=Corp"} />
        <Button onClick={() => massMut.mutate()} disabled={!user || !pass || !recipients.trim() || !massSubject || !massBody || anyPending} className="bg-[#00ff88]/10 border border-[#00ff88]/30 text-[#00ff88] hover:bg-[#00ff88]/20 text-[10px] h-8 w-full mt-1">
          {massMut.isPending ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Sending Campaign...</> : <><Users className="w-3 h-3 mr-1" />Send Campaign</>}
        </Button>
      </Section>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const PLATFORMS: Array<{ id: Platform; label: string; icon: React.ReactNode; color: string; desc: string }> = [
  { id: "discord", label: "Discord", icon: <Hash className="w-4 h-4" />, color: "#5865F2", desc: "Webhook · Bot DM · Channel Messages · Mass DM · History" },
  { id: "telegram", label: "Telegram", icon: <Send className="w-4 h-4" />, color: "#26A5E4", desc: "Bot API · Broadcast · Photo · Chat Lookup · Updates Reader" },
  { id: "slack", label: "Slack", icon: <Globe className="w-4 h-4" />, color: "#E01E5A", desc: "Incoming Webhook · Bot Token · Channel History · Members" },
  { id: "email", label: "Email", icon: <Mail className="w-4 h-4" />, color: "#00ff88", desc: "SMTP · Single Send · Mass Campaign · Template Variables" },
];

export default function ImAutomation() {
  const [platform, setPlatform] = useState<Platform>("discord");
  const [log, setLog] = useState<LogEntry[]>([]);

  const active = PLATFORMS.find(p => p.id === platform)!;

  return (
    <div className="min-h-screen bg-black text-primary p-4 md:p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <Bot className="w-5 h-5 text-[#00ff88]" />
          <h1 className="text-lg font-bold tracking-tight text-primary">Platform Automation Studio</h1>
          <span className="text-[9px] border border-[#00ff88]/20 text-[#00ff88]/40 px-1.5 py-0.5 rounded uppercase tracking-widest">Live</span>
        </div>
        <p className="text-[10px] text-primary/30 leading-relaxed">
          Evolved from classic Win32 IM automation techniques · Discord · Telegram · Slack · Email SMTP
        </p>
      </div>

      {/* Platform Selector */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
        {PLATFORMS.map(p => (
          <button key={p.id} onClick={() => setPlatform(p.id)} className={`flex flex-col items-start p-3 rounded-sm border transition-all ${platform === p.id ? `border-[${p.color}]/40 bg-[${p.color}]/8` : "border-primary/10 hover:border-primary/25"}`}
            style={platform === p.id ? { borderColor: `${p.color}60`, backgroundColor: `${p.color}10` } : {}}>
            <div className="flex items-center gap-2 mb-1" style={{ color: platform === p.id ? p.color : undefined }}>
              <span className={platform === p.id ? "" : "text-primary/30"}>{p.icon}</span>
              <span className={`text-[10px] font-bold ${platform === p.id ? "" : "text-primary/40"}`}>{p.label}</span>
            </div>
            <p className="text-[8px] text-primary/20 leading-tight text-left">{p.desc}</p>
          </button>
        ))}
      </div>

      {/* Main Content */}
      <div className="grid md:grid-cols-[1fr_280px] gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-2 border-b border-primary/10 pb-2 mb-3">
            <span style={{ color: active.color }}>{active.icon}</span>
            <span className="text-xs font-bold" style={{ color: active.color }}>{active.label}</span>
            <span className="text-[9px] text-primary/20">automation</span>
          </div>
          {platform === "discord"  && <DiscordTab  log={log} setLog={setLog} />}
          {platform === "telegram" && <TelegramTab log={log} setLog={setLog} />}
          {platform === "slack"    && <SlackTab    log={log} setLog={setLog} />}
          {platform === "email"    && <EmailTab    log={log} setLog={setLog} />}
        </div>

        {/* Sidebar: Log + Info */}
        <div className="space-y-3">
          <LogPanel entries={log} onClear={() => setLog([])} />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="border border-primary/10 rounded-sm p-2">
              <div className="text-sm font-bold font-mono text-[#00ff88]">{log.filter(l => l.ok).length}</div>
              <div className="text-[8px] text-primary/25 uppercase">OK</div>
            </div>
            <div className="border border-primary/10 rounded-sm p-2">
              <div className="text-sm font-bold font-mono text-red-400">{log.filter(l => !l.ok).length}</div>
              <div className="text-[8px] text-primary/25 uppercase">Errors</div>
            </div>
            <div className="border border-primary/10 rounded-sm p-2">
              <div className="text-sm font-bold font-mono text-primary/50">{log.length}</div>
              <div className="text-[8px] text-primary/25 uppercase">Total</div>
            </div>
          </div>

          {/* Technique Reference */}
          <div className="border border-primary/10 rounded-sm">
            <div className="px-3 py-2 border-b border-primary/10 text-[9px] font-bold uppercase tracking-widest text-primary/25">Modern Equivalents (from VB6 .bas)</div>
            <div className="p-3 space-y-1.5 text-[9px] font-mono">
              {[
                { old: "FindWindow/SendMessage", new: "Bot API / Webhook POST" },
                { old: "SendPM(Who, Msg)", new: "Bot DM by user/chat ID" },
                { old: "MassPM(List, Msg)", new: "Broadcast loop w/ rate limit" },
                { old: "SendFile(Who, File)", new: "Attachment upload via API" },
                { old: "GetYahooText()", new: "getUpdates / history endpoint" },
                { old: "AntiLagg()", new: "delay() + retry backoff" },
                { old: "SignIn(user, pass)", new: "Bot token / OAuth2 flow" },
                { old: "GetChatName()", new: "getChat / channel info" },
                { old: "SendTextScroll(N)", new: "Loop with count + delay" },
              ].map((t, i) => (
                <div key={i} className="flex gap-1">
                  <span className="text-red-400/60 shrink-0">{t.old}</span>
                  <span className="text-primary/15">→</span>
                  <span className="text-[#00ff88]/50">{t.new}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="text-[9px] text-primary/15 leading-relaxed p-2 border border-primary/8 rounded-sm">
            Credentials stored in session only — never persisted server-side. Tokens cleared on tab close.
          </div>
        </div>
      </div>
    </div>
  );
}
