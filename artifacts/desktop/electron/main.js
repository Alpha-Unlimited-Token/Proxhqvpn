const { app, BrowserWindow, ipcMain, session, dialog, shell } = require("electron");
const path = require("path");
const { exec, execFile, spawn } = require("child_process");
const fs = require("fs");
const https = require("https");
const os = require("os");

// Auto-updater — silently checks for new versions and installs overnight
let autoUpdater = null;
try {
  autoUpdater = require("electron-updater").autoUpdater;
  autoUpdater.logger = require("electron-log");
  autoUpdater.logger.transports.file.level = "info";
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
} catch (e) {
  console.warn("[updater] electron-updater not available:", e.message);
}

const isDev = process.argv.includes("--dev");

// Primary and backup domains — automatic failover if primary is unreachable
const SERVERS = [
  "https://proxhq.app",
  "https://proxhqvpn.com",
];
const DEV_URL = "http://localhost:24043";

let activeServerUrl = SERVERS[0];

// Probe a URL — resolves true if reachable within 4 seconds
function probeUrl(url) {
  return new Promise((resolve) => {
    try {
      const mod = url.startsWith("https") ? https : require("http");
      const req = mod.get(url, { timeout: 4000 }, (res) => {
        resolve(res.statusCode < 500);
        req.destroy();
      });
      req.on("error", () => resolve(false));
      req.on("timeout", () => { req.destroy(); resolve(false); });
    } catch { resolve(false); }
  });
}

// Try each server in order — use the first one that responds
async function resolveActiveServer() {
  if (isDev) { activeServerUrl = DEV_URL; return DEV_URL; }
  for (const url of SERVERS) {
    const ok = await probeUrl(url);
    if (ok) {
      activeServerUrl = url;
      console.log(`[proxhq] Using server: ${url}`);
      return url;
    }
    console.log(`[proxhq] Unreachable: ${url} — trying next...`);
  }
  // All servers failed — use primary anyway and let the offline page handle it
  activeServerUrl = SERVERS[0];
  console.warn("[proxhq] All servers unreachable — defaulting to primary");
  return SERVERS[0];
}

const STORE_PATH = path.join(app.getPath("userData"), "proxhq-config.json");

function readStore() {
  try { return JSON.parse(fs.readFileSync(STORE_PATH, "utf8")); }
  catch { return {}; }
}
function writeStore(data) {
  const current = readStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify({ ...current, ...data }, null, 2));
}

let setupWindow = null;
let mainWindow = null;

// ─── Setup wizard window ───────────────────────────────────────────────────
function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 620,
    height: 560,
    resizable: false,
    frame: false,
    transparent: false,
    backgroundColor: "#040a06",
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webRTCIPHandlingPolicy: "disable_non_proxied_udp",
    },
    icon: path.join(__dirname, "..", "assets", "icon.png"),
  });
  setupWindow.loadFile(path.join(__dirname, "..", "setup", "index.html"));
}

// ─── Main app window ──────────────────────────────────────────────────────
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#040a06",
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      webRTCIPHandlingPolicy: "disable_non_proxied_udp",
    },
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    title: "ProxhqVPN",
  });

  mainWindow.loadURL(activeServerUrl);

  // If load fails, try the other server before showing offline page
  mainWindow.webContents.on("did-fail-load", async () => {
    const fallback = SERVERS.find(s => s !== activeServerUrl);
    if (fallback) {
      const ok = await probeUrl(fallback);
      if (ok) {
        activeServerUrl = fallback;
        console.log(`[proxhq] Failed over to: ${fallback}`);
        mainWindow.loadURL(fallback);
        return;
      }
    }
    mainWindow.loadFile(path.join(__dirname, "..", "setup", "offline.html"));
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ─── OS detection ─────────────────────────────────────────────────────────
function getPlatformInfo() {
  const p = process.platform;
  if (p === "win32")  return { os: "windows", label: "Windows",      pkgMgr: "winget / silent installer" };
  if (p === "darwin") return { os: "mac",     label: "macOS",        pkgMgr: "Homebrew" };
  if (p === "linux")  return { os: "linux",   label: "Linux",        pkgMgr: "apt / dnf / pacman" };
  return { os: "unknown", label: "your system", pkgMgr: "system package manager" };
}

// ─── WireGuard detection ──────────────────────────────────────────────────
async function isWireGuardInstalled() {
  return new Promise((resolve) => {
    const cmds = {
      win32:  "where wireguard.exe",
      darwin: "which wg || brew list wireguard-tools 2>/dev/null",
      linux:  "which wg || which wireguard",
    };
    const cmd = cmds[process.platform] || "which wg";
    exec(cmd, (err) => resolve(!err));
  });
}

// ─── WireGuard installation ───────────────────────────────────────────────
async function installWireGuard(sendProgress) {
  const platform = process.platform;

  if (platform === "win32") {
    return installWireGuardWindows(sendProgress);
  } else if (platform === "darwin") {
    return installWireGuardMac(sendProgress);
  } else if (platform === "linux") {
    return installWireGuardLinux(sendProgress);
  } else {
    throw new Error("Unsupported platform: " + platform);
  }
}

function runCommand(cmd, sendProgress, label) {
  return new Promise((resolve, reject) => {
    sendProgress({ step: label, percent: null, running: true });
    const proc = exec(cmd, { timeout: 120000 });
    proc.stdout?.on("data", (d) => sendProgress({ log: d.toString().trim() }));
    proc.stderr?.on("data", (d) => sendProgress({ log: d.toString().trim() }));
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} failed (exit ${code})`));
    });
  });
}

// Windows: download installer + run silently
async function installWireGuardWindows(sendProgress) {
  const tmpPath = path.join(os.tmpdir(), "wireguard-installer.exe");
  const url = "https://download.wireguard.com/windows-client/wireguard-installer.exe";

  sendProgress({ step: "Downloading WireGuard installer...", percent: 10 });

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tmpPath);
    https.get(url, (res) => {
      const total = parseInt(res.headers["content-length"] || "0", 10);
      let downloaded = 0;
      res.on("data", (chunk) => {
        downloaded += chunk.length;
        file.write(chunk);
        if (total) sendProgress({ step: "Downloading WireGuard...", percent: Math.round(10 + (downloaded / total) * 50) });
      });
      res.on("end", () => { file.end(); resolve(); });
      res.on("error", reject);
    }).on("error", reject);
  });

  sendProgress({ step: "Installing WireGuard silently...", percent: 65 });

  await new Promise((resolve, reject) => {
    execFile(tmpPath, ["/S"], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  sendProgress({ step: "WireGuard installed.", percent: 90 });
  try { fs.unlinkSync(tmpPath); } catch {}
}

// macOS: install via Homebrew
async function installWireGuardMac(sendProgress) {
  sendProgress({ step: "Checking for Homebrew...", percent: 10 });

  const brewExists = await new Promise((r) => exec("which brew", (e) => r(!e)));

  if (!brewExists) {
    sendProgress({ step: "Installing Homebrew (required for WireGuard)...", percent: 15 });
    await runCommand(
      '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      sendProgress, "Installing Homebrew"
    );
  }

  sendProgress({ step: "Installing WireGuard via Homebrew...", percent: 40 });
  await runCommand("brew install wireguard-tools", sendProgress, "Installing wireguard-tools");

  sendProgress({ step: "WireGuard installed.", percent: 90 });
}

// Linux: detect package manager and install
async function installWireGuardLinux(sendProgress) {
  sendProgress({ step: "Detecting package manager...", percent: 10 });

  const detect = (cmd) => new Promise((r) => exec(cmd, (e) => r(!e)));

  if (await detect("which apt-get")) {
    sendProgress({ step: "Installing WireGuard via apt...", percent: 30 });
    await runCommand("sudo apt-get update -qq && sudo apt-get install -y wireguard wireguard-tools", sendProgress, "apt install");
  } else if (await detect("which dnf")) {
    sendProgress({ step: "Installing WireGuard via dnf...", percent: 30 });
    await runCommand("sudo dnf install -y wireguard-tools", sendProgress, "dnf install");
  } else if (await detect("which yum")) {
    sendProgress({ step: "Installing WireGuard via yum...", percent: 30 });
    await runCommand("sudo yum install -y epel-release && sudo yum install -y wireguard-tools", sendProgress, "yum install");
  } else if (await detect("which pacman")) {
    sendProgress({ step: "Installing WireGuard via pacman...", percent: 30 });
    await runCommand("sudo pacman -Sy --noconfirm wireguard-tools", sendProgress, "pacman install");
  } else if (await detect("which zypper")) {
    sendProgress({ step: "Installing WireGuard via zypper...", percent: 30 });
    await runCommand("sudo zypper install -y wireguard-tools", sendProgress, "zypper install");
  } else {
    throw new Error("Could not detect a supported package manager (apt, dnf, yum, pacman, zypper).");
  }

  sendProgress({ step: "WireGuard installed.", percent: 90 });
}

// ─── IPC handlers ─────────────────────────────────────────────────────────
ipcMain.handle("get-platform", () => getPlatformInfo());

ipcMain.handle("check-wireguard", async () => {
  const installed = await isWireGuardInstalled();
  return { installed };
});

ipcMain.handle("install-wireguard", async (event) => {
  const send = (data) => event.sender.send("install-progress", data);
  try {
    send({ step: "Starting installation...", percent: 5 });
    await installWireGuard(send);
    send({ step: "Complete", percent: 100, done: true });
    writeStore({ wireguardInstalled: true, installedAt: new Date().toISOString() });
    return { success: true };
  } catch (err) {
    send({ step: "Error: " + err.message, percent: 0, error: true });
    return { success: false, error: err.message };
  }
});

ipcMain.handle("mark-setup-complete", () => {
  writeStore({ setupComplete: true });
  return true;
});

ipcMain.handle("launch-main-app", () => {
  if (setupWindow) { setupWindow.close(); setupWindow = null; }
  createMainWindow();
});

ipcMain.handle("open-external", (_, url) => shell.openExternal(url));

ipcMain.handle("minimize-window", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});
ipcMain.handle("close-window", (event) => {
  BrowserWindow.fromWebContents(event.sender)?.close();
});

// ─── Auto-update logic ─────────────────────────────────────────────────────
function configureUpdater(serverUrl) {
  if (!autoUpdater || isDev) return;
  try {
    const platform = process.platform;
    const platformPath = platform === "win32" ? "win" : platform === "darwin" ? "mac" : "linux";
    autoUpdater.setFeedURL({
      provider: "generic",
      url: `${serverUrl}/api/updates/${platformPath}`,
      channel: "latest",
    });

    autoUpdater.on("update-available", (info) => {
      console.log(`[updater] Update available: v${info.version} — downloading silently...`);
      if (mainWindow) {
        mainWindow.webContents.executeJavaScript(
          `window.__proxhqUpdateAvailable = ${JSON.stringify(info)};`
        ).catch(() => {});
      }
    });

    autoUpdater.on("update-downloaded", (info) => {
      console.log(`[updater] Update downloaded: v${info.version} — will install on next quit`);
      if (mainWindow) {
        mainWindow.webContents.executeJavaScript(`
          if (window.__proxhqShowUpdateBanner) {
            window.__proxhqShowUpdateBanner(${JSON.stringify(info)});
          }
        `).catch(() => {});
      }
    });

    autoUpdater.on("error", (err) => {
      console.warn("[updater] Auto-update error:", err.message);
    });

    // Check for updates 10 seconds after launch, then every 4 hours
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }, 10_000);

    setInterval(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }, 4 * 60 * 60 * 1000);
  } catch (e) {
    console.warn("[updater] Failed to configure updater:", e.message);
  }
}

// IPC: renderer can ask Electron to install update now
ipcMain.handle("install-update-now", () => {
  if (autoUpdater) autoUpdater.quitAndInstall(false, true);
});

// IPC: get current app version
ipcMain.handle("get-app-version", () => app.getVersion());

// ─── App lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Resolve the fastest reachable server before opening any window
  const serverUrl = await resolveActiveServer();

  const store = readStore();
  const alreadySetUp = store.setupComplete === true;

  if (alreadySetUp) {
    createMainWindow();
    // Start update checks after main window is ready
    if (mainWindow) {
      mainWindow.webContents.on("did-finish-load", () => {
        configureUpdater(serverUrl);
      });
    } else {
      configureUpdater(serverUrl);
    }
  } else {
    createSetupWindow();
  }

  app.on("activate", () => {
    if (!mainWindow && !setupWindow) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
