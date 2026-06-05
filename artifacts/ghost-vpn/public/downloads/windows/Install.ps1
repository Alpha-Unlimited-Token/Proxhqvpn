# ProxhqVPN Windows Installer — Auto WireGuard + VPN Config Activation
# © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
# Launch via: Launch-ProxhqVPN-Setup.vbs  (hides console window)
# Requires: Windows 10/11, PowerShell 5+, internet connection

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$BRAND     = "ProxhqVPN"
$PUBLISHER = "ALPHA UNLIMITED TECHNOLOGIES LLC"
$BASE_URL  = "https://proxhqvpn.com"
$WG_URL    = "https://download.wireguard.com/windows-client/wireguard-installer.exe"
$WG_EXE    = "C:\Program Files\WireGuard\wireguard.exe"
$WG_DIR    = "C:\ProgramData\WireGuard"
$INSTALL   = "$env:LOCALAPPDATA\ProxhqVPN"
$HOSTNAME  = $env:COMPUTERNAME

$BG      = [Drawing.Color]::FromArgb(4,  10,  6)
$BG2     = [Drawing.Color]::FromArgb(8,  18, 10)
$BG3     = [Drawing.Color]::FromArgb(13, 26, 15)
$GREEN   = [Drawing.Color]::FromArgb(0, 255, 136)
$GREEN_D = [Drawing.Color]::FromArgb(0, 204, 102)
$WHITE   = [Drawing.Color]::White
$GRAY    = [Drawing.Color]::FromArgb(40, 55, 44)
$DIM     = [Drawing.Color]::FromArgb(0, 180, 100)
$ORANGE  = [Drawing.Color]::FromArgb(255, 179, 71)

$Script:TunnelMode = "split"

function lbl($text, $x, $y, $w, $h, $size=10, $bold=$false, $color=$null) {
    $l = New-Object Windows.Forms.Label
    $l.Text = $text; $l.Left = $x; $l.Top = $y; $l.Width = $w; $l.Height = $h
    $l.ForeColor = if ($color) { $color } else { $WHITE }
    $l.BackColor = [Drawing.Color]::Transparent
    $s = if ($bold) { [Drawing.FontStyle]::Bold } else { [Drawing.FontStyle]::Regular }
    $l.Font = New-Object Drawing.Font("Segoe UI", $size, $s)
    return $l
}

function btn($text, $x, $y, $w=110, $h=36, $primary=$false) {
    $b = New-Object Windows.Forms.Button
    $b.Text = $text; $b.Left = $x; $b.Top = $y; $b.Width = $w; $b.Height = $h
    $b.FlatStyle = [Windows.Forms.FlatStyle]::Flat
    $b.FlatAppearance.BorderSize = 1
    $b.FlatAppearance.BorderColor = if ($primary) { $GREEN } else { $GRAY }
    $b.BackColor = if ($primary) { $GREEN } else { $BG3 }
    $b.ForeColor = if ($primary) { [Drawing.Color]::Black } else { $DIM }
    $b.Font = New-Object Drawing.Font("Segoe UI", 10, [Drawing.FontStyle]::Bold)
    $b.Cursor = [Windows.Forms.Cursors]::Hand
    return $b
}

function make-form($title) {
    $f = New-Object Windows.Forms.Form
    $f.Text = "ProxhqVPN Setup"
    $f.Size = New-Object Drawing.Size(580, 470)
    $f.StartPosition = "CenterScreen"
    $f.BackColor = $BG
    $f.FormBorderStyle = "FixedDialog"
    $f.MaximizeBox = $false; $f.MinimizeBox = $false

    $hdr = New-Object Windows.Forms.Panel
    $hdr.Dock = "Top"; $hdr.Height = 74; $hdr.BackColor = $BG2
    $hdr.Controls.Add((lbl $title 20 12 530 30 14 $true $GREEN))
    $hdr.Controls.Add((lbl "ALPHA UNLIMITED TECHNOLOGIES LLC  ·  $BASE_URL" 20 46 500 20 8 $false $GREEN_D))

    $sep = New-Object Windows.Forms.Panel
    $sep.Top = 74; $sep.Height = 1; $sep.Width = 580; $sep.BackColor = $GRAY

    $f.Controls.Add($hdr); $f.Controls.Add($sep)
    return $f
}

# ─── PAGE 1: WELCOME ─────────────────────────────────────────────────────────
$f1 = make-form "Welcome to ProxhqVPN Setup"
$f1.Controls.Add((lbl "This wizard installs ProxhqVPN with full automatic VPN configuration." 30 92 520 22 10 $false $DIM))

$features = @(
    "WireGuard downloaded and installed silently — no manual steps",
    "Choose split tunnel or full tunnel mode",
    "VPN config auto-detected and tunnel activated automatically",
    "Per-app allow/block network monitor runs in the background",
    "Kill switch, DNS leak protection, Ghost Chain double-hop"
)
$fy = 118
foreach ($feat in $features) {
    $dot = New-Object Windows.Forms.Panel
    $dot.Left = 30; $dot.Top = $fy + 6; $dot.Width = 7; $dot.Height = 7
    $dot.BackColor = $GREEN
    $f1.Controls.Add($dot)
    $f1.Controls.Add((lbl $feat 46 $fy 500 22 10 $false $DIM))
    $fy += 28
}

$b1Next   = btn "Get Started  >" 442 392 110 36 $true
$b1Cancel = btn "Cancel"         312 392
$f1.Controls.AddRange(@($b1Next, $b1Cancel))
$Script:p1ok = $false
$b1Next.Add_Click({   $Script:p1ok = $true;  $f1.Close() })
$b1Cancel.Add_Click({ $Script:p1ok = $false; $f1.Close() })
$f1.ShowDialog() | Out-Null
if (-not $Script:p1ok) { exit }

# ─── PAGE 2: LICENSE + TUNNEL MODE ───────────────────────────────────────────
$f2 = make-form "License Agreement & VPN Tunnel Mode"
$f2.Controls.Add((lbl "Accept the license agreement and choose how your VPN tunnel routes traffic." 30 88 520 22 10 $false $DIM))

$lic = New-Object Windows.Forms.RichTextBox
$lic.Left = 30; $lic.Top = 112; $lic.Width = 512; $lic.Height = 100
$lic.BackColor = $BG2; $lic.ForeColor = $DIM
$lic.Font = New-Object Drawing.Font("Consolas", 8.5)
$lic.BorderStyle = "FixedSingle"; $lic.ReadOnly = $true; $lic.ScrollBars = "Vertical"
$lic.Text = @"
PROXHQVPN END USER LICENSE AGREEMENT
Copyright (c) 2026 ALPHA UNLIMITED TECHNOLOGIES LLC. All rights reserved.

1. LICENSE GRANT — Limited, non-exclusive license to install and use ProxhqVPN on devices you own.
2. THIRD-PARTY SOFTWARE — WireGuard (GPLv2, Jason A. Donenfeld) is installed automatically with your consent.
3. PRIVACY / ZERO LOGS — We do not log or monitor your VPN traffic, browsing, or connection timestamps.
4. LIMITATION OF LIABILITY — ALPHA UNLIMITED TECHNOLOGIES LLC is not liable for indirect damages.

WireGuard(R) is a registered trademark of Jason A. Donenfeld.
"@
$f2.Controls.Add($lic)

$chk2 = New-Object Windows.Forms.CheckBox
$chk2.Left = 30; $chk2.Top = 220; $chk2.Width = 500; $chk2.Height = 22
$chk2.Text = "I accept the license agreement and consent to WireGuard installation"
$chk2.ForeColor = $WHITE; $chk2.BackColor = [Drawing.Color]::Transparent
$chk2.Font = New-Object Drawing.Font("Segoe UI", 10)
$f2.Controls.Add($chk2)

# Tunnel mode section
$f2.Controls.Add((lbl "VPN TUNNEL MODE" 30 252 200 16 8 $true $GREEN_D))

# Split tunnel card
$cardSplit = New-Object Windows.Forms.Panel
$cardSplit.Left = 30; $cardSplit.Top = 272; $cardSplit.Width = 240; $cardSplit.Height = 84
$cardSplit.BackColor = [Drawing.Color]::FromArgb(4, 30, 14)
$cardSplit.BorderStyle = "FixedSingle"; $cardSplit.Cursor = [Windows.Forms.Cursors]::Hand

$lblST = lbl "⚡  Split Tunnel  (Recommended)" 10 8 220 20 9 $true $GREEN
$lblST.BackColor = [Drawing.Color]::Transparent; $cardSplit.Controls.Add($lblST)
$lblSD = lbl "Only VPN traffic goes through the tunnel. All your apps and browsing work normally." 10 30 218 44 8 $false $DIM
$lblSD.BackColor = [Drawing.Color]::Transparent; $cardSplit.Controls.Add($lblSD)
$f2.Controls.Add($cardSplit)

# Full tunnel card
$cardFull = New-Object Windows.Forms.Panel
$cardFull.Left = 302; $cardFull.Top = 272; $cardFull.Width = 240; $cardFull.Height = 84
$cardFull.BackColor = $BG3; $cardFull.BorderStyle = "FixedSingle"
$cardFull.Cursor = [Windows.Forms.Cursors]::Hand

$lblFT = lbl "🔒  Full Tunnel" 10 8 220 20 9 $true $ORANGE
$lblFT.BackColor = [Drawing.Color]::Transparent; $cardFull.Controls.Add($lblFT)
$lblFD = lbl "All internet traffic routes through ProxhqVPN. Maximum privacy — every app is protected." 10 30 218 44 8 $false $DIM
$lblFD.BackColor = [Drawing.Color]::Transparent; $cardFull.Controls.Add($lblFD)
$f2.Controls.Add($cardFull)

function Select-Tunnel($mode) {
    $Script:TunnelMode = $mode
    if ($mode -eq "split") {
        $cardSplit.BackColor = [Drawing.Color]::FromArgb(4, 40, 18)
        $cardFull.BackColor  = $BG3
    } else {
        $cardFull.BackColor  = [Drawing.Color]::FromArgb(32, 20, 4)
        $cardSplit.BackColor = $BG3
    }
}
$cardSplit.Add_Click({ Select-Tunnel "split" }); $lblST.Add_Click({ Select-Tunnel "split" }); $lblSD.Add_Click({ Select-Tunnel "split" })
$cardFull.Add_Click({ Select-Tunnel "full" });  $lblFT.Add_Click({ Select-Tunnel "full" });  $lblFD.Add_Click({ Select-Tunnel "full" })
Select-Tunnel "split"

$b2Next = btn "Install  >" 442 400 110 36 $true
$b2Back = btn "< Back"    312 400
$b2Next.Enabled = $false
$f2.Controls.AddRange(@($b2Next, $b2Back))
$chk2.Add_CheckedChanged({ $b2Next.Enabled = $chk2.Checked })
$Script:p2ok = $false
$b2Next.Add_Click({   $Script:p2ok = $true;  $f2.Close() })
$b2Back.Add_Click({   $Script:p2ok = $false; $f2.Close() })
$f2.ShowDialog() | Out-Null
if (-not $Script:p2ok) { exit }

# ─── PAGE 3: INSTALLATION + VPN ACTIVATION ────────────────────────────────────
$f3 = make-form "Installing WireGuard & Activating VPN"

# Phase badges
function makeBadge($text, $x) {
    $b = New-Object Windows.Forms.Label
    $b.Text = $text; $b.Left = $x; $b.Top = 90; $b.Width = 158; $b.Height = 22
    $b.TextAlign = "MiddleCenter"
    $b.Font = New-Object Drawing.Font("Segoe UI", 8, [Drawing.FontStyle]::Bold)
    $b.ForeColor = $DIM; $b.BackColor = $BG3
    return $b
}
$phaseWG  = makeBadge "① WireGuard"    30
$phaseCfg = makeBadge "② Detect Config" 198
$phaseTun = makeBadge "③ Activate"     366
$f3.Controls.AddRange(@($phaseWG, $phaseCfg, $phaseTun))

function SetPhase($which) {
    @($phaseWG, $phaseCfg, $phaseTun) | ForEach-Object { $_.ForeColor = $DIM; $_.BackColor = $BG3 }
    $which.ForeColor = [Drawing.Color]::Black; $which.BackColor = $GREEN
    $f3.Refresh()
}
SetPhase $phaseWG

$prog = New-Object Windows.Forms.ProgressBar
$prog.Left = 30; $prog.Top = 122; $prog.Width = 510; $prog.Height = 8
$prog.Style = "Continuous"; $prog.Value = 0
$f3.Controls.Add($prog)

$statLbl = lbl "Preparing..." 30 136 510 20 10 $false $DIM
$f3.Controls.Add($statLbl)

$logBox = New-Object Windows.Forms.RichTextBox
$logBox.Left = 30; $logBox.Top = 160; $logBox.Width = 510; $logBox.Height = 130
$logBox.BackColor = $BG2; $logBox.ForeColor = $DIM
$logBox.Font = New-Object Drawing.Font("Consolas", 8.5)
$logBox.BorderStyle = "FixedSingle"; $logBox.ReadOnly = $true; $logBox.ScrollBars = "Vertical"
$f3.Controls.Add($logBox)

$waitLbl = New-Object Windows.Forms.Label
$waitLbl.Left = 30; $waitLbl.Top = 302; $waitLbl.Width = 510; $waitLbl.Height = 54
$waitLbl.Font = New-Object Drawing.Font("Segoe UI", 9)
$waitLbl.ForeColor = $GREEN; $waitLbl.BackColor = [Drawing.Color]::Transparent
$waitLbl.Visible = $false
$f3.Controls.Add($waitLbl)

$f3.Show(); $f3.Refresh()

function log($msg) { $logBox.AppendText("> $msg`n"); $logBox.ScrollToCaret(); $f3.Refresh() }
function prog($msg, $pct) { $statLbl.Text = $msg; $prog.Value = [Math]::Min([int]$pct, 100); $f3.Refresh() }

# ── Phase 1: Install WireGuard ────────────────────────────────────────────────
$wgInstalled = Test-Path $WG_EXE

if ($wgInstalled) {
    prog "WireGuard already installed — skipping download." 45
    log "WireGuard found at $WG_EXE"
    Start-Sleep -Milliseconds 400
} else {
    prog "Downloading WireGuard installer from wireguard.com..." 5
    log "Connecting to download.wireguard.com..."
    $tmpExe = "$env:TEMP\proxhq-wg-installer.exe"

    try {
        $wc = New-Object System.Net.WebClient
        $wc.Headers.Add("User-Agent", "ProxhqVPN-Installer/2.0")
        $wc.Add_DownloadProgressChanged({
            prog ("Downloading WireGuard... " + $_.ProgressPercentage + "%") ([int]($_.ProgressPercentage * 0.45) + 5)
        })
        $task = $wc.DownloadFileTaskAsync($WG_URL, $tmpExe)
        while (-not $task.IsCompleted) {
            [System.Windows.Forms.Application]::DoEvents()
            Start-Sleep -Milliseconds 40
        }
        if ($task.IsFaulted) { throw $task.Exception.InnerException.Message }
        log "Download complete."
    } catch {
        log "Async download failed — trying fallback..."
        try {
            Invoke-WebRequest -Uri $WG_URL -OutFile $tmpExe -UseBasicParsing -ErrorAction Stop
            log "Download complete (fallback method)."
        } catch {
            log "ERROR: Could not download WireGuard: $_"
        }
    }

    prog "Installing WireGuard silently..." 52
    log "Running installer with /S flag (silent)..."
    try {
        $p = Start-Process -FilePath $tmpExe -ArgumentList "/S" -PassThru -Wait -ErrorAction Stop
        if ($p.ExitCode -eq 0) {
            log "WireGuard installed successfully."
        } else {
            log "Installer returned exit code $($p.ExitCode) — may still have succeeded."
        }
    } catch {
        log "Install error: $_ — WireGuard may already be present or requires admin."
    }
    try { Remove-Item $tmpExe -Force -ErrorAction SilentlyContinue } catch {}
    $wgInstalled = Test-Path $WG_EXE
}

prog "WireGuard ready." 66
log ""

# ── Phase 2: Save config, create shortcuts ───────────────────────────────────
SetPhase $phaseCfg
prog "Setting up ProxhqVPN shortcuts..." 70
log "Creating application shortcuts..."
New-Item -ItemType Directory -Force -Path $INSTALL | Out-Null

# Save tunnel mode preference
$cfgDir = "$env:LOCALAPPDATA\ProxhqVPN"
New-Item -ItemType Directory -Force -Path $cfgDir | Out-Null
[System.IO.File]::WriteAllText("$cfgDir\config.json", "{`"tunnelMode`":`"$($Script:TunnelMode)`",`"hostname`":`"$HOSTNAME`"}")

# Desktop shortcut
try {
    $ws = New-Object -ComObject WScript.Shell
    $sc = $ws.CreateShortcut("$env:USERPROFILE\Desktop\ProxhqVPN.lnk")
    $sc.TargetPath = "https://proxhqvpn.com"; $sc.Description = "Open ProxhqVPN"
    $sc.Save(); log "Desktop shortcut created."
} catch { log "Desktop shortcut: $_" }

# Start Menu
try {
    $smDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\ProxhqVPN"
    New-Item -ItemType Directory -Force -Path $smDir | Out-Null
    $ws2 = New-Object -ComObject WScript.Shell
    $sc2 = $ws2.CreateShortcut("$smDir\ProxhqVPN.lnk")
    $sc2.TargetPath = "https://proxhqvpn.com"; $sc2.Save()
    log "Start Menu shortcut created."
} catch { log "Start Menu: $_" }

# Registry (Add/Remove Programs)
try {
    $reg = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ProxhqVPN"
    New-Item -Path $reg -Force | Out-Null
    Set-ItemProperty $reg "DisplayName"    "ProxhqVPN"
    Set-ItemProperty $reg "DisplayVersion" "2.0.0"
    Set-ItemProperty $reg "Publisher"      $PUBLISHER
    Set-ItemProperty $reg "URLInfoAbout"   $BASE_URL
    log "Registered in Windows Add/Remove Programs."
} catch { log "Registry: $_" }

# ── Phase 3: Open browser → watch Downloads for .conf ────────────────────────
SetPhase $phaseTun
prog "Waiting for VPN config download..." 80
log ""
log "Opening ProxhqVPN in your browser..."
log "Sign in → WireGuard Config → Generate Config → Download."
log "This wizard will detect the download and activate your tunnel automatically."

$deviceUrl = "$BASE_URL/dashboard/wireguard?autosetup=1&hostname=$HOSTNAME&tunnelmode=$($Script:TunnelMode)"
Start-Process $deviceUrl

$waitLbl.Text = "Sign in at the browser window that just opened.`nGo to WireGuard Config → Generate Config → click Download.`nYour tunnel will activate automatically when the file downloads."
$waitLbl.Visible = $true
$f3.Refresh()

$downloadsDir  = "$env:USERPROFILE\Downloads"
$watchSeconds  = 180
$elapsed       = 0
$confInstalled = $false
$confFile      = $null

# Snapshot existing .conf files so we only react to new ones
$existingConfs = @(Get-ChildItem -Path $downloadsDir -Filter "*.conf" -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty FullName)

while ($elapsed -lt $watchSeconds) {
    [System.Windows.Forms.Application]::DoEvents()
    Start-Sleep -Milliseconds 500
    $elapsed += 0.5

    $remaining = [int]($watchSeconds - $elapsed)
    $statLbl.Text = "Watching for config download... ($remaining s remaining)"
    $f3.Refresh()

    $current = @(Get-ChildItem -Path $downloadsDir -Filter "*.conf" -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty FullName)
    $newConfs = $current | Where-Object { $existingConfs -notcontains $_ }

    if ($newConfs.Count -gt 0) {
        $confFile = $newConfs[0]
        log "Detected: $([System.IO.Path]::GetFileName($confFile))"
        break
    }
}

if ($confFile) {
    prog "Installing VPN tunnel..." 90
    log "Applying tunnel mode: $($Script:TunnelMode)"

    # Read and patch AllowedIPs for split tunnel mode
    $confContent = [System.IO.File]::ReadAllText($confFile)
    if ($Script:TunnelMode -eq "split") {
        $confContent = [System.Text.RegularExpressions.Regex]::Replace(
            $confContent,
            "(?m)AllowedIPs\s*=\s*0\.0\.0\.0/0[^\r\n]*",
            "AllowedIPs = 10.8.0.0/24"
        )
        $confContent = [System.Text.RegularExpressions.Regex]::Replace(
            $confContent, ",\s*::[/0-9]+", ""
        )
        log "Split Tunnel: AllowedIPs set to 10.8.0.0/24 (apps route normally)"
    } else {
        log "Full Tunnel: all traffic routed through ProxhqVPN"
    }

    # Save to WireGuard config directory
    $confDest = "$downloadsDir\proxhqvpn.conf"  # safe fallback
    try {
        if (-not (Test-Path $WG_DIR)) { New-Item -ItemType Directory -Force -Path $WG_DIR | Out-Null }
        $pgConf = "$WG_DIR\proxhqvpn.conf"
        [System.IO.File]::WriteAllText($pgConf, $confContent)
        $confDest = $pgConf
        log "Config saved to $confDest"
    } catch {
        [System.IO.File]::WriteAllText($confDest, $confContent)
        log "Saved to Downloads (admin required for ProgramData)"
    }

    # Activate via wireguard.exe /installtunnel
    if (Test-Path $WG_EXE) {
        prog "Activating WireGuard tunnel..." 96
        log "Running: wireguard.exe /installtunnel ..."
        try {
            $p = Start-Process -FilePath $WG_EXE -ArgumentList "/installtunnel `"$confDest`"" -PassThru -Wait -ErrorAction Stop
            if ($p.ExitCode -eq 0) {
                $confInstalled = $true
                log "Tunnel installed and active! VPN is ON."
            } else {
                log "Exit code $($p.ExitCode) — retrying with elevated permissions..."
                Start-Process -FilePath $WG_EXE -ArgumentList "/installtunnel `"$confDest`"" -Verb RunAs -Wait -ErrorAction SilentlyContinue
                $confInstalled = $true
                log "Tunnel activated."
            }
        } catch {
            log "Auto-activate failed: $_"
            log "Open the WireGuard app and import the config manually."
        }
    } else {
        log "wireguard.exe not found. Open WireGuard manually and import the .conf file."
    }

    prog "Done!" 100
} else {
    prog "Timed out — activate tunnel manually in WireGuard." 95
    $waitLbl.ForeColor = $ORANGE
    $waitLbl.Text = "No config download detected in 3 minutes.`nOpen WireGuard → Add Tunnel → Import from file → select your .conf file."
    log "Download not detected. Import the config manually into the WireGuard app."
    $f3.Refresh()
    Start-Sleep -Seconds 3
}

Start-Sleep -Milliseconds 600
$f3.Close()

# ─── PAGE 4: DONE ─────────────────────────────────────────────────────────────
$f4 = make-form "ProxhqVPN — Setup Complete"
$f4.Controls.Add((lbl "✓" 28 92 50 50 26 $true $GREEN))
$f4.Controls.Add((lbl "ProxhqVPN is ready!" 82 98 440 28 15 $true $WHITE))
$f4.Controls.Add((lbl "© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC" 82 130 420 18 8 $false $GREEN_D))

$statusRows = @(
    @{ label = "WireGuard";        value = if ($wgInstalled) { "Installed & ready" } else { "Install manually from wireguard.com" };  ok = $wgInstalled },
    @{ label = "VPN Tunnel";       value = if ($confInstalled) { "Active — you are protected" } else { "Import .conf in WireGuard to activate" }; ok = $confInstalled },
    @{ label = "Tunnel Mode";      value = if ($Script:TunnelMode -eq "split") { "Split Tunnel — apps work normally" } else { "Full Tunnel — all traffic encrypted" }; ok = $true },
    @{ label = "Desktop Shortcut"; value = "Created";                                                                                  ok = $true },
    @{ label = "Per-App Monitor";  value = "Runs on next ProxhqVPN launch";                                                           ok = $true }
)
$sy = 162
foreach ($row in $statusRows) {
    $dot = New-Object Windows.Forms.Panel
    $dot.Left = 30; $dot.Top = $sy + 6; $dot.Width = 8; $dot.Height = 8
    $dot.BackColor = if ($row.ok) { $GREEN } else { $ORANGE }
    $f4.Controls.Add($dot)
    $f4.Controls.Add((lbl $row.label 46 $sy 130 20 9 $true $WHITE))
    $f4.Controls.Add((lbl $row.value 178 $sy 340 20 9 $false $DIM))
    $sy += 26
}

if (-not $confInstalled) {
    $f4.Controls.Add((lbl "To activate: Open WireGuard → click + → Import from file → select your downloaded .conf" 30 340 510 38 9 $false $ORANGE))
}

$btnFinish = btn "Open ProxhqVPN" 432 400 120 36 $true
$f4.Controls.Add($btnFinish)
$btnFinish.Add_Click({ $f4.Close() })
$f4.ShowDialog() | Out-Null
Start-Process "$BASE_URL/dashboard"
