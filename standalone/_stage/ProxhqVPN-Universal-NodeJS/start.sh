#!/bin/bash
cd "$(dirname "$0")"
node server.bundle.cjs &
PID=$!
sleep 1
xdg-open http://localhost:7474 2>/dev/null || open http://localhost:7474 2>/dev/null || true
wait $PID
