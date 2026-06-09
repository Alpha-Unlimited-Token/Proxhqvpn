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

let config = { ...DEFAULT_CONFIG };

// ── Load config ──────────────────────────────────────────────────────────────
async function loadConfig() {
  const stored = await chrome.storage.sync.get(DEFAULT_CONFIG);
  config = { ...DEFAULT_CONFIG, ...stored };
  return config;
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

// ── SOCKS5 proxy ─────────────────────────────────────────────────────────────
async function setProxy(enabled) {
  if (!enabled || !config.proxyHost || !config.proxyPort) {
    // Clear proxy
    await chrome.proxy.settings.set({
      value: { mode: "direct" },
      scope: "regular",
    });
    updateBadge(false);
    return;
  }

  const proxyConfig = {
    mode: "fixed_servers",
    rules: {
      singleProxy: {
        scheme: "socks5",
        host: config.proxyHost,
        port: parseInt(String(config.proxyPort), 10),
      },
      bypassList: ["localhost", "127.0.0.1", "::1"],
    },
  };

  await chrome.proxy.settings.set({
    value: proxyConfig,
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
      sendResponse({
        proxyEnabled: proxySettings.value?.mode === "fixed_servers",
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
      await chrome.storage.sync.set({ proxyEnabled: msg.enabled });
      await setProxy(msg.enabled);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "TOGGLE_WEBRTC") {
      config.webrtcEnabled = msg.enabled;
      await chrome.storage.sync.set({ webrtcEnabled: msg.enabled });
      await setWebRtcProtection(msg.enabled);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "TOGGLE_DOH") {
      config.dohEnabled = msg.enabled;
      await chrome.storage.sync.set({ dohEnabled: msg.enabled });
      await setDoh(msg.enabled);
      sendResponse({ ok: true });
      return;
    }

    if (msg.type === "TOGGLE_DNSMODE") {
      config.dnsModeEnabled = msg.enabled;
      await chrome.storage.sync.set({ dnsModeEnabled: msg.enabled });
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
    await chrome.storage.sync.set({ proxyEnabled: true });
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
  const isOn = proxySettings.value?.mode === "fixed_servers";
  updateBadge(isOn);
});
