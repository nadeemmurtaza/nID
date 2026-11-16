#!/usr/bin/env bash
# Start (or restart) the whole local stack: the 17 svc-* gRPC services and
# nid-api, using apps/rust-api/.env. Postgres must already be running.
# Logs go to ${LOG_DIR:-/tmp/nid-logs}. Build first: cargo build --workspace.
set -eu
cd "$(dirname "$0")/.."
LOG_DIR=${LOG_DIR:-/tmp/nid-logs}; mkdir -p "$LOG_DIR" "${LOCAL_STORAGE_DIR:-/tmp/nid-storage-data}"
pkill -f 'target/debug/(svc-|nid-api)' 2>/dev/null || true; sleep 1
set -a; . apps/rust-api/.env; set +a
for b in target/debug/svc-*; do
  case "$b" in *.d) continue;; esac
  nohup "$b" > "$LOG_DIR/$(basename "$b").log" 2>&1 &
done
(cd apps/rust-api && nohup ../../target/debug/nid-api > "$LOG_DIR/nid-api.log" 2>&1 &)
for _ in $(seq 1 30); do
  curl -sf -m 2 "http://localhost:${API_PORT:-4000}/health" >/dev/null && { echo "stack up (logs in $LOG_DIR)"; exit 0; }
  sleep 1
done
echo "nid-api did not become healthy; see $LOG_DIR/nid-api.log" >&2; exit 1
