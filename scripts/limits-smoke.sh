#!/usr/bin/env bash
# Proves rate limits are shared: starts TWO nid-api instances with strict limits
# on one Redis and checks the limit is enforced across both, per phone, and by
# lockout after repeated failures. Needs Postgres, Redis (REDIS_URL) and a
# built target/debug/nid-api. Uses apps/rust-api/.env for everything else.
set -u
cd "$(dirname "$0")/../apps/rust-api"
set -a; . ./.env; set +a
: "${REDIS_URL:?set REDIS_URL}"
export RL_AUTH_PER_MIN=10 RL_AUTH_PER_HOUR=60 RL_IP_PER_MIN=240 RL_OTP_START_PER_10MIN=3 RL_OTP_START_PER_HOUR=6 \
  RL_AUTHFAIL_PER_10MIN=5 RL_LOCKOUT_SECS=30 RL_WRITE_PER_MIN=90 RL_GLOBAL_PER_MIN=6000 RL_BADREQ_PER_10MIN=1000
redis-cli -u "$REDIS_URL" flushall >/dev/null
for p in 4100 4101; do (API_PORT=$p setsid ../../target/debug/nid-api >/tmp/limits-$p.log 2>&1 < /dev/null &); done
for _ in $(seq 1 40); do curl -sf localhost:4100/health >/dev/null && curl -sf localhost:4101/health >/dev/null && break; sleep 1; done
PASS=0; FAIL=0
ok() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "ok   $1"; else FAIL=$((FAIL+1)); echo "FAIL $1 (expected $3, got $2)"; fi; }
post() { curl -s -o /dev/null -w '%{http_code}' -X POST "localhost:$1$2" -H 'content-type: application/json' -d "$3"; }

allowed=0; for i in $(seq 1 14); do c=$(post $((4100 + i % 2)) /v1/accounts/otp/verify '{"phone":"+15550001","code":"123456"}'); [ "$c" != 429 ] && allowed=$((allowed+1)); done
ok "10 auth requests allowed across two instances, the rest refused" "$allowed" 10

redis-cli -u "$REDIS_URL" flushall >/dev/null
allowed=0; for i in $(seq 1 6); do c=$(post $((4100 + i % 2)) /v1/accounts/otp/start '{"phone":"+15559990001"}'); [ "$c" != 429 ] && allowed=$((allowed+1)); sleep 0.1; done
ok "OTP start is capped per phone across instances (3)" "$allowed" 3
ok "a different phone is unaffected" "$([ "$(post 4100 /v1/accounts/otp/start '{"phone":"+15559990002"}')" != 429 ] && echo y)" y

redis-cli -u "$REDIS_URL" flushall >/dev/null
for i in $(seq 1 6); do curl -s -o /dev/null "localhost:$((4100 + i % 2))/v1/accounts/me"; done
ok "repeated failed auth locks the address out on BOTH instances" "$(curl -s -o /dev/null -w '%{http_code}' localhost:4100/v1/accounts/me)$(curl -s -o /dev/null -w '%{http_code}' localhost:4101/v1/profiles/x)" 429429
ok "health stays reachable during a lockout" "$(curl -s -o /dev/null -w '%{http_code}' localhost:4100/health)" 200

# Tier-1 fallback: with Redis gone the in-process (moka) counters still enforce.
redis-cli -u "$REDIS_URL" shutdown nosave >/dev/null 2>&1; sleep 1
allowed=0; for i in $(seq 1 14); do c=$(post 4100 /v1/accounts/otp/verify '{"phone":"+15550009","code":"123456"}'); [ "$c" != 429 ] && allowed=$((allowed+1)); done
ok "with Redis down the in-process limiter still enforces (never fails open)" "$([ "$allowed" -le 10 ] && [ "$allowed" -ge 1 ] && echo y)" y
redis-server --port 6379 --save "" --appendonly no --daemonize yes >/dev/null 2>&1

pkill -f "debug/nid-api" 2>/dev/null
echo; echo "$PASS passed, $FAIL failed"; [ "$FAIL" -eq 0 ]
