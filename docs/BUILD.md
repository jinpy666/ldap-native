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

## Linux / macOS source build

Expected prerequisites:

- Node.js 20+
- Python 3
- C/C++ compiler toolchain
- OpenLDAP development headers and libraries
- Cyrus SASL runtime

Typical dependencies:

- Debian/Ubuntu: `libldap2-dev`, `libsasl2-dev`
- Homebrew: `openldap`, `cyrus-sasl`

## Windows source build

The repository includes an MSYS2/UCRT64 workflow for native Windows builds. The GitHub Actions matrix installs:

- `mingw-w64-ucrt-x86_64-nodejs`
- `mingw-w64-ucrt-x86_64-openldap`
- `mingw-w64-ucrt-x86_64-cyrus-sasl`
- `mingw-w64-ucrt-x86_64-gcc`
- `mingw-w64-ucrt-x86_64-python`
- `make`

That gives a workable source-build path for Windows without having to switch the addon over to a completely different LDAP SDK.

## Prebuild publication strategy

Recommended release flow:

1. CI builds per-platform addons.
2. Each CI run stages `prebuilds/<platform-triple>/ldap_native.node`.
3. Either publish those prebuilds directly with the main package or wrap them in optional platform packages.
4. The main package resolves the right addon via `src/native-loader.cjs`.

The included GitHub Actions workflow now separates:

- API compatibility tests on Linux/macOS/Windows using the mock backend.
- Native build jobs on Linux/macOS.
- A native Windows job using MSYS2/UCRT64.


Repository: `jinpy666/ldap-native`
Published package target: `ldap-native`
