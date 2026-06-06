// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response } from "express";
import https from "https";
import http from "http";
import { URL } from "url";
import crypto from "crypto";
import { z } from "zod";

const router = Router();

// ── In-memory job store (1-hour TTL auto-clean) ──────────────────────────────

interface PlatformResult {
  platform: string;
  platformId: string;
  category: string;
  url: string;
  found: boolean;
  confidence: "confirmed" | "likely" | "possible" | "blocked";
  profileData?: {
    displayName?: string;
    bio?: string;
    location?: string;
    email?: string;
    website?: string;
    company?: string;
    joinedAt?: string;
    followers?: number;
    following?: number;
    verified?: boolean;
    karma?: number;
    repos?: number;
    linkedAccounts?: Array<{ platform: string; username: string; url: string }>;
  };
  checkedAt: string;
}

interface EmailResult {
  email: string;
  source: string;
  confidence: "high" | "medium" | "low";
  notes?: string;
}

interface DataPoint {
  value: string;
  source: string;
}

interface UsernameJob {
  jobId: string;
  username: string;
  hops: number;
  status: "running" | "complete" | "error";
  startedAt: string;
  completedAt?: string;
  progress: number;
  currentTask: string;
  platformsChecked: number;
  platforms: PlatformResult[];
  emails: EmailResult[];
  names: DataPoint[];
  locations: DataPoint[];
  websites: DataPoint[];
  bios: DataPoint[];
  companies: DataPoint[];
  linkedUsernames: Array<{ platform: string; username: string; url: string; discoveredVia: string }>;
  riskScore: number;
  exposureCategories: string[];
  summary: string;
  createdAt: number;
}

const JOBS = new Map<string, UsernameJob>();

// Clean stale jobs (>1h) every 30 minutes
setInterval(() => {
  const cutoff = Date.now() - 3_600_000;
  for (const [id, job] of JOBS.entries()) {
    if (job.createdAt < cutoff) JOBS.delete(id);
  }
}, 1_800_000);

// ── Platform definitions ──────────────────────────────────────────────────────

const PLATFORMS: Array<{
  id: string;
  name: string;
  category: string;
  profileUrl: (u: string) => string;
  apiUrl?: (u: string) => string;
  checkMode: "head" | "json";
  botProtected?: boolean;
  notFoundStatuses?: number[];
}> = [
  // ─ Social ─
  { id: "tiktok",    name: "TikTok",       category: "social",    profileUrl: u => `https://www.tiktok.com/@${u}`,           checkMode: "head", botProtected: true },
  { id: "instagram", name: "Instagram",    category: "social",    profileUrl: u => `https://www.instagram.com/${u}/`,        checkMode: "head", botProtected: true },
  { id: "twitter",   name: "Twitter / X",  category: "social",    profileUrl: u => `https://x.com/${u}`,                     checkMode: "head", botProtected: true },
  { id: "facebook",  name: "Facebook",     category: "social",    profileUrl: u => `https://www.facebook.com/${u}`,          checkMode: "head", botProtected: true },
  { id: "reddit",    name: "Reddit",       category: "social",    profileUrl: u => `https://www.reddit.com/user/${u}`,       apiUrl: u => `https://www.reddit.com/user/${u}/about.json`, checkMode: "json", notFoundStatuses: [404] },
  { id: "pinterest", name: "Pinterest",    category: "social",    profileUrl: u => `https://www.pinterest.com/${u}/`,        checkMode: "head" },
  { id: "tumblr",    name: "Tumblr",       category: "social",    profileUrl: u => `https://${u}.tumblr.com`,                checkMode: "head" },
  { id: "vk",        name: "VKontakte",    category: "social",    profileUrl: u => `https://vk.com/${u}`,                    checkMode: "head", notFoundStatuses: [404] },
  { id: "snapchat",  name: "Snapchat",     category: "social",    profileUrl: u => `https://www.snapchat.com/add/${u}`,      checkMode: "head", botProtected: true },
  { id: "linkedin",  name: "LinkedIn",     category: "social",    profileUrl: u => `https://www.linkedin.com/in/${u}`,       checkMode: "head", botProtected: true },
  // ─ Developer ─
  { id: "github",    name: "GitHub",       category: "developer", profileUrl: u => `https://github.com/${u}`,                apiUrl: u => `https://api.github.com/users/${u}`, checkMode: "json", notFoundStatuses: [404] },
  { id: "gitlab",    name: "GitLab",       category: "developer", profileUrl: u => `https://gitlab.com/${u}`,                checkMode: "head", notFoundStatuses: [404] },
  { id: "bitbucket", name: "Bitbucket",    category: "developer", profileUrl: u => `https://bitbucket.org/${u}`,             checkMode: "head", notFoundStatuses: [404] },
  { id: "hackernews",name: "HackerNews",   category: "developer", profileUrl: u => `https://news.ycombinator.com/user?id=${u}`, apiUrl: u => `https://hacker-news.firebaseio.com/v0/user/${u}.json`, checkMode: "json" },
  { id: "keybase",   name: "Keybase",      category: "developer", profileUrl: u => `https://keybase.io/${u}`,                apiUrl: u => `https://keybase.io/_/api/1.0/user/lookup.json?usernames=${u}`, checkMode: "json", notFoundStatuses: [404] },
  { id: "devto",     name: "DEV.to",       category: "developer", profileUrl: u => `https://dev.to/${u}`,                    apiUrl: u => `https://dev.to/api/users/by_username?url=${u}`, checkMode: "json", notFoundStatuses: [404] },
  { id: "npm",       name: "npm",          category: "developer", profileUrl: u => `https://www.npmjs.com/~${u}`,            checkMode: "head", notFoundStatuses: [404] },
  { id: "stackoverflow", name: "Stack Overflow", category: "developer", profileUrl: u => `https://stackoverflow.com/users/${u}`, checkMode: "head" },
  // ─ Creative ─
  { id: "youtube",   name: "YouTube",      category: "creative",  profileUrl: u => `https://www.youtube.com/@${u}`,          checkMode: "head", botProtected: true },
  { id: "twitch",    name: "Twitch",       category: "creative",  profileUrl: u => `https://www.twitch.tv/${u}`,             checkMode: "head", notFoundStatuses: [404] },
  { id: "soundcloud",name: "SoundCloud",   category: "creative",  profileUrl: u => `https://soundcloud.com/${u}`,            checkMode: "head", notFoundStatuses: [404] },
  { id: "medium",    name: "Medium",       category: "creative",  profileUrl: u => `https://medium.com/@${u}`,               checkMode: "head", botProtected: true },
  { id: "substack",  name: "Substack",     category: "creative",  profileUrl: u => `https://${u}.substack.com`,              checkMode: "head" },
  { id: "patreon",   name: "Patreon",      category: "creative",  profileUrl: u => `https://www.patreon.com/${u}`,           checkMode: "head", notFoundStatuses: [404] },
  { id: "behance",   name: "Behance",      category: "creative",  profileUrl: u => `https://www.behance.net/${u}`,           checkMode: "head", notFoundStatuses: [404] },
  { id: "dribbble",  name: "Dribbble",     category: "creative",  profileUrl: u => `https://dribbble.com/${u}`,              checkMode: "head", notFoundStatuses: [404] },
  { id: "deviantart",name: "DeviantArt",   category: "creative",  profileUrl: u => `https://www.deviantart.com/${u}`,        checkMode: "head", notFoundStatuses: [404] },
  { id: "flickr",    name: "Flickr",       category: "creative",  profileUrl: u => `https://www.flickr.com/people/${u}`,    checkMode: "head", notFoundStatuses: [404] },
  // ─ Gaming ─
  { id: "steam",     name: "Steam",        category: "gaming",    profileUrl: u => `https://steamcommunity.com/id/${u}`,    checkMode: "head", notFoundStatuses: [404] },
  { id: "roblox",    name: "Roblox",       category: "gaming",    profileUrl: u => `https://www.roblox.com/user.aspx?username=${u}`, checkMode: "head" },
  // ─ Messaging ─
  { id: "telegram",  name: "Telegram",     category: "messaging", profileUrl: u => `https://t.me/${u}`,                     checkMode: "head", notFoundStatuses: [404] },
  // ─ Other ─
  { id: "pastebin",  name: "Pastebin",     category: "other",     profileUrl: u => `https://pastebin.com/u/${u}`,           checkMode: "head", notFoundStatuses: [404] },
  { id: "linktree",  name: "Linktree",     category: "other",     profileUrl: u => `https://linktr.ee/${u}`,                checkMode: "head", notFoundStatuses: [404] },
  { id: "aboutme",   name: "About.me",     category: "other",     profileUrl: u => `https://about.me/${u}`,                 checkMode: "head", notFoundStatuses: [404] },
  { id: "producthunt",name:"Product Hunt",  category: "other",     profileUrl: u => `https://www.producthunt.com/@${u}`,    checkMode: "head", notFoundStatuses: [404] },
];

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function fetchHead(urlStr: string, timeoutMs = 7000): Promise<{ status: number; headers: Record<string, string> } | null> {
  return new Promise(resolve => {
    try {
      const parsed = new URL(urlStr);
      const mod = parsed.protocol === "https:" ? https : http;
      const req = mod.request({
        host: parsed.hostname,
        path: parsed.pathname + (parsed.search || ""),
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        method: "HEAD",
        headers: {
          "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        timeout: timeoutMs,
        rejectUnauthorized: false,
      }, res => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          if (typeof v === "string") headers[k.toLowerCase()] = v;
          else if (Array.isArray(v)) headers[k.toLowerCase()] = v[0];
        }
        res.destroy();
        resolve({ status: res.statusCode || 0, headers });
      });
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
      req.end();
    } catch { resolve(null); }
  });
}

function fetchJson<T = unknown>(urlStr: string, timeoutMs = 8000): Promise<T | null> {
  return new Promise(resolve => {
    try {
      const parsed = new URL(urlStr);
      const mod = parsed.protocol === "https:" ? https : http;
      const req = mod.request({
        host: parsed.hostname,
        path: parsed.pathname + (parsed.search || ""),
        port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
        method: "GET",
        headers: {
          "User-Agent": "ProxhqVPN-OSINT/2.1.0",
          "Accept": "application/json",
        },
        timeout: timeoutMs,
        rejectUnauthorized: false,
      }, res => {
        if (!res.statusCode || res.statusCode >= 400) { res.destroy(); return resolve(null); }
        let body = "";
        res.on("data", chunk => { body += chunk; if (body.length > 200_000) res.destroy(); });
        res.on("end", () => {
          try { resolve(JSON.parse(body) as T); } catch { resolve(null); }
        });
        res.on("error", () => resolve(null));
      });
      req.on("error", () => resolve(null));
      req.on("timeout", () => { req.destroy(); resolve(null); });
      req.end();
    } catch { resolve(null); }
  });
}

// ── Platform enrichment ───────────────────────────────────────────────────────

interface GitHubUser {
  login?: string;
  name?: string;
  email?: string;
  bio?: string;
  location?: string;
  blog?: string;
  company?: string;
  twitter_username?: string;
  public_repos?: number;
  followers?: number;
  following?: number;
  created_at?: string;
}

interface GitHubEvent {
  type?: string;
  payload?: {
    commits?: Array<{ author?: { email?: string; name?: string } }>;
  };
}

interface RedditAbout {
  data?: {
    name?: string;
    icon_img?: string;
    created_utc?: number;
    total_karma?: number;
    subreddit?: { public_description?: string; display_name_prefixed?: string };
  };
}

interface KeybaseResult {
  them?: Array<{
    id?: string;
    basics?: { username?: string; ctime?: number };
    profile?: { full_name?: string; bio?: string; location?: string };
    proofs_summary?: {
      all?: Array<{ proof_type?: string; nametag?: string; service_url?: string }>;
    };
  }>;
  status?: { name?: string };
}

interface HNUser { id?: string; karma?: number; about?: string; created?: number; }
interface DevToUser { name?: string; summary?: string; location?: string; website_url?: string; github_username?: string; twitter_username?: string; }

function dedupe<T extends object>(arr: T[], key: keyof T): T[] {
  const seen = new Set<unknown>();
  return arr.filter(item => { const v = item[key]; if (seen.has(v)) return false; seen.add(v); return true; });
}

function addDataPoint(arr: DataPoint[], value: string | undefined | null, source: string) {
  if (value && value.trim()) arr.push({ value: value.trim(), source });
}

// ── Main async search engine ──────────────────────────────────────────────────

async function runSearch(job: UsernameJob): Promise<void> {
  const { username } = job;
  const total = PLATFORMS.length;
  let checked = 0;

  // ── Hop 1: Platform probe sweep ────────────────────────────────────────────
  job.currentTask = "Probing platforms…";

  const platformChunks: Array<typeof PLATFORMS> = [];
  for (let i = 0; i < PLATFORMS.length; i += 8) platformChunks.push(PLATFORMS.slice(i, i + 8));

  for (const chunk of platformChunks) {
    await Promise.all(chunk.map(async p => {
      const profileUrl = p.profileUrl(username);
      const now = new Date().toISOString();
      let found = false;
      let confidence: PlatformResult["confidence"] = "possible";

      if (p.checkMode === "json" && p.apiUrl) {
        const data = await fetchJson(p.apiUrl(username));
        found = data !== null;
        confidence = found ? "confirmed" : "possible";

        // Extract profile data from known API shapes
        if (found && data) {
          const r: PlatformResult = {
            platform: p.name, platformId: p.id, category: p.category,
            url: profileUrl, found: true, confidence: "confirmed",
            profileData: {}, checkedAt: now,
          };

          if (p.id === "github") {
            const gh = data as GitHubUser;
            r.profileData = {
              displayName: gh.name ?? undefined,
              email: gh.email ?? undefined,
              bio: gh.bio ?? undefined,
              location: gh.location ?? undefined,
              website: gh.blog ?? undefined,
              company: gh.company ?? undefined,
              followers: gh.followers,
              following: gh.following,
              repos: gh.public_repos,
              joinedAt: gh.created_at ?? undefined,
              linkedAccounts: gh.twitter_username
                ? [{ platform: "Twitter/X", username: gh.twitter_username, url: `https://x.com/${gh.twitter_username}` }]
                : [],
            };
            if (gh.name) addDataPoint(job.names, gh.name, "GitHub");
            if (gh.email) job.emails.push({ email: gh.email, source: "GitHub profile", confidence: "high" });
            if (gh.location) addDataPoint(job.locations, gh.location, "GitHub");
            if (gh.blog) addDataPoint(job.websites, gh.blog, "GitHub");
            if (gh.company) addDataPoint(job.companies, gh.company, "GitHub");
            if (gh.bio) addDataPoint(job.bios, gh.bio, "GitHub");
            if (gh.twitter_username) {
              job.linkedUsernames.push({ platform: "Twitter/X", username: gh.twitter_username, url: `https://x.com/${gh.twitter_username}`, discoveredVia: "GitHub profile" });
            }
          }

          if (p.id === "reddit") {
            const rd = (data as RedditAbout).data;
            if (!rd) { job.platforms.push({ platform: p.name, platformId: p.id, category: p.category, url: profileUrl, found: false, confidence: "possible", checkedAt: now }); checked++; job.progress = Math.round((checked / total) * 50); return; }
            const karma = (rd.total_karma as number | undefined) ?? 0;
            const createdAt = rd.created_utc ? new Date(rd.created_utc * 1000).toISOString() : undefined;
            r.profileData = {
              displayName: rd.name ?? undefined,
              karma,
              joinedAt: createdAt,
              bio: rd.subreddit?.public_description ?? undefined,
            };
            if (rd.subreddit?.public_description) addDataPoint(job.bios, rd.subreddit.public_description, "Reddit");
          }

          if (p.id === "keybase") {
            const kb = data as KeybaseResult;
            const them = kb.them?.[0];
            if (!them) { job.platforms.push({ platform: p.name, platformId: p.id, category: p.category, url: profileUrl, found: false, confidence: "possible", checkedAt: now }); checked++; job.progress = Math.round((checked / total) * 50); return; }
            const proofs = them.proofs_summary?.all ?? [];
            const linked: Array<{ platform: string; username: string; url: string }> = proofs
              .filter(pr => pr.nametag && pr.proof_type)
              .map(pr => ({
                platform: pr.proof_type?.replace(/_/g, " ") ?? "unknown",
                username: pr.nametag ?? "",
                url: pr.service_url ?? `https://keybase.io/${username}`,
              }));
            r.profileData = {
              displayName: them.profile?.full_name ?? undefined,
              bio: them.profile?.bio ?? undefined,
              location: them.profile?.location ?? undefined,
              linkedAccounts: linked,
            };
            if (them.profile?.full_name) addDataPoint(job.names, them.profile.full_name, "Keybase");
            if (them.profile?.location) addDataPoint(job.locations, them.profile.location, "Keybase");
            if (them.profile?.bio) addDataPoint(job.bios, them.profile.bio, "Keybase");
            for (const pr of proofs) {
              if (pr.nametag && pr.proof_type) {
                job.linkedUsernames.push({ platform: pr.proof_type.replace(/_/g, " "), username: pr.nametag, url: pr.service_url ?? "", discoveredVia: "Keybase proof" });
              }
            }
          }

          if (p.id === "hackernews") {
            const hn = data as HNUser;
            if (!hn || !hn.id) { job.platforms.push({ platform: p.name, platformId: p.id, category: p.category, url: profileUrl, found: false, confidence: "possible", checkedAt: now }); checked++; job.progress = Math.round((checked / total) * 50); return; }
            r.profileData = { karma: hn.karma, bio: hn.about ? hn.about.replace(/<[^>]+>/g, "") : undefined, joinedAt: hn.created ? new Date(hn.created * 1000).toISOString() : undefined };
            if (hn.about) addDataPoint(job.bios, hn.about.replace(/<[^>]+>/g, ""), "HackerNews");
            // Extract emails from HN bio
            const hnEmails = (hn.about ?? "").match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
            for (const e of hnEmails) job.emails.push({ email: e, source: "HackerNews bio", confidence: "high" });
          }

          if (p.id === "devto") {
            const dt = data as DevToUser;
            r.profileData = {
              displayName: dt.name ?? undefined,
              bio: dt.summary ?? undefined,
              location: dt.location ?? undefined,
              website: dt.website_url ?? undefined,
              linkedAccounts: [
                ...(dt.github_username ? [{ platform: "GitHub", username: dt.github_username, url: `https://github.com/${dt.github_username}` }] : []),
                ...(dt.twitter_username ? [{ platform: "Twitter/X", username: dt.twitter_username, url: `https://x.com/${dt.twitter_username}` }] : []),
              ],
            };
            if (dt.name) addDataPoint(job.names, dt.name, "DEV.to");
            if (dt.location) addDataPoint(job.locations, dt.location, "DEV.to");
            if (dt.website_url) addDataPoint(job.websites, dt.website_url, "DEV.to");
            if (dt.github_username) job.linkedUsernames.push({ platform: "GitHub", username: dt.github_username, url: `https://github.com/${dt.github_username}`, discoveredVia: "DEV.to profile" });
            if (dt.twitter_username) job.linkedUsernames.push({ platform: "Twitter/X", username: dt.twitter_username, url: `https://x.com/${dt.twitter_username}`, discoveredVia: "DEV.to profile" });
          }

          job.platforms.push(r);
          checked++;
          job.progress = Math.round((checked / total) * 50);
          return;
        }
        // JSON check returned null → not found
        job.platforms.push({ platform: p.name, platformId: p.id, category: p.category, url: profileUrl, found: false, confidence: "possible", checkedAt: now });
        checked++;
        job.progress = Math.round((checked / total) * 50);
        return;
      }

      // HEAD check
      const resp = await fetchHead(profileUrl);
      const notFoundStatuses = p.notFoundStatuses ?? [404, 410];
      if (!resp) {
        found = false;
        confidence = "possible";
      } else if (notFoundStatuses.includes(resp.status)) {
        found = false;
        confidence = "confirmed";
      } else if (resp.status >= 200 && resp.status < 400) {
        found = true;
        confidence = p.botProtected ? "possible" : "likely";
      } else {
        found = false;
        confidence = "possible";
      }

      job.platforms.push({ platform: p.name, platformId: p.id, category: p.category, url: profileUrl, found, confidence, checkedAt: now });
      checked++;
      job.progress = Math.round((checked / total) * 50);
    }));
  }

  // ── Hop 2: GitHub commit email mining ──────────────────────────────────────
  job.currentTask = "Mining GitHub commit emails…";
  const ghEvents = await fetchJson<GitHubEvent[]>(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=30`);
  if (ghEvents && Array.isArray(ghEvents)) {
    for (const ev of ghEvents) {
      if (ev.type === "PushEvent" && ev.payload?.commits) {
        for (const commit of ev.payload.commits) {
          const email = commit.author?.email;
          const name = commit.author?.name;
          if (email && !email.includes("noreply.github.com") && email.includes("@")) {
            const alreadyFound = job.emails.some(e => e.email === email);
            if (!alreadyFound) job.emails.push({ email, source: "GitHub commit history", confidence: "high", notes: name ? `Commit author name: ${name}` : undefined });
            if (name) addDataPoint(job.names, name, "GitHub commit");
          }
          // Also capture the noreply address as a medium-confidence email fingerprint
          if (email?.includes("noreply.github.com")) {
            const alreadyFound = job.emails.some(e => e.email === email);
            if (!alreadyFound) job.emails.push({ email, source: "GitHub noreply (privacy address)", confidence: "medium", notes: "GitHub privacy email — not real inbox, used for commit signing" });
          }
        }
      }
    }
  }
  job.progress = 60;

  // ── Hop 2: Gravatar email pattern probing ──────────────────────────────────
  job.currentTask = "Probing Gravatar email patterns…";
  const commonDomains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "protonmail.com", "icloud.com", "me.com"];
  const gravatarHits: string[] = [];
  await Promise.all(commonDomains.map(async domain => {
    const email = `${username}@${domain}`;
    const hash = crypto.createHash("md5").update(email.trim().toLowerCase()).digest("hex");
    const data = await fetchJson<{ entry?: Array<{ displayName?: string; aboutMe?: string; currentLocation?: string; emails?: Array<{ value: string }> }> }>(`https://www.gravatar.com/${hash}.json`);
    if (data?.entry?.[0]) {
      const entry = data.entry[0];
      gravatarHits.push(email);
      job.emails.push({ email, source: `Gravatar profile (${domain})`, confidence: "high", notes: entry.displayName ? `Gravatar name: ${entry.displayName}` : undefined });
      if (entry.displayName) addDataPoint(job.names, entry.displayName, `Gravatar (${domain})`);
      if (entry.aboutMe) addDataPoint(job.bios, entry.aboutMe, `Gravatar (${domain})`);
      if (entry.currentLocation) addDataPoint(job.locations, entry.currentLocation, `Gravatar (${domain})`);
    }
  }));
  job.progress = 70;

  // ── Hop 3: Pivot via linked usernames (cross-platform) ────────────────────
  if (job.hops >= 2) {
    job.currentTask = "Cross-platform pivot hop…";
    const toProbe = dedupe(job.linkedUsernames, "username")
      .filter(lu => !PLATFORMS.find(p => p.id.toLowerCase() === lu.platform.toLowerCase().replace(/\s+/, "")))
      .slice(0, 6);

    if (toProbe.length > 0) {
      await Promise.all(toProbe.map(async linked => {
        const resp = await fetchHead(linked.url);
        if (resp && resp.status >= 200 && resp.status < 400) {
          // If it's a GitHub link, fetch the API for the linked user too
          if (linked.platform.toLowerCase() === "github") {
            const gh = await fetchJson<GitHubUser>(`https://api.github.com/users/${encodeURIComponent(linked.username)}`);
            if (gh?.email) job.emails.push({ email: gh.email, source: `GitHub profile (via ${linked.discoveredVia})`, confidence: "high" });
            if (gh?.name) addDataPoint(job.names, gh.name, `GitHub/${linked.username}`);
            if (gh?.location) addDataPoint(job.locations, gh.location, `GitHub/${linked.username}`);
          }
        }
      }));
    }

    // Deep bio scrape: extract emails from all collected bios
    const bioTexts = job.bios.map(b => b.value).join(" ");
    const bioEmails = bioTexts.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) ?? [];
    for (const e of bioEmails) {
      if (!job.emails.some(ex => ex.email === e)) job.emails.push({ email: e, source: "Bio / about text", confidence: "medium" });
    }

    // Extract websites from bios
    const bioUrls = bioTexts.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
    for (const u of bioUrls) {
      if (!job.websites.some(w => w.value === u)) addDataPoint(job.websites, u, "Bio text");
    }
  }
  job.progress = 85;

  // ── Deduplication ──────────────────────────────────────────────────────────
  job.emails     = dedupe(job.emails, "email");
  job.names      = dedupe(job.names, "value");
  job.locations  = dedupe(job.locations, "value");
  job.websites   = dedupe(job.websites, "value");
  job.bios       = dedupe(job.bios, "value");
  job.companies  = dedupe(job.companies, "value");
  job.linkedUsernames = dedupe(job.linkedUsernames, "username");
  job.platforms  = dedupe(job.platforms, "platformId");

  // ── Risk score ─────────────────────────────────────────────────────────────
  const foundPlatforms = job.platforms.filter(p => p.found).length;
  const highConfEmails = job.emails.filter(e => e.confidence === "high").length;
  let score = 0;
  score += Math.min(foundPlatforms * 6, 40);
  score += Math.min(highConfEmails * 20, 40);
  score += job.names.length > 0 ? 10 : 0;
  score += job.locations.length > 0 ? 8 : 0;
  score += job.companies.length > 0 ? 5 : 0;
  score += job.linkedUsernames.length > 2 ? 8 : 0;
  job.riskScore = Math.min(score, 100);

  const cats: string[] = [];
  if (job.emails.length > 0) cats.push("Email addresses");
  if (job.names.length > 0) cats.push("Real name");
  if (job.locations.length > 0) cats.push("Location data");
  if (job.companies.length > 0) cats.push("Employer / company");
  if (foundPlatforms > 3) cats.push("Multi-platform presence");
  if (job.linkedUsernames.length > 0) cats.push("Cross-platform accounts");
  if (job.websites.length > 0) cats.push("Personal websites");
  job.exposureCategories = cats;

  // ── Summary ────────────────────────────────────────────────────────────────
  const parts: string[] = [];
  if (foundPlatforms > 0) parts.push(`Active on ${foundPlatforms} platform${foundPlatforms !== 1 ? "s" : ""}`);
  if (highConfEmails > 0) parts.push(`${highConfEmails} email${highConfEmails !== 1 ? "s" : ""} found`);
  if (job.names.length > 0) parts.push(`real name: "${job.names[0].value}"`);
  if (job.locations.length > 0) parts.push(`location: "${job.locations[0].value}"`);
  if (job.linkedUsernames.length > 0) parts.push(`${job.linkedUsernames.length} cross-platform account${job.linkedUsernames.length !== 1 ? "s" : ""} linked`);
  job.summary = parts.length ? parts.join(" · ") : "No significant public data found.";

  job.currentTask = "Complete";
  job.progress = 100;
  job.status = "complete";
  job.completedAt = new Date().toISOString();
}

// ── Routes ────────────────────────────────────────────────────────────────────

const SearchSchema = z.object({
  username: z.string().min(1).max(60).regex(/^[a-zA-Z0-9._\-]+$/, "Invalid username characters"),
  hops: z.number().int().min(1).max(3).default(2),
});

router.post("/search", async (req: Request, res: Response) => {
  const parsed = SearchSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Invalid input", issues: parsed.error.issues }); return; }

  const { username, hops } = parsed.data;
  const jobId = crypto.randomBytes(10).toString("hex");

  const job: UsernameJob = {
    jobId, username: username.toLowerCase().trim(), hops,
    status: "running",
    startedAt: new Date().toISOString(),
    progress: 0,
    currentTask: "Starting…",
    platformsChecked: 0,
    platforms: [],
    emails: [],
    names: [],
    locations: [],
    websites: [],
    bios: [],
    companies: [],
    linkedUsernames: [],
    riskScore: 0,
    exposureCategories: [],
    summary: "",
    createdAt: Date.now(),
  };
  JOBS.set(jobId, job);

  // Fire and forget
  runSearch(job).catch(err => {
    job.status = "error";
    job.summary = String(err);
  });

  res.json({ jobId });
});

router.get("/status/:jobId", (req: Request, res: Response) => {
  const job = JOBS.get(String(req.params.jobId));
  if (!job) { res.status(404).json({ error: "Job not found or expired" }); return; }
  res.json(job);
});

router.delete("/status/:jobId", (req: Request, res: Response) => {
  JOBS.delete(String(req.params.jobId));
  res.json({ ok: true });
});

export default router;
