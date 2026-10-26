@echo off
title Perbarui Daftar Video Signage
cd /d "%~dp0"
color 0b
echo ===================================================
echo     DIGITAL SIGNAGE - PEMINDAI MATERI VIDEO
echo ===================================================
echo.
echo Memindai file video dalam folder 'videos'...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scan-videos.ps1"
echo.
echo Tekan tombol apa saja untuk menutup jendela ini...
pause >nul
