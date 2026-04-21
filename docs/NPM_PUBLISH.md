# npm 自动发包

推荐方案是 **npm Trusted Publishing + GitHub Actions OIDC**。npm 官方当前支持 GitHub Actions 作为 trusted publisher，
这样可以避免长期 `NPM_TOKEN`，并且发布时会自动生成 provenance。配置要点包括：

- 使用 **GitHub-hosted runner**
- workflow 里声明 `permissions.id-token: write`
- `package.json.repository.url` 必须与实际 GitHub 仓库地址大小写一致
- npm CLI 至少为 `11.5.1`，Node 至少为 `22.14.0`
- 首次公开发布使用 `npm publish --access public`

## 本仓库中的工作流

`release.yml` 在推送 `v*` tag 时自动执行：

1. Linux / macOS / Windows 构建与测试
2. 生成并收集多平台预编译产物
3. 在 Ubuntu GitHub-hosted runner 上汇总 `prebuilds/`
4. 执行 `npm publish --provenance --access public`

## 一次性配置：Trusted Publisher

在 npm 包页面中添加 Trusted Publisher：

- Provider: **GitHub Actions**
- Owner / Organization: `jinpy666`
- Repository: `ldap-native`
- Workflow file: `.github/workflows/release.yml`
- Environment: 留空或按你的策略设置

完成后，后续 tag 发布就不再需要 `NPM_TOKEN`。

## 备用方案：Token 发布

如果你暂时不使用 Trusted Publishing，也可以退回到 token 方案：

1. 在 npm 创建 automation token
2. 在 GitHub 仓库 `Settings -> Secrets and variables -> Actions` 中新增 `NPM_TOKEN`
3. 将 `release.yml` 的 publish 步骤改为：
   ```bash
   npm publish --access public
   ```
   并传入：
   ```yaml
   env:
     NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
   ```

## 推荐发布流程

```bash
npm version patch
git push origin main --follow-tags
```

或者：

```bash
git tag v0.1.0
git push origin v0.1.0
```

## 发布前自检

```bash
npm install
npm run release:verify
```

## 包名

当前 `package.json` 的包名为：

- `ldap-native`

正式发布前，仍建议你在 npm 网页或 `npm view ldap-native` 上再确认一次名称可用性。
