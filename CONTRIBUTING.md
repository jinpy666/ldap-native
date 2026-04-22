# Contributing

## Development flow

1. Install dependencies with `npm install`
2. Build compatibility artifacts with `npm run build:compat`
3. Build the package with `npm run build`
4. Run tests with:
   - `npm run test:unit`
   - `npm run test:imports`
   - `npm run test:upstream`
   - `npm run test:integration` when a real LDAP environment is available

## Before opening a PR

- Keep the public API migration-friendly for `ldapts` consumers.
- Document any behavior that intentionally diverges from upstream private internals.
- If native code changes, mention platform implications and build prerequisites.
- If release automation changes, update `docs/NPM_PUBLISH.md` and `docs/PREBUILDS.md`.

## Commit guidance

Prefer focused commits such as:

- `feat: ...`
- `fix: ...`
- `docs: ...`
- `chore: ...`
- `test: ...`

## Areas that need the most care

- `native/addon.cc`
- `src/client.cjs`
- GitHub Actions workflows
- compatibility exports and upstream-facing helper behavior
