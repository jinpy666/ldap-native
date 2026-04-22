# Kerberos + TLS + 账号密码完整接入示例（RHEL 9）

本文以 RHEL 9 为例，给出 `ldap-native` 中 Kerberos / GSSAPI 连接 LDAP 的完整示例，包含：

- Kerberos 账号密码获取票据
- `StartTLS` 或 `LDAPS` 加密连接
- `saslBind()` 认证
- 查询示例
- 常见问题说明

## 先说结论

在这个仓库里，Kerberos 的接法不是把用户名密码直接传给 LDAP 做 simple bind，而是：

1. 先用 Kerberos principal 和密码执行 `kinit`
2. 系统获得 Kerberos 票据
3. 代码里执行 `await client.saslBind()`

也就是说：

- `client.bind(dn, password)` 是 LDAP simple bind
- `client.saslBind()` 是推荐的 Kerberos / SASL GSSAPI bind 入口
- `client.bind('GSSAPI')` 是兼容写法

这两者不是一回事。

## 适用场景

常见于：

- Active Directory
- 开启了 SASL GSSAPI 的 OpenLDAP
- 企业域环境中的统一认证

## 前置依赖

以下命令以 RHEL 9 为例：

```bash
sudo dnf install -y \
  nodejs \
  npm \
  openldap-devel \
  cyrus-sasl-devel \
  cyrus-sasl-gssapi \
  krb5-workstation \
  python3 \
  make \
  gcc-c++
```

如果你已经有 Node.js 构建环境，可以忽略 `nodejs` 和 `npm`。

## TLS 证书准备

RHEL 9 常见做法是把 LDAP 或 AD 的 CA 证书放入系统信任目录：

```bash
sudo cp ad-ca.pem /etc/pki/ca-trust/source/anchors/
sudo update-ca-trust
```

之后可以直接使用系统 CA bundle：

```bash
/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem
```

如果你不想使用系统 bundle，也可以把单独的 CA 文件路径直接传给 `caFile`。

## Kerberos 配置示例

一个最小可用的 `/etc/krb5.conf` 示例：

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

如果你的环境依赖 DNS 自动发现 KDC，也可以把 `dns_lookup_kdc` 改成 `true`，但企业环境里通常建议明确配置。

## 方式一：Kerberos 账号密码拿票据 + StartTLS + GSSAPI

这是最典型、也最推荐的接法。

### 1. 设置环境变量

```bash
export LDAP_URL='ldap://ad01.example.com:389'
export LDAP_BASE_DN='dc=example,dc=com'
export LDAP_CA_FILE='/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem'

export KRB5_CONFIG='/etc/krb5.conf'
export KRB5CCNAME="FILE:/tmp/krb5cc_$(id -u)"
export KRB5_PRINCIPAL='svc_ldap@EXAMPLE.COM'
export KRB5_PASSWORD='YourStrongPassword'
```

说明：

- `LDAP_URL` 使用 `ldap://...:389`
- 然后在代码里执行 `startTLS()`
- `KRB5_PRINCIPAL` 和 `KRB5_PASSWORD` 是 Kerberos 账号密码
- 这不是 LDAP simple bind 的 DN 和密码

### 2. 用账号密码执行 `kinit`

```bash
printf '%s\n' "$KRB5_PASSWORD" | kinit "$KRB5_PRINCIPAL"
klist
```

执行成功后，`klist` 应该能看到当前票据缓存。

如果你的 RHEL 9 机器已经加入域，或者已经通过其他方式获取了票据，也可以直接跳过这一步。

### 3. Node.js 完整代码示例

保存为 `kerberos-starttls.cjs`：

```js
'use strict';

const { Client } = require('ldap-native');

async function main() {
  const client = new Client({
    url: process.env.LDAP_URL,
    connectTimeout: 10000,
    timeout: 10000,
    sasl: { mechanism: 'GSSAPI' },
    tlsOptions: {
      caFile: process.env.LDAP_CA_FILE,
    },
  });

  try {
    if ((process.env.LDAP_URL || '').startsWith('ldap://')) {
      await client.startTLS(client.options.tlsOptions);
    }

    await client.saslBind();

    const whoami = await client.exop('1.3.6.1.4.1.4203.1.11.3');
    console.log(
      'whoami =',
      Buffer.isBuffer(whoami.value) ? whoami.value.toString('utf8') : whoami.value,
    );

    const result = await client.search(process.env.LDAP_BASE_DN, {
      scope: 'sub',
      filter: '(sAMAccountName=jdoe)',
      attributes: ['cn', 'distinguishedName', 'mail', 'memberOf'],
      paged: { pageSize: 100 },
    });

    console.log(JSON.stringify(result.searchEntries, null, 2));
  } finally {
    await client.unbind().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

### 4. 运行

```bash
node kerberos-starttls.cjs
```

## 方式二：Kerberos + LDAPS + GSSAPI

如果服务端直接提供 `ldaps://host:636`，可以不调用 `startTLS()`，直接建立加密连接。

### 环境变量

```bash
export LDAP_URL='ldaps://ad01.example.com:636'
export LDAP_BASE_DN='dc=example,dc=com'
export LDAP_CA_FILE='/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem'

export KRB5_CONFIG='/etc/krb5.conf'
export KRB5CCNAME="FILE:/tmp/krb5cc_$(id -u)"
export KRB5_PRINCIPAL='svc_ldap@EXAMPLE.COM'
export KRB5_PASSWORD='YourStrongPassword'
```

### 拿票据

```bash
printf '%s\n' "$KRB5_PASSWORD" | kinit "$KRB5_PRINCIPAL"
klist
```

### Node.js 完整代码

保存为 `kerberos-ldaps.cjs`：

```js
'use strict';

const { Client } = require('ldap-native');

async function main() {
  const client = new Client({
    url: process.env.LDAP_URL,
    connectTimeout: 10000,
    timeout: 10000,
    sasl: { mechanism: 'GSSAPI' },
    tlsOptions: {
      caFile: process.env.LDAP_CA_FILE,
    },
  });

  try {
    await client.saslBind();

    const result = await client.search(process.env.LDAP_BASE_DN, {
      scope: 'sub',
      filter: '(sAMAccountName=jdoe)',
      attributes: ['cn', 'mail'],
      paged: { pageSize: 100 },
    });

    console.log(JSON.stringify(result.searchEntries, null, 2));
  } finally {
    await client.unbind().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

## 如果你想做 simple bind

这不是 Kerberos，但很多人容易混淆。simple bind 应该这样写：

```js
'use strict';

const { Client } = require('ldap-native');

async function main() {
  const client = new Client({
    url: 'ldap://ldap.example.com:389',
    connectTimeout: 5000,
    timeout: 5000,
    tlsOptions: {
      caFile: '/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem',
    },
  });

  try {
    await client.startTLS(client.options.tlsOptions);
    await client.bind('cn=admin,dc=example,dc=com', 'admin');

    const result = await client.search('dc=example,dc=com', {
      filter: '(uid=jdoe)',
      attributes: ['cn', 'uid', 'mail'],
      paged: { pageSize: 100 },
    });

    console.log(JSON.stringify(result.searchEntries, null, 2));
  } finally {
    await client.unbind().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

这里的：

- `cn=admin,dc=example,dc=com` 是 LDAP DN
- `admin` 是 LDAP 密码

它和 Kerberos principal 不是同一套认证流程。

## 推荐的生产做法

生产环境通常不建议把 Kerberos 密码放在环境变量中，更常见的是在 RHEL 9 上使用 keytab：

```bash
export KRB5_CONFIG='/etc/krb5.conf'
export KRB5CCNAME="FILE:/tmp/krb5cc_$(id -u)"
kinit -kt /etc/security/keytabs/svc_ldap.keytab svc_ldap@EXAMPLE.COM
klist
node kerberos-starttls.cjs
```

代码本身不需要改，仍然是：

```js
await client.saslBind();
```

## 常见问题

### 1. 为什么不能直接写 `client.bind('GSSAPI', 'password')`

从当前仓库实现看，`bind()` 的第二个参数会被传给 SASL 层，但当前文档和测试路径都没有把“直接把密码传给 GSSAPI bind”作为标准接法。

实际稳定可用的方式仍然是：

1. `kinit`
2. `saslBind()`

不要把它当成 simple bind 的用户名密码接口来理解。

### 2. 为什么必须关注主机名

Kerberos 会校验服务 principal，通常要求服务主体可解析为：

```text
ldap/<host>@REALM
```

例如你连接：

```text
ldap://ad01.example.com:389
```

那么服务主体通常应当是：

```text
ldap/ad01.example.com@EXAMPLE.COM
```

如果：

- DNS 不对
- `/etc/hosts` 写错
- 你连的是别名但服务票据签给了真实主机名

就可能出现 GSSAPI 认证失败。

### 3. 为什么 TLS 证书也会影响 Kerberos

因为你通常同时依赖：

- TLS 证书主机名校验
- Kerberos 服务主体主机名匹配

如果 URL 主机名和证书、SPN 任何一个不一致，连接就可能失败。

### 4. Active Directory 查询过滤器要怎么写

AD 常见写法：

```text
(sAMAccountName=jdoe)
```

OpenLDAP 常见写法：

```text
(uid=jdoe)
```

## 一套完整的命令行示例

下面是一套以 RHEL 9 为例、从零到验证的完整流程：

```bash
export LDAP_URL='ldap://ad01.example.com:389'
export LDAP_BASE_DN='dc=example,dc=com'
export LDAP_CA_FILE='/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem'

export KRB5_CONFIG='/etc/krb5.conf'
export KRB5CCNAME="FILE:/tmp/krb5cc_$(id -u)"
export KRB5_PRINCIPAL='svc_ldap@EXAMPLE.COM'
export KRB5_PASSWORD='YourStrongPassword'

printf '%s\n' "$KRB5_PASSWORD" | kinit "$KRB5_PRINCIPAL"
klist
node kerberos-starttls.cjs
```

## RHEL 9 上的排查命令

如果认证失败，先用下面几条命令排查：

```bash
klist
getent hosts ad01.example.com
openssl s_client -connect ad01.example.com:636 -showcerts
ldapsearch -Y GSSAPI -H ldap://ad01.example.com:389 -ZZ -b 'dc=example,dc=com' '(sAMAccountName=jdoe)'
```

说明：

- `klist` 看票据是否存在
- `getent hosts` 看主机名解析是否正确
- `openssl s_client` 看证书链和主机名
- `ldapsearch -Y GSSAPI -ZZ` 可验证系统侧 Kerberos + StartTLS 是否先打通

## RHEL 9 上的对比验证脚本

仓库内已经提供一个可直接运行的对比脚本：

```bash
bash scripts/verify-gssapi-rhel9.sh
```

执行前至少准备这些环境变量：

```bash
export LDAP_URL='ldap://ad01.example.com:389'
export LDAP_BASE_DN='dc=example,dc=com'
export LDAP_CA_FILE='/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem'
export KRB5_CONFIG='/etc/krb5.conf'
export KRB5CCNAME="FILE:/tmp/krb5cc_$(id -u)"
export KRB5_PRINCIPAL='svc_ldap@EXAMPLE.COM'
export KRB5_PASSWORD='YourStrongPassword'
```

脚本会依次做这些事：

1. `kinit` 或复用现有票据
2. 执行 `ldapsearch -Y GSSAPI`
3. 执行 `ldap-native` 的 `client.saslBind()`
4. 输出两边结果位置，便于比对

如果你还想抓包，打开：

```bash
LDAP_CAPTURE=1 bash scripts/verify-gssapi-rhel9.sh
```

可选变量：

- `LDAP_CAPTURE_INTERFACE`：抓包网卡，默认 `any`
- `LDAP_CAPTURE_FILE`：抓包文件路径
- `NODE_OUT`：Node 结果输出文件
- `LDAPSEARCH_OUT`：ldapsearch 结果输出文件

抓包后建议重点看：

- 首个 SASL bind request 是否已经带有 GSSAPI token
- `ldapsearch` 和 `ldap-native` 的首包行为是否一致

## 与仓库当前实现的对应关系

仓库当前实现和文档明确支持以下路径：

- `client.bind(dn, password)` 用于 simple bind
- `client.saslBind()` 用于推荐的 Kerberos / GSSAPI SASL 路径
- `client.bind('GSSAPI')` 用于兼容的 Kerberos / GSSAPI 简写
- `client.startTLS()` 用于 `ldap://` 连接升级到 TLS

如果你是要接企业 AD，建议优先使用：

1. `ldap://host:389`
2. `startTLS()`
3. `kinit`
4. `saslBind()`

如果你已经有域名、KDC、证书路径、查询账号信息，可以把实际参数替换到本文示例里直接使用。
