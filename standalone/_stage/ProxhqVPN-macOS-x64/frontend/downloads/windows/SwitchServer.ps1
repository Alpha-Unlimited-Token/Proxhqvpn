# ProxhqVPN — Server Switcher
# © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
# Run this script to switch between VPN servers at any time.
# Requires WireGuard to be installed and ProxhqVPN tunnels to be set up.

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $a = '-ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $MyInvocation.MyCommand.Path + '"'
    Start-Process powershell.exe -ArgumentList $a -Verb RunAs; exit
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
[System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false)

$WG_EXE = "C:\Program Files\WireGuard\wireguard.exe"
$WG_DIR = "C:\ProgramData\WireGuard"
$INSTALL = "$env:LOCALAPPDATA\ProxhqVPN"

$cBg     = [Drawing.Color]::FromArgb(4,  10,  6)
$cBg2    = [Drawing.Color]::FromArgb(8,  18, 10)
$cBg3    = [Drawing.Color]::FromArgb(13, 26, 15)
$cGreen  = [Drawing.Color]::FromArgb(0, 255, 136)
$cGreenD = [Drawing.Color]::FromArgb(0, 200, 100)
$cWhite  = [Drawing.Color]::White
$cDim    = [Drawing.Color]::FromArgb(160, 200, 170)
$cFaint  = [Drawing.Color]::FromArgb(60,  90,  70)
$cOrange = [Drawing.Color]::FromArgb(255, 179, 71)
$cBlack  = [Drawing.Color]::Black

function F($sz, $bold=$false) {
    New-Object Drawing.Font("Segoe UI", $sz, (if($bold){[Drawing.FontStyle]::Bold}else{[Drawing.FontStyle]::Regular}))
}
function FM($sz) { New-Object Drawing.Font("Consolas", $sz) }
function Lbl($t,$x,$y,$w,$h,$f,$c) {
    $l=New-Object Windows.Forms.Label
    $l.Text=$t;$l.Left=$x;$l.Top=$y;$l.Width=$w;$l.Height=$h
    $l.Font=$f;$l.ForeColor=$c;$l.BackColor=[Drawing.Color]::Transparent;$l
}
function Pnl($x,$y,$w,$h,$c=$null) {
    $p=New-Object Windows.Forms.Panel
    $p.Left=$x;$p.Top=$y;$p.Width=$w;$p.Height=$h
    if($c){$p.BackColor=$c};$p
}

# ── Detect installed ProxhqVPN tunnels ───────────────────────────────────────
$confFiles = @(Get-ChildItem "$WG_DIR\proxhqvpn-*.conf" -ErrorAction SilentlyContinue)
if ($confFiles.Count -eq 0) {
    [Windows.Forms.MessageBox]::Show(
        "No ProxhqVPN tunnel configs found in $WG_DIR.`n`nRun the ProxhqVPN installer first and download all server configs.",
        "ProxhqVPN Server Switcher", "OK", "Warning") | Out-Null
    exit
}

# ── Get currently active tunnel name ─────────────────────────────────────────
function GetActiveTunnel {
    if (-not (Test-Path $WG_EXE)) { return $null }
    try {
        $out = & "$WG_EXE" /show 2>&1
        foreach ($line in $out) {
            if ($line -match "^interface:\s*(.+)$") { return $Matches[1].Trim() }
        }
    } catch {}
    return $null
}

$Script:ActiveTunnel = GetActiveTunnel

# ── Build server list from conf files ────────────────────────────────────────
$servers = @()
foreach ($f in $confFiles) {
    $tn = [IO.Path]::GetFileNameWithoutExtension($f.Name)
    $ep = ""
    foreach ($line in [IO.File]::ReadAllLines($f.FullName)) {
        if ($line -match "^Endpoint\s*=\s*(.+)$") { $ep = $Matches[1].Trim(); break }
    }
    # Pretty region name from filename: proxhqvpn-london--gb -> London, GB
    $region = $tn -replace "^proxhqvpn-", "" -replace "-", " "
    $region = (Get-Culture).TextInfo.ToTitleCase($region)

    $flag = switch -Wildcard ($tn) {
        "*london*"      { "🇬🇧" }
        "*chicago*"     { "🇺🇸" }
        "*los-angeles*" { "🇺🇸" }
        "*tokyo*"       { "🇯🇵" }
        "*us-*"         { "🇺🇸" }
        "*jp-*"         { "🇯🇵" }
        "*gb-*"         { "🇬🇧" }
        "*de-*"         { "🇩🇪" }
        default         { "🌐" }
    }
    $servers += @{ name=$tn; region=$region; endpoint=$ep; path=$f.FullName; flag=$flag }
}

# ── Main form ─────────────────────────────────────────────────────────────────
$h = 120 + $servers.Count * 80 + 80
$form = New-Object Windows.Forms.Form
$form.Text = "ProxhqVPN — Switch Server"
$form.Size = New-Object Drawing.Size(520, [Math]::Max($h, 360))
$form.StartPosition = "CenterScreen"; $form.BackColor = $cBg
$form.FormBorderStyle = "FixedDialog"; $form.MaximizeBox = $false
$form.Icon = [Drawing.SystemIcons]::Shield

$hdrPnl = Pnl 0 0 520 64 $cBg2
$hdrPnl.Controls.Add((Lbl "Switch VPN Server" 16 8 380 28 (F 14 $true) $cGreen))
$hdrPnl.Controls.Add((Lbl "ALPHA UNLIMITED TECHNOLOGIES LLC" 16 38 380 16 (F 7.5) $cGreenD))
$form.Controls.Add($hdrPnl)
$form.Controls.Add((Pnl 0 64 520 1 $cFaint))

$form.Controls.Add((Lbl "Click a server to connect. Your current tunnel will be stopped first." 16 72 488 18 (F 9) $cDim))

$statusLbl = Lbl "" 16 ($h - 56) 488 20 (F 9) $cGreen
$form.Controls.Add($statusLbl)
$logBox = New-Object Windows.Forms.RichTextBox
$logBox.Left=16;$logBox.Top=($h-36);$logBox.Width=488;$logBox.Height=24
$logBox.BackColor=$cBg2;$logBox.ForeColor=$cGreenD;$logBox.Font=FM 7.5
$logBox.ReadOnly=$true;$logBox.BorderStyle="None";$logBox.ScrollBars="None"
$form.Controls.Add($logBox)

$Script:Cards = @{}

function RefreshCards {
    $Script:ActiveTunnel = GetActiveTunnel
    foreach ($s in $servers) {
        $card = $Script:Cards[$s.name]
        if ($null -eq $card) { continue }
        $isActive = ($Script:ActiveTunnel -eq $s.name)
        if ($isActive) {
            $card.BackColor = [Drawing.Color]::FromArgb(5, 40, 20)
        } else {
            $card.BackColor = $cBg3
        }
    }
    $form.Refresh()
}

function DoSwitch($server) {
    $statusLbl.Text = "Switching to $($server.region)..."; $logBox.Text = ""; $form.Refresh()

    # Stop all proxhqvpn tunnels
    foreach ($s2 in $servers) {
        try {
            $p = Start-Process -FilePath $WG_EXE -ArgumentList "/uninstalltunnel $($s2.name)" -PassThru -ErrorAction SilentlyContinue
            if ($p) { while (-not $p.HasExited) { [Windows.Forms.Application]::DoEvents(); Start-Sleep -ms 80 } }
        } catch {}
    }
    Start-Sleep -Milliseconds 300

    # Install selected tunnel
    $ok = $false
    try {
        $p2 = Start-Process -FilePath $WG_EXE -ArgumentList "/installtunnel `"$($server.path)`"" -PassThru -ErrorAction Stop
        while (-not $p2.HasExited) { [Windows.Forms.Application]::DoEvents(); Start-Sleep -ms 80 }
        $ok = ($p2.ExitCode -eq 0)
    } catch { $logBox.Text = "Error: $_" }

    if ($ok) {
        $statusLbl.Text = "$($server.flag)  Connected: $($server.region)"
        $logBox.Text = "Tunnel active · $($server.endpoint)"
    } else {
        $statusLbl.Text = "Switch failed — try running as administrator."
        $statusLbl.ForeColor = [Drawing.Color]::FromArgb(255,80,80)
    }
    RefreshCards
}

$cy = 96
foreach ($s in $servers) {
    $srv = $s
    $card = Pnl 16 $cy 488 66 $cBg3
    $card.Cursor = [Windows.Forms.Cursors]::Hand
    $card.BorderStyle = "FixedSingle"
    $Script:Cards[$srv.name] = $card

    $flagL = Lbl $srv.flag  10 10 36 36 (F 20) $cWhite;     $card.Controls.Add($flagL)
    $regL  = Lbl $srv.region 52 10 280 20 (F 10 $true) $cWhite; $card.Controls.Add($regL)
    $epL   = Lbl $srv.endpoint 52 32 280 18 (F 7.5) $cFaint;   $card.Controls.Add($epL)
    $btnL  = Lbl "Connect →" 384 20 88 26 (F 9 $true) $cGreen; $btnL.TextAlign="MiddleRight"; $card.Controls.Add($btnL)

    $clickFn = [scriptblock]::Create("DoSwitch `$Script:Cards['$($srv.name)']._server")
    # attach server ref directly
    $card | Add-Member -NotePropertyName "_server" -NotePropertyValue $srv -Force

    $card.Add_Click({ DoSwitch $this._server })
    foreach ($child in $card.Controls) {
        $child | Add-Member -NotePropertyName "_card" -NotePropertyValue $card -Force
        $child.Add_Click({ DoSwitch $this._card._server })
    }

    $form.Controls.Add($card)
    $cy += 74
}

$closeBtn = New-Object Windows.Forms.Button
$closeBtn.Text="Close";$closeBtn.Left=390;$closeBtn.Top=($h-68);$closeBtn.Width=110;$closeBtn.Height=32
$closeBtn.FlatStyle=[Windows.Forms.FlatStyle]::Flat;$closeBtn.FlatAppearance.BorderSize=1
$closeBtn.BackColor=$cBg3;$closeBtn.ForeColor=$cDim;$closeBtn.FlatAppearance.BorderColor=$cFaint
$closeBtn.Font=F 10 $true;$closeBtn.Cursor=[Windows.Forms.Cursors]::Hand
$closeBtn.Add_Click({$form.Close()})
$form.Controls.Add($closeBtn)

RefreshCards
[Windows.Forms.Application]::Run($form)
