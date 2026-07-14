@echo off
echo Starting HTTP Server for TalkingHead...
echo.
cd /d "%~dp0"
echo Current directory: %CD%
echo.
echo Starting server on http://localhost:3000
echo Press Ctrl+C to stop the server
echo.
python -m http.server 3000
pause
