const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("proxhq", {
  getPlatform:        ()        => ipcRenderer.invoke("get-platform"),
  checkWireGuard:     ()        => ipcRenderer.invoke("check-wireguard"),
  installWireGuard:   ()        => ipcRenderer.invoke("install-wireguard"),
  markSetupComplete:  ()        => ipcRenderer.invoke("mark-setup-complete"),
  launchMainApp:      ()        => ipcRenderer.invoke("launch-main-app"),
  openExternal:       (url)     => ipcRenderer.invoke("open-external", url),
  minimizeWindow:     ()        => ipcRenderer.invoke("minimize-window"),
  closeWindow:        ()        => ipcRenderer.invoke("close-window"),
  installUpdateNow:   ()        => ipcRenderer.invoke("install-update-now"),
  getAppVersion:      ()        => ipcRenderer.invoke("get-app-version"),
  onInstallProgress:  (cb)      => {
    ipcRenderer.on("install-progress", (_, data) => cb(data));
    return () => ipcRenderer.removeAllListeners("install-progress");
  },
});
