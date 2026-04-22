# Migrating from `ldapjs` or `ldapts` to `ldap-native`

This guide is for teams standardizing Node.js LDAP integrations on `ldap-native`.

`ldap-native` is designed to keep the public `ldapts` `Client` shape familiar while moving the transport layer to a native addon backed by OpenLDAP `libldap`. That makes migration from `ldapts` relatively small in the common case, while migration from `ldapjs` usually requires an API-model change from callbacks and event streams to `async`/`await`.

## Migration Summary

| Source package | Typical migration cost | Main change |
| --- | --- | --- |
| `ldapts` | Low | Replace package imports and verify a few compatibility boundaries |
| `ldapjs` | Medium | Replace package imports and move from callback/event APIs to Promise-based APIs |

## Who Should Migrate

`ldap-native` is a good fit if you want to:

- keep a familiar Node.js LDAP client surface
- standardize on one LDAP package across services
- connect to OpenLDAP or Active Directory from server-side Node.js code
- add SASL, Kerberos, or GSSAPI support
- reduce dependency on a JavaScript socket/BER transport layer

Hold off on a bulk migration if your code heavily depends on:

- `ldapjs` search event streams or `paged.pagePause`
- `ldapjs` reconnect-specific client options
- private `ldapts` transport internals such as `_send()` or `_socket`
- strict assumptions about fully async native execution under very high concurrency

## Quick Start

### From `ldapts`

```bash
npm uninstall ldapts
npm install ldap-native
```

Then replace imports:

```js
import { Client } from 'ldapts';
```

with:

```js
import { Client } from 'ldap-native';
```

### From `ldapjs`

```bash
npm uninstall ldapjs
npm install ldap-native
```

Then replace:

```js
const ldap = require('ldapjs');
const client = ldap.createClient({ url: 'ldap://ldap.example.com:389' });
```

with:

```js
const { Client } = require('ldap-native');
const client = new Client({ url: 'ldap://ldap.example.com:389' });
```

## Install Prerequisites by OS

`ldap-native` first tries a packaged prebuild for the current platform. If no compatible prebuild is available, installation falls back to a local native build. For migration planning, assume you may need native build dependencies in CI, developer workstations, and production image build pipelines.

### Common native build packages

| Platform | Typical packages |
| --- | --- |
| Debian / Ubuntu | `apt-get update && apt-get install -y libldap-dev libsasl2-dev python3 make g++` |
| Fedora / RHEL / CentOS | `dnf install -y openldap-devel cyrus-sasl-devel python3 make gcc-c++` |
| Alpine | `apk add --no-cache openldap-dev cyrus-sasl-dev build-base python3` |
| macOS | `brew install openldap cyrus-sasl` |
| Windows (MSVC) | Use Node.js 20+, Python 3, and Visual Studio Build Tools or Developer PowerShell for VS 2022 |

### Linux and macOS source builds

If your environment builds from source, make sure these are present before `npm install`:

- Node.js 20+
- Python 3
- C/C++ build toolchain
- OpenLDAP client headers and libraries such as `ldap.h`, `libldap`, and `liblber`
- Cyrus SASL runtime for SASL and GSSAPI flows

### macOS notes

Homebrew `openldap` is keg-only. On machines that compile from source, you may also need:

```bash
export CPPFLAGS="-I$(brew --prefix openldap)/include"
export LDFLAGS="-L$(brew --prefix openldap)/lib"
```

### Windows notes

Windows source builds use the system `Wldap32` SDK via MSVC rather than OpenLDAP development packages. Use:

- Node.js 20+
- Python 3 on `PATH`
- Visual Studio Build Tools, or Developer PowerShell for Visual Studio 2022

### GSSAPI and Kerberos environments

If your target environment uses `saslBind()` for GSSAPI, or the shorthand
`bind('GSSAPI')`, the base LDAP and SASL libraries are not enough on their own.
You also need the platform GSSAPI plugin and Kerberos client tooling.

Typical extra packages:

- Debian / Ubuntu: `libsasl2-modules-gssapi-mit`, `krb5-user`
- Fedora / RHEL / CentOS: `cyrus-sasl-gssapi`, `krb5-workstation`
- Alpine: `cyrus-sasl-gssapiv2`, `heimdal`

Also verify:

- Kerberos configuration is present
- credentials or keytabs are available
- the SASL plugin is installed on the actual runtime image, not only the build image

## Migrating from `ldapts`

For most codebases, this is a package rename plus regression testing.

### What usually stays the same

- `new Client(options)`
- `bind(dn, password)`
- `bind('PLAIN' | 'EXTERNAL')`
- `startTLS(options)`
- `search()`
- `searchPaginated()`
- `add()`
- `modify()`
- `del()`
- `compare()`
- `modifyDN()`
- `exop()`
- `unbind()`

### Typical import changes

```js
import { Client, Change, Attribute } from 'ldapts';
```

becomes:

```js
import { Client, Change, Attribute } from 'ldap-native';
```

Common helper exports remain available from the package root. In most cases that means you do not need to restructure application code.

### Things to verify

#### 1. Private transport internals

Do not carry forward code that touches private `ldapts` internals such as:

```js
client._send(...);
client._socket;
client.messageID;
```

`ldap-native` intentionally replaces the original JavaScript transport pipeline with native OpenLDAP calls.

#### 2. Async disposal patterns

If you used:

```js
using client = new Client(...);
```

switch to explicit cleanup:

```js
const client = new Client({ url });

try {
  await client.bind(dn, password);
  // work
} finally {
  await client.unbind();
}
```

#### 3. Generic control encoding

Common helpers and high-value controls are covered, but fully generic custom `Control` encoding is still a boundary to validate before rollout. See [COMPATIBILITY.md](./COMPATIBILITY.md).

## Migrating from `ldapjs`

This migration is more than a package rename. The main change is moving from a callback/event model to Promise-based request/response APIs.

### Core translation pattern

| `ldapjs` | `ldap-native` |
| --- | --- |
| `ldap.createClient(opts)` | `new Client(opts)` |
| `client.bind(..., cb)` | `await client.bind(...)` |
| `client.add(..., cb)` | `await client.add(...)` |
| `client.modify(..., cb)` | `await client.modify(...)` |
| `client.del(..., cb)` | `await client.del(...)` |
| `client.compare(..., cb)` | `await client.compare(...)` |
| `client.modifyDN(..., cb)` | `await client.modifyDN(...)` |
| `client.exop(..., cb)` | `await client.exop(...)` |
| `client.starttls(..., cb)` | `await client.startTLS(...)` |
| `client.search(..., cb)` | `await client.search(...)` |

### Search is the biggest API shift

#### `ldapjs`

```js
client.search(baseDN, opts, (err, res) => {
  if (err) throw err;

  const entries = [];

  res.on('searchEntry', (entry) => {
    entries.push(entry.pojo || entry.object);
  });

  res.on('searchReference', (ref) => {
    console.log(ref.uris);
  });

  res.on('end', () => {
    console.log(entries);
  });
});
```

#### `ldap-native`

```js
const { searchEntries, searchReferences } = await client.search(baseDN, opts);

console.log(searchEntries);
console.log(searchReferences);
```

If you need explicit page-by-page consumption, use `searchPaginated()`:

```js
for await (const page of client.searchPaginated(baseDN, {
  ...opts,
  paged: { pageSize: 200 },
})) {
  console.log(page.searchEntries);
}
```

### Option differences to audit

| `ldapjs` option or pattern | `ldap-native` handling |
| --- | --- |
| `url: string[]` | Use a single `url`; implement multi-endpoint retry in your own wrapper |
| `socketPath` | Not supported |
| `reconnect` | Not supported as a client option |
| `idleTimeout` | Not supported |
| `log` | Not supported; use external logging |
| `starttls()` | Rename to `startTLS()` |
| `attrsOnly: true` | Use `returnAttributeValues: false` |
| `attrsOnly: false` | Use `returnAttributeValues: true` |
| `attributes: 'cn'` | Use `attributes: ['cn']` |
| `paged.pagePause` | Replace with explicit `searchPaginated()` consumption |

### Scope default difference

Be explicit with `scope` during migration.

- `ldapjs` commonly defaults to `base`
- `ldap-native` follows the `ldapts` model and defaults to `sub`

If old code relied on an implicit default, add `scope` explicitly before rollout.

### Example migration

#### Before

```js
const ldap = require('ldapjs');

const client = ldap.createClient({
  url: 'ldap://ldap.example.com:389',
  timeout: 5000,
});

client.bind('cn=admin,dc=example,dc=com', 'secret', (bindErr) => {
  if (bindErr) throw bindErr;

  client.search('ou=users,dc=example,dc=com', {
    filter: '(mail=alice@example.com)',
    attrsOnly: false,
    attributes: 'cn',
    scope: 'sub',
  }, (searchErr, res) => {
    if (searchErr) throw searchErr;

    res.on('searchEntry', (entry) => {
      console.log(entry.pojo);
    });

    res.on('end', () => {
      client.unbind();
    });
  });
});
```

#### After

```js
const { Client } = require('ldap-native');

async function main() {
  const client = new Client({
    url: 'ldap://ldap.example.com:389',
    timeout: 5000,
  });

  try {
    await client.bind('cn=admin,dc=example,dc=com', 'secret');

    const { searchEntries } = await client.search('ou=users,dc=example,dc=com', {
      filter: '(mail=alice@example.com)',
      returnAttributeValues: true,
      attributes: ['cn'],
      scope: 'sub',
    });

    console.log(searchEntries);
  } finally {
    await client.unbind();
  }
}
```

## SASL, Kerberos, and GSSAPI

If your target environment uses SASL or Kerberos, `ldap-native` adds native entry points that are outside the usual `ldapjs` migration path:

```js
const client = new Client({
  url: 'ldap://ldap.example.com:389',
  sasl: { mechanism: 'GSSAPI' },
});

await client.startTLS({ caFile: '/etc/ssl/certs/ldap-ca.pem' });
await client.saslBind();
```

See [KERBEROS.md](./KERBEROS.md) for environment requirements and platform notes.

## Validation Checklist

Before production rollout, verify:

- all `ldapjs` or `ldapts` imports are gone
- no code still depends on callback-style LDAP operations
- `scope`, TLS, and timeout values are explicit
- search result handling matches the new aggregated result shape
- pagination behavior is validated under real data volume
- bind, search, modify, and delete flows pass integration tests
- Kerberos or GSSAPI flows are validated separately if used

## Rollout Guidance

For infrastructure-heavy environments, migrate in stages:

1. start with low-risk internal services
2. migrate shared LDAP wrappers or IAM adapters next
3. move core authentication paths only after regression and rollback plans are ready

Treat this as an infrastructure dependency migration, not just a package rename. The package API may be familiar, but rollout risk still comes from authentication, TLS, directory defaults, and operational assumptions.

## Related Docs

- [README](../README.md)
- [COMPATIBILITY.md](./COMPATIBILITY.md)
- [KERBEROS.md](./KERBEROS.md)
- [ARCHITECTURE.md](./ARCHITECTURE.md)
