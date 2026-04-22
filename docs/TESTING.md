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
```

Then run:

```bash
npm run test:integration
```

If you just want the repo-managed Docker path, `npm run test:docker` now brings the container up, runs the entire `tests/integration/` directory against it, and tears it down automatically.
