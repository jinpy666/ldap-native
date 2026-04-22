# 从 ldapts 迁移到 ldap-native

`ldap-native` 保持了 `ldapts` 的 `Client` API 形状，大多数情况下只需替换包名即可完成迁移。

## 快速迁移清单

| 步骤 | 操作 |
|------|------|
| 1 | `npm uninstall ldapts && npm install ldap-native` |
| 2 | 全局替换 `from 'ldapts'` → `from 'ldap-native'`，`require('ldapts')` → `require('ldap-native')` |
| 3 | 检查是否使用了私有 API（见下方不兼容项） |
| 4 | 运行测试验证 |

## 导入替换

```js
// ldapts — 替换前
const { Client, Attribute, Change } = require('ldapts');
// 或
import { Client, Attribute, Change } from 'ldapts';

// ldap-native — 替换后
const { Client, Attribute, Change } = require('ldap-native');
// 或
import { Client, Attribute, Change } from 'ldap-native';
```

子路径导入 `ldapts/controls` 在 `ldap-native` 中不需要使用——所有控件类已从主入口导出：

```js
// ldapts
const { PagedResultsControl } = require('ldapts/controls');

// ldap-native（直接从主入口导入）
const { PagedResultsControl } = require('ldap-native');
```

## Client 构造函数

**完全兼容**，选项对象相同：

```js
// 两者写法一致
const client = new Client({
  url: 'ldap://ldap.example.com:389',
  timeout: 30000,
  connectTimeout: 5000,
  strictDN: true,
  tlsOptions: {
    ca: [fs.readFileSync('ca-cert.pem')],
  },
});
```

`ldap-native` 额外支持 `sasl` 选项用于 Kerberos/GSSAPI 配置：

```js
const client = new Client({
  url: 'ldap://ldap.example.com:389',
  sasl: { mechanism: 'GSSAPI' },
});
```

## 操作方法对照

所有方法签名与 `ldapts` 一致，返回相同的数据结构：

### bind — 认证

```js
// 简单绑定 — 完全兼容
await client.bind('cn=admin,dc=example,dc=com', 'password');

// SASL 绑定 — 完全兼容
await client.bind('EXTERNAL');
await client.bind('PLAIN', credential);
```

`ldap-native` 额外支持 GSSAPI：

```js
await client.bind('GSSAPI');
```

### search — 搜索

```js
// 两者写法完全一致
const { searchEntries, searchReferences } = await client.search(
  'ou=users,dc=example,dc=com',
  {
    scope: 'sub',
    filter: '(mail=*@example.com)',
    attributes: ['cn', 'mail', 'uid'],
    sizeLimit: 100,
    timeLimit: 10,
    paged: { pageSize: 50 },
  },
);
```

返回值格式相同：
- `searchEntries` — 条目数组，每个条目包含 `dn` 及各属性
- `searchReferences` — 引用 URL 字符串数组

### searchPaginated — 分页搜索

```js
// 两者写法完全一致
const paginator = client.searchPaginated('dc=example,dc=com', {
  filter: '(objectClass=person)',
  paged: { pageSize: 100 },
});

for await (const { searchEntries } of paginator) {
  console.log(searchEntries);
}
```

### add — 添加条目

```js
// 两者写法完全一致
await client.add('cn=New User,ou=users,dc=example,dc=com', {
  cn: 'New User',
  sn: 'User',
  mail: 'newuser@example.com',
  objectClass: 'inetOrgPerson',
});
```

### modify — 修改条目

```js
// 两者写法完全一致
await client.modify('cn=John,dc=example,dc=com', [
  new Change({
    operation: 'replace',
    modification: new Attribute({ type: 'mail', values: ['new@example.com'] }),
  }),
]);
```

### del — 删除条目

```js
await client.del('cn=John,dc=example,dc=com');
```

### compare — 比较属性值

```js
const matched = await client.compare('cn=John,dc=example,dc=com', 'mail', 'john@example.com');
```

### modifyDN — 重命名/移动

```js
await client.modifyDN('cn=John,dc=example,dc=com', 'cn=Jane');
```

### exop — 扩展操作

```js
const result = await client.exop('1.3.6.1.4.1.4203.1.11.3'); // whoami
```

### startTLS — 升级 TLS

```js
// 两者写法一致
await client.startTLS({
  ca: [fs.readFileSync('ca-cert.pem')],
});

// ldap-native 额外支持 caFile 路径
await client.startTLS({ caFile: '/etc/ssl/certs/ldap-ca.pem' });
```

### unbind — 断开连接

```js
await client.unbind();
```

## 错误处理

错误类完全兼容，可以直接 `instanceof` 判断：

```js
const {
  InvalidCredentialsError,
  NoSuchObjectError,
  AlreadyExistsError,
  InsufficientAccessError,
  SizeLimitExceededError,
  ResultCodeError,
} = require('ldap-native');

try {
  await client.bind(dn, password);
} catch (err) {
  if (err instanceof InvalidCredentialsError) {
    // 认证失败
  } else if (err instanceof NoSuchObjectError) {
    // 对象不存在
  }
}
```

## Controls

常用控件兼容：

| 控件 | ldapts | ldap-native |
|------|--------|-------------|
| `PagedResultsControl` | ✅ | ✅ |
| `ServerSideSortingRequestControl` | ✅ | ✅（mock 路径） |
| `EntryChangeNotificationControl` | ✅ | ✅（类型导出） |
| `PersistentSearchControl` | ✅ | ✅（类型导出） |
| 通用 `Control(oid)` | ✅ | ⚠️ 部分支持 |

> 通用 Control 的 OID 编码尚未完全实现，见 [COMPATIBILITY.md](../COMPATIBILITY.md)。

## 辅助类兼容性

以下辅助类行为一致，无需修改代码：

| 类 | 说明 | 状态 |
|----|------|------|
| `Attribute` | 属性表示 | ✅ |
| `Change` | 修改操作 | ✅ |
| `PostalAddress` | 地址格式化 | ✅ |
| `DN` / `RDN` | DN 解析 | ✅ |
| `FilterParser` | 过滤器解析 | ✅ |
| `BerReader` / `BerWriter` | BER 编解码 | ✅ |
| 11 种 Filter 类 | 过滤器类型 | ✅ |
| 35+ 种 Error 类 | 错误类型 | ✅ |

## 不兼容项

### 1. 私有传输层 API

如果你使用了以下内部属性或方法，需要重构：

```js
// ❌ ldapts 内部 API，ldap-native 不提供
client._send(message);
client._socket;
client.messageID;
```

这些是 `ldapts` 的 socket/BER 传输层实现细节，`ldap-native` 使用 OpenLDAP `libldap` 替代了整个传输层。

### 2. 直接构造 Message 对象

如果你手动构造 `SearchRequest`、`BindRequest` 等消息对象并通过内部管道发送，这在 `ldap-native` 中不可行。请改用 `Client` 的公共方法。

### 3. 符号 dispose（Symbol.asyncDispose）

`ldapts` v8+ 支持 `using client = new Client(...)`，`ldap-native` 目前尚未实现该接口：

```js
// ldapts v8+ 写法
{
  using client = new Client({ url: '...' });
  await client.bind(dn, pw);
  // 作用域结束自动 unbind
}

// ldap-native：手动 unbind
const client = new Client({ url: '...' });
try {
  await client.bind(dn, pw);
} finally {
  await client.unbind();
}
```

### 4. 同步阻塞行为

`ldap-native` 当前原生层使用同步 `libldap` 调用包装为 Promise，在高并发场景下可能阻塞 Node.js 事件循环。如果这对你的场景有影响，建议使用连接池或 worker 线程。

## 完整迁移示例

迁移前（ldapts）：

```js
const { Client, Attribute, Change } = require('ldapts');

async function updateUser(email) {
  const client = new Client({
    url: 'ldaps://ldap.example.com',
    timeout: 30000,
    connectTimeout: 5000,
    tlsOptions: { ca: [fs.readFileSync('ca.pem')] },
  });

  try {
    await client.bind('cn=admin,dc=example,dc=com', 'secret');

    const { searchEntries } = await client.search('ou=users,dc=example,dc=com', {
      scope: 'sub',
      filter: `(mail=${email})`,
      attributes: ['dn', 'cn', 'mail'],
    });

    if (searchEntries.length === 0) throw new Error('User not found');

    await client.modify(searchEntries[0].dn, [
      new Change({
        operation: 'replace',
        modification: new Attribute({ type: 'lastLogin', values: [new Date().toISOString()] }),
      }),
    ]);
  } finally {
    await client.unbind();
  }
}
```

迁移后（ldap-native）—— 只改了导入：

```js
const { Client, Attribute, Change } = require('ldap-native'); // ← 仅此一行变化

async function updateUser(email) {
  const client = new Client({
    url: 'ldaps://ldap.example.com',
    timeout: 30000,
    connectTimeout: 5000,
    tlsOptions: { ca: [fs.readFileSync('ca.pem')] },
  });

  try {
    await client.bind('cn=admin,dc=example,dc=com', 'secret');

    const { searchEntries } = await client.search('ou=users,dc=example,dc=com', {
      scope: 'sub',
      filter: `(mail=${email})`,
      attributes: ['dn', 'cn', 'mail'],
    });

    if (searchEntries.length === 0) throw new Error('User not found');

    await client.modify(searchEntries[0].dn, [
      new Change({
        operation: 'replace',
        modification: new Attribute({ type: 'lastLogin', values: [new Date().toISOString()] }),
      }),
    ]);
  } finally {
    await client.unbind();
  }
}
```

## 性能预期

| 指标 | ldapts | ldap-native |
|------|--------|-------------|
| 协议栈 | JavaScript socket/BER | OpenLDAP libldap（C） |
| 单次搜索延迟 | 基准 | 通常更低 |
| 高并发 | 非阻塞 | ⚠️ 原生调用同步，考虑连接池 |
| SASL/GSSAPI | 不支持 | ✅ 原生支持 |

## 需要帮助？

- [兼容性矩阵](../COMPATIBILITY.md)
- [架构说明](../ARCHITECTURE.md)
- [构建指南](../BUILD.md)
