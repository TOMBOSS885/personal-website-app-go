#!/usr/bin/env bash
set -e

echo "========================================"
echo "   Personal Website - Go + Frontend"
echo "========================================"

if ! command -v go >/dev/null 2>&1; then
  echo "[ERROR] Go is not installed or not in PATH."
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "[ERROR] Node.js is not installed or not in PATH."
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[1/3] Installing frontend dependencies..."
cd "$ROOT_DIR/frontend"
npm install

echo "[2/3] Starting Go backend on http://localhost:8080 ..."
cd "$ROOT_DIR/go_back"
go run ./cmd/server &
BACKEND_PID=$!

sleep 5

echo "[3/3] Starting frontend dev server on http://localhost:3000 ..."
cd "$ROOT_DIR/frontend"
npm run dev -- --host 0.0.0.0 &
FRONTEND_PID=$!

echo
echo "Frontend: http://localhost:3000"
echo "API:      http://localhost:8080"
echo "Admin:    http://localhost:3000/admin"
echo "Press Ctrl+C to stop."

trap 'kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true' INT TERM EXIT
wait
