@echo off
setlocal enabledelayedexpansion

title TEMPSENSE Companion Control Panel

echo ======================================================
echo   TEMPSENSE Companion - OTA Build ^& Deploy Tool
echo   One-Click System Starter
echo ======================================================
echo.

:: --- NODE DEPENDENCIES CHECK ---
echo [1/3] Checking Node.js dependencies...
if not exist "node_modules\" (
    echo [!] Companion dependencies missing. Running npm install...
    call npm install
    if !errorlevel! neq 0 (
        echo [X] Failed to install dependencies.
        pause
        exit /b !errorlevel!
    )
)
echo [+] Dependencies ready.

:: --- START SERVICE ---
echo [2/3] Launching TEMPSENSE Companion...

:: Load port from .env if it exists, default to 3000
set PORT=3000
if exist ".env" (
    for /f "tokens=1,2 delims==" %%i in (.env) do (
        if "%%i"=="PORT" set PORT=%%j
    )
)

:: Start the server in a new window
start "TEMPSENSE - Companion Server" cmd /c "npm start"
echo [+] Companion service launched.

:: --- OPEN BROWSER ---
echo [3/3] Opening Web Interface...
:: Wait 2 seconds for Express server to start up
timeout /t 2 /nobreak >nul
start http://localhost:%PORT%

echo.
echo ======================================================
echo   COMPANION STATUS: RUNNING
echo.
echo   Web Interface: http://localhost:%PORT%
echo.
echo   Note: Keep the separate terminal window open
echo         to maintain the service.
echo ======================================================
echo.
pause
