@echo off
echo ========================================
echo   Emotion AI - Start All Services
echo ========================================
echo.
echo Starting Backend (Port 8080) and Frontend (Port 3000)...
echo.

cd /d "%~dp0"

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js is not installed!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

REM Start Backend in a new window
echo [1/2] Starting Backend Server...
start "Emotion AI - Backend" cmd /k "cd /d "%~dp0backend" && npm install && npm start"

REM Wait a bit for backend to start
timeout /t 3 /nobreak >nul

REM Start Frontend in a new window
echo [2/2] Starting Frontend Server...
start "Emotion AI - Frontend" cmd /k "cd /d "%~dp0frontend" && npm install && npm run dev"

echo.
echo ========================================
echo   Services Started Successfully!
echo ========================================
echo.
echo   Backend:  http://localhost:8080
echo   Frontend: http://localhost:3000
echo.
echo Both services are running in separate windows.
echo Close those windows to stop the services.
echo.
pause
