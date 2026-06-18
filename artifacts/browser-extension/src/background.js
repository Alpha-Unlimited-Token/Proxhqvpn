// ProxhqVPN Background Service Worker
// © 2026 Alpha Unlimited Technologies LLC

const DEFAULT_CONFIG = {
  dashboardUrl: "https://proxhqvpn.com",
  proxyHost: "",
  proxyPort: 1080,
  proxyUser: "",
  proxyPass: "",
  proxyEnabled: false,
  webrtcEnabled: false,
  dohEnabled: false,
  dnsModeEnabled: false,
  autoEnable: false,
  showNotifs: true,
};

// Sensitive fields that must NEVER sync to Google's servers.
// Proxy credentials belong in local storage only.
const LOCAL_KEYS = ["proxyHost", "proxyPort", "proxyUser", "proxyPass"];
const SYNC_KEYS  = ["dashboardUrl", "proxyEnabled", "webrtcEnabled", "dohEnabled",
                    "dnsModeEnabled", "autoEnable", "showNotifs"];

let config = { ...DEFAULT_CONFIG };

// ── Load config (sync for preferences, local for credentials) ─────────────────
async function loadConfig() {
  const syncDefaults  = SYNC_KEYS.reduce((o, k) => ({ ...o, [k]: DEFAULT_CONFIG[k] }), {});
  const localDefaults = LOCAL_KEYS.reduce((o, k) => ({ ...o, [k]: DEFAULT_CONFIG[k] }), {});
  const [synced, local] = await Promise.all([
    chrome.storage.sync.get(syncDefaults),
    chrome.storage.local.get(localDefaults),
  ]);
  config = { ...DEFAULT_CONFIG, ...synced, ...local };
  return config;
}

// ── Save sensitive fields to local storage only ───────────────────────────────
async function saveSensitiveConfig(updates) {
  const sensitive = {};
  for (const key of LOCAL_KEYS) {
    if (key in updates) sensitive[key] = updates[key];
  }
  if (Object.keys(sensitive).length > 0) {
    await chrome.storage.local.set(sensitive);
    Object.assign(config, sensitive);
  }
}

// ── Save non-sensitive preferences to sync storage ────────────────────────────
async function saveSyncConfig(updates) {
  const safe = {};
  for (const key of SYNC_KEYS) {
    if (key in updates) safe[key] = updates[key];
  }
  if (Object.keys(safe).length > 0) {
    await chrome.storage.sync.set(safe);
    Object.assign(config, safe);
  }
}

// ── Badge helper ─────────────────────────────────────────────────────────────
function updateBadge(enabled) {
  if (enabled) {
    chrome.action.setBadgeText({ text: "ON" });
    chrome.action.setBadgeBackgroundColor({ color: "#00cc66" });
  } else {
    chrome.action.setBadgeText({ text: "OFF" });
    chrome.action.setBadgeBackgroundColor({ color: "#cc2200" });
  }
}

// ── SOCKS5 proxy via PAC script (routes DNS through proxy — fixes DNS leaks) ──
// PAC-based routing means DNS resolves server-side, not in the browser.
// This fixes the DNS leak that occurs when using fixed_servers mode.
async function setProxy(enabled) {
  if (!enabled || !config.proxyHost || !config.proxyPort) {
    await chrome.proxy.settings.set({
      value: { mode: "direct" },
      scope: "regular",
    });
    updateBadge(false);
    return;
  }

  const host = String(config.proxyHost);
  const port = parseInt(String(config.proxyPort), 10);

  const pacScript = `function FindProxyForURL(url, host) {
    if (shExpMatch(host, "localhost") || isInNet(host, "127.0.0.0", "255.0.0.0") ||
        isInNet(host, "::1", "ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff")) {
      return "DIRECT";
    }
    return "SOCKS5 ${host}:${port}; SOCKS ${host}:${port}; DIRECT";
  }`;

  await chrome.proxy.settings.set({
    value: { mode: "pac_script", pacScript: { data: pacScript } },
    scope: "regular",
  });

  updateBadge(true);
}

// ── WebRTC leak protection ───────────────────────────────────────────────────
async function setWebRtcProtection(enabled) {
  try {
    await chrome.privacy.network.webRTCIPHandlingPolicy.set({
      value: enabled ? "disable_non_proxied_udp" : "default",
      scope: "regular",
    });
  } catch {
    // Privacy API not available in this context — skip silently
  }
}

// ── DoH setting ──────────────────────────────────────────────────────────────
async function setDoh(enabled) {
  try {
    if (chrome.privacy && chrome.privacy.network && chrome.privacy.network.secureDnsMode) {
      await chrome.privacy.network.secureDnsMode.set({
        value: enabled ? "secure" : "automatic",
        scope: "regular",
      });
    }
  } catch {
    // Not all Chrome versions support this
  }
}

// ── Apply all settings ───────────────────────────────────────────────────────
async function applyAll(cfg) {
  await setProxy(cfg.proxyEnabled);
  await setWebRtcProtection(cfg.webrtcEnabled);
  await setDoh(cfg.dohEnabled);
}

// ── Message handler (from popup) ─────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    await loadConfig();

    if (msg.type === "GET_STATUS") {
      const proxySettings = await chrome.proxy.settings.get({});
      const mode = proxySettings.value?.mode;
      sendResponse({
        proxyEnabled: mode === "pac_script" || mode === "fixed_servers",
        webrtcEnabled: config.webrtcEnabled,
        dohEnabled: config.dohEnabled,
        dnsModeEnabled: config.dnsModeEnabled,
        proxyHost: config.proxyHost,
        proxyPort: config.proxyPort,
        dashboardUrl: config.dashboardUrl,
      });
      return;
    }

    if (msg.type === "TOGGLE_PROXY") {
      config.proxyEnabled = msg.enabled;
      await saveSyncConfig({ proxyEnabled: msg.enabled });
      await setProxy(msg.enabled);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "TOGGLE_WEBRTC") {
      config.webrtcEnabled = msg.enabled;
      await saveSyncConfig({ webrtcEnabled: msg.enabled });
      await setWebRtcProtection(msg.enabled);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "TOGGLE_DOH") {
      config.dohEnabled = msg.enabled;
      await saveSyncConfig({ dohEnabled: msg.enabled });
      await setDoh(msg.enabled);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "TOGGLE_DNSMODE") {
      config.dnsModeEnabled = msg.enabled;
      await saveSyncConfig({ dnsModeEnabled: msg.enabled });
      sendResponse({ ok: true });
      return;
    }

    // Save proxy credentials — local storage only, never sync
    if (msg.type === "SAVE_PROXY_CREDENTIALS") {
      await saveSensitiveConfig({
        proxyHost: msg.proxyHost ?? config.proxyHost,
        proxyPort: msg.proxyPort ?? config.proxyPort,
        proxyUser: msg.proxyUser ?? config.proxyUser,
        proxyPass: msg.proxyPass ?? config.proxyPass,
      });
      if (config.proxyEnabled) await setProxy(true);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "CONFIG_UPDATED") {
      await loadConfig();
      await applyAll(config);
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, error: "unknown message type" });
  })();
  return true; // keep channel open for async response
});

// ── Startup ──────────────────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(async () => {
  await loadConfig();
  if (config.autoEnable && config.proxyHost) {
    config.proxyEnabled = true;
    await saveSyncConfig({ proxyEnabled: true });
  }
  await applyAll(config);
});

chrome.runtime.onStartup.addListener(async () => {
  await loadConfig();
  await applyAll(config);
});

// ── Alarm: refresh badge every 60s ───────────────────────────────────────────
chrome.alarms.create("status-refresh", { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "status-refresh") return;
  await loadConfig();
  const proxySettings = await chrome.proxy.settings.get({});
  const mode = proxySettings.value?.mode;
  updateBadge(mode === "pac_script" || mode === "fixed_servers");
});
