# Repository layout

This repository intentionally mixes **package compatibility code**, **native addon code**, and **release automation** in one place. That is practical for a native npm package, but it also means new contributors can get lost quickly.

This document explains where each responsibility lives, which directories are source of truth, and which files to change for common tasks.

## Top-level map

```text
.
├─ .github/workflows/
│  ├─ ci.yml
│  └─ release.yml
├─ docs/
│  ├─ ARCHITECTURE.md
│  ├─ BUILD.md
│  ├─ COMPATIBILITY.md
│  ├─ KERBEROS.md
│  ├─ NPM_PUBLISH.md
│  ├─ PREBUILDS.md
│  ├─ TESTING.md
│  └─ REPOSITORY_LAYOUT.md
├─ examples/
│  └─ smoke-native.cjs
├─ lib/
│  ├─ Client.cjs
│  ├─ native-loader.cjs
│  ├─ mock-native.cjs
│  └─ *.cjs helper/export modules
├─ native/
│  └─ addon.cc
├─ scripts/
│  ├─ build-native.cjs
│  ├─ build-dist.cjs
│  ├─ create-prebuild.cjs
│  └─ run-upstream-direct.cjs
├─ tests/
│  ├─ integration/
│  └─ unit/
├─ upstream/
│  ├─ Controls.test.ts
│  ├─ FilterParser.test.ts
│  ├─ PostalAddress.test.ts
│  ├─ ber/
│  ├─ dn/
│  └─ filters/
├─ upstream-src/
├─ binding.gyp
├─ index.cjs
├─ index.d.ts
├─ index.mjs
├─ package.json
└─ tsconfig.compat.json
```

Builds and release jobs also produce these generated directories:

- `compat-cjs/`
- `build/`
- `dist/`
- `prebuilds/`

## What each area is for

### Public package entrypoints

**Files:**

- `index.cjs`
- `index.mjs`
- `index.d.ts`
- `package.json`

These files define the public package surface and the export map seen by consumers.

Use this area when you need to:

- expose a new helper or public symbol
- change the package entrypoint layout
- adjust CommonJS / ESM / type exports
- update npm metadata, scripts, or published file lists

`package.json` is also the quickest way to understand the supported commands and the packaging boundary.

### JavaScript compatibility and runtime layer

**Directory:** `lib/`

This is the main JavaScript implementation layer that keeps the package compatible with `ldapts`-style usage while delegating the actual LDAP operations to the native addon.

Key files:

- `lib/Client.cjs`  
  The public `Client` implementation. It normalizes options, dispatches simple bind vs SASL bind, shapes search results as `{ searchEntries, searchReferences }`, and translates a subset of control objects into native-friendly payloads.

- `lib/native-loader.cjs`  
  Resolves the runtime backend. It looks for:
  1. `LDAP_NATIVE_NATIVE_PATH`
  2. local `build/Release` or `build/Debug`
  3. staged `prebuilds/<platform-triple>/`
  4. optional platform packages
  5. or the mock backend when `LDAP_NATIVE_USE_MOCK=1`

- `lib/mock-native.cjs`  
  A deterministic fake backend used by unit and parity tests so API-shape validation can run without a compiled native addon.

The rest of `lib/` contains helper exports such as controls, filters, BER helpers, DN helpers, and compatibility-oriented modules.

Change `lib/` when you need to:

- add or change a public client method
- adjust how controls are encoded before crossing the JS/native boundary
- change addon resolution rules
- improve testability of the high-level runtime behavior

### Native addon layer

**Directory:** `native/`  
**Build definition:** `binding.gyp`

`native/addon.cc` is the Node-API addon. It is the bridge from JavaScript calls into OpenLDAP C APIs.

The current addon covers:

- `ldap_initialize`
- `ldap_start_tls_s`
- `ldap_sasl_bind_s`
- `ldap_search_ext_s`
- `ldap_add_ext_s`
- `ldap_modify_ext_s`
- `ldap_delete_ext_s`
- `ldap_compare_ext`
- `ldap_rename_s`
- `ldap_extended_operation_s`
- `ldap_unbind_ext_s`

Change the native layer when you need to:

- add a new LDAP operation
- change how an operation maps to OpenLDAP
- fix native memory handling or result shaping
- improve performance or move blocking work to async workers

If you add new native behavior, you will usually also need to update `lib/Client.cjs`, tests, and docs.

### Build and packaging automation

**Directory:** `scripts/`

This directory contains the local build helpers used by npm scripts.

Important files:

- `scripts/build-native.cjs`  
  Runs `node-gyp rebuild` and points `node-gyp` at the current Node installation via `--nodedir`. This is important for offline and air-gapped build environments.

- `scripts/build-dist.cjs`  
  Rebuilds `dist/` by copying the root entrypoints, `lib/`, and `compat-cjs/` into the publishable package layout.

- `scripts/create-prebuild.cjs`  
  Takes the current platform's `build/Release/ldap_native.node` and stages it into `prebuilds/<platform-triple>/`.

- `scripts/run-upstream-direct.cjs`  
  Executes the vendored upstream `ldapts` tests that are intended to run directly under Node's built-in test runner.

Change `scripts/` when you need to:

- alter the local build flow
- change the published output layout
- change how prebuilds are staged
- expand or shrink the direct-upstream test set

### Compatibility fixtures and vendored upstream assets

**Directories:**

- `upstream/`
- `upstream-src/`

`upstream/` holds the vendored upstream test files that this package executes directly for compatibility evidence. This is where the repository proves that selected helper modules still behave close to upstream `ldapts`.

`upstream-src/` holds vendored upstream source reused by compatibility-oriented helpers and type generation.

Change these directories carefully. They are not ordinary app code; they are compatibility assets. If you update them, also re-check:

- `docs/COMPATIBILITY.md`
- `docs/TESTING.md`
- any build steps that generate `compat-cjs/`

### Test coverage

**Directory:** `tests/`

This directory covers package-specific validation.

Typical responsibilities:

- `tests/unit/`  
  package tests, mock-backed behavior tests, and migration-relevant client parity tests such as `tests/unit/upstream-client-parity.test.cjs`

- `tests/integration/`  
  optional real OpenLDAP server tests that validate the compiled addon end-to-end

Use `tests/` when you need to:

- add migration-surface coverage for `Client`
- validate new native operations
- add a regression test for runtime behavior
- verify a real server interaction that the mock backend cannot prove

### Examples

**Directory:** `examples/`

This directory is for runnable smoke and usage examples. `examples/smoke-native.cjs` is the minimal sanity check that a built addon can be loaded and that the package surface is present.

Add examples here when you want:

- a quick manual verification path
- a minimal reproduction for a bug
- a short usage sample that should stay runnable over time

### Documentation

**Directory:** `docs/`

The repository already splits documentation by topic:

- `ARCHITECTURE.md` — conceptual layering
- `BUILD.md` — local build prerequisites and flow
- `COMPATIBILITY.md` — boundary with upstream `ldapts`
- `KERBEROS.md` — GSSAPI expectations and limits
- `TESTING.md` — test commands and environment
- `PREBUILDS.md` — binary distribution strategy
- `NPM_PUBLISH.md` — publish workflow and trusted publishing setup

Use `docs/` as the source of truth for contributor-facing explanation. If you change behavior in code, update the matching document in the same change.

### GitHub automation

**Directory:** `.github/workflows/`

Two workflows matter today:

- `ci.yml`  
  Runs API compatibility tests across Linux/macOS/Windows and also performs native build jobs on supported platforms.

- `release.yml`  
  Builds platform-specific prebuilds on tag pushes, downloads and assembles them into `prebuilds/`, then publishes the npm package.

Change workflow files when you need to:

- add platform coverage
- change release assembly logic
- adjust Node versions
- alter publish conditions or npm release behavior

## Source of truth vs generated output

Treat these directories as **generated output**, not the primary place to edit behavior:

- `compat-cjs/`
- `build/`
- `dist/`
- `prebuilds/`

In general:

- edit `lib/`, `native/`, root entrypoints, scripts, tests, and docs by hand
- regenerate outputs with the npm scripts
- avoid hand-editing `dist/` or staged binaries

## Common contributor tasks

### “I want to add or change a public `Client` method.”

Start with:

- `lib/Client.cjs`
- `native/addon.cc`
- `tests/unit/`
- `tests/integration/` if the behavior needs real-server validation
- `docs/COMPATIBILITY.md` if the change affects parity claims

### “I want to change how the addon is found at runtime.”

Start with:

- `lib/native-loader.cjs`
- `scripts/create-prebuild.cjs`
- `docs/PREBUILDS.md`
- `release.yml` if platform packaging changes too

### “I want to change the package export surface.”

Start with:

- `index.cjs`
- `index.mjs`
- `index.d.ts`
- `package.json`
- `scripts/build-dist.cjs`

### “I want to improve CI or release automation.”

Start with:

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `docs/BUILD.md`
- `docs/NPM_PUBLISH.md`
- `docs/PREBUILDS.md`

### “I want to expand compatibility evidence against upstream `ldapts`.”

Start with:

- `upstream/`
- `upstream-src/`
- `scripts/run-upstream-direct.cjs`
- `tests/unit/upstream-client-parity.test.cjs`
- `docs/COMPATIBILITY.md`
- `docs/TESTING.md`

## Suggested reading order

If you are new to the repository, this order works well:

1. `README.md`
2. `docs/REPOSITORY_LAYOUT.md`
3. `docs/ARCHITECTURE.md`
4. `docs/BUILD.md`
5. `docs/TESTING.md`
6. `docs/COMPATIBILITY.md`

If your focus is specifically Kerberos or release engineering, then jump next to:

- `docs/KERBEROS.md`
- `docs/PREBUILDS.md`
- `docs/NPM_PUBLISH.md`

## Practical rule of thumb

When in doubt, ask:

- “Am I changing the public JavaScript API?” → `lib/` + entrypoints
- “Am I changing LDAP execution?” → `native/`
- “Am I changing packaging or delivery?” → `scripts/` + workflows
- “Am I proving compatibility?” → `upstream/` + tests + compatibility docs

That rule keeps most changes in the right layer and prevents generated output from becoming the accidental source of truth.