# Docker GSSAPI Lab

本文说明如何在没有现成 LDAP / Kerberos 环境变量的情况下，用 Docker 在本地起一套自举测试环境，验证：

1. `ldapsearch -Y GSSAPI`
2. `ldap-native` 的 `client.saslBind()`
3. StartTLS + Kerberos 票据链路

## 设计

这套 lab 使用两个容器：

- `freeipa`：提供 LDAP + Kerberos KDC + CA
- `gssapi-runner`：基于 RHEL 9 / Rocky 9，安装 Node.js、OpenLDAP 客户端、Kerberos 客户端和构建依赖，在同一 Docker 网络里跑仓库测试

这样做的目的，是避免宿主机侧额外准备：

- `/etc/hosts`
- `krb5.conf`
- 预置票据缓存
- 本地 LDAP / Kerberos 客户端包

## 前置条件

- Docker Engine
- Docker Compose v2
- Linux Docker host is recommended

可先确认：

```bash
docker --version
docker compose version
```

## 一键运行

在仓库根目录执行：

```bash
bash scripts/run-gssapi-docker-lab.sh
```

脚本会自动：

1. 启动 `docker-compose.gssapi.yml`
2. 等待 FreeIPA 初始化完成
3. 导出 CA 证书
4. 生成最小 `krb5.conf`
5. 在 RHEL 9 runner 容器里执行 `npm install`
6. 构建 native addon
7. 执行 `scripts/verify-gssapi-rhel9.sh`

## 平台边界

这套 lab 优先面向 Linux Docker host。

在 macOS Docker Desktop 上，FreeIPA 上游容器已知可能在 `ipa-server-install`
期间失败，典型报错为：

```text
No valid Negotiate header in server response
```

这是 FreeIPA 容器 / Docker Desktop 兼容性边界，不是 `ldap-native`
当前 GSSAPI 实现本身的错误。

如果只是想稳定跑通这套 lab，建议：

- 本地 Linux 主机
- Linux VM
- GitHub Actions Linux runner

如需在 macOS 上强制尝试，可显式覆盖保护：

```bash
ALLOW_DARWIN_FREEIPA=1 bash scripts/run-gssapi-docker-lab.sh
```

## 输出内容

默认输出到：

```text
artifacts/gssapi-docker/
```

常见文件包括：

- `ipa-ca.crt`
- `krb5.conf`
- `ldapsearch.out`
- `ldap-native.out`
- `ldap-gssapi.pcap`
- `REPORT.md`
- `freeipa.log`
- `runner.log`
- `ipaserver-install.log`
- `ipaclient-install.log`
- `httpd-error.log`

抓包默认已开启，因此可以直接对比首个 SASL bind 请求是否已经带上 GSSAPI token。

也可以通过 npm script 运行：

```bash
npm run test:gssapi:docker
```

如果脚本失败，也会尽量保留 FreeIPA 安装日志和一份 `REPORT.md`，方便直接看失败发生在哪个阶段。

## 保留环境用于手工排查

如果你想让容器保持运行，便于手工进入排查：

```bash
KEEP_GSSAPI_STACK=1 bash scripts/run-gssapi-docker-lab.sh
```

然后可以进入 runner：

```bash
docker compose -p ldap-native-gssapi -f docker-compose.gssapi.yml exec gssapi-runner bash
```

手工销毁环境：

```bash
docker compose -p ldap-native-gssapi -f docker-compose.gssapi.yml down -v
```

## 当前边界

这套 Docker lab 的目标是“自举可测”，不是取代真实企业域环境：

- principal、CA、realm、目录结构都使用固定实验值
- 更适合验证协议流程、首包行为和 `ldap-native` 的实现一致性
- 不覆盖真实 AD / 企业 DNS / 跨域 trust 等复杂场景

如果要做 GitHub Actions 长期开启的稳定回归，仍建议后续基于这套 lab 再单独验证：

- FreeIPA 容器在 GitHub hosted runner 上的稳定性
- 初始化耗时
- Docker 宿主的 cgroup / systemd 兼容性
- macOS Docker Desktop 的上游 FreeIPA 兼容性

## GitHub Actions

仓库现在额外提供了一个手动触发的 Linux job，用来跑这套自举 lab。

触发方式：

1. 打开 GitHub Actions 中的 `ci` workflow
2. 选择 `Run workflow`
3. 勾选 `run_gssapi_docker_lab`

这个 job 会在 Linux runner 上执行：

- 配置 Docker `userns-remap`
- `bash scripts/run-gssapi-docker-lab.sh`
- 上传 `artifacts/gssapi-docker/` 全部产物

之所以默认不在每次 push 都开启，是因为：

- FreeIPA 首次安装耗时较长
- 容器化 systemd / cgroup 兼容性仍然要观察
