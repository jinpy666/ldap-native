#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.gssapi.yml"
PROJECT_NAME="${GSSAPI_DOCKER_PROJECT:-ldap-native-gssapi-overnight}"
ARTIFACT_DIR="${GSSAPI_OVERNIGHT_ARTIFACT_DIR:-$ROOT_DIR/artifacts/gssapi-overnight-$(date +%Y%m%d-%H%M%S)}"
BOOTSTRAP_DIR="$ARTIFACT_DIR/bootstrap"
ITERATIONS_DIR="$ARTIFACT_DIR/iterations"
SUMMARY_FILE="$ARTIFACT_DIR/summary.tsv"
REPORT_FILE="$ARTIFACT_DIR/REPORT.md"

RUNNER_SERVICE="${GSSAPI_RUNNER_SERVICE:-gssapi-runner}"
FREEIPA_SERVICE="${GSSAPI_FREEIPA_SERVICE:-freeipa}"
FREEIPA_HOST="${GSSAPI_FREEIPA_HOST:-ipa.example.test}"
FREEIPA_REALM="${GSSAPI_FREEIPA_REALM:-EXAMPLE.TEST}"
FREEIPA_BASE_DN="${GSSAPI_FREEIPA_BASE_DN:-dc=example,dc=test}"
FREEIPA_ADMIN_PRINCIPAL="${GSSAPI_FREEIPA_ADMIN_PRINCIPAL:-admin@EXAMPLE.TEST}"
FREEIPA_ADMIN_PASSWORD="${GSSAPI_FREEIPA_ADMIN_PASSWORD:-Secret123}"

DURATION_SECONDS="${GSSAPI_OVERNIGHT_DURATION_SECONDS:-28800}"
INTERVAL_SECONDS="${GSSAPI_OVERNIGHT_INTERVAL_SECONDS:-60}"
ITERATION_TIMEOUT_SECONDS="${GSSAPI_OVERNIGHT_ITERATION_TIMEOUT_SECONDS:-45}"
MAX_ITERATIONS="${GSSAPI_OVERNIGHT_MAX_ITERATIONS:-0}"
FAIL_FAST="${GSSAPI_OVERNIGHT_FAIL_FAST:-0}"
KEEP_STACK="${KEEP_GSSAPI_STACK:-0}"

CURRENT_STEP="bootstrap"
TOTAL=0
PASSED=0
FAILED=0

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

compose() {
  docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" "$@"
}

workspace_path() {
  local host_path="$1"
  printf '/workspace/%s' "${host_path#$ROOT_DIR/}"
}

capture_logs() {
  compose logs "$FREEIPA_SERVICE" >"$ARTIFACT_DIR/freeipa.log" 2>&1 || true
  compose logs "$RUNNER_SERVICE" >"$ARTIFACT_DIR/runner.log" 2>&1 || true
}

write_report() {
  local exit_code="$1"
  local result="PASS"
  if [[ "$exit_code" != "0" ]]; then
    result="FAIL"
  fi

  cat >"$REPORT_FILE" <<EOF
# GSSAPI Overnight Demo Report

- Result: $result
- Exit code: $exit_code
- Failed step: $CURRENT_STEP
- Project name: $PROJECT_NAME
- Duration seconds: $DURATION_SECONDS
- Interval seconds: $INTERVAL_SECONDS
- Iteration timeout seconds: $ITERATION_TIMEOUT_SECONDS
- Total iterations: $TOTAL
- Passed iterations: $PASSED
- Failed iterations: $FAILED
- FreeIPA host: $FREEIPA_HOST
- Realm: $FREEIPA_REALM
- Base DN: $FREEIPA_BASE_DN

## Files

- \`summary.tsv\`: one row per iteration
- \`bootstrap/\`: one-shot Docker lab bootstrap artifacts
- \`iterations/<n>/verify.log\`: ldapsearch + ldap-native output for each iteration
- \`freeipa.log\`: FreeIPA container logs
- \`runner.log\`: RHEL 9 runner container logs

## Expected success signal

Each successful iteration must show both:

- \`ldapsearch GSSAPI probe\` result \`0 Success\`
- \`ldap-native saslBind() probe\` whoami output
EOF
}

cleanup() {
  local exit_code="$?"
  CURRENT_STEP="${CURRENT_STEP:-cleanup}"

  capture_logs
  write_report "$exit_code"

  if [[ "$KEEP_STACK" != "1" ]]; then
    compose down -v >/dev/null 2>&1 || true
  fi

  exit "$exit_code"
}

require_command docker

if [[ "$(uname -s)" == "Darwin" && "${ALLOW_DARWIN_FREEIPA:-0}" != "1" ]]; then
  cat >&2 <<'EOF'
The overnight GSSAPI demo is intended for a Linux Docker host.

Use GitHub Actions Linux, a Linux VM, or a Linux server. Docker Desktop for
macOS is not a reliable FreeIPA host for this lab.
EOF
  exit 1
fi

case "$ARTIFACT_DIR" in
  "$ROOT_DIR"/*) ;;
  *)
    echo "GSSAPI_OVERNIGHT_ARTIFACT_DIR must stay under repository root: $ROOT_DIR" >&2
    exit 1
    ;;
esac

mkdir -p "$BOOTSTRAP_DIR" "$ITERATIONS_DIR"
trap cleanup EXIT

CURRENT_STEP="bootstrap Docker GSSAPI lab"
echo "[1/3] Bootstrapping FreeIPA + RHEL 9 runner"
GSSAPI_DOCKER_PROJECT="$PROJECT_NAME" \
GSSAPI_DOCKER_ARTIFACT_DIR="$BOOTSTRAP_DIR" \
KEEP_GSSAPI_STACK=1 \
bash "$ROOT_DIR/scripts/run-gssapi-docker-lab.sh"

CURRENT_STEP="overnight verification loop"
echo "[2/3] Running GSSAPI loop"
printf 'iteration\tstatus\texit_code\tstarted_at\tended_at\tduration_seconds\tlog\n' >"$SUMMARY_FILE"

deadline=$(( $(date +%s) + DURATION_SECONDS ))
iteration=0

while (( $(date +%s) < deadline )); do
  if (( MAX_ITERATIONS > 0 && iteration >= MAX_ITERATIONS )); then
    break
  fi

  iteration=$((iteration + 1))
  TOTAL=$iteration
  iter_name="$(printf '%06d' "$iteration")"
  iter_dir="$ITERATIONS_DIR/$iter_name"
  mkdir -p "$iter_dir"

  started_epoch="$(date +%s)"
  started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  log_file="$iter_dir/verify.log"

  echo "iteration $iter_name started at $started_at"
  set +e
  compose exec -T \
    -e LDAP_URL="ldap://$FREEIPA_HOST:389" \
    -e LDAP_BASE_DN="$FREEIPA_BASE_DN" \
    -e LDAP_CA_FILE="$(workspace_path "$BOOTSTRAP_DIR/ipa-ca.crt")" \
    -e LDAP_STARTTLS="1" \
    -e KRB5_CONFIG="$(workspace_path "$BOOTSTRAP_DIR/krb5.conf")" \
    -e KRB5_PRINCIPAL="$FREEIPA_ADMIN_PRINCIPAL" \
    -e KRB5_PASSWORD="$FREEIPA_ADMIN_PASSWORD" \
    -e KRB5CCNAME="FILE:/tmp/krb5cc_gssapi_overnight" \
    -e LDAP_CAPTURE="0" \
    -e LDAPSEARCH_OUT="$(workspace_path "$iter_dir/ldapsearch.out")" \
    -e NODE_OUT="$(workspace_path "$iter_dir/ldap-native.out")" \
    "$RUNNER_SERVICE" \
    bash -lc "cd /workspace && timeout '$ITERATION_TIMEOUT_SECONDS' bash scripts/verify-gssapi-rhel9.sh" \
    >"$log_file" 2>&1
  rc="$?"
  set -e

  ended_epoch="$(date +%s)"
  ended_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  elapsed=$((ended_epoch - started_epoch))

  if [[ "$rc" == "0" ]]; then
    status="PASS"
    PASSED=$((PASSED + 1))
  else
    status="FAIL"
    FAILED=$((FAILED + 1))
  fi

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "$iter_name" "$status" "$rc" "$started_at" "$ended_at" "$elapsed" "${log_file#$ROOT_DIR/}" \
    >>"$SUMMARY_FILE"

  echo "iteration $iter_name $status in ${elapsed}s"

  if [[ "$status" == "FAIL" && "$FAIL_FAST" == "1" ]]; then
    break
  fi

  if (( $(date +%s) + INTERVAL_SECONDS >= deadline )); then
    break
  fi
  sleep "$INTERVAL_SECONDS"
done

CURRENT_STEP="final report"
echo "[3/3] Writing report"
capture_logs

if (( FAILED > 0 )); then
  exit 1
fi
