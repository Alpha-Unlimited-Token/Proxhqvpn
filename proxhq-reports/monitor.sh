#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Advanced Attack Scan — Autonomous Background Monitor
# Logs to: /home/runner/workspace/proxhq-reports/monitor.log
# Status:  /home/runner/workspace/proxhq-reports/monitor-status.txt
# ─────────────────────────────────────────────────────────────────────────────

LOG="/home/runner/workspace/proxhq-reports/monitor.log"
STATUS="/home/runner/workspace/proxhq-reports/monitor-status.txt"
REPORTS="/home/runner/workspace/proxhq-reports/reports/advanced-attacks"
SENTINEL="$REPORTS/scan-1777395046918.json"  # newest pre-run file as reference
SECRET="$SESSION_SECRET"
API="http://localhost:8080/api/quantum-audit"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
status() { echo "$*" > "$STATUS"; log "STATUS: $*"; }

log "======================================================================"
log "Monitor started — watching advanced attack scan (PID $$)"
log "======================================================================"

wait_for_server() {
  local tries=0
  while [ $tries -lt 60 ]; do
    RESP=$(timeout 5 curl -s "$API/advanced-attack-status" \
      -H "x-internal-secret: $SECRET" 2>/dev/null)
    [ -n "$RESP" ] && return 0
    tries=$((tries+1))
    sleep 10
  done
  return 1
}

trigger_scan() {
  log "Triggering scan (limit=2089, targeted=true)…"
  for attempt in $(seq 1 20); do
    RESP=$(timeout 10 curl -s -X POST "$API/advanced-attack-scan/internal" \
      -H "Content-Type: application/json" \
      -H "x-internal-secret: $SECRET" \
      -d '{"limit":2089,"targeted":true}' 2>/dev/null)
    case "$RESP" in
      *started*)   log "Scan started (attempt $attempt)"; return 0 ;;
      *running*)   log "Scan already running — continuing to monitor"; return 0 ;;
      *"Already"*) log "Scan already running — continuing to monitor"; return 0 ;;
      "") sleep 15 ;;
      *) log "Unexpected trigger response: $RESP"; sleep 10 ;;
    esac
  done
  log "ERROR: could not trigger scan after 20 attempts"
  return 1
}

check_new_reports() {
  find "$REPORTS" -name "scan-*.json" -newer "$SENTINEL" 2>/dev/null | head -5
}

# ── Main loop ────────────────────────────────────────────────────────────────
status "WAITING_FOR_SERVER"
log "Waiting for API server to be ready…"
if ! wait_for_server; then
  log "ERROR: API server never came up — aborting monitor"
  status "ERROR_SERVER_UNAVAILABLE"
  exit 1
fi
log "API server ready"

# Check if a scan is already running; if not, trigger one
INIT_STATUS=$(timeout 6 curl -s "$API/advanced-attack-status" \
  -H "x-internal-secret: $SECRET" 2>/dev/null)
RUNNING=$(echo "$INIT_STATUS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('running','false'))" 2>/dev/null)

if [ "$RUNNING" = "False" ] || [ -z "$RUNNING" ]; then
  # No active scan — check if one already completed since our reference file
  EXISTING=$(check_new_reports)
  if [ -n "$EXISTING" ]; then
    log "Found existing completed report — scan already done!"
    status "DONE"
    for f in $EXISTING; do
      log "REPORT: $f"
      python3 -m json.tool < "$f" >> "$LOG" 2>/dev/null
    done
    exit 0
  fi
  trigger_scan || exit 1
fi

status "SCAN_RUNNING"
CONSECUTIVE_FAILS=0
LAST_LOG_LINE=""
RUN=0

while true; do
  sleep 120

  RUN=$((RUN+1))

  # Check process is alive
  PID=$(pgrep -f "dist/index.mjs" | head -1)
  if [ -z "$PID" ]; then
    log "WARNING: API server process is gone — waiting for restart…"
    sleep 30
    if ! wait_for_server; then
      log "Server did not recover — giving up"
      status "ERROR_SERVER_DIED"
      exit 1
    fi
    log "Server recovered — re-triggering scan"
    trigger_scan || true
    status "SCAN_RUNNING_RECOVERED"
    CONSECUTIVE_FAILS=0
    continue
  fi

  CPU=$(ps -p $PID -o pcpu --no-headers 2>/dev/null | tr -d ' ')
  RSS_KB=$(ps -p $PID -o rss --no-headers 2>/dev/null | tr -d ' ')
  ELAPSED=$(ps -p $PID -o etime --no-headers 2>/dev/null | tr -d ' ')
  log "Heartbeat — PID=$PID CPU=${CPU}% RSS=$((RSS_KB/1024))MB elapsed=${ELAPSED}"

  # Check for new report files (scan complete)
  NEW=$(check_new_reports)
  if [ -n "$NEW" ]; then
    log "======================================================================"
    log "SCAN COMPLETE — new report(s) detected!"
    log "======================================================================"
    for f in $NEW; do
      log "REPORT FILE: $f"
      SUMMARY=$(python3 -c "
import json
d=json.load(open('$f'))
total=d.get('totalAddresses',0)
vulns=d.get('vulnerableAddresses',0)
keys=len(d.get('recoveredKeys',[]))
findings=d.get('totalFindings',0)
print(f'Addresses={total} Vulnerable={vulns} Findings={findings} RecoveredKeys={keys}')
for k in d.get('recoveredKeys',[]):
    print(f'  KEY: {k}')
" 2>/dev/null)
      log "SUMMARY: $SUMMARY"
      python3 -m json.tool < "$f" >> "$LOG" 2>/dev/null
    done
    status "DONE"
    exit 0
  fi

  # Poll status endpoint (may not respond when CPU is saturated)
  SCAN_STATUS=$(timeout 5 curl -s "$API/advanced-attack-status" \
    -H "x-internal-secret: $SECRET" 2>/dev/null)

  if [ -n "$SCAN_STATUS" ]; then
    CONSECUTIVE_FAILS=0
    RUNNING=$(echo "$SCAN_STATUS" | python3 -c "import json,sys; print(json.load(sys.stdin).get('running','?'))" 2>/dev/null)
    LAST_LOG=$(echo "$SCAN_STATUS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
logs=d.get('log',[])
print(logs[-1] if logs else 'no logs')
" 2>/dev/null)
    if [ "$LAST_LOG" != "$LAST_LOG_LINE" ]; then
      log "SCAN LOG: $LAST_LOG"
      LAST_LOG_LINE="$LAST_LOG"
    fi
    if [ "$RUNNING" = "False" ]; then
      # Running=False but no new report yet — scan may have crashed
      log "Scan shows not-running but no report found — checking for error"
      ERROR_LOG=$(echo "$SCAN_STATUS" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for l in d.get('log',[]): print(l)
" 2>/dev/null | grep -i "ERROR" | tail -3)
      if [ -n "$ERROR_LOG" ]; then
        log "Scan errored: $ERROR_LOG — re-triggering in 30s"
        sleep 30
        trigger_scan || true
        status "SCAN_RESTARTED_AFTER_ERROR"
      else
        log "Scan may have completed without writing report — waiting 60s more"
        sleep 60
        FINAL=$(check_new_reports)
        if [ -n "$FINAL" ]; then
          log "Report found after delay!"
          status "DONE"
          for f in $FINAL; do
            log "REPORT: $f"
            python3 -m json.tool < "$f" >> "$LOG" 2>/dev/null
          done
          exit 0
        fi
        log "Still no report — re-triggering scan"
        trigger_scan || true
        status "SCAN_RESTARTED_NO_REPORT"
      fi
    else
      status "SCAN_RUNNING (check=$RUN CPU=${CPU}% elapsed=${ELAPSED})"
    fi
  else
    CONSECUTIVE_FAILS=$((CONSECUTIVE_FAILS+1))
    log "Status endpoint busy (server CPU-saturated) — fail $CONSECUTIVE_FAILS/15"
    if [ $CONSECUTIVE_FAILS -ge 15 ]; then
      log "15 consecutive status failures — checking process health"
      CONSECUTIVE_FAILS=0
      if ! kill -0 $PID 2>/dev/null; then
        log "Process dead — triggering server restart"
        status "ERROR_PROCESS_DEAD"
      fi
    fi
  fi
done
