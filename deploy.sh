#!/usr/bin/env bash
set -e

PROJECT_DIR="${PROJECT_DIR:-/www/wwwroot/bb/personal-website}"
BRANCH="${BRANCH:-back_go}"

echo "========================================"
echo "   Personal Website Docker Deploy"
echo "========================================"

cd "$PROJECT_DIR"

echo "[1/4] Pulling latest code..."
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "[2/4] Checking .env..."
if [ ! -f .env ]; then
  echo "[ERROR] .env does not exist. Copy .env.example to .env and fill MySQL/JWT values first."
  exit 1
fi

echo "[3/4] Rebuilding container..."
docker compose down
docker compose build --no-cache
docker compose up -d

echo "[4/4] Current status..."
docker compose ps
echo
echo "Logs: docker compose logs -f"
echo "Default site: http://SERVER_IP:3718"
