# ProxhqVPN Desktop — Build Instructions

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
