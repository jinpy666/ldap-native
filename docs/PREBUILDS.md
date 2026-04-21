# Prebuild strategy

This package is structured to support two delivery modes:

1. **Source build** against system-provided OpenLDAP client libraries.
2. **Prebuilt binary packages** staged under `prebuilds/<platform-triple>/ldap_native.node` and optionally published as platform-specific npm packages.

The current scripts included here do the following:

- `npm run build` builds the native addon, writes `dist/`, and stages the current platform addon into `prebuilds/`.
- `lib/native-loader.cjs` resolves add-ons from local builds, staged prebuilds, or optional platform packages.

## Current triples

- Linux: `linux-<arch>-gnu` or `linux-<arch>-musl`
- macOS: `darwin-<arch>`
- Windows: `win32-<arch>`

## Publishing suggestion

Publish a main package and optional platform packages such as:

- `@your-scope/ldap-native-linux-x64-gnu`
- `@your-scope/ldap-native-linux-arm64-gnu`
- `@your-scope/ldap-native-linux-x64-musl`
- `@your-scope/ldap-native-darwin-arm64`
- `@your-scope/ldap-native-win32-x64`

The main package can list those as `optionalDependencies`, while the runtime loader tries local `prebuilds/` first and then installed platform packages.


## 仓库当前策略

本仓库优先采用**单包 + 内置 prebuilds/** 的发布方式，而不是拆成多个平台子包。`release.yml` 会在 tag 发布时分别构建：

- `linux-x64-gnu`
- `darwin-x64`
- `darwin-arm64`
- `win32-x64`

随后在发布作业中汇总到根目录 `prebuilds/` 后再执行 `npm publish`。
