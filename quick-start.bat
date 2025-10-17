@echo off
title Emotion AI - Quick Start Menu
color 0B

:MENU
cls
echo ========================================
echo   Emotion AI - Quick Start Menu
echo ========================================
echo.
echo Please select an option:
echo.
echo   [1] Start BOTH Backend and Frontend (Recommended)
echo   [2] Start Backend Only (Port 8080)
echo   [3] Start Frontend Only (Port 3000)
echo   [4] Exit
echo.
echo ========================================
set /p choice="Enter your choice (1-4): "

if "%choice%"=="1" goto START_ALL
if "%choice%"=="2" goto START_BACKEND
if "%choice%"=="3" goto START_FRONTEND
if "%choice%"=="4" goto EXIT
echo.
echo Invalid choice! Please try again.
timeout /t 2 /nobreak >nul
goto MENU

:START_ALL
cls
echo ========================================
echo   Starting All Services
echo ========================================
call start-all.bat
goto MENU

:START_BACKEND
cls
echo ========================================
echo   Starting Backend Only
echo ========================================
call start-backend.bat
goto MENU

:START_FRONTEND
cls
echo ========================================
echo   Starting Frontend Only
echo ========================================
echo.
echo WARNING: Backend must be running for frontend to work!
echo.
timeout /t 3 /nobreak
call start-frontend.bat
goto MENU

:EXIT
echo.
echo Thank you for using Emotion AI!
timeout /t 2 /nobreak >nul
exit
