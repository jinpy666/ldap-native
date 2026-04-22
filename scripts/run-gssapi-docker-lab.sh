#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.gssapi.yml"
ARTIFACT_DIR="${GSSAPI_DOCKER_ARTIFACT_DIR:-$ROOT_DIR/artifacts/gssapi-docker}"
PROJECT_NAME="${GSSAPI_DOCKER_PROJECT:-ldap-native-gssapi}"
KEEP_STACK="${KEEP_GSSAPI_STACK:-0}"
RUNNER_SERVICE="${GSSAPI_RUNNER_SERVICE:-gssapi-runner}"
FREEIPA_SERVICE="${GSSAPI_FREEIPA_SERVICE:-freeipa}"
FREEIPA_HOST="${GSSAPI_FREEIPA_HOST:-ipa.example.test}"
FREEIPA_REALM="${GSSAPI_FREEIPA_REALM:-EXAMPLE.TEST}"
FREEIPA_BASE_DN="${GSSAPI_FREEIPA_BASE_DN:-dc=example,dc=test}"
FREEIPA_ADMIN_PRINCIPAL="${GSSAPI_FREEIPA_ADMIN_PRINCIPAL:-admin@EXAMPLE.TEST}"
FREEIPA_ADMIN_PASSWORD="${GSSAPI_FREEIPA_ADMIN_PASSWORD:-Secret123}"
FREEIPA_DOMAIN="${FREEIPA_HOST#*.}"
CURRENT_STEP="bootstrap"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

require_command docker

if [[ "$(uname -s)" == "Darwin" && "${ALLOW_DARWIN_FREEIPA:-0}" != "1" ]]; then
  cat >&2 <<'EOF'
The Dockerized FreeIPA lab is intended for a Linux Docker host.

On Docker Desktop for macOS, upstream FreeIPA containers are known to fail
during ipa-server-install with:

  No valid Negotiate header in server response

If you still want to experiment on macOS, rerun with:

  ALLOW_DARWIN_FREEIPA=1 bash scripts/run-gssapi-docker-lab.sh

For reliable execution, use a Linux host or Linux CI runner.
EOF
  exit 1
fi

mkdir -p "$ARTIFACT_DIR"

case "$ARTIFACT_DIR" in
  "$ROOT_DIR"/*) ;;
  *)
    echo "GSSAPI_DOCKER_ARTIFACT_DIR must stay under repository root: $ROOT_DIR" >&2
    exit 1
    ;;
esac

ARTIFACT_DIR_IN_WORKSPACE="/workspace/${ARTIFACT_DIR#$ROOT_DIR/}"

compose() {
  docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" "$@"
}

container_id_for() {
  compose ps -a -q "$1" 2>/dev/null || true
}

capture_container_file() {
  local service="$1"
  local source_path="$2"
  local dest_path="$3"
  local container_id

  container_id="$(container_id_for "$service")"
  if [[ -n "$container_id" ]]; then
    docker cp "${container_id}:${source_path}" "$dest_path" >/dev/null 2>&1 || true
  fi
}

capture_volume_file() {
  local service="$1"
  local source_path="$2"
  local dest_path="$3"
  local container_id

  container_id="$(container_id_for "$service")"
  if [[ -n "$container_id" ]]; then
    docker run --rm --volumes-from "$container_id" busybox sh -c "cat '$source_path'" >"$dest_path" 2>/dev/null || true
  fi
}

capture_artifacts() {
  compose logs "$FREEIPA_SERVICE" >"$ARTIFACT_DIR/freeipa.log" 2>&1 || true
  compose logs "$RUNNER_SERVICE" >"$ARTIFACT_DIR/runner.log" 2>&1 || true

  # FreeIPA persists its installation logs under /data/var/log.
  capture_volume_file "$FREEIPA_SERVICE" /data/var/log/ipaserver-install.log "$ARTIFACT_DIR/ipaserver-install.log"
  capture_volume_file "$FREEIPA_SERVICE" /data/var/log/ipaclient-install.log "$ARTIFACT_DIR/ipaclient-install.log"
  capture_volume_file "$FREEIPA_SERVICE" /data/var/log/ipa-server-configure-first.log "$ARTIFACT_DIR/ipa-server-configure-first.log"
  capture_volume_file "$FREEIPA_SERVICE" /data/var/log/ipa-server-run.log "$ARTIFACT_DIR/ipa-server-run.log"

  capture_container_file "$FREEIPA_SERVICE" /var/log/httpd/error_log "$ARTIFACT_DIR/httpd-error.log"
  capture_container_file "$FREEIPA_SERVICE" /var/log/httpd/access_log "$ARTIFACT_DIR/httpd-access.log"
  capture_container_file "$FREEIPA_SERVICE" /var/log/krb5kdc.log "$ARTIFACT_DIR/krb5kdc.log"
}

write_report() {
  local exit_code="$1"
  local result

  if [[ "$exit_code" == "0" ]]; then
    result="PASS"
  else
    result="FAIL"
  fi

  cat >"$ARTIFACT_DIR/REPORT.md" <<EOF
# GSSAPI Docker Lab Report

- Result: $result
- Exit code: $exit_code
- Failed step: $CURRENT_STEP
- Project name: $PROJECT_NAME
- FreeIPA host: $FREEIPA_HOST
- Realm: $FREEIPA_REALM
- Base DN: $FREEIPA_BASE_DN

## Expected artifacts

- \`ipa-ca.crt\`
- \`krb5.conf\`
- \`ldapsearch.out\`
- \`ldap-native.out\`
- \`ldap-gssapi.pcap\`
- \`freeipa.log\`
- \`runner.log\`
- \`ipaserver-install.log\`
- \`ipaclient-install.log\`
- \`ipa-server-configure-first.log\`
- \`ipa-server-run.log\`

## Notes

- This lab is intended for Linux Docker hosts.
- On macOS Docker Desktop, upstream FreeIPA container compatibility remains limited.
- GitHub Actions Linux runners should enable Docker user namespace remapping for best FreeIPA compatibility.
EOF
}

cleanup() {
  local exit_code="$?"

  capture_artifacts
  write_report "$exit_code"

  if [[ "$KEEP_STACK" != "1" ]]; then
    compose down -v >/dev/null 2>&1 || true
  fi

  exit "$exit_code"
}
trap cleanup EXIT

CURRENT_STEP="docker compose up"
echo "[1/7] Starting FreeIPA lab"
compose up -d --build "$FREEIPA_SERVICE" "$RUNNER_SERVICE"

CURRENT_STEP="wait for FreeIPA health"
echo "[2/7] Waiting for FreeIPA health check"
attempt=0
container_id="$(compose ps -q "$FREEIPA_SERVICE")"
until [[ -n "$container_id" && "$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{end}}' "$container_id" 2>/dev/null)" == "healthy" ]]; do
  attempt=$((attempt + 1))
  if (( attempt > 90 )); then
    echo "FreeIPA did not become healthy in time" >&2
    compose logs "$FREEIPA_SERVICE" >&2 || true
    exit 1
  fi
  sleep 10
  container_id="$(compose ps -q "$FREEIPA_SERVICE")"
done

CURRENT_STEP="export CA certificate"
echo "[3/7] Exporting CA certificate"
compose exec -T "$FREEIPA_SERVICE" cat /etc/ipa/ca.crt >"$ARTIFACT_DIR/ipa-ca.crt"

CURRENT_STEP="write krb5.conf"
echo "[4/7] Writing krb5.conf"
cat >"$ARTIFACT_DIR/krb5.conf" <<EOF
[libdefaults]
  default_realm = $FREEIPA_REALM
  dns_lookup_kdc = false
  dns_lookup_realm = false
  rdns = false
  udp_preference_limit = 1
  ticket_lifetime = 24h
  forwardable = true

[realms]
  $FREEIPA_REALM = {
    kdc = $FREEIPA_HOST
    admin_server = $FREEIPA_HOST
  }

[domain_realm]
  .$FREEIPA_DOMAIN = $FREEIPA_REALM
  $FREEIPA_DOMAIN = $FREEIPA_REALM
EOF

CURRENT_STEP="install dependencies in runner"
echo "[5/7] Installing dependencies inside RHEL 9 runner"
compose exec -T "$RUNNER_SERVICE" bash -lc '
  set -euo pipefail
  cd /workspace
  npm install --ignore-scripts
  npm run build:compat
  npm run build:native
'

CURRENT_STEP="run ldapsearch and ldap-native verification"
echo "[6/7] Running ldapsearch and ldap-native GSSAPI verification"
compose exec -T "$RUNNER_SERVICE" bash -lc "
  set -euo pipefail
  cd /workspace
  export LDAP_URL='ldap://$FREEIPA_HOST:389'
  export LDAP_BASE_DN='$FREEIPA_BASE_DN'
  export LDAP_CA_FILE='$ARTIFACT_DIR_IN_WORKSPACE/ipa-ca.crt'
  export LDAP_STARTTLS='1'
  export KRB5_CONFIG='$ARTIFACT_DIR_IN_WORKSPACE/krb5.conf'
  export KRB5_PRINCIPAL='$FREEIPA_ADMIN_PRINCIPAL'
  export KRB5_PASSWORD='$FREEIPA_ADMIN_PASSWORD'
  export KRB5CCNAME='FILE:/tmp/krb5cc_gssapi_runner'
  export LDAP_CAPTURE='1'
  export LDAP_CAPTURE_FILE='$ARTIFACT_DIR_IN_WORKSPACE/ldap-gssapi.pcap'
  export LDAPSEARCH_OUT='$ARTIFACT_DIR_IN_WORKSPACE/ldapsearch.out'
  export NODE_OUT='$ARTIFACT_DIR_IN_WORKSPACE/ldap-native.out'
  bash scripts/verify-gssapi-rhel9.sh
"

CURRENT_STEP="capture logs"
echo "[7/7] Capturing logs"
capture_artifacts

echo "artifacts written to: $ARTIFACT_DIR"
if [[ "$KEEP_STACK" == "1" ]]; then
  echo "stack left running; use: docker compose -p $PROJECT_NAME -f $COMPOSE_FILE down -v"
fi
