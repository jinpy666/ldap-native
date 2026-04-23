# CI GSSAPI Setup

本文说明如何为 `ldap-native` 的 GitHub Actions 启用真实 Kerberos / GSSAPI 自动化测试。

## 目标

启用后，CI 会在 Linux job 中自动：

1. 获取 Kerberos 凭据
2. 运行 `ldapsearch -Y GSSAPI`
3. 运行 `ldap-native` 的 `client.saslBind()`
4. 抓取 LDAP 流量并上传 `.pcap`
5. 上传 `ldapsearch`、`ldap-native` 输出和摘要报告

Windows job 会单独验证 `ldap-native` 的 Wldap32 SSPI/Negotiate 路径。Windows
没有仓库内的 `ldapsearch -Y GSSAPI` 对照项；当提供真实 LDAP / Kerberos secrets
时，该 job 会确认 native addon 可以通过 `client.saslBind({ mechanism: 'GSSAPI' })`
完成真实 LDAP bind。当没有这些 secrets 时，CI 会退回到自包含的 synthetic LDAP
fixture，覆盖 Windows native addon 的 SSPI/Negotiate 调用路径，但不声明完成了真实
KDC / AD 验证。

## CI Job

对应 workflow 中的 job：

- `.github/workflows/ci.yml`
- job 名称：`gssapi-linux`
- job 名称：`gssapi-windows`

Linux GSSAPI job 只有在相关 secrets 已配置时才会运行。Windows GSSAPI job 始终
构建 Windows native addon；有 secrets 时跑真实 LDAP / Kerberos bind，没有 secrets
时跑 synthetic Wldap32 SSPI bind 覆盖。

## 必需 secrets

### Linux

至少需要：

```text
LDAP_URL
LDAP_BASE_DN
KRB5_PRINCIPAL
```

并且下面两组中至少提供一种：

### 方案一：密码

```text
KRB5_PASSWORD
```

### 方案二：keytab

```text
KRB5_KEYTAB_B64
```

说明：

- `KRB5_KEYTAB_B64` 是 keytab 文件内容的 base64 编码
- CI 会在运行时自动解码成临时文件

### Windows

Windows GSSAPI job 至少需要：

```text
LDAP_URL
LDAP_BASE_DN
LDAP_GSSAPI_WINDOWS_USER
LDAP_GSSAPI_WINDOWS_PASSWORD
```

可选：

```text
LDAP_GSSAPI_WINDOWS_DOMAIN
LDAP_GSSAPI_WINDOWS_REALM
LDAP_STARTTLS
```

Windows backend 使用 SSPI/Negotiate；如果本地手动运行时省略用户和密码，会使用
当前 Windows 登录凭据。CI runner 通常没有域登录上下文，因此 CI 推荐显式提供
`LDAP_GSSAPI_WINDOWS_USER` / `LDAP_GSSAPI_WINDOWS_PASSWORD`。

如果没有配置以上 Windows secrets，GitHub Actions 会自动运行：

```text
npm run test:gssapi:windows:synthetic
```

这个 fallback 会在 Windows runner 上启动一个本地 LDAP fixture，然后调用
`client.saslBind({ mechanism: 'GSSAPI' })`。它的价值是无凭据覆盖 Wldap32 SSPI
native 路径；它不能替代真实 Kerberos realm / KDC / AD 互操作测试。

## 可选 secrets

### TLS 证书

如果 LDAP 服务器使用私有 CA，推荐提供下面其中一种：

```text
LDAP_CA_FILE
LDAP_CA_B64
```

说明：

- `LDAP_CA_FILE` 适合 runner 上已存在固定路径的情况
- `LDAP_CA_B64` 更通用，推荐在 GitHub Actions secrets 中使用

### Kerberos 配置

如果 runner 默认 `/etc/krb5.conf` 不适用，提供下面其中一种：

```text
KRB5_CONFIG
KRB5_CONFIG_B64
```

推荐优先使用：

```text
KRB5_CONFIG_B64
```

### 其他可选项

```text
LDAP_STARTTLS
```

默认值：

- 如果未配置，workflow 中默认按 `1` 处理
- `ldap://` 环境通常建议 `1`
- `ldaps://` 环境通常建议显式设置为 `0`

## 推荐 secret 组合

最稳的组合通常是：

```text
LDAP_URL
LDAP_BASE_DN
KRB5_PRINCIPAL
KRB5_KEYTAB_B64
LDAP_CA_B64
KRB5_CONFIG_B64
LDAP_STARTTLS
```

这种方式不依赖 runner 上的预置文件路径，移植性最好。

## 生成 base64 的方法

### keytab

```bash
base64 -w 0 service.keytab
```

如果系统 `base64` 不支持 `-w`：

```bash
base64 service.keytab | tr -d '\n'
```

### CA 证书

```bash
base64 -w 0 ldap-ca.pem
```

### krb5.conf

```bash
base64 -w 0 krb5.conf
```

## 运行结果

CI 会上传 artifact：

- `artifacts/gssapi/ldap-gssapi.pcap`
- `artifacts/gssapi/ldapsearch.out`
- `artifacts/gssapi/ldap-native.out`
- `artifacts/gssapi/summary.env`
- `artifacts/gssapi/REPORT.md`
- `artifacts/gssapi/tshark-ldap.txt` 如果 runner 上 `tshark` 可用
- `artifacts/gssapi-windows/ldap-native-windows.out`
- `artifacts/gssapi-windows/windows-gssapi-test.out`
- `artifacts/gssapi-windows/REPORT.md`

无 Windows secrets 的 synthetic fallback 不会生成真实 LDAP/Kerberos 报告；它会上传：

- `artifacts/gssapi-windows/windows-gssapi-synthetic.out`
- `artifacts/gssapi-windows/REPORT.md`

## 判定标准

至少应满足：

1. `ldapsearch -Y GSSAPI` 成功
2. `client.saslBind()` 成功
3. `REPORT.md` 中两侧输出都能反映同一 Kerberos 身份

如果需要进一步排查协议差异，再看：

- `ldap-gssapi.pcap`
- `tshark-ldap.txt`

## 一次到位的边界

仓库侧现在已经把：

- 测试入口
- CI job
- 抓包
- artifact 上传
- 报告生成

都补齐了。

真正无法“在仓库内一次做到位”的只剩外部依赖本身：

- 可访问的 LDAP 服务器
- 可用的 Kerberos principal
- 正确的 keytab 或密码
- 对应的 CA 和 `krb5.conf`

这些必须由仓库维护者在 GitHub Secrets 中提供。

如果当前没有这些外部变量，但仍然想先做本地协议链路验证，可以先使用仓库内的自举 Docker lab：

- [GSSAPI_DOCKER.md](./GSSAPI_DOCKER.md)
- 命令：`npm run test:gssapi:docker`

此外，`ci` workflow 现在提供了一个手动触发的 Linux 自举 job：

- 打开 GitHub Actions 的 `ci`
- `Run workflow`
- 勾选 `run_gssapi_docker_lab`

它会尝试在 GitHub Linux runner 上直接启动 FreeIPA + RHEL9 runner，并上传 `artifacts/gssapi-docker/` 作为结果。
