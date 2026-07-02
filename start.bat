@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo    Personal Website - Go + Frontend
echo ========================================
echo.

where go >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Go is not installed or not in PATH.
    pause
    exit /b 1
)

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    pause
    exit /b 1
)

echo [1/3] Installing frontend dependencies...
cd /d "%~dp0frontend"
call npm install
if %errorlevel% neq 0 (
    echo [ERROR] Frontend dependency installation failed.
    pause
    exit /b 1
)

echo.
echo [2/3] Starting Go backend on http://localhost:8080 ...
cd /d "%~dp0go_back"
start "Go API" cmd /c "go run ./cmd/server"

echo Waiting for backend to start...
timeout /t 5 /nobreak >nul

echo.
echo [3/3] Starting frontend dev server...
cd /d "%~dp0frontend"
start "Frontend" cmd /c "npm run dev -- --host 0.0.0.0"

echo.
echo Frontend: http://localhost:3000
echo API:      http://localhost:8080
echo Admin:    http://localhost:3000/admin
echo.
pause
