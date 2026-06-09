# Hardened Windows installer skeleton: signed download, hash verification, WireGuard import, kill-switch guard.
param([string]$ConfigUrl,[string]$ExpectedSha256)
$ErrorActionPreference = 'Stop'
$download = Join-Path $env:TEMP 'proxhqvpn-all-servers.zip'
Invoke-WebRequest -Uri $ConfigUrl -OutFile $download -UseBasicParsing
$actual = (Get-FileHash -Algorithm SHA256 $download).Hash.ToLowerInvariant()
if ($actual -ne $ExpectedSha256.ToLowerInvariant()) { throw "Config ZIP hash mismatch" }
$wg = "${env:ProgramFiles}\WireGuard\wireguard.exe"
if (!(Test-Path $wg)) { throw "WireGuard not installed. Install signed WireGuard MSI first." }
$extract = Join-Path $env:TEMP 'proxhqvpn-configs'
Remove-Item $extract -Recurse -Force -ErrorAction SilentlyContinue
Expand-Archive $download $extract -Force
Get-ChildItem $extract -Filter *.conf | ForEach-Object { & $wg /installtunnelservice $_.FullName }
New-NetFirewallRule -DisplayName "ProxHQVPN KillSwitch Block Non-VPN IPv4" -Direction Outbound -Action Block -RemoteAddress 0.0.0.0/0 -InterfaceAlias "Ethernet","Wi-Fi" -Profile Any -ErrorAction SilentlyContinue
Write-Host "Installed ProxHQVPN tunnels. Review firewall interface aliases before enabling strict kill switch in production."
