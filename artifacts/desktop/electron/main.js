const { app, BrowserWindow, ipcMain, session, dialog, shell, Tray, Menu, Notification } = require("electron");
const path = require("path");
const { exec, execFile, spawn } = require("child_process");
const fs = require("fs");
const https = require("https");
const os = require("os");

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

const SERVERS = [
  "https://proxhq.app",
  "https://proxhqvpn.com",
];
const DEV_URL = "http://localhost:24043";

let activeServerUrl = SERVERS[0];

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
let tray = null;

// ─── Setup wizard window ───────────────────────────────────────────────────
function createSetupWindow() {
  setupWindow = new BrowserWindow({
    width: 620,
    height: 600,
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

  // Auto-attempt config generation after the user signs in
  mainWindow.webContents.on("did-finish-load", () => {
    const store = readStore();
    if (!store.vpnConfigInstalled) {
      // Attempt silently — only fires if there's an active session
      setTimeout(() => attemptAutoConfig(mainWindow), 3000);
    }
    // Start per-app network monitor
    startAppMonitor(mainWindow);
  });

  mainWindow.on("closed", () => {
    stopAppMonitor();
    mainWindow = null;
  });
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
  if (platform === "win32")  return installWireGuardWindows(sendProgress);
  if (platform === "darwin") return installWireGuardMac(sendProgress);
  if (platform === "linux")  return installWireGuardLinux(sendProgress);
  throw new Error("Unsupported platform: " + platform);
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
        if (total) sendProgress({ step: "Downloading WireGuard...", percent: Math.round(10 + (downloaded / total) * 40) });
      });
      res.on("end", () => { file.end(); resolve(); });
      res.on("error", reject);
    }).on("error", reject);
  });

  sendProgress({ step: "Installing WireGuard silently...", percent: 55 });

  await new Promise((resolve, reject) => {
    execFile(tmpPath, ["/S"], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  sendProgress({ step: "WireGuard installed.", percent: 70 });
  try { fs.unlinkSync(tmpPath); } catch {}
}

async function installWireGuardMac(sendProgress) {
  sendProgress({ step: "Checking for Homebrew...", percent: 10 });
  const brewExists = await new Promise((r) => exec("which brew", (e) => r(!e)));
  if (!brewExists) {
    sendProgress({ step: "Installing Homebrew...", percent: 15 });
    await runCommand(
      '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      sendProgress, "Installing Homebrew"
    );
  }
  sendProgress({ step: "Installing WireGuard via Homebrew...", percent: 40 });
  await runCommand("brew install wireguard-tools", sendProgress, "Installing wireguard-tools");
  sendProgress({ step: "WireGuard installed.", percent: 70 });
}

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
    throw new Error("Could not detect a supported package manager.");
  }
  sendProgress({ step: "WireGuard installed.", percent: 70 });
}

// ─── VPN Config Generation ────────────────────────────────────────────────
function getWireGuardConfigDir() {
  if (process.platform === "win32") return "C:\\ProgramData\\WireGuard";
  if (process.platform === "darwin") {
    try {
      const p = "/usr/local/etc/wireguard";
      if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
      return p;
    } catch { return "/tmp"; }
  }
  return "/etc/wireguard";
}

async function generateAndInstallConfig(sendProgress, win) {
  const tunnelMode = readStore().tunnelMode || "split";
  const machineName = os.hostname().replace(/[^a-zA-Z0-9-]/g, "-").slice(0, 30) || "desktop";

  sendProgress({ step: "Registering device with ProxhqVPN...", percent: 75 });

  // Use an invisible BrowserWindow in the same session to make the authenticated API call
  const authWin = new BrowserWindow({
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  let configResult = null;
  try {
    await authWin.loadURL(activeServerUrl + "/dashboard");

    configResult = await authWin.webContents.executeJavaScript(`
      (async () => {
        try {
          const r = await fetch('/api/devices', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: '${machineName}', platform: '${process.platform}' })
          });
          if (!r.ok) return { ok: false, status: r.status };
          const d = await r.json();
          return { ok: true, config: d.clientConfig || d.config || '', deviceId: d.id || d.deviceId || '' };
        } catch (e) {
          return { ok: false, error: e.message };
        }
      })()
    `);
  } catch (e) {
    console.warn("[config-gen] Auth window error:", e.message);
    configResult = { ok: false, error: e.message };
  } finally {
    try { authWin.destroy(); } catch {}
  }

  if (!configResult || !configResult.ok) {
    const reason = configResult?.status === 401 ? "not-signed-in" : (configResult?.error || "api-error");
    console.log("[config-gen] Config generation skipped:", reason);
    return { success: false, reason };
  }

  let configText = configResult.config || "";

  // Apply tunnel mode to AllowedIPs
  if (tunnelMode === "split") {
    // Only route the VPN subnet — all other traffic goes direct
    configText = configText.replace(/AllowedIPs\s*=\s*0\.0\.0\.0\/0[^\n]*/g, "AllowedIPs = 10.8.0.0/24");
    configText = configText.replace(/,\s*::[\/0-9]+/g, "");
    configText = configText.replace(/AllowedIPs\s*=\s*::[\/0-9]+[^\n]*/g, "");
  }
  // full mode: keep AllowedIPs = 0.0.0.0/0, ::/0 as generated

  sendProgress({ step: "Saving VPN configuration...", percent: 85 });

  const configDir = getWireGuardConfigDir();
  const configName = "proxhqvpn";
  const configPath = path.join(configDir, `${configName}.conf`);

  try {
    if (!fs.existsSync(configDir)) fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(configPath, configText, { mode: 0o600 });
  } catch (e) {
    console.warn("[config-gen] Failed to save config:", e.message);
    return { success: false, reason: "save-failed", error: e.message };
  }

  sendProgress({ step: "Activating VPN tunnel...", percent: 92 });

  // Install and start the WireGuard tunnel
  await new Promise((resolve) => {
    let cmd;
    if (process.platform === "win32") {
      // WireGuard Windows CLI
      const wgExe = "C:\\Program Files\\WireGuard\\wireguard.exe";
      cmd = `"${wgExe}" /installtunnel "${configPath}"`;
    } else {
      cmd = `sudo wg-quick up ${configName} 2>/dev/null || true`;
    }
    exec(cmd, { timeout: 30000 }, (err) => {
      if (err) console.warn("[config-gen] Tunnel start warning:", err.message);
      resolve(); // non-fatal — tunnel may already exist or need reboot
    });
  });

  sendProgress({ step: "ProxhqVPN tunnel active!", percent: 100, done: true });
  writeStore({ vpnConfigInstalled: true, tunnelMode, configPath, deviceName: machineName });
  return { success: true, tunnelMode, configPath };
}

// Silent auto-config attempt triggered after main window loads
async function attemptAutoConfig(win) {
  const store = readStore();
  if (store.vpnConfigInstalled) return;

  const result = await generateAndInstallConfig(() => {}, win);
  if (result.success) {
    console.log("[config-gen] Auto-config installed:", result.configPath);
    if (win && !win.isDestroyed() && Notification.isSupported()) {
      new Notification({
        title: "ProxhqVPN — Tunnel Active",
        body: result.tunnelMode === "split"
          ? "Your VPN is connected in Split Tunnel mode. Apps work normally."
          : "Your VPN is connected in Full Tunnel mode. All traffic is protected.",
        icon: path.join(__dirname, "..", "assets", "icon.png"),
      }).show();
    }
  }
}

// ─── Per-App Network Monitor ──────────────────────────────────────────────
let appMonitorInterval = null;
const seenProcessPaths = new Set();

function loadAppRules() {
  return readStore().appRules || {};
}
function saveAppRule(appPath, action) {
  const store = readStore();
  store.appRules = { ...(store.appRules || {}), [appPath]: action };
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

async function getNetworkProcesses() {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      // Get established outbound connections + their owning process paths (no admin needed)
      const ps = `$r=Get-NetTCPConnection -State Established -EA SilentlyContinue | Where-Object {$_.RemoteAddress -notmatch '^(127\\.0\\.0\\.1|::1|0\\.0\\.0\\.0)$'} | Select-Object -Unique OwningProcess; $o=@(); foreach($c in $r){try{$p=Get-Process -Id $c.OwningProcess -EA SilentlyContinue; if($p.Path){$o+=[PSCustomObject]@{Name=$p.ProcessName;Path=$p.Path}}}catch{}}; $o|Select-Object -Unique Name,Path|ConvertTo-Json -Compress`;
      exec(`powershell -NoProfile -NonInteractive -Command "${ps}"`, { timeout: 12000 }, (err, stdout) => {
        if (err || !stdout.trim()) { resolve([]); return; }
        try {
          const d = JSON.parse(stdout.trim());
          resolve(Array.isArray(d) ? d : (d && d.Name ? [d] : []));
        } catch { resolve([]); }
      });
    } else if (process.platform === "darwin") {
      exec("lsof -nP -iTCP -sTCP:ESTABLISHED 2>/dev/null | awk 'NR>1{print $1\"|\"$9}' | sort -u", { timeout: 8000 }, (err, stdout) => {
        if (err || !stdout.trim()) { resolve([]); return; }
        const procs = [];
        const seen = new Set();
        for (const line of stdout.trim().split("\n")) {
          const [name] = line.split("|");
          if (name && !seen.has(name) && !["node", "Electron"].includes(name)) {
            seen.add(name);
            procs.push({ Name: name, Path: name });
          }
        }
        resolve(procs);
      });
    } else {
      exec("ss -tnp state established 2>/dev/null | grep -oP 'users:\\(\\(\"[^\"]+\"' | grep -oP '\"[^\"]+\"' | tr -d '\"' | sort -u", { timeout: 8000 }, (err, stdout) => {
        if (err || !stdout.trim()) { resolve([]); return; }
        const procs = stdout.trim().split("\n")
          .filter(n => n && !["node", "electron"].includes(n.toLowerCase()))
          .map(n => ({ Name: n, Path: n }));
        resolve(procs);
      });
    }
  });
}

function applyFirewallRule(appPath, action) {
  // action: "allow" | "block"
  if (process.platform === "win32") {
    const appName = path.basename(appPath, ".exe");
    const ruleName = `ProxhqVPN ${action === "allow" ? "Allow" : "Block"} ${appName}`;
    // Remove any existing ProxhqVPN rule for this app first
    exec(`netsh advfirewall firewall delete rule name="${ruleName}" 2>nul`, () => {
      const cmd = `netsh advfirewall firewall add rule name="${ruleName}" dir=out action=${action} program="${appPath}" enable=yes profile=any`;
      exec(cmd, (err) => {
        if (err) console.warn("[firewall] Rule add failed:", err.message);
        else console.log(`[firewall] ${action} rule added for ${appName}`);
      });
    });
  } else if (process.platform === "linux" && action === "block") {
    const appName = path.basename(appPath);
    exec(`sudo iptables -I OUTPUT -m owner --cmd-owner ${appName} -j DROP 2>/dev/null || true`);
  }
}

function startAppMonitor(win) {
  if (appMonitorInterval) return;
  const rules = loadAppRules();
  // Pre-populate known processes so we don't alert on existing connections at startup
  getNetworkProcesses().then(procs => {
    procs.forEach(p => { if (p.Path) seenProcessPaths.add(p.Path); });
  });

  appMonitorInterval = setInterval(async () => {
    const procs = await getNetworkProcesses();
    const currentRules = loadAppRules();

    for (const proc of procs) {
      const key = proc.Path || proc.Name;
      if (!key || seenProcessPaths.has(key)) continue;
      seenProcessPaths.add(key);

      // Skip system processes
      const systemProcesses = ["svchost", "lsass", "wininit", "services", "csrss", "smss", "System", "Registry"];
      if (systemProcesses.some(sp => proc.Name?.toLowerCase().startsWith(sp.toLowerCase()))) continue;

      // Skip if we already have a rule for this app
      if (currentRules[key]) continue;

      // Alert the renderer
      if (win && !win.isDestroyed()) {
        win.webContents.send("app-alert", {
          name: proc.Name || path.basename(key),
          path: key,
        });
      }

      // Show native system notification
      if (Notification.isSupported()) {
        const notif = new Notification({
          title: "ProxhqVPN — New App Detected",
          body: `${proc.Name || path.basename(key)} is connecting to the internet. Click to allow or block.`,
          icon: path.join(__dirname, "..", "assets", "icon.png"),
        });
        notif.show();
        notif.on("click", () => {
          if (win && !win.isDestroyed()) { win.show(); win.focus(); }
        });
      }
    }
  }, 6000); // Poll every 6 seconds
}

function stopAppMonitor() {
  if (appMonitorInterval) {
    clearInterval(appMonitorInterval);
    appMonitorInterval = null;
  }
}

// ─── System Tray ──────────────────────────────────────────────────────────
function createTray() {
  const iconPath = path.join(__dirname, "..", "assets", "icon.png");
  if (!fs.existsSync(iconPath)) return;

  tray = new Tray(iconPath);
  tray.setToolTip("ProxhqVPN");

  const updateMenu = () => {
    const store = readStore();
    const tunnelMode = store.tunnelMode || "split";
    const vpnActive = store.vpnConfigInstalled === true;

    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "ProxhqVPN", type: "normal", enabled: false },
      { type: "separator" },
      { label: vpnActive ? "● VPN Connected" : "○ VPN Inactive", enabled: false },
      { label: `Mode: ${tunnelMode === "split" ? "Split Tunnel" : "Full Tunnel"}`, enabled: false },
      { type: "separator" },
      {
        label: "Open ProxhqVPN",
        click: () => {
          if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
          else createMainWindow();
        },
      },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]));
  };

  updateMenu();
  tray.on("double-click", () => {
    if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
  });
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

    // Immediately attempt config generation as part of the same install flow
    const configResult = await generateAndInstallConfig(send, setupWindow);

    if (configResult.success) {
      send({ step: "ProxhqVPN is ready!", percent: 100, done: true, configInstalled: true });
    } else if (configResult.reason === "not-signed-in") {
      send({ step: "WireGuard ready — sign in to activate your tunnel.", percent: 100, done: true, configInstalled: false, needsAuth: true });
    } else {
      send({ step: "WireGuard installed — VPN config will activate on first sign-in.", percent: 100, done: true, configInstalled: false });
    }

    writeStore({ wireguardInstalled: true, installedAt: new Date().toISOString() });
    return { success: true };
  } catch (err) {
    send({ step: "Error: " + err.message, percent: 0, error: true });
    return { success: false, error: err.message };
  }
});

ipcMain.handle("set-tunnel-mode", (_, mode) => {
  if (mode !== "split" && mode !== "full") return { error: "Invalid mode" };
  writeStore({ tunnelMode: mode });
  return { ok: true };
});

ipcMain.handle("get-tunnel-mode", () => {
  return { mode: readStore().tunnelMode || "split" };
});

ipcMain.handle("generate-vpn-config", async (event) => {
  const send = (data) => event.sender.send("vpn-config-progress", data);
  const result = await generateAndInstallConfig(send, mainWindow);
  return result;
});

ipcMain.handle("get-app-rules", () => {
  return loadAppRules();
});

ipcMain.handle("allow-app", (_, appPath) => {
  applyFirewallRule(appPath, "allow");
  saveAppRule(appPath, "allow");
  seenProcessPaths.add(appPath);
  return { ok: true };
});

ipcMain.handle("block-app", (_, appPath) => {
  applyFirewallRule(appPath, "block");
  saveAppRule(appPath, "block");
  seenProcessPaths.add(appPath);
  return { ok: true };
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
      console.log(`[updater] Update available: v${info.version}`);
      if (mainWindow) {
        mainWindow.webContents.executeJavaScript(
          `window.__proxhqUpdateAvailable = ${JSON.stringify(info)};`
        ).catch(() => {});
      }
    });

    autoUpdater.on("update-downloaded", (info) => {
      console.log(`[updater] Update downloaded: v${info.version}`);
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

    setTimeout(() => { autoUpdater.checkForUpdatesAndNotify().catch(() => {}); }, 10_000);
    setInterval(() => { autoUpdater.checkForUpdatesAndNotify().catch(() => {}); }, 4 * 60 * 60 * 1000);
  } catch (e) {
    console.warn("[updater] Failed to configure updater:", e.message);
  }
}

ipcMain.handle("install-update-now", () => {
  if (autoUpdater) autoUpdater.quitAndInstall(false, true);
});

ipcMain.handle("get-app-version", () => app.getVersion());

// ─── App lifecycle ─────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  const serverUrl = await resolveActiveServer();
  createTray();

  const store = readStore();
  const alreadySetUp = store.setupComplete === true;

  if (alreadySetUp) {
    createMainWindow();
    if (mainWindow) {
      mainWindow.webContents.on("did-finish-load", () => configureUpdater(serverUrl));
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
