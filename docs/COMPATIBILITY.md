# Compatibility matrix

## Goal

The goal is **migration-friendly compatibility with `ldapts` public APIs**, not a byte-for-byte recreation of its original internal socket transport.

## Direct upstream execution

The following upstream `ldapts` test files are executed directly by `npm run test:upstream`:

- `Controls.test.ts`
- `FilterParser.test.ts`
- `PostalAddress.test.ts`
- `ber/BerReader.test.ts`
- `ber/BerWriter.test.ts`
- `dn/DN.test.ts`
- `dn/RDN.test.ts`
- `filters/EqualityFilter.test.ts`
- `filters/ExtensibleFilter.test.ts`
- `filters/NotFilter.test.ts`
- `filters/OrFilter.test.ts`

This gives direct evidence that the helper modules exported by this package remain behaviorally close to upstream `ldapts`.

## Public `Client` compatibility

The repository includes dedicated parity tests for migration-relevant `Client` behaviors:

- constructor options
- simple bind
- SASL bind dispatch
- `startTLS`
- `search`
- `searchPaginated`
- `compare`
- `add`
- `modify`
- `del`
- `modifyDN`
- `exop`
- `unbind`

These tests intentionally avoid asserting private transport details such as `_send()`, socket bookkeeping, or BER message framing internals, because those are replaced by OpenLDAP `libldap` in this package.

## Known non-parity areas

### 1. Private transport internals

Tests from upstream `Client.test.ts` that assert the internal request pipeline are **not directly portable** to a native `libldap` backend.

### 2. Generic control encoding

The repository currently maps the high-value cases first:

- `PagedResultsControl`
- a mock-path representation for `ServerSideSortingRequestControl`

A full generic `Control` to `LDAPControl` encoder is still a future enhancement.

### 3. Full async native execution

The current native addon implementation uses synchronous libldap calls exposed through Promise wrappers. That is enough for a starter package and local verification, but production hardening should move blocking LDAP operations into `napi_async_work`.
