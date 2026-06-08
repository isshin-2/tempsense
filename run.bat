@echo off
setlocal enabledelayedexpansion
title TEMPSENSE - Cold Chain IoT Platform
color 0B

:: ============================================================
::  ASCII Art Banner
:: ============================================================
echo.
echo  ================================================================
echo  ^|                                                              ^|
echo  ^|   ████████╗███████╗███╗   ███╗██████╗ ███████╗███████╗      ^|
echo  ^|   ╚══██╔══╝██╔════╝████╗ ████║██╔══██╗██╔════╝██╔════╝      ^|
echo  ^|      ██║   █████╗  ██╔████╔██║██████╔╝███████╗█████╗        ^|
echo  ^|      ██║   ██╔══╝  ██║╚██╔╝██║██╔═══╝ ╚════██║██╔══╝        ^|
echo  ^|      ██║   ███████╗██║ ╚═╝ ██║██║     ███████║███████╗      ^|
echo  ^|      ╚═╝   ╚══════╝╚═╝     ╚═╝╚═╝     ╚══════╝╚══════╝      ^|
echo  ^|                                                              ^|
echo  ^|          Cold Chain IoT Monitoring Platform                  ^|
echo  ^|          Powered by Maxworth Techserv                       ^|
echo  ^|                                                              ^|
echo  ================================================================
echo.
echo   One-Click System Launcher
echo   -------------------------
echo.

:: ============================================================
::  STEP 1: Check Node.js
:: ============================================================
echo   [1/6] Checking Node.js installation...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   ╔══════════════════════════════════════════════════════╗
    echo   ║  ERROR: Node.js is NOT installed!                   ║
    echo   ║                                                      ║
    echo   ║  Please download and install Node.js LTS from:       ║
    echo   ║  https://nodejs.org/en/download/                     ║
    echo   ║                                                      ║
    echo   ║  After installing, restart this script.              ║
    echo   ╚══════════════════════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo         Found Node.js %NODE_VER%  [OK]

:: ============================================================
::  STEP 2: Check PostgreSQL
:: ============================================================
echo   [2/6] Checking PostgreSQL connection...
where psql >nul 2>&1
if %errorlevel% neq 0 (
    echo         psql not found in PATH - checking if port 5432 is open...
    netstat -an | findstr ":5432" | findstr "LISTENING" >nul 2>&1
    if !errorlevel! neq 0 (
        echo.
        echo   ╔══════════════════════════════════════════════════════╗
        echo   ║  WARNING: PostgreSQL does not appear to be running  ║
        echo   ║                                                      ║
        echo   ║  Please ensure PostgreSQL is installed and running:  ║
        echo   ║  https://www.postgresql.org/download/windows/        ║
        echo   ║                                                      ║
        echo   ║  Default config expected in backend\.env:            ║
        echo   ║    Host: localhost  Port: 5432                       ║
        echo   ║    Database: tempsense                               ║
        echo   ║    User: postgres   Password: postgres               ║
        echo   ╚══════════════════════════════════════════════════════╝
        echo.
        echo   Press any key to continue anyway, or Ctrl+C to abort...
        pause >nul
    ) else (
        echo         Port 5432 is open - PostgreSQL appears to be running  [OK]
    )
) else (
    netstat -an | findstr ":5432" | findstr "LISTENING" >nul 2>&1
    if !errorlevel! neq 0 (
        echo.
        echo   ╔══════════════════════════════════════════════════════╗
        echo   ║  WARNING: PostgreSQL does not appear to be running  ║
        echo   ║  on port 5432. Please start the PostgreSQL service. ║
        echo   ╚══════════════════════════════════════════════════════╝
        echo.
        echo   Press any key to continue anyway, or Ctrl+C to abort...
        pause >nul
    ) else (
        echo         PostgreSQL is running on port 5432  [OK]
    )
)

:: ============================================================
::  STEP 3: Install Backend Dependencies
:: ============================================================
echo   [3/6] Checking backend dependencies...
if not exist "backend\node_modules\" (
    echo         node_modules not found - installing...
    echo.
    pushd backend
    call npm install
    if !errorlevel! neq 0 (
        echo.
        echo   [X] Failed to install backend dependencies!
        echo       Check your internet connection and try again.
        popd
        pause
        exit /b 1
    )
    popd
    echo.
    echo         Backend dependencies installed  [OK]
) else (
    echo         Backend dependencies found  [OK]
)

:: ============================================================
::  STEP 4: Install Frontend Dependencies
:: ============================================================
echo   [4/6] Checking frontend dependencies...
if not exist "frontend\node_modules\" (
    echo         node_modules not found - installing...
    echo.
    pushd frontend
    call npm install
    if !errorlevel! neq 0 (
        echo.
        echo   [X] Failed to install frontend dependencies!
        echo       Check your internet connection and try again.
        popd
        pause
        exit /b 1
    )
    popd
    echo.
    echo         Frontend dependencies installed  [OK]
) else (
    echo         Frontend dependencies found  [OK]
)

:: ============================================================
::  STEP 5: Kill Existing Processes on Ports 3001 & 5173
:: ============================================================
echo   [5/6] Clearing ports 3001 and 5173...

:: Kill processes on port 3001
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Kill processes on port 5173
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

echo         Ports cleared  [OK]

:: ============================================================
::  STEP 6: Launch Services
:: ============================================================
echo   [6/6] Starting services...
echo.

:: Start Backend in a minimized window
start /min "TEMPSENSE Backend [port 3001]" cmd /c "cd /d "%~dp0backend" && title TEMPSENSE Backend [port 3001] && color 0A && :loop && echo. && echo   TEMPSENSE Backend Server && echo   ======================== && echo. && call npm start && timeout /t 2 >nul && goto loop"


:: Give backend a moment to begin startup
timeout /t 3 /nobreak >nul

:: Start Frontend in a minimized window
start /min "TEMPSENSE Frontend [port 5173]" cmd /c "cd /d "%~dp0frontend" && title TEMPSENSE Frontend [port 5173] && color 0D && echo. && echo   TEMPSENSE Frontend Dev Server && echo   ============================= && echo. && npm run dev"

:: Wait for frontend to be ready then open browser
echo   Waiting for services to start...
timeout /t 5 /nobreak >nul

:: Open browser
start "" http://localhost:5173

:: ============================================================
::  STATUS SUMMARY
:: ============================================================
echo.
echo  ================================================================
echo  ^|                                                              ^|
echo  ^|              TEMPSENSE IS RUNNING                            ^|
echo  ^|                                                              ^|
echo  ================================================================
echo.
echo   SERVICES:
echo   ---------
echo   API Server       :  http://localhost:3001
echo   Health Check     :  http://localhost:3001/api/health
echo   Web Dashboard    :  http://localhost:5173       (opened in browser)
echo   TCP Sensor Port  :  1024
echo.
echo   DEFAULT SUPER ADMIN LOGIN:
echo   --------------------------
echo   Email    :  admin@maxworthonline.com
echo   Password :  TMS@2026
echo.
echo   USER ROLES:
echo   -----------
echo   Admin         -  Full system access, manage users and sites
echo   Site Manager  -  Manage assigned sites, view reports
echo   Customer      -  View dashboard for assigned sites
echo.
echo  ================================================================
echo  ^|  The backend and frontend are running in minimized windows.  ^|
echo  ^|  Press any key in THIS window to STOP all services.         ^|
echo  ================================================================
echo.

pause >nul

:: ============================================================
::  STOP SERVICES
:: ============================================================
echo.
echo   Stopping TEMPSENSE services...

:: Kill processes on port 3001
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Kill processes on port 5173
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)

:: Also kill any cmd windows we started
taskkill /FI "WINDOWTITLE eq TEMPSENSE Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq TEMPSENSE Frontend*" /F >nul 2>&1

echo.
echo   ╔══════════════════════════════════════════════════════╗
echo   ║  All TEMPSENSE services have been stopped.          ║
echo   ║  Thank you for using TEMPSENSE!                     ║
echo   ╚══════════════════════════════════════════════════════╝
echo.

timeout /t 3 >nul
exit /b 0
