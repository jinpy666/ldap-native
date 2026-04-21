# Architecture

## Goal

Expose an API that is as close as practical to `ldapts`, but route operations through OpenLDAP `libldap` instead of the original socket/BER transport.

## Layers

### 1. Compatibility/export layer

Files in the repository root and `lib/` preserve the public package shape expected by `ldapts` consumers:

- `index.cjs`, `index.mjs`, `index.d.ts`
- `lib/controls.*`
- `lib/filters.*`
- `lib/ber.*`
- `lib/dn.*`
- `lib/FilterParser.*`
- `lib/PostalAddress.*`

Most helper modules are adapted from upstream `ldapts` source so that their behavior and tests remain directly comparable.

### 2. Client implementation layer

`lib/Client.cjs` provides the `Client` class and keeps the important public method signatures aligned with upstream:

- `bind(dnOrSaslMechanism, [password], [controls])`
- `search(baseDN, options, [controls])`
- `searchPaginated(baseDN, options, [controls])`
- `startTLS(options)`
- `add`, `modify`, `del`, `modifyDN`, `compare`, `exop`, `unbind`

This layer also:

- maps `PLAIN`, `EXTERNAL`, and `GSSAPI` onto native SASL bind calls,
- converts some upstream control objects into native-friendly payloads,
- normalizes search result shape to `{ searchEntries, searchReferences }`.

### 3. Native loader layer

`lib/native-loader.cjs` resolves the native addon from:

1. an explicit `LDAP_NATIVE_NATIVE_PATH`,
2. local `build/Release` or `build/Debug`,
3. staged `prebuilds/<platform-triple>/`,
4. optional platform package installs.

For fast compatibility tests, `LDAP_NATIVE_USE_MOCK=1` switches the runtime to `lib/mock-native.cjs`.

### 4. Native addon layer

`native/addon.cc` is a Node-API addon backed by OpenLDAP C APIs.

Currently implemented operations:

- connect / initialize
- `startTLS`
- simple bind
- SASL bind (`PLAIN`, `EXTERNAL`, `GSSAPI`)
- `search`
- `compare`
- `add`
- `modify`
- `del`
- `modifyDN`
- `exop`
- `unbind`

## Test strategy

The repository uses three complementary strategies:

1. **direct upstream test execution** for helper modules whose behavior should stay bit-for-bit close to `ldapts`
2. **client parity tests** for the public migration surface of `Client`
3. **optional real OpenLDAP integration** for end-to-end validation

This split is deliberate: upstream `Client.test.ts` also checks private transport behavior that does not apply once the transport is replaced with `libldap`.
