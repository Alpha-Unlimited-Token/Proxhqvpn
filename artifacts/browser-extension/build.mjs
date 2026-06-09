/**
 * ProxhqVPN Browser Extension Build Script
 * Generates resized PNG icons from the master icon, then zips
 * the extension source into:
 *   - dist/proxhq-extension-chrome.zip  (MV3, Chrome/Edge)
 *   - dist/proxhq-extension-firefox.zip (MV2 variant - same source, note below)
 *
 * Copy the Chrome zip to artifacts/ghost-vpn/public/ for the download page:
 *   node build.mjs
 */

import { createWriteStream, mkdirSync, copyFileSync, readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC  = resolve(__dirname, "src");
const DIST = resolve(__dirname, "dist");
const ICON_SRC = resolve(__dirname, "../../artifacts/ghost-vpn/public/icon-final2.png");
const ICONS_OUT = resolve(SRC, "icons");
const SIZES = [16, 32, 48, 128];

// Output paths
const CHROME_ZIP  = resolve(DIST, "proxhq-extension-chrome.zip");
const FIREFOX_ZIP = resolve(DIST, "proxhq-extension-firefox.zip");
const PUBLIC_COPY = resolve(__dirname, "../../artifacts/ghost-vpn/public/proxhq-extension.zip");

mkdirSync(DIST, { recursive: true });
mkdirSync(ICONS_OUT, { recursive: true });

// ── Generate icons ────────────────────────────────────────────────────────────
async function generateIcons() {
  let sharp;
  try {
    const mod = await import("sharp");
    sharp = mod.default;
  } catch {
    console.log("⚠  sharp not available — copying master icon for all sizes");
    for (const size of SIZES) {
      const dest = resolve(ICONS_OUT, `icon${size}.png`);
      if (!existsSync(dest)) {
        if (existsSync(ICON_SRC)) {
          copyFileSync(ICON_SRC, dest);
        } else {
          // Write a minimal 1x1 transparent PNG as fallback
          const minimalPng = Buffer.from(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6260000000020001e221bc330000000049454e44ae426082",
            "hex"
          );
          writeFileSync(dest, minimalPng);
        }
      }
    }
    return;
  }

  for (const size of SIZES) {
    const dest = resolve(ICONS_OUT, `icon${size}.png`);
    await sharp(ICON_SRC)
      .resize(size, size, { fit: "cover" })
      .png()
      .toFile(dest);
    console.log(`✓ icon${size}.png`);
  }
}

// ── Create zip ────────────────────────────────────────────────────────────────
function createZip(outputPath) {
  return new Promise((resolve_p, reject) => {
    const output = createWriteStream(outputPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`✓ ${outputPath} (${archive.pointer()} bytes)`);
      resolve_p();
    });
    archive.on("error", reject);
    archive.pipe(output);

    // Add all source files
    archive.directory(SRC, false);

    archive.finalize();
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
  console.log("Building ProxhqVPN Browser Extension…");

  await generateIcons();
  await createZip(CHROME_ZIP);
  await createZip(FIREFOX_ZIP);

  // Copy to ghost-vpn public for the download page
  copyFileSync(CHROME_ZIP, PUBLIC_COPY);
  console.log(`✓ Copied to ghost-vpn/public/proxhq-extension.zip`);

  console.log("\nDone! Load in Chrome:");
  console.log("  1. Open chrome://extensions");
  console.log("  2. Enable Developer Mode");
  console.log(`  3. Click \"Load unpacked\" → select: ${SRC}`);
  console.log("\nOr distribute via the .zip in dist/");
})();
