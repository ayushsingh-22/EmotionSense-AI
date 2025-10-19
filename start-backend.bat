@echo off
echo ========================================
echo   Emotion AI Backend - Quick Start
echo ========================================
echo.

cd /d "%~dp0backend"

echo [1/3] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [2/3] Installing dependencies...
call npm install

if errorlevel 1 (
    echo ERROR: Failed to install dependencies!
    pause
    exit /b 1
)

echo.
echo [3/3] Starting backend server...
echo.
echo ========================================
echo   Backend will start at:
echo   http://localhost:8080
echo ========================================
echo.
echo Press Ctrl+C to stop the server
echo.

call npm start

pause
