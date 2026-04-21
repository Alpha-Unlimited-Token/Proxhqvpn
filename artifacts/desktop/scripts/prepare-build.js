#!/usr/bin/env node
/**
 * ProxhqVPN Desktop — Pre-build automation
 *
 * Runs automatically before every electron-builder build.
 * Handles:
 *   1. Copies the PNG icon from the web app assets
 *   2. Generates .ico (Windows) and .icns (macOS) from it automatically
 *   3. Injects the server URL into electron/config.js from environment
 */

const fs   = require("fs");
const path = require("path");

const ROOT       = path.resolve(__dirname, "..");
const WEB_ASSETS = path.resolve(__dirname, "../../ghost-vpn/public");
const ASSETS_DIR = path.join(ROOT, "assets");
const CONFIG_JS  = path.join(ROOT, "electron", "config.js");

// ── Copy PNG icon ──────────────────────────────────────────────────────────
function copyPngIcon() {
  const sources = [
    path.join(WEB_ASSETS, "icon-final2.png"),
    path.join(WEB_ASSETS, "icon-final.png"),
    path.join(WEB_ASSETS, "icon.png"),
  ];
  for (const src of sources) {
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(ASSETS_DIR, "icon.png"));
      console.log(`[prepare] Copied icon from: ${src}`);
      return src;
    }
  }
  console.warn("[prepare] Warning: No source PNG icon found in ghost-vpn/public");
  return null;
}

// ── Generate .ico (Windows) ────────────────────────────────────────────────
async function generateIco(pngPath) {
  if (!pngPath || !fs.existsSync(pngPath)) return;
  try {
    const png2icons = require("png2icons");
    const input = fs.readFileSync(pngPath);
    const ico = png2icons.createICO(input, png2icons.BILINEAR, 0, false, true);
    if (ico) {
      fs.writeFileSync(path.join(ASSETS_DIR, "icon.ico"), ico);
      console.log("[prepare] Generated icon.ico");
    }
  } catch (e) {
    console.warn("[prepare] Could not generate .ico (png2icons may not be installed):", e.message);
    // Fallback: copy PNG with .ico extension so electron-builder can still use it
    fs.copyFileSync(pngPath, path.join(ASSETS_DIR, "icon.ico"));
    console.log("[prepare] Fallback: copied PNG as icon.ico");
  }
}

// ── Generate .icns (macOS) ─────────────────────────────────────────────────
async function generateIcns(pngPath) {
  if (!pngPath || !fs.existsSync(pngPath)) return;
  try {
    const png2icons = require("png2icons");
    const input = fs.readFileSync(pngPath);
    const icns = png2icons.createICNS(input, png2icons.BILINEAR, 0);
    if (icns) {
      fs.writeFileSync(path.join(ASSETS_DIR, "icon.icns"), icns);
      console.log("[prepare] Generated icon.icns");
    }
  } catch (e) {
    console.warn("[prepare] Could not generate .icns:", e.message);
  }
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log("\n[prepare] ProxhqVPN Desktop — running pre-build setup...\n");
  console.log("[prepare] Servers: proxhq.app (primary) → proxhqvpn.com (backup) — hardcoded with auto-failover.\n");

  if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true });

  const pngPath = copyPngIcon();
  await generateIco(pngPath);
  await generateIcns(pngPath);

  console.log("\n[prepare] Pre-build setup complete.\n");
}

main().catch((e) => { console.error("[prepare] Fatal:", e); process.exit(1); });
