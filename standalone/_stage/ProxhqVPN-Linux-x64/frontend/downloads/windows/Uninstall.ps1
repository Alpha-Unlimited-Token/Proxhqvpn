# ProxhqVPN Windows Uninstaller v5.1
# © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
# Run via: right-click → Run with PowerShell  (or from Add/Remove Programs)

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $a = '-ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $MyInvocation.MyCommand.Path + '"'
    Start-Process powershell.exe -ArgumentList $a -Verb RunAs; exit
}

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$WG_EXE  = "C:\Program Files\WireGuard\wireguard.exe"
$WG_DIR  = "C:\ProgramData\WireGuard"
$INSTALL = "$env:LOCALAPPDATA\ProxhqVPN"
$REG_KEY = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\ProxhqVPN"

$cBg    = [Drawing.Color]::FromArgb(4, 10, 6)
$cBg2   = [Drawing.Color]::FromArgb(8, 18, 10)
$cGreen = [Drawing.Color]::FromArgb(0, 255, 136)
$cWhite = [Drawing.Color]::White
$cDim   = [Drawing.Color]::FromArgb(160, 200, 170)
$cFaint = [Drawing.Color]::FromArgb(60, 90, 70)
$cRed   = [Drawing.Color]::FromArgb(255, 80, 80)
$cOrange= [Drawing.Color]::FromArgb(255, 179, 71)

function F($sz,$bold=$false){ New-Object Drawing.Font("Segoe UI",$sz,(if($bold){[Drawing.FontStyle]::Bold}else{[Drawing.FontStyle]::Regular})) }
function FM($sz){ New-Object Drawing.Font("Consolas",$sz) }
function Lbl($t,$x,$y,$w,$h,$f,$c){
    $l=New-Object Windows.Forms.Label
    $l.Text=$t;$l.Left=$x;$l.Top=$y;$l.Width=$w;$l.Height=$h
    $l.Font=$f;$l.ForeColor=$c;$l.BackColor=[Drawing.Color]::Transparent;$l
}

# ── Confirm dialog ────────────────────────────────────────────────────────────
$confirm = [Windows.Forms.MessageBox]::Show(
    "This will remove all ProxhqVPN VPN tunnels, configs, shortcuts, and install data from this PC.`n`nWireGuard itself will NOT be removed (you may use it for other VPNs).`n`nAre you sure you want to uninstall ProxhqVPN?",
    "ProxhqVPN Uninstaller",
    [Windows.Forms.MessageBoxButtons]::YesNo,
    [Windows.Forms.MessageBoxIcon]::Warning
)
if ($confirm -ne [Windows.Forms.DialogResult]::Yes) { exit 0 }

# ── Progress form ─────────────────────────────────────────────────────────────
$form = New-Object Windows.Forms.Form
$form.Text = "ProxhqVPN Uninstaller"
$form.Size = New-Object Drawing.Size(520, 340)
$form.StartPosition = "CenterScreen"
$form.BackColor = $cBg
$form.FormBorderStyle = "FixedDialog"
$form.MaximizeBox = $false

$hdr = New-Object Windows.Forms.Panel
$hdr.Size = New-Object Drawing.Size(520, 64)
$hdr.BackColor = $cBg2
$hdr.Controls.Add((Lbl "ProxhqVPN Uninstaller" 20 10 400 30 (F 16 $true) $cRed))
$hdr.Controls.Add((Lbl "ALPHA UNLIMITED TECHNOLOGIES LLC" 20 44 400 16 (F 8) $cFaint))
$form.Controls.Add($hdr)

$statusLbl = Lbl "Starting..." 20 80 470 22 (F 10 $true) $cOrange
$form.Controls.Add($statusLbl)

$pbar = New-Object Windows.Forms.ProgressBar
$pbar.Left=20; $pbar.Top=108; $pbar.Width=470; $pbar.Height=7
$pbar.Style=[Windows.Forms.ProgressBarStyle]::Continuous; $pbar.Value=0
$form.Controls.Add($pbar)

$log = New-Object Windows.Forms.RichTextBox
$log.Left=20; $log.Top=124; $log.Width=470; $log.Height=150
$log.BackColor=$cBg2; $log.ForeColor=[Drawing.Color]::FromArgb(0,180,80)
$log.Font=FM 8.5; $log.BorderStyle="FixedSingle"; $log.ReadOnly=$true; $log.ScrollBars="Vertical"
$form.Controls.Add($log)

$btnClose = New-Object Windows.Forms.Button
$btnClose.Text="Close"; $btnClose.Left=390; $btnClose.Top=284; $btnClose.Width=100; $btnClose.Height=32
$btnClose.FlatStyle=[Windows.Forms.FlatStyle]::Flat; $btnClose.BackColor=$cBg2
$btnClose.ForeColor=$cDim; $btnClose.Font=F 10 $true; $btnClose.Enabled=$false
$btnClose.Add_Click({$form.Close()})
$form.Controls.Add($btnClose)

function L($msg) {
    $log.AppendText("$msg`r`n")
    $log.ScrollToCaret()
    [Windows.Forms.Application]::DoEvents()
}
function Status($msg,$pct) {
    $statusLbl.Text = $msg; $pbar.Value = [Math]::Min($pct,100)
    [Windows.Forms.Application]::DoEvents()
}

$form.Show()
[Windows.Forms.Application]::DoEvents()

# ── STEP 1: Remove tunnels ────────────────────────────────────────────────────
Status "Removing VPN tunnels..." 10
L "=== ProxhqVPN Uninstall Started ==="
L ""
L "[1/5] Removing WireGuard tunnels..."

$confFiles = @()
if (Test-Path $WG_DIR) {
    $confFiles = @(Get-ChildItem "$WG_DIR\proxhqvpn-*.conf" -ErrorAction SilentlyContinue)
}
if (Test-Path $INSTALL) {
    $confFiles += @(Get-ChildItem "$INSTALL\proxhqvpn-*.conf" -ErrorAction SilentlyContinue)
}

if ($confFiles.Count -eq 0) {
    L "  No ProxhqVPN configs found — may already be removed."
} else {
    foreach ($cf in $confFiles) {
        $tn = [IO.Path]::GetFileNameWithoutExtension($cf.Name)
        L "  Removing tunnel: $tn"
        if (Test-Path $WG_EXE) {
            try {
                $p = Start-Process -FilePath $WG_EXE -ArgumentList "/uninstalltunnel $tn" -PassThru -Wait -ErrorAction SilentlyContinue
                L "    wireguard.exe /uninstalltunnel $tn — exit: $($p.ExitCode)"
            } catch { L "    Could not call wireguard.exe: $_" }
        }
        try { Remove-Item $cf.FullName -Force -ErrorAction Stop; L "    Removed: $($cf.FullName)" }
        catch { L "    Warning: Could not remove $($cf.FullName): $_" }
    }
    L "  $($confFiles.Count) tunnel(s) removed."
}

Status "Removing shortcuts..." 35

# ── STEP 2: Remove Desktop shortcuts ─────────────────────────────────────────
L ""
L "[2/5] Removing Desktop shortcuts..."
$desktop = [Environment]::GetFolderPath("Desktop")
$shortcuts = @(
    "$desktop\Switch VPN Server.lnk",
    "$desktop\ProxhqVPN.lnk",
    "$desktop\ProxhqVPN.url"
)
$publicDesktop = "C:\Users\Public\Desktop"
$shortcuts += @(
    "$publicDesktop\Switch VPN Server.lnk",
    "$publicDesktop\ProxhqVPN.lnk"
)
foreach ($s in $shortcuts) {
    if (Test-Path $s) {
        Remove-Item $s -Force -ErrorAction SilentlyContinue
        L "  Removed: $(Split-Path $s -Leaf)"
    }
}
L "  Shortcuts removed."

Status "Removing install data..." 55

# ── STEP 3: Remove registry entry ────────────────────────────────────────────
L ""
L "[3/5] Removing registry uninstall entry..."
try {
    if (Test-Path $REG_KEY) {
        Remove-Item $REG_KEY -Recurse -Force -ErrorAction Stop
        L "  Registry entry removed."
    } else {
        L "  No registry entry found (skipped)."
    }
} catch { L "  Warning: Could not remove registry key: $_" }

Status "Removing app data..." 70

# ── STEP 4: Remove install directory ─────────────────────────────────────────
L ""
L "[4/5] Removing install directory..."
if (Test-Path $INSTALL) {
    try {
        Remove-Item $INSTALL -Recurse -Force -ErrorAction Stop
        L "  Removed: $INSTALL"
    } catch { L "  Warning: Could not fully remove $INSTALL : $_" }
} else {
    L "  Install dir not found (skipped)."
}

Status "Finalizing..." 90

# ── STEP 5: Done ─────────────────────────────────────────────────────────────
L ""
L "[5/5] Uninstall complete."
L ""
L "WireGuard is still installed on this PC."
L "To remove it: Control Panel → Programs → WireGuard → Uninstall"
L ""
L "=== ProxhqVPN Uninstall Done ==="

Status "Done — ProxhqVPN removed successfully." 100
$btnClose.Enabled = $true
$btnClose.BackColor = [Drawing.Color]::FromArgb(0, 200, 100)
$btnClose.ForeColor = [Drawing.Color]::Black
$btnClose.Text = "Close"

[Windows.Forms.MessageBox]::Show(
    "ProxhqVPN has been successfully removed from this PC.`n`nWireGuard was NOT removed.`nTo remove WireGuard: Control Panel → Programs → WireGuard → Uninstall",
    "ProxhqVPN Uninstaller",
    [Windows.Forms.MessageBoxButtons]::OK,
    [Windows.Forms.MessageBoxIcon]::Information
) | Out-Null

[System.Windows.Forms.Application]::Run($form)
