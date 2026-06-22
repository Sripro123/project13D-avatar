@echo off
echo Regenerating SSL certificate for IP address...
echo.

REM Get the local IP address
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /i "IPv4"') do (
    set IP=%%a
    goto :found
)
:found
set IP=%IP: =%

echo Using IP address: %IP%
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

REM Create OpenSSL config file for IP address
echo [req] > openssl.cnf
echo distinguished_name = req_distinguished_name >> openssl.cnf
echo req_extensions = v3_req >> openssl.cnf
echo [req_distinguished_name] >> openssl.cnf
echo [v3_req] >> openssl.cnf
echo subjectAltName = @alt_names >> openssl.cnf
echo [alt_names] >> openssl.cnf
echo IP.1 = %IP% >> openssl.cnf
echo DNS.1 = localhost >> openssl.cnf

%OPENSSL_CMD% req -x509 -newkey rsa:2048 -keyout server.key -out server.cert -days 365 -nodes -config openssl.cnf -extensions v3_req -subj "/C=US/ST=State/L=City/O=Development/CN=%IP%"

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ SSL certificate generated successfully for IP: %IP%
    echo 📁 Files created: server.key, server.cert
    echo.
    echo 🚀 Now run: node server-dual.js
    echo 🌐 Then visit: https://%IP%:8443/conference.html
    echo.
    echo ⚠️  Note: You will need to accept the self-signed certificate warning in your browser
    echo    Click "Advanced" then "Proceed to %IP% (unsafe)" when prompted
) else (
    echo.
    echo ❌ Failed to generate SSL certificate
    echo.
    echo 📝 Alternative solutions:
    echo 1. Install OpenSSL from: https://slproweb.com/products/Win32OpenSSL.html
    echo 2. Install Git for Windows (includes OpenSSL)
    echo 3. Use online certificate generator and save files as server.key and server.cert
)

REM Clean up config file
del openssl.cnf 2>nul

pause
