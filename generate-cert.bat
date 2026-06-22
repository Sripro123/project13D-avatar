@echo off
echo Generating self-signed SSL certificate for HTTPS...
echo.

REM Try to find OpenSSL in common locations
set OPENSSL_CMD=
if exist "C:\Program Files\OpenSSL-Win64\bin\openssl.exe" (
    set OPENSSL_CMD="C:\Program Files\OpenSSL-Win64\bin\openssl.exe"
) else if exist "C:\Program Files (x86)\OpenSSL-Win64\bin\openssl.exe" (
    set OPENSSL_CMD="C:\Program Files (x86)\OpenSSL-Win64\bin\openssl.exe"
) else if exist "C:\Program Files\Git\usr\bin\openssl.exe" (
    set OPENSSL_CMD="C:\Program Files\Git\usr\bin\openssl.exe"
) else (
    echo OpenSSL not found in common locations.
    echo Trying system PATH...
    set OPENSSL_CMD=openssl
)

echo Using: %OPENSSL_CMD%
echo.

%OPENSSL_CMD% req -x509 -newkey rsa:2048 -keyout server.key -out server.cert -days 365 -nodes -subj "/C=US/ST=State/L=City/O=Development/CN=localhost"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ SSL certificate generated successfully!
    echo 📁 Files created: server.key, server.cert
    echo.
    echo 🚀 Now run: node server-dual.js
    echo 🌐 Then visit: https://localhost:8443/conference.html
    echo.
    echo ⚠️  Note: You will need to accept the self-signed certificate warning in your browser
    echo    Click "Advanced" then "Proceed to localhost (unsafe)" when prompted
) else (
    echo.
    echo ❌ Failed to generate SSL certificate
    echo.
    echo 📝 Alternative solutions:
    echo 1. Install OpenSSL from: https://slproweb.com/products/Win32OpenSSL.html
    echo 2. Install Git for Windows (includes OpenSSL)
    echo 3. Use online certificate generator and save files as server.key and server.cert
)

pause
