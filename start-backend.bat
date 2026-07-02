@echo off
chcp 65001 >nul
setlocal

where go >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Go is not installed or not in PATH.
    pause
    exit /b 1
)

cd /d "%~dp0go_back"
echo Starting Go backend on http://localhost:8080 ...
go run ./cmd/server
pause
