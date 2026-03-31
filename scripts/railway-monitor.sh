#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${RAILWAY_BACKEND_DOMAIN:-https://koranaestate.onrender.com}"
HEALTH_URL="${DOMAIN%/}/api/v1/health"
MODE="${1:-both}"

run_health_once() {
  code="$(curl -sS -o /tmp/railway_health_resp.json -w "%{http_code}" "$HEALTH_URL" || true)"
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  body="$(cat /tmp/railway_health_resp.json 2>/dev/null || true)"
  echo "[$ts] health_status=$code body=$body"
}

case "$MODE" in
  logs)
    railway logs
    ;;
  health)
    while true; do
      run_health_once
      sleep 30
    done
    ;;
  both)
    echo "Starting health polling in background (every 30s) + live Railway logs..."
    (
      while true; do
        run_health_once
        sleep 30
      done
    ) &
    HEALTH_PID=$!
    trap 'kill $HEALTH_PID 2>/dev/null || true' EXIT
    railway logs
    ;;
  once)
    run_health_once
    railway logs -n 80
    ;;
  *)
    echo "Usage: $0 [logs|health|both|once]"
    exit 1
    ;;
esac
