@echo off
echo ========================================
echo   Emotion AI Frontend - Quick Start
echo ========================================
echo.

cd /d "%~dp0frontend"

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
echo [3/3] Starting development server...
echo.
echo ========================================
echo   Frontend will start at:
echo   http://localhost:3000
echo.
echo   NOTE: Backend must be running at:
echo   http://localhost:8080
echo ========================================
echo.
echo Press Ctrl+C to stop the server
echo.

call npm run dev

pause
