import { Router } from "express";
import { execSync } from "child_process";
import fetch from "node-fetch";
import { z } from "zod";

const router = Router();

let cachedIp: string | null = null;
let cacheTime = 0;

async function getServerIp(): Promise<string> {
  if (cachedIp && Date.now() - cacheTime < 300_000) return cachedIp;
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(5000) });
    const data = await res.json() as { ip: string };
    cachedIp = data.ip;
    cacheTime = Date.now();
    return cachedIp;
  } catch {
    try {
      const ip = execSync("hostname -I 2>/dev/null | awk '{print $1}'", { encoding: "utf8", timeout: 2000 }).trim();
      return ip || "0.0.0.0";
    } catch {
      return "0.0.0.0";
    }
  }
}

router.get("/server-ip", async (_req, res) => {
  const ip = await getServerIp();
  res.json({ ip, dns1: ip, dns2: "1.1.1.1", dns3: "8.8.8.8" });
});

router.get("/instructions/:platform", async (req, res) => {
  const ip = await getServerIp();
  const platform = req.params.platform;

  const guides: Record<string, { title: string; steps: string[] }> = {
    "samsung-tv": {
      title: "Samsung Smart TV",
      steps: [
        "Press the HOME button on your remote",
        "Go to Settings → General → Network → Network Status",
        "Select IP Settings",
        "Set DNS Setting to Enter Manually",
        `Set DNS Server to: ${ip}`,
        "Select OK and confirm",
        "Restart your Samsung TV",
      ],
    },
    "lg-tv": {
      title: "LG Smart TV (webOS)",
      steps: [
        "Press the Settings gear icon on your remote",
        "Navigate to All Settings → Network → Wired/Wi-Fi Connection → Advanced Settings",
        "Change DNS Server to Manual",
        `Primary DNS: ${ip}`,
        "Secondary DNS: 1.1.1.1",
        "Click Connect and restart",
      ],
    },
    "roku": {
      title: "Roku",
      steps: [
        "Go to Settings → Network → Set up connection",
        "Select your network type (Wireless or Wired)",
        "At the end of the network setup, look for Advanced DNS settings",
        `Enter Primary DNS: ${ip}`,
        "Enter Secondary DNS: 1.1.1.1",
        "Note: Roku does not allow manual DNS on all firmwares — router-level DNS is recommended",
      ],
    },
    "xbox": {
      title: "Xbox Series X/S / Xbox One",
      steps: [
        "Press Xbox button → Settings",
        "Go to General → Network Settings",
        "Select Advanced Settings → DNS Settings → Manual",
        `Primary IPv4 DNS: ${ip}`,
        "Secondary IPv4 DNS: 1.1.1.1",
        "Press B to save, restart console",
      ],
    },
    "ps5": {
      title: "PlayStation 4 / 5",
      steps: [
        "Go to Settings → Network → Set Up Internet Connection",
        "Choose Wi-Fi or LAN",
        "Select Custom, then Auto for IP and DHCP",
        "Set DNS Settings to Manual",
        `Primary DNS: ${ip}`,
        "Secondary DNS: 1.1.1.1",
        "MTU: Automatic, Proxy Server: Do Not Use",
      ],
    },
    "windows": {
      title: "Windows",
      steps: [
        "Open Start → Settings → Network & Internet",
        "Click your active connection, then Edit DNS",
        "Switch to Manual, enable IPv4",
        `Preferred DNS: ${ip}`,
        "Alternate DNS: 1.1.1.1",
        "Click Save",
      ],
    },
    "macos": {
      title: "macOS",
      steps: [
        "Open System Settings → Network",
        "Select your active connection → Details",
        "Click the DNS tab",
        `Click + and add: ${ip}`,
        "Click + and add: 1.1.1.1 as fallback",
        "Click OK and Apply",
      ],
    },
    "ios": {
      title: "iPhone / iPad",
      steps: [
        "Go to Settings → Wi-Fi",
        "Tap the (i) icon next to your Wi-Fi network",
        "Scroll to DNS and tap Configure DNS",
        "Switch to Manual",
        "Remove existing entries, tap Add Server",
        `Add: ${ip}`,
        "Add: 1.1.1.1 as secondary",
        "Tap Save",
      ],
    },
    "android": {
      title: "Android",
      steps: [
        "Go to Settings → Network & Internet → Wi-Fi",
        "Long-press your network, tap Modify Network",
        "Expand Advanced Options",
        "Change IP Settings to Static",
        `Set DNS 1 to: ${ip}`,
        "Set DNS 2 to: 1.1.1.1",
        "Tap Save",
        "Alternatively, use Private DNS: Settings → Network → Private DNS → enter your server hostname",
      ],
    },
    "router": {
      title: "Router (all devices)",
      steps: [
        "Log into your router admin panel (usually 192.168.1.1 or 192.168.0.1)",
        "Locate DHCP settings or DNS settings",
        `Set Primary DNS to: ${ip}`,
        "Set Secondary DNS to: 1.1.1.1",
        "Save and reboot your router",
        "All devices on your network will automatically use PROXHQ DNS",
      ],
    },
  };

  const guide = guides[platform];
  if (!guide) return res.status(404).json({ error: "Unknown platform" });

  res.json({ platform, serverIp: ip, ...guide });
});

router.get("/platforms", async (_req, res) => {
  const ip = await getServerIp();
  res.json({
    serverIp: ip,
    platforms: [
      { id: "samsung-tv", name: "Samsung Smart TV" },
      { id: "lg-tv", name: "LG Smart TV" },
      { id: "roku", name: "Roku" },
      { id: "xbox", name: "Xbox" },
      { id: "ps5", name: "PlayStation 4/5" },
      { id: "windows", name: "Windows" },
      { id: "macos", name: "macOS" },
      { id: "ios", name: "iOS / iPadOS" },
      { id: "android", name: "Android" },
      { id: "router", name: "Router (all devices)" },
    ],
  });
});

router.post("/test", async (_req, res) => {
  const ip = await getServerIp();
  let reachable = false;
  try {
    execSync(`ping -c 1 -W 2 ${ip} 2>/dev/null`, { timeout: 4000 });
    reachable = true;
  } catch { /* not reachable */ }
  res.json({ serverIp: ip, reachable, testedAt: new Date().toISOString() });
});

export default router;
