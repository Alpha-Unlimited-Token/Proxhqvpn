# ProxhqVPN Windows Installer — PowerShell GUI Wizard
# © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
# Launch via: Launch-ProxhqVPN-Setup.vbs  (hides console window)

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$BRAND     = "ProxhqVPN"
$PUBLISHER = "ALPHA UNLIMITED TECHNOLOGIES LLC"
$URL       = "https://proxhqvpn.com"
$WG_URL    = "https://download.wireguard.com/windows-client/wireguard-installer.exe"
$INSTALL   = "$env:LOCALAPPDATA\ProxhqVPN"

$BG      = [Drawing.Color]::FromArgb(8,  13,  9)
$HDR_BG  = [Drawing.Color]::FromArgb(13, 20, 14)
$GREEN   = [Drawing.Color]::FromArgb(0, 255, 136)
$GREEN_D = [Drawing.Color]::FromArgb(0, 180, 100)
$WHITE   = [Drawing.Color]::White
$GRAY    = [Drawing.Color]::FromArgb(60, 70, 62)
$DIM     = [Drawing.Color]::FromArgb(180, 180, 180)
$BTN_BG  = [Drawing.Color]::FromArgb(25, 35, 27)

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
    $b.BackColor = if ($primary) { $GREEN } else { $BTN_BG }
    $b.ForeColor = if ($primary) { [Drawing.Color]::Black } else { $WHITE }
    $b.Font = New-Object Drawing.Font("Segoe UI", 10, [Drawing.FontStyle]::Bold)
    $b.Cursor = [Windows.Forms.Cursors]::Hand
    return $b
}

function make-form($headerTitle) {
    $f = New-Object Windows.Forms.Form
    $f.Text = "ProxhqVPN Setup"; $f.Size = New-Object Drawing.Size(560, 430)
    $f.StartPosition = "CenterScreen"; $f.BackColor = $BG
    $f.FormBorderStyle = "FixedDialog"; $f.MaximizeBox = $false; $f.MinimizeBox = $false

    $hdr = New-Object Windows.Forms.Panel
    $hdr.Dock = "Top"; $hdr.Height = 72; $hdr.BackColor = $HDR_BG
    $hdr.Controls.Add((lbl $headerTitle 20 12 480 32 14 $true $GREEN))
    $hdr.Controls.Add((lbl "ALPHA UNLIMITED TECHNOLOGIES LLC" 20 46 400 20 8 $false $GREEN_D))

    $sep = New-Object Windows.Forms.Panel
    $sep.Top = 72; $sep.Height = 1; $sep.Width = 560; $sep.BackColor = $GRAY

    $f.Controls.Add($hdr); $f.Controls.Add($sep)
    return $f
}

# ─── PAGE 1: WELCOME ─────────────────────────────────────────────────────────
$f1 = make-form "Welcome to ProxhqVPN Setup"
$f1.Controls.Add((lbl "This wizard will install ProxhqVPN on your computer." 30 90 490 22))
$feats = @(
    "Military-grade WireGuard encryption",
    "Zero-logs privacy — no activity logging ever",
    "Instant kill switch protection",
    "Double-hop anonymity routing",
    "Command Center developer & security toolkit"
)
$fy = 122
foreach ($feat in $feats) {
    $f1.Controls.Add((lbl "●" 30 $fy 18 20 9 $false $GREEN))
    $f1.Controls.Add((lbl $feat 52 $fy 420 20 10 $false $DIM))
    $fy += 26
}
$f1.Controls.Add((lbl "Click Next to continue." 30 305 490 20 10 $false $DIM))
$b1Next   = btn "Next  >"  420 350 90 36 $true
$b1Cancel = btn "Cancel"   295 350
$f1.Controls.AddRange(@($b1Next, $b1Cancel))
$Script:p1ok = $false
$b1Next.Add_Click({   $Script:p1ok = $true;  $f1.Close() })
$b1Cancel.Add_Click({ $Script:p1ok = $false; $f1.Close() })
$f1.ShowDialog() | Out-Null
if (-not $Script:p1ok) { exit }

# ─── PAGE 2: LICENSE ──────────────────────────────────────────────────────────
$f2 = make-form "License Agreement"
$f2.Controls.Add((lbl "Please read and accept the agreement to continue." 30 88 490 22))
$lic = New-Object Windows.Forms.RichTextBox
$lic.Left = 30; $lic.Top = 113; $lic.Width = 492; $lic.Height = 175
$lic.BackColor = [Drawing.Color]::FromArgb(13, 20, 14)
$lic.ForeColor = $DIM; $lic.Font = New-Object Drawing.Font("Consolas", 8.5)
$lic.BorderStyle = "FixedSingle"; $lic.ReadOnly = $true; $lic.ScrollBars = "Vertical"
$lic.Text = @"
PROXHQVPN END USER LICENSE AGREEMENT
Copyright (c) 2026 ALPHA UNLIMITED TECHNOLOGIES LLC. All rights reserved.

By installing or using ProxhqVPN, you agree to the following terms:

1. LICENSE GRANT
   ALPHA UNLIMITED TECHNOLOGIES LLC grants you a limited, non-exclusive,
   non-transferable license to install and use ProxhqVPN on devices you own.

2. THIRD-PARTY SOFTWARE CONSENT
   ProxhqVPN requires WireGuard (open-source, GPLv2). By proceeding you
   authorize its installation. WireGuard is by Jason A. Donenfeld.

3. PRIVACY - ZERO LOGS
   ALPHA UNLIMITED TECHNOLOGIES LLC does not log, store, or monitor your
   VPN traffic, browsing activity, or connection timestamps.

4. LIMITATION OF LIABILITY
   To the maximum extent permitted by law, ALPHA UNLIMITED TECHNOLOGIES LLC
   shall not be liable for indirect, incidental, or consequential damages.

5. GOVERNING LAW
   Governed by the laws of the jurisdiction in which ALPHA UNLIMITED
   TECHNOLOGIES LLC is registered.

WireGuard(R) is a registered trademark of Jason A. Donenfeld.
"@
$f2.Controls.Add($lic)
$chk2 = New-Object Windows.Forms.CheckBox
$chk2.Left = 30; $chk2.Top = 298; $chk2.Width = 430; $chk2.Height = 24
$chk2.Text = "I accept the terms of the license agreement"
$chk2.ForeColor = $WHITE; $chk2.BackColor = [Drawing.Color]::Transparent
$chk2.Font = New-Object Drawing.Font("Segoe UI", 10)
$f2.Controls.Add($chk2)
$b2Next   = btn "Next  >" 420 350 90 36 $true
$b2Back   = btn "< Back"  295 350
$b2Next.Enabled = $false
$f2.Controls.AddRange(@($b2Next, $b2Back))
$chk2.Add_CheckedChanged({ $b2Next.Enabled = $chk2.Checked })
$Script:p2ok = $false
$b2Next.Add_Click({   $Script:p2ok = $true;  $f2.Close() })
$b2Back.Add_Click({   $Script:p2ok = $false; $f2.Close() })
$f2.ShowDialog() | Out-Null
if (-not $Script:p2ok) { exit }

# ─── PAGE 3: INSTALLING ───────────────────────────────────────────────────────
$f3 = make-form "Installing ProxhqVPN"
$f3.Controls.Add((lbl "Please wait while ProxhqVPN is installed on your computer." 30 88 490 22))
$prog = New-Object Windows.Forms.ProgressBar
$prog.Left = 30; $prog.Top = 120; $prog.Width = 492; $prog.Height = 22
$prog.Style = "Continuous"
$f3.Controls.Add($prog)
$statLbl = lbl "Preparing..." 30 150 490 22 10 $false $DIM
$f3.Controls.Add($statLbl)
$f3.Show(); $f3.Refresh()

$steps = @(
    @{ t = "Creating program folder...";        p = 15; a = { New-Item -ItemType Directory -Force -Path $INSTALL | Out-Null }},
    @{ t = "Writing launcher file...";           p = 35; a = {
        "@echo off`r`nstart `"`" `"$URL`"`r`n" | Out-File -FilePath "$INSTALL\ProxhqVPN.bat" -Encoding ASCII
    }},
    @{ t = "Creating desktop shortcut...";       p = 55; a = {
        $ws = New-Object -ComObject WScript.Shell
        $sc = $ws.CreateShortcut("$env:USERPROFILE\Desktop\ProxhqVPN.lnk")
        $sc.TargetPath = "$INSTALL\ProxhqVPN.bat"; $sc.Description = "Open ProxhqVPN"; $sc.Save()
    }},
    @{ t = "Adding to Start Menu...";            p = 72; a = {
        $sm = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\ProxhqVPN"
        New-Item -ItemType Directory -Force -Path $sm | Out-Null
        $ws = New-Object -ComObject WScript.Shell
        $sc = $ws.CreateShortcut("$sm\ProxhqVPN.lnk")
        $sc.TargetPath = "$INSTALL\ProxhqVPN.bat"; $sc.Save()
    }},
    @{ t = "Registering with Windows...";        p = 88; a = {
        $reg = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ProxhqVPN"
        New-Item -Path $reg -Force | Out-Null
        Set-ItemProperty $reg "DisplayName"    "ProxhqVPN"
        Set-ItemProperty $reg "DisplayVersion" "1.0.0"
        Set-ItemProperty $reg "Publisher"      $PUBLISHER
        Set-ItemProperty $reg "URLInfoAbout"   $URL
        Set-ItemProperty $reg "UninstallString" "$INSTALL\ProxhqVPN-Uninstall.bat"
    }},
    @{ t = "Finalizing installation...";         p = 100; a = {
        "@echo off`r`nrmdir /s /q `"$INSTALL`"`r`nreg delete HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\ProxhqVPN /f`r`ndel `"$env:USERPROFILE\Desktop\ProxhqVPN.lnk`" 2>nul`r`n" | Out-File -FilePath "$INSTALL\ProxhqVPN-Uninstall.bat" -Encoding ASCII
    }}
)
foreach ($s in $steps) {
    $statLbl.Text = $s.t; $prog.Value = $s.p; $f3.Refresh()
    Start-Sleep -Milliseconds 500
    & $s.a
}
Start-Sleep -Milliseconds 300
$f3.Close()

# ─── WIREGUARD PROMPT ─────────────────────────────────────────────────────────
$wgResp = [Windows.Forms.MessageBox]::Show(
    "WireGuard is required for ProxhqVPN encrypted connections.`n`nClick Yes to download and install WireGuard now (free, from wireguard.com).",
    "Install WireGuard", "YesNo", "Question")
if ($wgResp -eq "Yes") {
    Start-Process $WG_URL
    [Windows.Forms.MessageBox]::Show(
        "WireGuard is downloading. Run the installer when it finishes, then open ProxhqVPN from your desktop.",
        "WireGuard", "OK", "Information") | Out-Null
}

# ─── PAGE 4: FINISH ───────────────────────────────────────────────────────────
$f4 = make-form "Installation Complete"
$f4.Controls.Add((lbl "✓" 28 90 54 54 30 $true $GREEN))
$f4.Controls.Add((lbl "ProxhqVPN installed successfully!" 88 94 420 30 14 $true $WHITE))
$f4.Controls.Add((lbl "A desktop shortcut and Start Menu entry have been created." 88 130 420 22 10 $false $DIM))
$f4.Controls.Add((lbl "Sign in at proxhqvpn.com to download your WireGuard config and connect." 88 153 420 22 10 $false $DIM))

$chkLaunch = New-Object Windows.Forms.CheckBox
$chkLaunch.Left = 30; $chkLaunch.Top = 210; $chkLaunch.Width = 350; $chkLaunch.Height = 24
$chkLaunch.Text = "Launch ProxhqVPN now"; $chkLaunch.Checked = $true
$chkLaunch.ForeColor = $WHITE; $chkLaunch.BackColor = [Drawing.Color]::Transparent
$chkLaunch.Font = New-Object Drawing.Font("Segoe UI", 10)
$f4.Controls.Add($chkLaunch)

$b4Finish = btn "Finish" 420 350 90 36 $true
$f4.Controls.Add($b4Finish)
$b4Finish.Add_Click({ $f4.Close() })
$f4.ShowDialog() | Out-Null
if ($chkLaunch.Checked) { Start-Process $URL }
