@echo off
setlocal enabledelayedexpansion
title TEMPSENSE - Stop Services
color 0C

echo.
echo  ================================================================
echo  ^|                                                              ^|
echo  ^|   TEMPSENSE - Stop All Services                             ^|
echo  ^|   Powered by Maxworth Techserv                              ^|
echo  ^|                                                              ^|
echo  ================================================================
echo.

set "KILLED=0"

:: Kill processes on port 3001 (Backend)
echo   Checking port 3001 (Backend API)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001" ^| findstr "LISTENING"') do (
    echo     Killing PID %%a on port 3001...
    taskkill /F /PID %%a >nul 2>&1
    set "KILLED=1"
)

:: Kill processes on port 5173 (Frontend)
echo   Checking port 5173 (Frontend Dev Server)...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173" ^| findstr "LISTENING"') do (
    echo     Killing PID %%a on port 5173...
    taskkill /F /PID %%a >nul 2>&1
    set "KILLED=1"
)

:: Kill any TEMPSENSE titled windows
taskkill /FI "WINDOWTITLE eq TEMPSENSE Backend*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq TEMPSENSE Frontend*" /F >nul 2>&1

echo.
if "!KILLED!"=="1" (
    echo   ╔══════════════════════════════════════════════════════╗
    echo   ║  All TEMPSENSE services have been stopped.          ║
    echo   ╚══════════════════════════════════════════════════════╝
) else (
    echo   ╔══════════════════════════════════════════════════════╗
    echo   ║  No running TEMPSENSE services were found.          ║
    echo   ╚══════════════════════════════════════════════════════╝
)
echo.

timeout /t 3 >nul
exit /b 0
