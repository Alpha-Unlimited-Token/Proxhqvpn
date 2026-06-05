# ProxhqVPN Desktop — Build Instructions (v2.0.0)

Everything is automated. **No configuration needed.** Just install and build.

---

## How Server Failover Works

Both your domains are permanently hardcoded into the app:

| Priority | Domain | Role |
|----------|--------|------|
| 1st | `proxhq.app` | Primary — tried first on every launch |
| 2nd | `proxhqvpn.com` | Backup — automatically used if primary is unreachable |

When a user launches ProxhqVPN:
- The app silently checks `proxhq.app` (4 second timeout)
- If it responds → connects there, user never knows anything happened
- If it doesn't respond → silently switches to `proxhqvpn.com` automatically
- If both are down → shows a friendly "server unreachable" screen and lets them retry
- If a page fails mid-session → instantly retries on the backup domain

**Users never see any of this. It's completely invisible.**

---

## Building Installers

### Step 1 — Install dependencies (once per build machine)

```bash
cd artifacts/desktop
npm install
```

### Step 2 — Build

```bash
# Windows installer (.exe) — run on a Windows machine
npm run build:win

# macOS installer (.dmg + .pkg) — run on a macOS machine
npm run build:mac

# Linux installers (.AppImage + .deb + .rpm) — run on Linux
npm run build:linux
```

That's it. Output installers appear in `artifacts/desktop/dist/`.

---

## What Runs Automatically Before Every Build

| Step | What it does |
|------|-------------|
| Icon — PNG | Copies from the web app automatically |
| Icon — Windows (.ico) | Generated from PNG automatically |
| Icon — macOS (.icns) | Generated from PNG automatically |
| Server URLs | Already hardcoded — no action needed |

---

## Auto-Update System

Every installed copy of ProxhqVPN **automatically keeps itself up to date**. No action required from users.

### How it works

| Event | What happens |
|-------|-------------|
| App launches | Waits 10 seconds, then silently checks `proxhq.app/api/updates/<platform>/latest.yml` |
| Every 4 hours | Automatically rechecks in the background |
| Update found | Downloads the installer silently in the background |
| Download complete | Floating green banner appears inside the app: **"Restart & Update"** |
| User clicks "Restart & Update" | App quits, installer runs, new version launches |
| App quit with update ready | New version installs automatically on next launch |

### Publishing a new update (admin only)

Two options — both require admin login:

**Option A — Upload the installer file directly:**
```
POST /api/updates/publish/upload
  form: platform=win, version=2.1.0, installer=<.exe file>
```
The server stores the file and auto-computes its SHA-512 hash.

**Option B — Provide a download URL (GitHub Releases, etc.):**
```
POST /api/updates/publish/url
  body: { platform: "win", version: "2.1.0", url: "https://...", sha512: "...", size: 12345678 }
```

After publishing, every installed client will pick up the update within 4 hours automatically.

### Tray menu
The system tray icon shows live update status:
- **Check for Updates** — idle state, click to check now
- **Checking for updates…** — check in progress
- **Downloading v2.1.0…** — download in progress
- **✓ Restart to Install v2.1.0** — downloaded, click to install immediately

---

## Setup Wizard (What users experience)

1. **Welcome** — ProxhqVPN branding and feature list
2. **Permission** — Consent checkbox locked until checked (legal protection)
3. **Installing** — WireGuard installs silently with live progress
4. **Done** — One click launches ProxhqVPN

Every subsequent launch skips the wizard entirely.

---

## WireGuard Installation by Platform

| Platform | Method | Silent? |
|----------|--------|---------|
| Windows | Official installer from wireguard.com (`/S` flag) | Yes |
| macOS | Homebrew: `brew install wireguard-tools` | Yes |
| Linux | `apt` / `dnf` / `yum` / `pacman` / `zypper` — auto-detected | Yes |
