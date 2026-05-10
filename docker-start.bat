@echo off
title TEMPSENSE Docker Starter
echo ======================================================
echo   TEMPSENSE - Cold Chain IoT Platform
echo   Docker Deployment Starter
echo ======================================================
echo.

echo [1/2] Checking if Docker is running...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo [X] Docker is not running. Please start Docker Desktop first.
    pause
    exit /b 1
)
echo [+] Docker is ready.

echo [2/2] Starting containers with Docker Compose...
docker-compose up -d --build

if %errorlevel% neq 0 (
    echo [X] Failed to start containers.
    pause
    exit /b 1
)

echo.
echo ======================================================
echo   SYSTEM STATUS: DEPLOYED (DOCKER)
echo.
echo   Web Dashboard: http://localhost (Port 80)
echo   API Health:    http://localhost:3001/api/health
echo   Database GUI:  http://localhost:8080 (Adminer)
echo.
echo   Database Credentials for Adminer:
echo     System:   PostgreSQL
echo     Server:   db
echo     Username: postgres
echo     Password: postgres
echo     Database: tempsense
echo.
echo   Use 'docker-compose logs -f' to see logs.
echo   Use 'docker-compose down' to stop.
echo ======================================================
echo.
pause
