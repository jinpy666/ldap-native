#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CERT_DIR="$SCRIPT_DIR"

if [ -f "$CERT_DIR/ca.crt" ] && [ -f "$CERT_DIR/ldap.crt" ] && [ -f "$CERT_DIR/ldap.key" ]; then
  echo "TLS certificates already exist, skipping generation."
  exit 0
fi

echo "Generating self-signed TLS certificates for OpenLDAP..."

TMP_CA_KEY="$(mktemp)"
TMP_CA_CERT="$(mktemp)"
TMP_SRV_KEY="$(mktemp)"
TMP_SRV_CSR="$(mktemp)"

trap 'rm -f "$TMP_CA_KEY" "$TMP_CA_CERT" "$TMP_SRV_KEY" "$TMP_SRV_CSR"' EXIT

# CA
openssl genrsa -out "$TMP_CA_KEY" 2048 2>/dev/null
openssl req -new -x509 -key "$TMP_CA_KEY" -out "$TMP_CA_CERT" -days 3650 \
  -subj "/CN=LDAP Test CA/O=Test Corp" 2>/dev/null

# Server key + CSR
openssl genrsa -out "$TMP_SRV_KEY" 2048 2>/dev/null
openssl req -new -key "$TMP_SRV_KEY" -out "$TMP_SRV_CSR" \
  -subj "/CN=localhost/O=Test Corp" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null

# Sign server cert with CA
openssl x509 -req -in "$TMP_SRV_CSR" -CA "$TMP_CA_CERT" -CAkey "$TMP_CA_KEY" \
  -CAcreateserial -out "$CERT_DIR/ldap.crt" -days 3650 \
  -extfile <(printf "subjectAltName=DNS:localhost,IP:127.0.0.1") 2>/dev/null

cp "$TMP_CA_KEY" "$CERT_DIR/ca.key"
cp "$TMP_CA_CERT" "$CERT_DIR/ca.crt"
cp "$TMP_SRV_KEY" "$CERT_DIR/ldap.key"

chmod 644 "$CERT_DIR/ca.crt" "$CERT_DIR/ldap.crt"
chmod 600 "$CERT_DIR/ca.key" "$CERT_DIR/ldap.key"

echo "Certificates generated in $CERT_DIR/"
