# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`ldap-native` is an `ldapts`-compatible Node.js LDAP client backed by OpenLDAP `libldap` via a N-API native addon. It preserves the `ldapts` `Client` API shape while replacing the TypeScript socket/BER transport with native C calls, and adds SASL/Kerberos (GSSAPI) bind support.

## Build & Test Commands

```bash
# Full build (compat types → native addon → prebuild staging)
npm run build

# Partial builds
npm run build:compat      # TypeScript declaration generation (src/types/ → types/)
npm run build:native      # Compile native addon via node-gyp

# Tests
npm test                  # All tests except live integration
npm run test:unit         # Unit + parity tests (node --test)
npm run test:upstream     # Direct upstream ldapts test execution
npm run test:imports      # CJS/ESM import shape verification
npm run test:integration  # Real OpenLDAP server tests (requires env vars)

# CI-safe full run
npm run ci

# Single test file
LDAP_NATIVE_USE_MOCK=1 node --test tests/unit/loader.test.cjs
```

Integration tests require: `LDAP_URL`, `LDAP_BIND_DN`, `LDAP_BIND_PASSWORD`, `LDAP_BASE_DN`.

## Architecture

Three layers, top to bottom:

1. **Entry layer** (`index.cjs`, `index.mjs`) — re-exports everything from `src/`. Uses `exports.xxx = yyy` form for ESM named export compatibility.

2. **Runtime layer** (`src/runtime.cjs`, `src/Client.cjs`, `src/native-loader.cjs`, `src/mock-native.cjs`) — all runtime code in `src/`. `runtime.cjs` is the single source of truth for all class definitions (BER, DN, filters, controls, errors, etc.). `Client.cjs` wraps native calls with error conversion.

3. **Native addon** (`native/addon.cc`) — Node-API C++ addon calling OpenLDAP `libldap`/`liblber`/`libsasl2`. Links against `-lldap -llber -lsasl2`.

Type declarations: `src/types/*.ts` (compile input) → `types/*.d.ts` (published output).

## Key Conventions

- Runtime code is CommonJS (`.cjs` files) with ESM wrappers (`.mjs`) for dual export
- `types/` is generated output — run `npm run build:compat` to regenerate
- `upstream/` contains vendored upstream `ldapts` test files run directly via `--experimental-strip-types`
- Tests use `node --test` (built-in test runner), not Vitest, for package-level tests
- The mock native (`LDAP_NATIVE_USE_MOCK=1`) is used by unit tests and upstream test execution to avoid requiring a compiled addon or LDAP server
