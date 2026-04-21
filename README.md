# ldap-native

A `ldapts`-compatible Node.js package backed by OpenLDAP `libldap`, with SASL and Kerberos/GSSAPI entry points.

This repository is a practical starter implementation for a native npm package that:

- keeps the familiar `ldapts` `Client` API shape,
- replaces the TypeScript socket/BER transport with `libldap`,
- adds `bind('GSSAPI')` support for Kerberos,
- stages add-ons for cross-platform prebuild distribution,
- executes a substantial part of the upstream `ldapts` test corpus directly.

## Current status

Implemented now:

- `new Client(options)`
- `bind(dn, password)` for simple bind
- `bind('PLAIN' | 'EXTERNAL' | 'GSSAPI')`
- `startTLS(options)`
- `search()`
- `searchPaginated()`
- `compare()`
- `add()`
- `modify()`
- `del()`
- `modifyDN()`
- `exop()` including LDAP Who Am I (`1.3.6.1.4.1.4203.1.11.3`)
- root exports for controls, filters, BER helpers, DN helpers, and postal address helpers
- dist output compatible with CommonJS and ESM import tests
- a native loader that resolves local builds and staged `prebuilds/`
- a GitHub Actions matrix for API compatibility on Linux/macOS/Windows plus native build jobs for Linux/macOS and an MSYS2-based Windows native job

Compatibility evidence now includes:

- **184 upstream `ldapts` tests executed directly** (`Controls`, `FilterParser`, `PostalAddress`, BER, DN, and filter suites)
- **13 client parity tests** covering the migration-relevant public scenarios from upstream `Client.test.ts`
- package unit tests, import tests, and optional real OpenLDAP integration tests

See [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) for the exact boundary between direct upstream execution and client parity coverage.

## Install

### Source build

Linux/macOS source build needs:

- Node.js 20+
- Python 3
- C/C++ build toolchain
- OpenLDAP client headers and libraries (`ldap.h`, `libldap`, `liblber`)
- Cyrus SASL runtime for SASL/GSSAPI flows

Then run:

```bash
npm install
npm run build
npm test
```

The included build script points `node-gyp` at the current Node installation so it can work in offline or air-gapped environments where Node headers are already present locally.

### Windows source build

The repository includes an MSYS2/UCRT64-based workflow. For local Windows source builds, mirror that environment and install:

- `mingw-w64-ucrt-x86_64-nodejs`
- `mingw-w64-ucrt-x86_64-openldap`
- `mingw-w64-ucrt-x86_64-cyrus-sasl`
- `mingw-w64-ucrt-x86_64-gcc`
- `mingw-w64-ucrt-x86_64-python`

## Build outputs

- `build/Release/ldap_native.node` — native addon
- `dist/` — CJS/ESM/type outputs aligned with `ldapts` package imports
- `dist/compat-cjs/` — generated compatibility modules reused by dist wrappers
- `prebuilds/<platform-triple>/ldap_native.node` — staged prebuild layout

## Usage

### Simple bind

```js
const { Client } = require('ldap-native');

const client = new Client({
  url: 'ldap://ldap.example.com:389',
  connectTimeout: 5000,
  timeout: 5000,
});

await client.startTLS({ caFile: '/etc/ssl/certs/ldap-ca.pem' });
await client.bind('cn=admin,dc=example,dc=com', 'admin');

const { searchEntries } = await client.search('dc=example,dc=com', {
  filter: '(uid=jdoe)',
  attributes: ['cn', 'uid', 'mail'],
  paged: { pageSize: 100 },
});

await client.unbind();
```

### Kerberos / GSSAPI

```js
const { Client } = require('ldap-native');

const client = new Client({
  url: 'ldap://ldap.example.com:389',
  sasl: { mechanism: 'GSSAPI' },
});

await client.startTLS({ caFile: '/etc/ssl/certs/ldap-ca.pem' });
await client.bind('GSSAPI');

const whoami = await client.exop('1.3.6.1.4.1.4203.1.11.3');
console.log(Buffer.isBuffer(whoami.value) ? whoami.value.toString('utf8') : whoami.value);

await client.unbind();
```

## Test matrix

Run package tests:

```bash
npm test
```

Run direct upstream coverage only:

```bash
npm run test:upstream
```

Run optional real OpenLDAP integration tests:

```bash
LDAP_URL='ldap://127.0.0.1:389' \
LDAP_BIND_DN='cn=admin,dc=example,dc=com' \
LDAP_BIND_PASSWORD='admin' \
LDAP_BASE_DN='dc=example,dc=com' \
npm run test:integration
```

## Repository layout

- `native/` — N-API addon source using OpenLDAP `libldap`
- `lib/` — CommonJS runtime implementation and native loader
- `src/` / `compat-cjs/` — compatibility exports and generated type bridge files
- `upstream/` — vendored upstream `ldapts` tests used for direct execution
- `upstream-src/` — vendored upstream `ldapts` source files reused for compatible public helpers
- `tests/` — package, import, parity, and integration tests
- `docs/` — architecture, build, compatibility, Kerberos, and release docs

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Build notes](docs/BUILD.md)
- [Compatibility matrix](docs/COMPATIBILITY.md)
- [Kerberos notes](docs/KERBEROS.md)
- [Testing](docs/TESTING.md)
- [Prebuild strategy](docs/PREBUILDS.md)
- [npm publish](docs/NPM_PUBLISH.md)

## Automated CI and npm release

The repository includes two GitHub Actions workflows:

- `ci.yml` — API compatibility tests on Linux/macOS/Windows, plus native builds and smoke tests on supported platforms
- `release.yml` — multi-platform prebuild collection and npm publish on `v*` tags

For npm publish, the recommended setup is **npm Trusted Publishing** with GitHub Actions OIDC. See [docs/NPM_PUBLISH.md](docs/NPM_PUBLISH.md).
