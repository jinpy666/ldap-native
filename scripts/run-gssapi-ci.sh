#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_DIR="${GSSAPI_ARTIFACT_DIR:-$ROOT_DIR/artifacts/gssapi}"

mkdir -p "$ARTIFACT_DIR"

if [[ -n "${LDAP_CA_B64:-}" ]]; then
  export LDAP_CA_FILE="${LDAP_CA_FILE:-$ARTIFACT_DIR/ldap-ca.pem}"
  printf '%s' "$LDAP_CA_B64" | base64 --decode > "$LDAP_CA_FILE"
  chmod 600 "$LDAP_CA_FILE"
fi

if [[ -n "${KRB5_CONFIG_B64:-}" ]]; then
  export KRB5_CONFIG="${KRB5_CONFIG:-$ARTIFACT_DIR/krb5.conf}"
  printf '%s' "$KRB5_CONFIG_B64" | base64 --decode > "$KRB5_CONFIG"
  chmod 600 "$KRB5_CONFIG"
fi

if [[ -n "${KRB5_KEYTAB_B64:-}" ]]; then
  export KRB5_KEYTAB="${KRB5_KEYTAB:-$ARTIFACT_DIR/ci.keytab}"
  printf '%s' "$KRB5_KEYTAB_B64" | base64 --decode > "$KRB5_KEYTAB"
  chmod 600 "$KRB5_KEYTAB"
fi

export LDAP_CAPTURE=1
export LDAP_CAPTURE_FILE="${LDAP_CAPTURE_FILE:-$ARTIFACT_DIR/ldap-gssapi.pcap}"
export LDAPSEARCH_OUT="${LDAPSEARCH_OUT:-$ARTIFACT_DIR/ldapsearch.out}"
export NODE_OUT="${NODE_OUT:-$ARTIFACT_DIR/ldap-native.out}"

bash "$ROOT_DIR/scripts/verify-gssapi-rhel9.sh"

if command -v tshark >/dev/null 2>&1 && [[ -f "$LDAP_CAPTURE_FILE" ]]; then
  tshark -r "$LDAP_CAPTURE_FILE" -Y ldap -V > "$ARTIFACT_DIR/tshark-ldap.txt" || true
fi

{
  echo "LDAP_URL=${LDAP_URL:-}"
  echo "LDAP_BASE_DN=${LDAP_BASE_DN:-}"
  echo "LDAP_STARTTLS=${LDAP_STARTTLS:-}"
  echo "KRB5_PRINCIPAL=${KRB5_PRINCIPAL:-}"
  echo "KRB5_CONFIG=${KRB5_CONFIG:-}"
  echo "KRB5CCNAME=${KRB5CCNAME:-}"
  echo "LDAP_CAPTURE_FILE=$LDAP_CAPTURE_FILE"
  echo "LDAPSEARCH_OUT=$LDAPSEARCH_OUT"
  echo "NODE_OUT=$NODE_OUT"
} > "$ARTIFACT_DIR/summary.env"

{
  echo "# GSSAPI CI Report"
  echo
  echo "## Inputs"
  echo "- LDAP_URL: ${LDAP_URL:-}"
  echo "- LDAP_BASE_DN: ${LDAP_BASE_DN:-}"
  echo "- LDAP_STARTTLS: ${LDAP_STARTTLS:-}"
  echo "- KRB5_PRINCIPAL: ${KRB5_PRINCIPAL:-}"
  echo "- KRB5_CONFIG: ${KRB5_CONFIG:-}"
  echo "- KRB5CCNAME: ${KRB5CCNAME:-}"
  echo
  echo "## Outputs"
  echo "- ldapsearch output: ${LDAPSEARCH_OUT}"
  echo "- ldap-native output: ${NODE_OUT}"
  echo "- packet capture: ${LDAP_CAPTURE_FILE}"
  if [[ -f "$ARTIFACT_DIR/tshark-ldap.txt" ]]; then
    echo "- tshark decode: $ARTIFACT_DIR/tshark-ldap.txt"
  fi
  echo
  echo "## Preview"
  echo "### ldapsearch"
  echo '```text'
  sed -n '1,40p' "$LDAPSEARCH_OUT" || true
  echo '```'
  echo
  echo "### ldap-native"
  echo '```text'
  sed -n '1,40p' "$NODE_OUT" || true
  echo '```'
} > "$ARTIFACT_DIR/REPORT.md"
