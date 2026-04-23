# ldap-native

[![npm version](https://img.shields.io/npm/v/ldap-native.svg)](https://www.npmjs.com/package/ldap-native)
[![CI](https://github.com/jinpy666/ldap-native/actions/workflows/ci.yml/badge.svg)](https://github.com/jinpy666/ldap-native/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Native Node.js LDAP client for OpenLDAP and Active Directory environments, with an API designed to stay close to [`ldapts`](https://github.com/ldapts/ldapts). `ldap-native` replaces the JavaScript socket/BER transport with a Node-API addon backed by OpenLDAP `libldap`, while keeping the familiar `Client`-centric developer experience and adding SASL / Kerberos / GSSAPI entry points.

This package is aimed at infrastructure and platform teams that need a migration-friendly LDAP client for Node.js services: internal authentication, enterprise IAM, directory lookups, account sync jobs, SSO-adjacent integrations, and other server-side directory workflows where native LDAP support matters.

## Why `ldap-native`

- **Node.js LDAP client with native OpenLDAP bindings** instead of a pure JavaScript transport layer
- **`ldapts`-compatible API shape** for lower-friction migration from existing TypeScript or JavaScript codebases
- **SASL, Kerberos, and GSSAPI bind support** for enterprise directory environments
- **CommonJS, ESM, and TypeScript declarations** for modern Node package consumption
- **OpenLDAP / Active Directory migration focus** rather than low-level protocol experimentation
- **Cross-platform packaging path** with source builds today and staged prebuild publication support

## Install

```bash
npm install ldap-native
```

If a matching prebuild is available for your platform, install uses it. Otherwise the package falls back to a local native build against the system LDAP client libraries.

## Ideal use cases

- Replace `ldapts` while keeping nearly the same public `Client` API
- Standardize Node.js LDAP access across internal services
- Talk to OpenLDAP, Active Directory, or Kerberos-enabled directory infrastructure
- Build authentication, provisioning, or directory synchronization services in Node.js
- Adopt a native LDAP backend without rewriting application-level LDAP flows

## At a glance

`ldap-native` combines three concerns in one package:

1. compatibility-oriented package exports for `ldapts` consumers
2. a Node-API addon that calls OpenLDAP directly
3. CI/release automation for cross-platform source builds and staged prebuild distribution

## Feature goals

- keep the familiar `ldapts` `Client` API shape
- replace the TypeScript socket/BER transport with OpenLDAP `libldap`
- add `bind('GSSAPI')` support for Kerberos-enabled environments
- preserve common helper exports for controls, filters, BER, DN, and postal address helpers
- validate migration-relevant behavior against upstream `ldapts` tests
- prepare the package for multi-platform prebuild publication

## Package positioning

| Topic | `ldap-native` position |
| --- | --- |
| Node.js LDAP client | Native addon backed by OpenLDAP `libldap` |
| `ldapts` migration | Public `Client` API intentionally stays close to upstream |
| `ldapjs` migration | Promise-based destination with explicit migration guidance |
| Enterprise auth | SASL / Kerberos / GSSAPI entry points included |
| Distribution model | CommonJS + ESM + generated `.d.ts` output |
| Infrastructure fit | Designed for server-side directory access, IAM, auth, and sync workloads |

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
- CommonJS and ESM import surface covered by import tests
- a native loader that resolves local builds and staged `prebuilds/`
- a GitHub Actions matrix for API compatibility on Linux/macOS/Windows plus native build jobs for Linux/macOS and MSVC-based Windows builds

Compatibility evidence now includes:

- **184 upstream `ldapts` tests executed directly** (`Controls`, `FilterParser`, `PostalAddress`, BER, DN, and filter suites)
- **13 client parity tests** covering the migration-relevant public scenarios from upstream `Client.test.ts`
- package unit tests, import tests, and optional real OpenLDAP integration tests

See [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md) for the exact boundary between direct upstream execution and client parity coverage.

## Migration paths

- Migrating from `ldapts`: low-friction package replacement in the common case
- Migrating from `ldapjs`: callback/event-driven code usually needs explicit `async/await` and result-shape updates

Start with:

- [Migration guide: `ldapjs` / `ldapts` to `ldap-native`](docs/MIGRATION.md)

## Important limits and non-goals

This repository targets **migration-friendly compatibility with the public `ldapts` API**, not a byte-for-byte recreation of the original internal transport layer.

Current boundaries to keep in mind:

- generic `Control` to native `LDAPControl` encoding is still partial
- some parity work intentionally excludes private socket/BER pipeline assertions from upstream `Client.test.ts`
- the current native addon uses synchronous `libldap` calls behind Promise-based JavaScript methods; production hardening should move blocking LDAP work into async workers

## Native install details

`ldap-native` does not need an OpenLDAP server process on the local machine. Linux and macOS source builds rely on OpenLDAP client libraries (`libldap`, `liblber`) and Cyrus SASL; Windows source builds use the system `Wldap32` SDK via MSVC.

The npm install flow now behaves as follows:

1. Try a packaged prebuild for the current platform.
2. If no compatible prebuild is present, fall back to a local source build.
3. If native dependencies are missing, print platform-specific install commands.

The package never runs `apt`, `dnf`, `brew`, or `apk` for you.

### Common system dependencies

Install the native prerequisites before `npm install` if you expect to build from source, or if a packaged prebuild fails to load because runtime libraries are missing.

| Platform | Typical packages |
| --- | --- |
| Debian / Ubuntu | `apt-get update && apt-get install -y libldap-dev libsasl2-dev python3 make g++` |
| Fedora / RHEL / CentOS | `dnf install -y openldap-devel cyrus-sasl-devel python3 make gcc-c++` |
| Alpine | `apk add --no-cache openldap-dev cyrus-sasl-dev build-base python3` |
| macOS | `brew install openldap cyrus-sasl` |
| Windows (MSVC) | `npm install` |

On macOS, Homebrew `openldap` is keg-only, so source builds may also need:

```bash
export CPPFLAGS="-I$(brew --prefix openldap)/include"
export LDFLAGS="-L$(brew --prefix openldap)/lib"
```

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

The included build helper points `node-gyp` at the current Node installation so it can work in offline or air-gapped environments where Node headers are already present locally.

### Windows source build

The repository now uses the standard `node-gyp` + MSVC toolchain on `windows-latest`. For local Windows source builds:

- use Developer PowerShell for Visual Studio 2022, or install the Visual Studio Build Tools workload that provides `cl.exe`, `MSBuild`, and the Windows SDK
- use Node.js 20+ and Python 3 on `PATH`
- run `npm install`

The Windows addon links against the system `Wldap32` SDK, so it does not require separate OpenLDAP or Cyrus SASL development packages.

### GSSAPI / Kerberos environments

If you use `bind('GSSAPI')`, the base `libsasl2` library is not enough on its own. You also need:

- a SASL GSSAPI plugin for your distribution
- Kerberos client libraries and configuration
- valid credentials, keytabs, or ticket cache for the target environment

Typical extra packages include:

- Debian / Ubuntu: `libsasl2-modules-gssapi-mit`, `krb5-user`
- Fedora / RHEL / CentOS: `cyrus-sasl-gssapi`, `krb5-workstation`
- Alpine: `cyrus-sasl-gssapiv2`, `heimdal`

## Build outputs

- `build/Release/ldap_native.node` — native addon
- `types/` — generated declaration files from `src/types/`
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

LDAP attributes are multi-valued by design, so search attributes are returned
as arrays even when your directory currently stores only one value. If your
application wants scalar values for known single-value fields, opt in per
search:

```js
const { searchEntries } = await client.search('dc=example,dc=com', {
  filter: '(uid=jdoe)',
  attributes: ['cn', 'uid', 'mail', 'memberOf'],
  singleValueAttributes: ['cn', 'uid', 'mail'],
  trimAttributeValues: ['cn', 'uid', 'mail'],
});

console.log(searchEntries[0].mail); // 'jdoe@example.com'
console.log(searchEntries[0].memberOf); // still an array
```

`singleValueAttributes: true` is also supported and flattens any returned
attribute that has exactly one value. Prefer the explicit list for production
code because attributes such as `memberOf`, `objectClass`, `proxyAddresses`,
and `servicePrincipalName` can be legitimately multi-valued even when a
particular entry currently has one value.

`trimAttributeValues` follows the same shape: pass an attribute list to trim
only known text fields, or `true` to trim every returned string value. Buffers
are left unchanged.

### Kerberos / GSSAPI

```js
const { Client } = require('ldap-native');

const client = new Client({
  url: 'ldap://ldap.example.com:389',
  sasl: { mechanism: 'GSSAPI' },
});

await client.startTLS({ caFile: '/etc/ssl/certs/ldap-ca.pem' });
await client.saslBind();

const whoami = await client.exop('1.3.6.1.4.1.4203.1.11.3');
console.log(Buffer.isBuffer(whoami.value) ? whoami.value.toString('utf8') : whoami.value);

await client.unbind();
```

`bind('GSSAPI')` remains available as a migration-friendly shorthand. New code
should prefer `saslBind()` because it maps directly to the multi-step OpenLDAP
SASL flow used by `ldapsearch -Y GSSAPI`.

Kerberos credentials are acquired before the LDAP bind, usually with `kinit`:

```bash
export LDAP_URL='ldap://ad01.example.com:389'
export LDAP_BASE_DN='dc=example,dc=com'
export LDAP_CA_FILE='/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem'
export LDAP_STARTTLS=1

export KRB5_CONFIG='/etc/krb5.conf'
export KRB5CCNAME="FILE:/tmp/krb5cc_$(id -u)"
export KRB5_PRINCIPAL='svc_ldap@EXAMPLE.COM'
export KRB5_PASSWORD='YourStrongPassword'

printf '%s\n' "$KRB5_PASSWORD" | kinit "$KRB5_PRINCIPAL"
node node_modules/ldap-native/examples/gssapi-rhel9.cjs
```

For service workloads, use `KRB5_KEYTAB` instead of `KRB5_PASSWORD`:

```bash
export KRB5_PRINCIPAL='svc_ldap@EXAMPLE.COM'
export KRB5_KEYTAB='/etc/security/keytabs/svc_ldap.keytab'
node node_modules/ldap-native/examples/gssapi-rhel9.cjs
```

If `ldapsearch` works but a Node client appears to send only the literal
`GSSAPI` mechanism name in step 1, the bind flow is wrong. `ldap-native` uses
OpenLDAP's multi-round interactive SASL bind path so the first request can carry
the generated GSSAPI credential token, matching the mature `ldapsearch` /
OpenLDAP behavior.

For a RHEL 9 oriented end-to-end example including Kerberos ticket acquisition,
TLS, npm package usage, and `ldapsearch` comparison, see:

- [docs/GSSAPI_NPM_USAGE.md](docs/GSSAPI_NPM_USAGE.md)
- [docs/wiki/KERBEROS_TLS_GSSAPI_EXAMPLE.md](docs/wiki/KERBEROS_TLS_GSSAPI_EXAMPLE.md)
- [docs/GSSAPI_DOCKER.md](docs/GSSAPI_DOCKER.md)

On Windows, `GSSAPI` uses the native Wldap32 SSPI/Negotiate path instead of
Cyrus SASL. If `user` and `password` are omitted, the current Windows logon
credentials are used:

```js
const client = new Client({
  url: 'ldap://ad01.example.com:389',
  sasl: { mechanism: 'GSSAPI' },
});

await client.startTLS();
await client.saslBind();
```

For explicit Windows credentials, pass `domain` or `realm` with the account:

```js
await client.saslBind({
  mechanism: 'GSSAPI',
  user: 'svc_ldap',
  password: process.env.LDAP_GSSAPI_PASSWORD,
  domain: 'EXAMPLE',
});
```

The Windows verification entry point is:

```powershell
$env:LDAP_URL = 'ldap://ad01.example.com:389'
$env:LDAP_BASE_DN = 'dc=example,dc=com'
$env:LDAP_GSSAPI_USER = 'svc_ldap'
$env:LDAP_GSSAPI_PASSWORD = 'secret'
$env:LDAP_GSSAPI_DOMAIN = 'EXAMPLE'
npm run test:gssapi:windows
```

That command runs the Windows example and the gated integration test at
`tests/integration/windows-gssapi.integration.test.cjs`.

When GitHub Actions does not have Windows LDAP / Kerberos credentials, the
`gssapi-windows` job falls back to a self-contained synthetic LDAP fixture. That
fallback does not prove a real KDC exchange, but it does build the Windows
native addon and drives `client.saslBind({ mechanism: 'GSSAPI' })` through the
Wldap32 SSPI/Negotiate code path without external secrets.

### Advanced SASL bind

```js
const { Client } = require('ldap-native');

const client = new Client({
  url: 'ldap://ldap.example.com:389',
});

await client.startTLS({ caFile: '/etc/ssl/certs/ldap-ca.pem' });
await client.saslBind({
  mechanism: 'PLAIN',
  user: 'test_user',
  password: 'secret',
  realm: 'EXAMPLE.COM',
  proxyUser: 'u:test_admin',
  securityProperties: 'none',
});

await client.unbind();
```

## Repository layout

For a fuller annotated tree and contributor guide, see [docs/REPOSITORY_LAYOUT.md](docs/REPOSITORY_LAYOUT.md).

```text
.
├─ .github/workflows/        CI and release automation
├─ docs/                     architecture, build, compatibility, testing, release notes
├─ examples/                 runnable smoke / usage examples
├─ native/                   Node-API addon backed by OpenLDAP libldap
├─ prebuilds/                staged native binaries for publish / install
├─ scripts/                  build, packaging, and upstream-test runners
├─ src/                      runtime implementation and type-declaration source
├─ tests/                    unit, parity, and integration tests
├─ types/                    generated declaration output published with the package
├─ upstream/                 vendored upstream ldapts tests executed directly
├─ upstream-src/             vendored upstream source reused for helper parity
├─ binding.gyp               native addon build definition
├─ index.cjs|mjs|d.ts        public package entrypoints
└─ package.json              exports, scripts, and publish metadata

Generated during build or release:
- types/
- build/
- prebuilds/
```

## Build and packaging flow

```text
src/types/**/*.ts -----------(tsc)--------------------------> types/**/*.d.ts
native/addon.cc + binding.gyp --(node-gyp)------------------> build/Release/ldap_native.node
build/Release/ldap_native.node --(create-prebuild)---------> prebuilds/<platform-triple>/
root entrypoints + src/ + types/ ---------------------------> npm package contents
release workflow artifacts ---------------------------------> assembled prebuilds/ for npm publish
```

When changing behavior, prefer editing the source-of-truth layers (`src/`, `native/`, scripts, tests, docs) instead of editing generated outputs by hand.

## Test matrix

Run package tests:

```bash
npm test
```

Run the current full local regression path:

```bash
npm run test:full
```

Run direct upstream coverage only:

```bash
npm run test:upstream
```

Run Docker-backed integration coverage for the full `tests/integration/` directory:

```bash
npm run test:docker
```

Run optional real OpenLDAP integration tests against your own environment:

```bash
LDAP_URL='ldap://127.0.0.1:389' \
LDAP_BIND_DN='cn=admin,dc=example,dc=com' \
LDAP_BIND_PASSWORD='admin' \
LDAP_BASE_DN='dc=example,dc=com' \
npm run test:integration
```

For API-compatibility CI, the repository also supports `LDAP_NATIVE_USE_MOCK=1`, which switches the runtime to the in-repo mock backend instead of a compiled addon.

## Documentation map

- [Repository layout](docs/REPOSITORY_LAYOUT.md)
- [Migration guide](docs/MIGRATION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Build notes](docs/BUILD.md)
- [Compatibility matrix](docs/COMPATIBILITY.md)
- [GSSAPI / Kerberos / TLS npm usage](docs/GSSAPI_NPM_USAGE.md)
- [Kerberos notes](docs/KERBEROS.md)
- [Testing](docs/TESTING.md)
- [Prebuild strategy](docs/PREBUILDS.md)

A useful reading order for new contributors is:

1. this README
2. `docs/REPOSITORY_LAYOUT.md`
3. `docs/ARCHITECTURE.md`
4. `docs/BUILD.md` and `docs/TESTING.md`

## Automated CI and npm release

The repository includes two GitHub Actions workflows:

- `ci.yml` — API compatibility tests on Linux/macOS/Windows, plus native builds and smoke tests on supported platforms
- `release.yml` — multi-platform prebuild collection and npm publish on `v*` tags

For release automation details, inspect [.github/workflows/release.yml](.github/workflows/release.yml).
