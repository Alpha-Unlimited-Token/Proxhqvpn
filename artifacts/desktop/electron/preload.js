const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("proxhq", {
  getPlatform:        ()          => ipcRenderer.invoke("get-platform"),
  checkWireGuard:     ()          => ipcRenderer.invoke("check-wireguard"),
  installWireGuard:   ()          => ipcRenderer.invoke("install-wireguard"),
  markSetupComplete:  ()          => ipcRenderer.invoke("mark-setup-complete"),
  launchMainApp:      ()          => ipcRenderer.invoke("launch-main-app"),
  openExternal:       (url)       => ipcRenderer.invoke("open-external", url),
  minimizeWindow:     ()          => ipcRenderer.invoke("minimize-window"),
  closeWindow:        ()          => ipcRenderer.invoke("close-window"),
  installUpdateNow:   ()          => ipcRenderer.invoke("install-update-now"),
  getAppVersion:      ()          => ipcRenderer.invoke("get-app-version"),

  // Tunnel mode
  setTunnelMode:      (mode)      => ipcRenderer.invoke("set-tunnel-mode", mode),
  getTunnelMode:      ()          => ipcRenderer.invoke("get-tunnel-mode"),

  // VPN config generation (called from main window after sign-in)
  generateVpnConfig:  ()          => ipcRenderer.invoke("generate-vpn-config"),

  // Per-app network monitor
  getAllowedRules:     ()          => ipcRenderer.invoke("get-app-rules"),
  allowApp:           (appPath)   => ipcRenderer.invoke("allow-app", appPath),
  blockApp:           (appPath)   => ipcRenderer.invoke("block-app", appPath),

  // ── Event listeners (return cleanup fn) ──────────────────────────────────
  onInstallProgress:  (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("install-progress", handler);
    return () => ipcRenderer.removeListener("install-progress", handler);
  },

  onVpnConfigProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("vpn-config-progress", handler);
    return () => ipcRenderer.removeListener("vpn-config-progress", handler);
  },

  // Fired when the per-app monitor detects a new process making network connections
  onAppAlert: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on("app-alert", handler);
    return () => ipcRenderer.removeListener("app-alert", handler);
  },
});
