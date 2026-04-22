#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "missing required command: $1" >&2
    exit 1
  fi
}

require_env() {
  if [[ -z "${!1:-}" ]]; then
    echo "missing required environment variable: $1" >&2
    exit 1
  fi
}

require_command node
require_command ldapsearch
require_command klist

require_env LDAP_URL
require_env LDAP_BASE_DN

LDAP_HOST="$(node -e "console.log(new URL(process.argv[1]).hostname)" "$LDAP_URL")"
LDAP_PROTOCOL="$(node -e "console.log(new URL(process.argv[1]).protocol)" "$LDAP_URL")"
LDAP_PORT="$(node -e "const u=new URL(process.argv[1]); console.log(u.port || (u.protocol === 'ldaps:' ? '636' : '389'))" "$LDAP_URL")"

export KRB5_CONFIG="${KRB5_CONFIG:-/etc/krb5.conf}"
export KRB5CCNAME="${KRB5CCNAME:-FILE:/tmp/krb5cc_$(id -u)}"
export LDAP_STARTTLS="${LDAP_STARTTLS:-$([[ "$LDAP_PROTOCOL" == "ldap:" ]] && echo 1 || echo 0)}"

echo "[1/6] Kerberos cache"
if [[ -n "${KRB5_KEYTAB:-}" && -n "${KRB5_PRINCIPAL:-}" ]]; then
  echo "using keytab: $KRB5_KEYTAB"
  kinit -kt "$KRB5_KEYTAB" "$KRB5_PRINCIPAL"
elif [[ -n "${KRB5_PASSWORD:-}" && -n "${KRB5_PRINCIPAL:-}" ]]; then
  echo "using password for principal: $KRB5_PRINCIPAL"
  printf '%s\n' "$KRB5_PASSWORD" | kinit "$KRB5_PRINCIPAL"
else
  echo "reusing existing Kerberos ticket cache"
fi
klist

CAPTURE_PID=""
cleanup() {
  if [[ -n "$CAPTURE_PID" ]]; then
    kill "$CAPTURE_PID" >/dev/null 2>&1 || true
    wait "$CAPTURE_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

if [[ "${LDAP_CAPTURE:-0}" == "1" ]]; then
  require_command tcpdump
  CAPTURE_FILE="${LDAP_CAPTURE_FILE:-/tmp/ldap-native-gssapi-$(date +%Y%m%d-%H%M%S).pcap}"
  echo "[2/6] Starting tcpdump capture: $CAPTURE_FILE"
  tcpdump -i "${LDAP_CAPTURE_INTERFACE:-any}" -s 0 -w "$CAPTURE_FILE" "host $LDAP_HOST and port $LDAP_PORT" >/dev/null 2>&1 &
  CAPTURE_PID="$!"
  sleep 1
else
  echo "[2/6] Packet capture disabled"
fi

LDAPSEARCH_OUT="${LDAPSEARCH_OUT:-/tmp/ldapsearch-gssapi.out}"
NODE_OUT="${NODE_OUT:-/tmp/node-gssapi.out}"

echo "[3/6] ldapsearch GSSAPI probe"
LDAPSEARCH_ARGS=(
  -Y GSSAPI
  -H "$LDAP_URL"
  -b "$LDAP_BASE_DN"
  -s base
  '(objectClass=*)'
  dn
)
if [[ "$LDAP_STARTTLS" == "1" ]]; then
  LDAPSEARCH_ARGS=(-ZZ "${LDAPSEARCH_ARGS[@]}")
fi
if [[ -n "${LDAP_CA_FILE:-}" ]]; then
  export LDAPTLS_CACERT="$LDAP_CA_FILE"
fi
ldapsearch "${LDAPSEARCH_ARGS[@]}" | tee "$LDAPSEARCH_OUT"

echo "[4/6] ldap-native saslBind() probe"
(
  cd "$ROOT_DIR"
  LDAP_URL="$LDAP_URL" \
  LDAP_BASE_DN="$LDAP_BASE_DN" \
  LDAP_CA_FILE="${LDAP_CA_FILE:-}" \
  LDAP_STARTTLS="$LDAP_STARTTLS" \
  node <<'EOF'
'use strict';

const { Client } = require('./index.cjs');

async function main() {
  const client = new Client({
    url: process.env.LDAP_URL,
    sasl: { mechanism: 'GSSAPI' },
    tlsOptions: process.env.LDAP_CA_FILE ? { caFile: process.env.LDAP_CA_FILE } : undefined,
    connectTimeout: 10000,
    timeout: 10000,
  });

  try {
    if (process.env.LDAP_STARTTLS === '1') {
      await client.startTLS(client.options.tlsOptions);
    }

    await client.saslBind();
    const whoami = await client.exop('1.3.6.1.4.1.4203.1.11.3');
    const rendered = Buffer.isBuffer(whoami.value) ? whoami.value.toString('utf8') : String(whoami.value);
    console.log(rendered);
  } finally {
    await client.unbind().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
EOF
) | tee "$NODE_OUT"

echo "[5/6] Output summary"
echo "ldapsearch output: $LDAPSEARCH_OUT"
echo "node output: $NODE_OUT"
if [[ -n "${CAPTURE_FILE:-}" ]]; then
  echo "capture file: $CAPTURE_FILE"
fi

echo "[6/6] Next checks"
echo "- compare ldapsearch and node outputs for the same Kerberos identity"
echo "- if LDAP_CAPTURE=1, inspect the pcap and confirm the first SASL bind request carries a GSSAPI token"
echo "- recommended tshark filter: ldap && ldap.messageID"
