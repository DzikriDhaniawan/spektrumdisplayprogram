@echo off
title Memulai Digital Signage Kiosk
cd /d "%~dp0"
color 0a

echo ===================================================
echo       MEMULAI DIGITAL SIGNAGE KIOSK TV
echo ===================================================
echo.
echo [1/2] Memindai dan memperbarui daftar video...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scan-videos.ps1"

echo.
echo [2/2] Membuka Tampilan Digital Signage di Layar Penuh...

:: Format path file menjadi URL browser yang valid
set "HTML_PATH=%~dp0index.html"
set "HTML_PATH=%HTML_PATH:\=/%"
set "TARGET_URL=file:///%HTML_PATH%"

:: 1. Coba Microsoft Edge (Bawaan Windows 10 & 11)
where msedge >nul 2>nul
if %errorlevel% equ 0 (
    echo Menggunakan Microsoft Edge Kiosk Mode...
    start msedge --start-fullscreen --autoplay-policy=no-user-gesture-required --app="%TARGET_URL%"
    goto :finish
)

:: 2. Coba Google Chrome jika terpasang
where chrome >nul 2>nul
if %errorlevel% equ 0 (
    echo Menggunakan Google Chrome Kiosk Mode...
    start chrome --kiosk --autoplay-policy=no-user-gesture-required "%TARGET_URL%"
    goto :finish
)

:: 3. Fallback: Buka dengan browser default Windows
echo Membuka dengan browser default...
start "" "%~dp0index.html"

:finish
echo.
echo Digital Signage berhasil berjalan!
timeout /t 3 >nul
