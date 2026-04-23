# GSSAPI Overnight Demo

这个 demo 用于把 GSSAPI 链路跑一晚上，验证：

1. FreeIPA / Kerberos / LDAP / StartTLS 环境稳定
2. `ldapsearch -Y GSSAPI` 持续成功
3. `ldap-native` 的 `client.saslBind()` 持续成功
4. 失败时有每轮日志可回放

## 推荐运行环境

使用 Linux Docker host：

- GitHub Actions Linux runner
- Linux VM
- Linux 服务器

不建议直接用 macOS Docker Desktop 跑 FreeIPA 长测。FreeIPA 上游容器在 macOS Docker Desktop 上可能初始化失败，这不是 `ldap-native` 的 GSSAPI 逻辑问题。

## 一晚默认跑法

默认持续 8 小时，每 60 秒执行一轮：

```bash
bash scripts/run-gssapi-overnight-demo.sh
```

等价 npm 命令：

```bash
npm run test:gssapi:overnight
```

脚本会先启动一次 Docker lab：

- `freeipa`: LDAP + Kerberos KDC + CA
- `gssapi-runner`: RHEL 9 / Rocky 9 runner

然后循环执行：

- `kinit admin@EXAMPLE.TEST`
- `ldapsearch -ZZ -Y GSSAPI`
- `node examples/gssapi.cjs` 等价的 `client.startTLS()` + `client.saslBind()`

## 快速 demo

本地验证脚本逻辑时，不需要真的跑一晚上：

```bash
GSSAPI_OVERNIGHT_DURATION_SECONDS=300 \
GSSAPI_OVERNIGHT_INTERVAL_SECONDS=30 \
bash scripts/run-gssapi-overnight-demo.sh
```

如果只想跑 3 轮：

```bash
GSSAPI_OVERNIGHT_MAX_ITERATIONS=3 \
GSSAPI_OVERNIGHT_INTERVAL_SECONDS=10 \
bash scripts/run-gssapi-overnight-demo.sh
```

## 常用参数

- `GSSAPI_OVERNIGHT_DURATION_SECONDS`: 总持续时间，默认 `28800`，即 8 小时
- `GSSAPI_OVERNIGHT_INTERVAL_SECONDS`: 每轮间隔，默认 `60`
- `GSSAPI_OVERNIGHT_ITERATION_TIMEOUT_SECONDS`: 单轮超时，默认 `45`
- `GSSAPI_OVERNIGHT_MAX_ITERATIONS`: 最大轮数，默认 `0` 表示不限制
- `GSSAPI_OVERNIGHT_FAIL_FAST`: 设置为 `1` 时首个失败立即退出
- `GSSAPI_OVERNIGHT_ARTIFACT_DIR`: 输出目录，默认 `artifacts/gssapi-overnight-<timestamp>`
- `KEEP_GSSAPI_STACK`: 设置为 `1` 时结束后保留 Docker 环境

## 输出目录

默认输出到：

```text
artifacts/gssapi-overnight-YYYYmmdd-HHMMSS/
```

关键文件：

- `REPORT.md`: 总报告
- `summary.tsv`: 每轮状态、耗时、日志路径
- `bootstrap/`: 首次 Docker lab 自举产物
- `iterations/<n>/verify.log`: 每轮完整验证日志
- `iterations/<n>/ldapsearch.out`: 每轮 `ldapsearch` 输出
- `iterations/<n>/ldap-native.out`: 每轮 `ldap-native` 输出
- `freeipa.log`: FreeIPA 容器日志
- `runner.log`: RHEL 9 runner 容器日志

成功时，每轮日志应同时出现：

```text
ldapsearch GSSAPI probe
result: 0 Success
ldap-native saslBind() probe
```

`ldap-native.out` 里应有 whoami 结果。

## GitHub Actions 用法

GitHub Actions 可以跑 Docker，因此可以手动触发现有 `ci` workflow 的 Docker GSSAPI lab：

1. 打开 `Actions`
2. 选择 `ci`
3. 点击 `Run workflow`
4. 勾选 `run_gssapi_docker_lab`

这会跑一次完整 FreeIPA / RHEL9 GSSAPI lab。

如果要跑“一晚上”的长测，更推荐 self-hosted Linux runner 或自己的 Linux 服务器。GitHub 官方 Actions limits 文档当前写明 GitHub-hosted runner 单个 job 最长 6 小时，因此 GitHub-hosted runner 更适合跑几小时以内的压力 demo，不适合作为真正 8 小时以上的长期守护环境。

参考：[GitHub Actions limits](https://docs.github.com/en/enterprise-cloud@latest/actions/reference/actions-limits)

## 保留现场排查

失败后保留容器：

```bash
KEEP_GSSAPI_STACK=1 \
GSSAPI_OVERNIGHT_FAIL_FAST=1 \
bash scripts/run-gssapi-overnight-demo.sh
```

进入 RHEL 9 runner：

```bash
docker compose -p ldap-native-gssapi-overnight -f docker-compose.gssapi.yml exec gssapi-runner bash
```

销毁环境：

```bash
docker compose -p ldap-native-gssapi-overnight -f docker-compose.gssapi.yml down -v
```
