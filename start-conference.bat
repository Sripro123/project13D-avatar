@echo off
echo Starting 3D Avatar Conference System...
echo.
cd /d "%~dp0"
echo Current directory: %CD%
echo.

echo Starting Interview API Server on port 3001...
start "Interview API" cmd /k "node interview-server.js"

echo Waiting 3 seconds for API server to start...
timeout /t 3 /nobreak >nul

echo Starting Conference Server on port 9000...
start "Conference Server" cmd /k "node server-dual.js"

echo.
echo ========================================
echo 3D Avatar Conference System Started
echo ========================================
echo.
echo Interview API: http://localhost:3001
echo Conference:    http://localhost:9000/conference.html
echo.
echo Use your NETWORK IP address for multi-device access:
echo   Find your IP: ipconfig
echo   Access via: http://YOUR_IP:9000/conference.html
echo.
echo Press any key to exit...
pause >nul
