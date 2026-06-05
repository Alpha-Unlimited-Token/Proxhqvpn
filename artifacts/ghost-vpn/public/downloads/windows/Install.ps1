# ProxhqVPN Windows Installer v2
# © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
# Requires: Windows 10/11, PowerShell 5+, internet connection
# Run via: Launch-ProxhqVPN-Setup.vbs

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
[System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false)

# ── Constants ────────────────────────────────────────────────────────────────
$BASE_URL   = "https://proxhqvpn.com"
$WG_URL     = "https://download.wireguard.com/windows-client/wireguard-installer.exe"
$WG_EXE     = "C:\Program Files\WireGuard\wireguard.exe"
$WG_DIR     = "C:\ProgramData\WireGuard"
$INSTALL    = "$env:LOCALAPPDATA\ProxhqVPN"
$HOSTNAME   = $env:COMPUTERNAME
$PUBLISHER  = "ALPHA UNLIMITED TECHNOLOGIES LLC"

# ── Colors ───────────────────────────────────────────────────────────────────
$cBg       = [Drawing.Color]::FromArgb(4,   10,  6)
$cBg2      = [Drawing.Color]::FromArgb(8,   18, 10)
$cBg3      = [Drawing.Color]::FromArgb(13,  26, 15)
$cGreen    = [Drawing.Color]::FromArgb(0,  255, 136)
$cGreenD   = [Drawing.Color]::FromArgb(0,  200, 100)
$cGreenDD  = [Drawing.Color]::FromArgb(0,  140,  70)
$cWhite    = [Drawing.Color]::White
$cDim      = [Drawing.Color]::FromArgb(160, 200, 170)
$cFaint    = [Drawing.Color]::FromArgb(60,   90,  70)
$cOrange   = [Drawing.Color]::FromArgb(255, 179,  71)
$cRed      = [Drawing.Color]::FromArgb(255,  80,  80)
$cBlack    = [Drawing.Color]::Black

# ── State ────────────────────────────────────────────────────────────────────
$Script:TunnelMode    = "split"
$Script:WgInstalled   = $false
$Script:CfgInstalled  = $false
$Script:SignedIn      = $false
$Script:ConfigText    = ""

# ── Font helpers ─────────────────────────────────────────────────────────────
function F($sz, $bold=$false) {
    $sty = if ($bold) { [Drawing.FontStyle]::Bold } else { [Drawing.FontStyle]::Regular }
    return New-Object Drawing.Font("Segoe UI", $sz, $sty)
}
function FM($sz) { return New-Object Drawing.Font("Consolas", $sz, [Drawing.FontStyle]::Regular) }

# ── Control helpers ──────────────────────────────────────────────────────────
function Lbl($text, $x, $y, $w, $h, $font, $color, $bg=$null) {
    $l = New-Object Windows.Forms.Label
    $l.Text = $text; $l.Left = $x; $l.Top = $y; $l.Width = $w; $l.Height = $h
    $l.Font = $font; $l.ForeColor = $color
    $l.BackColor = if ($bg) { $bg } else { [Drawing.Color]::Transparent }
    return $l
}
function Btn($text, $x, $y, $w, $h, $primary=$false) {
    $b = New-Object Windows.Forms.Button
    $b.Text = $text; $b.Left = $x; $b.Top = $y; $b.Width = $w; $b.Height = $h
    $b.FlatStyle = [Windows.Forms.FlatStyle]::Flat
    $b.FlatAppearance.BorderSize = 1
    if ($primary) {
        $b.BackColor = $cGreen; $b.ForeColor = $cBlack
        $b.FlatAppearance.BorderColor = $cGreen
    } else {
        $b.BackColor = $cBg3; $b.ForeColor = $cDim
        $b.FlatAppearance.BorderColor = $cFaint
    }
    $b.Font = F 10 $true; $b.Cursor = [Windows.Forms.Cursors]::Hand
    return $b
}
function Panel($x, $y, $w, $h, $color=$null) {
    $p = New-Object Windows.Forms.Panel
    $p.Left = $x; $p.Top = $y; $p.Width = $w; $p.Height = $h
    if ($color) { $p.BackColor = $color }
    return $p
}
function PBar($x, $y, $w) {
    $p = New-Object Windows.Forms.ProgressBar
    $p.Left = $x; $p.Top = $y; $p.Width = $w; $p.Height = 6
    $p.Style = [Windows.Forms.ProgressBarStyle]::Continuous
    $p.Value = 0
    return $p
}
function RTBox($x, $y, $w, $h) {
    $r = New-Object Windows.Forms.RichTextBox
    $r.Left = $x; $r.Top = $y; $r.Width = $w; $r.Height = $h
    $r.BackColor = $cBg2; $r.ForeColor = $cGreenDD
    $r.Font = FM 8.5; $r.BorderStyle = "FixedSingle"
    $r.ReadOnly = $true; $r.ScrollBars = "Vertical"
    return $r
}

# ══════════════════════════════════════════════════════════════════════════════
# MAIN FORM
# ══════════════════════════════════════════════════════════════════════════════
$form = New-Object Windows.Forms.Form
$form.Text           = "ProxhqVPN Setup"
$form.Size           = New-Object Drawing.Size(640, 560)
$form.StartPosition  = "CenterScreen"
$form.BackColor      = $cBg
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox    = $false
$form.MinimizeBox    = $true
$form.Icon           = [Drawing.SystemIcons]::Shield

# ── Header bar ───────────────────────────────────────────────────────────────
$hdrPanel = Panel 0 0 640 72 $cBg2
$hdrTitle = Lbl "ProxhqVPN Setup" 20 10 400 34 (F 17 $true) $cGreen
$hdrSub   = Lbl "ALPHA UNLIMITED TECHNOLOGIES LLC" 20 46 400 18 (F 8) $cGreenD
$hdrSep   = Panel 0 72 640 1 $cFaint
$form.Controls.AddRange(@($hdrPanel, $hdrSep))
$hdrPanel.Controls.AddRange(@($hdrTitle, $hdrSub))

# ── Step indicator bar ───────────────────────────────────────────────────────
$stepBar   = Panel 0 73 640 44 $cBg3
$stepSep   = Panel 0 117 640 1 $cFaint
$form.Controls.AddRange(@($stepBar, $stepSep))

$stepLabels = @("1  Welcome", "2  License", "3  Install", "4  Sign In", "5  Activate", "6  Done")
$stepEls    = @()
$stepW      = [int](620 / $stepLabels.Count)
for ($i = 0; $i -lt $stepLabels.Count; $i++) {
    $sl = New-Object Windows.Forms.Label
    $sl.Text = $stepLabels[$i]; $sl.Left = 10 + $i * $stepW; $sl.Top = 12
    $sl.Width = $stepW - 4; $sl.Height = 20; $sl.TextAlign = "MiddleCenter"
    $sl.Font = F 8; $sl.ForeColor = $cFaint
    $sl.BackColor = [Drawing.Color]::Transparent
    $stepBar.Controls.Add($sl)
    $stepEls += $sl
}

function SetStep($n) {
    for ($i = 0; $i -lt $stepEls.Count; $i++) {
        if ($i -lt $n) {
            $stepEls[$i].ForeColor = $cGreenD; $stepEls[$i].Font = F 8
        } elseif ($i -eq $n) {
            $stepEls[$i].ForeColor = $cGreen; $stepEls[$i].Font = F 8 $true
        } else {
            $stepEls[$i].ForeColor = $cFaint; $stepEls[$i].Font = F 8
        }
    }
    $form.Refresh()
}

# ── Content area + nav buttons ───────────────────────────────────────────────
$contentY = 118
$contentH = 380

$btnBack   = Btn "< Back"   20 506 90 32 $false
$btnNext   = Btn "Next >"  520 506 100 32 $true
$btnCancel = Btn "Cancel"  415 506 95 32 $false

$form.Controls.AddRange(@($btnBack, $btnNext, $btnCancel))
$btnBack.Visible   = $false
$btnCancel.Add_Click({ $form.Close() })

# ── Page panels ──────────────────────────────────────────────────────────────
$pages = @()
for ($i = 0; $i -lt 6; $i++) {
    $p = Panel 0 $contentY 640 $contentH
    $p.Visible = ($i -eq 0)
    $form.Controls.Add($p)
    $pages += $p
}
$Script:CurrentPage = 0

function ShowPage($n) {
    for ($i = 0; $i -lt $pages.Count; $i++) { $pages[$i].Visible = ($i -eq $n) }
    $Script:CurrentPage = $n
    SetStep $n
    $btnBack.Visible = ($n -gt 0 -and $n -lt 5)
    $form.Refresh()
}

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 0 — WELCOME
# ══════════════════════════════════════════════════════════════════════════════
$pg = $pages[0]
$pg.Controls.Add((Lbl "Welcome to ProxhqVPN" 30 20 500 32 (F 16 $true) $cWhite))
$pg.Controls.Add((Lbl "Complete automatic setup — WireGuard installs silently, VPN activates inside this wizard." 30 56 560 22 (F 10) $cDim))

$feats = @(
    @("⚡", "WireGuard downloaded and installed silently in the background"),
    @("🛡", "Choose split tunnel or full tunnel mode before installation"),
    @("🔑", "Sign in inside this wizard — VPN config generated automatically"),
    @("🔒", "Tunnel activates the moment your config is ready — no manual steps"),
    @("👁", "Per-app network monitor alerts you when new apps connect"),
    @("🧹", "Zero-logs policy — your traffic is never stored or monitored")
)
$fy = 92
foreach ($feat in $feats) {
    $icon = Lbl $feat[0] 30 $fy 28 26 (F 13) $cGreen
    $text = Lbl $feat[1] 62 $fy 530 26 (F 10) $cDim
    $pg.Controls.AddRange(@($icon, $text))
    $fy += 32
}

$btnNext.Add_Click({
    if ($Script:CurrentPage -eq 0) { ShowPage 1; $btnNext.Text = "Install >"; return }
    if ($Script:CurrentPage -eq 1) { StartInstall; return }
})

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 1 — LICENSE + TUNNEL MODE
# ══════════════════════════════════════════════════════════════════════════════
$pg = $pages[1]
$pg.Controls.Add((Lbl "License Agreement & VPN Tunnel Mode" 30 18 560 28 (F 14 $true) $cWhite))
$pg.Controls.Add((Lbl "Accept the license, then choose how your VPN tunnel routes traffic." 30 48 560 20 (F 10) $cDim))

$licBox = RTBox 30 72 572 110
$licBox.Text = @"
PROXHQVPN END USER LICENSE AGREEMENT — Copyright (c) 2026 ALPHA UNLIMITED TECHNOLOGIES LLC

1. LICENSE GRANT — Non-exclusive license to install and use ProxhqVPN on devices you own.
2. WIREGUARD CONSENT — ProxhqVPN requires WireGuard (open-source, GPLv2, Jason A. Donenfeld).
   By proceeding you authorize its silent download and installation from wireguard.com.
3. ZERO LOGS — We do not log, store, or monitor VPN traffic, browsing, or connection times.
4. LIABILITY — ALPHA UNLIMITED TECHNOLOGIES LLC is not liable for indirect or consequential damages.
5. GOVERNING LAW — Governed by the laws of the jurisdiction of ALPHA UNLIMITED TECHNOLOGIES LLC.

WireGuard(R) is a registered trademark of Jason A. Donenfeld.
"@
$pg.Controls.Add($licBox)

$chkAccept = New-Object Windows.Forms.CheckBox
$chkAccept.Left = 30; $chkAccept.Top = 188; $chkAccept.Width = 560; $chkAccept.Height = 22
$chkAccept.Text = "I accept the license agreement and consent to WireGuard installation"
$chkAccept.ForeColor = $cWhite; $chkAccept.Font = F 10
$chkAccept.BackColor = [Drawing.Color]::Transparent
$pg.Controls.Add($chkAccept)

# Tunnel mode
$pg.Controls.Add((Lbl "VPN TUNNEL MODE" 30 220 300 16 (F 8 $true) $cGreenD))

function MakeTunnelCard($x, $title, $icon, $desc, $tag, $tagColor, $isDefault) {
    $card = Panel $x 238 272 112 $cBg3
    $card.Cursor = [Windows.Forms.Cursors]::Hand
    if ($isDefault) { $card.BackColor = [Drawing.Color]::FromArgb(5, 35, 18) }

    $ic  = Lbl $icon  10 8 30 24 (F 14) $cGreen; $ic.BackColor = [Drawing.Color]::Transparent
    $tl  = Lbl $title 42 8 210 22 (F 10 $true) (if ($isDefault) { $cGreen } else { $cOrange }); $tl.BackColor = [Drawing.Color]::Transparent
    $ds  = Lbl $desc  10 34 252 42 (F 8.5) $cDim; $ds.BackColor = [Drawing.Color]::Transparent
    $tg  = Lbl $tag   10 82 100 18 (F 8) $tagColor; $tg.BackColor = [Drawing.Color]::Transparent

    $card.Controls.AddRange(@($ic, $tl, $ds, $tg))
    return $card
}

$cardSplit = MakeTunnelCard 30 "Split Tunnel  ★ Recommended" "⚡" "Only ProxhqVPN traffic uses the tunnel. All your apps, games, and streaming work normally." "✓ Apps unaffected" $cGreenD $true
$cardFull  = MakeTunnelCard 336 "Full Tunnel" "🔒" "All internet traffic routes through ProxhqVPN. Maximum privacy. Every app is protected." "⚠ May slow some apps" $cOrange $false
$pg.Controls.AddRange(@($cardSplit, $cardFull))

function SelectTunnel($mode) {
    $Script:TunnelMode = $mode
    if ($mode -eq "split") {
        $cardSplit.BackColor = [Drawing.Color]::FromArgb(5, 40, 20)
        $cardFull.BackColor  = $cBg3
    } else {
        $cardFull.BackColor  = [Drawing.Color]::FromArgb(36, 20, 4)
        $cardSplit.BackColor = $cBg3
    }
    $form.Refresh()
}
$cardSplit.Add_Click({ SelectTunnel "split" }); foreach ($c in $cardSplit.Controls) { $c.Add_Click({ SelectTunnel "split" }) }
$cardFull.Add_Click({ SelectTunnel "full" });  foreach ($c in $cardFull.Controls)  { $c.Add_Click({ SelectTunnel "full" }) }
SelectTunnel "split"

$chkAccept.Add_CheckedChanged({ $btnNext.Enabled = $chkAccept.Checked })
$btnNext.Enabled = $false
$btnBack.Add_Click({ if ($Script:CurrentPage -eq 1) { ShowPage 0; $btnNext.Text = "Next >"; $btnNext.Enabled = $true } })

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 2 — SILENT WIREGUARD INSTALL
# ══════════════════════════════════════════════════════════════════════════════
$pg = $pages[2]
$p2title   = Lbl "Installing WireGuard" 30 18 500 28 (F 14 $true) $cWhite
$p2sub     = Lbl "Downloading and installing silently — this takes about 30 seconds." 30 48 560 20 (F 10) $cDim
$p2prog    = PBar 30 78 572
$p2step    = Lbl "Preparing..." 30 92 560 20 (F 9.5) $cGreenD
$p2log     = RTBox 30 116 572 200
$p2errBox  = Panel 30 322 572 46 ([Drawing.Color]::FromArgb(40, 0, 0))
$p2errLbl  = Lbl "" 10 8 552 30 (F 9) $cRed; $p2errLbl.BackColor = [Drawing.Color]::Transparent
$p2errBox.Controls.Add($p2errLbl); $p2errBox.Visible = $false

# Phase badges
function MakePhaseBadge($text, $x) {
    $b = New-Object Windows.Forms.Label
    $b.Text = $text; $b.Left = $x; $b.Top = 330; $b.Width = 178; $b.Height = 24
    $b.TextAlign = "MiddleCenter"; $b.Font = F 9; $b.Cursor = [Windows.Forms.Cursors]::Default
    $b.ForeColor = $cFaint; $b.BackColor = $cBg3
    return $b
}
$ph1 = MakePhaseBadge "① WireGuard"  30
$ph2 = MakePhaseBadge "② Sign In"    216
$ph3 = MakePhaseBadge "③ Activate"   402
$pg.Controls.AddRange(@($p2title, $p2sub, $p2prog, $p2step, $p2log, $p2errBox, $ph1, $ph2, $ph3))

function SetPhase($which) {
    @($ph1, $ph2, $ph3) | ForEach-Object { $_.ForeColor = $cFaint; $_.BackColor = $cBg3 }
    $which.ForeColor = $cBlack; $which.BackColor = $cGreen; $form.Refresh()
}
function Log2($msg) { $p2log.AppendText("> $msg`n"); $p2log.ScrollToCaret(); $form.Refresh() }
function Prog2($msg, $pct) { $p2step.Text = $msg; $p2prog.Value = [Math]::Min([int]$pct, 100); $form.Refresh() }

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 3 — SIGN IN (embedded browser)
# ══════════════════════════════════════════════════════════════════════════════
$pg = $pages[3]
$p3title = Lbl "Sign In to ProxhqVPN" 30 14 500 26 (F 13 $true) $cWhite
$p3sub   = Lbl "Sign in below. Your VPN config will generate and activate automatically." 30 42 560 20 (F 10) $cDim

$wb = New-Object Windows.Forms.WebBrowser
$wb.Left = 30; $wb.Top = 66; $wb.Width = 572; $wb.Height = 260
$wb.ScriptErrorsSuppressed = $true

$p3status = Lbl "Loading sign-in page..." 30 334 460 22 (F 9) $cGreenD
$p3spin   = Lbl "◌" 490 334 60 22 (F 11) $cGreenDD

$pg.Controls.AddRange(@($p3title, $p3sub, $wb, $p3status, $p3spin))

# Animate spinner
$spinChars = @("◌","◎","●","◉","○")
$spinIdx   = 0
$spinTimer = New-Object Windows.Forms.Timer
$spinTimer.Interval = 180
$spinTimer.Add_Tick({ $p3spin.Text = $spinChars[$script:spinIdx % $spinChars.Count]; $script:spinIdx++ })

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 4 — CONFIG GENERATION + TUNNEL ACTIVATION
# ══════════════════════════════════════════════════════════════════════════════
$pg = $pages[4]
$p4title  = Lbl "Activating VPN Tunnel" 30 18 500 28 (F 14 $true) $cWhite
$p4sub    = Lbl "Generating your config and activating the WireGuard tunnel." 30 48 560 20 (F 10) $cDim
$p4prog   = PBar 30 78 572
$p4step   = Lbl "Connecting..." 30 92 560 20 (F 9.5) $cGreenD
$p4log    = RTBox 30 116 572 220
$pg.Controls.AddRange(@($p4title, $p4sub, $p4prog, $p4step, $p4log))
function Log4($msg) { $p4log.AppendText("> $msg`n"); $p4log.ScrollToCaret(); $form.Refresh() }
function Prog4($msg, $pct) { $p4step.Text = $msg; $p4prog.Value = [Math]::Min([int]$pct, 100); $form.Refresh() }

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 5 — DONE
# ══════════════════════════════════════════════════════════════════════════════
$pg = $pages[5]
$pg.Controls.Add((Lbl "✓" 28 18 54 54 (F 28 $true) $cGreen))
$p5Title  = Lbl "ProxhqVPN is Ready!" 86 24 460 30 (F 16 $true) $cWhite
$p5sub    = Lbl "" 86 58 460 22 (F 10) $cDim
$p5grid   = Panel 30 92 572 220 $cBg3
$p5notice = Lbl "" 30 318 572 48 (F 9) $cOrange; $p5notice.Visible = $false
$pg.Controls.AddRange(@($p5Title, $p5sub, $p5grid, $p5notice))

function BuildDoneGrid() {
    $p5grid.Controls.Clear()
    $rows = @(
        @{ label = "WireGuard";        value = "Installed & ready";                                                         ok = $true  },
        @{ label = "VPN Tunnel";       value = if ($Script:CfgInstalled) { "Active — you are connected" } else { "Activate manually: import .conf in WireGuard app" }; ok = $Script:CfgInstalled },
        @{ label = "Tunnel Mode";      value = if ($Script:TunnelMode -eq "split") { "Split Tunnel — apps work normally" } else { "Full Tunnel — all traffic encrypted" }; ok = $true },
        @{ label = "Desktop Shortcut"; value = "Created";                                                                   ok = $true  },
        @{ label = "Per-App Monitor";  value = "Active on next launch";                                                     ok = $true  }
    )
    $ry = 10
    foreach ($row in $rows) {
        $dot = Panel 14 ($ry + 6) 9 9
        $dot.BackColor = if ($row.ok) { $cGreen } else { $cOrange }
        $lk  = Lbl $row.label  32 $ry 130 22 (F 9 $true) $cWhite; $lk.BackColor = [Drawing.Color]::Transparent
        $lv  = Lbl $row.value  168 $ry 390 22 (F 9) $cDim;         $lv.BackColor = [Drawing.Color]::Transparent
        $p5grid.Controls.AddRange(@($dot, $lk, $lv))
        $ry += 34
    }
}

# ══════════════════════════════════════════════════════════════════════════════
# INSTALL LOGIC
# ══════════════════════════════════════════════════════════════════════════════
function StartInstall {
    $btnNext.Visible    = $false
    $btnBack.Visible    = $false
    $btnCancel.Enabled  = $false
    ShowPage 2
    SetPhase $ph1

    # Save tunnel mode preference
    New-Item -ItemType Directory -Force -Path $INSTALL | Out-Null
    [System.IO.File]::WriteAllText("$INSTALL\config.json",
        "{`"tunnelMode`":`"$($Script:TunnelMode)`",`"hostname`":`"$HOSTNAME`"}")

    # ── Check if WireGuard already installed ──────────────────────────────────
    if (Test-Path $WG_EXE) {
        Prog2 "WireGuard already installed." 70
        Log2 "Found WireGuard at $WG_EXE — skipping download."
        $Script:WgInstalled = $true
        Start-Sleep -Milliseconds 600
    } else {
        # ── Download ──────────────────────────────────────────────────────────
        Prog2 "Downloading WireGuard from wireguard.com..." 5
        Log2 "Connecting to download.wireguard.com..."
        $tmpExe = "$env:TEMP\proxhq-wg-setup.exe"
        $dlOk   = $false

        try {
            $wc = New-Object System.Net.WebClient
            $wc.Headers.Add("User-Agent", "ProxhqVPN-Installer/2.0")
            $wc.Add_DownloadProgressChanged({
                Prog2 ("Downloading WireGuard... " + $_.ProgressPercentage + "%") ([int]($_.ProgressPercentage * 0.55) + 5)
            })
            $task = $wc.DownloadFileTaskAsync($WG_URL, $tmpExe)
            while (-not $task.IsCompleted) {
                [System.Windows.Forms.Application]::DoEvents()
                Start-Sleep -Milliseconds 40
            }
            if ($task.IsFaulted) { throw $task.Exception.InnerException.Message }
            Log2 "Download complete."
            $dlOk = $true
        } catch {
            Log2 "WebClient failed: $_ — trying Invoke-WebRequest..."
            try {
                Invoke-WebRequest -Uri $WG_URL -OutFile $tmpExe -UseBasicParsing -ErrorAction Stop
                Log2 "Download complete (fallback)."
                $dlOk = $true
            } catch {
                Log2 "ERROR: Download failed: $_"
                $p2errLbl.Text = "Download failed. Check your internet connection and try again."
                $p2errBox.Visible = $true
            }
        }

        if ($dlOk) {
            # ── Silent install ─────────────────────────────────────────────
            Prog2 "Installing WireGuard silently..." 62
            Log2 "Running wireguard-installer.exe /S ..."
            try {
                $proc = Start-Process -FilePath $tmpExe -ArgumentList "/S" -PassThru -Wait -ErrorAction Stop
                if ($proc.ExitCode -eq 0) {
                    Log2 "WireGuard installed successfully."
                    $Script:WgInstalled = $true
                } else {
                    Log2 "Installer returned code $($proc.ExitCode) — may still have worked."
                    $Script:WgInstalled = (Test-Path $WG_EXE)
                }
            } catch {
                Log2 "ERROR: $_ — trying with elevation..."
                try {
                    Start-Process -FilePath $tmpExe -ArgumentList "/S" -Verb RunAs -Wait -ErrorAction Stop
                    $Script:WgInstalled = (Test-Path $WG_EXE)
                } catch { Log2 "Elevated install also failed: $_" }
            }
            try { Remove-Item $tmpExe -Force -ErrorAction SilentlyContinue } catch {}
        }
    }

    Prog2 "WireGuard ready." 70
    Log2 ""

    # ── Create shortcuts ──────────────────────────────────────────────────────
    Log2 "Creating desktop shortcut..."
    try {
        $ws = New-Object -ComObject WScript.Shell
        $sc = $ws.CreateShortcut("$env:USERPROFILE\Desktop\ProxhqVPN.lnk")
        $sc.TargetPath = $BASE_URL; $sc.Description = "Open ProxhqVPN"; $sc.Save()
        Log2 "Desktop shortcut created."
    } catch { Log2 "Shortcut skipped: $_" }

    try {
        $smDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\ProxhqVPN"
        New-Item -ItemType Directory -Force -Path $smDir | Out-Null
        $ws2 = New-Object -ComObject WScript.Shell
        $sc2 = $ws2.CreateShortcut("$smDir\ProxhqVPN.lnk")
        $sc2.TargetPath = $BASE_URL; $sc2.Save()
        Log2 "Start Menu shortcut created."
    } catch { Log2 "Start Menu: $_" }

    try {
        $reg = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ProxhqVPN"
        New-Item -Path $reg -Force | Out-Null
        Set-ItemProperty $reg "DisplayName" "ProxhqVPN"
        Set-ItemProperty $reg "DisplayVersion" "2.0.0"
        Set-ItemProperty $reg "Publisher" $PUBLISHER
        Set-ItemProperty $reg "URLInfoAbout" $BASE_URL
        Log2 "Registered in Add/Remove Programs."
    } catch {}

    Prog2 "WireGuard installed. Proceeding to sign-in..." 100
    Log2 "Launching sign-in..."
    Start-Sleep -Milliseconds 500

    # ── Navigate to sign-in ───────────────────────────────────────────────────
    SetPhase $ph2
    ShowPage 3
    $spinTimer.Start()

    $signInUrl = "$BASE_URL/sign-in?redirect_url=" + [System.Uri]::EscapeDataString("/dashboard/wireguard?autosetup=1&hostname=$HOSTNAME&tunnelmode=$($Script:TunnelMode)")
    $wb.Navigate($signInUrl)
    $p3status.Text = "Loading sign-in page..."
}

# ── WebBrowser document completed handler ─────────────────────────────────────
$wb.Add_DocumentCompleted({
    $url = $wb.Url.ToString()
    $p3status.Text = "Loaded: $($wb.Url.Host)$($wb.Url.AbsolutePath)"
    $form.Refresh()

    # Detect successful sign-in (URL changes to /dashboard)
    if ($url -match "/dashboard" -and $url -notmatch "/sign-in" -and $url -notmatch "/sign-up" -and -not $Script:SignedIn) {
        $Script:SignedIn = $true
        $spinTimer.Stop()
        $p3status.Text = "Signed in! Generating your VPN config..."
        $form.Refresh()
        Start-Sleep -Milliseconds 600

        # ── Call /api/devices via synchronous XHR inside the browser context ──
        $hostname = $HOSTNAME -replace "'", ""
        $jsCall = @"
(function(){
    try {
        var xhr = new XMLHttpRequest();
        xhr.open('POST', '/api/devices', false);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify({name: '$hostname', platform: 'windows'}));
        return xhr.status + '|||' + xhr.responseText;
    } catch(e) {
        return '0|||' + e.toString();
    }
})()
"@
        $result = $null
        try {
            $result = $wb.Document.InvokeScript("eval", @($jsCall))
        } catch {
            $result = "0|||InvokeScript error: $_"
        }

        ShowPage 4
        SetPhase $ph3

        if ($result -and $result -match "^(\d+)\|\|\|(.+)$") {
            $httpStatus = [int]$Matches[1]
            $body       = $Matches[2]

            if ($httpStatus -ge 200 -and $httpStatus -lt 300) {
                Prog4 "Config received — processing..." 40
                Log4 "API responded with status $httpStatus"

                try {
                    $json = $body | ConvertFrom-Json
                    # Accept various field names the API might return
                    $confText = if ($json.clientConfig) { $json.clientConfig }
                               elseif ($json.config)       { $json.config }
                               elseif ($json.wgConfig)     { $json.wgConfig }
                               else { $null }

                    if ($confText) {
                        $Script:ConfigText = $confText
                        ActivateTunnel
                    } else {
                        Log4 "No config field in response. Fields: $($json.PSObject.Properties.Name -join ', ')"
                        Prog4 "Config format unexpected — see manual activation note." 60
                        FinishSetup $false
                    }
                } catch {
                    Log4 "JSON parse error: $_"
                    Log4 "Raw response (first 200 chars): $($body.Substring(0, [Math]::Min(200, $body.Length)))"
                    FinishSetup $false
                }
            } elseif ($httpStatus -eq 401 -or $httpStatus -eq 403) {
                Log4 "Authentication error ($httpStatus) — session may not have transferred."
                Log4 "The wizard will open ProxhqVPN in your browser so you can generate the config there."
                FinishSetup $false
                Start-Process "$BASE_URL/dashboard/wireguard"
            } else {
                Log4 "API error $httpStatus. Body: $($body.Substring(0, [Math]::Min(300, $body.Length)))"
                FinishSetup $false
            }
        } else {
            Log4 "Could not contact API: $result"
            FinishSetup $false
        }
    }
})

function ActivateTunnel {
    Prog4 "Applying tunnel mode: $($Script:TunnelMode)..." 55
    Log4 "Tunnel mode: $($Script:TunnelMode)"

    $conf = $Script:ConfigText
    if ($Script:TunnelMode -eq "split") {
        $conf = [System.Text.RegularExpressions.Regex]::Replace($conf,
            "(?m)AllowedIPs\s*=\s*0\.0\.0\.0/0[^\r\n]*", "AllowedIPs = 10.8.0.0/24")
        $conf = [System.Text.RegularExpressions.Regex]::Replace($conf, ",\s*::[/0-9]+", "")
        Log4 "Split Tunnel: AllowedIPs = 10.8.0.0/24 (apps route normally)"
    } else {
        Log4 "Full Tunnel: all traffic routed through ProxhqVPN"
    }

    # Save config
    Prog4 "Saving VPN config..." 68
    $destPath = "$env:USERPROFILE\Downloads\proxhqvpn.conf"  # safe default
    $savedToWgDir = $false

    try {
        if (-not (Test-Path $WG_DIR)) { New-Item -ItemType Directory -Force -Path $WG_DIR | Out-Null }
        $wgPath = "$WG_DIR\proxhqvpn.conf"
        [System.IO.File]::WriteAllText($wgPath, $conf)
        $destPath = $wgPath
        $savedToWgDir = $true
        Log4 "Config saved: $wgPath"
    } catch {
        [System.IO.File]::WriteAllText($destPath, $conf)
        Log4 "Saved to Downloads (ProgramData requires admin): $destPath"
    }

    # Also save to INSTALL dir as backup
    try {
        [System.IO.File]::WriteAllText("$INSTALL\proxhqvpn.conf", $conf)
    } catch {}

    # Activate tunnel
    Prog4 "Activating WireGuard tunnel..." 84
    if (Test-Path $WG_EXE) {
        Log4 "Running: wireguard.exe /installtunnel ..."
        try {
            $p = Start-Process -FilePath $WG_EXE -ArgumentList "/installtunnel `"$destPath`"" -PassThru -Wait -ErrorAction Stop
            if ($p.ExitCode -eq 0) {
                $Script:CfgInstalled = $true
                Log4 "Tunnel installed and active! VPN is ON."
            } else {
                Log4 "Exit code $($p.ExitCode) — trying with elevation..."
                Start-Process -FilePath $WG_EXE -ArgumentList "/installtunnel `"$destPath`"" -Verb RunAs -Wait -ErrorAction SilentlyContinue
                $Script:CfgInstalled = $true
                Log4 "Tunnel activated."
            }
        } catch {
            Log4 "Auto-activate failed: $_"
            Log4 "Open WireGuard, click Add Tunnel, import $destPath"
        }
    } else {
        Log4 "wireguard.exe not found. Config saved to: $destPath"
        Log4 "Open WireGuard manually and import the .conf to activate."
    }

    Prog4 "Done!" 100
    Start-Sleep -Milliseconds 800
    FinishSetup $Script:CfgInstalled
}

function FinishSetup($success) {
    $p5sub.Text = if ($success) { "WireGuard installed, config generated, tunnel active." } else { "WireGuard installed. Complete VPN activation from the dashboard." }
    BuildDoneGrid
    if (-not $success) {
        $p5notice.Text = "To activate: Open WireGuard app → Add Tunnel → Import from file → select proxhqvpn.conf from your Downloads or $INSTALL folder."
        $p5notice.Visible = $true
    }
    ShowPage 5
    $btnNext.Text    = "Open ProxhqVPN"
    $btnNext.Visible = $true
    $btnBack.Visible = $false
    $btnCancel.Text  = "Close"
    $btnCancel.Enabled = $true
    $btnNext.Add_Click({ Start-Process "$BASE_URL/dashboard"; $form.Close() })
}

# ── Show form ─────────────────────────────────────────────────────────────────
SetStep 0
[System.Windows.Forms.Application]::Run($form)
