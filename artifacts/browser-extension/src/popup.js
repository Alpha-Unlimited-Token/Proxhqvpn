// ProxhqVPN Extension Popup
// © 2026 Alpha Unlimited Technologies LLC

const $ = (id) => document.getElementById(id);

let dashboardUrl = "https://proxhqvpn.com";
let proxyHost = "";
let proxyPort = 1080;

function showNotif(msg, type = "ok") {
  const el = $("notif");
  el.textContent = msg;
  el.className = `notif ${type}`;
  el.style.display = "block";
  setTimeout(() => { el.style.display = "none"; }, 3000);
}

function setStatusCard(state, ip) {
  const card = $("statusCard");
  const label = $("statusLabel");
  const icon  = $("statusIcon");
  const ipEl  = $("statusIp");
  const dot   = $("proxyDot");
  const toggle = $("mainToggle");

  card.className = `status-card ${state}`;

  if (state === "protected") {
    icon.textContent = "🟢";
    label.textContent = "PROTECTED";
    toggle.className = "main-toggle active";
    $("toggleIcon").textContent = "🛡";
    $("toggleLabel").textContent = "VPN Proxy Active";
    dot.className = "proxy-dot active";
  } else if (state === "exposed") {
    icon.textContent = "🔴";
    label.textContent = "EXPOSED";
    toggle.className = "main-toggle inactive";
    $("toggleIcon").textContent = "⚡";
    $("toggleLabel").textContent = "Enable VPN Proxy";
    dot.className = "proxy-dot";
  } else {
    icon.textContent = "🟡";
    label.textContent = "CONNECTING…";
    toggle.className = "main-toggle";
    $("toggleIcon").textContent = "⏸";
    $("toggleLabel").textContent = "Connecting…";
    dot.className = "proxy-dot";
  }

  if (ip) {
    ipEl.textContent = `Exit IP: ${ip}`;
    ipEl.className = "ip";
  }
}

async function fetchCurrentIp() {
  try {
    const res = await fetch("https://api.ipify.org?format=json", { cache: "no-store" });
    const data = await res.json();
    return data.ip || "Unknown";
  } catch {
    return "Unavailable";
  }
}

async function getStatus() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_STATUS" }, (resp) => {
      resolve(resp || {});
    });
  });
}

async function init() {
  const status = await getStatus();
  dashboardUrl = status.dashboardUrl || "https://proxhqvpn.com";
  proxyHost = status.proxyHost || "";
  proxyPort = status.proxyPort || 1080;

  // Show proxy server
  $("proxyServerDisplay").textContent =
    proxyHost ? `${proxyHost}:${proxyPort}` : "Not configured — click Settings";

  // Set toggles
  $("webrtcToggle").checked = !!status.webrtcEnabled;
  $("dohToggle").checked = !!status.dohEnabled;
  $("dnsModeToggle").checked = !!status.dnsModeEnabled;

  // Enable the main toggle button
  $("mainToggle").disabled = false;

  if (status.proxyEnabled) {
    setStatusCard("connecting", null);
    const ip = await fetchCurrentIp();
    setStatusCard("protected", ip);
  } else {
    const ip = await fetchCurrentIp();
    setStatusCard("exposed", ip);
  }
}

// ── Main toggle ───────────────────────────────────────────────────────────────
$("mainToggle").addEventListener("click", async () => {
  const status = await getStatus();
  const nowEnabled = !status.proxyEnabled;

  if (nowEnabled && !proxyHost) {
    showNotif("⚠ No SOCKS5 proxy configured — open Settings", "error");
    return;
  }

  $("mainToggle").disabled = true;
  setStatusCard("connecting", null);

  chrome.runtime.sendMessage({ type: "TOGGLE_PROXY", enabled: nowEnabled }, async () => {
    $("mainToggle").disabled = false;
    if (nowEnabled) {
      const ip = await fetchCurrentIp();
      setStatusCard("protected", ip);
      showNotif("VPN proxy enabled", "ok");
    } else {
      const ip = await fetchCurrentIp();
      setStatusCard("exposed", ip);
      showNotif("VPN proxy disabled", "ok");
    }
  });
});

// ── WebRTC toggle ─────────────────────────────────────────────────────────────
$("webrtcToggle").addEventListener("change", (e) => {
  chrome.runtime.sendMessage({ type: "TOGGLE_WEBRTC", enabled: e.target.checked }, () => {
    showNotif(e.target.checked ? "WebRTC leak protection enabled" : "WebRTC protection disabled", "ok");
  });
});

// ── DoH toggle ────────────────────────────────────────────────────────────────
$("dohToggle").addEventListener("change", (e) => {
  chrome.runtime.sendMessage({ type: "TOGGLE_DOH", enabled: e.target.checked }, () => {
    showNotif(e.target.checked ? "DNS-over-HTTPS enabled" : "DoH disabled", "ok");
  });
});

// ── DNS mode toggle ────────────────────────────────────────────────────────────
$("dnsModeToggle").addEventListener("change", (e) => {
  chrome.runtime.sendMessage({ type: "TOGGLE_DNSMODE", enabled: e.target.checked }, () => {
    showNotif(e.target.checked ? "Secure DNS mode enabled" : "Secure DNS mode disabled", "ok");
  });
});

// ── Change proxy ──────────────────────────────────────────────────────────────
$("changeProxy").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// ── Footer buttons ────────────────────────────────────────────────────────────
$("openOptions").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

$("openDashboard").addEventListener("click", () => {
  chrome.tabs.create({ url: dashboardUrl + "/dashboard" });
});

$("openLeaks").addEventListener("click", () => {
  chrome.tabs.create({ url: dashboardUrl + "/leaks" });
});

$("openCanary").addEventListener("click", () => {
  chrome.tabs.create({ url: dashboardUrl + "/canary" });
});

// ── Boot ──────────────────────────────────────────────────────────────────────
init();
