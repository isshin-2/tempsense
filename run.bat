@echo off
setlocal enabledelayedexpansion

title TEMPSENSE Control Panel

echo ======================================================
echo   TEMPSENSE - Cold Chain IoT Platform
echo   One-Click System Starter
echo ======================================================
echo.

:: --- BACKEND CHECK ---
echo [1/4] Checking Backend...
if not exist "backend\node_modules\" (
    echo [!] Backend dependencies missing. Running npm install...
    cd backend && call npm install && cd ..
    if !errorlevel! neq 0 (
        echo [X] Failed to install backend dependencies.
        pause
        exit /b !errorlevel!
    )
)
echo [+] Backend ready.

:: --- FRONTEND CHECK ---
echo [2/4] Checking Frontend...
if not exist "frontend\node_modules\" (
    echo [!] Frontend dependencies missing. Running npm install...
    cd frontend && call npm install && cd ..
    if !errorlevel! neq 0 (
        echo [X] Failed to install frontend dependencies.
        pause
        exit /b !errorlevel!
    )
)
echo [+] Frontend ready.

:: --- START SERVICES ---
echo [3/4] Launching Services...

:: Start Backend in a new window
start "TEMPSENSE - Backend" cmd /c "cd backend && npm start"

:: Start Frontend in a new window
start "TEMPSENSE - Frontend" cmd /c "cd frontend && npm run dev"

echo [+] Services launched successfully.

:: --- SUMMARY ---
echo.
echo ======================================================
echo   SYSTEM STATUS: RUNNING
echo.
echo   API Server:    http://localhost:3001
echo   Health Check:  http://localhost:3001/api/health
echo   Web Dashboard: http://localhost:5173
echo.
echo   Note: Keep the separate terminal windows open
echo         to maintain the services.
echo ======================================================
echo.
pause
