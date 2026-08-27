#!/usr/bin/env bash
# Turnkey LOCAL active security scan of the login worker — safe to run because
# it targets a private copy on your own machine, with dummy secrets, never the
# live site. Requires: Node, and Docker (for OWASP ZAP). Run from cms-auth/:
#
#   ./scan-local.sh
#
# It: (1) makes .dev.vars from the example if missing, (2) starts the worker on
# localhost with dummy secrets, (3) runs ZAP's baseline then full active scan
# against it, (4) writes reports to ./scan-report/, (5) stops the worker.
set -euo pipefail
cd "$(dirname "$0")"

PORT=8788
REPORT_DIR="$(pwd)/scan-report"
mkdir -p "$REPORT_DIR"

if [ ! -f .dev.vars ]; then
  echo "→ creating .dev.vars from template (dummy secrets)"
  cp .dev.vars.example .dev.vars
fi

echo "→ starting worker on http://localhost:$PORT (dummy secrets)"
npx --yes wrangler dev --port "$PORT" --local >/tmp/cms-auth-dev.log 2>&1 &
DEV_PID=$!
trap 'kill $DEV_PID 2>/dev/null || true' EXIT

# Wait for it to answer.
for i in $(seq 1 30); do
  if curl -sf "http://localhost:$PORT/auth" -o /dev/null; then break; fi
  sleep 1
done
echo "→ worker is up"

echo "→ ZAP passive baseline"
docker run --rm --network=host -v "$REPORT_DIR:/zap/wrk:rw" \
  ghcr.io/zaproxy/zaproxy zap-baseline.py \
  -t "http://localhost:$PORT/auth" -r baseline-report.html || true

echo "→ ZAP full active scan (attacks the local copy only)"
docker run --rm --network=host -v "$REPORT_DIR:/zap/wrk:rw" \
  ghcr.io/zaproxy/zaproxy zap-full-scan.py \
  -t "http://localhost:$PORT/auth" -r active-report.html || true

echo "→ done. Reports in: $REPORT_DIR"
echo "   open $REPORT_DIR/baseline-report.html and active-report.html"
