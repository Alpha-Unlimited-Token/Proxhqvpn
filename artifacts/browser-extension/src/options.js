// ProxhqVPN Extension Options
// © 2026 Alpha Unlimited Technologies LLC

const $ = (id) => document.getElementById(id);

const FIELDS = [
  "dashboardUrl", "proxyHost", "proxyPort",
  "proxyUser", "proxyPass",
];

const TOGGLES = [
  "defaultWebRtc", "defaultDoh", "autoEnable", "showNotifs",
];

const DEFAULTS = {
  dashboardUrl: "https://proxhqvpn.com",
  proxyHost: "",
  proxyPort: 1080,
  proxyUser: "",
  proxyPass: "",
  defaultWebRtc: true,
  defaultDoh: false,
  autoEnable: false,
  showNotifs: true,
};

function showNotif(msg, type = "ok") {
  const el = $("notif");
  el.textContent = msg;
  el.className = `notif ${type}`;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 4000);
}

async function load() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  FIELDS.forEach((k) => { if ($(k)) $(k).value = stored[k] ?? DEFAULTS[k]; });
  TOGGLES.forEach((k) => { if ($(k)) $(k).checked = stored[k] ?? DEFAULTS[k]; });
}

async function save() {
  const data = {};
  FIELDS.forEach((k) => {
    const el = $(k);
    if (!el) return;
    data[k] = el.type === "number" ? parseInt(el.value, 10) || DEFAULTS[k] : el.value.trim();
  });
  TOGGLES.forEach((k) => {
    const el = $(k);
    if (el) data[k] = el.checked;
  });

  // Map defaultWebRtc → webrtcEnabled etc. for background
  data.webrtcEnabled = data.defaultWebRtc;
  data.dohEnabled = data.defaultDoh;

  await chrome.storage.sync.set(data);

  // Tell background to re-apply
  chrome.runtime.sendMessage({ type: "CONFIG_UPDATED" });

  showNotif("✓ Settings saved", "ok");
}

async function testConnection() {
  const host = $("proxyHost").value.trim();
  const port = parseInt($("proxyPort").value, 10);

  if (!host || !port) {
    showNotif("⚠ Enter a proxy host and port first", "error");
    return;
  }

  showNotif("Testing connection…", "ok");

  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const { ip } = await res.json();
    showNotif(`✓ Reachable — your current IP: ${ip}`, "ok");
  } catch {
    showNotif("✗ Could not reach IP check endpoint — verify proxy settings", "error");
  }
}

$("saveBtn").addEventListener("click", save);
$("testBtn").addEventListener("click", testConnection);

load();
