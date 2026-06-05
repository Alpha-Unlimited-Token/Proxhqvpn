# ProxhqVPN Installer Spec v5.1
© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC

This document is the canonical reference for all platform installers.
All platforms MUST follow these rules exactly for a consistent user experience.

---

## 1. Step Names & Order (all desktop platforms)

| Step | Label                        | Description                                           |
|------|------------------------------|-------------------------------------------------------|
| 1    | Welcome                      | Feature list, server list, confirm to proceed          |
| 2    | License Agreement            | Accept EULA + choose tunnel mode (split / full)        |
| 3    | Installing WireGuard         | Auto-install WireGuard silently                        |
| 4    | Sign In — Automatic Download | Open browser, watch Downloads for `proxhqvpn-all-servers.zip` |
| 5    | Installing All Tunnels       | Verify zip checksum, extract + activate each .conf     |
| 6    | Done                         | Summary, open dashboard, export support log            |

---

## 2. Shared Config Keys (`config.json`)

Every desktop installer writes `config.json` to the install dir.

```json
{
  "tunnelMode":       "split" | "full",
  "hostname":         "<device hostname>",
  "version":          "5.1",
  "wgConfDir":        "<path to .conf files>",
  "installedTunnels": ["<tunnel-name>", ...],
  "activeOnExit":     "<tunnel-name>",
  "installedAt":      "<ISO-8601 timestamp>",
  "platform":         "windows" | "macos" | "linux"
}
```

---

## 3. Install Directories

| Platform | Install Directory                                     |
|----------|-------------------------------------------------------|
| Windows  | `%LOCALAPPDATA%\ProxhqVPN\`                           |
| macOS    | `~/Library/Application Support/ProxhqVPN/`           |
| Linux    | `~/.config/proxhqvpn/`                                |

Each directory contains:
- `config.json` — install metadata
- `install.log` — timestamped install log
- `uninstall.sh` / `Uninstall.ps1` — platform uninstaller

---

## 4. Tunnel Mode Behavior

### Split Tunnel (default, recommended)
- `AllowedIPs = 10.8.0.0/24` — only VPN subnet traffic tunnelled
- Full line replacement: match `^AllowedIPs\s*=.*0\.0\.0\.0/0.*` → `AllowedIPs = 10.8.0.0/24`
- Remove any `, ::/0` or `0::/0` IPv6 entries from the same line

### Full Tunnel
- Keep `AllowedIPs = 0.0.0.0/0, ::/0` exactly as-is
- No modifications to the .conf file

---

## 5. ZIP Filename & Checksum Validation

- Download filename: `proxhqvpn-all-servers.zip`
- Checksum file URL: `https://proxhqvpn.com/downloads/proxhqvpn-all-servers.zip.sha256`
- Checksum format: `<sha256hex>  proxhqvpn-all-servers.zip` (shasum -a 256 style)
- If checksum fetch fails (no internet / endpoint not yet live): WARN and continue
- If checksum fetched but DOES NOT match: ERROR and exit — do not install tampered configs

---

## 6. Logging

Every installer writes `$INSTALL/install.log` with this format:
```
[2026-06-05T14:23:01]  [INFO]  ProxhqVPN v5.1 installer started
[2026-06-05T14:23:04]  [INFO]  Tunnel mode: split
[2026-06-05T14:23:09]  [INFO]  WireGuard already installed
[2026-06-05T14:24:12]  [INFO]  Detected: proxhqvpn-all-servers.zip (size=48291 bytes)
[2026-06-05T14:24:13]  [INFO]  Checksum OK
[2026-06-05T14:24:13]  [INFO]  Installing proxhqvpn-los-angeles ...
[2026-06-05T14:24:14]  [INFO]  proxhqvpn-los-angeles ✓ active
[2026-06-05T14:24:15]  [INFO]  All done — 4 tunnels installed
```

Support bundle export: zip `install.log` + `config.json` + platform info into
`~/Desktop/ProxhqVPN-Support-<date>.zip`

---

## 7. Servers (canonical list)

| Tunnel Name                  | Region         | IP              | Flag |
|------------------------------|----------------|-----------------|------|
| proxhqvpn-los-angeles        | Los Angeles    | 108.61.219.202  | 🇺🇸  |
| proxhqvpn-chicago            | Chicago        | 45.63.79.138    | 🇺🇸  |
| proxhqvpn-london             | London         | 192.248.160.69  | 🇬🇧  |
| proxhqvpn-tokyo              | Tokyo          | 45.76.97.51     | 🇯🇵  |

---

## 8. Uninstaller Requirements (all platforms)

Must do all of:
1. Bring down all active `proxhqvpn-*` tunnels
2. Remove tunnel configs from WireGuard conf dir
3. Remove Desktop shortcuts
4. Remove install directory (`config.json`, `install.log`)
5. On Linux: disable systemd `wg-quick@<tunnel>` services
6. Print instructions for removing WireGuard itself (do NOT auto-remove it — user may use it for other VPNs)

---

## 9. Mobile — Manual Setup Wizard

Android and iOS are NOT scripted installers. They are step-by-step HTML guides.
Label them clearly: **"Manual Setup Guide"** (NOT "installer" or "automatic").

Required steps:
1. Welcome + requirements (WireGuard app, ProxhqVPN account)
2. Install WireGuard (Play Store / App Store links + APK/sideload fallback)
3. Sign in + download configs from ProxhqVPN dashboard
4. Import configs into WireGuard app (file import + QR code methods)
5. Connect + verify (kill switch, split vs full tunnel note)

Each step must include an "I'm stuck — get help" expandable section.
