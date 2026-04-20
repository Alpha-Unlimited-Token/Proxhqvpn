# ══════════════════════════════════════════════════════════════════════════════
#  GhostNet VPN — Windows Installer (PowerShell)
#
#  ONE COMMAND INSTALL (run in PowerShell as Administrator):
#    irm https://get.ghostnet.app/win | iex
#
#  Or with options:
#    irm https://get.ghostnet.app/win | iex; Install-GhostNet -Port 8080 -Dir "D:\GhostNet"
#
#  What this does:
#    1. Downloads the Windows x64 package automatically
#    2. Extracts it to C:\GhostNet (or your chosen folder)
#    3. Optionally installs as a Windows Service (auto-starts on boot)
#    4. Opens the dashboard in your default browser
# ══════════════════════════════════════════════════════════════════════════════
param(
    [string]$Dir     = "C:\GhostNet",
    [int]   $Port    = 7474,
    [switch]$Service,
    [switch]$NoLaunch
)

$ErrorActionPreference = "Stop"
$ProgressPreference    = "SilentlyContinue"   # speeds up Invoke-WebRequest

$BASE_URL   = "https://releases.ghostnet.app"
$ZIP_NAME   = "GhostNet-Windows-x64.zip"
$BINARY     = "GhostNet.exe"

# ── Colours / helpers ─────────────────────────────────────────────────────────
function Write-Banner {
    Write-Host ""
    Write-Host "  +----------------------------------------------+" -ForegroundColor Green
    Write-Host "  |       GHOSTNET VPN - INSTALLER v3.0         |" -ForegroundColor Green
    Write-Host "  +----------------------------------------------+" -ForegroundColor Green
    Write-Host ""
}
function Write-Step { param($msg) Write-Host "`n  >> $msg" -ForegroundColor Yellow }
function Write-Ok   { param($msg) Write-Host "     [OK] $msg" -ForegroundColor Green }
function Write-Info { param($msg) Write-Host "      ->  $msg" -ForegroundColor Cyan }
function Write-Warn { param($msg) Write-Host "      !   $msg" -ForegroundColor Yellow }
function Write-Fail { param($msg) Write-Host "`n     [X]  ERROR: $msg`n" -ForegroundColor Red; exit 1 }

# ── Require Administrator ─────────────────────────────────────────────────────
function Assert-Admin {
    $p = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        Write-Host ""
        Write-Host "  GhostNet needs Administrator rights to install." -ForegroundColor Yellow
        Write-Host "  Restarting as Administrator..." -ForegroundColor Yellow
        Write-Host ""
        $args_str = "-ExecutionPolicy Bypass -File `"$PSCommandPath`""
        if ($Service)   { $args_str += " -Service" }
        if ($NoLaunch)  { $args_str += " -NoLaunch" }
        $args_str += " -Port $Port -Dir `"$Dir`""
        Start-Process powershell -ArgumentList $args_str -Verb RunAs
        exit
    }
}

Write-Banner
Assert-Admin

# ── Check port availability ───────────────────────────────────────────────────
Write-Step "Checking port $Port"
$portInUse = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($portInUse) {
    $Port = $Port + 1
    $portInUse2 = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    if ($portInUse2) {
        Write-Fail "Ports $($Port-1) and $Port are both in use.`n  Stop the conflicting process or run with -Port 8080"
    }
    Write-Warn "Port $($Port-1) in use — switching to port $Port"
}
Write-Ok "Port $Port is available"

# ── Download ──────────────────────────────────────────────────────────────────
Write-Step "Downloading GhostNet"

$tmp    = [System.IO.Path]::GetTempPath()
$tmpZip = Join-Path $tmp $ZIP_NAME
$dlUrl  = "$BASE_URL/$ZIP_NAME"

Write-Info "URL: $dlUrl"

try {
    Invoke-WebRequest -Uri $dlUrl -OutFile $tmpZip -UseBasicParsing
    Write-Ok "Downloaded $ZIP_NAME"
} catch {
    # Fallback: look for local build next to this script
    $localZip = Join-Path $PSScriptRoot "dist\$ZIP_NAME"
    if (Test-Path $localZip) {
        Write-Warn "Remote not reachable — using local build"
        Copy-Item $localZip $tmpZip
        Write-Ok "Using local build"
    } else {
        Write-Fail "Could not download GhostNet.`n  Check your internet connection.`n  Or download from: https://ghostnet.app/download"
    }
}

# ── Extract ───────────────────────────────────────────────────────────────────
Write-Step "Installing to $Dir"

if (Test-Path $Dir) {
    $bak = "$Dir.bak"
    Write-Warn "Folder exists — backing up to $bak"
    if (Test-Path $bak) { Remove-Item $bak -Recurse -Force }
    Rename-Item $Dir $bak
}

New-Item -ItemType Directory -Path $Dir -Force | Out-Null
$tmpExtract = Join-Path $tmp "ghostnet-extract"
if (Test-Path $tmpExtract) { Remove-Item $tmpExtract -Recurse -Force }
Expand-Archive -Path $tmpZip -DestinationPath $tmpExtract -Force

# Handle nested folder inside zip
$inner = Get-ChildItem $tmpExtract -Directory | Select-Object -First 1
$src   = if ($inner) { $inner.FullName } else { $tmpExtract }
Get-ChildItem $src | ForEach-Object { Copy-Item $_.FullName $Dir -Recurse -Force }
Remove-Item $tmpExtract -Recurse -Force
Remove-Item $tmpZip    -Force

Write-Ok "Installed to $Dir"

# ── Add to PATH (current session + permanent for user) ────────────────────────
Write-Step "Adding GhostNet to PATH"
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
if ($currentPath -notlike "*$Dir*") {
    [Environment]::SetEnvironmentVariable("PATH", "$currentPath;$Dir", "User")
    $env:PATH += ";$Dir"
    Write-Ok "Added to PATH — you can now type 'GhostNet' from anywhere"
} else {
    Write-Ok "Already in PATH"
}

# ── Windows Defender exclusion (prevents false positive slowdown) ─────────────
Write-Step "Adding Windows Defender exclusion"
try {
    Add-MpPreference -ExclusionPath $Dir -ErrorAction SilentlyContinue
    Write-Ok "Defender exclusion added for $Dir"
} catch {
    Write-Warn "Could not add Defender exclusion (non-fatal)"
}

# ── Optional: Install as Windows Service ─────────────────────────────────────
if ($Service) {
    Write-Step "Installing Windows Service"

    $svcName = "GhostNet"
    $svcBin  = Join-Path $Dir $BINARY
    $svcDesc = "GhostNet VPN Orchestration Platform"

    # Remove old service if it exists
    $existing = Get-Service -Name $svcName -ErrorAction SilentlyContinue
    if ($existing) {
        Stop-Service  -Name $svcName -Force -ErrorAction SilentlyContinue
        sc.exe delete $svcName | Out-Null
        Start-Sleep -Seconds 1
    }

    # Create new service using sc.exe (works on all Windows versions)
    sc.exe create $svcName binPath= "`"$svcBin`"" start= auto DisplayName= "$svcDesc" | Out-Null
    sc.exe description $svcName "$svcDesc - VPN management dashboard" | Out-Null
    sc.exe start $svcName | Out-Null

    Write-Ok "Windows Service '$svcName' installed and started"
    Write-Info "Manage in Services app (services.msc) or with:"
    Write-Info "  Start-Service GhostNet"
    Write-Info "  Stop-Service  GhostNet"
    Write-Info "  Get-Service   GhostNet"
}

# ── Create Start Menu shortcut ────────────────────────────────────────────────
Write-Step "Creating Start Menu shortcut"
try {
    $startMenu = [Environment]::GetFolderPath("StartMenu")
    $lnkPath   = Join-Path $startMenu "Programs\GhostNet.lnk"
    $shell      = New-Object -ComObject WScript.Shell
    $shortcut   = $shell.CreateShortcut($lnkPath)
    $shortcut.TargetPath       = Join-Path $Dir $BINARY
    $shortcut.WorkingDirectory = $Dir
    $shortcut.Description      = "GhostNet VPN Dashboard"
    $shortcut.Save()
    Write-Ok "Shortcut added to Start Menu"
} catch {
    Write-Warn "Could not create Start Menu shortcut (non-fatal)"
}

# ── Create Desktop shortcut ───────────────────────────────────────────────────
try {
    $desktop  = [Environment]::GetFolderPath("Desktop")
    $lnkPath2 = Join-Path $desktop "GhostNet.lnk"
    $shell2   = New-Object -ComObject WScript.Shell
    $sc2      = $shell2.CreateShortcut($lnkPath2)
    $sc2.TargetPath       = Join-Path $Dir $BINARY
    $sc2.WorkingDirectory = $Dir
    $sc2.Description      = "GhostNet VPN Dashboard"
    $sc2.Save()
    Write-Ok "Desktop shortcut created"
} catch {
    Write-Warn "Could not create desktop shortcut (non-fatal)"
}

# ── Firewall rule (allow localhost only) ──────────────────────────────────────
Write-Step "Configuring Windows Firewall"
try {
    Remove-NetFirewallRule -DisplayName "GhostNet VPN" -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName "GhostNet VPN" `
        -Direction Inbound -Protocol TCP -LocalPort $Port `
        -Action Allow -Profile Private -ErrorAction SilentlyContinue | Out-Null
    Write-Ok "Firewall rule added (port $Port, private network only)"
} catch {
    Write-Warn "Could not add firewall rule (non-fatal)"
}

# ── Done ──────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "  +----------------------------------------------+" -ForegroundColor Green
Write-Host "  |  GhostNet installed successfully!           |" -ForegroundColor Green
Write-Host "  |                                              |" -ForegroundColor Green
Write-Host "  |  Location:  $Dir" -ForegroundColor Green
Write-Host "  |  Dashboard: http://localhost:$Port           |" -ForegroundColor Green
Write-Host "  +----------------------------------------------+" -ForegroundColor Green
Write-Host ""

if (-not $Service) {
    Write-Info "Starting GhostNet now..."
    Write-Info "To run GhostNet in future: double-click the desktop shortcut"
    Write-Info "Or open Start Menu and search for 'GhostNet'"
    Write-Host ""

    if (-not $NoLaunch) {
        # Open browser after 3s
        Start-Job -ScriptBlock {
            Start-Sleep 3
            Start-Process "http://localhost:$using:Port"
        } | Out-Null

        # Launch GhostNet
        $env:PORT = "$Port"
        Set-Location $Dir
        & (Join-Path $Dir $BINARY)
    }
} else {
    Write-Info "GhostNet is running as a Windows Service."
    Write-Info "It will start automatically on every boot."
    Write-Host ""
    if (-not $NoLaunch) {
        Start-Process "http://localhost:$Port"
    }
}
