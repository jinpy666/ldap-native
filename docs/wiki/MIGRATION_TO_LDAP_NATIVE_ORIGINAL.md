# 从 ldapts / ldapjs 迁移到 ldap-native

## 包信息

- npm: [https://www.npmjs.com/package/ldap-native](https://www.npmjs.com/package/ldap-native)
- GitHub: [https://github.com/jinpy666/ldap-native](https://github.com/jinpy666/ldap-native)

安装：

```bash
npm install ldap-native
```

## ldap-native 是什么

`ldap-native` 是一个接近 `ldapts` API 的 Node.js LDAP 客户端，但底层不是 `ldapts` 的 JS 传输层，而是通过 Node-API 调用 OpenLDAP `libldap`。

适合：

- 替换 `ldapts`
- 把 `ldapjs` 代码迁移到 Promise 风格
- 接入 OpenLDAP / Active Directory
- 使用 SASL / Kerberos / GSSAPI

## 从 ldapts 迁移

### 典型改法

```js
// before
const { Client, Attribute, Change } = require('ldapts');

// after
const { Client, Attribute, Change } = require('ldap-native');
```

或：

```ts
import { Client, Attribute, Change } from 'ldap-native';
```

### 大多数情况下不用改的方法

- `new Client({ url, timeout, connectTimeout, tlsOptions, strictDN })`
- `bind()`
- `startTLS()`
- `search()`
- `searchPaginated()`
- `add()` / `modify()` / `del()` / `compare()` / `modifyDN()` / `exop()` / `unbind()`

### 需要注意

1. 不要依赖 `ldapts` 私有内部属性：

```js
client._send(...)
client._socket
client.messageID
```

2. `using client = new Client(...)` 这类自动释放写法当前不要依赖，建议显式 `try/finally + unbind()`。

3. 复杂自定义控件需要联调验证。

## 从 ldapjs 迁移

### 常见替换

| `ldapjs` | `ldap-native` |
|---------|---------------|
| `ldap.createClient(opts)` | `new ldap.Client(opts)` 或 `new Client(opts)` |
| `client.bind(dn, password, cb)` | `await client.bind(dn, password)` |
| `client.starttls(opts, cb)` | `await client.startTLS(opts)` |
| `client.search(base, opts, cb)` | `await client.search(base, opts)` |

### 参数差异

| `ldapjs` | `ldap-native` | 说明 |
|---------|---------------|------|
| `attrsOnly: true` | `returnAttributeValues: false` | 语义相反 |
| `attrsOnly: false` | `returnAttributeValues: true` | 语义相反 |
| `attributes: 'cn'` | `attributes: ['cn']` | 建议统一数组 |
| `url: ['ldap://a', 'ldap://b']` | `url: 'ldap://a'` | 多地址逻辑需自己实现 |
| `reconnect` / `idleTimeout` / `socketPath` / `log` | 不支持 | 需在业务层处理 |

### 搜索结果差异

`ldapjs` 常见写法：

```js
client.search(baseDN, opts, (err, res) => {
  res.on('searchEntry', (entry) => {
    console.log(entry.pojo || entry.object);
  });
});
```

迁移后通常改成：

```js
const { searchEntries, searchReferences } = await client.search(baseDN, opts);
console.log(searchEntries);
console.log(searchReferences);
```

如需显式分页：

```js
for await (const page of client.searchPaginated(baseDN, {
  ...opts,
  paged: { pageSize: 200 },
})) {
  console.log(page.searchEntries);
}
```

### 默认行为差异

- `ldapjs` `search()` 默认 `scope` 是 `base`
- `ldap-native` 默认 `scope` 是 `sub`

迁移时最好显式写出 `scope`。

## 使用注意点

- `ldap-native` 的目标是兼容 `ldapts` 的公开 API，不是复刻全部内部实现。
- 当前底层仍以同步 `libldap` 调用为主，高并发服务要评估事件循环阻塞风险。
- 复杂通用 `Control` 需要专项验证。
- 使用 `bind('GSSAPI')` 时，请确认系统上有 Kerberos 和 SASL GSSAPI 相关依赖。

## 迁移建议

- `ldapts` 用户：重点看兼容边界。
- `ldapjs` 用户：重点改 callback / 事件流模型。
