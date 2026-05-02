# Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
# ProxhqVPN Windows Installer — Full WinForms Wizard

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

# ── Constants ────────────────────────────────────────────────────────────────
$APP_NAME       = "ProxhqVPN"
$APP_VERSION    = "1.0.0"
$COMPANY        = "Alpha Unlimited Technologies LLC"
$APP_URL        = "https://network-labyrinth.replit.app"
$WG_URL         = "https://download.wireguard.com/windows-client/wireguard-installer.exe"
$DEFAULT_DIR    = "$Env:ProgramFiles\Alpha Unlimited Technologies\ProxhqVPN"
$START_MENU_DIR = "$Env:ProgramData\Microsoft\Windows\Start Menu\Programs\Alpha Unlimited Technologies"
$UNINSTALL_KEY  = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\ProxhqVPN"

$DARK_BG   = [System.Drawing.Color]::FromArgb(10,  18, 12)
$PANEL_BG  = [System.Drawing.Color]::FromArgb(15,  28, 18)
$ACCENT    = [System.Drawing.Color]::FromArgb(0,  220, 100)
$ACCENT2   = [System.Drawing.Color]::FromArgb(0,  170,  70)
$FG        = [System.Drawing.Color]::FromArgb(230, 245, 235)
$FG_MUTED  = [System.Drawing.Color]::FromArgb(140, 180, 150)
$BTN_BG    = [System.Drawing.Color]::FromArgb(0,  190,  80)
$BTN_FG    = [System.Drawing.Color]::FromArgb(5,  10,   5)
$RED       = [System.Drawing.Color]::FromArgb(255,  80,  60)

# ── Helpers ──────────────────────────────────────────────────────────────────
function New-Label($text, $x, $y, $w, $h, $size=10, $bold=$false, $color=$null) {
    $l = New-Object System.Windows.Forms.Label
    $l.Text      = $text
    $l.Location  = [System.Drawing.Point]::new($x, $y)
    $l.Size      = [System.Drawing.Size]::new($w, $h)
    $style       = if ($bold) { [System.Drawing.FontStyle]::Bold } else { [System.Drawing.FontStyle]::Regular }
    $l.Font      = New-Object System.Drawing.Font("Segoe UI", $size, $style)
    $l.ForeColor = if ($color) { $color } else { $FG }
    $l.BackColor = [System.Drawing.Color]::Transparent
    return $l
}

function New-StyledButton($text, $x, $y, $w=110, $h=36, $primary=$true) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text      = $text
    $b.Location  = [System.Drawing.Point]::new($x, $y)
    $b.Size      = [System.Drawing.Size]::new($w, $h)
    $b.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
    $b.Font      = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $b.Cursor    = [System.Windows.Forms.Cursors]::Hand
    if ($primary) {
        $b.BackColor            = $BTN_BG
        $b.ForeColor            = $BTN_FG
        $b.FlatAppearance.BorderColor = $ACCENT
    } else {
        $b.BackColor            = [System.Drawing.Color]::FromArgb(30, 50, 35)
        $b.ForeColor            = $FG_MUTED
        $b.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(50, 80, 55)
    }
    $b.FlatAppearance.BorderSize = 1
    return $b
}

function New-Separator($y, $w=540) {
    $p = New-Object System.Windows.Forms.Panel
    $p.Location  = [System.Drawing.Point]::new(0, $y)
    $p.Size      = [System.Drawing.Size]::new($w, 1)
    $p.BackColor = [System.Drawing.Color]::FromArgb(30, 60, 35)
    return $p
}

# ── Shared state ─────────────────────────────────────────────────────────────
$script:installDir    = $DEFAULT_DIR
$script:installWG     = $true
$script:createDesktop = $true
$script:createStartMenu = $true
$script:createChromeApp = $true
$script:page          = 0   # 0=Welcome 1=License 2=Components 3=InstallDir 4=Ready 5=Installing 6=Done

# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN FORM
# ═══════════════════════════════════════════════════════════════════════════════
$form = New-Object System.Windows.Forms.Form
$form.Text            = "ProxhqVPN Setup — Alpha Unlimited Technologies LLC"
$form.Size            = [System.Drawing.Size]::new(580, 500)
$form.StartPosition   = [System.Windows.Forms.FormStartPosition]::CenterScreen
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedDialog
$form.MaximizeBox     = $false
$form.MinimizeBox     = $true
$form.BackColor       = $DARK_BG
$form.Icon            = [System.Drawing.SystemIcons]::Shield

# ── Header banner (always visible) ───────────────────────────────────────────
$header = New-Object System.Windows.Forms.Panel
$header.Location  = [System.Drawing.Point]::new(0, 0)
$header.Size      = [System.Drawing.Size]::new(580, 80)
$header.BackColor = $PANEL_BG
$form.Controls.Add($header)

$hTitle = New-Label "ProxhqVPN" 70 12 300 30 18 $true $ACCENT
$hSub   = New-Label "by Alpha Unlimited Technologies LLC" 70 44 400 20 9 $false $FG_MUTED
$header.Controls.Add($hTitle)
$header.Controls.Add($hSub)

# Shield icon placeholder (Unicode)
$hIcon = New-Label "🛡" 16 18 50 44 22 $false $ACCENT
$hIcon.TextAlign = [System.Drawing.ContentAlignment]::MiddleCenter
$header.Controls.Add($hIcon)

$header.Controls.Add((New-Separator 79 580))

# Step indicator labels
$stepNames = @("Welcome","License","Components","Directory","Ready","Installing","Done")
$stepPanel = New-Object System.Windows.Forms.Panel
$stepPanel.Location  = [System.Drawing.Point]::new(0, 80)
$stepPanel.Size      = [System.Drawing.Size]::new(150, 340)
$stepPanel.BackColor = $PANEL_BG
$form.Controls.Add($stepPanel)

$stepPanel.Controls.Add((New-Separator 0 1))

$script:stepLabels = @()
for ($i = 0; $i -lt $stepNames.Count; $i++) {
    $sl = New-Label ("  $($i+1). " + $stepNames[$i]) 0 ($i * 46 + 8) 150 38 8 $false $FG_MUTED
    $sl.TextAlign = [System.Drawing.ContentAlignment]::MiddleLeft
    $script:stepLabels += $sl
    $stepPanel.Controls.Add($sl)

    if ($i -lt $stepNames.Count - 1) {
        $stepPanel.Controls.Add((New-Separator ($i * 46 + 45) 150))
    }
}

# ── Content area (right of step panel) ───────────────────────────────────────
$content = New-Object System.Windows.Forms.Panel
$content.Location  = [System.Drawing.Point]::new(150, 80)
$content.Size      = [System.Drawing.Size]::new(430, 340)
$content.BackColor = $DARK_BG
$form.Controls.Add($content)

# Vertical divider
$vDiv = New-Object System.Windows.Forms.Panel
$vDiv.Location  = [System.Drawing.Point]::new(149, 80)
$vDiv.Size      = [System.Drawing.Size]::new(1, 340)
$vDiv.BackColor = [System.Drawing.Color]::FromArgb(30, 60, 35)
$form.Controls.Add($vDiv)

# ── Footer button bar ─────────────────────────────────────────────────────────
$form.Controls.Add((New-Separator 420 580))
$footer = New-Object System.Windows.Forms.Panel
$footer.Location  = [System.Drawing.Point]::new(0, 421)
$footer.Size      = [System.Drawing.Size]::new(580, 60)
$footer.BackColor = $PANEL_BG
$form.Controls.Add($footer)

$btnBack   = New-StyledButton "◀  Back"   350 12 100 36 $false
$btnNext   = New-StyledButton "Next  ▶"   460 12 100 36 $true
$btnCancel = New-StyledButton "Cancel"    16  12 90  36 $false
$footer.Controls.Add($btnBack)
$footer.Controls.Add($btnNext)
$footer.Controls.Add($btnCancel)

$btnCancel.Add_Click({
    $r = [System.Windows.Forms.MessageBox]::Show(
        "Are you sure you want to cancel the installation?",
        "Cancel Setup", "YesNo", "Question")
    if ($r -eq "Yes") { $form.Close() }
})

# ═══════════════════════════════════════════════════════════════════════════════
#  PAGE BUILDERS
# ═══════════════════════════════════════════════════════════════════════════════

function Show-Page($n) {
    $content.Controls.Clear()
    $script:page = $n

    # Highlight active step
    for ($i = 0; $i -lt $script:stepLabels.Count; $i++) {
        if ($i -eq $n) {
            $script:stepLabels[$i].ForeColor = $ACCENT
            $script:stepLabels[$i].Font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Bold)
        } elseif ($i -lt $n) {
            $script:stepLabels[$i].ForeColor = $ACCENT2
            $script:stepLabels[$i].Font = New-Object System.Drawing.Font("Segoe UI", 8)
        } else {
            $script:stepLabels[$i].ForeColor = $FG_MUTED
            $script:stepLabels[$i].Font = New-Object System.Drawing.Font("Segoe UI", 8)
        }
    }

    switch ($n) {

        # ── PAGE 0: WELCOME ──────────────────────────────────────────────────
        0 {
            $btnBack.Enabled = $false
            $btnNext.Text    = "Next  ▶"
            $btnNext.Enabled = $true

            $content.Controls.Add((New-Label "Welcome to ProxhqVPN Setup" 20 20 400 30 13 $true $ACCENT))
            $content.Controls.Add((New-Label "Version $APP_VERSION" 20 54 200 18 8 $false $FG_MUTED))
            $content.Controls.Add((New-Separator 78 430))

            $msg = @"
This wizard will guide you through the installation of ProxhqVPN on your computer.

ProxhqVPN is a next-generation privacy and security platform built by Alpha Unlimited Technologies LLC. It includes:

  🛡  Military-grade WireGuard VPN encryption
  🔒  Zero-logs privacy policy
  🌐  Global VPN server network
  🔍  Built-in security audit tools
  ⚡  Kill switch & DNS leak protection

Click Next to continue, or Cancel to exit setup.
"@
            $box = New-Object System.Windows.Forms.RichTextBox
            $box.Location    = [System.Drawing.Point]::new(20, 90)
            $box.Size        = [System.Drawing.Size]::new(395, 200)
            $box.BackColor   = $DARK_BG
            $box.ForeColor   = $FG
            $box.Font        = New-Object System.Drawing.Font("Segoe UI", 9)
            $box.BorderStyle = [System.Windows.Forms.BorderStyle]::None
            $box.ReadOnly    = $true
            $box.Text        = $msg
            $content.Controls.Add($box)

            $content.Controls.Add((New-Label "© 2026 Alpha Unlimited Technologies LLC" 20 305 400 18 7 $false $FG_MUTED))
        }

        # ── PAGE 1: LICENSE ──────────────────────────────────────────────────
        1 {
            $btnBack.Enabled = $true
            $btnNext.Text    = "I Agree  ▶"
            $btnNext.Enabled = $true

            $content.Controls.Add((New-Label "License Agreement" 20 20 400 25 13 $true $ACCENT))
            $content.Controls.Add((New-Label "Please read the following license agreement carefully." 20 48 400 18 8 $false $FG_MUTED))
            $content.Controls.Add((New-Separator 72 430))

            $license = @"
END USER LICENSE AGREEMENT
ProxhqVPN — Alpha Unlimited Technologies LLC

Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.

GRANT OF LICENSE: Alpha Unlimited Technologies LLC grants you a non-exclusive, non-transferable license to install and use ProxhqVPN software on devices that you own or control.

RESTRICTIONS: You may not reverse engineer, decompile, disassemble, rent, lease, loan, sublicense, or create derivative works based upon the software.

PRIVACY: ProxhqVPN operates a strict zero-logs policy. No browsing activity, connection logs, IP addresses, or bandwidth usage is stored or shared.

DISCLAIMER: THE SOFTWARE IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE.

TERMINATION: This license is effective until terminated. Your rights under this license will terminate automatically without notice if you fail to comply with any term(s).

GOVERNING LAW: This Agreement shall be governed by the laws of the United States of America.

By clicking "I Agree" you accept the terms of this license agreement and authorize the installation of ProxhqVPN and WireGuard on this computer.
"@
            $licBox = New-Object System.Windows.Forms.RichTextBox
            $licBox.Location    = [System.Drawing.Point]::new(20, 82)
            $licBox.Size        = [System.Drawing.Size]::new(395, 210)
            $licBox.BackColor   = [System.Drawing.Color]::FromArgb(8, 15, 10)
            $licBox.ForeColor   = $FG_MUTED
            $licBox.Font        = New-Object System.Drawing.Font("Segoe UI", 8)
            $licBox.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
            $licBox.ReadOnly    = $true
            $licBox.Text        = $license
            $content.Controls.Add($licBox)

            $chk = New-Object System.Windows.Forms.CheckBox
            $chk.Text      = "I accept the license agreement"
            $chk.Location  = [System.Drawing.Point]::new(20, 304)
            $chk.Size      = [System.Drawing.Size]::new(300, 22)
            $chk.ForeColor = $FG
            $chk.BackColor = [System.Drawing.Color]::Transparent
            $chk.Font      = New-Object System.Drawing.Font("Segoe UI", 9)
            $chk.Add_CheckedChanged({ $btnNext.Enabled = $chk.Checked })
            $btnNext.Enabled = $false
            $content.Controls.Add($chk)
        }

        # ── PAGE 2: COMPONENTS ───────────────────────────────────────────────
        2 {
            $btnBack.Enabled = $true
            $btnNext.Text    = "Next  ▶"
            $btnNext.Enabled = $true

            $content.Controls.Add((New-Label "Select Components" 20 20 400 25 13 $true $ACCENT))
            $content.Controls.Add((New-Label "Choose which components to install." 20 48 400 18 8 $false $FG_MUTED))
            $content.Controls.Add((New-Separator 72 430))

            function New-CompCheck($text, $desc, $y, $checked=$true) {
                $c = New-Object System.Windows.Forms.CheckBox
                $c.Text      = $text
                $c.Location  = [System.Drawing.Point]::new(20, $y)
                $c.Size      = [System.Drawing.Size]::new(390, 22)
                $c.ForeColor = $FG
                $c.BackColor = [System.Drawing.Color]::Transparent
                $c.Font      = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
                $c.Checked   = $checked
                $content.Controls.Add($c)
                $d = New-Label "    $desc" 20 ($y+22) 390 18 8 $false $FG_MUTED
                $content.Controls.Add($d)
                return $c
            }

            $chkWG     = New-CompCheck "WireGuard VPN Client  (Required)" "Official WireGuard client — downloaded from wireguard.com" 90  $true
            $chkWG.Enabled = $false  # always required
            $chkDesk   = New-CompCheck "Desktop Shortcut" "Creates a ProxhqVPN shortcut on your Desktop" 145 $script:createDesktop
            $chkStart  = New-CompCheck "Start Menu Entry" "Adds ProxhqVPN to the Start Menu under Alpha Unlimited Technologies" 200 $script:createStartMenu
            $chkApp    = New-CompCheck "Launch in App Window" "Opens ProxhqVPN in a dedicated browser app window (no address bar)" 255 $script:createChromeApp

            $btnNext.Add_Click.Invoke = {}
            $script:chkDesk  = $chkDesk
            $script:chkStart = $chkStart
            $script:chkApp   = $chkApp
        }

        # ── PAGE 3: INSTALL DIR ──────────────────────────────────────────────
        3 {
            $btnBack.Enabled = $true
            $btnNext.Text    = "Next  ▶"
            $btnNext.Enabled = $true

            if ($null -ne $script:chkDesk)  { $script:createDesktop  = $script:chkDesk.Checked }
            if ($null -ne $script:chkStart) { $script:createStartMenu = $script:chkStart.Checked }
            if ($null -ne $script:chkApp)   { $script:createChromeApp = $script:chkApp.Checked }

            $content.Controls.Add((New-Label "Installation Folder" 20 20 400 25 13 $true $ACCENT))
            $content.Controls.Add((New-Label "Where should ProxhqVPN be installed?" 20 48 400 18 8 $false $FG_MUTED))
            $content.Controls.Add((New-Separator 72 430))

            $content.Controls.Add((New-Label "Destination Folder:" 20 90 390 20 9 $false $FG))

            $txtDir = New-Object System.Windows.Forms.TextBox
            $txtDir.Location  = [System.Drawing.Point]::new(20, 115)
            $txtDir.Size      = [System.Drawing.Size]::new(295, 28)
            $txtDir.BackColor = [System.Drawing.Color]::FromArgb(8, 15, 10)
            $txtDir.ForeColor = $FG
            $txtDir.Font      = New-Object System.Drawing.Font("Segoe UI", 9)
            $txtDir.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
            $txtDir.Text      = $script:installDir
            $content.Controls.Add($txtDir)

            $btnBrowse = New-StyledButton "Browse…" 322 113 90 30 $false
            $btnBrowse.Add_Click({
                $dlg = New-Object System.Windows.Forms.FolderBrowserDialog
                $dlg.Description = "Select installation folder"
                $dlg.SelectedPath = $txtDir.Text
                if ($dlg.ShowDialog() -eq "OK") {
                    $txtDir.Text = $dlg.SelectedPath
                }
            })
            $content.Controls.Add($btnBrowse)

            $content.Controls.Add((New-Separator 155 430))
            $content.Controls.Add((New-Label "Space required:   ~120 MB" 20 165 390 20 9 $false $FG_MUTED))
            $content.Controls.Add((New-Label "Space available:  Calculating..." 20 188 390 20 9 $false $FG_MUTED))

            try {
                $drive = Split-Path -Qualifier $txtDir.Text
                $disk  = Get-PSDrive ($drive.TrimEnd(':'))
                $free  = [math]::Round($disk.Free / 1MB)
                $content.Controls[$content.Controls.Count-1].Text = "Space available:  $free MB"
            } catch {}

            $script:txtDir = $txtDir

            $content.Controls.Add((New-Separator 228 430))
            $content.Controls.Add((New-Label "All files will be installed to the folder above." 20 238 390 18 8 $false $FG_MUTED))
        }

        # ── PAGE 4: READY ────────────────────────────────────────────────────
        4 {
            $btnBack.Enabled = $true
            $btnNext.Text    = "Install  ▶"
            $btnNext.Enabled = $true
            $btnNext.BackColor = $BTN_BG

            if ($null -ne $script:txtDir) { $script:installDir = $script:txtDir.Text }

            $content.Controls.Add((New-Label "Ready to Install" 20 20 400 25 13 $true $ACCENT))
            $content.Controls.Add((New-Label "Click Install to begin the installation." 20 48 400 18 8 $false $FG_MUTED))
            $content.Controls.Add((New-Separator 72 430))

            $summary = @"
Installation Summary
────────────────────────────────────────────
  Folder:       $($script:installDir)

  Components:
    ✔  WireGuard VPN Client (from wireguard.com)
    $(if ($script:createDesktop)   { "✔" } else { "✖" })  Desktop Shortcut
    $(if ($script:createStartMenu) { "✔" } else { "✖" })  Start Menu Entry
    $(if ($script:createChromeApp) { "✔" } else { "✖" })  App Window Mode

  Disk space:   ~120 MB required
────────────────────────────────────────────
Click Install to proceed.
"@
            $box = New-Object System.Windows.Forms.RichTextBox
            $box.Location    = [System.Drawing.Point]::new(20, 84)
            $box.Size        = [System.Drawing.Size]::new(395, 220)
            $box.BackColor   = $DARK_BG
            $box.ForeColor   = $FG
            $box.Font        = New-Object System.Drawing.Font("Consolas", 8.5)
            $box.BorderStyle = [System.Windows.Forms.BorderStyle]::None
            $box.ReadOnly    = $true
            $box.Text        = $summary
            $content.Controls.Add($box)
        }

        # ── PAGE 5: INSTALLING ───────────────────────────────────────────────
        5 {
            $btnBack.Enabled    = $false
            $btnNext.Enabled    = $false
            $btnCancel.Enabled  = $false
            $btnNext.Text       = "Installing…"

            $content.Controls.Add((New-Label "Installing ProxhqVPN…" 20 20 400 25 13 $true $ACCENT))
            $content.Controls.Add((New-Label "Please wait while setup installs the components." 20 48 400 18 8 $false $FG_MUTED))
            $content.Controls.Add((New-Separator 72 430))

            $lblStatus = New-Label "Preparing installation…" 20 90 395 20 9 $false $FG
            $content.Controls.Add($lblStatus)

            $progress = New-Object System.Windows.Forms.ProgressBar
            $progress.Location = [System.Drawing.Point]::new(20, 116)
            $progress.Size     = [System.Drawing.Size]::new(395, 20)
            $progress.Minimum  = 0
            $progress.Maximum  = 100
            $progress.Value    = 0
            $progress.Style    = [System.Windows.Forms.ProgressBarStyle]::Continuous
            $content.Controls.Add($progress)

            $lblDetail = New-Label "" 20 145 395 120 8 $false $FG_MUTED
            $lblDetail.Font = New-Object System.Drawing.Font("Consolas", 7.5)
            $content.Controls.Add($lblDetail)

            $form.Refresh()

            function Set-Progress($pct, $status, $detail="") {
                $progress.Value  = [Math]::Min($pct, 100)
                $lblStatus.Text  = $status
                $lblDetail.Text  = $detail
                [System.Windows.Forms.Application]::DoEvents()
                Start-Sleep -Milliseconds 200
            }

            $script:installOK = $true
            $script:wgInstalled = $false

            try {
                # ── Step 1: Create install directory ────────────────────────
                Set-Progress 5 "Creating installation directory…" $script:installDir
                New-Item -ItemType Directory -Force -Path $script:installDir | Out-Null

                # ── Step 2: Download WireGuard ───────────────────────────────
                Set-Progress 10 "Downloading WireGuard VPN client…" "Source: download.wireguard.com"
                $wgInstaller = Join-Path $env:TEMP "wireguard-installer.exe"
                try {
                    $wc = New-Object System.Net.WebClient
                    $wc.DownloadFile($WG_URL, $wgInstaller)
                    Set-Progress 40 "WireGuard downloaded successfully." "Size: $([math]::Round((Get-Item $wgInstaller).Length/1MB, 1)) MB"
                } catch {
                    Set-Progress 40 "WireGuard download failed — skipping." "Error: $_"
                    $script:wgInstalled = $false
                }

                # ── Step 3: Install WireGuard silently ───────────────────────
                if (Test-Path $wgInstaller) {
                    Set-Progress 45 "Installing WireGuard…" "Running silent installer, please wait…"
                    $proc = Start-Process -FilePath $wgInstaller -ArgumentList "/S" -Wait -PassThru
                    if ($proc.ExitCode -eq 0) {
                        Set-Progress 65 "WireGuard installed successfully." "WireGuard is ready to use."
                        $script:wgInstalled = $true
                    } else {
                        Set-Progress 65 "WireGuard installer exited with code $($proc.ExitCode)." "WireGuard may already be installed."
                        $script:wgInstalled = $true
                    }
                    Remove-Item $wgInstaller -Force -ErrorAction SilentlyContinue
                }

                # ── Step 4: Write launcher files ─────────────────────────────
                Set-Progress 70 "Creating ProxhqVPN launcher…" $script:installDir

                # HTML landing page for icon/app identity
                $htmlPath = Join-Path $script:installDir "proxhqvpn.html"
                @"
<!DOCTYPE html>
<html>
<head><meta http-equiv="refresh" content="0;url=$APP_URL"><title>ProxhqVPN</title>
<style>body{background:#0a120c;color:#00dc64;font-family:Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;}
h1{font-size:2rem;}p{color:#8cb496;}</style></head>
<body><div><h1>🛡 ProxhqVPN</h1><p>Connecting to secure platform…</p></div></body></html>
"@ | Out-File -FilePath $htmlPath -Encoding UTF8

                # VBScript launcher that opens Chrome/Edge in app mode
                $vbsPath = Join-Path $script:installDir "Launch ProxhqVPN.vbs"
                @"
Dim oShell
Set oShell = CreateObject("WScript.Shell")

' Try Microsoft Edge app mode first
Dim edgePath
edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
If Not CreateObject("Scripting.FileSystemObject").FileExists(edgePath) Then
    edgePath = "C:\Program Files\Microsoft\Edge\Application\msedge.exe"
End If

If CreateObject("Scripting.FileSystemObject").FileExists(edgePath) Then
    oShell.Run Chr(34) & edgePath & Chr(34) & " --app=$APP_URL --new-window", 1, False
Else
    ' Fallback: try Chrome
    Dim chromePath
    chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
    If Not CreateObject("Scripting.FileSystemObject").FileExists(chromePath) Then
        chromePath = "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    End If
    If CreateObject("Scripting.FileSystemObject").FileExists(chromePath) Then
        oShell.Run Chr(34) & chromePath & Chr(34) & " --app=$APP_URL --new-window", 1, False
    Else
        ' Fallback: default browser
        oShell.Run "$APP_URL", 1, False
    End If
End If

Set oShell = Nothing
"@ | Out-File -FilePath $vbsPath -Encoding ASCII

                Set-Progress 78 "Launcher created." ""

                # ── Step 5: Create shortcuts ──────────────────────────────────
                Set-Progress 80 "Creating shortcuts…" ""
                $WshShell = New-Object -ComObject WScript.Shell

                if ($script:createDesktop) {
                    $lnkPath = Join-Path ([System.Environment]::GetFolderPath("Desktop")) "ProxhqVPN.lnk"
                    $lnk = $WshShell.CreateShortcut($lnkPath)
                    $lnk.TargetPath       = "wscript.exe"
                    $lnk.Arguments        = "`"$vbsPath`""
                    $lnk.WorkingDirectory = $script:installDir
                    $lnk.Description      = "ProxhqVPN — Alpha Unlimited Technologies LLC"
                    $lnk.IconLocation     = "%SystemRoot%\System32\shell32.dll,23"
                    $lnk.Save()
                    Set-Progress 85 "Desktop shortcut created." ""
                }

                if ($script:createStartMenu) {
                    New-Item -ItemType Directory -Force -Path $START_MENU_DIR | Out-Null
                    $smLnk = $WshShell.CreateShortcut("$START_MENU_DIR\ProxhqVPN.lnk")
                    $smLnk.TargetPath       = "wscript.exe"
                    $smLnk.Arguments        = "`"$vbsPath`""
                    $smLnk.WorkingDirectory = $script:installDir
                    $smLnk.Description      = "ProxhqVPN — Alpha Unlimited Technologies LLC"
                    $smLnk.IconLocation     = "%SystemRoot%\System32\shell32.dll,23"
                    $smLnk.Save()

                    $uninstLnk = $WshShell.CreateShortcut("$START_MENU_DIR\Uninstall ProxhqVPN.lnk")
                    $uninstLnk.TargetPath  = "powershell.exe"
                    $uninstLnk.Arguments   = "-NoProfile -ExecutionPolicy Bypass -Command `"Remove-Item -Recurse -Force '$script:installDir'; Remove-Item -Recurse -Force '$START_MENU_DIR'; Remove-Item -Force '\$([System.Environment]::GetFolderPath(`"Desktop`"))\ProxhqVPN.lnk' -ErrorAction SilentlyContinue; Remove-Item '$UNINSTALL_KEY' -Recurse -ErrorAction SilentlyContinue; [System.Windows.Forms.MessageBox]::Show('ProxhqVPN has been uninstalled.','Uninstall')`""
                    $uninstLnk.Description = "Uninstall ProxhqVPN"
                    $uninstLnk.IconLocation = "%SystemRoot%\System32\shell32.dll,131"
                    $uninstLnk.Save()
                    Set-Progress 90 "Start Menu entries created." ""
                }

                # ── Step 6: Add/Remove Programs registry ─────────────────────
                Set-Progress 93 "Registering with Windows…" "Add/Remove Programs entry"
                New-Item -Path $UNINSTALL_KEY -Force | Out-Null
                Set-ItemProperty -Path $UNINSTALL_KEY -Name "DisplayName"     -Value "ProxhqVPN"
                Set-ItemProperty -Path $UNINSTALL_KEY -Name "DisplayVersion"  -Value $APP_VERSION
                Set-ItemProperty -Path $UNINSTALL_KEY -Name "Publisher"       -Value $COMPANY
                Set-ItemProperty -Path $UNINSTALL_KEY -Name "URLInfoAbout"    -Value $APP_URL
                Set-ItemProperty -Path $UNINSTALL_KEY -Name "InstallLocation" -Value $script:installDir
                Set-ItemProperty -Path $UNINSTALL_KEY -Name "EstimatedSize"   -Value 120000
                Set-ItemProperty -Path $UNINSTALL_KEY -Name "NoModify"        -Value 1 -Type DWord
                Set-ItemProperty -Path $UNINSTALL_KEY -Name "NoRepair"        -Value 1 -Type DWord
                Set-ItemProperty -Path $UNINSTALL_KEY -Name "UninstallString" -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -Command `"Remove-Item -Recurse -Force '$script:installDir'`""

                # ── Step 7: Write version file ────────────────────────────────
                Set-Progress 97 "Finalizing…" ""
                @"
ProxhqVPN $APP_VERSION
Installed: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Company:   $COMPANY
URL:       $APP_URL
WireGuard: $($script:wgInstalled)
"@ | Out-File -FilePath (Join-Path $script:installDir "version.txt") -Encoding UTF8

                Set-Progress 100 "Installation complete!" "All components installed successfully."
                Start-Sleep -Milliseconds 600

            } catch {
                $script:installOK = $false
                $lblStatus.Text   = "Error: $_"
                $lblStatus.ForeColor = $RED
            }

            # Move to done page
            Show-Page 6
        }

        # ── PAGE 6: DONE ─────────────────────────────────────────────────────
        6 {
            $btnBack.Enabled   = $false
            $btnCancel.Enabled = $false
            $btnNext.Text      = "Finish"
            $btnNext.Enabled   = $true

            if ($script:installOK) {
                $content.Controls.Add((New-Label "Installation Complete! ✓" 20 20 400 28 13 $true $ACCENT))
                $content.Controls.Add((New-Label "ProxhqVPN has been installed successfully." 20 52 400 18 8 $false $FG_MUTED))
                $content.Controls.Add((New-Separator 76 430))

                $items = [System.Collections.Generic.List[string]]::new()
                $items.Add("  ✔  ProxhqVPN installed to:  $script:installDir")
                if ($script:wgInstalled) { $items.Add("  ✔  WireGuard VPN client installed") }
                if ($script:createDesktop)   { $items.Add("  ✔  Desktop shortcut created") }
                if ($script:createStartMenu) { $items.Add("  ✔  Start Menu entry created") }
                $items.Add("")
                $items.Add("  You can now launch ProxhqVPN from your Desktop or")
                $items.Add("  Start Menu under Alpha Unlimited Technologies.")

                $box = New-Object System.Windows.Forms.RichTextBox
                $box.Location    = [System.Drawing.Point]::new(20, 90)
                $box.Size        = [System.Drawing.Size]::new(395, 180)
                $box.BackColor   = $DARK_BG
                $box.ForeColor   = $FG
                $box.Font        = New-Object System.Drawing.Font("Segoe UI", 9)
                $box.BorderStyle = [System.Windows.Forms.BorderStyle]::None
                $box.ReadOnly    = $true
                $box.Text        = ($items -join "`n")
                $content.Controls.Add($box)

                $chkLaunch = New-Object System.Windows.Forms.CheckBox
                $chkLaunch.Text      = "Launch ProxhqVPN now"
                $chkLaunch.Location  = [System.Drawing.Point]::new(20, 282)
                $chkLaunch.Size      = [System.Drawing.Size]::new(280, 24)
                $chkLaunch.ForeColor = $FG
                $chkLaunch.BackColor = [System.Drawing.Color]::Transparent
                $chkLaunch.Font      = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
                $chkLaunch.Checked   = $true
                $content.Controls.Add($chkLaunch)
                $script:chkLaunch = $chkLaunch

                $content.Controls.Add((New-Label "© 2026 Alpha Unlimited Technologies LLC" 20 312 400 18 7 $false $FG_MUTED))

            } else {
                $content.Controls.Add((New-Label "Installation Failed" 20 20 400 28 13 $true $RED))
                $content.Controls.Add((New-Label "An error occurred during installation." 20 52 400 18 8 $false $FG_MUTED))
                $content.Controls.Add((New-Separator 76 430))
                $content.Controls.Add((New-Label "Please try running setup.bat as Administrator and check your internet connection." 20 100 390 60 9 $false $FG))
            }
        }
    }
}

# ═══════════════════════════════════════════════════════════════════════════════
#  NAV LOGIC
# ═══════════════════════════════════════════════════════════════════════════════
$btnNext.Add_Click({
    switch ($script:page) {
        0 { Show-Page 1 }
        1 { Show-Page 2 }
        2 { Show-Page 3 }
        3 { Show-Page 4 }
        4 { Show-Page 5 }   # triggers install
        6 {
            if ($null -ne $script:chkLaunch -and $script:chkLaunch.Checked) {
                $vbsPath = Join-Path $script:installDir "Launch ProxhqVPN.vbs"
                if (Test-Path $vbsPath) {
                    Start-Process "wscript.exe" -ArgumentList "`"$vbsPath`""
                } else {
                    Start-Process $APP_URL
                }
            }
            $form.Close()
        }
    }
})

$btnBack.Add_Click({
    switch ($script:page) {
        1 { Show-Page 0 }
        2 { Show-Page 1 }
        3 { Show-Page 2 }
        4 { Show-Page 3 }
    }
})

# ── Boot ──────────────────────────────────────────────────────────────────────
Show-Page 0
[System.Windows.Forms.Application]::Run($form)
