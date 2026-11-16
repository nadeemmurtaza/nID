#!/usr/bin/env bash
# End-to-end smoke test against a running local stack (Postgres, the 17 svc-*
# services and nid-api; see README). Dev mode must be on (OTP_SMS_DEV_MODE)
# because login codes are read from the accounts service log.
#
#   API=http://localhost:4000 PLATFORM_ADMIN_SECRET=... \
#   ACCOUNTS_LOG=/path/to/svc-accounts.log DATABASE_URL=postgresql://nid:nid@localhost:5432/nid \
#   scripts/e2e-smoke.sh
#
# Exits non-zero if any assertion fails.
set -u
API=${API:-http://localhost:4000}
AD=${PLATFORM_ADMIN_SECRET:?set PLATFORM_ADMIN_SECRET}
LOG=${ACCOUNTS_LOG:?set ACCOUNTS_LOG to the svc-accounts log file}
DB=${DATABASE_URL:?set DATABASE_URL (superuser, used only to seed an OAuth client and a profile)}
H="Content-Type: application/json"
PASS=0; FAIL=0
j() { python3 -I -c "import sys,json;print(json.load(sys.stdin).get('$1',''))" 2>/dev/null; }
code() { curl -s -m 15 -o /tmp/e2e.body -w "%{http_code}" "$@"; }
ok() { if [ "$2" = "$3" ]; then PASS=$((PASS+1)); echo "ok   $1"; else FAIL=$((FAIL+1)); echo "FAIL $1 (expected $3, got $2) $(head -c 140 /tmp/e2e.body 2>/dev/null)"; fi; }
sql() { psql "$DB" -tAqc "$1"; }
login() {
  local ph="+1555$RANDOM$RANDOM"
  curl -s -m 8 -X POST "$API/v1/accounts/otp/start" -H "$H" -d "{\"phone\":\"$ph\"}" >/dev/null; sleep 1.5
  local c; c=$(grep -a "would send login code" "$LOG" | tail -1 | grep -oE "login code [0-9]+" | grep -oE "[0-9]+")
  curl -s -m 8 -X POST "$API/v1/accounts/otp/verify" -H "$H" -d "{\"phone\":\"$ph\",\"code\":\"$c\"}"
}
mk() { curl -s -m 15 -X POST "$API/v1/tenants" -H "Authorization: Bearer $AD" -H "$H" -d "{\"name\":\"$1\",\"slug\":\"$1-$RANDOM$RANDOM\"}"; }

echo "== bootstrap: two tenants, each gets a first API key"
A=$(mk e2e-a); B=$(mk e2e-b)
TA=$(echo "$A"|j id); KA=$(echo "$A"|j apiKey); KB=$(echo "$B"|j apiKey)
[ -n "$KA" ] && [ -n "$KB" ] && ok "tenant create returns an API key" a a || ok "tenant create returns an API key" missing a
ok "no credentials is rejected" "$(code "$API/v1/tenants/me")" 401
ok "API key authenticates" "$(code "$API/v1/tenants/me" -H "Authorization: Bearer $KA")" 200

echo "== tenant isolation"
SID=$(curl -s -m 10 -X POST "$API/v1/subjects" -H "Authorization: Bearer $KA" -H "$H" -d '{"type":"PERSON","givenName":"Ann"}' | j id)
OID=$(curl -s -m 10 -X POST "$API/v1/subjects" -H "Authorization: Bearer $KA" -H "$H" -d '{"type":"ORGANIZATION","givenName":"Org A"}' | j id)
ok "A creates an organization" "$(code -X POST "$API/v1/organizations" -H "Authorization: Bearer $KA" -H "$H" -d "{\"subjectId\":\"$OID\",\"legalName\":\"Org A Ltd\"}")" 200
sql "insert into \"VerificationPolicy\"(id,\"tenantId\",name,methods,\"updatedAt\") values (gen_random_uuid()::text,'$TA','default',array['otp_sms'],now())"
CASE=$(curl -s -m 10 -X POST "$API/v1/verification-cases" -H "Authorization: Bearer $KA" -H "$H" -d "{\"subjectId\":\"$SID\",\"policyName\":\"default\"}"); CID=$(echo "$CASE"|j id)
[ -n "$CID" ] && ok "A creates a verification case" a a || ok "A creates a verification case" none a
ok "B cannot read A's subject" "$(code "$API/v1/subjects/$SID" -H "Authorization: Bearer $KB")" 404
ok "B cannot read A's case" "$(code "$API/v1/verification-cases/$CID" -H "Authorization: Bearer $KB")" 404
ok "B cannot resolve A's case" "$(code -X POST "$API/v1/verification-cases/$CID/resolve" -H "Authorization: Bearer $KB" -H "$H" -d '{"decision":"APPROVED"}')" 404
ok "B lists no cases" "$(curl -s -m 10 "$API/v1/verification-cases" -H "Authorization: Bearer $KB")" "[]"
ok "B lists no organizations" "$(curl -s -m 10 "$API/v1/organizations" -H "Authorization: Bearer $KB")" "[]"
ok "A still reads its own case" "$(code "$API/v1/verification-cases/$CID" -H "Authorization: Bearer $KA")" 200

echo "== errors never leak internals"
code "$API/v1/profiles/does-not-exist" >/dev/null
ok "unknown profile is a clean 404" "$(code "$API/v1/profiles/does-not-exist")" 404
! grep -qiE "tonic|grpc|metadata|sqlstate|relation" /tmp/e2e.body && ok "404 body has no gRPC or SQL text" a a || ok "404 body has no gRPC or SQL text" leak a

echo "== admin actions are audited"
KID=$(curl -s -m 10 "$API/v1/tenants/$TA/api-keys" -H "Authorization: Bearer $KA" | python3 -I -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")
curl -s -m 10 -o /dev/null -X POST "$API/v1/tenants/$TA/api-keys" -H "Authorization: Bearer $KA" -H "$H" -d '{}'
sleep 1
ok "api key creation is in the audit log" "$(sql "select count(*) from audit_log_entry where tenant_id='$TA' and action='tenant.api_key.create'")" 1

echo "== OAuth"
VR=$(login); S=$(echo "$VR"|j sessionToken)
SECRET="s-$RANDOM"; CID2="client-$RANDOM"
sql "insert into \"OAuthClient\"(id,\"tenantId\",name,\"clientId\",\"clientSecretHash\",\"redirectUris\") values (gen_random_uuid()::text,'$TA','app','$CID2','$(printf %s "$SECRET" | sha256sum | cut -d' ' -f1)',array['https://app.example/cb'])"
ok "unregistered redirect_uri rejected" "$(code -X POST "$API/v1/oauth/login-requests" -H "$H" -d "{\"clientId\":\"$CID2\",\"redirectUri\":\"https://evil.example/cb\"}")" 400
R=$(curl -s -m 10 -X POST "$API/v1/oauth/login-requests" -H "$H" -d "{\"clientId\":\"$CID2\",\"redirectUri\":\"https://app.example/cb\"}")
POLL=$(echo "$R" | python3 -I -c "import sys,json;print(json.load(sys.stdin)['approvalUrl'].split('/')[-1])")
ok "claim before approval rejected" "$(code -X POST "$API/v1/oauth/login-requests/$POLL/claim")" 400
ok "approve with a session" "$(code -X POST "$API/v1/oauth/login-requests/$POLL/approve" -H "Authorization: Bearer $S")" 200
AC=$(curl -s -m 10 -X POST "$API/v1/oauth/login-requests/$POLL/claim" | j accessToken)
ok "second claim rejected" "$(code -X POST "$API/v1/oauth/login-requests/$POLL/claim")" 400
ok "wrong client secret rejected" "$(code -X POST "$API/v1/oauth/token" -H "$H" -d "{\"code\":\"$AC\",\"clientId\":\"$CID2\",\"clientSecret\":\"nope\",\"redirectUri\":\"https://app.example/cb\"}")" 400
TK=$(curl -s -m 10 -X POST "$API/v1/oauth/token" -H "$H" -d "{\"code\":\"$AC\",\"clientId\":\"$CID2\",\"clientSecret\":\"$SECRET\",\"redirectUri\":\"https://app.example/cb\"}"); AT=$(echo "$TK"|j accessToken)
ok "exchange issues a token that authenticates" "$(code "$API/v1/accounts/me" -H "Authorization: Bearer $AT")" 200
ok "replayed code rejected" "$(code -X POST "$API/v1/oauth/token" -H "$H" -d "{\"code\":\"$AC\",\"clientId\":\"$CID2\",\"clientSecret\":\"$SECRET\",\"redirectUri\":\"https://app.example/cb\"}")" 400

echo "== uploads and account deletion"
VR=$(login); S2=$(echo "$VR"|j sessionToken); AID=$(echo "$VR" | python3 -I -c "import sys,json;print(json.load(sys.stdin)['account']['id'])")
sql "insert into \"Profile\"(id,slug,\"displayName\",\"accountId\",\"updatedAt\") values (gen_random_uuid()::text,'e2e-$RANDOM$RANDOM','E2E','$AID',now())"
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00' > /tmp/e2e.png
printf '<?php system($_GET[c]); ?>' > /tmp/e2e-evil.png
ok "real PNG accepted" "$(code -X POST "$API/v1/profiles/me/photo" -H "Authorization: Bearer $S2" -F "file=@/tmp/e2e.png;type=image/png")" 200
ok "script disguised as PNG rejected" "$(code -X POST "$API/v1/profiles/me/photo" -H "Authorization: Bearer $S2" -F "file=@/tmp/e2e-evil.png;type=image/png")" 400
ok "DELETE /v1/accounts/me" "$(code -X DELETE "$API/v1/accounts/me" -H "Authorization: Bearer $S2")" 204
ok "account row is gone" "$(sql "select count(*) from \"Account\" where id='$AID'")" 0
ok "its profile is gone" "$(sql "select count(*) from \"Profile\" where \"accountId\"='$AID'")" 0
ok "old session is rejected" "$(code "$API/v1/accounts/me" -H "Authorization: Bearer $S2")" 401

echo "== platform"
ok "health is database-aware" "$(code "$API/health")" 200
ok "CORS: disallowed origin gets no allow-origin" "$(curl -s -m 5 -D - -o /dev/null -X OPTIONS "$API/v1/accounts/otp/start" -H "Origin: https://evil.example" -H "Access-Control-Request-Method: POST" | grep -ci '^access-control-allow-origin')" 0
ok "append-only audit log (UPDATE denied to app role)" "$(PGPASSWORD=nid_app psql "${DB/nid:nid@/nid_app:nid_app@}" -tAc 'update "AuditLogEntry" set id=id where false' 2>&1 | grep -c 'permission denied')" 1

echo; echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
