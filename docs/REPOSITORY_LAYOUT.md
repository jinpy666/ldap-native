# Repository layout

This repository combines three concerns in one place:

1. a `ldapts`-compatible JavaScript package surface
2. a native addon backed by OpenLDAP `libldap`
3. packaging and verification for multi-platform Node.js releases

The easiest way to stay oriented is to separate **source of truth** from **generated output**.

## Top-level map

```text
.
├─ .github/workflows/        CI and release automation
├─ docs/                     contributor-facing documentation
├─ examples/                 runnable smoke / usage examples
├─ native/                   Node-API addon source
├─ prebuilds/                staged native binaries for publish / install
├─ scripts/                  build and test helpers
├─ src/                      runtime implementation + type source
├─ tests/                    unit, parity, and integration tests
├─ types/                    generated declaration output
├─ upstream/                 vendored upstream ldapts tests
├─ upstream-src/             vendored upstream helper source
├─ binding.gyp               native build definition
├─ index.cjs|mjs|d.ts        public package entrypoints
├─ controls|filters|errors|dn|ber.*  public subpath entrypoints
└─ package.json              exports, scripts, publish metadata
```

Generated or refreshed during normal development:

- `build/`
- `types/`
- `prebuilds/`

## Source of truth

### Runtime layer

**Directory:** `src/`

This is the main hand-written runtime implementation.

Key files:

- `src/client.cjs`
  Public `Client` implementation. This is where option normalization, TLS preprocessing, paged search aggregation, error conversion, and JS/native bridging logic live.

- `src/runtime.cjs`
  Runtime definitions for controls, filters, BER helpers, DN helpers, and error classes.

- `src/native-loader.cjs`
  Resolves the addon from local builds, staged `prebuilds/`, or optional platform packages.

- `src/mock-native.cjs`
  Deterministic mock backend used by unit and parity tests.

Change `src/` when you need to:

- add or fix public runtime behavior
- align `Client` semantics with `ldapts`
- change native loader behavior
- improve mock-backed tests

### Native addon layer

**Directory:** `native/`
**Build definition:** `binding.gyp`

`native/addon.cc` is the Node-API bridge to OpenLDAP C APIs.

Change this area when you need to:

- map a JavaScript API call onto libldap
- fix TLS, BER, or binary attribute handling
- change native result shaping or memory ownership
- adjust platform linking rules

### Type source layer

**Directory:** `src/types/`

This directory is the source for published declaration files. Running `npm run build:compat` regenerates `types/`.

The filenames here intentionally keep upstream-style PascalCase module names because they mirror `ldapts` helper/class modules. That is different from the lowercase convention used by the hand-written runtime files in `src/`.

### Public entrypoint layer

**Files:** repository root

These files preserve the public package surface:

- `index.cjs`, `index.mjs`, `index.d.ts`
- `controls.cjs`, `controls.mjs`
- `filters.cjs`, `filters.mjs`
- `errors.cjs`, `errors.mjs`
- `dn.cjs`, `dn.mjs`
- `ber.cjs`, `ber.mjs`

Change these files when you need to:

- expose a new symbol
- adjust CommonJS / ESM package shape
- add or change npm subpath exports

### Compatibility assets

**Directories:**

- `upstream/`
- `upstream-src/`

`upstream/` contains vendored upstream tests executed for helper parity.

`upstream-src/` contains vendored upstream helper implementations and type-adjacent assets still reused by this repository. Treat both as compatibility fixtures, not day-to-day app code.

## Generated output

Treat these paths as generated output or build artifacts:

- `build/`
- `types/`
- `prebuilds/`

Do not hand-edit them as the primary fix path. Prefer:

- `src/` for runtime behavior
- `native/` for addon behavior
- `src/types/` for declaration changes

## Build and test helpers

**Directory:** `scripts/`

Important files:

- `scripts/build-native.cjs`
  Rebuilds the addon with `node-gyp` and the current Node headers.

- `scripts/create-prebuild.cjs`
  Copies the current platform addon into `prebuilds/<platform-triple>/`.

- `scripts/run-unit-tests.cjs`
- `scripts/run-import-tests.cjs`
- `scripts/run-upstream-direct.cjs`
- `scripts/run-integration-tests.cjs`

Change `scripts/` when you need to adjust the local build or verification flow.

## Tests

**Directory:** `tests/`

- `tests/unit/`
  Package-level unit tests, mock-backed parity checks, and import surface validation.

- `tests/integration/`
  Real OpenLDAP integration coverage, including Docker-backed validation.

Use `tests/` for repo-specific regressions and end-to-end behavior that the upstream vendored suites do not prove.

## Contributor rules of thumb

- If the bug is in API behavior, start with `src/client.cjs` and `tests/`.
- If the bug is in TLS, BER, binary values, or LDAP operation mapping, inspect `native/addon.cc`.
- If the issue is package surface or subpath exports, inspect the root entrypoints and `package.json`.
- If the change is type-only, edit `src/types/` and regenerate `types/`.
- If you see PascalCase under `src/types/` or `upstream-src/`, that is expected. The lowercase runtime convention only applies to the hand-written runtime implementation layer.
