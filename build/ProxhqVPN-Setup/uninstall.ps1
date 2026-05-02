# Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
# ProxhqVPN Uninstaller

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$APP_NAME      = "ProxhqVPN"
$INSTALL_KEY   = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\ProxhqVPN"
$START_MENU    = "$Env:ProgramData\Microsoft\Windows\Start Menu\Programs\Alpha Unlimited Technologies"
$DESKTOP_LNK   = Join-Path ([System.Environment]::GetFolderPath("Desktop")) "ProxhqVPN.lnk"

# Read install location from registry
$installDir = ""
try {
    $installDir = (Get-ItemProperty -Path $INSTALL_KEY -ErrorAction Stop).InstallLocation
} catch {
    $installDir = "$Env:ProgramFiles\Alpha Unlimited Technologies\ProxhqVPN"
}

$r = [System.Windows.Forms.MessageBox]::Show(
    "Are you sure you want to uninstall ProxhqVPN?`n`nThis will remove all ProxhqVPN files from:`n$installDir`n`nNote: WireGuard will not be removed.",
    "Uninstall ProxhqVPN",
    [System.Windows.Forms.MessageBoxButtons]::YesNo,
    [System.Windows.Forms.MessageBoxIcon]::Question)

if ($r -ne "Yes") { exit }

$errors = @()

try { Remove-Item -Recurse -Force $installDir -ErrorAction Stop } catch { $errors += "Install folder: $_" }
try { Remove-Item -Recurse -Force $START_MENU -ErrorAction SilentlyContinue } catch {}
try { Remove-Item -Force $DESKTOP_LNK -ErrorAction SilentlyContinue } catch {}
try { Remove-Item -Path $INSTALL_KEY -Recurse -Force -ErrorAction SilentlyContinue } catch {}

if ($errors.Count -eq 0) {
    [System.Windows.Forms.MessageBox]::Show(
        "ProxhqVPN has been successfully uninstalled.",
        "Uninstall Complete",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information)
} else {
    [System.Windows.Forms.MessageBox]::Show(
        "Uninstall completed with some errors:`n" + ($errors -join "`n"),
        "Uninstall — Partial",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning)
}
