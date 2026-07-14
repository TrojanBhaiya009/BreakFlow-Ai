@echo off
REM ═══════════════════════════════════════════════════════════════
REM   BreakFlow AI — Windows Startup Script
REM   Installs dependencies and launches both backend & frontend
REM ═══════════════════════════════════════════════════════════════

setlocal EnableDelayedExpansion
title BreakFlow AI — Launcher

REM Get the directory where this script lives
set "SCRIPT_DIR=%~dp0"
set "BACKEND_DIR=%SCRIPT_DIR%backend"
set "FRONTEND_DIR=%SCRIPT_DIR%frontend"

REM ── Banner ───────────────────────────────────────────────────
echo.
echo   ╔══════════════════════════════════════════════╗
echo   ║           BreakFlow AI — Launcher            ║
echo   ║     Stress-test against real human chaos     ║
echo   ╚══════════════════════════════════════════════╝
echo.

REM ── Check for Node.js ────────────────────────────────────────
echo [1/5] Checking prerequisites...

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo    X Node.js is not installed!
    echo      Please install Node.js ^(v18+^) from https://nodejs.org
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VERSION=%%v
echo    √ Node.js %NODE_VERSION% found

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo    X npm is not installed!
    echo      npm usually comes with Node.js. Please reinstall Node.js.
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('npm -v') do set NPM_VERSION=%%v
echo    √ npm v%NPM_VERSION% found

REM ── Install Backend Dependencies ─────────────────────────────
echo.
echo [2/5] Installing backend dependencies...

if not exist "%BACKEND_DIR%" (
    echo    X Backend directory not found at: %BACKEND_DIR%
    pause
    exit /b 1
)

cd /d "%BACKEND_DIR%"
call npm install
if %ERRORLEVEL% neq 0 (
    echo    X Failed to install backend dependencies
    pause
    exit /b 1
)
echo    √ Backend dependencies installed

REM ── Install Playwright Browsers ──────────────────────────────
echo.
echo [3/5] Installing Playwright browsers...

cd /d "%BACKEND_DIR%"
call npx playwright install chromium >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo    ! Playwright browser install had issues.
    echo      You may need to run: cd backend ^&^& npx playwright install
) else (
    echo    √ Playwright browsers ready
)

REM ── Install Frontend Dependencies ────────────────────────────
echo.
echo [4/5] Installing frontend dependencies...

if not exist "%FRONTEND_DIR%" (
    echo    X Frontend directory not found at: %FRONTEND_DIR%
    pause
    exit /b 1
)

cd /d "%FRONTEND_DIR%"
call npm install
if %ERRORLEVEL% neq 0 (
    echo    X Failed to install frontend dependencies
    pause
    exit /b 1
)
echo    √ Frontend dependencies installed

REM ── Start Servers ────────────────────────────────────────────
echo.
echo [5/5] Starting servers...
echo.

REM Start backend in a new window
start "BreakFlow AI — Backend" cmd /k "cd /d "%BACKEND_DIR%" && npm run dev"
echo    √ Backend starting on http://localhost:3001

REM Wait a moment for backend to initialize
timeout /t 3 /nobreak >nul

REM Start frontend in a new window
start "BreakFlow AI — Frontend" cmd /k "cd /d "%FRONTEND_DIR%" && npm run dev"
echo    √ Frontend starting on http://localhost:3000

REM ── Ready ────────────────────────────────────────────────────
echo.
echo   ═══════════════════════════════════════════════
echo   🚀 BreakFlow AI is running!
echo   ═══════════════════════════════════════════════
echo.
echo   Frontend:  http://localhost:3000
echo   Backend:   http://localhost:3001
echo   Health:    http://localhost:3001/api/health
echo.
echo   Close this window and the server windows to stop.
echo.
pause
