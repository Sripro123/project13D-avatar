@echo off
echo Starting 3D Avatar Conference System (HTTPS)...
echo.
cd /d "%~dp0"
echo Current directory: %CD%
echo.

echo Starting Integrated HTTPS Server...
echo This includes:
echo   - Web Server (HTTPS)
echo   - WebSocket Signaling
echo   - Interview API
echo   - User Authentication
echo.

node server-https.js

echo.
echo Server stopped.
pause
