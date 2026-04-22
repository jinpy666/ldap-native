# 企业 Wiki: 从 ldapts / ldapjs 迁移到 ldap-native

## 简介

`ldap-native` 是一个面向 Node.js 服务端的 LDAP 客户端，目标是保持接近 `ldapts` 的 `Client` API，同时把底层实现切换为 OpenLDAP `libldap` 原生调用。

它适合：

- Active Directory / OpenLDAP 接入
- 企业账号认证
- IAM / 目录查询
- 用户与组织同步
- 需要 SASL / Kerberos / GSSAPI 的服务端场景

## 项目地址

- npm: [https://www.npmjs.com/package/ldap-native](https://www.npmjs.com/package/ldap-native)
- GitHub: [https://github.com/jinpy666/ldap-native](https://github.com/jinpy666/ldap-native)
- Issues: [https://github.com/jinpy666/ldap-native/issues](https://github.com/jinpy666/ldap-native/issues)

安装：

```bash
npm install ldap-native
```

导入路径：

- 主入口：`ldap-native`
- 控件：`ldap-native/controls`
- 错误：`ldap-native/errors`
- 过滤器：`ldap-native/filters`
- DN：`ldap-native/dn`
- BER：`ldap-native/ber`

## 实现原理

`ldap-native` 不是纯 JavaScript LDAP 协议栈，而是“JS API + 原生 LDAP 后端”：

1. 对外暴露接近 `ldapts` 的导出结构和 `Client` API。
2. JS 层负责参数整理、TLS 参数转换、错误转换和结果结构标准化。
3. 底层通过 Node-API addon 调用 OpenLDAP `libldap` / `liblber` / SASL 库执行实际 LDAP 操作。

可以简单理解为：

- `ldapts`：更偏 JS 实现的 LDAP 客户端
- `ldap-native`：更偏 Node.js API 包装的原生 LDAP 客户端

## 为什么迁移

迁移到 `ldap-native` 的主要价值不是“换一个包”，而是统一企业内部 Node.js LDAP 接入方式：

- 对 `ldapts` 用户，迁移成本低
- 对 `ldapjs` 用户，可统一到 Promise 风格
- 对平台团队，便于沉淀统一 LDAP 适配层
- 对需要 GSSAPI / Kerberos 的系统，更容易统一认证能力

## 使用注意点

1. `ldap-native` 的目标是兼容 `ldapts` 的公开 API，不是复刻其私有传输层内部实现。

2. 当前底层仍以同步 `libldap` 调用为主，只是在 JS 层包装成 Promise。高并发系统应评估事件循环阻塞风险，必要时配合连接池、worker 或任务隔离。

3. 通用 `Control` 到原生 `LDAPControl` 的映射不是全覆盖。复杂自定义控件需要专项验证。

4. 这是服务端库，不适合作为浏览器运行时方案。

5. Linux / macOS 一般依赖系统 OpenLDAP 客户端库；Windows 使用系统 `Wldap32`。跨平台项目应分别验证 TLS 和认证行为。

6. 使用 `bind('GSSAPI')` 时，通常还需要 Kerberos 和 SASL GSSAPI 相关依赖，而不只是基础 `libsasl2`。

## 迁移判断

- 从 `ldapts` 迁移：通常是低风险，主要是替换包名并检查少量边界。
- 从 `ldapjs` 迁移：通常是中风险，主要工作是把 callback / 事件流改成 Promise / 聚合结果。

## 从 ldapts 迁移

### 基本改法

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

### 通常可直接沿用

- `new Client({ url, timeout, connectTimeout, tlsOptions, strictDN })`
- `bind()`
- `startTLS()`
- `search()`
- `searchPaginated()`
- `add()` / `modify()` / `del()` / `compare()` / `modifyDN()` / `exop()` / `unbind()`

### 需要检查

1. 不要再依赖 `ldapts` 私有内部 API：

```js
client._send(...)
client._socket
client.messageID
```

2. `using client = new Client(...)` 这类自动释放写法当前不要依赖，建议显式 `try/finally + unbind()`。

3. 复杂自定义控件需要联调验证。

## 从 ldapjs 迁移

### 核心区别

`ldapjs` 和 `ldap-native` 的主要差异不在包名，而在编程模型：

- `ldapjs` 偏 callback 和事件流
- `ldap-native` 偏 Promise 和聚合结果

### 常见替换

| `ldapjs` | `ldap-native` | 备注 |
|---------|---------------|------|
| `ldap.createClient(opts)` | `new ldap.Client(opts)` 或 `new Client(opts)` | 不再使用工厂函数 |
| `client.bind(dn, password, cb)` | `await client.bind(dn, password)` | Promise 化 |
| `client.starttls(opts, cb)` | `await client.startTLS(opts)` | 方法名大小写不同 |
| `client.search(base, opts, cb)` | `await client.search(base, opts)` | 返回聚合结果 |

### 参数差异

| `ldapjs` | `ldap-native` | 说明 |
|---------|---------------|------|
| `attrsOnly: true` | `returnAttributeValues: false` | 语义相反 |
| `attrsOnly: false` | `returnAttributeValues: true` | 语义相反 |
| `attributes: 'cn'` | `attributes: ['cn']` | 建议统一数组 |
| `url: ['ldap://a', 'ldap://b']` | `url: 'ldap://a'` | 多地址逻辑需业务层处理 |
| `reconnect` | 不支持 | 需业务层自管 |
| `idleTimeout` | 不支持 | 需业务层自管 |
| `socketPath` | 不支持 | 无对应 `ClientOptions` |
| `log` | 不支持 | 使用外围日志 |

### 搜索模型差异

`ldapjs` 常见是事件流：

```js
client.search(baseDN, opts, (err, res) => {
  res.on('searchEntry', (entry) => {
    console.log(entry.pojo || entry.object);
  });
});
```

迁移到 `ldap-native` 后更常见的是：

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

### 一个容易忽略的行为差异

- `ldapjs` `search()` 默认 `scope` 是 `base`
- `ldap-native` 默认 `scope` 是 `sub`

迁移时最好显式写出 `scope`，不要依赖旧默认值。

## 验证建议

至少验证以下内容：

- 简单 bind
- StartTLS
- 搜索与分页搜索
- 修改、删除、compare
- 二进制属性读取
- 认证失败和对象不存在等错误分支
- 如使用 GSSAPI，再单独验证 Kerberos 环境

## 结论

- `ldapts` 用户：重点是替换包名和检查边界。
- `ldapjs` 用户：重点是改 callback / 事件流模型，并补显式参数。

## 相关文档

- [README](../../README.md)
- [兼容性矩阵](../COMPATIBILITY.md)
- [架构说明](../ARCHITECTURE.md)
- [Kerberos / GSSAPI](../KERBEROS.md)
- [开发者简版迁移文档](./MIGRATION_TO_LDAP_NATIVE_ORIGINAL.md)
