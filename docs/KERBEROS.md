# Kerberos / GSSAPI notes

## Current behavior

The package exposes Kerberos through the same migration-friendly `bind()` entry point used by `ldapts` SASL binds:

```js
await client.bind('GSSAPI');
```

Internally, the native addon maps that to OpenLDAP's SASL/GSSAPI bind path.

## Expected environment

The package assumes your Kerberos environment is already prepared by one of the normal system mechanisms:

- `kinit` + default credential cache
- `KRB5CCNAME`
- system Kerberos configuration under `krb5.conf`

## Practical guidance

Before testing `bind('GSSAPI')`, confirm:

- `kinit` succeeds for the test principal
- the LDAP server supports SASL/GSSAPI
- the service principal is resolvable as `ldap/<host>@REALM`
- DNS and `/etc/hosts` resolution match the expected service host

## Scope of the current implementation

What is implemented in this starter package:

- SASL mechanism dispatch for `GSSAPI`
- native entry point for GSSAPI bind
- optional real integration test path

What is not yet fully productized:

- advanced authz-id controls
- detailed per-platform Kerberos diagnostics
- Windows SSPI-specific behavior independent of OpenLDAP/Cyrus SASL
