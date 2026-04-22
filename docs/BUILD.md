# Build notes

## Local build flow

```bash
npm run build
```

This now performs three steps:

1. Generates declaration files from `src/types/` into `types/`.
2. Builds the native addon with `node-gyp`.
3. Stages the current platform addon into `prebuilds/<platform-triple>/`.

The build helper uses the current Node installation as `node-gyp`'s `--nodedir`, which avoids downloading headers in offline environments.

For npm consumers, the package `install` hook tries a packaged prebuild first and only falls back to a source build when no compatible native binary is available. It does not attempt to install OS packages automatically; instead it prints platform-specific guidance when native dependencies are missing.

## Linux / macOS source build

Expected prerequisites:

- Node.js 20+
- Python 3
- C/C++ compiler toolchain
- OpenLDAP development headers and libraries
- Cyrus SASL runtime

Typical dependencies:

- Debian/Ubuntu: `libldap-dev`, `libsasl2-dev`
- Fedora/RHEL/CentOS: `openldap-devel`, `cyrus-sasl-devel`
- Alpine: `openldap-dev`, `cyrus-sasl-dev`
- Homebrew: `openldap`, `cyrus-sasl`

## Windows source build

The repository now builds native Windows addons with the standard `node-gyp` + MSVC toolchain on `windows-latest`.

The GitHub Actions matrix uses:

- Node.js 20 and 22 via `actions/setup-node`
- the hosted Visual Studio Build Tools / Windows SDK image
- Python 3 from the GitHub-hosted runner

On Windows the addon links against the system `Wldap32` SDK instead of an external OpenLDAP/MSYS2 package set, which avoids the `node-gyp`/MinGW import-library mismatch that broke the previous workflow.

## Prebuild publication strategy

Recommended release flow:

1. CI builds per-platform addons.
2. Each CI run stages `prebuilds/<platform-triple>/ldap_native.node`.
3. Either publish those prebuilds directly with the main package or wrap them in optional platform packages.
4. The main package resolves the right addon via `src/native-loader.cjs`.

The included GitHub Actions workflow now separates:

- API compatibility tests on Linux/macOS/Windows using the mock backend.
- Native build jobs on Linux/macOS.
- A native Windows job using MSVC on `windows-latest`.


Repository: `jinpy666/ldap-native`
Published package target: `ldap-native`
