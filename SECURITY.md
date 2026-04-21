# Security Policy

If you discover a security issue in ldap-native, please do not open a public issue with exploit details.

Instead:

- send a private report to the maintainer contact you use for this project, or
- open a minimal public issue that only states a security-sensitive problem exists and requests a private follow-up channel.

## Reporting guidance

Include:

- affected version
- platform and runtime details
- whether the issue is in API behavior, native code, build tooling, or release automation
- reproduction steps
- impact assessment

## Scope

Given the nature of this project, sensitive areas include:

- native addon memory handling
- LDAP TLS and SASL configuration
- Kerberos/GSSAPI behavior
- npm publish and GitHub Actions release workflows
