# Kerberos / GSSAPI notes

## Current behavior

The package exposes Kerberos through the same migration-friendly `bind()` entry point used by `ldapts` SASL binds:

```js
await client.bind('GSSAPI');
```

Internally, the native addon maps that to OpenLDAP's SASL/GSSAPI bind path.

There is also an explicit SASL entry point:

```js
await client.saslBind();
```

For GSSAPI with default Kerberos credentials, `client.saslBind()` is the
closest match to `ldapsearch -Y GSSAPI`.

On non-Windows platforms, the GSSAPI path should use the same interactive SASL
bind style that `ldapsearch -Y GSSAPI` relies on. That matters because the
first SASL bind request is expected to carry a GSSAPI token generated from the
current Kerberos credential cache, not just the literal mechanism name.

The `credentials` field in the LDAP SASL bind packet is not your LDAP password.
For GSSAPI it is an opaque SASL/GSSAPI token derived from your Kerberos
environment, typically after `kinit` or via a keytab-backed credential cache.

## Expected environment

The package assumes your Kerberos environment is already prepared by one of the normal system mechanisms:

- `kinit` + default credential cache
- `KRB5CCNAME`
- system Kerberos configuration under `krb5.conf`

## Practical guidance

Before testing `saslBind()` or `bind('GSSAPI')`, confirm:

- `kinit` succeeds for the test principal
- the LDAP server supports SASL/GSSAPI
- the service principal is resolvable as `ldap/<host>@REALM`
- DNS and `/etc/hosts` resolution match the expected service host

## Scope of the current implementation

What is implemented in this starter package:

- SASL mechanism dispatch for `GSSAPI`
- explicit `saslBind()` support with SASL defaults
- native entry point for GSSAPI bind
- optional real integration test path

What is not yet fully productized:

- advanced authz-id controls
- detailed per-platform Kerberos diagnostics
- Windows SSPI-specific behavior independent of OpenLDAP/Cyrus SASL
