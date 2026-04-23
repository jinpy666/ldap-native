# ldap-native GSSAPI / Kerberos / TLS 使用文档

本文面向 `npm install ldap-native` 的使用者，按 RHEL 9 环境说明如何用
Kerberos / SASL GSSAPI 连接 OpenLDAP 或 Active Directory，并覆盖 TLS、
账号密码取票据、keytab、`ldapsearch` 对照、Docker lab 和常见错误排查。

## 核心结论

GSSAPI 不是 LDAP simple bind。完整流程是：

1. 在系统 Kerberos 客户端里配置 realm 和 KDC。
2. 用 Kerberos principal + 密码或 keytab 执行 `kinit`，拿到票据缓存。
3. Node.js 代码连接 LDAP。
4. 对 `ldap://` 调用 `startTLS()`，或直接使用 `ldaps://`。
5. 调用 `client.saslBind({ mechanism: 'GSSAPI' })`。

也就是说：

- `client.bind(dn, password)` 是 LDAP simple bind。
- `client.saslBind({ mechanism: 'GSSAPI' })` 对标 `ldapsearch -Y GSSAPI`。
- `bind('GSSAPI')` 是兼容写法，新代码建议直接用 `saslBind()`。
- Kerberos 账号密码通常只交给 `kinit`，不是直接传给 LDAP bind。

## 安装

```bash
npm install ldap-native
```

RHEL 9 如果需要从源码构建 native addon，先安装系统依赖：

```bash
sudo dnf install -y \
  openldap-devel \
  cyrus-sasl-devel \
  cyrus-sasl-gssapi \
  krb5-workstation \
  python3 \
  make \
  gcc-c++
```

运行时至少需要：

```bash
sudo dnf install -y openldap-clients cyrus-sasl-gssapi krb5-workstation
```

## TLS 证书

如果 LDAP / AD 使用企业 CA，RHEL 9 推荐导入系统信任：

```bash
sudo cp ad-ca.pem /etc/pki/ca-trust/source/anchors/
sudo update-ca-trust
```

常用 CA bundle 路径：

```text
/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem
```

也可以只给 `ldap-native` 单独传一个 CA 文件：

```js
await client.startTLS({ caFile: '/path/to/ad-ca.pem' });
```

## Kerberos 配置

最小 `/etc/krb5.conf` 示例：

```ini
[libdefaults]
  default_realm = EXAMPLE.COM
  dns_lookup_kdc = false
  dns_lookup_realm = false
  rdns = false
  ticket_lifetime = 24h
  forwardable = true

[realms]
  EXAMPLE.COM = {
    kdc = dc1.example.com
    admin_server = dc1.example.com
  }

[domain_realm]
  .example.com = EXAMPLE.COM
  example.com = EXAMPLE.COM
```

企业环境如果依赖 DNS 自动发现 KDC，可以把 `dns_lookup_kdc` 改成 `true`。
如果服务端 SPN 和反向 DNS 不一致，`rdns = false` 通常更稳定。

## 方式一：账号密码 + StartTLS + GSSAPI

设置环境变量：

```bash
export LDAP_URL='ldap://ad01.example.com:389'
export LDAP_BASE_DN='dc=example,dc=com'
export LDAP_FILTER='(sAMAccountName=jdoe)'
export LDAP_ATTRIBUTES='cn,distinguishedName,mail,memberOf'
export LDAP_CA_FILE='/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem'
export LDAP_STARTTLS=1

export KRB5_CONFIG='/etc/krb5.conf'
export KRB5CCNAME="FILE:/tmp/krb5cc_$(id -u)"
export KRB5_PRINCIPAL='svc_ldap@EXAMPLE.COM'
export KRB5_PASSWORD='YourStrongPassword'
```

先手工验证 Kerberos 票据：

```bash
printf '%s\n' "$KRB5_PASSWORD" | kinit "$KRB5_PRINCIPAL"
klist
```

再运行 npm 包内示例：

```bash
node node_modules/ldap-native/examples/gssapi-rhel9.cjs
```

如果是在仓库源码里运行：

```bash
node examples/gssapi-rhel9.cjs
```

## 方式二：keytab + StartTLS + GSSAPI

服务端程序更推荐 keytab，避免在环境变量里长期保存密码：

```bash
export LDAP_URL='ldap://ad01.example.com:389'
export LDAP_BASE_DN='dc=example,dc=com'
export LDAP_CA_FILE='/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem'
export LDAP_STARTTLS=1

export KRB5_CONFIG='/etc/krb5.conf'
export KRB5CCNAME='FILE:/tmp/ldap-native-service.ccache'
export KRB5_PRINCIPAL='svc_ldap@EXAMPLE.COM'
export KRB5_KEYTAB='/etc/security/keytabs/svc_ldap.keytab'

node node_modules/ldap-native/examples/gssapi-rhel9.cjs
```

示例会自动执行：

```bash
kinit -kt "$KRB5_KEYTAB" "$KRB5_PRINCIPAL"
```

## 方式三：LDAPS + GSSAPI

如果目录服务直接提供 `ldaps://host:636`：

```bash
export LDAP_URL='ldaps://ad01.example.com:636'
export LDAP_BASE_DN='dc=example,dc=com'
export LDAP_CA_FILE='/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem'
export LDAP_STARTTLS=0

export KRB5_PRINCIPAL='svc_ldap@EXAMPLE.COM'
export KRB5_PASSWORD='YourStrongPassword'

node node_modules/ldap-native/examples/gssapi-rhel9.cjs
```

`ldaps://` 已经在连接阶段建立 TLS，不需要再调用 `startTLS()`。

## 完整代码

包内提供完整示例：

- `examples/gssapi-rhel9.cjs`

核心代码如下：

```js
const { Client } = require('ldap-native');

const client = new Client({
  url: process.env.LDAP_URL,
  connectTimeout: 10000,
  timeout: 10000,
  sasl: { mechanism: 'GSSAPI' },
  tlsOptions: process.env.LDAP_CA_FILE
    ? { caFile: process.env.LDAP_CA_FILE }
    : undefined,
});

if (process.env.LDAP_STARTTLS === '1') {
  await client.startTLS(client.options.tlsOptions);
}

await client.saslBind({ mechanism: 'GSSAPI' });
```

## 和 ldapsearch 对照

同一组环境变量下，先确认 `ldapsearch` 能跑通：

```bash
export LDAPTLS_CACERT="$LDAP_CA_FILE"

ldapsearch -ZZ \
  -Y GSSAPI \
  -H "$LDAP_URL" \
  -b "$LDAP_BASE_DN" \
  -s base \
  '(objectClass=*)' dn
```

如果是 `ldaps://`：

```bash
ldapsearch \
  -Y GSSAPI \
  -H "$LDAP_URL" \
  -b "$LDAP_BASE_DN" \
  -s base \
  '(objectClass=*)' dn
```

仓库还提供 RHEL9 验证脚本，会同时跑 `ldapsearch` 和 `ldap-native`：

```bash
bash node_modules/ldap-native/scripts/verify-gssapi-rhel9.sh
```

源码仓库内：

```bash
bash scripts/verify-gssapi-rhel9.sh
```

## 没有企业环境时用 Docker lab

如果你没有现成 LDAP / Kerberos / CA 环境，可以用仓库提供的 FreeIPA lab：

```bash
npm run test:gssapi:docker
```

或者源码仓库内：

```bash
bash scripts/run-gssapi-docker-lab.sh
```

这个 lab 会启动 FreeIPA + RHEL9/Rocky9 runner，验证：

- `ldapsearch -Y GSSAPI`
- `client.saslBind()`
- StartTLS
- Kerberos ticket cache
- 可选抓包产物

详细说明见 [GSSAPI Docker lab](GSSAPI_DOCKER.md)。

## 环境变量参考

| 变量 | 必填 | 说明 |
| --- | --- | --- |
| `LDAP_URL` | 是 | `ldap://host:389` 或 `ldaps://host:636` |
| `LDAP_BASE_DN` | 是 | 查询 base DN，例如 `dc=example,dc=com` |
| `LDAP_STARTTLS` | 否 | `ldap://` 默认等价 `1`，`ldaps://` 默认等价 `0` |
| `LDAP_CA_FILE` | 否 | CA 文件路径；StartTLS / LDAPS 企业 CA 常用 |
| `LDAP_FILTER` | 否 | 查询过滤器，默认 `(objectClass=*)` |
| `LDAP_ATTRIBUTES` | 否 | 逗号分隔属性，默认 `dn,cn,mail` |
| `KRB5_CONFIG` | 否 | Kerberos 配置路径，默认系统配置 |
| `KRB5CCNAME` | 否 | 票据缓存位置 |
| `KRB5_PRINCIPAL` | 否 | Kerberos principal |
| `KRB5_PASSWORD` | 否 | 用密码执行 `kinit` |
| `KRB5_KEYTAB` | 否 | 用 keytab 执行 `kinit -kt` |
| `LDAP_SASL_REALM` | 否 | 传给 `saslBind()` 的 realm |
| `LDAP_SASL_AUTHZID` | 否 | 代理授权身份，对应 `proxyUser` |
| `LDAP_SASL_SECPROPS` | 否 | Cyrus SASL 安全属性，例如 `none` |

如果没有提供 `KRB5_PASSWORD` 或 `KRB5_KEYTAB`，示例会复用当前已有票据缓存。

## 常见问题

### `ldapsearch` 可以，Node 第一步只看到 `GSSAPI` 字符串

旧实现如果只调用单次 SASL bind，第一包可能只带机制名，没有真正的 GSSAPI
credential token。当前实现已对齐成熟 OpenLDAP 用法，使用
`ldap_sasl_interactive_bind()` 多轮循环和 SASL callback 生成 token。

验证方式：

```bash
LDAP_CAPTURE=1 bash scripts/verify-gssapi-rhel9.sh
```

然后用 Wireshark 或 tshark 对比 `ldapsearch` 和 `ldap-native` 的 SASL bind
请求。

### `No worthy mechs found`

通常是缺少 Cyrus SASL GSSAPI 插件。RHEL 9 安装：

```bash
sudo dnf install -y cyrus-sasl-gssapi
```

### `Server not found in Kerberos database`

常见原因是 LDAP 主机名、DNS、SPN 不匹配。确认：

- `LDAP_URL` 使用服务端证书和 SPN 对应的 FQDN。
- `/etc/krb5.conf` 里 `rdns = false`。
- AD 中存在 `ldap/host.example.com@REALM` 对应 SPN。

### TLS 证书失败

确认：

- `LDAP_CA_FILE` 指向正确 CA。
- `ldapsearch` 已设置 `LDAPTLS_CACERT="$LDAP_CA_FILE"`。
- 连接主机名和证书 SAN 匹配。

### CI 能不能测出来

常规单元测试只能覆盖 API 和打包，不会证明真实 GSSAPI token 已经产生。必须跑带
KDC、LDAP、SASL 插件和 TLS 的集成环境。仓库提供的 Docker lab 和 GitHub Actions
手动 job 就是为这个目的准备的。
