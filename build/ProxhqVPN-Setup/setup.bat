@echo off
title ProxhqVPN Setup
color 0A

echo.
echo  ================================================
echo   ProxhqVPN Setup by Alpha Unlimited Technologies
echo  ================================================
echo.

REM Check for Administrator privileges
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo  Requesting administrator privileges...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

REM Launch the PowerShell installer wizard
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0installer.ps1"

exit /b
