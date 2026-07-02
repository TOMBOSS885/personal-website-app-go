#!/bin/sh
set -e

mkdir -p /app/uploads /var/log/supervisor
chown -R app:app /app/uploads /var/log/supervisor 2>/dev/null || true

exec "$@"
