# Testing

## What is covered

This repository now tests compatibility at three layers:

1. **package smoke and unit tests** under `tests/unit/`
2. **direct upstream test execution** under `upstream/` via `npm run test:upstream`
3. **optional real-server integration tests** under `tests/integration/`

## Commands

Build generated compatibility artifacts:

```bash
npm run build:compat
```

Run unit and parity tests:

```bash
npm run test:unit
```

Run upstream tests that can be executed directly:

```bash
npm run test:upstream
```

Run import-shape tests:

```bash
npm run test:imports
```

Run optional real OpenLDAP integration tests:

```bash
npm run test:integration
```

Run both integration suites against the bundled Docker OpenLDAP environment:

```bash
npm run test:docker
```

Run everything except live-server integration setup:

```bash
npm test
```

Run the current full local regression path:

```bash
npm run test:full
```

## Direct upstream test set

`npm run test:upstream` currently executes the downloaded upstream `ldapts` tests for:

- controls
- filter parser
- postal address handling
- BER reader/writer helpers
- DN / RDN helpers
- filter helpers

The command runs them with:

- `LDAP_NATIVE_USE_MOCK=1`
- `node --test`
- `--experimental-strip-types`

This lets the repository run the upstream `.test.ts` files directly without bringing in the full upstream Vitest toolchain.

## Client parity tests

`tests/unit/upstream-client-parity.test.cjs` covers the migration-critical public scenarios from upstream `Client.test.ts` while avoiding private transport assertions that do not apply to a native `libldap` backend.

## Real integration tests

Set these environment variables to enable real-server tests:

```bash
export LDAP_URL='ldap://127.0.0.1:389'
export LDAP_BIND_DN='cn=admin,dc=example,dc=com'
export LDAP_BIND_PASSWORD='admin'
export LDAP_BASE_DN='dc=example,dc=com'
export LDAP_STARTTLS='0'
# Optional for GSSAPI:
export LDAP_GSSAPI='1'
export KRB5_CONFIG='/etc/krb5.conf'
export KRB5CCNAME='FILE:/tmp/krb5cc_1000'

# Optional for generic SASL coverage:
export LDAP_SASL_MECHANISM='PLAIN'
export LDAP_SASL_USER='test_user'
export LDAP_SASL_PASSWORD='secret'
export LDAP_SASL_REALM='EXAMPLE.COM'
export LDAP_SASL_PROXY_USER='u:test_admin'
export LDAP_SASL_SECURITY_PROPERTIES='none'
```

For GSSAPI specifically, prefer:

```bash
export LDAP_GSSAPI='1'
unset LDAP_SASL_USER LDAP_SASL_PASSWORD LDAP_SASL_REALM LDAP_SASL_PROXY_USER LDAP_SASL_SECURITY_PROPERTIES
```

That path exercises `client.saslBind()` with default Kerberos credentials from
the current ticket cache, which is the closest match to `ldapsearch -Y GSSAPI`.

Then run:

```bash
npm run test:integration
```

For a focused RHEL 9 GSSAPI comparison against `ldapsearch -Y GSSAPI`, use:

```bash
bash scripts/verify-gssapi-rhel9.sh
```

If you want packet capture for first-bind comparison:

```bash
LDAP_CAPTURE=1 bash scripts/verify-gssapi-rhel9.sh
```

If you do not have an existing LDAP / Kerberos environment, you can boot the
self-contained Docker lab instead:

```bash
npm run test:gssapi:docker
```

That path brings up FreeIPA plus a Rocky Linux 9 runner container, acquires a
Kerberos ticket with the built-in lab principal, runs both `ldapsearch` and
`client.saslBind()`, and saves `ldapsearch.out`, `ldap-native.out`, and a
`ldap-gssapi.pcap` capture under `artifacts/gssapi-docker/`.

If you just want the repo-managed Docker path, `npm run test:docker` now brings the container up, runs the entire `tests/integration/` directory against it, and tears it down automatically.

## CI coverage

The GitHub Actions CI now covers three layers:

1. API compatibility and mock-backed parity tests across Linux, macOS, and Windows
2. native build + smoke coverage on Linux, macOS, and Windows
3. Docker-backed OpenLDAP integration coverage on Linux

There is also an optional Linux GSSAPI job in CI. It only runs when the
repository secrets for a real Kerberos / LDAP environment are configured.

Recommended secrets:

```bash
LDAP_URL
LDAP_BASE_DN
KRB5_PRINCIPAL
```

One of:

```bash
KRB5_PASSWORD
KRB5_KEYTAB_B64
```

Optional:

```bash
LDAP_CA_FILE
LDAP_STARTTLS
KRB5_CONFIG
```

When those secrets are present, CI runs `scripts/run-gssapi-ci.sh`, which:

- acquires Kerberos credentials
- runs `ldapsearch -Y GSSAPI`
- runs `ldap-native` via `client.saslBind()`
- captures traffic to a `.pcap`
- uploads logs and capture artifacts for inspection

For the full GitHub Actions secret setup checklist, see [CI_GSSAPI.md](./CI_GSSAPI.md).

For the self-contained Dockerized GSSAPI lab, see [GSSAPI_DOCKER.md](./GSSAPI_DOCKER.md).
