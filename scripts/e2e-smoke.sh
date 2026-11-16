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
WS=$(echo "$A"|j webhookSecret)
ok "tenant create returns the webhook secret once" "$([ -n "$WS" ] && echo y)" y
STORED=$(psql "$DB" -tAc "select \"webhookSecretEnc\" from \"Tenant\" where id='$TA'")
ok "webhook secret is stored as v1 ciphertext" "$(case "$STORED" in v1.*) echo y;; esac)" y
ok "stored value does not contain the secret" "$(case "$STORED" in *"$WS"*) echo leak;; *) echo y;; esac)" y
ok "plaintext webhook columns are gone" "$(psql "$DB" -tAc "select count(*) from information_schema.columns where table_name='Tenant' and column_name ilike '%SecretPlaintext'")" 0
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

echo "== access control tables (roles, departments, invitations, grants)"
TB=$(echo "$B"|j id)
VA=$(login); SA=$(echo "$VA"|j sessionToken); AA=$(echo "$VA" | python3 -I -c "import sys,json;print(json.load(sys.stdin)['account']['id'])")
VB=$(login); SB=$(echo "$VB"|j sessionToken); AB=$(echo "$VB" | python3 -I -c "import sys,json;print(json.load(sys.stdin)['account']['id'])")
sql "insert into \"AccessGrant\"(id,\"accountId\",\"tenantId\",\"accessType\",\"grantedBy\") values (gen_random_uuid()::text,'$AA','$TA','OWNER','$AA')"
sql "insert into \"AccessGrant\"(id,\"accountId\",\"tenantId\",\"accessType\",\"grantedBy\") values (gen_random_uuid()::text,'$AB','$TB','OWNER','$AB')"
SL="role-$RANDOM"
ok "owner creates a role" "$(code -X POST "$API/v1/roles?tenantId=$TA" -H "Authorization: Bearer $SA" -H "$H" -d "{\"name\":\"Agent\",\"slug\":\"$SL\",\"permissions\":{}}")" 200
ok "owner lists roles" "$(curl -s -m 10 "$API/v1/roles?tenantId=$TA" -H "Authorization: Bearer $SA" | grep -c "$SL")" 1
ok "tenant B owner cannot list A's roles" "$(code "$API/v1/roles?tenantId=$TA" -H "Authorization: Bearer $SB")" 403
ok "owner creates a department" "$(code -X POST "$API/v1/departments?tenantId=$TA" -H "Authorization: Bearer $SA" -H "$H" -d "{\"name\":\"Support\",\"slug\":\"sup-$RANDOM\"}")" 200
ok "tenant B owner cannot list A's departments" "$(code "$API/v1/departments?tenantId=$TA" -H "Authorization: Bearer $SB")" 403
ok "owner sends an email invitation" "$(code -X POST "$API/v1/invitations/email?tenantId=$TA" -H "Authorization: Bearer $SA" -H "$H" -d "{\"email\":\"new-$RANDOM@example.com\"}")" 200
ok "owner lists invitations" "$(code "$API/v1/invitations?tenantId=$TA" -H "Authorization: Bearer $SA")" 200
ok "tenant B owner cannot list A's invitations" "$(code "$API/v1/invitations?tenantId=$TA" -H "Authorization: Bearer $SB")" 403
NAPP="${DB/nid:nid@/nid_app:nid_app@}"
appq() { PGPASSWORD=nid_app psql "$NAPP" -tAqc "$1"; }
ok "RLS: tenant B context sees none of A's roles" "$(appq "begin; select set_config('app.tenant_id','$TB',true);
select count(*) from \"RoleDefinition\" where \"tenantId\"='$TA'; rollback;" | tail -1)" 0
ok "RLS: no context sees no grants" "$(appq "select count(*) from \"AccessGrant\"")" 0
ok "RLS: no context sees no departments" "$(appq "select count(*) from \"Department\"")" 0
ok "RLS: no context sees no brands" "$(appq "select count(*) from \"Brand\"")" 0

echo "== brands (organization-scoped RLS)"
VC=$(login); SC=$(echo "$VC"|j sessionToken); AC2=$(echo "$VC" | python3 -I -c "import sys,json;print(json.load(sys.stdin)['account']['id'])")
VD=$(login); SD=$(echo "$VD"|j sessionToken)
ORG=$(sql "select id from \"Organization\" where \"tenantId\"='$TA' limit 1"); PSUB=$(sql "select id from \"Subject\" where \"tenantId\"='$TA' and type='PERSON' limit 1")
sql "insert into \"OrganizationMembership\"(id,\"tenantId\",\"organizationId\",\"personSubjectId\",role,\"addedByApiKeyId\",status,\"isAdmin\",\"accountId\") values (gen_random_uuid()::text,'$TA','$ORG','$PSUB','ADMIN','e2e','ACTIVE',true,'$AC2')"
BR=$(curl -s -m 10 -X POST "$API/v1/brands" -H "Authorization: Bearer $SC" -H "$H" -d "{\"organizationId\":\"$ORG\",\"name\":\"E2E Brand\"}"); BID=$(echo "$BR"|j id)
[ -n "$BID" ] && ok "org admin creates a brand" a a || ok "org admin creates a brand" "none: $(echo $BR | head -c 100)" a
ok "org admin lists the brand" "$(curl -s -m 10 "$API/v1/brands?organizationId=$ORG" -H "Authorization: Bearer $SC" | grep -c "E2E Brand")" 1
ok "a non-member cannot read the brand" "$(code "$API/v1/brands/$BID" -H "Authorization: Bearer $SD")" "$(code "$API/v1/brands/nonexistent" -H "Authorization: Bearer $SD")"
ok "a non-member's brand list is empty" "$(curl -s -m 10 "$API/v1/brands?organizationId=$ORG" -H "Authorization: Bearer $SD" | grep -c "E2E Brand")" 0

echo "== API key scopes and per-key rate limit"
RK=$(curl -s -m 10 -X POST "$API/v1/tenants/$TA/api-keys" -H "Authorization: Bearer $KA" -H "$H" -d '{"scopes":["subjects:read"],"rateLimitPerMinute":3}' | j plaintext)
ok "read-only key can read subjects" "$(code "$API/v1/subjects/$SID" -H "Authorization: Bearer $RK")" 200
ok "read-only key cannot write subjects" "$(code -X POST "$API/v1/subjects" -H "Authorization: Bearer $RK" -H "$H" -d '{"type":"PERSON","givenName":"x"}')" 403
ok "read-only key cannot read cases" "$(code "$API/v1/verification-cases" -H "Authorization: Bearer $RK")" 403
ok "read-only key cannot mint keys" "$(code -X POST "$API/v1/tenants/$TA/api-keys" -H "Authorization: Bearer $RK" -H "$H" -d '{}')" 403
ok "admin key cannot mint a wildcard key" "$(code -X POST "$API/v1/tenants/$TA/api-keys" -H "Authorization: Bearer $KA" -H "$H" -d '{"scopes":["*"]}')" 403
ok "per-key rate limit returns 429" "$(for _ in 1 2 3 4 5; do code "$API/v1/subjects/$SID" -H "Authorization: Bearer $RK"; echo; done | grep -c 429)" 3

echo "== verification session uploads"
STOK=$(echo "$CASE"|j sessionToken)
STORE=${LOCAL_STORAGE_DIR:-/tmp/nid-storage-data}
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00' > /tmp/e2e-doc.png
printf '\xff\xd8\xff\xe0\x00\x10JFIF\x00' > /tmp/e2e-frame.jpg
ok "session status is readable by its token" "$(code "$API/v1/sessions/$STOK")" 200
ok "a document that is really a script is rejected" "$(code -X POST "$API/v1/sessions/$STOK/document/submit" -F "file=@/tmp/e2e-evil.png;type=image/png")" 400
D0=$(find "$STORE/verification-document" -type f 2>/dev/null | wc -l); L0=$(find "$STORE/verification-liveness" -type f 2>/dev/null | wc -l)
ok "a real document is accepted" "$(code -X POST "$API/v1/sessions/$STOK/document/submit" -F "file=@/tmp/e2e-doc.png;type=image/png")" 200
ok "the document is stored on disk" "$(( $(find "$STORE/verification-document" -type f 2>/dev/null | wc -l) - D0 ))" 1
ok "liveness frames are accepted" "$(code -X POST "$API/v1/sessions/$STOK/liveness/submit" -F "frames=@/tmp/e2e-frame.jpg;type=image/jpeg" -F "frames=@/tmp/e2e-frame.jpg;type=image/jpeg")" 200
ok "the frames are stored on disk" "$(( $(find "$STORE/verification-liveness" -type f 2>/dev/null | wc -l) - L0 ))" 2
ok "the attempts record storage keys" "$(( $(sql "select count(*) from verification_method_attempt where result_meta ? 'storageKey' or result_meta ? 'storageKeys'") >= 2 ))" 1
ok "an unknown session token is rejected" "$(code -X POST "$API/v1/sessions/nope/document/submit" -F "file=@/tmp/e2e-doc.png;type=image/png")" 400

echo "== self-service verification cases"
VS=$(login); SS=$(echo "$VS"|j sessionToken)
ok "unknown claim type is a clean 400" "$(code -X POST "$API/v1/accounts/me/verification/cases" -H "Authorization: Bearer $SS" -H "$H" -d '{"claimType":"PHONE"}')" 400
CS=$(curl -s -m 10 -X POST "$API/v1/accounts/me/verification/cases" -H "Authorization: Bearer $SS" -H "$H" -d '{"claimType":"IDENTITY"}')
ok "identity case is created PENDING" "$(echo "$CS"|j status)" PENDING
ok "date of birth case is created" "$(code -X POST "$API/v1/accounts/me/verification/cases" -H "Authorization: Bearer $SS" -H "$H" -d '{"claimType":"DATE_OF_BIRTH"}')" 200
ok "a level that is not offered is rejected" "$(code -X POST "$API/v1/accounts/me/verification/cases" -H "Authorization: Bearer $SS" -H "$H" -d '{"claimType":"DATE_OF_BIRTH","level":"REGISTRY_VERIFIED"}')" 400
ok "the account lists its two cases" "$(curl -s -m 10 "$API/v1/accounts/me/verification/cases" -H "Authorization: Bearer $SS" | python3 -I -c "import sys,json;print(len(json.load(sys.stdin)))")" 2
VS2=$(login); SS2=$(echo "$VS2"|j sessionToken)
ok "another account sees none of them" "$(curl -s -m 10 "$API/v1/accounts/me/verification/cases" -H "Authorization: Bearer $SS2")" "[]"

echo "== profile content and booking (owner and visitor)"
VP=$(login); SP=$(echo "$VP"|j sessionToken); AP=$(echo "$VP" | python3 -I -c "import sys,json;print(json.load(sys.stdin)['account']['id'])")
PSLUG="e2e-prof-$RANDOM$RANDOM"
sql "insert into \"Profile\"(id,slug,\"displayName\",\"accountId\",\"isPublished\",\"showBooking\",\"showOffers\",\"showHours\",timezone,\"updatedAt\") values (gen_random_uuid()::text,'$PSLUG','E2E Owner','$AP',true,true,true,true,'UTC',now())"
OH="Authorization: Bearer $SP"
ok "owner creates an offer" "$(code -X POST "$API/v1/profiles/me/offers" -H "$OH" -H "$H" -d '{"title":"Spring","description":"10% off"}')" 200
ok "offers list has it" "$(curl -s -m 10 "$API/v1/profiles/me/offers" -H "$OH" | grep -c Spring)" 1
ok "public sees the offer" "$(curl -s -m 10 "$API/v1/profiles/$PSLUG/offers" | grep -c Spring)" 1
ok "owner sets Monday hours" "$(code -X PUT "$API/v1/profiles/me/business-hours/MONDAY" -H "$OH" -H "$H" -d '{"openMinute":540,"closeMinute":1020,"isClosed":false}')" 200
ok "public sees the hours" "$(curl -s -m 10 "$API/v1/profiles/$PSLUG/business-hours" | grep -c MONDAY)" 1
ok "owner adds a custom link" "$(code -X POST "$API/v1/profiles/me/links/custom" -H "$OH" -H "$H" -d '{"label":"Site","url":"https://example.com"}')" 200
ok "a javascript: link is rejected" "$(code -X POST "$API/v1/profiles/me/links/custom" -H "$OH" -H "$H" -d '{"label":"x","url":"javascript:alert(1)"}')" 422
ok "owner adds a social link" "$(code -X POST "$API/v1/profiles/me/links/social" -H "$OH" -H "$H" -d '{"platform":"INSTAGRAM","url":"https://instagram.com/e2e"}')" 200
ok "public sees both link kinds" "$(curl -s -m 10 "$API/v1/profiles/$PSLUG/links" | grep -c 'example.com')" 1
ok "visitor sends a contact message" "$(code -X POST "$API/v1/profiles/$PSLUG/contact-messages" -H "$H" -d '{"senderName":"Vee","senderEmail":"v@example.com","message":"Hello there"}')" 200
MID=$(curl -s -m 10 "$API/v1/profiles/me/contact-messages" -H "$OH" | python3 -I -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")
ok "owner sees it unread" "$(curl -s -m 10 "$API/v1/profiles/me/contact-messages" -H "$OH" | python3 -I -c "import sys,json;print(json.load(sys.stdin)[0]['readAt'])")" None
ok "owner marks it read" "$(code -X POST "$API/v1/profiles/me/contact-messages/$MID/read" -H "$OH")" 200
SV=$(curl -s -m 10 -X POST "$API/v1/profiles/me/services" -H "$OH" -H "$H" -d '{"name":"Consult","durationMinutes":30,"price":25.5,"currency":"USD"}'); SVID=$(echo "$SV"|j id)
[ -n "$SVID" ] && ok "owner creates a service" a a || ok "owner creates a service" "none: $(echo $SV|head -c 100)" a
ok "owner adds availability for every day" "$(for d in MONDAY TUESDAY WEDNESDAY THURSDAY FRIDAY SATURDAY SUNDAY; do code -X POST "$API/v1/profiles/me/availability-rules" -H "$OH" -H "$H" -d "{\"day\":\"$d\",\"startMinute\":540,\"endMinute\":1020}"; echo; done | grep -c 200)" 7
FROM=$(date -u -d "+1 day" +%F); TO=$(date -u -d "+3 days" +%F)
SLOTS=$(curl -s -m 10 "$API/v1/profiles/$PSLUG/availability?serviceId=$SVID&from=$FROM&to=$TO")
SLOT=$(echo "$SLOTS" | python3 -I -c "import sys,json;d=json.load(sys.stdin);print(d[0]['startsAt'] if d else '')")
[ -n "$SLOT" ] && ok "visitor sees free slots" a a || ok "visitor sees free slots" "none: $(echo $SLOTS | head -c 120)" a
ok "visitor books a slot" "$(code -X POST "$API/v1/profiles/$PSLUG/appointments" -H "$H" -d "{\"serviceId\":\"$SVID\",\"startsAt\":\"$SLOT\",\"visitorName\":\"Vee\",\"visitorEmail\":\"v@example.com\"}")" 200
ok "the same slot cannot be booked twice" "$(code -X POST "$API/v1/profiles/$PSLUG/appointments" -H "$H" -d "{\"serviceId\":\"$SVID\",\"startsAt\":\"$SLOT\",\"visitorName\":\"Other\"}")" 409
APPT=$(curl -s -m 10 "$API/v1/profiles/me/appointments" -H "$OH" | python3 -I -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")
ok "owner sees the appointment with its service" "$(curl -s -m 10 "$API/v1/profiles/me/appointments" -H "$OH" | grep -c Consult)" 1
ok "owner confirms it" "$(code -X POST "$API/v1/profiles/me/appointments/$APPT/confirm" -H "$OH")" 200
ok "owner cancels it" "$(code -X POST "$API/v1/profiles/me/appointments/$APPT/cancel" -H "$OH")" 200
ok "the freed slot can be booked again" "$(code -X POST "$API/v1/profiles/$PSLUG/appointments" -H "$H" -d "{\"serviceId\":\"$SVID\",\"startsAt\":\"$SLOT\",\"visitorName\":\"Again\"}")" 200
ok "owner deletes the offer" "$(code -X DELETE "$API/v1/profiles/me/offers/$(curl -s -m 10 "$API/v1/profiles/me/offers" -H "$OH" | python3 -I -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")" -H "$OH")" 200

echo "== organization membership (invite by phone, accept)"
VI=$(login); SI=$(echo "$VI"|j sessionToken); PHI=$(sql "select phone from \"Account\" where id='$(echo "$VI" | python3 -I -c "import sys,json;print(json.load(sys.stdin)['account']['id'])")'")
ok "tenant invites a person to the organization by phone" "$(code -X POST "$API/v1/organizations/$ORG/invite" -H "Authorization: Bearer $KA" -H "$H" -d "{\"phone\":\"$PHI\",\"role\":\"MEMBER\"}")" 200
ok "the invitee sees one pending invite" "$(curl -s -m 10 "$API/v1/organizations/invites/mine" -H "Authorization: Bearer $SI" | python3 -I -c "import sys,json;print(len(json.load(sys.stdin)))")" 1
MEM=$(curl -s -m 10 "$API/v1/organizations/invites/mine" -H "Authorization: Bearer $SI" | python3 -I -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")
ok "the invitee accepts" "$(code -X POST "$API/v1/organizations/invites/$MEM/accept" -H "Authorization: Bearer $SI")" 200
ok "the organization now lists the member" "$(curl -s -m 10 "$API/v1/organizations/$ORG/members" -H "Authorization: Bearer $KA" | grep -o ACTIVE | wc -l | tr -d " ")" 2
ok "the invitee sees the membership" "$(curl -s -m 10 "$API/v1/organizations/my-memberships" -H "Authorization: Bearer $SI" | python3 -I -c "import sys,json;print(len(json.load(sys.stdin)))")" 1
ok "tenant B cannot invite into A's organization" "$(code -X POST "$API/v1/organizations/$ORG/invite" -H "Authorization: Bearer $KB" -H "$H" -d "{\"phone\":\"$PHI\"}")" 404

echo "== errors never leak internals"
code "$API/v1/profiles/does-not-exist" >/dev/null
ok "unknown profile is a clean 404" "$(code "$API/v1/profiles/does-not-exist")" 404
! grep -qiE "tonic|grpc|metadata|sqlstate|relation" /tmp/e2e.body && ok "404 body has no gRPC or SQL text" a a || ok "404 body has no gRPC or SQL text" leak a

echo "== admin actions are audited"
KID=$(curl -s -m 10 "$API/v1/tenants/$TA/api-keys" -H "Authorization: Bearer $KA" | python3 -I -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")
curl -s -m 10 -o /dev/null -X POST "$API/v1/tenants/$TA/api-keys" -H "Authorization: Bearer $KA" -H "$H" -d '{}'
sleep 1
ok "api key creation is in the audit log" "$(( $(sql "select count(*) from audit_log_entry where tenant_id='$TA' and action='tenant.api_key.create'") >= 1 ))" 1

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

echo "== strict input validation (every request, before any handler)"
vj() { code -X POST "$API/v1/accounts/otp/start" -H "$H" -d "$1"; }
ok "phone without a plus is rejected" "$(vj '{"phone":"4155550123"}')" 422
ok "letters in a phone are rejected" "$(vj '{"phone":"+1415abc0123"}')" 422
ok "unknown field is rejected" "$(vj '{"phone":"+14155550123","isAdmin":true}')" 422
ok "NUL byte is rejected" "$(vj '{"phone":"+1415555\u00000123"}')" 422
ok "bad JSON is rejected" "$(vj '{"phone":')" 400
ok "wrong content type is rejected" "$(code -X POST "$API/v1/accounts/otp/start" -H "Content-Type: text/plain" -d '{"phone":"+14155550123"}')" 415
ok "oversized body is rejected" "$(python3 -I -c "print('{\"phone\":\"+1' + '5'*1200000 + '\"}')" | code -X POST "$API/v1/accounts/otp/start" -H "$H" --data-binary @-)" 413
ok "path traversal segment is rejected" "$(code "$API/v1/profiles/..%2F..%2Fetc")" 400
ok "control character in the query is rejected" "$(code "$API/v1/profiles?q=a%00b")" 400
ok "deeply nested JSON is rejected" "$(vj '{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":{"a":1}}}}}}}}}}')" 422
ok "HTML tag in a name is rejected" "$(code -X POST "$API/v1/tenants" -H "Authorization: Bearer $AD" -H "$H" -d '{"name":"<script>x</script>","slug":"valid-slug-1"}')" 422
ok "bad slug is rejected" "$(code -X POST "$API/v1/tenants" -H "Authorization: Bearer $AD" -H "$H" -d '{"name":"ok","slug":"Bad Slug!"}')" 422

echo "== platform"
if [ -n "${SERVICE_AUTH_TOKEN:-}" ]; then
  grpc_status() { printf '\0\0\0\0\0' | curl -s -m 5 --http2-prior-knowledge -D - -o /dev/null -X POST "http://127.0.0.1:${ACCOUNTS_PORT:-50081}/newax.accounts.v1.AccountsApiService/RevokeAllSessions" -H "content-type: application/grpc" -H "te: trailers" "$@" --data-binary @- | tr -d '\r' | grep -i '^grpc-status' | awk '{print $2}'; }
  ok "service rejects a call with no token" "$(grpc_status)" 16
  ok "service rejects a wrong token" "$(grpc_status -H 'authorization: Bearer wrong')" 16
  ok "service accepts the shared token" "$(grpc_status -H "authorization: Bearer $SERVICE_AUTH_TOKEN")" 0
fi
ok "health is database-aware" "$(code "$API/health")" 200
ok "CORS: disallowed origin gets no allow-origin" "$(curl -s -m 5 -D - -o /dev/null -X OPTIONS "$API/v1/accounts/otp/start" -H "Origin: https://evil.example" -H "Access-Control-Request-Method: POST" | grep -ci '^access-control-allow-origin')" 0
ok "append-only audit log (UPDATE denied to app role)" "$(PGPASSWORD=nid_app psql "${DB/nid:nid@/nid_app:nid_app@}" -tAc 'update "AuditLogEntry" set id=id where false' 2>&1 | grep -c 'permission denied')" 1

echo; echo "$PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
