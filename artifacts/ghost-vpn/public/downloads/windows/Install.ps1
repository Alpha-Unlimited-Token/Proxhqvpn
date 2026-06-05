# ProxhqVPN Windows Installer v5
# © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
# Installs ALL server tunnels at once — switch servers anytime without reinstalling.
# Run via: Launch-ProxhqVPN-Setup.vbs

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $a = '-ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $MyInvocation.MyCommand.Path + '"'
    Start-Process powershell.exe -ArgumentList $a -Verb RunAs; exit
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

# ── State ────────────────────────────────────────────────────────────────────
$Script:TunnelMode     = "split"
$Script:WgInstalled    = $false
$Script:InstalledConfs = @()   # list of { name, path, region, flag }
$Script:ActiveTunnel   = ""
$Script:FinishBound    = $false

# ── Helpers ──────────────────────────────────────────────────────────────────
function F($sz,$bold=$false){ New-Object Drawing.Font("Segoe UI",$sz,(if($bold){[Drawing.FontStyle]::Bold}else{[Drawing.FontStyle]::Regular})) }
function FM($sz){ New-Object Drawing.Font("Consolas",$sz) }
function Lbl($t,$x,$y,$w,$h,$f,$c){
    $l=New-Object Windows.Forms.Label
    $l.Text=$t;$l.Left=$x;$l.Top=$y;$l.Width=$w;$l.Height=$h
    $l.Font=$f;$l.ForeColor=$c;$l.BackColor=[Drawing.Color]::Transparent;$l
}
function Pnl($x,$y,$w,$h,$c=$null){
    $p=New-Object Windows.Forms.Panel
    $p.Left=$x;$p.Top=$y;$p.Width=$w;$p.Height=$h
    if($c){$p.BackColor=$c};$p
}
function PBar($x,$y,$w){
    $p=New-Object Windows.Forms.ProgressBar
    $p.Left=$x;$p.Top=$y;$p.Width=$w;$p.Height=7
    $p.Style=[Windows.Forms.ProgressBarStyle]::Continuous;$p.Value=0;$p
}
function RBox($x,$y,$w,$h){
    $r=New-Object Windows.Forms.RichTextBox
    $r.Left=$x;$r.Top=$y;$r.Width=$w;$r.Height=$h
    $r.BackColor=$cBg2;$r.ForeColor=$cGreenDD
    $r.Font=FM 8.5;$r.BorderStyle="FixedSingle";$r.ReadOnly=$true;$r.ScrollBars="Vertical";$r
}
function Btn($t,$x,$y,$w,$h,$primary=$false){
    $b=New-Object Windows.Forms.Button
    $b.Text=$t;$b.Left=$x;$b.Top=$y;$b.Width=$w;$b.Height=$h
    $b.FlatStyle=[Windows.Forms.FlatStyle]::Flat;$b.FlatAppearance.BorderSize=1
    if($primary){$b.BackColor=$cGreen;$b.ForeColor=$cBlack;$b.FlatAppearance.BorderColor=$cGreen}
    else{$b.BackColor=$cBg3;$b.ForeColor=$cDim;$b.FlatAppearance.BorderColor=$cFaint}
    $b.Font=F 10 $true;$b.Cursor=[Windows.Forms.Cursors]::Hand;$b
}

function RegionLabel($filename) {
    $stem = [IO.Path]::GetFileNameWithoutExtension($filename) -replace "^proxhqvpn-",""
    $parts = $stem -split "-" | ForEach-Object { (Get-Culture).TextInfo.ToTitleCase($_) }
    return ($parts -join " ")
}
function RegionFlag($stem) {
    switch -Wildcard ($stem) {
        "*london*"      { return "🇬🇧" }
        "*chicago*"     { return "🇺🇸" }
        "*los-angeles*" { return "🇺🇸" }
        "*los*angeles*" { return "🇺🇸" }
        "*tokyo*"       { return "🇯🇵" }
        "*us-*"         { return "🇺🇸" }
        "*gb-*"         { return "🇬🇧" }
        "*jp-*"         { return "🇯🇵" }
        default         { return "🌐" }
    }
}

# ══════════════════════════════════════════════════════════════════════════════
# MAIN FORM  640 × 580
# ══════════════════════════════════════════════════════════════════════════════
$form = New-Object Windows.Forms.Form
$form.Text="ProxhqVPN Setup"; $form.Size=New-Object Drawing.Size(640,580)
$form.StartPosition="CenterScreen"; $form.BackColor=$cBg
$form.FormBorderStyle="FixedDialog"; $form.MaximizeBox=$false; $form.MinimizeBox=$true
$form.Icon=[Drawing.SystemIcons]::Shield

$hdrPnl=Pnl 0 0 640 72 $cBg2
$hdrPnl.Controls.Add((Lbl "ProxhqVPN Setup" 20 10 400 34 (F 17 $true) $cGreen))
$hdrPnl.Controls.Add((Lbl "ALPHA UNLIMITED TECHNOLOGIES LLC" 20 46 400 18 (F 8) $cGreenD))
$hdrPnl.Controls.Add((Lbl "v5.0" 598 54 34 14 (F 7) $cFaint))
$form.Controls.Add($hdrPnl)
$form.Controls.Add((Pnl 0 72 640 1 $cFaint))

# Step bar — 6 steps
$stepBar=Pnl 0 73 640 44 $cBg3
$form.Controls.AddRange(@($stepBar,(Pnl 0 117 640 1 $cFaint)))
$stepLabels=@("1  Welcome","2  License","3  Install","4  Download","5  Tunnels","6  Done")
$stepEls=@(); $stepW=[int](630/$stepLabels.Count)
for($i=0;$i -lt $stepLabels.Count;$i++){
    $sl=New-Object Windows.Forms.Label
    $sl.Text=$stepLabels[$i];$sl.Left=5+$i*$stepW;$sl.Top=12;$sl.Width=$stepW-2;$sl.Height=20
    $sl.TextAlign="MiddleCenter";$sl.Font=F 8;$sl.ForeColor=$cFaint
    $sl.BackColor=[Drawing.Color]::Transparent;$stepBar.Controls.Add($sl);$stepEls+=$sl
}
function SetStep($n){
    for($i=0;$i -lt $stepEls.Count;$i++){
        if($i -lt $n)     {$stepEls[$i].ForeColor=$cGreenD;$stepEls[$i].Font=F 8}
        elseif($i -eq $n) {$stepEls[$i].ForeColor=$cGreen; $stepEls[$i].Font=F 8 $true}
        else              {$stepEls[$i].ForeColor=$cFaint; $stepEls[$i].Font=F 8}
    }
    $form.Refresh()
}

$btnBack  =Btn "< Back"   20 526  90 32 $false
$btnNext  =Btn "Next >"  520 526 100 32 $true
$btnCancel=Btn "Cancel"  415 526  95 32 $false
$form.Controls.AddRange(@($btnBack,$btnNext,$btnCancel))
$btnBack.Visible=$false
$btnCancel.Add_Click({$form.Close()})

$pages=@(); for($i=0;$i -lt 6;$i++){
    $p=Pnl 0 118 640 400; $p.Visible=($i -eq 0); $form.Controls.Add($p); $pages+=$p
}
$Script:CurPage=0
function ShowPage($n){
    for($i=0;$i -lt $pages.Count;$i++){$pages[$i].Visible=($i -eq $n)}
    $Script:CurPage=$n; SetStep $n
    $btnBack.Visible=($n -eq 1); $form.Refresh()
}

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 0 — WELCOME
# ══════════════════════════════════════════════════════════════════════════════
$pg=$pages[0]
$pg.Controls.Add((Lbl "Welcome to ProxhqVPN" 30 18 520 32 (F 16 $true) $cWhite))
$pg.Controls.Add((Lbl "All 4 server tunnels install at once — switch servers anytime without re-downloading." 30 52 570 22 (F 10) $cDim))

$feats=@(
    @("⚡","WireGuard downloaded from wireguard.com and installed silently"),
    @("🌍","All 4 servers installed: Los Angeles  ·  Chicago  ·  London  ·  Tokyo"),
    @("🔄","Switch servers anytime from the Done screen or the desktop switcher app"),
    @("🛡","Choose Split Tunnel (recommended) or Full Tunnel mode"),
    @("🌐","Sign in at ProxhqVPN → download your All Servers Pack → wizard activates all tunnels"),
    @("🧹","Zero-logs policy — no traffic stored or monitored")
)
$fy=88; foreach($f in $feats){
    $pg.Controls.Add((Lbl $f[0] 30 $fy 28 26 (F 13) $cGreen))
    $pg.Controls.Add((Lbl $f[1] 62 $fy 540 26 (F 10) $cDim))
    $fy+=30
}
$pg.Controls.Add((Pnl 30 296 572 1 $cFaint))
$pg.Controls.Add((Lbl "Servers included in this installation:" 30 302 400 18 (F 9 $true) $cGreenD))
$serverList=@("🇺🇸  Los Angeles, US — 108.61.219.202","🇺🇸  Chicago, US — 45.63.79.138","🇬🇧  London, GB — 192.248.160.69","🇯🇵  Tokyo, JP — 45.76.97.51")
$sx=30; foreach($s in $serverList){ $pg.Controls.Add((Lbl $s $sx 322 540 18 (F 8.5) $cDim)); $sx+=0; $fy+=0 }
# lay them out in 2 columns
$col=0; $row=0
foreach($s in $serverList){
    $pg.Controls.Add((Lbl $s (30+$col*290) (322+$row*20) 280 18 (F 8.5) $cDim))
    $col++; if($col -ge 2){$col=0;$row++}
}

$btnNext.Add_Click({
    if($Script:CurPage -eq 0){ShowPage 1;$btnNext.Text="Install >";return}
    if($Script:CurPage -eq 1){
        if(-not $chkLic.Checked){
            [Windows.Forms.MessageBox]::Show("Please accept the license agreement to continue.","ProxhqVPN","OK","Warning")|Out-Null;return
        }
        StartInstall;return
    }
})
$btnBack.Add_Click({if($Script:CurPage -eq 1){ShowPage 0;$btnNext.Text="Next >"}})

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 1 — LICENSE + TUNNEL MODE
# ══════════════════════════════════════════════════════════════════════════════
$pg=$pages[1]
$pg.Controls.Add((Lbl "License Agreement & VPN Tunnel Mode" 30 14 570 28 (F 14 $true) $cWhite))
$pg.Controls.Add((Lbl "Accept the license, then choose how your tunnels route traffic." 30 44 570 20 (F 10) $cDim))

$licBox=RBox 30 68 572 104
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
$chkLic.Left=30;$chkLic.Top=178;$chkLic.Width=570;$chkLic.Height=22
$chkLic.Text="I accept the license agreement and consent to WireGuard installation"
$chkLic.ForeColor=$cWhite;$chkLic.Font=F 10;$chkLic.BackColor=[Drawing.Color]::Transparent
$pg.Controls.Add($chkLic)
$pg.Controls.Add((Lbl "VPN TUNNEL MODE  (applies to all servers)" 30 212 400 16 (F 8 $true) $cGreenD))

function MakeTCard($x,$title,$desc,$tag,$tagClr,$isDef){
    $c=Pnl $x 230 272 122 $cBg3;$c.Cursor=[Windows.Forms.Cursors]::Hand
    if($isDef){$c.BackColor=[Drawing.Color]::FromArgb(5,35,18)}
    $tl=Lbl $title 10 10 252 20 (F 10 $true) (if($isDef){$cGreen}else{$cOrange});$c.Controls.Add($tl)
    $ds=Lbl $desc  10 34 252 50 (F 8.5) $cDim;$c.Controls.Add($ds)
    $tg=Lbl $tag   10 90 200 18 (F 8) $tagClr;$c.Controls.Add($tg);$c
}
$cardSplit=MakeTCard 30  "⚡ Split Tunnel  ★ Recommended" "Only ProxhqVPN traffic tunnels. All apps and streaming work normally." "✓ Apps unaffected" $cGreenD $true
$cardFull =MakeTCard 336 "🔒 Full Tunnel"                 "All internet traffic routes through ProxhqVPN. Maximum privacy."      "⚠ May slow some apps" $cOrange $false
$pg.Controls.AddRange(@($cardSplit,$cardFull))

function SelTunnel($m){
    $Script:TunnelMode=$m
    if($m -eq "split"){$cardSplit.BackColor=[Drawing.Color]::FromArgb(5,40,20);$cardFull.BackColor=$cBg3}
    else{$cardFull.BackColor=[Drawing.Color]::FromArgb(36,20,4);$cardSplit.BackColor=$cBg3}
    $form.Refresh()
}
$cardSplit.Add_Click({SelTunnel "split"});foreach($c in $cardSplit.Controls){$c.Add_Click({SelTunnel "split"})}
$cardFull.Add_Click({SelTunnel "full"});foreach($c in $cardFull.Controls){$c.Add_Click({SelTunnel "full"})}
SelTunnel "split"

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 2 — WIREGUARD INSTALL
# ══════════════════════════════════════════════════════════════════════════════
$pg=$pages[2]
$p2hdr =Lbl "Installing WireGuard" 30 14 520 28 (F 14 $true) $cWhite
$p2sub =Lbl "Downloading and installing silently — takes about 30 seconds." 30 44 570 20 (F 10) $cDim
$p2prog=PBar 30 74 572
$p2step=Lbl "Preparing..." 30 88 570 20 (F 9.5) $cGreenD
$p2log =RBox 30 112 572 216
$p2err =Pnl 30 334 572 48 ([Drawing.Color]::FromArgb(40,0,0))
$p2errL=Lbl "" 10 10 552 28 (F 9) $cRed;$p2err.Controls.Add($p2errL);$p2err.Visible=$false

function MkBadge($t,$x){
    $b=New-Object Windows.Forms.Label
    $b.Text=$t;$b.Left=$x;$b.Top=348;$b.Width=155;$b.Height=24
    $b.TextAlign="MiddleCenter";$b.Font=F 9;$b.ForeColor=$cFaint;$b.BackColor=$cBg3;$b
}
$ph1=MkBadge "① WireGuard"  30
$ph2=MkBadge "② Sign In"    200
$ph3=MkBadge "③ All Tunnels" 370
$pg.Controls.AddRange(@($p2hdr,$p2sub,$p2prog,$p2step,$p2log,$p2err,$ph1,$ph2,$ph3))

function SetPhase($w){
    @($ph1,$ph2,$ph3)|ForEach-Object{$_.ForeColor=$cFaint;$_.BackColor=$cBg3}
    $w.ForeColor=$cBlack;$w.BackColor=$cGreen;$form.Refresh()
}
function L2($m){$p2log.AppendText("> $m`n");$p2log.ScrollToCaret();$form.Refresh()}
function P2($m,$pct){$p2step.Text=$m;$p2prog.Value=[Math]::Min([int]$pct,100);$form.Refresh()}

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 3 — SIGN IN & DOWNLOAD ALL SERVERS PACK
# ══════════════════════════════════════════════════════════════════════════════
$pg=$pages[3]
$pg.Controls.Add((Lbl "Sign In & Download All Servers Pack" 30 14 560 28 (F 14 $true) $cWhite))
$pg.Controls.Add((Lbl "Your default browser has opened. Follow these 3 steps:" 30 46 560 20 (F 10) $cDim))

$steps3=@(
    "1.  Sign in to your ProxhqVPN account.",
    "2.  Go to  My VPN  and click  Download All Servers Pack.",
    "3.  Save  proxhqvpn-all-servers.zip  — wizard detects it and installs all tunnels."
)
$sy=74; foreach($s in $steps3){
    $pg.Controls.Add((Lbl $s 30 $sy 570 24 (F 10 $true) $cGreen));$sy+=28
}

$p3zipBadge=Pnl 30 162 572 28 ([Drawing.Color]::FromArgb(5,35,18))
$p3zipLbl  =Lbl "Watching for  proxhqvpn-all-servers.zip  in your Downloads folder..." 10 5 552 18 (F 9) $cGreenD
$p3zipBadge.Controls.Add($p3zipLbl)
$pg.Controls.Add($p3zipBadge)

$pg.Controls.Add((Lbl "Waiting for download..." 30 198 400 20 (F 9.5) $cDim))
$p3timer=Lbl "" 30 220 570 22 (F 9.5) $cGreenD
$p3bar  =PBar 30 246 572
$p3log  =RBox 30 258 572 96

$p3noticeBox=Pnl 30 362 572 24 ([Drawing.Color]::FromArgb(5,35,18))
$p3noticeLbl=Lbl "Browser not opened? Click here to reopen ProxhqVPN." 10 3 550 18 (F 9) $cGreen
$p3noticeLbl.Cursor=[Windows.Forms.Cursors]::Hand
$p3noticeBox.Controls.Add($p3noticeLbl)
$pg.Controls.AddRange(@($p3timer,$p3bar,$p3log,$p3noticeBox))
function L3($m){$p3log.AppendText("> $m`n");$p3log.ScrollToCaret();$form.Refresh()}

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 4 — INSTALLING ALL TUNNELS
# ══════════════════════════════════════════════════════════════════════════════
$pg=$pages[4]
$p4hdr =Lbl "Installing All VPN Tunnels" 30 14 520 28 (F 14 $true) $cWhite
$p4sub =Lbl "Applying tunnel mode and registering all servers with WireGuard." 30 44 570 20 (F 10) $cDim
$p4prog=PBar 30 74 572
$p4step=Lbl "Starting..." 30 88 570 20 (F 9.5) $cGreenD
$p4log =RBox 30 112 572 240
$pg.Controls.AddRange(@($p4hdr,$p4sub,$p4prog,$p4step,$p4log))
function L4($m){$p4log.AppendText("> $m`n");$p4log.ScrollToCaret();$form.Refresh()}
function P4($m,$pct){$p4step.Text=$m;$p4prog.Value=[Math]::Min([int]$pct,100);$form.Refresh()}

# ══════════════════════════════════════════════════════════════════════════════
# PAGE 5 — DONE + LIVE SERVER SWITCHER
# ══════════════════════════════════════════════════════════════════════════════
$pg=$pages[5]
$pg.Controls.Add((Lbl "✓" 26 8 52 52 (F 28 $true) $cGreen))
$p5title=Lbl "All Servers Ready!" 82 14 460 30 (F 16 $true) $cWhite
$p5sub  =Lbl "" 82 48 460 18 (F 9) $cDim
$pg.Controls.AddRange(@($p5title,$p5sub))
$pg.Controls.Add((Lbl "SWITCH SERVER — click any server to connect" 30 74 560 16 (F 8 $true) $cGreenD))

$Script:DoneCards = @{}
$Script:DoneStatusLbl = Lbl "Connecting..." 30 358 440 20 (F 9 $true) $cGreenD
$Script:DoneStatusLbl.Visible=$false
$pg.Controls.Add($Script:DoneStatusLbl)

function BuildDoneGrid {
    foreach($key in $Script:DoneCards.Keys){ $pg.Controls.Remove($Script:DoneCards[$key]) }
    $Script:DoneCards.Clear()
    $cx=0;$cy=0
    foreach($srv in $Script:InstalledConfs){
        $s=$srv
        $x=30+$cx*300; $y=90+$cy*124
        $card=Pnl $x $y 282 112 $cBg3
        $card.Cursor=[Windows.Forms.Cursors]::Hand;$card.BorderStyle="FixedSingle"
        $fl=Lbl $s.flag   10 10  36 36 (F 18) $cWhite;  $card.Controls.Add($fl)
        $rl=Lbl $s.region 52 10 218 20 (F 10 $true) $cWhite; $card.Controls.Add($rl)
        $nl=Lbl $s.name   52 32 218 16 (F 7.5) $cFaint; $card.Controls.Add($nl)
        $al=Lbl "▶ Connect" 10 72 262 22 (F 9 $true) $cGreen;$al.TextAlign="MiddleRight";$card.Controls.Add($al)
        $Script:DoneCards[$s.name]=$card
        $pg.Controls.Add($card)
        $cx++; if($cx -ge 2){$cx=0;$cy++}

        $sname=$s.name; $spath=$s.path
        $clickFn=[scriptblock]::Create("SwitchOnDone '$sname' '$spath'")
        $card.Add_Click($clickFn)
        foreach($child in $card.Controls){$child.Add_Click($clickFn)}
    }
    RefreshDoneCards
}

function RefreshDoneCards {
    foreach($key in $Script:DoneCards.Keys){
        $card=$Script:DoneCards[$key]
        if($key -eq $Script:ActiveTunnel){
            $card.BackColor=[Drawing.Color]::FromArgb(5,40,20)
        } else {
            $card.BackColor=$cBg3
        }
    }
    $form.Refresh()
}

function SwitchOnDone($name,$path){
    $Script:DoneStatusLbl.Text="Switching to $name...";$Script:DoneStatusLbl.Visible=$true;$form.Refresh()
    # Stop all proxhqvpn tunnels
    foreach($s in $Script:InstalledConfs){
        try{
            $p=Start-Process -FilePath $WG_EXE -ArgumentList "/uninstalltunnel $($s.name)" -PassThru -ErrorAction SilentlyContinue
            if($p){while(-not $p.HasExited){[Windows.Forms.Application]::DoEvents();Start-Sleep -ms 80}}
        }catch{}
    }
    Start-Sleep -Milliseconds 300
    # Activate selected
    try{
        $p2=Start-Process -FilePath $WG_EXE -ArgumentList "/installtunnel `"$path`"" -PassThru -ErrorAction Stop
        while(-not $p2.HasExited){[Windows.Forms.Application]::DoEvents();Start-Sleep -ms 80}
        if($p2.ExitCode -eq 0){
            $Script:ActiveTunnel=$name
            $Script:DoneStatusLbl.Text="Connected: $name"
        } else {
            $Script:DoneStatusLbl.Text="Switch failed (exit $($p2.ExitCode)) — try as administrator"
            $Script:DoneStatusLbl.ForeColor=$cOrange
        }
    }catch{
        $Script:DoneStatusLbl.Text="Error: $_"
        $Script:DoneStatusLbl.ForeColor=$cRed
    }
    RefreshDoneCards
}

# ══════════════════════════════════════════════════════════════════════════════
# INSTALL LOGIC
# ══════════════════════════════════════════════════════════════════════════════
function StartInstall {
    $btnNext.Visible=$false;$btnBack.Visible=$false;$btnCancel.Enabled=$false
    ShowPage 2;SetPhase $ph1

    New-Item -ItemType Directory -Force -Path $INSTALL|Out-Null
    [System.IO.File]::WriteAllText("$INSTALL\config.json",
        "{`"tunnelMode`":`"$($Script:TunnelMode)`",`"hostname`":`"$HOSTNAME`",`"version`":`"5.0`"}")

    if(Test-Path $WG_EXE){
        P2 "WireGuard already installed — skipping download." 68
        L2 "Found $WG_EXE"
        $Script:WgInstalled=$true
        Start-Sleep -Milliseconds 400
    } else {
        P2 "Downloading WireGuard from wireguard.com..." 5
        L2 "Connecting to download.wireguard.com ..."
        $tmp="$env:TEMP\proxhq-wg-setup.exe"; $dlOk=$false
        try{
            $wc=New-Object System.Net.WebClient
            $wc.Headers.Add("User-Agent","ProxhqVPN-Installer/5.0")
            $wc.Add_DownloadProgressChanged({
                P2 ("Downloading WireGuard... "+$_.ProgressPercentage+"%") ([int]($_.ProgressPercentage*0.55)+5)
            })
            $task=$wc.DownloadFileTaskAsync($WG_URL,$tmp)
            while(-not $task.IsCompleted){[System.Windows.Forms.Application]::DoEvents();Start-Sleep -ms 50}
            if($task.IsFaulted){throw $task.Exception.InnerException.Message}
            L2 "Download complete.";$dlOk=$true
        }catch{
            L2 "WebClient error: $_ — trying Invoke-WebRequest fallback..."
            try{
                Invoke-WebRequest -Uri $WG_URL -OutFile $tmp -UseBasicParsing -ErrorAction Stop
                L2 "Download complete (fallback).";$dlOk=$true
            }catch{
                L2 "ERROR: Download failed: $_"
                $p2errL.Text="Download failed — check internet connection and re-run.";$p2err.Visible=$true
            }
        }
        if($dlOk){
            P2 "Installing WireGuard silently (/S flag)..." 62
            L2 "Running wireguard-installer.exe /S ..."
            try{
                $proc=Start-Process -FilePath $tmp -ArgumentList "/S" -PassThru -ErrorAction Stop
                while(-not $proc.HasExited){[System.Windows.Forms.Application]::DoEvents();Start-Sleep -ms 100}
                if($proc.ExitCode -eq 0){L2 "WireGuard installed (exit 0)."}else{L2 "Exit code $($proc.ExitCode) — verifying..."}
                $Script:WgInstalled=(Test-Path $WG_EXE)
                if($Script:WgInstalled){L2 "Verified: wireguard.exe found."}
                else{L2 "WARNING: wireguard.exe not found after install."}
            }catch{
                L2 "Install error: $_ — WireGuard may need manual install from wireguard.com"
                $Script:WgInstalled=$false
            }
            try{Remove-Item $tmp -Force -ErrorAction SilentlyContinue}catch{}
        }
    }

    # Shortcuts
    P2 "Creating shortcuts..." 75;L2 ""
    try{
        $ws=New-Object -ComObject WScript.Shell
        $sc=$ws.CreateShortcut("$env:USERPROFILE\Desktop\ProxhqVPN.lnk")
        $sc.TargetPath=$BASE_URL;$sc.Description="Open ProxhqVPN";$sc.Save()
        L2 "Desktop shortcut: ProxhqVPN."
    }catch{L2 "Desktop shortcut: $_"}
    try{
        $smDir="$env:APPDATA\Microsoft\Windows\Start Menu\Programs\ProxhqVPN"
        New-Item -ItemType Directory -Force -Path $smDir|Out-Null
        $ws2=New-Object -ComObject WScript.Shell
        $sc2=$ws2.CreateShortcut("$smDir\ProxhqVPN.lnk");$sc2.TargetPath=$BASE_URL;$sc2.Save()
    }catch{}
    try{
        $reg="HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ProxhqVPN"
        New-Item -Path $reg -Force|Out-Null
        Set-ItemProperty $reg "DisplayName" "ProxhqVPN"
        Set-ItemProperty $reg "DisplayVersion" "5.0.0"
        Set-ItemProperty $reg "Publisher" $PUBLISHER
        Set-ItemProperty $reg "URLInfoAbout" $BASE_URL
        L2 "Registered in Add/Remove Programs."
    }catch{}

    # Copy SwitchServer.ps1 to install dir and create shortcut
    $switchSrc="$PSScriptRoot\SwitchServer.ps1"
    $switchDst="$INSTALL\SwitchServer.ps1"
    if(Test-Path $switchSrc){
        try{
            Copy-Item $switchSrc $switchDst -Force
            $ws3=New-Object -ComObject WScript.Shell
            $sc3=$ws3.CreateShortcut("$env:USERPROFILE\Desktop\Switch VPN Server.lnk")
            $sc3.TargetPath="powershell.exe"
            $sc3.Arguments="-ExecutionPolicy Bypass -WindowStyle Hidden -File `"$switchDst`""
            $sc3.Description="Switch ProxhqVPN Server"
            $sc3.Save()
            L2 "Desktop shortcut: Switch VPN Server."
        }catch{L2 "Switcher shortcut: $_"}
    }

    P2 "WireGuard ready — opening sign-in..." 100;L2 ""
    Start-Sleep -Milliseconds 400
    StartSignIn
}

function StartSignIn {
    SetPhase $ph2;ShowPage 3

    $redirectPath="/dashboard/wireguard?autosetup=1&hostname=$HOSTNAME&tunnelmode=$($Script:TunnelMode)&downloadall=1"
    $signInUrl="$BASE_URL/sign-in?redirect_url="+[System.Uri]::EscapeDataString($redirectPath)
    Start-Process $signInUrl
    L3 "Browser opened — sign in, then go to My VPN → Download All Servers Pack."
    L3 "Save the zip to your Downloads folder — this wizard will detect it automatically."
    $p3noticeLbl.Add_Click({Start-Process $signInUrl})

    # Watch for proxhqvpn-all-servers.zip
    $dlDir="$env:USERPROFILE\Downloads"
    $zipTarget="proxhqvpn-all-servers.zip"
    $existingZip=Test-Path "$dlDir\$zipTarget"

    $waitSec=600;$elapsed=0;$foundZip=$null
    while($elapsed -lt $waitSec){
        [System.Windows.Forms.Application]::DoEvents()
        Start-Sleep -Milliseconds 500;$elapsed+=0.5
        $pct=[int](($elapsed/$waitSec)*100)
        $p3bar.Value=[Math]::Min($pct,99)
        $remaining=[int]($waitSec-$elapsed)
        $p3timer.Text="Watching for $zipTarget ...  ($remaining s remaining)"
        $form.Refresh()

        $zipPath="$dlDir\$zipTarget"
        if(Test-Path $zipPath){
            # Make sure it's not still being written (size stable for 0.5s)
            $sz1=(Get-Item $zipPath).Length
            Start-Sleep -Milliseconds 600
            $sz2=(Get-Item $zipPath -ErrorAction SilentlyContinue)?.Length
            if($sz1 -eq $sz2 -and $sz1 -gt 0){$foundZip=$zipPath;break}
        }
    }

    if($foundZip){
        L3 "Detected: $([IO.Path]::GetFileName($foundZip))"
        Start-Sleep -Milliseconds 300
        InstallAllTunnels $foundZip
    } else {
        L3 "Timed out — no zip file detected after 10 minutes."
        L3 "Download proxhqvpn-all-servers.zip from My VPN and try again."
        $p3timer.Text="Timed out.";$p3timer.ForeColor=$cOrange
        FinishSetup
    }
}

function InstallAllTunnels($zipPath){
    SetPhase $ph3;ShowPage 4

    P4 "Extracting server configs..." 10
    L4 "Zip file: $([IO.Path]::GetFileName($zipPath))"
    L4 "Destination: $WG_DIR"

    # Extract zip to WG_DIR
    if(-not (Test-Path $WG_DIR)){New-Item -ItemType Directory -Force -Path $WG_DIR|Out-Null}
    try{
        Expand-Archive -Path $zipPath -DestinationPath $WG_DIR -Force -ErrorAction Stop
        L4 "Extracted OK."
    }catch{
        L4 "Expand-Archive failed: $_ — trying .NET fallback..."
        try{
            Add-Type -AssemblyName System.IO.Compression.FileSystem
            [System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath,$WG_DIR)
            L4 "Extracted OK (.NET)."
        }catch{
            L4 "ERROR: Could not extract zip: $_"
            P4 "Extraction failed." 100
            FinishSetup;return
        }
    }

    # Apply tunnel mode to each config
    $confFiles=@(Get-ChildItem "$WG_DIR\proxhqvpn-*.conf" -ErrorAction SilentlyContinue)
    L4 "Found $($confFiles.Count) config file(s)."

    if($confFiles.Count -eq 0){
        L4 "ERROR: No proxhqvpn-*.conf files found in $WG_DIR"
        P4 "No configs found." 100;FinishSetup;return
    }

    $idx=0;$total=$confFiles.Count
    foreach($cf in $confFiles){
        $idx++
        $pct=[int](($idx/$total)*80)+10
        $tn=[IO.Path]::GetFileNameWithoutExtension($cf.Name)
        P4 "[$idx/$total] Installing tunnel: $tn ..." $pct
        L4 "Processing: $($cf.Name)"

        # Apply tunnel mode
        $conf=[System.IO.File]::ReadAllText($cf.FullName)
        if($Script:TunnelMode -eq "split"){
            $conf=[System.Text.RegularExpressions.Regex]::Replace($conf,
                "(?m)AllowedIPs\s*=\s*0\.0\.0\.0/0[^\r\n]*","AllowedIPs = 10.8.0.0/24")
            $conf=[System.Text.RegularExpressions.Regex]::Replace($conf,",\s*::[/0-9]+","")
        }
        [System.IO.File]::WriteAllText($cf.FullName,$conf)

        # Install tunnel
        if(Test-Path $WG_EXE){
            try{
                # Remove old tunnel if exists
                Start-Process -FilePath $WG_EXE -ArgumentList "/uninstalltunnel $tn" -Wait -ErrorAction SilentlyContinue | Out-Null
                Start-Sleep -Milliseconds 200
                $tp=Start-Process -FilePath $WG_EXE -ArgumentList "/installtunnel `"$($cf.FullName)`"" -PassThru -ErrorAction Stop
                while(-not $tp.HasExited){[System.Windows.Forms.Application]::DoEvents();Start-Sleep -ms 80}
                if($tp.ExitCode -eq 0){
                    L4 "  ✓ $tn installed."
                    $stem=[IO.Path]::GetFileNameWithoutExtension($cf.Name)
                    $Script:InstalledConfs+=@{
                        name=$tn
                        path=$cf.FullName
                        region=RegionLabel $cf.Name
                        flag=RegionFlag $stem
                    }
                } else {
                    L4 "  ⚠ $tn exit code $($tp.ExitCode)"
                }
            }catch{L4 "  ERROR: $tn — $_"}
        } else {
            L4 "  wireguard.exe not found — tunnel not installed."
        }
        [System.Windows.Forms.Application]::DoEvents()
    }

    # Also copy configs to INSTALL dir
    try{
        foreach($cf in $confFiles){Copy-Item $cf.FullName "$INSTALL\" -Force -ErrorAction SilentlyContinue}
    }catch{}

    P4 "Done! $($Script:InstalledConfs.Count)/$total tunnels installed." 100
    L4 ""
    L4 "Tunnel mode: $($Script:TunnelMode)"
    L4 "To switch servers anytime: use the 'Switch VPN Server' desktop shortcut."
    Start-Sleep -Milliseconds 800
    FinishSetup
}

function FinishSetup {
    # Activate the first installed tunnel by default
    if($Script:InstalledConfs.Count -gt 0 -and (Test-Path $WG_EXE)){
        $first=$Script:InstalledConfs[0]
        try{
            $p=Start-Process -FilePath $WG_EXE -ArgumentList "/installtunnel `"$($first.path)`"" -PassThru -ErrorAction SilentlyContinue
            if($p){while(-not $p.HasExited){[System.Windows.Forms.Application]::DoEvents();Start-Sleep -ms 80}}
            $Script:ActiveTunnel=$first.name
        }catch{}
    }

    if(-not $Script:FinishBound){
        $Script:FinishBound=$true
        $btnNext.Add_Click({Start-Process "$BASE_URL/dashboard";$form.Close()})
    }
    $count=$Script:InstalledConfs.Count
    $p5sub.Text=if($count -gt 0){"$count tunnel(s) installed · use the server cards below to switch anytime"}else{"WireGuard installed. Re-download the All Servers Pack from My VPN."}
    BuildDoneGrid
    ShowPage 5
    $btnNext.Text="Open ProxhqVPN";$btnNext.Visible=$true
    $btnBack.Visible=$false
    $btnCancel.Text="Close";$btnCancel.Enabled=$true
}

# ── Run ───────────────────────────────────────────────────────────────────────
SetStep 0
[System.Windows.Forms.Application]::Run($form)
