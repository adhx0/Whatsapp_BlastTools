@echo off
chcp 65001
setlocal

echo =======================================================
echo                    WHATSAPP BLAST
echo =======================================================
echo.

rem Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ❌ Node.js tidak ditemukan.
  echo.
  echo Silakan ikuti langkah-langkah berikut:
  echo 1. Jendela browser akan terbuka, unduh versi 'LTS' dari Node.js.
  echo 2. Jalankan file installer yang sudah diunduh.
  echo 3. Setelah instalasi selesai, tutup jendela ini dan jalankan kembali 'run.bat'.
  echo.
  pause
  start "" "https://nodejs.org/"
  exit /b 1
)

echo ✅ Node.js is installed.

rem Check if node_modules folder exists
if not exist "node_modules" (
  echo ⚠️ Dependencies not found. Installing now...
  call npm install whatsapp-web.js qrcode-terminal readline-sync xlsx
  ) else (
  echo ✅ Dependencies are already installed.
)

echo.
echo =======================================================
echo                Starting WhatsApp Blast
echo =======================================================
echo.

node main.js

echo.
echo =======================================================
echo               WhatsApp Blast finished.
echo =======================================================
pause

endlocal
