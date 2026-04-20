# ══════════════════════════════════════════════════════════════════════════════
#  GhostNet VPN — Windows Installer (PowerShell)
#  Installs daemon and dashboard as Windows Services.
#  Run as Administrator in PowerShell:
#    Set-ExecutionPolicy Bypass -Scope Process -Force
#    .\install-windows.ps1 [-Psk "your-strong-passphrase"] [-Port 51820]
# ══════════════════════════════════════════════════════════════════════════════

param(
    [string]$Psk  = "ghostnet-change-me",
    [int]   $Port = 51820
)

$ErrorActionPreference = "Stop"
$InstallDir = "C:\GhostNet"
$DataDir    = "C:\ProgramData\GhostNet"
$LogDir     = "C:\ProgramData\GhostNet\logs"
$CtrlPort   = 7475
$NodePort   = 7474

function Write-Step { param($msg) Write-Host "`n▶ $msg" -ForegroundColor Yellow }
function Write-Ok   { param($msg) Write-Host "  [✓] $msg" -ForegroundColor Green  }
function Write-Warn { param($msg) Write-Host "  [!] $msg" -ForegroundColor Yellow }
function Write-Err  { param($msg) Write-Host "  [✗] $msg" -ForegroundColor Red; exit 1 }

# Require Administrator
$currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Err "Run this script as Administrator (right-click PowerShell → Run as Administrator)"
}

Write-Step "Checking Python 3.9+"
try {
    $pyver = & python --version 2>&1
    if ($pyver -notmatch "3\.(9|10|11|12|13)") {
        Write-Warn "Python 3.9+ not found. Opening download page..."
        Start-Process "https://www.python.org/downloads/"
        Write-Err "Install Python 3.9+ then re-run this script."
    }
    Write-Ok "Python: $pyver"
} catch {
    Write-Err "Python not found. Download from https://www.python.org/downloads/"
}

Write-Step "Checking WinTun driver"
$wintunPaths = @(
    "C:\Windows\System32\wintun.dll",
    "C:\Program Files\WireGuard\wintun.dll",
    "$PSScriptRoot\..\wintun.dll"
)
$wintunFound = $false
foreach ($p in $wintunPaths) {
    if (Test-Path $p) {
        Write-Ok "WinTun found: $p"
        $wintunFound = $true
        break
    }
}
if (-not $wintunFound) {
    Write-Warn "WinTun not found. Downloading..."
    $wintunUrl = "https://www.wintun.net/builds/wintun-0.14.1.zip"
    $wintunZip = "$env:TEMP\wintun.zip"
    try {
        Invoke-WebRequest -Uri $wintunUrl -OutFile $wintunZip -UseBasicParsing
        Expand-Archive -Path $wintunZip -DestinationPath "$env:TEMP\wintun" -Force
        $arch = if ([Environment]::Is64BitOperatingSystem) { "amd64" } else { "x86" }
        Copy-Item "$env:TEMP\wintun\wintun\bin\$arch\wintun.dll" "C:\Windows\System32\wintun.dll"
        Write-Ok "WinTun installed to C:\Windows\System32\wintun.dll"
    } catch {
        Write-Warn "Auto-download failed. Download wintun.dll manually from https://www.wintun.net/"
        Write-Warn "Place it in C:\Windows\System32\ or alongside ghostd.py"
    }
}

Write-Step "Installing GhostNet files"
New-Item -ItemType Directory -Force -Path $InstallDir, $DataDir, $LogDir | Out-Null
$ScriptDir = Split-Path (Split-Path $MyInvocation.MyCommand.Path -Parent) -Parent

Copy-Item "$ScriptDir\ghostd.py"                 "$InstallDir\" -Force
Copy-Item "$ScriptDir\scripts\requirements.txt"  "$InstallDir\" -Force
if (Test-Path "$ScriptDir\server.bundle.cjs") {
    Copy-Item "$ScriptDir\server.bundle.cjs" "$InstallDir\" -Force
}
if (Test-Path "$ScriptDir\frontend") {
    Copy-Item "$ScriptDir\frontend" "$InstallDir\" -Recurse -Force
}
Write-Ok "Files copied to $InstallDir"

Write-Step "Installing Python dependencies"
& python -m pip install -r "$InstallDir\requirements.txt" --quiet
Write-Ok "cryptography installed"

Write-Step "Writing config"
$confContent = @"
PSK=$Psk
VPN_PORT=$Port
CTRL_PORT=$CtrlPort
NODE_PORT=$NodePort
DATA_DIR=$DataDir
"@
Set-Content "$DataDir\ghostnet.conf" $confContent
icacls "$DataDir\ghostnet.conf" /inheritance:r /grant:r "SYSTEM:F" /grant:r "Administrators:F" | Out-Null
Write-Ok "Config written to $DataDir\ghostnet.conf"

Write-Step "Creating Windows Service — GhostNet-Daemon"
# Use NSSM if available, otherwise sc.exe with wrapper
$nssmPath = "$InstallDir\nssm.exe"
if (-not (Test-Path $nssmPath)) {
    # Download NSSM (the Non-Sucking Service Manager)
    try {
        $nssmUrl = "https://nssm.cc/release/nssm-2.24.zip"
        $nssmZip = "$env:TEMP\nssm.zip"
        Invoke-WebRequest -Uri $nssmUrl -OutFile $nssmZip -UseBasicParsing
        Expand-Archive -Path $nssmZip -DestinationPath "$env:TEMP\nssm" -Force
        $arch = if ([Environment]::Is64BitOperatingSystem) { "win64" } else { "win32" }
        Copy-Item "$env:TEMP\nssm\nssm-2.24\$arch\nssm.exe" $nssmPath
        Write-Ok "NSSM downloaded"
    } catch {
        Write-Warn "Could not download NSSM. Creating batch-based service wrapper instead."
    }
}

if (Test-Path $nssmPath) {
    # Remove existing service if present
    & $nssmPath stop  GhostNet-Daemon 2>$null
    & $nssmPath remove GhostNet-Daemon confirm 2>$null

    & $nssmPath install GhostNet-Daemon python "$InstallDir\ghostd.py" `
        "--mode server --port $Port --psk `"$Psk`" --ctrl-port $CtrlPort"
    & $nssmPath set GhostNet-Daemon AppDirectory $InstallDir
    & $nssmPath set GhostNet-Daemon AppStdout "$LogDir\daemon.log"
    & $nssmPath set GhostNet-Daemon AppStderr "$LogDir\daemon.err"
    & $nssmPath set GhostNet-Daemon Start SERVICE_AUTO_START
    Write-Ok "Windows Service: GhostNet-Daemon (via NSSM)"
} else {
    # Fallback: create a simple wrapper batch and register with sc
    $wrapperPath = "$InstallDir\daemon-wrapper.bat"
    Set-Content $wrapperPath "@echo off`npython `"$InstallDir\ghostd.py`" --mode server --port $Port --psk `"$Psk`" --ctrl-port $CtrlPort"
    & sc.exe create GhostNet-Daemon binPath= "cmd /c $wrapperPath" start= auto | Out-Null
    Write-Ok "Windows Service: GhostNet-Daemon (sc.exe)"
}

Write-Step "Creating Windows Service — GhostNet-Dashboard"
if (Test-Path $nssmPath) {
    & $nssmPath stop  GhostNet-Dashboard 2>$null
    & $nssmPath remove GhostNet-Dashboard confirm 2>$null
    & $nssmPath install GhostNet-Dashboard node "$InstallDir\server.bundle.cjs"
    & $nssmPath set GhostNet-Dashboard AppDirectory $InstallDir
    & $nssmPath set GhostNet-Dashboard AppEnvironmentExtra "PORT=$NodePort" "GHOSTNET_DATA=$DataDir"
    & $nssmPath set GhostNet-Dashboard AppStdout "$LogDir\dashboard.log"
    & $nssmPath set GhostNet-Dashboard AppStderr "$LogDir\dashboard.err"
    & $nssmPath set GhostNet-Dashboard Start SERVICE_AUTO_START
    Write-Ok "Windows Service: GhostNet-Dashboard (via NSSM)"
}

Write-Step "Configuring Windows Firewall"
Remove-NetFirewallRule -DisplayName "GhostNet VPN" -ErrorAction SilentlyContinue
New-NetFirewallRule -DisplayName "GhostNet VPN"       -Direction Inbound  -Protocol UDP -LocalPort $Port    -Action Allow | Out-Null
New-NetFirewallRule -DisplayName "GhostNet Dashboard" -Direction Inbound  -Protocol TCP -LocalPort $NodePort -Action Allow | Out-Null
New-NetFirewallRule -DisplayName "GhostNet VPN Out"   -Direction Outbound -Protocol UDP -LocalPort $Port    -Action Allow | Out-Null
Write-Ok "Firewall rules created (UDP $Port, TCP $NodePort)"

Write-Step "Starting services"
Start-Service GhostNet-Daemon    -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Service GhostNet-Dashboard -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  GhostNet VPN installed successfully!" -ForegroundColor Green
Write-Host "══════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard :  http://localhost:$NodePort"
Write-Host "  VPN port  :  UDP $Port"
Write-Host "  PSK       :  $Psk"
Write-Host ""
Write-Host "  Service commands:"
Write-Host "    Get-Service GhostNet-Daemon, GhostNet-Dashboard"
Write-Host "    Start-Service / Stop-Service GhostNet-Daemon"
Write-Host "    Get-Content $LogDir\daemon.log -Tail 50 -Wait"
Write-Host ""
Write-Host "  Control API (PowerShell):"
Write-Host "    Invoke-RestMethod http://127.0.0.1:$CtrlPort/status"
Write-Host "    Invoke-RestMethod -Method Post http://127.0.0.1:$CtrlPort/killswitch/on"
Write-Host ""
Write-Host "  Connect a client:"
Write-Host "    python ghostd.py --mode client --server YOUR_IP:$Port --psk `"$Psk`""
Write-Host ""
