// Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC — legal@alphauntechnologies.com
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search, Globe, Gamepad2, Smartphone, Monitor, RefreshCw,
  LogIn, AlertOctagon, CheckCircle2, XCircle, ChevronLeft,
  ChevronRight, ExternalLink, Trash2, Clock, User, Shield,
  Wifi, Layers, Radio,
} from "lucide-react";

const API = "/api/social-account";

// ── Platform Definitions ─────────────────────────────────────────────────────
type PlatformDef = {
  id: string;
  name: string;
  color: string;
  bg: string;
  emoji: string;
  category: string;
  tab: "social" | "gaming" | "games" | "legacy";
  loginUrl: string;
  homeUrl: string;
  strategy: "auto" | "manual";
  fields: { username?: boolean; email?: boolean; password: boolean };
  notes?: string;
  legacy?: boolean;
  genre?: string;
};

const PLATFORMS: PlatformDef[] = [
  // ── SOCIAL MEDIA ──────────────────────────────────────────────────────────
  { id: "facebook",    name: "Facebook",          color: "#1877F2", bg: "#0a1628", emoji: "📘", category: "Social",        tab: "social", loginUrl: "https://www.facebook.com/login",    homeUrl: "https://www.facebook.com",            strategy: "manual", fields: { email: true, password: true },    notes: "Uses React + bot detection" },
  { id: "instagram",  name: "Instagram",          color: "#E1306C", bg: "#1a0a10", emoji: "📷", category: "Social",        tab: "social", loginUrl: "https://www.instagram.com/accounts/login", homeUrl: "https://www.instagram.com",       strategy: "auto",   fields: { username: true, password: true }, notes: "Auto-login via AJAX API" },
  { id: "twitter",    name: "Twitter / X",        color: "#000000", bg: "#0a0a0a", emoji: "🐦", category: "Social",        tab: "social", loginUrl: "https://twitter.com/i/flow/login",  homeUrl: "https://twitter.com/home",           strategy: "manual", fields: { username: true, password: true }, notes: "OAuth flow — manual mode" },
  { id: "tiktok",     name: "TikTok",             color: "#FE2C55", bg: "#1a0508", emoji: "🎵", category: "Video",         tab: "social", loginUrl: "https://www.tiktok.com/login",      homeUrl: "https://www.tiktok.com",             strategy: "manual", fields: { email: true, password: true },    notes: "Heavy bot protection" },
  { id: "snapchat",   name: "Snapchat",           color: "#FFFC00", bg: "#1a1a00", emoji: "👻", category: "Social",        tab: "social", loginUrl: "https://accounts.snapchat.com",     homeUrl: "https://web.snapchat.com",           strategy: "manual", fields: { username: true, password: true } },
  { id: "threads",    name: "Threads",            color: "#000000", bg: "#0a0a0a", emoji: "🧵", category: "Social",        tab: "social", loginUrl: "https://www.threads.net/login",      homeUrl: "https://www.threads.net",            strategy: "manual", fields: { username: true, password: true }, notes: "Meta identity" },
  { id: "linkedin",   name: "LinkedIn",           color: "#0A66C2", bg: "#040e1c", emoji: "💼", category: "Professional",  tab: "social", loginUrl: "https://www.linkedin.com/login",    homeUrl: "https://www.linkedin.com/feed",      strategy: "manual", fields: { email: true, password: true } },
  { id: "pinterest",  name: "Pinterest",          color: "#E60023", bg: "#1a0003", emoji: "📌", category: "Creative",      tab: "social", loginUrl: "https://www.pinterest.com/login",   homeUrl: "https://www.pinterest.com",          strategy: "manual", fields: { email: true, password: true } },
  { id: "reddit",     name: "Reddit",             color: "#FF4500", bg: "#1a0b00", emoji: "🤖", category: "Forum",         tab: "social", loginUrl: "https://www.reddit.com/login",      homeUrl: "https://www.reddit.com",             strategy: "auto",   fields: { username: true, password: true }, notes: "Auto-login via form+CSRF" },
  { id: "tumblr",     name: "Tumblr",             color: "#35465C", bg: "#080c10", emoji: "🌀", category: "Blog",          tab: "social", loginUrl: "https://www.tumblr.com/login",      homeUrl: "https://www.tumblr.com",             strategy: "manual", fields: { email: true, password: true } },
  { id: "discord",    name: "Discord",            color: "#5865F2", bg: "#08091c", emoji: "🎮", category: "Chat",          tab: "social", loginUrl: "https://discord.com/login",         homeUrl: "https://discord.com/channels/@me",   strategy: "auto",   fields: { email: true, password: true },    notes: "JSON API — very reliable" },
  { id: "telegram",   name: "Telegram",           color: "#2AABEE", bg: "#03111a", emoji: "✈️", category: "Chat",          tab: "social", loginUrl: "https://web.telegram.org",          homeUrl: "https://web.telegram.org",           strategy: "manual", fields: { username: true, password: true }, notes: "Phone number based" },
  { id: "signal",     name: "Signal",             color: "#3A76F0", bg: "#030d1c", emoji: "🔒", category: "Chat",          tab: "social", loginUrl: "https://signal.org",                homeUrl: "https://signal.org",                 strategy: "manual", fields: { username: true, password: true }, notes: "Mobile-only" },
  { id: "slack",      name: "Slack",              color: "#4A154B", bg: "#0d030d", emoji: "💬", category: "Chat",          tab: "social", loginUrl: "https://slack.com/signin",          homeUrl: "https://app.slack.com",              strategy: "manual", fields: { email: true, password: true } },
  { id: "whatsapp",   name: "WhatsApp",           color: "#25D366", bg: "#031208", emoji: "📱", category: "Chat",          tab: "social", loginUrl: "https://web.whatsapp.com",          homeUrl: "https://web.whatsapp.com",           strategy: "manual", fields: { username: true, password: true }, notes: "QR code — phone required" },
  { id: "youtube",    name: "YouTube",            color: "#FF0000", bg: "#1a0000", emoji: "▶️", category: "Video",         tab: "social", loginUrl: "https://accounts.google.com",       homeUrl: "https://www.youtube.com",            strategy: "manual", fields: { email: true, password: true },    notes: "Google SSO" },
  { id: "twitch",     name: "Twitch",             color: "#9146FF", bg: "#0d0520", emoji: "🎥", category: "Streaming",     tab: "social", loginUrl: "https://www.twitch.tv/login",       homeUrl: "https://www.twitch.tv",              strategy: "auto",   fields: { username: true, password: true }, notes: "Auto via Passport API" },
  { id: "kick",       name: "Kick",               color: "#53FC18", bg: "#041a02", emoji: "🎬", category: "Streaming",     tab: "social", loginUrl: "https://kick.com/login",            homeUrl: "https://kick.com",                   strategy: "manual", fields: { email: true, password: true } },
  { id: "rumble",     name: "Rumble",             color: "#85C742", bg: "#0d1a05", emoji: "📡", category: "Video",         tab: "social", loginUrl: "https://rumble.com/login.php",      homeUrl: "https://rumble.com",                 strategy: "manual", fields: { username: true, password: true } },
  { id: "vimeo",      name: "Vimeo",              color: "#1AB7EA", bg: "#03141c", emoji: "🎞️", category: "Video",         tab: "social", loginUrl: "https://vimeo.com/log_in",          homeUrl: "https://vimeo.com",                  strategy: "manual", fields: { email: true, password: true } },
  { id: "dailymotion",name: "Dailymotion",        color: "#00B4FF", bg: "#00121a", emoji: "🎦", category: "Video",         tab: "social", loginUrl: "https://www.dailymotion.com/signin", homeUrl: "https://www.dailymotion.com",        strategy: "manual", fields: { email: true, password: true } },
  { id: "github",     name: "GitHub",             color: "#24292F", bg: "#080a0c", emoji: "🐙", category: "Developer",     tab: "social", loginUrl: "https://github.com/login",          homeUrl: "https://github.com",                 strategy: "auto",   fields: { username: true, password: true }, notes: "Auto-login via form+CSRF" },
  { id: "gitlab",     name: "GitLab",             color: "#FC6D26", bg: "#1a0b03", emoji: "🦊", category: "Developer",     tab: "social", loginUrl: "https://gitlab.com/users/sign_in",  homeUrl: "https://gitlab.com",                 strategy: "manual", fields: { username: true, password: true } },
  { id: "bitbucket",  name: "Bitbucket",          color: "#0052CC", bg: "#000e26", emoji: "🪣", category: "Developer",     tab: "social", loginUrl: "https://bitbucket.org/account/signin", homeUrl: "https://bitbucket.org",          strategy: "manual", fields: { email: true, password: true } },
  { id: "stackoverflow",name:"Stack Overflow",    color: "#F58025", bg: "#1a0e03", emoji: "📚", category: "Developer",     tab: "social", loginUrl: "https://stackoverflow.com/users/login", homeUrl: "https://stackoverflow.com",     strategy: "manual", fields: { email: true, password: true } },
  { id: "deviantart", name: "DeviantArt",         color: "#05CC47", bg: "#031208", emoji: "🎨", category: "Creative",      tab: "social", loginUrl: "https://www.deviantart.com/users/login", homeUrl: "https://www.deviantart.com",    strategy: "manual", fields: { username: true, password: true } },
  { id: "flickr",     name: "Flickr",             color: "#FF0084", bg: "#1a0010", emoji: "📸", category: "Creative",      tab: "social", loginUrl: "https://www.flickr.com/services/login", homeUrl: "https://www.flickr.com",         strategy: "manual", fields: { email: true, password: true } },
  { id: "soundcloud", name: "SoundCloud",         color: "#FF5500", bg: "#1a0a00", emoji: "🎵", category: "Music",         tab: "social", loginUrl: "https://soundcloud.com/signin",     homeUrl: "https://soundcloud.com/stream",      strategy: "manual", fields: { email: true, password: true } },
  { id: "spotify",    name: "Spotify",            color: "#1DB954", bg: "#030f08", emoji: "🎧", category: "Music",         tab: "social", loginUrl: "https://accounts.spotify.com/login", homeUrl: "https://open.spotify.com",          strategy: "manual", fields: { email: true, password: true } },
  { id: "vk",         name: "VK",                 color: "#2787F5", bg: "#03121c", emoji: "🇷🇺", category: "Social",        tab: "social", loginUrl: "https://vk.com",                    homeUrl: "https://vk.com",                     strategy: "manual", fields: { email: true, password: true } },
  { id: "medium",     name: "Medium",             color: "#000000", bg: "#0a0a0a", emoji: "📖", category: "Blog",          tab: "social", loginUrl: "https://medium.com/m/signin",        homeUrl: "https://medium.com",                 strategy: "manual", fields: { email: true, password: true } },
  { id: "quora",      name: "Quora",              color: "#A82400", bg: "#1a0500", emoji: "❓", category: "Forum",         tab: "social", loginUrl: "https://www.quora.com/",            homeUrl: "https://www.quora.com",              strategy: "manual", fields: { email: true, password: true } },
  { id: "substack",   name: "Substack",           color: "#FF6719", bg: "#1a0a03", emoji: "📰", category: "Blog",          tab: "social", loginUrl: "https://substack.com/sign-in",      homeUrl: "https://substack.com",               strategy: "manual", fields: { email: true, password: true } },
  { id: "patreon",    name: "Patreon",            color: "#FF424D", bg: "#1a0405", emoji: "🎁", category: "Creator",       tab: "social", loginUrl: "https://www.patreon.com/login",     homeUrl: "https://www.patreon.com",            strategy: "manual", fields: { email: true, password: true } },
  { id: "strava",     name: "Strava",             color: "#FC4C02", bg: "#1a0a00", emoji: "🏃", category: "Fitness",       tab: "social", loginUrl: "https://www.strava.com/login",      homeUrl: "https://www.strava.com/dashboard",   strategy: "manual", fields: { email: true, password: true } },
  { id: "duolingo",   name: "Duolingo",           color: "#58CC02", bg: "#081a00", emoji: "🦉", category: "Education",     tab: "social", loginUrl: "https://www.duolingo.com/login",    homeUrl: "https://www.duolingo.com/learn",     strategy: "manual", fields: { username: true, password: true } },
  { id: "letterboxd", name: "Letterboxd",         color: "#00C030", bg: "#001a08", emoji: "🎬", category: "Reviews",       tab: "social", loginUrl: "https://letterboxd.com/sign-in/",   homeUrl: "https://letterboxd.com/",            strategy: "manual", fields: { username: true, password: true } },
  { id: "goodreads",  name: "Goodreads",          color: "#372213", bg: "#0a0805", emoji: "📚", category: "Books",         tab: "social", loginUrl: "https://www.goodreads.com/user/sign_in", homeUrl: "https://www.goodreads.com",      strategy: "manual", fields: { email: true, password: true } },
  { id: "mastodon",   name: "Mastodon",           color: "#563ACC", bg: "#0c0726", emoji: "🐘", category: "Social",        tab: "social", loginUrl: "https://mastodon.social/auth/sign_in", homeUrl: "https://mastodon.social/home",    strategy: "manual", fields: { email: true, password: true } },
  { id: "bereal",     name: "BeReal",             color: "#000000", bg: "#0a0a0a", emoji: "📷", category: "Social",        tab: "social", loginUrl: "https://bere.al/login",             homeUrl: "https://bere.al",                    strategy: "manual", fields: { email: true, password: true } },

  // ── GAMING LAUNCHERS / PLATFORMS ─────────────────────────────────────────
  { id: "steam",      name: "Steam",              color: "#1B2838", bg: "#080c10", emoji: "🎮", category: "PC Launcher",   tab: "gaming", loginUrl: "https://store.steampowered.com/login", homeUrl: "https://store.steampowered.com",   strategy: "auto",   fields: { username: true, password: true }, notes: "RSA-encrypted login" },
  { id: "epic",       name: "Epic Games",         color: "#0078F2", bg: "#000f1c", emoji: "🏆", category: "PC Launcher",   tab: "gaming", loginUrl: "https://www.epicgames.com/id/login", homeUrl: "https://www.epicgames.com",        strategy: "auto",   fields: { email: true, password: true },    notes: "Auto via API" },
  { id: "gog",        name: "GOG Galaxy",         color: "#7B2FBE", bg: "#0d0620", emoji: "🌌", category: "PC Launcher",   tab: "gaming", loginUrl: "https://www.gog.com/login",         homeUrl: "https://www.gog.com",               strategy: "auto",   fields: { email: true, password: true },    notes: "Token API" },
  { id: "ea",         name: "EA App / Origin",    color: "#F56C2D", bg: "#1a0a03", emoji: "⚽", category: "PC Launcher",   tab: "gaming", loginUrl: "https://www.ea.com/login",          homeUrl: "https://www.ea.com",                strategy: "manual", fields: { email: true, password: true },    notes: "OAuth — manual" },
  { id: "ubisoft",    name: "Ubisoft Connect",    color: "#0070FF", bg: "#000f1c", emoji: "🔷", category: "PC Launcher",   tab: "gaming", loginUrl: "https://connect.ubisoft.com/login", homeUrl: "https://connect.ubisoft.com",       strategy: "manual", fields: { email: true, password: true },    notes: "React SPA — manual" },
  { id: "battlenet",  name: "Battle.net",         color: "#009AE4", bg: "#001226", emoji: "⚡", category: "PC Launcher",   tab: "gaming", loginUrl: "https://us.battle.net/login/en/",   homeUrl: "https://battle.net",               strategy: "manual", fields: { email: true, password: true },    notes: "Blizzard OAuth" },
  { id: "riotclient", name: "Riot Games",         color: "#D13639", bg: "#1a0305", emoji: "⚔️", category: "PC Launcher",   tab: "gaming", loginUrl: "https://auth.riotgames.com/login",  homeUrl: "https://account.riotgames.com",     strategy: "manual", fields: { username: true, password: true }, notes: "OAuth — manual" },
  { id: "activision", name: "Activision",         color: "#F4CF44", bg: "#1a1503", emoji: "🎯", category: "PC Launcher",   tab: "gaming", loginUrl: "https://s.activision.com/activision/login", homeUrl: "https://www.activision.com", strategy: "auto",   fields: { email: true, password: true },    notes: "Form POST + CSRF" },
  { id: "rockstar",   name: "Rockstar / Social Club", color: "#FCAF17", bg: "#1a1000", emoji: "⭐", category: "PC Launcher", tab: "gaming", loginUrl: "https://signin.rockstargames.com", homeUrl: "https://socialclub.rockstargames.com", strategy: "auto", fields: { email: true, password: true } },
  { id: "bethesda",   name: "Bethesda.net",       color: "#0099D5", bg: "#001a26", emoji: "🏛️", category: "PC Launcher",   tab: "gaming", loginUrl: "https://account.bethesda.net/en/login", homeUrl: "https://account.bethesda.net",  strategy: "manual", fields: { email: true, password: true } },
  { id: "amazon",     name: "Amazon Games",       color: "#FF9900", bg: "#1a0f00", emoji: "📦", category: "PC Launcher",   tab: "gaming", loginUrl: "https://gaming.amazon.com",         homeUrl: "https://gaming.amazon.com",         strategy: "manual", fields: { email: true, password: true },    notes: "Amazon SSO" },
  { id: "xbox",       name: "Xbox Live / PC",     color: "#107C10", bg: "#021602", emoji: "🎮", category: "PC Launcher",   tab: "gaming", loginUrl: "https://login.live.com",            homeUrl: "https://account.xbox.com",          strategy: "manual", fields: { email: true, password: true },    notes: "Microsoft OAuth" },
  { id: "itch",       name: "Itch.io",            color: "#FA5C5C", bg: "#1a0505", emoji: "🕹️", category: "Indie",         tab: "gaming", loginUrl: "https://itch.io/login",             homeUrl: "https://itch.io",                   strategy: "manual", fields: { username: true, password: true } },
  { id: "humble",     name: "Humble Bundle",      color: "#CC2929", bg: "#1a0505", emoji: "🎁", category: "Store",         tab: "gaming", loginUrl: "https://www.humblebundle.com/login", homeUrl: "https://www.humblebundle.com",      strategy: "manual", fields: { email: true, password: true } },
  { id: "psn",        name: "PlayStation Network",color: "#003791", bg: "#00061a", emoji: "🎮", category: "Console",       tab: "gaming", loginUrl: "https://www.playstation.com/en-us/sign-in/", homeUrl: "https://www.playstation.com", strategy: "manual", fields: { email: true, password: true }, notes: "Sony SSO — strict" },
  { id: "nintendo",   name: "Nintendo Account",   color: "#E4000F", bg: "#1a0002", emoji: "🔴", category: "Console",       tab: "gaming", loginUrl: "https://accounts.nintendo.com/login", homeUrl: "https://accounts.nintendo.com",   strategy: "manual", fields: { email: true, password: true },    notes: "Nintendo OAuth" },
  { id: "roblox",     name: "Roblox",             color: "#E74C3C", bg: "#1a0305", emoji: "🧱", category: "Platform",      tab: "gaming", loginUrl: "https://www.roblox.com/login",      homeUrl: "https://www.roblox.com/home",       strategy: "auto",   fields: { username: true, password: true }, notes: "CSRF + JSON API" },
  { id: "minecraft",  name: "Minecraft / Mojang", color: "#4AAD21", bg: "#091a04", emoji: "⛏️", category: "Game Account",  tab: "gaming", loginUrl: "https://login.live.com",            homeUrl: "https://minecraft.net",             strategy: "manual", fields: { email: true, password: true },    notes: "Microsoft Account" },

  // ── SPECIFIC GAME TITLES ─────────────────────────────────────────────────
  { id: "cod",        name: "Call of Duty",        color: "#E8D600", bg: "#1a1400", emoji: "🔫", category: "FPS",           tab: "games", genre: "Shooter",     loginUrl: "https://s.activision.com/activision/login", homeUrl: "https://www.callofduty.com", strategy: "auto",   fields: { email: true, password: true }, notes: "Activision account" },
  { id: "warzone",    name: "Warzone",             color: "#FF4500", bg: "#1a0800", emoji: "🪖", category: "Battle Royale", tab: "games", genre: "Shooter",     loginUrl: "https://s.activision.com/activision/login", homeUrl: "https://www.callofduty.com/warzone", strategy: "auto", fields: { email: true, password: true }, notes: "Activision account" },
  { id: "gta",        name: "GTA Online",          color: "#1EE4A3", bg: "#001a12", emoji: "🚗", category: "Open World",    tab: "games", genre: "Action",      loginUrl: "https://signin.rockstargames.com",  homeUrl: "https://socialclub.rockstargames.com", strategy: "auto", fields: { email: true, password: true }, notes: "Rockstar Social Club" },
  { id: "nba2k",      name: "NBA 2K26",            color: "#C9082A", bg: "#1a0005", emoji: "🏀", category: "Sports",        tab: "games", genre: "Sports",      loginUrl: "https://accounts.2k.com/login",     homeUrl: "https://accounts.2k.com",           strategy: "auto",   fields: { email: true, password: true }, notes: "2K Games account" },
  { id: "fortnite",   name: "Fortnite",            color: "#FFCA28", bg: "#1a1400", emoji: "⚡", category: "Battle Royale", tab: "games", genre: "Shooter",     loginUrl: "https://www.epicgames.com/id/login", homeUrl: "https://www.epicgames.com",        strategy: "auto",   fields: { email: true, password: true }, notes: "Epic Games account" },
  { id: "destiny2",   name: "Destiny 2",           color: "#B4B4FF", bg: "#0a0a1a", emoji: "🪐", category: "FPS/MMO",       tab: "games", genre: "Shooter",     loginUrl: "https://www.bungie.net/7/en/User/Account/login", homeUrl: "https://www.bungie.net", strategy: "manual", fields: { email: true, password: true }, notes: "Bungie OAuth — manual" },
  { id: "wow",        name: "World of Warcraft",   color: "#FFD700", bg: "#1a1400", emoji: "⚔️", category: "MMORPG",        tab: "games", genre: "MMORPG",      loginUrl: "https://us.battle.net/login/en/",   homeUrl: "https://battle.net",               strategy: "manual", fields: { email: true, password: true }, notes: "Battle.net account" },
  { id: "overwatch",  name: "Overwatch 2",         color: "#F99E1A", bg: "#1a0f00", emoji: "🎯", category: "FPS",           tab: "games", genre: "Shooter",     loginUrl: "https://us.battle.net/login/en/",   homeUrl: "https://battle.net",               strategy: "manual", fields: { email: true, password: true }, notes: "Battle.net account" },
  { id: "diablo",     name: "Diablo IV",           color: "#8B0000", bg: "#1a0000", emoji: "😈", category: "ARPG",          tab: "games", genre: "RPG",         loginUrl: "https://us.battle.net/login/en/",   homeUrl: "https://battle.net",               strategy: "manual", fields: { email: true, password: true }, notes: "Battle.net account" },
  { id: "valorant",   name: "Valorant",            color: "#FF4655", bg: "#1a0305", emoji: "🔺", category: "FPS",           tab: "games", genre: "Shooter",     loginUrl: "https://auth.riotgames.com/login",  homeUrl: "https://account.riotgames.com",     strategy: "manual", fields: { username: true, password: true }, notes: "Riot account" },
  { id: "lol",        name: "League of Legends",   color: "#C8AA6E", bg: "#1a1208", emoji: "🏆", category: "MOBA",          tab: "games", genre: "MOBA",        loginUrl: "https://auth.riotgames.com/login",  homeUrl: "https://account.riotgames.com",     strategy: "manual", fields: { username: true, password: true }, notes: "Riot account" },
  { id: "apex",       name: "Apex Legends",        color: "#DA292A", bg: "#1a0305", emoji: "🦅", category: "Battle Royale", tab: "games", genre: "Shooter",     loginUrl: "https://www.ea.com/login",          homeUrl: "https://www.ea.com",                strategy: "manual", fields: { email: true, password: true }, notes: "EA account" },
  { id: "fifa",       name: "EA Sports FC",        color: "#008C45", bg: "#000f08", emoji: "⚽", category: "Sports",        tab: "games", genre: "Sports",      loginUrl: "https://www.ea.com/login",          homeUrl: "https://www.ea.com",                strategy: "manual", fields: { email: true, password: true }, notes: "EA account" },
  { id: "battlefield",name: "Battlefield",         color: "#395D78", bg: "#040c10", emoji: "💣", category: "FPS",           tab: "games", genre: "Shooter",     loginUrl: "https://www.ea.com/login",          homeUrl: "https://www.ea.com",                strategy: "manual", fields: { email: true, password: true }, notes: "EA account" },
  { id: "madden",     name: "Madden NFL",          color: "#003F72", bg: "#000810", emoji: "🏈", category: "Sports",        tab: "games", genre: "Sports",      loginUrl: "https://www.ea.com/login",          homeUrl: "https://www.ea.com",                strategy: "manual", fields: { email: true, password: true }, notes: "EA account" },
  { id: "genshin",    name: "Genshin Impact",      color: "#006EFF", bg: "#000f1a", emoji: "✨", category: "RPG",           tab: "games", genre: "RPG",         loginUrl: "https://account.hoyoverse.com",     homeUrl: "https://www.hoyolab.com",           strategy: "auto",   fields: { email: true, password: true }, notes: "HoYoverse account" },
  { id: "honkai",     name: "Honkai: Star Rail",   color: "#A478F0", bg: "#0d0820", emoji: "🌌", category: "RPG",           tab: "games", genre: "RPG",         loginUrl: "https://account.hoyoverse.com",     homeUrl: "https://www.hoyolab.com",           strategy: "auto",   fields: { email: true, password: true }, notes: "HoYoverse account" },
  { id: "pubg",       name: "PUBG",                color: "#F5A623", bg: "#1a1003", emoji: "🎯", category: "Battle Royale", tab: "games", genre: "Shooter",     loginUrl: "https://auth.pubg.com",             homeUrl: "https://www.pubg.com",              strategy: "manual", fields: { email: true, password: true } },
  { id: "csgo",       name: "Counter-Strike 2",    color: "#FFCC00", bg: "#1a1400", emoji: "💣", category: "FPS",           tab: "games", genre: "Shooter",     loginUrl: "https://store.steampowered.com/login", homeUrl: "https://store.steampowered.com", strategy: "auto",   fields: { username: true, password: true }, notes: "Steam account" },
  { id: "dota2",      name: "Dota 2",              color: "#A32424", bg: "#1a0505", emoji: "🧙", category: "MOBA",          tab: "games", genre: "MOBA",        loginUrl: "https://store.steampowered.com/login", homeUrl: "https://store.steampowered.com", strategy: "auto",   fields: { username: true, password: true }, notes: "Steam account" },
  { id: "tf2",        name: "Team Fortress 2",     color: "#CF4200", bg: "#1a0800", emoji: "🔨", category: "FPS",           tab: "games", genre: "Shooter",     loginUrl: "https://store.steampowered.com/login", homeUrl: "https://store.steampowered.com", strategy: "auto",   fields: { username: true, password: true }, notes: "Steam account" },
  { id: "rocketleague",name:"Rocket League",       color: "#2277EE", bg: "#030e1c", emoji: "🚀", category: "Sports",        tab: "games", genre: "Sports",      loginUrl: "https://www.epicgames.com/id/login", homeUrl: "https://www.epicgames.com",        strategy: "auto",   fields: { email: true, password: true }, notes: "Epic account" },
  { id: "warframe",   name: "Warframe",            color: "#4DC0FF", bg: "#03141a", emoji: "🤖", category: "RPG/Shooter",   tab: "games", genre: "Action",      loginUrl: "https://www.warframe.com/login",    homeUrl: "https://www.warframe.com",          strategy: "auto",   fields: { email: true, password: true }, notes: "DE account API" },
  { id: "poe",        name: "Path of Exile",       color: "#AF6025", bg: "#1a0b03", emoji: "🌑", category: "ARPG",          tab: "games", genre: "RPG",         loginUrl: "https://www.pathofexile.com/login", homeUrl: "https://www.pathofexile.com",       strategy: "auto",   fields: { email: true, password: true }, notes: "Form+CSRF" },
  { id: "poe2",       name: "Path of Exile 2",     color: "#D4A253", bg: "#1a1003", emoji: "🌑", category: "ARPG",          tab: "games", genre: "RPG",         loginUrl: "https://www.pathofexile.com/login", homeUrl: "https://www.pathofexile.com",       strategy: "auto",   fields: { email: true, password: true }, notes: "GGG account" },
  { id: "runescape",  name: "RuneScape",           color: "#7A3300", bg: "#1a0800", emoji: "🐉", category: "MMORPG",        tab: "games", genre: "MMORPG",      loginUrl: "https://account.jagex.com/login",   homeUrl: "https://www.runescape.com",         strategy: "auto",   fields: { email: true, password: true }, notes: "Jagex account" },
  { id: "osrs",       name: "Old School RuneScape",color: "#8B6914", bg: "#1a1403", emoji: "🗡️", category: "MMORPG",        tab: "games", genre: "MMORPG",      loginUrl: "https://account.jagex.com/login",   homeUrl: "https://oldschool.runescape.com",   strategy: "auto",   fields: { email: true, password: true }, notes: "Jagex account" },
  { id: "ffxiv",      name: "Final Fantasy XIV",   color: "#C0922F", bg: "#1a1005", emoji: "🗡️", category: "MMORPG",        tab: "games", genre: "MMORPG",      loginUrl: "https://account.square-enix-games.com/login", homeUrl: "https://na.finalfantasyxiv.com", strategy: "manual", fields: { email: true, password: true }, notes: "Square Enix account" },
  { id: "gw2",        name: "Guild Wars 2",        color: "#AA0404", bg: "#1a0303", emoji: "🛡️", category: "MMORPG",        tab: "games", genre: "MMORPG",      loginUrl: "https://account.arena.net/login",   homeUrl: "https://account.arena.net",         strategy: "manual", fields: { email: true, password: true } },
  { id: "eve",        name: "EVE Online",          color: "#3A6EA5", bg: "#050f1a", emoji: "🚀", category: "MMO",           tab: "games", genre: "MMORPG",      loginUrl: "https://login.eveonline.com",       homeUrl: "https://www.eveonline.com",         strategy: "manual", fields: { email: true, password: true } },
  { id: "worldoftanks",name:"World of Tanks",      color: "#E87722", bg: "#1a0f03", emoji: "🪖", category: "Shooter",       tab: "games", genre: "Action",      loginUrl: "https://na.wargaming.net/id/login", homeUrl: "https://worldoftanks.com",          strategy: "manual", fields: { email: true, password: true } },
  { id: "halo",       name: "Halo Infinite",       color: "#0078D4", bg: "#000f1a", emoji: "🪖", category: "FPS",           tab: "games", genre: "Shooter",     loginUrl: "https://login.live.com",            homeUrl: "https://www.halo.com",              strategy: "manual", fields: { email: true, password: true }, notes: "Microsoft account" },
  { id: "eldenring",  name: "Elden Ring",          color: "#C6A84B", bg: "#1a1308", emoji: "💀", category: "Action RPG",    tab: "games", genre: "RPG",         loginUrl: "https://store.steampowered.com/login", homeUrl: "https://store.steampowered.com", strategy: "auto",   fields: { username: true, password: true }, notes: "Steam account" },
  { id: "newworld",   name: "New World",           color: "#4ECDC4", bg: "#031a19", emoji: "⚓", category: "MMORPG",        tab: "games", genre: "MMORPG",      loginUrl: "https://gaming.amazon.com",         homeUrl: "https://gaming.amazon.com",         strategy: "manual", fields: { email: true, password: true }, notes: "Amazon account" },
  { id: "lostark",    name: "Lost Ark",            color: "#BF9B30", bg: "#1a1203", emoji: "⚔️", category: "ARPG",          tab: "games", genre: "RPG",         loginUrl: "https://store.steampowered.com/login", homeUrl: "https://store.steampowered.com", strategy: "auto",   fields: { username: true, password: true }, notes: "Steam account" },
  { id: "esotw",      name: "Elder Scrolls Online",color: "#6A4C31", bg: "#0d0a06", emoji: "🧙", category: "MMORPG",        tab: "games", genre: "MMORPG",      loginUrl: "https://account.elderscrollsonline.com", homeUrl: "https://www.elderscrollsonline.com", strategy: "manual", fields: { email: true, password: true } },
  { id: "sw:tor",     name: "SWTOR",               color: "#FFE81F", bg: "#1a1800", emoji: "⚡", category: "MMORPG",        tab: "games", genre: "MMORPG",      loginUrl: "https://account.swtor.com",         homeUrl: "https://www.swtor.com",             strategy: "manual", fields: { email: true, password: true } },
  { id: "among-us",   name: "Among Us",            color: "#C51111", bg: "#1a0303", emoji: "🔴", category: "Party",         tab: "games", genre: "Social",      loginUrl: "https://auth.innersloth.com/login", homeUrl: "https://www.innersloth.com",        strategy: "manual", fields: { email: true, password: true } },
  { id: "falguys",    name: "Fall Guys",           color: "#FF8CBA", bg: "#1a0711", emoji: "🥚", category: "Party",         tab: "games", genre: "Party",       loginUrl: "https://www.epicgames.com/id/login", homeUrl: "https://www.fallguys.com",         strategy: "auto",   fields: { email: true, password: true }, notes: "Epic account" },

  // ── LEGACY / RETRO SYSTEMS ───────────────────────────────────────────────
  { id: "habbo",      name: "Habbo Hotel",         color: "#D4AF37", bg: "#1a1503", emoji: "🏨", category: "Legacy",        tab: "legacy", loginUrl: "https://www.habbo.com/login", homeUrl: "https://www.habbo.com", strategy: "manual", fields: { email: true, password: true }, legacy: true, notes: "Old PHP sessions — may have exploits" },
  { id: "imvu",       name: "IMVU",                color: "#FF6600", bg: "#1a0a00", emoji: "👗", category: "Legacy",        tab: "legacy", loginUrl: "https://www.imvu.com/login",  homeUrl: "https://www.imvu.com",  strategy: "manual", fields: { username: true, password: true }, legacy: true },
  { id: "secondlife", name: "Second Life",         color: "#00B4FF", bg: "#00121a", emoji: "🌍", category: "Legacy",        tab: "legacy", loginUrl: "https://id.secondlife.com/openid/login", homeUrl: "https://secondlife.com", strategy: "manual", fields: { username: true, password: true }, legacy: true, notes: "OpenID-based; old XMLRPC API" },
  { id: "maplestory", name: "MapleStory",          color: "#FF4C4C", bg: "#1a0505", emoji: "🍁", category: "Legacy",        tab: "legacy", loginUrl: "https://maplestory.nexon.net/account/login", homeUrl: "https://maplestory.nexon.net", strategy: "manual", fields: { email: true, password: true }, legacy: true },
  { id: "runescape-c",name: "Classic RuneScape",   color: "#5C4033", bg: "#0d0a08", emoji: "🐉", category: "Legacy",        tab: "legacy", loginUrl: "https://classic.runescape.com/login", homeUrl: "https://classic.runescape.com", strategy: "manual", fields: { email: true, password: true }, legacy: true, notes: "Old Jagex XML auth" },
  { id: "neopets",    name: "Neopets",             color: "#3A67A8", bg: "#05091a", emoji: "🐾", category: "Legacy",        tab: "legacy", loginUrl: "https://www.neopets.com/login.phtml", homeUrl: "https://www.neopets.com", strategy: "manual", fields: { username: true, password: true }, legacy: true, notes: "Old PHP — known session exploits" },
  { id: "poptropica", name: "Poptropica",          color: "#FF5500", bg: "#1a0800", emoji: "🏝️", category: "Legacy",        tab: "legacy", loginUrl: "https://www.poptropica.com/login", homeUrl: "https://www.poptropica.com", strategy: "manual", fields: { username: true, password: true }, legacy: true },
  { id: "webkinz",    name: "Webkinz",             color: "#FF69B4", bg: "#1a0a10", emoji: "🧸", category: "Legacy",        tab: "legacy", loginUrl: "https://www.webkinz.com/loginPage.html", homeUrl: "https://www.webkinz.com", strategy: "manual", fields: { username: true, password: true }, legacy: true, notes: "Legacy Flash-era sessions" },
  { id: "clubpenguin",name: "Club Penguin Rewritten", color: "#005A8B", bg: "#000e1a", emoji: "🐧", category: "Legacy",    tab: "legacy", loginUrl: "https://cplegacy.com/login",  homeUrl: "https://cplegacy.com",  strategy: "manual", fields: { username: true, password: true }, legacy: true },
  { id: "runescape-l",name: "RuneScape Lite",      color: "#6B8E23", bg: "#0d1205", emoji: "🗡️", category: "Legacy",        tab: "legacy", loginUrl: "https://account.jagex.com/login", homeUrl: "https://runescape.com", strategy: "auto",   fields: { email: true, password: true }, legacy: true },
  { id: "ageofemp",   name: "Age of Empires Online", color: "#8B6914", bg: "#1a1403", emoji: "🏰", category: "Legacy",     tab: "legacy", loginUrl: "https://login.live.com",      homeUrl: "https://www.ageofempires.com", strategy: "manual", fields: { email: true, password: true }, legacy: true, notes: "Microsoft Live — old API" },
];

const TABS = [
  { id: "social", label: "Social Media",   icon: Globe,     count: PLATFORMS.filter(p => p.tab === "social").length },
  { id: "gaming", label: "PC / Console",   icon: Monitor,   count: PLATFORMS.filter(p => p.tab === "gaming").length },
  { id: "games",  label: "Game Titles",    icon: Gamepad2,  count: PLATFORMS.filter(p => p.tab === "games").length },
  { id: "legacy", label: "Legacy Systems", icon: Clock,     count: PLATFORMS.filter(p => p.tab === "legacy").length },
];

type BreachStatus = "idle" | "connecting" | "authenticating" | "breached" | "manual" | "failed";

type ActiveSession = {
  id: string;
  platform: PlatformDef;
  accountInfo: any;
  currentUrl: string;
  loginMethod: string;
};

export default function SocialBreach() {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // UI state
  const [tab, setTab] = useState<"social" | "gaming" | "games" | "legacy">("social");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PlatformDef | null>(null);

  // Credential form
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [customUrl, setCustomUrl] = useState("");

  // Status
  const [status, setStatus] = useState<BreachStatus>("idle");
  const [statusMsg, setStatusMsg] = useState("");

  // Active session / browser
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [navUrl, setNavUrl] = useState("");
  const [navHistory, setNavHistory] = useState<string[]>([]);
  const [navIndex, setNavIndex] = useState(-1);
  const [sessions, setSessions] = useState<ActiveSession[]>([]);

  // Load active sessions on mount
  useEffect(() => {
    fetch(`${API}/sessions`).then(r => r.json()).then(d => {
      setSessions(d.sessions?.map((s: any) => ({
        id: s.id, platform: PLATFORMS.find(p => p.id === s.platform) || selected, accountInfo: s.accountInfo, currentUrl: s.currentUrl, loginMethod: s.loginMethod,
      })).filter(Boolean) ?? []);
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Listen for navigation from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "social-navigate" && session?.id === e.data.sid) {
        const target = `${API}/navigate?sid=${e.data.sid}&url=${encodeURIComponent(e.data.url)}`;
        navigateTo(target, e.data.url);
      }
      if (e.data?.type === "social-loaded") {
        setNavUrl(e.data.url || "");
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [session]);

  const navigateTo = useCallback((proxyUrl: string, displayUrl?: string) => {
    if (!iframeRef.current) return;
    iframeRef.current.src = proxyUrl;
    if (displayUrl) setNavUrl(displayUrl);
    setNavHistory(prev => {
      const next = [...prev.slice(0, navIndex + 1), proxyUrl];
      setNavIndex(next.length - 1);
      return next;
    });
  }, [navIndex]);

  const filtered = PLATFORMS.filter(p => {
    if (p.tab !== tab) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q) || (p.genre?.toLowerCase().includes(q) ?? false);
  });

  const selectPlatform = (p: PlatformDef) => {
    setSelected(p);
    setStatus("idle");
    setStatusMsg("");
    setSession(null);
    setUsername("");
    setEmail("");
    setPassword("");
    setCustomUrl(p.loginUrl);
  };

  const attemptLogin = async () => {
    if (!selected) return;
    const u = selected.fields.username ? username : email;
    if (!u) { toast({ title: "Enter username or email", variant: "destructive" }); return; }
    if (!password) { toast({ title: "Enter password", variant: "destructive" }); return; }

    setStatus("connecting");
    setStatusMsg("Connecting to platform...");
    await new Promise(r => setTimeout(r, 600));

    setStatus("authenticating");
    setStatusMsg(`Attempting ${selected.strategy === "auto" ? "automated" : "manual"} login...`);

    try {
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: selected.id, username: u, password,
          loginUrl: customUrl || selected.loginUrl,
        }),
      });
      const data = await res.json();

      if (data.success && data.sessionId) {
        setStatus("breached");
        setStatusMsg("Session acquired — loading account...");
        const homeProxy = `${API}/navigate?sid=${data.sessionId}&url=${encodeURIComponent(data.homeUrl)}`;
        const newSession: ActiveSession = {
          id: data.sessionId, platform: selected, accountInfo: data.accountInfo,
          currentUrl: data.homeUrl, loginMethod: "automated",
        };
        setSession(newSession);
        setSessions(prev => [...prev.filter(s => s.id !== data.sessionId), newSession]);
        setNavUrl(data.homeUrl);
        setNavHistory([homeProxy]);
        setNavIndex(0);
        setTimeout(() => { if (iframeRef.current) iframeRef.current.src = homeProxy; }, 300);
        toast({ title: `✅ Breach confirmed — ${selected.name}`, description: `Session active as ${data.accountInfo?.username || data.accountInfo?.email || u}` });
      } else if (data.sessionId && data.manualRequired) {
        // Manual mode — open login page in proxy browser
        setStatus("manual");
        setStatusMsg(data.error || "Manual authentication required");
        const loginProxy = `${API}/navigate?sid=${data.sessionId}&url=${encodeURIComponent(customUrl || selected.loginUrl)}`;
        const newSession: ActiveSession = {
          id: data.sessionId, platform: selected, accountInfo: {},
          currentUrl: customUrl || selected.loginUrl, loginMethod: "manual",
        };
        setSession(newSession);
        setSessions(prev => [...prev.filter(s => s.id !== data.sessionId), newSession]);
        setNavUrl(customUrl || selected.loginUrl);
        setNavHistory([loginProxy]);
        setNavIndex(0);
        setTimeout(() => { if (iframeRef.current) iframeRef.current.src = loginProxy; }, 300);
        toast({ title: "Manual mode — enter credentials in the browser below" });
      } else {
        setStatus("failed");
        setStatusMsg(data.error || "Login failed");
        toast({ title: "Login failed", description: data.error, variant: "destructive" });
      }
    } catch (e: any) {
      setStatus("failed");
      setStatusMsg(e.message);
      toast({ title: "Network error", description: e.message, variant: "destructive" });
    }
  };

  const deleteSession = async (id: string) => {
    await fetch(`${API}/session/${id}`, { method: "DELETE" });
    setSessions(prev => prev.filter(s => s.id !== id));
    if (session?.id === id) { setSession(null); setStatus("idle"); }
  };

  const navBack = () => {
    if (navIndex <= 0 || !iframeRef.current) return;
    const prev = navHistory[navIndex - 1];
    iframeRef.current.src = prev;
    setNavIndex(i => i - 1);
  };

  const navForward = () => {
    if (navIndex >= navHistory.length - 1 || !iframeRef.current) return;
    const next = navHistory[navIndex + 1];
    iframeRef.current.src = next;
    setNavIndex(i => i + 1);
  };

  const navGo = (url: string) => {
    if (!session || !iframeRef.current) return;
    const proxy = `${API}/navigate?sid=${session.id}&url=${encodeURIComponent(url)}`;
    navigateTo(proxy, url);
  };

  const STATUS_CONFIG: Record<BreachStatus, { color: string; icon: React.ReactNode; label: string }> = {
    idle:           { color: "text-gray-500",  icon: <Shield className="h-4 w-4" />,              label: "Ready" },
    connecting:     { color: "text-blue-400",  icon: <Wifi className="h-4 w-4 animate-pulse" />,  label: "Connecting" },
    authenticating: { color: "text-amber-400", icon: <RefreshCw className="h-4 w-4 animate-spin" />, label: "Authenticating" },
    breached:       { color: "text-red-400",   icon: <AlertOctagon className="h-4 w-4 animate-pulse" />, label: "BREACH CONFIRMED" },
    manual:         { color: "text-yellow-400",icon: <User className="h-4 w-4" />,                label: "Manual Mode" },
    failed:         { color: "text-red-600",   icon: <XCircle className="h-4 w-4" />,             label: "Failed" },
  };

  const sc = STATUS_CONFIG[status];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 p-4 md:p-6 space-y-5 max-w-7xl mx-auto">

      {/* Header */}
      <div className="mb-2">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <Globe className="h-7 w-7 text-red-400" />
          <h1 className="text-2xl font-bold text-white">Social & Game Account Breach Tester</h1>
          <Badge className="bg-red-900 text-red-300 border-red-700">Auth Security Audit</Badge>
          <Badge className="bg-purple-900 text-purple-300 border-purple-700">80+ Platforms</Badge>
        </div>
        <p className="text-gray-400 text-sm">
          Per-platform login engine with authenticated proxy browser — verify account security across social media, gaming launchers, specific game titles, and legacy systems.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">

        {/* ── LEFT: Platform Selector ─────────────────────────────────────── */}
        <div className="xl:col-span-1 space-y-3">

          {/* Tab switcher */}
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-1 flex flex-wrap gap-1">
            {TABS.map(t => (
              <button key={t.id} onClick={() => { setTab(t.id as any); setSearch(""); }}
                className={`flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-all ${tab === t.id ? "bg-red-900/60 text-red-300 border border-red-800" : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"}`}>
                <t.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{t.label}</span>
                <span className="ml-auto text-[10px] opacity-60">{t.count}</span>
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search platforms..."
              className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-red-800 transition-colors" />
          </div>

          {/* Platform grid */}
          <div className="space-y-1 max-h-[600px] overflow-y-auto pr-0.5">
            {filtered.length === 0 && (
              <div className="text-center text-gray-600 text-sm py-8">No platforms match "{search}"</div>
            )}
            {filtered.map(p => (
              <button key={p.id} onClick={() => selectPlatform(p)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all group ${selected?.id === p.id ? "bg-red-950/50 border-red-800" : "bg-gray-900 border-gray-800 hover:bg-gray-850 hover:border-gray-700"}`}>
                {/* Color dot + emoji */}
                <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 text-base" style={{ background: p.bg, border: `1px solid ${p.color}22` }}>
                  {p.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-white truncate">{p.name}</span>
                    {p.legacy && <span className="text-[9px] bg-amber-900/60 text-amber-400 border border-amber-800 px-1 py-0.5 rounded font-bold">LEGACY</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-gray-600">{p.category}</span>
                    {p.strategy === "auto" && <span className="text-[9px] bg-green-900/40 text-green-400 px-1 py-0.5 rounded">AUTO</span>}
                    {p.genre && <span className="text-[10px] text-gray-700">{p.genre}</span>}
                  </div>
                </div>
                <div className="w-2 h-2 rounded-full shrink-0 opacity-60" style={{ background: p.color }} />
              </button>
            ))}
          </div>

          {/* Active sessions */}
          {sessions.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Radio className="h-3 w-3 text-green-400 animate-pulse" /> Active Sessions ({sessions.length})
              </h3>
              <div className="space-y-1.5">
                {sessions.map(s => (
                  <div key={s.id} className="flex items-center gap-2 bg-gray-800 rounded-lg px-2 py-1.5">
                    <span className="text-sm shrink-0">{s.platform?.emoji || "🌐"}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">{s.platform?.name || s.id.slice(0, 8)}</div>
                      <div className="text-[10px] text-gray-600 truncate">{s.accountInfo?.username || s.accountInfo?.email || "session"}</div>
                    </div>
                    <button onClick={() => { setSession(s); if (iframeRef.current) { const proxy = `${API}/navigate?sid=${s.id}&url=${encodeURIComponent(s.currentUrl)}`; iframeRef.current.src = proxy; } }}
                      className="text-blue-400 hover:text-blue-300 text-[10px] font-bold">OPEN</button>
                    <button onClick={() => deleteSession(s.id)} className="text-gray-600 hover:text-red-400">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Details + Browser ─────────────────────────────────────── */}
        <div className="xl:col-span-3 space-y-4">

          {!selected ? (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-16 text-center">
              <Globe className="h-12 w-12 text-gray-700 mx-auto mb-4" />
              <p className="text-gray-500 text-sm">Select a platform from the left to begin the security audit</p>
              <p className="text-gray-700 text-xs mt-2">80+ platforms — social media, gaming launchers, specific game titles, and legacy systems</p>
            </div>
          ) : (
            <>
              {/* Platform header */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5" style={{ borderTopColor: selected.color, borderTopWidth: 2 }}>
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex items-center justify-center w-14 h-14 rounded-xl text-3xl shrink-0" style={{ background: selected.bg, border: `1px solid ${selected.color}33` }}>
                    {selected.emoji}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h2 className="text-xl font-black text-white">{selected.name}</h2>
                      {selected.legacy && <Badge className="bg-amber-900 text-amber-300 border-amber-700 text-xs">⚠ Legacy System</Badge>}
                      <Badge className={`text-xs ${selected.strategy === "auto" ? "bg-green-900 text-green-300 border-green-800" : "bg-blue-900 text-blue-300 border-blue-800"}`}>
                        {selected.strategy === "auto" ? "✓ Auto-Login" : "⟳ Manual Mode"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                      <span className="bg-gray-800 px-2 py-0.5 rounded">{selected.category}</span>
                      {selected.genre && <span className="bg-gray-800 px-2 py-0.5 rounded">{selected.genre}</span>}
                      <span className="font-mono text-gray-600 truncate max-w-[200px]">{selected.loginUrl}</span>
                    </div>
                    {selected.notes && (
                      <p className="text-xs text-amber-600 mt-1.5">ℹ {selected.notes}</p>
                    )}
                    {selected.legacy && (
                      <p className="text-xs text-amber-500 mt-1">🔍 Legacy system — older auth patterns may expose session fixation, CSRF, weak token entropy, or plaintext credentials in older API versions</p>
                    )}
                  </div>

                  {/* Status badge */}
                  <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border shrink-0 ${status === "breached" ? "bg-red-950 border-red-700 text-red-400" : status === "manual" ? "bg-yellow-950 border-yellow-700 text-yellow-400" : status === "failed" ? "bg-red-950 border-red-900 text-red-600" : "bg-gray-800 border-gray-700 text-gray-400"}`}>
                    {sc.icon} {sc.label}
                  </div>
                </div>

                {/* Credential form */}
                {(status === "idle" || status === "failed") && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {selected.fields.username && (
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Username</label>
                        <Input value={username} onChange={e => setUsername(e.target.value)} placeholder="username" className="bg-gray-800 border-gray-700 text-white text-sm h-9 font-mono" onKeyDown={e => e.key === "Enter" && attemptLogin()} />
                      </div>
                    )}
                    {selected.fields.email && (
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Email</label>
                        <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="user@email.com" type="email" className="bg-gray-800 border-gray-700 text-white text-sm h-9 font-mono" onKeyDown={e => e.key === "Enter" && attemptLogin()} />
                      </div>
                    )}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Password</label>
                      <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password" className="bg-gray-800 border-gray-700 text-white text-sm h-9" onKeyDown={e => e.key === "Enter" && attemptLogin()} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">Target URL <span className="text-gray-700">(override)</span></label>
                      <Input value={customUrl} onChange={e => setCustomUrl(e.target.value)} placeholder={selected.loginUrl} className="bg-gray-800 border-gray-700 text-white text-sm h-9 font-mono" />
                    </div>
                    <div className="flex items-end">
                      <Button onClick={attemptLogin} className="h-9 bg-red-700 hover:bg-red-600 text-white font-bold w-full">
                        <LogIn className="h-4 w-4 mr-2" />
                        {selected.strategy === "auto" ? "Auto Login" : "Open Browser"}
                      </Button>
                    </div>
                    {status === "failed" && (
                      <div className="sm:col-span-3">
                        <p className="text-xs text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-3 py-2">{statusMsg}</p>
                      </div>
                    )}
                  </div>
                )}

                {(status === "connecting" || status === "authenticating") && (
                  <div className="flex items-center gap-3 py-3">
                    <RefreshCw className="h-5 w-5 animate-spin text-amber-400 shrink-0" />
                    <div>
                      <p className={`text-sm font-semibold ${sc.color}`}>{sc.label}</p>
                      <p className="text-xs text-gray-500">{statusMsg}</p>
                    </div>
                  </div>
                )}

                {(status === "breached" || status === "manual") && session && (
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold ${status === "breached" ? "bg-red-950/60 border border-red-800 text-red-400" : "bg-yellow-950/60 border border-yellow-800 text-yellow-400"}`}>
                      {status === "breached" ? <CheckCircle2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
                      {status === "breached" ? "Session Active" : "Manual — Enter Credentials Below"}
                    </div>
                    {session.accountInfo?.username && <span className="text-xs text-gray-400 font-mono">{session.accountInfo.username}</span>}
                    {session.accountInfo?.email && <span className="text-xs text-gray-400 font-mono">{session.accountInfo.email}</span>}
                    {session.accountInfo?.uid && <span className="text-xs text-gray-600 font-mono">uid:{session.accountInfo.uid}</span>}
                    <button onClick={() => { setStatus("idle"); setSession(null); }} className="ml-auto text-xs text-gray-500 hover:text-red-400 flex items-center gap-1">
                      <XCircle className="h-3.5 w-3.5" /> End Session
                    </button>
                  </div>
                )}
              </div>

              {/* Proxy browser */}
              {session && (
                <div className="bg-gray-950 border-2 border-red-900 rounded-xl overflow-hidden shadow-2xl shadow-red-950/30">
                  {/* Nav bar */}
                  <div className="bg-gray-900 border-b border-gray-800 px-3 py-2 flex items-center gap-2">
                    <button onClick={navBack} disabled={navIndex <= 0} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button onClick={navForward} disabled={navIndex >= navHistory.length - 1} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button onClick={() => { if (iframeRef.current) iframeRef.current.src = iframeRef.current.src; }} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                      <RefreshCw className="h-4 w-4" />
                    </button>

                    {/* URL bar */}
                    <div className="flex-1">
                      <input
                        value={navUrl}
                        onChange={e => setNavUrl(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && navGo(navUrl)}
                        placeholder="Enter URL..."
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-red-800 transition-colors"
                      />
                    </div>

                    {/* Home button */}
                    <button onClick={() => navGo(selected.homeUrl)} className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                      <ExternalLink className="h-4 w-4" />
                    </button>

                    {/* Status indicator */}
                    <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-lg border shrink-0 ${status === "breached" ? "bg-red-950/60 border-red-800 text-red-400" : "bg-yellow-950/60 border-yellow-800 text-yellow-400"}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      {status === "breached" ? "LIVE" : "MANUAL"}
                    </div>
                  </div>

                  {/* Platform info bar */}
                  <div className="bg-gray-900/50 border-b border-gray-800 px-4 py-1.5 flex items-center gap-3 text-[11px] font-mono">
                    <span className="text-red-400">proxhq@breach</span>
                    <span className="text-gray-500">platform: <span className="text-gray-300">{selected.name}</span></span>
                    <span className="text-gray-500">account: <span className="text-gray-300">{session.accountInfo?.username || session.accountInfo?.email || "—"}</span></span>
                    <span className="text-gray-500">session: <span className="text-gray-700">{session.id.slice(0, 8)}…</span></span>
                  </div>

                  {/* Browser frame */}
                  <iframe
                    ref={iframeRef}
                    className="w-full bg-white"
                    style={{ height: "640px", border: "none" }}
                    sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                    title={`${selected.name} — Breach Browser`}
                  />
                </div>
              )}

              {/* Exploit guidance when no session yet */}
              {!session && selected && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4 text-red-400" /> Known Attack Vectors — {selected.name}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {getVectors(selected).map((v, i) => (
                      <div key={i} className="flex items-start gap-2 bg-gray-800 rounded-lg px-3 py-2">
                        <span className="text-red-400 mt-0.5 shrink-0">{v.sev === "critical" ? "🔴" : v.sev === "high" ? "🟠" : "🟡"}</span>
                        <div>
                          <div className="font-semibold text-gray-200">{v.name}</div>
                          <div className="text-gray-600 leading-tight mt-0.5">{v.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-700 mt-3">
                    These are documented vulnerability patterns found in or common to {selected.name}–type platforms. Use this audit to verify your own implementation is not susceptible.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Per-platform vulnerability guidance ─────────────────────────────────────
function getVectors(p: PlatformDef): Array<{ name: string; desc: string; sev: "critical" | "high" | "medium" }> {
  const common = [
    { name: "Credential Stuffing", desc: "Automated replay of leaked credential pairs against login endpoint", sev: "critical" as const },
    { name: "Account Enumeration", desc: "Different error messages for valid vs. invalid usernames expose account existence", sev: "high" as const },
    { name: "Brute Force / No Lockout", desc: "Unlimited login attempts with no rate limiting or lockout policy", sev: "critical" as const },
    { name: "2FA Bypass via Reset", desc: "Password reset flow skips 2FA, allowing account takeover without OTP", sev: "critical" as const },
    { name: "Session Fixation", desc: "Session token not rotated after login — attacker can pre-set session ID", sev: "high" as const },
    { name: "CSRF on Auth Endpoints", desc: "Missing CSRF token on login/logout/password-change forms", sev: "high" as const },
    { name: "Weak JWT Secret", desc: "JWT signed with guessable or default secret — forgeable tokens", sev: "critical" as const },
    { name: "Cookie Flags Missing", desc: "Session cookies lack HTTPOnly, Secure, or SameSite — XSS / MITM risk", sev: "high" as const },
    { name: "OAuth State Param CSRF", desc: "Missing or predictable state parameter in OAuth flow enables CSRF takeover", sev: "high" as const },
    { name: "Password Reset Token Reuse", desc: "Reset token remains valid after use — can be replayed for account access", sev: "medium" as const },
    { name: "Host Header Injection", desc: "Password reset email uses Host header for link generation — redirect poisoning", sev: "high" as const },
    { name: "Rate Limiting Bypass", desc: "IP rotation or X-Forwarded-For header spoofing bypasses brute force protection", sev: "high" as const },
  ];

  const gaming = [
    { name: "Client-Side Auth Trust", desc: "Game client validates auth locally — easy to patch out or bypass offline", sev: "critical" as const },
    { name: "Replay Attack on Tokens", desc: "Auth token captured during handshake replayed to hijack sessions", sev: "critical" as const },
    { name: "IDOR on Player ID", desc: "Player profile/stats API accepts sequential IDs without auth verification", sev: "high" as const },
    { name: "Weak API Key in Client", desc: "API key or shared secret hardcoded in game binary or config files", sev: "critical" as const },
    { name: "Cheat / Memory Injection", desc: "No server-side validation — game state modifiable by memory editing tools", sev: "high" as const },
    { name: "Item Duplication via Race", desc: "Race condition in item transfer endpoint allows unlimited item duplication", sev: "high" as const },
    { name: "In-Game Currency IDOR", desc: "Currency balance endpoint accepts arbitrary user_id without ownership check", sev: "critical" as const },
    { name: "Rank/Score Manipulation", desc: "Leaderboard endpoint does not validate score server-side — trivially inflatable", sev: "medium" as const },
  ];

  const legacy = [
    { name: "Plaintext Session Cookie", desc: "Session token stored as plain MD5 hash — reversible offline", sev: "critical" as const },
    { name: "SQL Injection in Login", desc: "Old PHP login form directly concatenates user input into SQL query", sev: "critical" as const },
    { name: "Flash/AMF Deserialization", desc: "Legacy Flash AMF endpoints accept arbitrary serialized objects", sev: "critical" as const },
    { name: "Predictable Session IDs", desc: "Sessions generated from timestamp or sequential counter — enumerable", sev: "critical" as const },
    { name: "XML Injection",            desc: "Old XML-based APIs accept entity expansion — XXE or DoS possible", sev: "high" as const },
    { name: "No HTTPS Enforcement",     desc: "Login page served over HTTP — credentials transmitted in plaintext", sev: "critical" as const },
  ];

  const social = [
    { name: "OAuth Token Hijack",       desc: "Access token leaked in Referer header or browser history during redirect", sev: "high" as const },
    { name: "Open Redirect in OAuth",   desc: "redirect_uri parameter accepts arbitrary domains — phishing / token theft", sev: "high" as const },
    { name: "Account Takeover via Email", desc: "Unverified email claim in OAuth SSO allows takeover of existing account", sev: "critical" as const },
    { name: "Mass Assignment on Profile", desc: "Profile update API accepts undocumented fields like is_admin or email_verified", sev: "high" as const },
    { name: "GraphQL Introspection",    desc: "GraphQL endpoint exposes full schema — enables targeted field enumeration", sev: "medium" as const },
    { name: "2FA Code Reuse",           desc: "TOTP code accepted multiple times within the same window", sev: "high" as const },
  ];

  if (p.legacy) return [...legacy, ...common.slice(0, 4)];
  if (p.tab === "games" || p.tab === "gaming") return [...gaming, ...common.slice(0, 4)];
  if (p.tab === "social") return [...social, ...common.slice(0, 4)];
  return common;
}
