# ProxhqVPN Desktop — Build Instructions

## Before Building

### 1. Set your server URL
Edit `electron/config.js` and replace the URL with your deployed ProxhqVPN server:
```js
const PROXHQ_SERVER_URL = "https://your-actual-domain.replit.app";
```

### 2. Add your app icons
Place the following files in the `assets/` folder:
- `assets/icon.ico` — Windows icon (256×256 recommended, .ico format)
- `assets/icon.icns` — macOS icon (.icns format)
- `assets/icon.png` — Linux icon (512×512 PNG)

You can convert a single PNG to all formats using:
- https://www.icoconverter.com (PNG → ICO)
- https://cloudconvert.com (PNG → ICNS)

### 3. Install dependencies
On your build machine, run:
```bash
cd artifacts/desktop
npm install
```

---

## Building Installers

### Windows (.exe installer)
Must be built on a **Windows machine**:
```bash
npm run build:win
```
Output: `dist/ProxhqVPN Setup 1.0.0.exe`

### macOS (.dmg + .pkg)
Must be built on a **macOS machine**:
```bash
npm run build:mac
```
Output: `dist/ProxhqVPN-1.0.0.dmg` and `dist/ProxhqVPN-1.0.0.pkg`

### Linux (.AppImage, .deb, .rpm)
Build on a **Linux machine**:
```bash
npm run build:linux
```
Output: `dist/ProxhqVPN-1.0.0.AppImage`, `.deb`, `.rpm`

### All platforms at once (from Linux, cross-compile)
```bash
npm run build:all
```
> Note: Cross-compiling Windows installers from Linux requires Wine.

---

## Setup Wizard Flow

When a user runs the installer for the first time:

1. **Welcome screen** — introduces ProxhqVPN features
2. **Permission consent screen** — OS-specific text explaining WireGuard install
   - User must check the box (legal consent) before continuing
   - Continue button is locked until checked
3. **Installation screen** — WireGuard installs silently with live progress log
4. **Complete screen** — User clicks "Open ProxhqVPN" to launch the main app

On every subsequent launch, the app skips the wizard and opens directly.

---

## Platform-Specific WireGuard Installation

| OS      | Method                                      | Silent? |
|---------|---------------------------------------------|---------|
| Windows | Official installer from wireguard.com (/S)  | ✅ Yes  |
| macOS   | Homebrew (brew install wireguard-tools)     | ✅ Yes  |
| Linux   | apt / dnf / yum / pacman / zypper           | ✅ Yes  |

---

## Consent Language (Legal Protection)

The consent checkbox shown to users states:

> "I understand and consent to ProxhqVPN installing WireGuard on my device.
> WireGuard is required for the VPN to function. It will be installed silently
> in the background and can be removed at any time through your system's
> software manager."

OS-specific detail (which package manager, install path, removal instructions)
is shown above the checkbox so users are fully informed before consenting.
The setup cannot proceed past this screen without checking the box.

---

## Code Signing (Recommended for Distribution)

For production distribution, sign your builds:
- **Windows**: Use a code signing certificate (EV or OV)
- **macOS**: Use an Apple Developer certificate + notarization

Unsigned builds will show security warnings on Windows (SmartScreen) and
macOS (Gatekeeper). This is normal for unsigned software. Users can bypass
these warnings, but signing provides a better experience.
