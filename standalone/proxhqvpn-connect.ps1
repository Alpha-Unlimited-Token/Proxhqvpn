#Requires -Version 5.0
# ─────────────────────────────────────────────────────────────
#  ProxhqVPN × VPN Gate — One-Command Auto-Connect (Windows)
#  Usage:
#    .\proxhqvpn-connect.ps1                # auto-pick best server
#    .\proxhqvpn-connect.ps1 -Country JP    # best server in Japan
#    .\proxhqvpn-connect.ps1 -IP 1.2.3.4   # connect to specific IP
#    .\proxhqvpn-connect.ps1 -List          # list top 10 servers
# ─────────────────────────────────────────────────────────────
param(
  [string]$Country = "",
  [string]$IP = "",
  [switch]$List
)

$ProxhqVPNPort = if ($env:PROXHQVPN_PORT) { $env:PROXHQVPN_PORT } else { "7474" }
$Dashboard = "http://localhost:${ProxhqVPNPort}"
$TempDir = $env:TEMP
$OvpnFile = Join-Path $TempDir "proxhqvpn-vpngate-$PID.ovpn"
$CredsFile = Join-Path $TempDir "proxhqvpn-vpngate-creds-$PID.txt"

Write-Host ""
Write-Host "  ╔═══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "  ║     ProxhqVPN × VPN Gate Auto-Connect      ║" -ForegroundColor Cyan
Write-Host "  ║     University of Tsukuba Academic VPN    ║" -ForegroundColor Cyan
Write-Host "  ╚═══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

function Remove-TempFiles {
  Remove-Item $OvpnFile, $CredsFile -ErrorAction SilentlyContinue
}

function Find-OpenVPN {
  $paths = @(
    "${env:ProgramFiles}\OpenVPN\bin\openvpn.exe",
    "${env:ProgramFiles(x86)}\OpenVPN\bin\openvpn.exe",
    "C:\Program Files\OpenVPN\bin\openvpn.exe"
  )
  foreach ($p in $paths) { if (Test-Path $p) { return $p } }
  $cmd = Get-Command openvpn -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Source }
  return $null
}

function Install-OpenVPN {
  Write-Host "OpenVPN not found. Downloading installer..." -ForegroundColor Yellow
  $installer = Join-Path $TempDir "openvpn-installer.msi"
  $url = "https://swupdate.openvpn.org/community/releases/OpenVPN-2.6.8-I001-amd64.msi"
  try {
    Invoke-WebRequest $url -OutFile $installer -UseBasicParsing
    Write-Host "Installing OpenVPN (this requires administrator rights)..." -ForegroundColor Yellow
    Start-Process msiexec.exe -ArgumentList "/i `"$installer`" /passive /norestart" -Wait -Verb RunAs
    Write-Host "OpenVPN installed." -ForegroundColor Green
  } catch {
    Write-Host "Could not auto-install OpenVPN. Please download from:" -ForegroundColor Red
    Write-Host "  https://openvpn.net/community-downloads/" -ForegroundColor Cyan
    exit 1
  }
}

function Get-DashboardData($path) {
  try {
    return Invoke-RestMethod "${Dashboard}${path}" -TimeoutSec 8
  } catch { return $null }
}

if ($List) {
  Write-Host "Top 10 VPN Gate Servers:" -ForegroundColor Cyan
  $servers = Get-DashboardData "/api/vpngate/servers?limit=10"
  if ($servers -and $servers.servers) {
    Write-Host ("  {0,-17} {1,-9} {2,-8} {1,-12} {3}" -f "IP", "Country", "Ping", "Speed", "Score") -ForegroundColor White
    Write-Host "  ─────────────────────────────────────────────────"
    foreach ($s in $servers.servers) {
      Write-Host ("  {0,-17} {1,-9} {2,-8} {3,-12} {4}" -f $s.ip, $s.countryCode, "$($s.ping)ms", "$($s.speedMbps)Mbps", $s.score)
    }
  } else {
    Write-Host "  Dashboard not reachable. Start ProxhqVPN first." -ForegroundColor Red
  }
  exit 0
}

$ovpnExe = Find-OpenVPN
if (-not $ovpnExe) { Install-OpenVPN; $ovpnExe = Find-OpenVPN }
if (-not $ovpnExe) { Write-Host "OpenVPN not found after install." -ForegroundColor Red; exit 1 }

Write-Host "Finding best VPN Gate server..." -ForegroundColor Green

$serverIp = $null
$countryName = $null
$pingMs = $null
$speedMbps = $null

$bestEndpoint = "/api/vpngate/servers/best"
if ($Country) { $bestEndpoint += "?country=$Country" }
if ($IP) { $bestEndpoint = "/api/vpngate/servers?limit=500" }

$best = Get-DashboardData $bestEndpoint

if ($best -and (-not $IP)) {
  $server = if ($best.servers) { $best.servers[0] } else { $best }
  $serverIp = $server.ip
  $countryName = $server.country
  $pingMs = $server.ping
  $speedMbps = $server.speedMbps
  Write-Host "  Source: ProxhqVPN Dashboard" -ForegroundColor Cyan
  Write-Host "  Server: $serverIp — $countryName | ${pingMs}ms | ${speedMbps}Mbps" -ForegroundColor Green
  try {
    Invoke-WebRequest "${Dashboard}/api/vpngate/servers/${serverIp}/config" -OutFile $OvpnFile -UseBasicParsing
  } catch {
    Write-Host "  Failed to download config." -ForegroundColor Red; exit 1
  }
} else {
  Write-Host "  Dashboard not reachable. Fetching directly from VPN Gate..." -ForegroundColor Yellow
  try {
    $raw = (Invoke-WebRequest "https://www.vpngate.net/api/iphone/" -UseBasicParsing -TimeoutSec 15).Content
  } catch {
    Write-Host "Cannot reach VPN Gate. Check internet connection." -ForegroundColor Red; exit 1
  }
  $lines = $raw -split "`n" | Where-Object { $_ -notmatch "^\*" -and $_.Trim() }
  $dataLines = $lines | Select-Object -Skip 1 | Where-Object { $_.Trim() }

  if ($IP) {
    $matched = $dataLines | Where-Object { ($_ -split ",")[1] -eq $IP } | Select-Object -First 1
  } elseif ($Country) {
    $matched = $dataLines | Where-Object {
      $fields = $_ -split ","
      $fields[6] -eq $Country.ToUpper()
    } | Sort-Object { [int]($_ -split ",")[2] } -Descending | Select-Object -First 1
  } else {
    $matched = $dataLines | Sort-Object { [int]($_ -split ",")[2] } -Descending | Select-Object -First 1
  }

  if (-not $matched) { Write-Host "No matching server found." -ForegroundColor Red; exit 1 }

  $fields = $matched -split ","
  $serverIp = $fields[1]
  $countryName = $fields[5]
  $pingMs = $fields[3]
  $b64 = $fields[-1].Trim()

  try {
    $bytes = [System.Convert]::FromBase64String($b64)
    [System.IO.File]::WriteAllBytes($OvpnFile, $bytes)
  } catch {
    Write-Host "Failed to decode OpenVPN config." -ForegroundColor Red; exit 1
  }
  Write-Host "  Server: $serverIp — $countryName | ${pingMs}ms" -ForegroundColor Green
}

"vpn`nvpn" | Set-Content $CredsFile -Encoding ASCII

Write-Host ""
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "  Connecting... Press Ctrl+C to disconnect" -ForegroundColor Green
Write-Host "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

try {
  & $ovpnExe --config $OvpnFile --auth-user-pass $CredsFile --verb 3
} finally {
  Remove-TempFiles
  Write-Host ""
  Write-Host "Disconnected from VPN Gate." -ForegroundColor Yellow
}
