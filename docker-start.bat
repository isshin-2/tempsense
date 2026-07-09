@echo off
setlocal enabledelayedexpansion
title TEMPSENSE - Docker Deployment
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
echo   Docker Deployment
echo   -----------------
echo.

:: ============================================================
::  STEP 1: Check Docker
:: ============================================================
echo   [1/4] Checking Docker...
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   ╔══════════════════════════════════════════════════════╗
    echo   ║  ERROR: Docker is NOT installed!                    ║
    echo   ║                                                      ║
    echo   ║  Please install Docker Desktop from:                 ║
    echo   ║  https://www.docker.com/products/docker-desktop/     ║
    echo   ╚══════════════════════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo   ╔══════════════════════════════════════════════════════╗
    echo   ║  ERROR: Docker daemon is not running!               ║
    echo   ║                                                      ║
    echo   ║  Please start Docker Desktop and wait for it to     ║
    echo   ║  finish loading, then run this script again.        ║
    echo   ╚══════════════════════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('docker --version') do set DOCKER_VER=%%i
echo         %DOCKER_VER%  [OK]

:: ============================================================
::  STEP 2: Build & Start Containers
:: ============================================================
echo   [2/4] Building and starting containers...
echo         This may take a few minutes on first run...
echo.

docker-compose up -d --build
if %errorlevel% neq 0 (
    echo.
    echo   ╔══════════════════════════════════════════════════════╗
    echo   ║  ERROR: Failed to start containers!                 ║
    echo   ║                                                      ║
    echo   ║  Check the error messages above for details.        ║
    echo   ║  Common fixes:                                       ║
    echo   ║  - Ensure ports 81, 3001, 5432, 8080 are free       ║
    echo   ║  - Run: docker-compose down --volumes              ║
    echo   ║  - Then try this script again                       ║
    echo   ╚══════════════════════════════════════════════════════╝
    echo.
    pause
    exit /b 1
)

echo.
echo         Containers started  [OK]

:: ============================================================
::  STEP 3: Wait for Health Checks
:: ============================================================
echo   [3/4] Waiting for backend health check...
echo.

set "HEALTH_OK=0"
set "MAX_RETRIES=30"
set "RETRY=0"

:health_loop
if !RETRY! geq !MAX_RETRIES! goto health_timeout

set /a RETRY=!RETRY!+1
echo         Attempt !RETRY!/!MAX_RETRIES! - Checking http://localhost:3001/api/health ...

:: Use curl to check health endpoint
curl -sf http://localhost:3001/api/health >nul 2>&1
if !errorlevel! equ 0 (
    set "HEALTH_OK=1"
    goto health_done
)

timeout /t 3 /nobreak >nul
goto health_loop

:health_timeout
echo.
echo   ╔══════════════════════════════════════════════════════╗
echo   ║  WARNING: Health check timed out after 90 seconds.  ║
echo   ║  The backend may still be starting up.              ║
echo   ║  Run: docker-compose logs backend                   ║
echo   ╚══════════════════════════════════════════════════════╝
echo.
goto show_status

:health_done
echo.
echo         Backend is healthy  [OK]

:: ============================================================
::  STEP 4: Open Browser
:: ============================================================
echo   [4/4] Opening browser...
start "" http://localhost:81
echo         Browser opened  [OK]

:: ============================================================
::  STATUS SUMMARY
:: ============================================================
:show_status
echo.
echo  ================================================================
echo  ^|                                                              ^|
echo  ^|        TEMPSENSE DOCKER DEPLOYMENT IS RUNNING                ^|
echo  ^|                                                              ^|
echo  ================================================================
echo.
echo   SERVICES:
echo   ---------
echo   Web Dashboard    :  http://localhost:81           (Port 81)
echo   API Server       :  http://localhost:3001
echo   Health Check     :  http://localhost:3001/api/health
echo   Database GUI     :  http://localhost:8080      (Adminer)
echo   TCP Sensor Port  :  1024
echo.
echo   DEFAULT SUPER ADMIN LOGIN:
echo   --------------------------
echo   Email    :  admin@maxworthonline.com
echo   Password :  TMS@2026
echo.
echo   DATABASE CREDENTIALS (Adminer):
echo   --------------------------------
echo   System   :  PostgreSQL
echo   Server   :  db
echo   Username :  postgres
echo   Password :  postgres
echo   Database :  tempsense
echo.
echo  ================================================================
echo.
echo   What would you like to do?
echo.
echo     [1] View live logs
echo     [2] Stop all containers
echo     [3] Exit (containers keep running)
echo.

:menu_choice
set "CHOICE="
set /p CHOICE="   Enter choice (1/2/3): "

if "!CHOICE!"=="1" (
    echo.
    echo   Showing live logs... Press Ctrl+C to stop viewing.
    echo.
    docker-compose logs -f
    goto menu_choice
)

if "!CHOICE!"=="2" (
    echo.
    echo   Stopping all containers...
    docker-compose down
    echo.
    echo   ╔══════════════════════════════════════════════════════╗
    echo   ║  All containers have been stopped.                  ║
    echo   ║  Data is preserved in Docker volumes.               ║
    echo   ║  Run this script again to restart.                  ║
    echo   ╚══════════════════════════════════════════════════════╝
    echo.
    timeout /t 3 >nul
    exit /b 0
)

if "!CHOICE!"=="3" (
    echo.
    echo   Containers will keep running in the background.
    echo   Use 'docker-compose down' to stop them later.
    echo.
    timeout /t 2 >nul
    exit /b 0
)

echo   Invalid choice. Please enter 1, 2, or 3.
goto menu_choice
