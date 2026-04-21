# ProxhqVPN Desktop — Build Instructions

Everything is automated. You only need to run **one command** per platform.

---

## What Happens Automatically

Before every build, the following runs automatically with zero manual steps:

| Step | What it does |
|------|-------------|
| Icon — PNG | Copies `icon-final2.png` from your web app automatically |
| Icon — Windows (.ico) | Generated automatically from that PNG |
| Icon — macOS (.icns) | Generated automatically from that PNG |
| Server URL | Read from `PROXHQ_SERVER_URL` environment variable and baked in |

---

## Building Installers

### Step 1 — Set your server URL (once)

Set this to the URL of your deployed ProxhqVPN server:

```bash
# macOS / Linux
export PROXHQ_SERVER_URL=https://your-domain.replit.app

# Windows (Command Prompt)
set PROXHQ_SERVER_URL=https://your-domain.replit.app

# Windows (PowerShell)
$env:PROXHQ_SERVER_URL="https://your-domain.replit.app"
```

### Step 2 — Install dependencies (once per machine)

```bash
cd artifacts/desktop
npm install
```

### Step 3 — Build for your platform

```bash
# Windows installer (.exe) — run on a Windows machine
npm run build:win

# macOS installer (.dmg + .pkg) — run on a macOS machine
npm run build:mac

# Linux installers (.AppImage + .deb + .rpm) — run on Linux
npm run build:linux

# All platforms at once
npm run build:all
```

That's it. Output installers appear in `artifacts/desktop/dist/`.

---

## Setup Wizard (What users experience)

When a user runs your installer:

1. **Welcome** — ProxhqVPN branding and feature list
2. **Permission** — Legal consent checkbox (OS-specific language)
   - The **Continue button stays locked** until the box is checked
   - Checking it means they have explicitly consented in writing
3. **Installing** — WireGuard installs silently with live progress
4. **Done** — One click launches ProxhqVPN

Every subsequent launch skips the wizard entirely and goes straight to the app.

---

## WireGuard Installation by Platform

| Platform | Method | Flags |
|----------|--------|-------|
| Windows  | Official `wireguard-installer.exe` from wireguard.com | `/S` (silent) |
| macOS    | Homebrew: `brew install wireguard-tools` | Background |
| Linux    | `apt` / `dnf` / `yum` / `pacman` / `zypper` — auto-detected | `-y` (non-interactive) |

---

## Output Files

| Platform | File |
|----------|------|
| Windows  | `dist/ProxhqVPN Setup 1.0.0.exe` |
| macOS    | `dist/ProxhqVPN-1.0.0.dmg` and `dist/ProxhqVPN-1.0.0.pkg` |
| Linux    | `dist/ProxhqVPN-1.0.0.AppImage`, `.deb`, `.rpm` |
