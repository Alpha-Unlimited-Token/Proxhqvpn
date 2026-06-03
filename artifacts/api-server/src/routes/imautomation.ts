// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Modern Platform Automation Studio — updated from classic VB6 Win32 bot techniques
// Supports: Discord (webhook + bot), Telegram (bot API), Slack (webhook + bot), Email (SMTP)

import { Router, type Request, type Response } from "express";
import nodemailer from "nodemailer";

const router = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DISCORD_API = "https://discord.com/api/v10";
const TG_BASE     = (token: string) => `https://api.telegram.org/bot${token}`;
const SLACK_API   = "https://slack.com/api";

async function fetchJSON(url: string, opts: RequestInit = {}): Promise<{ ok: boolean; status: number; data: any }> {
  try {
    const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(12000) });
    const ct = res.headers.get("content-type") ?? "";
    const data = ct.includes("application/json") ? await res.json() : await res.text();
    return { ok: res.ok, status: res.status, data };
  } catch (err: any) {
    return { ok: false, status: 0, data: { error: err.message } };
  }
}

/** Replace {{variable}} in template with values from a record */
function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

/** Rate-limit: returns a promise that resolves after ms */
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Discord ──────────────────────────────────────────────────────────────────

// POST /im-auto/discord/webhook — send via webhook URL
router.post("/discord/webhook", async (req: Request, res: Response) => {
  const { webhookUrl, content, username, avatarUrl, embeds } = req.body as {
    webhookUrl: string; content?: string; username?: string; avatarUrl?: string; embeds?: any[];
  };
  if (!webhookUrl?.startsWith("https://discord.com/api/webhooks/")) {
    return res.status(400).json({ error: "Invalid Discord webhook URL" });
  }
  const body: any = {};
  if (content)   body.content = content;
  if (username)  body.username = username;
  if (avatarUrl) body.avatar_url = avatarUrl;
  if (embeds?.length) body.embeds = embeds;
  if (!body.content && !body.embeds) return res.status(400).json({ error: "content or embeds required" });

  const r = await fetchJSON(webhookUrl + "?wait=true", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// GET /im-auto/discord/bot/info — get bot info
router.post("/discord/bot/info", async (req: Request, res: Response) => {
  const { token } = req.body as { token: string };
  if (!token) return res.status(400).json({ error: "token required" });
  const r = await fetchJSON(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bot ${token}` },
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// POST /im-auto/discord/bot/guilds — list bot's guilds
router.post("/discord/bot/guilds", async (req: Request, res: Response) => {
  const { token } = req.body as { token: string };
  if (!token) return res.status(400).json({ error: "token required" });
  const r = await fetchJSON(`${DISCORD_API}/users/@me/guilds?limit=100`, {
    headers: { Authorization: `Bot ${token}` },
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// POST /im-auto/discord/bot/channels — list guild channels
router.post("/discord/bot/channels", async (req: Request, res: Response) => {
  const { token, guildId } = req.body as { token: string; guildId: string };
  if (!token || !guildId) return res.status(400).json({ error: "token and guildId required" });
  const r = await fetchJSON(`${DISCORD_API}/guilds/${guildId}/channels`, {
    headers: { Authorization: `Bot ${token}` },
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// POST /im-auto/discord/bot/send — send to a channel via bot token
router.post("/discord/bot/send", async (req: Request, res: Response) => {
  const { token, channelId, content, embeds, tts } = req.body as {
    token: string; channelId: string; content?: string; embeds?: any[]; tts?: boolean;
  };
  if (!token || !channelId) return res.status(400).json({ error: "token and channelId required" });
  if (!content && !embeds?.length) return res.status(400).json({ error: "content or embeds required" });

  const body: any = { tts: !!tts };
  if (content) body.content = content;
  if (embeds?.length) body.embeds = embeds;

  const r = await fetchJSON(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// POST /im-auto/discord/bot/dm — open DM and send message to a user ID
router.post("/discord/bot/dm", async (req: Request, res: Response) => {
  const { token, userId, content, embeds } = req.body as {
    token: string; userId: string; content?: string; embeds?: any[];
  };
  if (!token || !userId) return res.status(400).json({ error: "token and userId required" });
  if (!content && !embeds?.length) return res.status(400).json({ error: "content or embeds required" });

  // Step 1: Create/open DM channel
  const dmChan = await fetchJSON(`${DISCORD_API}/users/@me/channels`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_id: userId }),
  });
  if (!dmChan.ok) return res.json({ ok: false, status: dmChan.status, error: "Failed to open DM channel", data: dmChan.data });

  const channelId = dmChan.data?.id;
  const body: any = {};
  if (content) body.content = content;
  if (embeds?.length) body.embeds = embeds;

  const msg = await fetchJSON(`${DISCORD_API}/channels/${channelId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json({ ok: msg.ok, status: msg.status, channelId, data: msg.data });
});

// POST /im-auto/discord/bot/mass — mass DM a list of user IDs (rate-limited)
router.post("/discord/bot/mass", async (req: Request, res: Response) => {
  const { token, userIds, content, embeds, delayMs = 1200 } = req.body as {
    token: string; userIds: string[]; content?: string; embeds?: any[]; delayMs?: number;
  };
  if (!token || !userIds?.length) return res.status(400).json({ error: "token and userIds required" });
  if (!content && !embeds?.length) return res.status(400).json({ error: "content or embeds required" });

  const results: Array<{ userId: string; ok: boolean; status?: number; error?: string }> = [];
  for (const userId of userIds.slice(0, 200)) {
    // Open DM
    const dmChan = await fetchJSON(`${DISCORD_API}/users/@me/channels`, {
      method: "POST",
      headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ recipient_id: userId }),
    });
    if (!dmChan.ok) {
      results.push({ userId, ok: false, error: "DM channel failed" });
    } else {
      const channelId = dmChan.data?.id;
      const body: any = {};
      if (content) body.content = content;
      if (embeds?.length) body.embeds = embeds;
      const msg = await fetchJSON(`${DISCORD_API}/channels/${channelId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      results.push({ userId, ok: msg.ok, status: msg.status, error: msg.ok ? undefined : JSON.stringify(msg.data?.message) });
    }
    await delay(Math.max(1000, Math.min(Number(delayMs), 5000)));
  }
  return res.json({ results, sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length });
});

// POST /im-auto/discord/bot/history — get recent messages from a channel
router.post("/discord/bot/history", async (req: Request, res: Response) => {
  const { token, channelId, limit = 50 } = req.body as {
    token: string; channelId: string; limit?: number;
  };
  if (!token || !channelId) return res.status(400).json({ error: "token and channelId required" });
  const r = await fetchJSON(`${DISCORD_API}/channels/${channelId}/messages?limit=${Math.min(Number(limit), 100)}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// POST /im-auto/discord/bot/user — look up a user by ID
router.post("/discord/bot/user", async (req: Request, res: Response) => {
  const { token, userId } = req.body as { token: string; userId: string };
  if (!token || !userId) return res.status(400).json({ error: "token and userId required" });
  const r = await fetchJSON(`${DISCORD_API}/users/${userId}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// ─── Telegram ─────────────────────────────────────────────────────────────────

// POST /im-auto/telegram/me — get bot info
router.post("/telegram/me", async (req: Request, res: Response) => {
  const { token } = req.body as { token: string };
  if (!token) return res.status(400).json({ error: "token required" });
  const r = await fetchJSON(`${TG_BASE(token)}/getMe`);
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// POST /im-auto/telegram/updates — get recent updates
router.post("/telegram/updates", async (req: Request, res: Response) => {
  const { token, offset, limit = 100 } = req.body as { token: string; offset?: number; limit?: number };
  if (!token) return res.status(400).json({ error: "token required" });
  const params = new URLSearchParams({ limit: String(Math.min(Number(limit), 100)) });
  if (offset !== undefined) params.set("offset", String(offset));
  const r = await fetchJSON(`${TG_BASE(token)}/getUpdates?${params}`);
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// POST /im-auto/telegram/send — send a message
router.post("/telegram/send", async (req: Request, res: Response) => {
  const { token, chatId, text, parseMode = "HTML", replyToMessageId, disablePreview } = req.body as {
    token: string; chatId: string | number; text: string;
    parseMode?: "HTML" | "Markdown" | "MarkdownV2"; replyToMessageId?: number; disablePreview?: boolean;
  };
  if (!token || !chatId || !text) return res.status(400).json({ error: "token, chatId, text required" });

  const body: any = { chat_id: chatId, text, parse_mode: parseMode };
  if (replyToMessageId) body.reply_to_message_id = replyToMessageId;
  if (disablePreview)   body.disable_web_page_preview = true;

  const r = await fetchJSON(`${TG_BASE(token)}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// POST /im-auto/telegram/send-photo — send image with caption
router.post("/telegram/send-photo", async (req: Request, res: Response) => {
  const { token, chatId, photoUrl, caption, parseMode = "HTML" } = req.body as {
    token: string; chatId: string | number; photoUrl: string; caption?: string; parseMode?: string;
  };
  if (!token || !chatId || !photoUrl) return res.status(400).json({ error: "token, chatId, photoUrl required" });
  const body: any = { chat_id: chatId, photo: photoUrl, parse_mode: parseMode };
  if (caption) body.caption = caption;
  const r = await fetchJSON(`${TG_BASE(token)}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// POST /im-auto/telegram/mass — mass broadcast to list of chat IDs (rate-limited)
router.post("/telegram/mass", async (req: Request, res: Response) => {
  const { token, chatIds, text, parseMode = "HTML", delayMs = 500, templateVars } = req.body as {
    token: string; chatIds: Array<string | number>; text: string;
    parseMode?: string; delayMs?: number; templateVars?: Record<string, string>[];
  };
  if (!token || !chatIds?.length || !text) return res.status(400).json({ error: "token, chatIds, text required" });

  const results: Array<{ chatId: string | number; ok: boolean; messageId?: number; error?: string }> = [];
  for (let i = 0; i < Math.min(chatIds.length, 500); i++) {
    const chatId = chatIds[i];
    const finalText = templateVars?.[i] ? applyTemplate(text, templateVars[i]) : text;
    const r = await fetchJSON(`${TG_BASE(token)}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: finalText, parse_mode: parseMode }),
    });
    results.push({
      chatId, ok: r.data?.ok === true,
      messageId: r.data?.result?.message_id,
      error: r.data?.ok ? undefined : r.data?.description,
    });
    await delay(Math.max(300, Math.min(Number(delayMs), 3000)));
  }
  return res.json({ results, sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length });
});

// POST /im-auto/telegram/forward — forward a message to another chat
router.post("/telegram/forward", async (req: Request, res: Response) => {
  const { token, fromChatId, toChatId, messageId } = req.body as {
    token: string; fromChatId: string | number; toChatId: string | number; messageId: number;
  };
  if (!token || !fromChatId || !toChatId || !messageId) return res.status(400).json({ error: "All fields required" });
  const r = await fetchJSON(`${TG_BASE(token)}/forwardMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: toChatId, from_chat_id: fromChatId, message_id: messageId }),
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// POST /im-auto/telegram/pin — pin a message in a chat
router.post("/telegram/pin", async (req: Request, res: Response) => {
  const { token, chatId, messageId, disableNotification = false } = req.body as {
    token: string; chatId: string | number; messageId: number; disableNotification?: boolean;
  };
  if (!token || !chatId || !messageId) return res.status(400).json({ error: "token, chatId, messageId required" });
  const r = await fetchJSON(`${TG_BASE(token)}/pinChatMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, disable_notification: disableNotification }),
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// POST /im-auto/telegram/chat-info — get chat/group info
router.post("/telegram/chat-info", async (req: Request, res: Response) => {
  const { token, chatId } = req.body as { token: string; chatId: string | number };
  if (!token || !chatId) return res.status(400).json({ error: "token and chatId required" });
  const r = await fetchJSON(`${TG_BASE(token)}/getChat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId }),
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// ─── Slack ────────────────────────────────────────────────────────────────────

// POST /im-auto/slack/webhook — send via incoming webhook
router.post("/slack/webhook", async (req: Request, res: Response) => {
  const { webhookUrl, text, blocks, username, iconEmoji } = req.body as {
    webhookUrl: string; text?: string; blocks?: any[]; username?: string; iconEmoji?: string;
  };
  if (!webhookUrl?.startsWith("https://hooks.slack.com/")) {
    return res.status(400).json({ error: "Invalid Slack webhook URL" });
  }
  if (!text && !blocks?.length) return res.status(400).json({ error: "text or blocks required" });

  const body: any = {};
  if (text)       body.text = text;
  if (blocks)     body.blocks = blocks;
  if (username)   body.username = username;
  if (iconEmoji)  body.icon_emoji = iconEmoji;

  const r = await fetchJSON(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// POST /im-auto/slack/bot/info — get workspace/bot info
router.post("/slack/bot/info", async (req: Request, res: Response) => {
  const { token } = req.body as { token: string };
  if (!token) return res.status(400).json({ error: "token required" });
  const r = await fetchJSON(`${SLACK_API}/auth.test`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// POST /im-auto/slack/bot/channels — list channels
router.post("/slack/bot/channels", async (req: Request, res: Response) => {
  const { token } = req.body as { token: string };
  if (!token) return res.status(400).json({ error: "token required" });
  const r = await fetchJSON(`${SLACK_API}/conversations.list?limit=200&exclude_archived=true`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// POST /im-auto/slack/bot/send — send via bot token
router.post("/slack/bot/send", async (req: Request, res: Response) => {
  const { token, channel, text, blocks, unfurlLinks = false } = req.body as {
    token: string; channel: string; text?: string; blocks?: any[]; unfurlLinks?: boolean;
  };
  if (!token || !channel) return res.status(400).json({ error: "token and channel required" });
  if (!text && !blocks?.length) return res.status(400).json({ error: "text or blocks required" });

  const body: any = { channel, unfurl_links: unfurlLinks };
  if (text)   body.text = text;
  if (blocks) body.blocks = blocks;

  const r = await fetchJSON(`${SLACK_API}/chat.postMessage`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// POST /im-auto/slack/bot/history — get channel message history
router.post("/slack/bot/history", async (req: Request, res: Response) => {
  const { token, channel, limit = 50 } = req.body as { token: string; channel: string; limit?: number };
  if (!token || !channel) return res.status(400).json({ error: "token and channel required" });
  const r = await fetchJSON(`${SLACK_API}/conversations.history?channel=${encodeURIComponent(channel)}&limit=${Math.min(Number(limit), 200)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// POST /im-auto/slack/bot/users — list workspace users
router.post("/slack/bot/users", async (req: Request, res: Response) => {
  const { token } = req.body as { token: string };
  if (!token) return res.status(400).json({ error: "token required" });
  const r = await fetchJSON(`${SLACK_API}/users.list?limit=200`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json({ ok: r.ok, status: r.status, data: r.data });
});

// ─── Email ────────────────────────────────────────────────────────────────────

function buildTransport(opts: { host: string; port: number; user: string; pass: string; secure?: boolean }) {
  return nodemailer.createTransport({
    host: opts.host,
    port: opts.port,
    secure: opts.secure ?? opts.port === 465,
    auth: { user: opts.user, pass: opts.pass },
    tls: { rejectUnauthorized: false },
  });
}

// POST /im-auto/email/test — test SMTP connection
router.post("/email/test", async (req: Request, res: Response) => {
  const { host, port, user, pass } = req.body as { host: string; port: number; user: string; pass: string };
  if (!host || !port || !user || !pass) return res.status(400).json({ error: "host, port, user, pass required" });
  const transport = buildTransport({ host, port: Number(port), user, pass });
  try {
    await transport.verify();
    return res.json({ ok: true, message: "SMTP connection verified" });
  } catch (err: any) {
    return res.json({ ok: false, error: err.message });
  }
});

// POST /im-auto/email/send — send a single email
router.post("/email/send", async (req: Request, res: Response) => {
  const { host, port, user, pass, from, to, subject, html, text, replyTo } = req.body as {
    host: string; port: number; user: string; pass: string;
    from?: string; to: string | string[]; subject: string; html?: string; text?: string; replyTo?: string;
  };
  if (!host || !port || !user || !pass || !to || !subject) {
    return res.status(400).json({ error: "host, port, user, pass, to, subject required" });
  }
  if (!html && !text) return res.status(400).json({ error: "html or text body required" });

  const transport = buildTransport({ host, port: Number(port), user, pass });
  try {
    const info = await transport.sendMail({
      from: from || user,
      to: Array.isArray(to) ? to.join(", ") : to,
      subject, html, text,
      ...(replyTo ? { replyTo } : {}),
    });
    return res.json({ ok: true, messageId: info.messageId, accepted: info.accepted, rejected: info.rejected });
  } catch (err: any) {
    return res.json({ ok: false, error: err.message });
  }
});

// POST /im-auto/email/mass — mass email with rate limiting and template support
router.post("/email/mass", async (req: Request, res: Response) => {
  const {
    host, port, user, pass, from, subject, html, text, replyTo,
    recipients, delayMs = 1500,
  } = req.body as {
    host: string; port: number; user: string; pass: string; from?: string;
    subject: string; html?: string; text?: string; replyTo?: string;
    recipients: Array<{ to: string; vars?: Record<string, string> }>;
    delayMs?: number;
  };
  if (!host || !port || !user || !pass || !recipients?.length || !subject) {
    return res.status(400).json({ error: "host, port, user, pass, subject, recipients required" });
  }
  if (!html && !text) return res.status(400).json({ error: "html or text body required" });

  const transport = buildTransport({ host, port: Number(port), user, pass });
  const results: Array<{ to: string; ok: boolean; messageId?: string; error?: string }> = [];

  for (const { to, vars = {} } of recipients.slice(0, 1000)) {
    const finalSubject = applyTemplate(subject, vars);
    const finalHtml = html ? applyTemplate(html, vars) : undefined;
    const finalText = text ? applyTemplate(text, vars) : undefined;
    try {
      const info = await transport.sendMail({
        from: from || user, to, subject: finalSubject,
        ...(finalHtml ? { html: finalHtml } : {}),
        ...(finalText ? { text: finalText } : {}),
        ...(replyTo ? { replyTo } : {}),
      });
      results.push({ to, ok: true, messageId: info.messageId });
    } catch (err: any) {
      results.push({ to, ok: false, error: err.message });
    }
    await delay(Math.max(500, Math.min(Number(delayMs), 10000)));
  }
  return res.json({ results, sent: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length });
});

export default router;
