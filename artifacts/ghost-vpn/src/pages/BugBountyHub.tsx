// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC — legal@alphauntechnologies.com
// Bug Bounty Research Hub — authorized security research across major platforms
import React, { useState, useMemo } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, DollarSign, ExternalLink, Shield, Target,
  ChevronDown, ChevronUp, Copy, CheckCircle2,
  AlertTriangle, Gamepad2, Globe, Code2, Zap,
  FileText, Award, Filter, BookOpen, Radio,
  Star, Clock, Users, Lock, Layers,
} from "lucide-react";

// ── Bug Bounty Program Database ──────────────────────────────────────────────
type Severity = "informational" | "low" | "medium" | "high" | "critical";
type Platform = "hackerone" | "bugcrowd" | "intigriti" | "msrc" | "google-vrp" | "meta" | "self-hosted" | "email";

type BountyProgram = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  category: "gaming" | "social" | "developer" | "streaming" | "console";
  platform: Platform;
  url: string;
  registrationUrl: string;
  scope: string[];
  outOfScope: string[];
  payouts: { severity: Severity; min: number; max: number }[];
  topBugs: string[];
  testingApproach: string[];
  disclosed: boolean;
  private: boolean;
  halOfFame: boolean;
  launched: string;
  notes?: string;
  domains: string[];
};

const PROGRAMS: BountyProgram[] = [
  // ── CONSOLE / GAMING NETWORKS ─────────────────────────────────────────────
  {
    id: "playstation",
    name: "PlayStation / Sony",
    emoji: "🎮",
    color: "#003791",
    category: "console",
    platform: "hackerone",
    url: "https://hackerone.com/playstation",
    registrationUrl: "https://hackerone.com/users/sign_up",
    scope: [
      "PlayStation Network (PSN) web platform",
      "PlayStation Store (store.playstation.com)",
      "PlayStation 4 & PS5 firmware & OS",
      "PlayStation Network APIs",
      "PlayStation App (iOS / Android)",
      "PlayStation accessories firmware",
      "PlayStation Direct store",
    ],
    outOfScope: [
      "Third-party games running on PSN",
      "Social engineering or phishing",
      "Denial of service attacks",
      "Physical attacks on hardware",
      "Issues requiring jailbroken/modified consoles",
    ],
    payouts: [
      { severity: "critical", min: 25000, max: 50000 },
      { severity: "high",     min: 5000,  max: 25000 },
      { severity: "medium",   min: 500,   max: 5000  },
      { severity: "low",      min: 100,   max: 500   },
      { severity: "informational", min: 0, max: 100  },
    ],
    topBugs: [
      "Authentication bypass on PSN login flow",
      "Account takeover via OAuth state parameter bypass",
      "IDOR exposing other users' purchase history or PII",
      "Privilege escalation via PS Store API",
      "Session token not invalidated on password change",
      "Cross-site scripting on playstation.com subdomains",
      "Insecure Direct Object Reference on trophy/friend APIs",
    ],
    testingApproach: [
      "Register your own PSN test account for all testing",
      "Enumerate subdomains: *.playstation.com, *.sonyentertainmentnetwork.com",
      "Proxy all PSN API calls through Burp/ZAP and map endpoints",
      "Test OAuth flow: inspect state param, redirect_uri, token handling",
      "Check all API responses for other users' data leakage",
      "Test session persistence after logout and password reset",
      "Inspect PS Store API for mass assignment or price manipulation",
    ],
    disclosed: true,
    private: false,
    halOfFame: true,
    launched: "2020-06-24",
    domains: ["playstation.com", "sonyentertainmentnetwork.com", "psn.com"],
  },
  {
    id: "xbox-microsoft",
    name: "Xbox Live / Microsoft",
    emoji: "🟢",
    color: "#107C10",
    category: "console",
    platform: "msrc",
    url: "https://msrc.microsoft.com/update-guide/vulnerability",
    registrationUrl: "https://msrc.microsoft.com/report/vulnerability",
    scope: [
      "Xbox Live services (account.xbox.com)",
      "Xbox Network / Xbox.com",
      "Microsoft Account (account.microsoft.com)",
      "Xbox mobile apps (iOS/Android)",
      "Xbox Game Pass / Cloud Gaming (xcloud)",
      "Xbox Dev / Partner Center",
      "Microsoft Store (games category)",
    ],
    outOfScope: [
      "Windows OS vulnerabilities (separate MSRC program)",
      "Third-party games sold on Xbox",
      "Issues requiring physical Xbox console access",
      "DDoS/DoS attacks",
    ],
    payouts: [
      { severity: "critical", min: 15000, max: 60000 },
      { severity: "high",     min: 3000,  max: 15000 },
      { severity: "medium",   min: 500,   max: 3000  },
      { severity: "low",      min: 150,   max: 500   },
      { severity: "informational", min: 0, max: 0    },
    ],
    topBugs: [
      "Microsoft Account authentication bypass",
      "Xbox Live IDOR on gamertag/profile APIs",
      "XSS on xbox.com or account.microsoft.com",
      "OAuth token leakage via open redirect",
      "Privilege escalation via Xbox Dev APIs",
      "Game Pass subscription manipulation",
      "Game save cloud storage path traversal",
    ],
    testingApproach: [
      "Create dedicated test Microsoft Account(s) for research",
      "Map Xbox Live REST API endpoints via Charles Proxy on console",
      "Focus on account.xbox.com and xsts.auth.xboxlive.com token flow",
      "Test cross-account data isolation on cloud saves and achievements",
      "Enumerate *.xbox.com and *.xboxlive.com subdomains",
      "Test Xbox Game Pass subscription status API for IDOR",
      "Review Xbox Dev Center for partner privilege escalation",
    ],
    disclosed: true,
    private: false,
    halOfFame: true,
    launched: "2013-07-11",
    domains: ["xbox.com", "xboxlive.com", "microsoft.com", "account.live.com"],
  },
  {
    id: "epic-games",
    name: "Epic Games",
    emoji: "🏆",
    color: "#0078F2",
    category: "gaming",
    platform: "hackerone",
    url: "https://hackerone.com/epicgames",
    registrationUrl: "https://hackerone.com/users/sign_up",
    scope: [
      "EpicGames.com web platform",
      "Epic Games Store APIs",
      "Fortnite game backend services",
      "Rocket League backend",
      "Fall Guys backend",
      "Epic Account Services / OAuth",
      "Epic Dev Portal",
    ],
    outOfScope: [
      "Game client-side cheating (report via cheat reporting)",
      "Issues in third-party titles distributed on EGS",
      "Social engineering",
      "Physical attacks",
    ],
    payouts: [
      { severity: "critical", min: 10000, max: 20000 },
      { severity: "high",     min: 2500,  max: 10000 },
      { severity: "medium",   min: 500,   max: 2500  },
      { severity: "low",      min: 100,   max: 500   },
      { severity: "informational", min: 0, max: 100  },
    ],
    topBugs: [
      "Epic Account OAuth CSRF or open redirect",
      "V-Bucks / in-game currency IDOR or manipulation",
      "Account takeover via Epic OAuth relying party misconfiguration",
      "Fortnite backend API exposed endpoints",
      "Epic Store price tampering via API replay",
      "Cross-game account data leakage",
    ],
    testingApproach: [
      "Create test Epic account — use epicgames.com/id/login OAuth flow",
      "Intercept Epic Account Services token exchange",
      "Test Fortnite backend endpoints: account-public-service-prod.ol.epicgames.com",
      "Map EGS API endpoints from Epic launcher traffic",
      "Test V-Bucks purchase API for replay or IDOR",
      "Check Epic Dev Portal for developer privilege escalation",
      "Enumerate *.epicgames.com subdomains with amass/subfinder",
    ],
    disclosed: true,
    private: false,
    halOfFame: true,
    launched: "2018-08-01",
    domains: ["epicgames.com", "unrealengine.com", "ol.epicgames.com"],
  },
  {
    id: "steam-valve",
    name: "Steam / Valve",
    emoji: "🎯",
    color: "#1B2838",
    category: "gaming",
    platform: "hackerone",
    url: "https://hackerone.com/valve",
    registrationUrl: "https://hackerone.com/users/sign_up",
    scope: [
      "Steam platform (store.steampowered.com)",
      "Steam Community (steamcommunity.com)",
      "Steamworks API (partner.steamgames.com)",
      "Steam login / OpenID",
      "CS2 game backend",
      "Dota 2 game backend",
      "Steam mobile app",
    ],
    outOfScope: [
      "Steam game client software (handled separately)",
      "Third-party games on Steam",
      "Hardware products (Steam Deck — contact separately)",
      "Valve employee systems",
    ],
    payouts: [
      { severity: "critical", min: 5000,  max: 30000 },
      { severity: "high",     min: 1000,  max: 5000  },
      { severity: "medium",   min: 200,   max: 1000  },
      { severity: "low",      min: 0,     max: 200   },
      { severity: "informational", min: 0, max: 0    },
    ],
    topBugs: [
      "Steam OpenID relying party bypass",
      "Steam market IDOR (access other users' listings)",
      "Remote code execution via Steam browser protocol handler",
      "Steam inventory manipulation / item duplication",
      "Steamworks API unauthorized partner access",
      "Steam community group privilege escalation",
      "SSRF in Steam link previewer",
    ],
    testingApproach: [
      "Use SteamSpy and Steam Web API to map public endpoints",
      "Test Steam OpenID login with your own test Steam account",
      "Inspect Steam Community API with valid session cookies",
      "Test trade offer / inventory API for IDOR between test accounts",
      "Monitor Steamworks SDK traffic for partner API endpoints",
      "Enumerate *.steampowered.com and *.steamcommunity.com",
      "Check for SSRF in Steam's link preview / store embed features",
    ],
    disclosed: true,
    private: true,
    halOfFame: true,
    launched: "2018-03-01",
    notes: "Invite-only for some scopes; public submissions reviewed",
    domains: ["steampowered.com", "steamcommunity.com", "steamgames.com"],
  },
  {
    id: "riot-games",
    name: "Riot Games",
    emoji: "⚔️",
    color: "#D13639",
    category: "gaming",
    platform: "hackerone",
    url: "https://hackerone.com/riot_games",
    registrationUrl: "https://hackerone.com/users/sign_up",
    scope: [
      "Riot Account (account.riotgames.com)",
      "League of Legends backend services",
      "Valorant backend services",
      "Teamfight Tactics backend",
      "Wild Rift backend",
      "Riot client authentication (auth.riotgames.com)",
      "Riot developer portal (developer.riotgames.com)",
    ],
    outOfScope: [
      "Vanguard anti-cheat (report separately)",
      "Game client cheating exploits",
      "Social engineering attacks",
      "Previously reported issues",
    ],
    payouts: [
      { severity: "critical", min: 15000, max: 25000 },
      { severity: "high",     min: 3000,  max: 15000 },
      { severity: "medium",   min: 500,   max: 3000  },
      { severity: "low",      min: 100,   max: 500   },
      { severity: "informational", min: 0, max: 100  },
    ],
    topBugs: [
      "Riot account OAuth PKCE bypass",
      "Cross-region account data leakage",
      "IDOR on match history or player stats APIs",
      "Valorant / LoL currency (RP) manipulation",
      "Developer API key privilege escalation",
      "Account takeover via password reset flow",
      "Riot Games API SSRF",
    ],
    testingApproach: [
      "Create test Riot accounts in multiple regions (NA, EUW)",
      "Map Riot API gateway: *.api.riotgames.com",
      "Test auth.riotgames.com OAuth PKCE flow carefully",
      "Use Riot Developer Portal to understand API structure",
      "Test cross-account isolation on match/stats endpoints",
      "Enumerate RSO (Riot Sign-On) token exchange vulnerabilities",
      "Check for RP purchase IDOR with two test accounts",
    ],
    disclosed: true,
    private: false,
    halOfFame: true,
    launched: "2019-09-01",
    domains: ["riotgames.com", "leagueoflegends.com", "valorant.com"],
  },
  {
    id: "blizzard-activision",
    name: "Blizzard / Activision",
    emoji: "⚡",
    color: "#009AE4",
    category: "gaming",
    platform: "hackerone",
    url: "https://hackerone.com/blizzard",
    registrationUrl: "https://hackerone.com/users/sign_up",
    scope: [
      "Battle.net accounts and authentication",
      "Battle.net web properties (*.battle.net)",
      "Overwatch 2 backend services",
      "World of Warcraft backend",
      "Diablo IV backend",
      "Call of Duty / Warzone (Activision account)",
      "Hearthstone mobile backend",
    ],
    outOfScope: [
      "WoW Classic private servers",
      "Social engineering or phishing",
      "Denial of service",
      "In-game rule violations (use cheating report)",
    ],
    payouts: [
      { severity: "critical", min: 10000, max: 20000 },
      { severity: "high",     min: 2000,  max: 10000 },
      { severity: "medium",   min: 300,   max: 2000  },
      { severity: "low",      min: 100,   max: 300   },
      { severity: "informational", min: 0, max: 100  },
    ],
    topBugs: [
      "Battle.net OAuth token leakage",
      "Call of Duty account merge IDOR",
      "WoW auction house API manipulation",
      "Battle.net two-factor bypass via backup code reuse",
      "Overwatch 2 currency (Overwatch Coins) IDOR",
      "Cross-game character/achievement data leakage",
      "COD Warzone stat manipulation via API replay",
    ],
    testingApproach: [
      "Create multiple Battle.net test accounts across regions",
      "Capture Battle.net OAuth flow with Burp Suite",
      "Map us.battle.net and eu.battle.net API endpoints",
      "Test COD Activision account link/unlink flow for IDOR",
      "Inspect WoW API token exchange (developer.battle.net)",
      "Test Overwatch 2 shop API with two test accounts",
      "Enumerate *.battle.net and *.blizzard.com subdomains",
    ],
    disclosed: true,
    private: false,
    halOfFame: true,
    launched: "2017-11-01",
    domains: ["battle.net", "blizzard.com", "activision.com"],
  },
  {
    id: "bungie",
    name: "Bungie (Destiny 2)",
    emoji: "🪐",
    color: "#4B7AC7",
    category: "gaming",
    platform: "hackerone",
    url: "https://hackerone.com/bungie",
    registrationUrl: "https://hackerone.com/users/sign_up",
    scope: [
      "Bungie.net web platform",
      "Bungie OAuth / Bungie account system",
      "Destiny 2 backend API (www.bungie.net/Platform/)",
      "Bungie mobile companion app",
      "Bungie third-party API (api.bungie.net)",
      "Bungie store (bungie.net/store)",
    ],
    outOfScope: [
      "Game client cheating or exploits in-game",
      "Previously disclosed issues",
      "Denial of service",
      "Social engineering",
    ],
    payouts: [
      { severity: "critical", min: 5000,  max: 15000 },
      { severity: "high",     min: 1500,  max: 5000  },
      { severity: "medium",   min: 300,   max: 1500  },
      { severity: "low",      min: 50,    max: 300   },
      { severity: "informational", min: 0, max: 50   },
    ],
    topBugs: [
      "Destiny 2 inventory/vault IDOR between accounts",
      "Bungie OAuth scope escalation",
      "Bungie.net XSS via clan description or username",
      "Shader / cosmetic item duplication via API",
      "Bungie Developer Portal key leakage",
      "Silver (premium currency) purchase replay attack",
    ],
    testingApproach: [
      "Register at bungie.net and explore the Destiny 2 API docs",
      "Use Bungie API documentation: bungie.net/en/Application/ApiUsage",
      "Get an API key from Bungie Developer Portal for legit enumeration",
      "Test Destiny 2 inventory endpoints with two character test accounts",
      "Monitor companion app traffic via MitM for hidden endpoints",
      "Check Silver purchase API for transaction replay",
    ],
    disclosed: true,
    private: false,
    halOfFame: true,
    launched: "2019-03-01",
    domains: ["bungie.net"],
  },
  {
    id: "ea-electronic-arts",
    name: "Electronic Arts (EA)",
    emoji: "⚽",
    color: "#F56C2D",
    category: "gaming",
    platform: "bugcrowd",
    url: "https://bugcrowd.com/ea",
    registrationUrl: "https://bugcrowd.com/user/sign_up",
    scope: [
      "EA.com web platform",
      "EA Account system (accounts.ea.com)",
      "Origin / EA App services",
      "EA Sports FC (formerly FIFA) backend",
      "Apex Legends backend services",
      "Battlefield backend services",
      "EA mobile game backend APIs",
    ],
    outOfScope: [
      "Game client exploits and cheating (use cheat report)",
      "Previously reported issues",
      "Denial of service",
      "Social engineering",
      "Third-party EA licensed games",
    ],
    payouts: [
      { severity: "critical", min: 8000,  max: 15000 },
      { severity: "high",     min: 2000,  max: 8000  },
      { severity: "medium",   min: 300,   max: 2000  },
      { severity: "low",      min: 100,   max: 300   },
      { severity: "informational", min: 0, max: 100  },
    ],
    topBugs: [
      "EA Account IDOR exposing billing/PII",
      "EA Sports FUT (Ultimate Team) coin manipulation",
      "Apex Legends apex coin purchase replay",
      "EA App OAuth token leakage or open redirect",
      "EA Account password reset token reuse",
      "Mass assignment on EA profile update API",
    ],
    testingApproach: [
      "Create EA test accounts: accounts.ea.com",
      "Map EA API endpoints using EA App network traffic",
      "Test FUT market API for price manipulation with test accounts",
      "Enumerate *.ea.com, *.origin.com subdomains",
      "Test account link/unlink (Steam, PSN) for IDOR",
      "Inspect Apex Legends crafting API for item duplication",
    ],
    disclosed: true,
    private: false,
    halOfFame: true,
    launched: "2018-04-01",
    domains: ["ea.com", "origin.com", "electronicarts.com"],
  },
  {
    id: "ubisoft",
    name: "Ubisoft Connect",
    emoji: "🔷",
    color: "#0070FF",
    category: "gaming",
    platform: "intigriti",
    url: "https://app.intigriti.com/programs/ubisoft/ubisoft/detail",
    registrationUrl: "https://app.intigriti.com/register",
    scope: [
      "Ubisoft Connect platform (connect.ubisoft.com)",
      "Ubisoft account system (account.ubisoft.com)",
      "Rainbow Six Siege backend",
      "Assassin's Creed backend",
      "Far Cry backend",
      "Ubisoft Store",
      "Ubisoft mobile game backends",
    ],
    outOfScope: [
      "Game client cheating",
      "Issues requiring physical access",
      "Social engineering",
      "Denial of service attacks",
    ],
    payouts: [
      { severity: "critical", min: 8000,  max: 20000 },
      { severity: "high",     min: 2000,  max: 8000  },
      { severity: "medium",   min: 400,   max: 2000  },
      { severity: "low",      min: 100,   max: 400   },
      { severity: "informational", min: 0, max: 100  },
    ],
    topBugs: [
      "Ubisoft Connect OAuth PKCE downgrade",
      "R6 Siege rank/stats API IDOR",
      "Ubisoft Store purchase manipulation",
      "Ubisoft Account password reset token fixation",
      "Cross-game progression data leakage",
      "Ubisoft Dev API key exposure",
    ],
    testingApproach: [
      "Register Ubisoft test accounts at account.ubisoft.com",
      "Capture Ubisoft Connect authentication flow in Burp",
      "Map connect.ubisoft.com API endpoints from client traffic",
      "Test R6 Siege stats API with two test accounts for IDOR",
      "Check Ubisoft Store for price manipulation or replay attacks",
      "Enumerate *.ubisoft.com and *.ubi.com subdomains",
    ],
    disclosed: true,
    private: false,
    halOfFame: true,
    launched: "2021-02-01",
    domains: ["ubisoft.com", "ubi.com"],
  },
  {
    id: "roblox",
    name: "Roblox",
    emoji: "🧱",
    color: "#E74C3C",
    category: "gaming",
    platform: "hackerone",
    url: "https://hackerone.com/roblox",
    registrationUrl: "https://hackerone.com/users/sign_up",
    scope: [
      "Roblox.com web platform",
      "Roblox API (api.roblox.com)",
      "Roblox authentication endpoints",
      "Roblox Developer Exchange (DevEx)",
      "Roblox mobile apps (iOS/Android)",
      "Roblox Studio backend",
      "Creator Marketplace",
    ],
    outOfScope: [
      "Individual Roblox games made by developers",
      "Roblox Studio client-side exploits",
      "Social engineering",
      "Denial of service",
    ],
    payouts: [
      { severity: "critical", min: 5000,  max: 10000 },
      { severity: "high",     min: 1000,  max: 5000  },
      { severity: "medium",   min: 200,   max: 1000  },
      { severity: "low",      min: 50,    max: 200   },
      { severity: "informational", min: 0, max: 50   },
    ],
    topBugs: [
      "Robux IDOR or purchase manipulation",
      "Roblox account takeover via email verification bypass",
      "CSRF on Roblox trade/inventory endpoints",
      "DevEx payout manipulation via API",
      "Group funds IDOR between Roblox groups",
      "Roblox Creator Marketplace item theft",
    ],
    testingApproach: [
      "Create test Roblox accounts (under-13 and over-13 for age gating)",
      "Map Roblox API using documentation: create.roblox.com/docs",
      "Use Roblox .ROBLOSECURITY cookie with API endpoints",
      "Test economy API for Robux IDOR between test accounts",
      "Test group funds API with separate test group owners",
      "Check DevEx payout API for manipulation",
    ],
    disclosed: true,
    private: false,
    halOfFame: true,
    launched: "2018-01-01",
    domains: ["roblox.com", "rbxcdn.com"],
  },
  {
    id: "nintendo",
    name: "Nintendo",
    emoji: "🔴",
    color: "#E4000F",
    category: "console",
    platform: "email",
    url: "https://www.nintendo.com/consumer/contact.jsp",
    registrationUrl: "https://www.nintendo.com/consumer/contact.jsp",
    scope: [
      "Nintendo Account (accounts.nintendo.com)",
      "Nintendo Switch Online services",
      "My Nintendo platform",
      "Nintendo eShop",
      "Nintendo web properties (*.nintendo.com)",
      "Nintendo mobile apps",
    ],
    outOfScope: [
      "Nintendo game client exploits",
      "Hardware vulnerabilities requiring physical access",
      "Social engineering",
      "Denial of service",
    ],
    payouts: [
      { severity: "critical", min: 1000,  max: 10000 },
      { severity: "high",     min: 500,   max: 1000  },
      { severity: "medium",   min: 100,   max: 500   },
      { severity: "low",      min: 0,     max: 100   },
      { severity: "informational", min: 0, max: 0    },
    ],
    topBugs: [
      "Nintendo Account OAuth bypass or token leakage",
      "eShop purchase IDOR",
      "Switch Online save data path traversal",
      "My Nintendo Gold Point manipulation",
      "Nintendo Family Group privilege escalation",
      "Nintendo Account password reset token reuse",
    ],
    testingApproach: [
      "Create test Nintendo Accounts at accounts.nintendo.com",
      "Map Nintendo Account API from Switch system traffic",
      "Focus on accounts.nintendo.com OAuth endpoints",
      "Test eShop API for price manipulation with test wallet",
      "Check Switch Online save sync API for IDOR",
      "Submit findings via security@nintendo.com with full PoC",
    ],
    disclosed: false,
    private: false,
    halOfFame: false,
    launched: "2019-01-01",
    notes: "Email-based program — no public HackerOne; rewards given case-by-case",
    domains: ["nintendo.com", "accounts.nintendo.com"],
  },
  // ── SOCIAL MEDIA PLATFORMS ────────────────────────────────────────────────
  {
    id: "meta-facebook",
    name: "Meta (Facebook / Instagram / WhatsApp)",
    emoji: "📘",
    color: "#1877F2",
    category: "social",
    platform: "meta",
    url: "https://www.facebook.com/whitehat",
    registrationUrl: "https://www.facebook.com/whitehat/report",
    scope: [
      "Facebook.com and all subdomains",
      "Instagram (instagram.com, API)",
      "WhatsApp web and APIs",
      "Messenger platform",
      "Meta Quest (Oculus) platform",
      "Threads (threads.net)",
      "Meta Business Suite",
      "Meta developer platform (developers.facebook.com)",
    ],
    outOfScope: [
      "Spam or fake account creation",
      "Social engineering attacks",
      "Physical attacks on Meta infrastructure",
      "Rate limiting issues without security impact",
      "Missing security headers without PoC impact",
    ],
    payouts: [
      { severity: "critical", min: 40000, max: 750000 },
      { severity: "high",     min: 10000, max: 40000  },
      { severity: "medium",   min: 1000,  max: 10000  },
      { severity: "low",      min: 500,   max: 1000   },
      { severity: "informational", min: 0, max: 500   },
    ],
    topBugs: [
      "Account takeover via Facebook OAuth open redirect",
      "IDOR on Graph API exposing private user data",
      "Instagram private content bypass via API",
      "WhatsApp message interception via signal protocol flaw",
      "Meta Business Suite privilege escalation",
      "Instagram Reels / Stories media IDOR",
      "Facebook password reset token replay attack",
    ],
    testingApproach: [
      "Create multiple Meta test accounts and a test Facebook App",
      "Use Graph API Explorer to map available endpoints",
      "Test OAuth flows with your own test App client_id",
      "Enumerate *.facebook.com, *.fbcdn.net subdomains",
      "Test Instagram Basic Display API vs Graph API access control",
      "Check WhatsApp Business API for message IDOR",
      "Test Meta Business Manager role escalation between test accounts",
    ],
    disclosed: true,
    private: false,
    halOfFame: true,
    launched: "2011-07-01",
    domains: ["facebook.com", "instagram.com", "whatsapp.com", "threads.net", "meta.com"],
  },
  {
    id: "google-youtube",
    name: "Google / YouTube",
    emoji: "▶️",
    color: "#FF0000",
    category: "social",
    platform: "google-vrp",
    url: "https://bughunters.google.com",
    registrationUrl: "https://bughunters.google.com/profile",
    scope: [
      "YouTube.com platform",
      "YouTube Data API v3",
      "YouTube Studio",
      "Google Account (accounts.google.com)",
      "Google OAuth 2.0 infrastructure",
      "Google Play (play.google.com)",
      "All *.google.com and *.youtube.com",
    ],
    outOfScope: [
      "Chrome browser vulnerabilities (separate program)",
      "Android OS (separate Android VRP)",
      "Physical attacks on Google infrastructure",
      "Social engineering",
    ],
    payouts: [
      { severity: "critical", min: 25000, max: 500000 },
      { severity: "high",     min: 7500,  max: 25000  },
      { severity: "medium",   min: 1000,  max: 7500   },
      { severity: "low",      min: 500,   max: 1000   },
      { severity: "informational", min: 0, max: 500   },
    ],
    topBugs: [
      "Google Account OAuth PKCE bypass",
      "YouTube channel data IDOR via private API",
      "YouTube Studio revenue data leakage across channels",
      "Google OAuth open redirect enabling token theft",
      "YouTube private video URL enumeration",
      "Google Play developer account privilege escalation",
      "XSS via YouTube video description",
    ],
    testingApproach: [
      "Create Google test accounts and a Google Cloud Project",
      "Use Google OAuth 2.0 Playground to map token flows",
      "Enumerate YouTube API endpoints from documentation",
      "Test YouTube Studio API with two creator test accounts",
      "Map *.youtube.com and *.ytimg.com subdomains",
      "Test Google Play developer portal for IDOR",
      "Use Burp Suite to capture YouTube Studio traffic",
    ],
    disclosed: true,
    private: false,
    halOfFame: true,
    launched: "2010-11-01",
    domains: ["google.com", "youtube.com", "ytimg.com", "googleapis.com"],
  },
  {
    id: "discord",
    name: "Discord",
    emoji: "🎮",
    color: "#5865F2",
    category: "social",
    platform: "hackerone",
    url: "https://hackerone.com/discord",
    registrationUrl: "https://hackerone.com/users/sign_up",
    scope: [
      "Discord.com web platform",
      "Discord API (discord.com/api)",
      "Discord Bot API",
      "Discord OAuth2 infrastructure",
      "Discord mobile apps (iOS/Android)",
      "Discord Activities / Embedded Apps",
      "Discord Developer Portal",
    ],
    outOfScope: [
      "Discord bots made by third parties",
      "Server invite link enumeration",
      "Social engineering",
      "Denial of service",
      "Spam or mass messaging",
    ],
    payouts: [
      { severity: "critical", min: 5000,  max: 10000 },
      { severity: "high",     min: 1000,  max: 5000  },
      { severity: "medium",   min: 250,   max: 1000  },
      { severity: "low",      min: 50,    max: 250   },
      { severity: "informational", min: 0, max: 50   },
    ],
    topBugs: [
      "Discord OAuth2 state param CSRF",
      "Bot token leakage via webhook redirect",
      "Discord Nitro subscription IDOR",
      "Server ban bypass via invite exploit",
      "XSS via Discord embedded activity",
      "Discord DM content leakage via API",
      "Account takeover via email verification bypass",
    ],
    testingApproach: [
      "Create test Discord accounts and a Developer Application",
      "Use Discord API documentation (discord.com/developers/docs)",
      "Test OAuth2 flow with your own test bot application",
      "Enumerate Discord API endpoints via Burp interception",
      "Test server role manipulation between test accounts",
      "Check Discord Nitro gift API for replay or IDOR",
      "Test webhook endpoints for SSRF or data leakage",
    ],
    disclosed: true,
    private: false,
    halOfFame: true,
    launched: "2016-06-01",
    domains: ["discord.com", "discordapp.com", "discordcdn.com"],
  },
  {
    id: "reddit",
    name: "Reddit",
    emoji: "🤖",
    color: "#FF4500",
    category: "social",
    platform: "hackerone",
    url: "https://hackerone.com/reddit",
    registrationUrl: "https://hackerone.com/users/sign_up",
    scope: [
      "Reddit.com platform",
      "Reddit API (old.reddit.com/api and oauth.reddit.com)",
      "Reddit OAuth2 infrastructure",
      "Reddit mobile apps (iOS/Android)",
      "Reddit Developer Platform (developers.reddit.com)",
      "Reddit Ads Manager",
      "Reddit Premium / Coins",
    ],
    outOfScope: [
      "Vote manipulation",
      "Spam and fake account creation",
      "Social engineering",
      "Denial of service",
      "Issues on third-party Reddit apps",
    ],
    payouts: [
      { severity: "critical", min: 5000,  max: 10000 },
      { severity: "high",     min: 1000,  max: 5000  },
      { severity: "medium",   min: 200,   max: 1000  },
      { severity: "low",      min: 50,    max: 200   },
      { severity: "informational", min: 0, max: 50   },
    ],
    topBugs: [
      "Reddit OAuth2 token leakage via referrer",
      "Subreddit moderator privilege escalation",
      "Reddit Coins / Awards IDOR",
      "Private subreddit content access bypass",
      "Reddit CSRF on account settings",
      "Reddit ad targeting data exposure",
    ],
    testingApproach: [
      "Register Reddit developer app at reddit.com/prefs/apps",
      "Use Reddit API documentation (reddit.com/dev/api)",
      "Test OAuth2 flow: implicit vs code grant differences",
      "Map API endpoints via old.reddit.com and oauth.reddit.com",
      "Test private subreddit access with non-member accounts",
      "Check Reddit Coins gift API for IDOR between test accounts",
    ],
    disclosed: true,
    private: false,
    halOfFame: true,
    launched: "2017-02-01",
    domains: ["reddit.com", "redd.it", "redditstatic.com"],
  },
  {
    id: "github",
    name: "GitHub",
    emoji: "🐙",
    color: "#24292F",
    category: "developer",
    platform: "hackerone",
    url: "https://hackerone.com/github",
    registrationUrl: "https://hackerone.com/users/sign_up",
    scope: [
      "GitHub.com platform",
      "GitHub API (api.github.com)",
      "GitHub OAuth Apps and GitHub Apps",
      "GitHub Actions infrastructure",
      "GitHub Enterprise Server",
      "GitHub Packages",
      "GitHub Codespaces",
      "GitHub Copilot (limited)",
    ],
    outOfScope: [
      "Third-party GitHub Actions",
      "Social engineering",
      "Physical data center attacks",
      "Denial of service",
    ],
    payouts: [
      { severity: "critical", min: 15000, max: 30000 },
      { severity: "high",     min: 5000,  max: 15000 },
      { severity: "medium",   min: 1000,  max: 5000  },
      { severity: "low",      min: 500,   max: 1000  },
      { severity: "informational", min: 0, max: 500  },
    ],
    topBugs: [
      "GitHub OAuth App token leakage",
      "IDOR on private repository data",
      "GitHub Actions secret exfiltration",
      "GitHub Pages XSS via jekyll injection",
      "Enterprise privilege escalation via SSO",
      "Repository import SSRF",
      "GitHub Codespaces environment variable leakage",
    ],
    testingApproach: [
      "Use your own GitHub account and create test organizations",
      "Register a GitHub OAuth App for token flow testing",
      "Map GitHub API with documented endpoints: docs.github.com/rest",
      "Test cross-repo IDOR with two test accounts",
      "Set up a test GitHub Actions workflow to probe runner environment",
      "Test GitHub Pages for XSS via markdown / jekyll",
      "Check GitHub Packages API for access control bypass",
    ],
    disclosed: true,
    private: false,
    halOfFame: true,
    launched: "2013-01-01",
    domains: ["github.com", "githubusercontent.com", "githubassets.com"],
  },
  {
    id: "twitch",
    name: "Twitch",
    emoji: "🎥",
    color: "#9146FF",
    category: "streaming",
    platform: "hackerone",
    url: "https://hackerone.com/twitch",
    registrationUrl: "https://hackerone.com/users/sign_up",
    scope: [
      "Twitch.tv web platform",
      "Twitch API (api.twitch.tv)",
      "Twitch OAuth infrastructure",
      "Twitch mobile apps (iOS/Android)",
      "Twitch Extensions (limited scope)",
      "Twitch Bits / Subscriptions",
      "Twitch Developer Portal",
    ],
    outOfScope: [
      "View botting or artificial inflation",
      "Social engineering",
      "Third-party Twitch extensions",
      "Denial of service",
    ],
    payouts: [
      { severity: "critical", min: 5000,  max: 15000 },
      { severity: "high",     min: 1500,  max: 5000  },
      { severity: "medium",   min: 300,   max: 1500  },
      { severity: "low",      min: 50,    max: 300   },
      { severity: "informational", min: 0, max: 50   },
    ],
    topBugs: [
      "Twitch OAuth open redirect enabling token theft",
      "Twitch Bits purchase IDOR",
      "Streamer payout data leakage via API",
      "Twitch subscription gifting replay attack",
      "Twitch ban evasion via API endpoint",
      "XSS via Twitch chat emote embed",
    ],
    testingApproach: [
      "Register a Twitch Developer Application at dev.twitch.tv",
      "Use Twitch API Reference: dev.twitch.tv/docs/api",
      "Test OAuth implicit vs authorization code flows",
      "Map Twitch Helix API endpoints via Burp interception",
      "Test Bits and subscription API between two test accounts",
      "Check streamer dashboard API for IDOR between test creators",
    ],
    disclosed: true,
    private: false,
    halOfFame: true,
    launched: "2019-03-01",
    domains: ["twitch.tv", "twitchapps.com", "jtvnw.net"],
  },
  {
    id: "twitter-x",
    name: "Twitter / X",
    emoji: "🐦",
    color: "#000000",
    category: "social",
    platform: "hackerone",
    url: "https://hackerone.com/x",
    registrationUrl: "https://hackerone.com/users/sign_up",
    scope: [
      "Twitter.com / X.com platform",
      "Twitter API (api.twitter.com, api.x.com)",
      "Twitter OAuth 1.0a and 2.0 flows",
      "Twitter mobile apps (iOS/Android)",
      "Twitter Ads platform",
      "Twitter Developer Portal",
    ],
    outOfScope: [
      "Social engineering",
      "Denial of service",
      "Third-party Twitter apps",
      "Spam and fake account creation",
    ],
    payouts: [
      { severity: "critical", min: 10000, max: 20000 },
      { severity: "high",     min: 2500,  max: 10000 },
      { severity: "medium",   min: 500,   max: 2500  },
      { severity: "low",      min: 100,   max: 500   },
      { severity: "informational", min: 0, max: 100  },
    ],
    topBugs: [
      "Twitter OAuth 1.0a nonce prediction",
      "DM content leakage via API endpoint",
      "Account suspension bypass via API",
      "Twitter Ads IDOR exposing competitor campaigns",
      "XSS on Twitter card embeds",
      "Twitter Blue / Premium subscription IDOR",
    ],
    testingApproach: [
      "Register a Twitter Developer App at developer.twitter.com",
      "Study Twitter API v2 documentation thoroughly",
      "Test OAuth 1.0a and OAuth 2.0 PKCE flows with test accounts",
      "Map Twitter API endpoints via Burp — focus on DM and account APIs",
      "Test Ads API for IDOR between two test advertiser accounts",
      "Check Twitter Blue API endpoints for subscription bypass",
    ],
    disclosed: true,
    private: false,
    halOfFame: true,
    launched: "2014-01-01",
    domains: ["twitter.com", "x.com", "t.co", "twimg.com"],
  },
  {
    id: "spotify",
    name: "Spotify",
    emoji: "🎧",
    color: "#1DB954",
    category: "streaming",
    platform: "hackerone",
    url: "https://hackerone.com/spotify",
    registrationUrl: "https://hackerone.com/users/sign_up",
    scope: [
      "Spotify.com web platform",
      "Spotify Web API (api.spotify.com)",
      "Spotify OAuth 2.0 infrastructure",
      "Spotify mobile apps (iOS/Android)",
      "Spotify for Developers portal",
      "Spotify Premium subscriptions",
    ],
    outOfScope: [
      "Social engineering",
      "Denial of service",
      "Third-party Spotify apps",
      "Stream count manipulation",
    ],
    payouts: [
      { severity: "critical", min: 5000,  max: 10000 },
      { severity: "high",     min: 1000,  max: 5000  },
      { severity: "medium",   min: 200,   max: 1000  },
      { severity: "low",      min: 50,    max: 200   },
      { severity: "informational", min: 0, max: 50   },
    ],
    topBugs: [
      "Spotify OAuth PKCE code challenge bypass",
      "Spotify Premium IDOR via subscription API",
      "Private playlist content exposure via link",
      "Spotify Connect device hijacking",
      "Spotify Partner API key leakage",
    ],
    testingApproach: [
      "Register Spotify Developer Application at developer.spotify.com",
      "Study Spotify Web API documentation",
      "Test PKCE OAuth flow with two test accounts",
      "Map api.spotify.com endpoints via Burp interception",
      "Test playlist visibility settings for private content bypass",
    ],
    disclosed: true,
    private: false,
    halOfFame: true,
    launched: "2017-06-01",
    domains: ["spotify.com", "scdn.co"],
  },
];

// ── Platform mapping ─────────────────────────────────────────────────────────
const PLATFORM_LABELS: Record<Platform, string> = {
  "hackerone":  "HackerOne",
  "bugcrowd":   "Bugcrowd",
  "intigriti":  "Intigriti",
  "msrc":       "Microsoft MSRC",
  "google-vrp": "Google VRP",
  "meta":       "Meta Whitehat",
  "self-hosted":"Self-Hosted",
  "email":      "Email Disclosure",
};

const PLATFORM_COLORS: Record<Platform, string> = {
  "hackerone":  "bg-orange-900 text-orange-300 border-orange-800",
  "bugcrowd":   "bg-purple-900 text-purple-300 border-purple-800",
  "intigriti":  "bg-blue-900 text-blue-300 border-blue-800",
  "msrc":       "bg-blue-900 text-blue-300 border-blue-800",
  "google-vrp": "bg-green-900 text-green-300 border-green-800",
  "meta":       "bg-blue-900 text-blue-300 border-blue-800",
  "self-hosted":"bg-gray-800 text-gray-300 border-gray-700",
  "email":      "bg-gray-800 text-gray-300 border-gray-700",
};

const SEV_COLORS: Record<Severity, string> = {
  critical:      "text-red-400 bg-red-950/50 border-red-900",
  high:          "text-orange-400 bg-orange-950/50 border-orange-900",
  medium:        "text-yellow-400 bg-yellow-950/50 border-yellow-900",
  low:           "text-blue-400 bg-blue-950/50 border-blue-900",
  informational: "text-gray-400 bg-gray-800 border-gray-700",
};

function formatMoney(n: number) {
  if (n >= 1000) return `$${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k`;
  return `$${n}`;
}

// ── Report template ──────────────────────────────────────────────────────────
function generateReport(program: BountyProgram, severity: Severity, vulnType: string, endpoint: string, description: string, impact: string, steps: string): string {
  const date = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  return `# ${vulnType} — ${program.name}

**Reported:** ${date}
**Program:** ${program.url}
**Severity:** ${severity.toUpperCase()}
**CVSS (estimated):** ${severity === "critical" ? "9.0-10.0" : severity === "high" ? "7.0-8.9" : severity === "medium" ? "4.0-6.9" : "0.1-3.9"}

---

## Summary
${description || "[Describe the vulnerability clearly — what it is, where it is, and why it is a security issue]"}

## Affected Endpoint / Asset
\`${endpoint || "[e.g. https://api.example.com/v1/user/profile]"}\`

## Vulnerability Details
[Explain the root cause — missing access control, logic flaw, injection, etc.]

## Steps to Reproduce
${steps || `1. Log in with test account A at ${program.url}
2. Navigate to [endpoint]
3. Modify [parameter] to reference account B's data
4. Observe that account B's private data is returned`}

## Impact
${impact || "[Describe what an attacker could do — account takeover, data theft, financial manipulation, etc.]"}

## Evidence
- [Screenshots or Burp Suite export]
- [Request/Response pairs showing the vulnerability]
- [Video proof of concept if applicable]

## Suggested Remediation
- [Specific fix recommendation — access control check, input validation, etc.]
- [Test case to verify the fix]

---
*Reported in good faith under the ${program.name} Bug Bounty Program. No data was exfiltrated or used for any purpose other than demonstrating this vulnerability. All testing was performed on my own test accounts.*

*Researcher: [Your HackerOne / Bugcrowd username]*
*Contact: [Your email]*`;
}

// ── Main component ───────────────────────────────────────────────────────────
export default function BugBountyHub() {
  const [] = useLocation();
  const [search, setSearch] = usePersistedState<string>("bugbounty-search", "");
  const [categoryFilter, setCategoryFilter] = usePersistedState<string>("bugbounty-category", "all");
  const [platformFilter, setPlatformFilter] = usePersistedState<string>("bugbounty-platform", "all");
  const [selectedProgram, setSelectedProgram] = useState<BountyProgram | null>(null);
  const [activeTab, setActiveTab] = usePersistedState<"overview" | "scope" | "testing" | "report">("bugbounty-tab", "overview");
  const [expandedSection, setExpandedSection] = useState<string | null>("bugs");
  const [copied, setCopied] = useState(false);

  // Report generator state
  const [reportSeverity, setReportSeverity] = useState<Severity>("high");
  const [reportVulnType, setReportVulnType] = useState("");
  const [reportEndpoint, setReportEndpoint] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [reportImpact, setReportImpact] = useState("");
  const [reportSteps, setReportSteps] = useState("");

  const filtered = useMemo(() => {
    return PROGRAMS.filter(p => {
      const q = search.toLowerCase();
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.domains.some(d => d.includes(q));
      const matchCat = categoryFilter === "all" || p.category === categoryFilter;
      const matchPlat = platformFilter === "all" || p.platform === platformFilter;
      return matchSearch && matchCat && matchPlat;
    });
  }, [search, categoryFilter, platformFilter]);

  const totalMaxPayout = useMemo(() =>
    PROGRAMS.reduce((sum, p) => sum + (p.payouts.find(x => x.severity === "critical")?.max ?? 0), 0),
    []
  );

  const copyReport = () => {
    if (!selectedProgram) return;
    const text = generateReport(selectedProgram, reportSeverity, reportVulnType, reportEndpoint, reportDescription, reportImpact, reportSteps);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const toggle = (key: string) => setExpandedSection(prev => prev === key ? null : key);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 p-4 md:p-6 max-w-7xl mx-auto space-y-5">

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Award className="h-7 w-7 text-yellow-400" />
          <h1 className="text-2xl font-black text-white">Bug Bounty Research Hub</h1>
          <Badge className="bg-yellow-900 text-yellow-300 border-yellow-700">{PROGRAMS.length} Programs</Badge>
          <Badge className="bg-green-900 text-green-300 border-green-700">Up to ${(totalMaxPayout / 1000000).toFixed(1)}M+ Potential</Badge>
        </div>
        <p className="text-gray-400 text-sm">
          Authorized security research across major gaming, social, and streaming platforms. Register with each program before testing. All research must comply with program rules.
        </p>

        {/* Disclosure notice */}
        <div className="mt-3 flex items-start gap-2.5 bg-amber-950/30 border border-amber-900/60 rounded-lg px-4 py-2.5 text-xs text-amber-400">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>You <strong>must register with each bug bounty platform</strong> (HackerOne, Bugcrowd, etc.) and read the program policy before any testing. Only test using your own test accounts. Never access, store, or share other users' data.</span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Gaming Programs",   value: PROGRAMS.filter(p => p.category === "gaming" || p.category === "console").length, icon: Gamepad2, color: "text-blue-400" },
          { label: "Social Programs",   value: PROGRAMS.filter(p => p.category === "social" || p.category === "streaming").length, icon: Globe, color: "text-purple-400" },
          { label: "Public Programs",   value: PROGRAMS.filter(p => !p.private).length, icon: Radio, color: "text-green-400" },
          { label: "Hall of Fame",      value: PROGRAMS.filter(p => p.halOfFame).length, icon: Star, color: "text-yellow-400" },
        ].map(stat => (
          <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
            <stat.icon className={`h-6 w-6 ${stat.color} shrink-0`} />
            <div>
              <div className="text-2xl font-black text-white">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* ── Program List ──────────────────────────────────────────────── */}
        <div className="xl:col-span-1 space-y-3">

          {/* Filters */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search programs..."
                className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-800 transition-colors" />
            </div>
            <div className="flex gap-2">
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-800">
                <option value="all">All Categories</option>
                <option value="console">Console</option>
                <option value="gaming">PC Gaming</option>
                <option value="social">Social Media</option>
                <option value="streaming">Streaming</option>
                <option value="developer">Developer</option>
              </select>
              <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-800">
                <option value="all">All Platforms</option>
                <option value="hackerone">HackerOne</option>
                <option value="bugcrowd">Bugcrowd</option>
                <option value="intigriti">Intigriti</option>
                <option value="msrc">MSRC</option>
                <option value="google-vrp">Google VRP</option>
                <option value="meta">Meta</option>
                <option value="email">Email</option>
              </select>
            </div>
          </div>

          {/* Program cards */}
          <div className="space-y-2 max-h-[700px] overflow-y-auto">
            {filtered.map(p => {
              const critPayout = p.payouts.find(x => x.severity === "critical");
              return (
                <button key={p.id} onClick={() => { setSelectedProgram(p); setActiveTab("overview"); }}
                  className={`w-full text-left bg-gray-900 border rounded-xl px-4 py-3 transition-all hover:border-yellow-800 ${selectedProgram?.id === p.id ? "border-yellow-700 bg-yellow-950/10" : "border-gray-800"}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl shrink-0">{p.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">{p.name}</span>
                        {p.private && <Badge className="text-[9px] bg-gray-800 text-gray-500 border-gray-700">Private</Badge>}
                        {p.halOfFame && <Star className="h-3 w-3 text-yellow-500" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge className={`text-[9px] px-1 py-0.5 ${PLATFORM_COLORS[p.platform]}`}>{PLATFORM_LABELS[p.platform]}</Badge>
                        {critPayout && <span className="text-[10px] text-green-400 font-bold">Up to {formatMoney(critPayout.max)}</span>}
                      </div>
                    </div>
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center text-gray-600 text-sm py-8">No programs match your filters</div>
            )}
          </div>
        </div>

        {/* ── Program Detail ────────────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-4">

          {!selectedProgram ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
              <Award className="h-12 w-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">Select a bug bounty program to see scope, testing methodology, and report templates</p>
            </div>
          ) : (
            <>
              {/* Program header */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5" style={{ borderTopColor: selectedProgram.color, borderTopWidth: 2 }}>
                <div className="flex items-start gap-4 mb-4">
                  <span className="text-4xl shrink-0">{selectedProgram.emoji}</span>
                  <div className="flex-1">
                    <h2 className="text-xl font-black text-white mb-1">{selectedProgram.name}</h2>
                    <div className="flex flex-wrap gap-2 mb-2">
                      <Badge className={`text-xs ${PLATFORM_COLORS[selectedProgram.platform]}`}>{PLATFORM_LABELS[selectedProgram.platform]}</Badge>
                      {selectedProgram.private && <Badge className="text-xs bg-purple-900 text-purple-300 border-purple-800">Private Program</Badge>}
                      {selectedProgram.halOfFame && <Badge className="text-xs bg-yellow-900 text-yellow-300 border-yellow-800">⭐ Hall of Fame</Badge>}
                      <Badge className="text-xs bg-gray-800 text-gray-300 border-gray-700">
                        <Clock className="h-2.5 w-2.5 inline mr-1" />Since {new Date(selectedProgram.launched).getFullYear()}
                      </Badge>
                    </div>
                    {selectedProgram.notes && (
                      <p className="text-xs text-amber-500">{selectedProgram.notes}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 shrink-0">
                    <a href={selectedProgram.registrationUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs font-bold bg-yellow-700 hover:bg-yellow-600 text-black px-3 py-2 rounded-lg transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" /> Register
                    </a>
                    <a href={selectedProgram.url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs font-bold bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded-lg transition-colors">
                      <BookOpen className="h-3.5 w-3.5" /> Program Page
                    </a>
                  </div>
                </div>

                {/* Payout table */}
                <div className="grid grid-cols-5 gap-1.5">
                  {selectedProgram.payouts.map(({ severity, min, max }) => (
                    <div key={severity} className={`text-center rounded-lg px-2 py-2 border text-xs ${SEV_COLORS[severity]}`}>
                      <div className="font-black capitalize">{severity.slice(0, 4).toUpperCase()}</div>
                      <div className="font-mono mt-0.5">
                        {max === 0 ? "—" : min === 0 ? formatMoney(max) : `${formatMoney(min)}–${formatMoney(max)}`}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Domains */}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {selectedProgram.domains.map(d => (
                    <span key={d} className="text-[10px] font-mono bg-gray-800 text-gray-400 px-2 py-0.5 rounded border border-gray-700">{d}</span>
                  ))}
                </div>
              </div>

              {/* Tab nav */}
              <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-xl p-1">
                {([
                  { id: "overview", label: "Top Bugs",     icon: Target },
                  { id: "scope",    label: "Scope",        icon: Filter },
                  { id: "testing",  label: "Testing Guide",icon: Zap },
                  { id: "report",   label: "Report Maker", icon: FileText },
                ] as const).map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === t.id ? "bg-yellow-900/60 text-yellow-300 border border-yellow-800" : "text-gray-400 hover:text-white hover:bg-gray-800"}`}>
                    <t.icon className="h-3.5 w-3.5 shrink-0" />{t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">

                {activeTab === "overview" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Target className="h-4 w-4 text-red-400" />
                      <h3 className="font-bold text-white">Most Rewarded Vulnerability Types</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {selectedProgram.topBugs.map((bug, i) => (
                        <div key={i} className="flex items-start gap-2.5 bg-gray-800 rounded-lg px-3 py-2.5">
                          <span className="text-yellow-500 font-black text-xs mt-0.5 shrink-0">#{i + 1}</span>
                          <p className="text-sm text-gray-200 leading-tight">{bug}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-800">
                      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-yellow-400" /> Quick Actions
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        
                        <button onClick={() => setActiveTab("testing")}
                          className="flex items-center gap-1.5 text-xs font-bold bg-blue-900 hover:bg-blue-800 border border-blue-700 text-blue-300 px-3 py-2 rounded-lg transition-colors">
                          <BookOpen className="h-3.5 w-3.5" /> Testing Guide
                        </button>
                        <button onClick={() => setActiveTab("report")}
                          className="flex items-center gap-1.5 text-xs font-bold bg-green-900 hover:bg-green-800 border border-green-700 text-green-300 px-3 py-2 rounded-lg transition-colors">
                          <FileText className="h-3.5 w-3.5" /> Generate Report
                        </button>
                        <a href={selectedProgram.registrationUrl} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 text-xs font-bold bg-yellow-900 hover:bg-yellow-800 border border-yellow-700 text-yellow-300 px-3 py-2 rounded-lg transition-colors">
                          <ExternalLink className="h-3.5 w-3.5" /> Register with {PLATFORM_LABELS[selectedProgram.platform]}
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "scope" && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 mb-2 cursor-pointer" onClick={() => toggle("inscope")}>
                        <CheckCircle2 className="h-4 w-4 text-green-400" />
                        <h3 className="font-bold text-white flex-1">In Scope</h3>
                        {expandedSection === "inscope" ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                      </div>
                      {expandedSection !== "inscope" || true ? (
                        <ul className="space-y-1.5">
                          {selectedProgram.scope.map((s, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-green-500 mt-0.5 shrink-0">✓</span>
                              <span className="text-gray-300">{s}</span>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                    <div className="border-t border-gray-800 pt-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Lock className="h-4 w-4 text-red-400" />
                        <h3 className="font-bold text-white">Out of Scope</h3>
                      </div>
                      <ul className="space-y-1.5">
                        {selectedProgram.outOfScope.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm">
                            <span className="text-red-500 mt-0.5 shrink-0">✗</span>
                            <span className="text-gray-400">{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg p-3 text-xs text-amber-400">
                      Always read the full program policy on {PLATFORM_LABELS[selectedProgram.platform]} before testing. Scope can change — check the live program page regularly.
                    </div>
                  </div>
                )}

                {activeTab === "testing" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Layers className="h-4 w-4 text-blue-400" />
                      <h3 className="font-bold text-white">Authorized Testing Methodology</h3>
                    </div>
                    <div className="space-y-2">
                      {selectedProgram.testingApproach.map((step, i) => (
                        <div key={i} className="flex items-start gap-3 bg-gray-800 rounded-lg px-4 py-3">
                          <div className="w-6 h-6 rounded-full bg-blue-900 border border-blue-700 flex items-center justify-center text-xs font-black text-blue-300 shrink-0 mt-0.5">{i + 1}</div>
                          <p className="text-sm text-gray-200 leading-relaxed">{step}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { label: "Subdomain Enum", tools: ["amass", "subfinder", "assetfinder"], icon: Search },
                        { label: "Traffic Proxy",  tools: ["Burp Suite", "OWASP ZAP", "Charles Proxy"], icon: Radio },
                        { label: "API Testing",    tools: ["Postman", "Insomnia", "curl + jq"], icon: Code2 },
                      ].map(t => (
                        <div key={t.label} className="bg-gray-800 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <t.icon className="h-3.5 w-3.5 text-blue-400" />
                            <span className="text-xs font-bold text-gray-300">{t.label}</span>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {t.tools.map(tool => (
                              <span key={tool} className="text-[10px] font-mono bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">{tool}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2 mt-4">
                      
                    </div>
                  </div>
                )}

                {activeTab === "report" && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-4 w-4 text-green-400" />
                      <h3 className="font-bold text-white">Disclosure Report Generator</h3>
                      <span className="text-xs text-gray-500 ml-1">— {PLATFORM_LABELS[selectedProgram.platform]} format</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Vulnerability Type</label>
                        <Input value={reportVulnType} onChange={e => setReportVulnType(e.target.value)}
                          placeholder="e.g. IDOR on user profile API" className="bg-gray-800 border-gray-700 text-white text-sm h-9" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Severity</label>
                        <select value={reportSeverity} onChange={e => setReportSeverity(e.target.value as Severity)}
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none h-9">
                          <option value="critical">Critical</option>
                          <option value="high">High</option>
                          <option value="medium">Medium</option>
                          <option value="low">Low</option>
                          <option value="informational">Informational</option>
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs text-gray-500 mb-1 block">Affected Endpoint</label>
                        <Input value={reportEndpoint} onChange={e => setReportEndpoint(e.target.value)}
                          placeholder={`e.g. https://${selectedProgram.domains[0]}/api/v1/user/profile`} className="bg-gray-800 border-gray-700 text-white text-sm h-9 font-mono" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="text-xs text-gray-500 mb-1 block">Description</label>
                        <textarea value={reportDescription} onChange={e => setReportDescription(e.target.value)} rows={3}
                          placeholder="Describe the vulnerability — what it is, where it is, and why it's a security issue"
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Steps to Reproduce</label>
                        <textarea value={reportSteps} onChange={e => setReportSteps(e.target.value)} rows={4}
                          placeholder="1. Log in with test account A&#10;2. Navigate to...&#10;3. Modify...&#10;4. Observe..."
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none font-mono text-xs" />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Impact</label>
                        <textarea value={reportImpact} onChange={e => setReportImpact(e.target.value)} rows={4}
                          placeholder="Describe what an attacker could achieve — account takeover, data theft, financial loss..."
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none resize-none" />
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-gray-950 border border-gray-800 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-gray-400">REPORT PREVIEW</span>
                        <button onClick={copyReport}
                          className="flex items-center gap-1.5 text-xs font-bold bg-green-900 hover:bg-green-800 text-green-300 border border-green-800 px-3 py-1.5 rounded-lg transition-colors">
                          {copied ? <><CheckCircle2 className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy Report</>}
                        </button>
                      </div>
                      <pre className="text-[10px] text-gray-400 overflow-x-auto font-mono leading-relaxed whitespace-pre-wrap max-h-72 overflow-y-auto">
                        {generateReport(selectedProgram, reportSeverity, reportVulnType, reportEndpoint, reportDescription, reportImpact, reportSteps)}
                      </pre>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <a href={selectedProgram.url} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1.5 text-sm font-bold bg-yellow-900 hover:bg-yellow-800 border border-yellow-700 text-yellow-300 px-4 py-2 rounded-lg transition-colors">
                        <ExternalLink className="h-4 w-4" /> Submit to {PLATFORM_LABELS[selectedProgram.platform]}
                      </a>
                    </div>
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
