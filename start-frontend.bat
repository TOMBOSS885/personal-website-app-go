@echo off
chcp 65001 >nul
setlocal

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH.
    pause
    exit /b 1
)

cd /d "%~dp0frontend"
if not exist node_modules (
    npm install
)
npm run dev -- --host 0.0.0.0
