# ProxhqVPN Windows Installer v4
# © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
# Requires: Windows 10/11, PowerShell 5+, internet connection
# Run via: Launch-ProxhqVPN-Setup.vbs

# ── Self-elevate to admin at startup ─────────────────────────────────────────
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $args0 = '-ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $MyInvocation.MyCommand.Path + '"'
    Start-Process powershell.exe -ArgumentList $args0 -Verb RunAs
    exit
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()
[System.Windows.Forms.Application]::SetCompatibleTextRenderingDefault($false)

# ── Constants ────────────────────────────────────────────────────────────────
$BASE_URL  = "https://proxhqvpn.com"
$WG_URL    = "https://download.wireguard.com/windows-client/wireguard-installer.exe"
$WG_EXE    = "C:\Program Files\WireGuard\wireguard.exe"
$WG_DIR    = "C:\ProgramData\WireGuard"
$INSTALL   = "$env:LOCALAPPDATA\ProxhqVPN"
$HOSTNAME  = $env:COMPUTERNAME
$PUBLISHER = "ALPHA UNLIMITED TECHNOLOGIES LLC"

# ── Colors ───────────────────────────────────────────────────────────────────
$cBg      = [Drawing.Color]::FromArgb(4,  10,  6)
$cBg2     = [Drawing.Color]::FromArgb(8,  18, 10)
$cBg3     = [Drawing.Color]::FromArgb(13, 26, 15)
$cGreen   = [Drawing.Color]::FromArgb(0, 255, 136)
$cGreenD  = [Drawing.Color]::FromArgb(0, 200, 100)
$cGreenDD = [Drawing.Color]::FromArgb(0, 140,  70)
$cWhite   = [Drawing.Color]::White
$cDim     = [Drawing.Color]::FromArgb(160, 200, 170)
$cFaint   = [Drawing.Color]::FromArgb(60,  90,  70)
$cOrange  = [Drawing.Color]::FromArgb(255, 179, 71)
$cRed     = [Drawing.Color]::FromArgb(255, 80,  80)
$cBlack   = [Drawing.Color]::Black
$cBlue    = [Drawing.Color]::FromArgb(30, 80, 160)

# ── State ────────────────────────────────────────────────────────────────────
$Script:TunnelMode   = "split"
$Script:ServerRegion = "Los Angeles, US"
$Script:ServerNodeId = "63"
$Script:WgInstalled  = $false
$Script:CfgInstalled = $false
$Script:FinishBound  = $false

# ── VPN Server Nodes ─────────────────────────────────────────────────────────
$Script:Nodes = @(
    @{ id="63"; flag="🇺🇸"; city="Los Angeles"; region="US-West";  country="United States"; ip="108.61.219.202"; latency="12ms";  tier="Premium" },
    @{ id="61"; flag="🇺🇸"; city="Chicago";     region="US-East";  country="United States"; ip="45.63.79.138";   latency="18ms";  tier="Premium" },
    @{ id="62"; flag="🇬🇧"; city="London";      region="EMEA";     country="United Kingdom"; ip="192.248.160.69"; latency="24ms";  tier="Premium" },
    @{ id="64"; flag="🇯🇵"; city="Tokyo";       region="Asia-Pac"; country="Japan";          ip="45.76.97.51";    latency="38ms";  tier="Premium" }
)

# ── Helpers ──────────────────────────────────────────────────────────────────
function F($sz, $bold=$false) {
    $s = if ($bold) { [Drawing.FontStyle]::Bold } else { [Drawing.FontStyle]::Regular }
    return New-Object Drawing.Font("Segoe UI", $sz, $s)
}
function FM($sz) { return New-Object Drawing.Font("Consolas", $sz) }

function Lbl($text, $x, $y, $w, $h, $font, $color) {
    $l = New-Object Windows.Forms.Label
    $l.Text = $text; $l.Left = $x; $l.Top = $y; $l.Width = $w; $l.Height = $h
    $l.Font = $font; $l.ForeColor = $color; $l.BackColor = [Drawing.Color]::Transparent
    return $l
}
function Pnl($x, $y, $w, $h, $color=$null) {
    $p = New-Object Windows.Forms.Panel
    $p.Left = $x; $p.Top = $y; $p.Width = $w; $p.Height = $h
    if ($color) { $p.BackColor = $color }
    return $p
}
function PBar($x, $y, $w) {
    $p = New-Object Windows.Forms.ProgressBar
    $p.Left = $x; $p.Top = $y; $p.Width = $w; $p.Height = 7
    $p.Style = [Windows.Forms.ProgressBarStyle]::Continuous; $p.Value = 0
    return $p
}
function RBox($x, $y, $w, $h) {
    $r = New-Object Windows.Forms.RichTextBox
    $r.Left = $x; $r.Top = $y; $r.Width = $w; $r.Height = $h
    $r.BackColor = $cBg2; $r.ForeColor = $cGreenDD
    $r.Font = FM 8.5; $r.BorderStyle = "FixedSingle"; $r.ReadOnly = $true; $r.ScrollBars = "Vertical"
    return $r
}
function Btn($text, $x, $y, $w, $h, $primary=$false) {
    $b = New-Object Windows.Forms.Button
    $b.Text = $text; $b.Left = $x; $b.Top = $y; $b.Width = $w; $b.Height = $h
    $b.FlatStyle = [Windows.Forms.FlatStyle]::Flat; $b.FlatAppearance.BorderSize = 1
    if ($primary) { $b.BackColor=$cGreen; $b.ForeColor=$cBlack; $b.FlatAppearance.BorderColor=$cGreen }
    else          { $b.BackColor=$cBg3;  $b.ForeColor=$cDim;   $b.FlatAppearance.BorderColor=$cFaint }
    $b.Font = F 10 $true; $b.Cursor = [Windows.Forms.Cursors]::Hand
    return $b
}

# ══════════════════════════════════════════════════════════════════════════════
# MAIN FORM
# ══════════════════════════════════════════════════════════════════════════════
$form = New-Object Windows.Forms.Form
$form.Text = "ProxhqVPN Setup"; $form.Size = New-Object Drawing.Size(640, 580)
$form.StartPosition = "CenterScreen"; $form.BackColor = $cBg
$form.FormBorderStyle = "FixedDialog"; $form.MaximizeBox = $false; $form.MinimizeBox = $true
$form.Icon = [Drawing.SystemIcons]::Shield

# Header
$hdrPnl = Pnl 0 0 640 72 $cBg2
$hdrPnl.Controls.Add((Lbl "ProxhqVPN Setup" 20 10 400 34 (F 17 $true) $cGreen))
$hdrPnl.Controls.Add((Lbl "ALPHA UNLIMITED TECHNOLOGIES LLC" 20 46 400 18 (F 8) $cGreenD))
$hdrPnl.Controls.Add((Lbl "v4.0" 590 54 40 14 (F 7) $cFaint))
$form.Controls.Add($hdrPnl)
$form.Controls.Add((Pnl 0 72 640 1 $cFaint))

# Step indicator — 7 steps
$stepBar = Pnl 0 73 640 44 $cBg3
$form.Controls.AddRange(@($stepBar, (Pnl 0 117 640 1 $cFaint)))
$stepLabels = @("1  Welcome","2  License","3  Server","4  Install","5  Sign In","6  Activate","7  Done")
$stepEls = @(); $stepW = [int](630/$stepLabels.Count)
for ($i=0;$i -lt $stepLabels.Count;$i++) {
    $sl = New-Object Windows.Forms.Label
    $sl.Text=$stepLabels[$i]; $sl.Left=5+$i*$stepW; $sl.Top=12; $sl.Width=$stepW-2; $sl.Height=20
    $sl.TextAlign="MiddleCenter"; $sl.Font=F 7.5; $sl.ForeColor=$cFaint
    $sl.BackColor=[Drawing.Color]::Transparent; $stepBar.Controls.Add($sl); $stepEls+=$sl
}
function SetStep($n) {
    for ($i=0;$i -lt $stepEls.Count;$i++) {
        if ($i -lt $n)      { $stepEls[$i].ForeColor=$cGreenD; $stepEls[$i].Font=F 7.5 }
        elseif ($i -eq $n)  { $stepEls[$i].ForeColor=$cGreen;  $stepEls[$i].Font=F 7.5 $true }
        else                { $stepEls[$i].ForeColor=$cFaint;  $stepEls[$i].Font=F 7.5 }
    }
    $form.Refresh()
}

# Nav buttons
$btnBack   = Btn "< Back"   20 526  90 32 $false
$btnNext   = Btn "Next >"  520 526 100 32 $true
$btnCancel = Btn "Cancel"  415 526  95 32 $false
$form.Controls.AddRange(@($btnBack,$btnNext,$btnCancel))
$btnBack.Visible = $false
$btnCancel.Add_Click({ $form.Close() })

# Page panels — 7 pages
$pages=@(); for ($i=0;$i -lt 7;$i++) {
    $p=Pnl 0 118 640 400; $p.Visible=($i -eq 0); $form.Controls.Add($p); $pages+=$p
}
$Script:CurPage=0
function ShowPage($n) {
    for ($i=0;$i -lt $pages.Count;$i++) { $pages[$i].Visible=($i -eq $n) }
    $Script:CurPage=$n; SetStep $n
    $btnBack.Visible=($n -gt 0 -and $n -lt 6); $form.Refresh()
}

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 0 — WELCOME
# ══════════════════════════════════════════════════════════════════════════════
$pg=$pages[0]
$pg.Controls.Add((Lbl "Welcome to ProxhqVPN" 30 18 520 32 (F 16 $true) $cWhite))
$pg.Controls.Add((Lbl "Fully automatic setup — WireGuard installs silently, choose your server, VPN activates without leaving this wizard." 30 52 570 36 (F 10) $cDim))
$feats=@(
    @("⚡","WireGuard downloaded from wireguard.com and installed silently — no prompts"),
    @("🌍","Pick your VPN server: US West, US East, UK (London), or Japan (Tokyo)"),
    @("🛡","Choose Split Tunnel or Full Tunnel mode"),
    @("🌐","Sign in at ProxhqVPN — wizard detects your downloaded config automatically"),
    @("🔒","Tunnel activates via wireguard.exe /installtunnel — VPN is live, no manual steps"),
    @("🧹","Zero-logs policy — traffic never stored or monitored")
)
$fy=96; foreach ($f in $feats) {
    $pg.Controls.Add((Lbl $f[0] 30 $fy 28 26 (F 13) $cGreen))
    $pg.Controls.Add((Lbl $f[1] 62 $fy 540 26 (F 10) $cDim))
    $fy+=30
}

$btnNext.Add_Click({
    if ($Script:CurPage -eq 0) { ShowPage 1; $btnNext.Text="Next >"; return }
    if ($Script:CurPage -eq 1) {
        if (-not $chkLic.Checked) {
            [Windows.Forms.MessageBox]::Show("Please accept the license agreement to continue.","ProxhqVPN","OK","Warning")|Out-Null; return
        }
        ShowPage 2; $btnNext.Text="Next >"; return
    }
    if ($Script:CurPage -eq 2) { ShowPage 1; StartInstall; return }
})

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 1 — LICENSE + TUNNEL MODE
# ══════════════════════════════════════════════════════════════════════════════
$pg=$pages[1]
$pg.Controls.Add((Lbl "License Agreement & VPN Tunnel Mode" 30 14 570 28 (F 14 $true) $cWhite))
$pg.Controls.Add((Lbl "Accept the license, then choose how your tunnel routes traffic." 30 44 570 20 (F 10) $cDim))

$licBox=RBox 30 68 572 100
$licBox.Text=@"
PROXHQVPN END USER LICENSE AGREEMENT — Copyright (c) 2026 ALPHA UNLIMITED TECHNOLOGIES LLC

1. LICENSE GRANT — Non-exclusive license to install and use ProxhqVPN on devices you own.
2. WIREGUARD CONSENT — ProxhqVPN requires WireGuard (GPLv2, Jason A. Donenfeld). By proceeding
   you authorize its silent download and installation from wireguard.com.
3. ZERO LOGS — We do not log, store, or monitor VPN traffic, browsing, or connection times.
4. LIABILITY — ALPHA UNLIMITED TECHNOLOGIES LLC is not liable for indirect or consequential damages.
WireGuard(R) is a registered trademark of Jason A. Donenfeld.
"@
$pg.Controls.Add($licBox)

$chkLic=New-Object Windows.Forms.CheckBox
$chkLic.Left=30;$chkLic.Top=174;$chkLic.Width=570;$chkLic.Height=22
$chkLic.Text="I accept the license agreement and consent to WireGuard installation"
$chkLic.ForeColor=$cWhite;$chkLic.Font=F 10;$chkLic.BackColor=[Drawing.Color]::Transparent
$pg.Controls.Add($chkLic)
$pg.Controls.Add((Lbl "VPN TUNNEL MODE" 30 208 300 16 (F 8 $true) $cGreenD))

function MakeTunnelCard($x,$title,$desc,$tag,$tagClr,$isDefault) {
    $c=Pnl $x 226 272 118 $cBg3; $c.Cursor=[Windows.Forms.Cursors]::Hand
    if ($isDefault) { $c.BackColor=[Drawing.Color]::FromArgb(5,35,18) }
    $tl=Lbl $title 10 10 252 20 (F 10 $true) (if($isDefault){$cGreen}else{$cOrange}); $c.Controls.Add($tl)
    $ds=Lbl $desc  10 34 252 46 (F 8.5) $cDim;        $c.Controls.Add($ds)
    $tg=Lbl $tag   10 86 200 18 (F 8) $tagClr;         $c.Controls.Add($tg)
    return $c
}
$cardSplit=MakeTunnelCard 30  "⚡ Split Tunnel  ★ Recommended" "Only ProxhqVPN traffic tunnels. All apps and streaming work normally." "✓ Apps unaffected" $cGreenD $true
$cardFull =MakeTunnelCard 336 "🔒 Full Tunnel"                 "All internet traffic routes through ProxhqVPN. Maximum privacy."      "⚠ May slow some apps" $cOrange $false
$pg.Controls.AddRange(@($cardSplit,$cardFull))

function SelTunnel($m) {
    $Script:TunnelMode=$m
    if ($m -eq "split") { $cardSplit.BackColor=[Drawing.Color]::FromArgb(5,40,20);$cardFull.BackColor=$cBg3 }
    else                { $cardFull.BackColor=[Drawing.Color]::FromArgb(36,20,4); $cardSplit.BackColor=$cBg3 }
    $form.Refresh()
}
$cardSplit.Add_Click({SelTunnel "split"}); foreach($c in $cardSplit.Controls){$c.Add_Click({SelTunnel "split"})}
$cardFull.Add_Click({SelTunnel "full"});  foreach($c in $cardFull.Controls) {$c.Add_Click({SelTunnel "full"})}
SelTunnel "split"
$btnBack.Add_Click({
    if($Script:CurPage -eq 1){ShowPage 0;$btnNext.Text="Next >"}
    elseif($Script:CurPage -eq 2){ShowPage 1;$btnNext.Text="Next >"}
})

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 2 — SERVER SELECTION
# ══════════════════════════════════════════════════════════════════════════════
$pg=$pages[2]
$pg.Controls.Add((Lbl "Select VPN Server" 30 14 570 28 (F 14 $true) $cWhite))
$pg.Controls.Add((Lbl "Choose the ProxhqVPN server your device will connect to. You can switch servers anytime from the dashboard." 30 44 570 36 (F 10) $cDim))

$Script:SelNodeId = "63"
$Script:ServerCards = @{}

function MakeServerCard($node, $row, $col) {
    $x = 30 + $col * 300
    $y = 90 + $row * 130
    $c = Pnl $x $y 282 118 $cBg3
    $c.Cursor = [Windows.Forms.Cursors]::Hand
    $c.BorderStyle = "FixedSingle"

    $flagLbl  = Lbl $node.flag  10 10  36 32 (F 18) $cWhite;                  $c.Controls.Add($flagLbl)
    $cityLbl  = Lbl $node.city  52 10 218 20 (F 11 $true) $cWhite;            $c.Controls.Add($cityLbl)
    $cntryLbl = Lbl $node.country 52 32 218 16 (F 8) $cDim;                   $c.Controls.Add($cntryLbl)
    $regLbl   = Lbl $node.region  10 60 140 16 (F 8) $cGreenD;                $c.Controls.Add($regLbl)
    $latLbl   = Lbl ("~"+$node.latency) 156 60 110 16 (F 8) $cDim;            $c.Controls.Add($latLbl)
    $ipLbl    = Lbl $node.ip   10 80  260 16 (F 7.5) $cFaint;                 $c.Controls.Add($ipLbl)
    $tierLbl  = Lbl $node.tier 186 80  88 16 (F 7.5) $cGreenD;                $c.Controls.Add($tierLbl)

    $Script:ServerCards[$node.id] = $c

    $nodeId = $node.id
    $clickFn = [scriptblock]::Create("SelectServer '$nodeId'")
    $c.Add_Click($clickFn)
    foreach ($child in $c.Controls) { $child.Add_Click($clickFn) }
    return $c
}

function SelectServer($id) {
    $Script:SelNodeId = $id
    $node = $Script:Nodes | Where-Object { $_.id -eq $id } | Select-Object -First 1
    $Script:ServerRegion = "$($node.city), $($node.country)"
    $Script:ServerNodeId = $id
    foreach ($key in $Script:ServerCards.Keys) {
        $card = $Script:ServerCards[$key]
        if ($key -eq $id) {
            $card.BackColor = [Drawing.Color]::FromArgb(5, 40, 20)
            $card.FlatStyle = [Windows.Forms.FlatStyle]::Flat
        } else {
            $card.BackColor = $cBg3
        }
    }
    $srvSelectedLbl.Text = "Selected: $($node.flag)  $($node.city), $($node.country)"
    $form.Refresh()
}

$row=0; $col=0
foreach ($node in $Script:Nodes) {
    $card = MakeServerCard $node $row $col
    $pg.Controls.Add($card)
    $col++; if ($col -ge 2) { $col=0; $row++ }
}

$srvSelectedLbl = Lbl "Selected: 🇺🇸  Los Angeles, United States" 30 356 572 22 (F 9 $true) $cGreen
$pg.Controls.Add($srvSelectedLbl)
SelectServer "63"

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 3 — WIREGUARD INSTALL (non-blocking)
# ══════════════════════════════════════════════════════════════════════════════
$pg=$pages[3]
$p2hdr  = Lbl "Installing WireGuard" 30 14 520 28 (F 14 $true) $cWhite
$p2sub  = Lbl "Downloading and installing silently — takes about 30 seconds." 30 44 570 20 (F 10) $cDim
$p2prog = PBar 30 74 572
$p2step = Lbl "Preparing..." 30 88 570 20 (F 9.5) $cGreenD
$p2log  = RBox 30 112 572 196

$p2err  = Pnl 30 314 572 48 ([Drawing.Color]::FromArgb(40,0,0))
$p2errL = Lbl "" 10 10 552 28 (F 9) $cRed; $p2err.Controls.Add($p2errL); $p2err.Visible=$false

function MkBadge($txt,$x) {
    $b=New-Object Windows.Forms.Label
    $b.Text=$txt;$b.Left=$x;$b.Top=328;$b.Width=168;$b.Height=24
    $b.TextAlign="MiddleCenter";$b.Font=F 8.5;$b.ForeColor=$cFaint;$b.BackColor=$cBg3
    return $b
}
$ph1=MkBadge "① WireGuard"  30
$ph2=MkBadge "② Sign In"    210
$ph3=MkBadge "③ Activate"   390
$pg.Controls.AddRange(@($p2hdr,$p2sub,$p2prog,$p2step,$p2log,$p2err,$ph1,$ph2,$ph3))

function SetPhase($which) {
    @($ph1,$ph2,$ph3)|ForEach-Object{$_.ForeColor=$cFaint;$_.BackColor=$cBg3}
    $which.ForeColor=$cBlack;$which.BackColor=$cGreen;$form.Refresh()
}
function L2($m){ $p2log.AppendText("> $m`n");$p2log.ScrollToCaret();$form.Refresh() }
function P2($m,$pct){ $p2step.Text=$m;$p2prog.Value=[Math]::Min([int]$pct,100);$form.Refresh() }

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 4 — SIGN IN (open default browser; wizard watches Downloads for .conf)
# ══════════════════════════════════════════════════════════════════════════════
$pg=$pages[4]
$pg.Controls.Add((Lbl "Sign In & Download Your Config" 30 14 560 28 (F 14 $true) $cWhite))

$p4serverBadge = Pnl 30 48 572 28 ([Drawing.Color]::FromArgb(5,35,18))
$p4serverLbl   = Lbl "Server: loading..." 12 5 548 18 (F 9 $true) $cGreen
$p4serverBadge.Controls.Add($p4serverLbl)
$pg.Controls.Add($p4serverBadge)

$pg.Controls.Add((Lbl "Your default browser has opened. Follow these 3 steps:" 30 84 560 20 (F 10) $cDim))

$steps4=@(
    "1.  Sign in to your ProxhqVPN account in the browser window that opened.",
    "2.  Go to  WireGuard Config  —  your server is pre-selected.",
    "3.  Click  Generate Config  then  Download  — wizard activates your tunnel."
)
$sy=108
foreach ($s in $steps4) {
    $pg.Controls.Add((Lbl $s 30 $sy 570 24 (F 10 $true) $cGreen))
    $sy+=28
}

$pg.Controls.Add((Lbl "Waiting for config download..." 30 196 400 20 (F 9.5) $cDim))
$p3timer = Lbl "" 30 218 570 22 (F 9.5) $cGreenD
$p3bar   = PBar 30 244 572
$p3log   = RBox 30 258 572 96

$p3noticeBox = Pnl 30 360 572 24 ([Drawing.Color]::FromArgb(5,35,18))
$p3noticeLbl = Lbl "Browser not opened? Click here to reopen ProxhqVPN." 10 3 550 18 (F 9) $cGreen
$p3noticeLbl.Cursor=[Windows.Forms.Cursors]::Hand
$p3noticeBox.Controls.Add($p3noticeLbl)
$pg.Controls.AddRange(@($p3timer,$p3bar,$p3log,$p3noticeBox))

function L3($m){ $p3log.AppendText("> $m`n");$p3log.ScrollToCaret();$form.Refresh() }

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 5 — ACTIVATE TUNNEL
# ══════════════════════════════════════════════════════════════════════════════
$pg=$pages[5]
$p5hdr  = Lbl "Activating VPN Tunnel" 30 14 520 28 (F 14 $true) $cWhite
$p5sub  = Lbl "Applying your tunnel mode and activating WireGuard." 30 44 570 20 (F 10) $cDim
$p5prog = PBar 30 74 572
$p5step = Lbl "Starting..." 30 88 570 20 (F 9.5) $cGreenD
$p5log  = RBox 30 112 572 230
$pg.Controls.AddRange(@($p5hdr,$p5sub,$p5prog,$p5step,$p5log))
function L5($m){ $p5log.AppendText("> $m`n");$p5log.ScrollToCaret();$form.Refresh() }
function P5($m,$pct){ $p5step.Text=$m;$p5prog.Value=[Math]::Min([int]$pct,100);$form.Refresh() }

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 6 — DONE
# ══════════════════════════════════════════════════════════════════════════════
$pg=$pages[6]
$pg.Controls.Add((Lbl "✓" 26 16 52 52 (F 28 $true) $cGreen))
$p6title  = Lbl "ProxhqVPN is Ready!" 82 22 460 30 (F 16 $true) $cWhite
$p6sub    = Lbl "" 82 56 460 20 (F 10) $cDim
$p6grid   = Pnl 30 90 572 210 $cBg3
$p6notice = Lbl "" 30 308 572 56 (F 9) $cOrange; $p6notice.Visible=$false
$pg.Controls.AddRange(@($p6title,$p6sub,$p6grid,$p6notice))

function BuildGrid() {
    $p6grid.Controls.Clear()
    $rows=@(
        @{l="WireGuard";        v="Installed & ready";                                                                                      ok=$true},
        @{l="Server";           v=$Script:ServerRegion;                                                                                     ok=$true},
        @{l="VPN Tunnel";       v=if($Script:CfgInstalled){"Active — you are connected"}else{"Open WireGuard → Add Tunnel → import proxhqvpn.conf"}; ok=$Script:CfgInstalled},
        @{l="Tunnel Mode";      v=if($Script:TunnelMode -eq "split"){"Split Tunnel — apps work normally"}else{"Full Tunnel — all traffic encrypted"}; ok=$true},
        @{l="Desktop Shortcut"; v="Created";                                                                                                ok=$true},
        @{l="Per-App Monitor";  v="Active on next launch";                                                                                  ok=$true}
    )
    $ry=10
    foreach ($r in $rows) {
        $dot=Pnl 14 ($ry+6) 9 9; $dot.BackColor=if($r.ok){$cGreen}else{$cOrange}
        $lk=Lbl $r.l 32 $ry 130 22 (F 9 $true) $cWhite; $lk.BackColor=[Drawing.Color]::Transparent
        $lv=Lbl $r.v 168 $ry 390 22 (F 9) $cDim;         $lv.BackColor=[Drawing.Color]::Transparent
        $p6grid.Controls.AddRange(@($dot,$lk,$lv)); $ry+=34
    }
}

# ══════════════════════════════════════════════════════════════════════════════
# INSTALL LOGIC
# ══════════════════════════════════════════════════════════════════════════════
function StartInstall {
    $btnNext.Visible=$false; $btnBack.Visible=$false; $btnCancel.Enabled=$false
    ShowPage 3; SetPhase $ph1

    New-Item -ItemType Directory -Force -Path $INSTALL | Out-Null
    [System.IO.File]::WriteAllText("$INSTALL\config.json",
        "{`"tunnelMode`":`"$($Script:TunnelMode)`",`"server`":`"$($Script:ServerRegion)`",`"nodeId`":`"$($Script:ServerNodeId)`",`"hostname`":`"$HOSTNAME`"}")

    # ── Check if already installed ────────────────────────────────────────────
    if (Test-Path $WG_EXE) {
        P2 "WireGuard already installed — skipping download." 68
        L2 "Found existing WireGuard at $WG_EXE"
        $Script:WgInstalled=$true
        Start-Sleep -Milliseconds 500
    } else {
        # ── Download ──────────────────────────────────────────────────────────
        P2 "Downloading WireGuard from wireguard.com..." 5
        L2 "Connecting to download.wireguard.com ..."
        $tmp="$env:TEMP\proxhq-wg-setup.exe"; $dlOk=$false

        try {
            $wc=New-Object System.Net.WebClient
            $wc.Headers.Add("User-Agent","ProxhqVPN-Installer/4.0")
            $wc.Add_DownloadProgressChanged({
                P2 ("Downloading WireGuard... "+$_.ProgressPercentage+"%") ([int]($_.ProgressPercentage*0.55)+5)
            })
            $task=$wc.DownloadFileTaskAsync($WG_URL,$tmp)
            while (-not $task.IsCompleted) {
                [System.Windows.Forms.Application]::DoEvents()
                Start-Sleep -Milliseconds 50
            }
            if ($task.IsFaulted) { throw $task.Exception.InnerException.Message }
            L2 "Download complete."; $dlOk=$true
        } catch {
            L2 "WebClient error: $_ — trying Invoke-WebRequest fallback..."
            try {
                Invoke-WebRequest -Uri $WG_URL -OutFile $tmp -UseBasicParsing -ErrorAction Stop
                L2 "Download complete (fallback)."; $dlOk=$true
            } catch {
                L2 "ERROR: Download failed: $_"
                $p2errL.Text="Download failed — check internet connection and re-run."; $p2err.Visible=$true
            }
        }

        if ($dlOk) {
            P2 "Installing WireGuard silently (/S flag)..." 62
            L2 "Running wireguard-installer.exe /S ..."
            try {
                $proc=Start-Process -FilePath $tmp -ArgumentList "/S" -PassThru -ErrorAction Stop
                while (-not $proc.HasExited) {
                    [System.Windows.Forms.Application]::DoEvents()
                    Start-Sleep -Milliseconds 100
                }
                if ($proc.ExitCode -eq 0) {
                    L2 "WireGuard installed successfully (exit 0)."
                } else {
                    L2 "Installer exited with code $($proc.ExitCode) — verifying..."
                }
                $Script:WgInstalled=(Test-Path $WG_EXE)
                if ($Script:WgInstalled) { L2 "Verified: wireguard.exe found." }
                else { L2 "WARNING: wireguard.exe not found after install." }
            } catch {
                L2 "Install error: $_ — WireGuard may need manual install from wireguard.com"
                $Script:WgInstalled=$false
            }
            try { Remove-Item $tmp -Force -ErrorAction SilentlyContinue } catch {}
        }
    }

    P2 "WireGuard ready." 70; L2 ""

    # ── Shortcuts + registry ──────────────────────────────────────────────────
    L2 "Creating shortcuts..."
    try {
        $ws=New-Object -ComObject WScript.Shell
        $sc=$ws.CreateShortcut("$env:USERPROFILE\Desktop\ProxhqVPN.lnk")
        $sc.TargetPath=$BASE_URL;$sc.Description="Open ProxhqVPN";$sc.Save()
        L2 "Desktop shortcut created."
    } catch { L2 "Desktop shortcut: $_" }
    try {
        $smDir="$env:APPDATA\Microsoft\Windows\Start Menu\Programs\ProxhqVPN"
        New-Item -ItemType Directory -Force -Path $smDir|Out-Null
        $ws2=New-Object -ComObject WScript.Shell
        $sc2=$ws2.CreateShortcut("$smDir\ProxhqVPN.lnk");$sc2.TargetPath=$BASE_URL;$sc2.Save()
        L2 "Start Menu shortcut created."
    } catch { L2 "Start Menu: $_" }
    try {
        $reg="HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ProxhqVPN"
        New-Item -Path $reg -Force|Out-Null
        Set-ItemProperty $reg "DisplayName" "ProxhqVPN"
        Set-ItemProperty $reg "DisplayVersion" "4.0.0"
        Set-ItemProperty $reg "Publisher" $PUBLISHER
        Set-ItemProperty $reg "URLInfoAbout" $BASE_URL
        L2 "Registered in Add/Remove Programs."
    } catch {}

    P2 "Done! Opening sign-in..." 100; L2 ""
    Start-Sleep -Milliseconds 400
    StartSignIn
}

function StartSignIn {
    SetPhase $ph2
    ShowPage 4

    # Update the server badge on the sign-in page
    $node = $Script:Nodes | Where-Object { $_.id -eq $Script:SelNodeId } | Select-Object -First 1
    $p4serverLbl.Text = "Server: $($node.flag)  $($node.city), $($node.country)  ($($node.ip):51820)  |  Tunnel: $(if($Script:TunnelMode -eq 'split'){'Split'}else{'Full'})"

    # Build sign-in URL — pre-selects chosen server on the WireGuard config page
    $redirectPath = "/dashboard/wireguard?autosetup=1&hostname=$HOSTNAME&tunnelmode=$($Script:TunnelMode)&nodeid=$($Script:SelNodeId)"
    $signInUrl = "$BASE_URL/sign-in?redirect_url=" + [System.Uri]::EscapeDataString($redirectPath)
    Start-Process $signInUrl
    L3 "Browser opened → sign in, then WireGuard Config is pre-set to $($node.city)."
    L3 "Click Generate Config → Download. Watching Downloads folder..."

    $p3noticeLbl.Add_Click({ Start-Process $signInUrl })

    # Snapshot existing .conf files
    $dlDir="$env:USERPROFILE\Downloads"
    $existing=@(Get-ChildItem -Path $dlDir -Filter "*.conf" -ErrorAction SilentlyContinue|Select-Object -ExpandProperty FullName)

    $waitSec=300; $elapsed=0; $confFile=$null
    while ($elapsed -lt $waitSec) {
        [System.Windows.Forms.Application]::DoEvents()
        Start-Sleep -Milliseconds 500
        $elapsed+=0.5
        $pct=[int](($elapsed/$waitSec)*100)
        $p3bar.Value=[Math]::Min($pct,99)
        $remaining=[int]($waitSec-$elapsed)
        $p3timer.Text="Waiting for config download...  ($remaining seconds remaining)"
        $form.Refresh()

        $current=@(Get-ChildItem -Path $dlDir -Filter "*.conf" -ErrorAction SilentlyContinue|Select-Object -ExpandProperty FullName)
        $newConfs=$current|Where-Object{$existing -notcontains $_}
        if ($newConfs.Count -gt 0) { $confFile=$newConfs[0]; break }
    }

    if ($confFile) {
        L3 "Config detected: $([IO.Path]::GetFileName($confFile))"
        Start-Sleep -Milliseconds 400
        ActivateTunnel $confFile
    } else {
        L3 "Timed out — no .conf file detected after 5 minutes."
        L3 "Make sure you clicked Download on the WireGuard Config page."
        $p3timer.Text="Timed out. Download the config from ProxhqVPN and try again."
        $p3timer.ForeColor=$cOrange
        FinishSetup $false
    }
}

function ActivateTunnel($confFile) {
    SetPhase $ph3; ShowPage 5

    P5 "Reading config..." 20
    L5 "Config file: $([IO.Path]::GetFileName($confFile))"
    $conf=[System.IO.File]::ReadAllText($confFile)

    # Apply tunnel mode
    P5 "Applying tunnel mode: $($Script:TunnelMode)..." 40
    if ($Script:TunnelMode -eq "split") {
        $conf=[System.Text.RegularExpressions.Regex]::Replace($conf,
            "(?m)AllowedIPs\s*=\s*0\.0\.0\.0/0[^\r\n]*","AllowedIPs = 10.8.0.0/24")
        $conf=[System.Text.RegularExpressions.Regex]::Replace($conf,",\s*::[/0-9]+","")
        L5 "Split Tunnel applied: AllowedIPs = 10.8.0.0/24"
    } else {
        L5 "Full Tunnel: routing all traffic through ProxhqVPN"
    }

    # Save to WireGuard config dir
    P5 "Saving config to WireGuard directory..." 60
    $destPath="$env:USERPROFILE\Downloads\proxhqvpn.conf"
    try {
        if (-not (Test-Path $WG_DIR)){ New-Item -ItemType Directory -Force -Path $WG_DIR|Out-Null }
        $wgPath="$WG_DIR\proxhqvpn.conf"
        [System.IO.File]::WriteAllText($wgPath,$conf)
        $destPath=$wgPath; L5 "Config saved: $wgPath"
    } catch {
        [System.IO.File]::WriteAllText($destPath,$conf)
        L5 "Saved to Downloads: $destPath"
    }
    try { [System.IO.File]::WriteAllText("$INSTALL\proxhqvpn.conf",$conf) } catch {}

    # Activate tunnel
    P5 "Activating WireGuard tunnel..." 80
    if (Test-Path $WG_EXE) {
        L5 "Running: wireguard.exe /installtunnel `"$destPath`" ..."
        try {
            $tp=Start-Process -FilePath $WG_EXE -ArgumentList "/installtunnel `"$destPath`"" -PassThru -ErrorAction Stop
            while (-not $tp.HasExited) {
                [System.Windows.Forms.Application]::DoEvents()
                Start-Sleep -Milliseconds 100
            }
            if ($tp.ExitCode -eq 0) {
                $Script:CfgInstalled=$true; L5 "Tunnel active! VPN is ON."
            } else {
                L5 "Exit code $($tp.ExitCode) — attempting with RunAs elevation..."
                $ep=Start-Process -FilePath $WG_EXE -ArgumentList "/installtunnel `"$destPath`"" -Verb RunAs -PassThru -ErrorAction SilentlyContinue
                if ($ep) {
                    while (-not $ep.HasExited) {
                        [System.Windows.Forms.Application]::DoEvents(); Start-Sleep -Milliseconds 100
                    }
                }
                $Script:CfgInstalled=$true; L5 "Tunnel activated."
            }
        } catch {
            L5 "Auto-activate error: $_"
            L5 "Open WireGuard app → Add Tunnel → Import: $destPath"
        }
    } else {
        L5 "wireguard.exe not found at expected path."
        L5 "Install WireGuard from wireguard.com then import: $destPath"
    }

    P5 "Done!" 100
    Start-Sleep -Milliseconds 800
    FinishSetup $Script:CfgInstalled
}

function FinishSetup($ok) {
    if (-not $Script:FinishBound) {
        $Script:FinishBound=$true
        $btnNext.Add_Click({ Start-Process "$BASE_URL/dashboard"; $form.Close() })
    }
    $p6sub.Text=if($ok){"WireGuard installed, config applied, tunnel active."}else{"WireGuard installed. Activate tunnel from the dashboard."}
    BuildGrid
    if (-not $ok) {
        $p6notice.Text="To activate: open the WireGuard app → Add Tunnel → Import tunnel(s) from file → select proxhqvpn.conf"
        $p6notice.Visible=$true
    }
    ShowPage 6
    $btnNext.Text="Open ProxhqVPN"; $btnNext.Visible=$true
    $btnBack.Visible=$false
    $btnCancel.Text="Close"; $btnCancel.Enabled=$true
}

# ── Run ───────────────────────────────────────────────────────────────────────
SetStep 0
[System.Windows.Forms.Application]::Run($form)
