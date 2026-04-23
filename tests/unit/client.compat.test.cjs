'use strict';

process.env.LDAP_NATIVE_USE_MOCK = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Client, PagedResultsControl, ServerSideSortingRequestControl } = require('../../index.cjs');
const mockNative = require('../../src/mock-native.cjs');

async function withPlatform(platform, fn) {
  const descriptor = Object.getOwnPropertyDescriptor(process, 'platform');
  Object.defineProperty(process, 'platform', {
    ...descriptor,
    value: platform,
  });
  try {
    return await fn();
  } finally {
    Object.defineProperty(process, 'platform', descriptor);
  }
}

test('Client simple bind + search + unbind', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  await client.bind('cn=admin,dc=example,dc=com', 'secret');
  const result = await client.search('dc=example,dc=com', {
    filter: '(uid=jdoe)',
    attributes: ['cn', 'uid', 'mail'],
  });
  assert.equal(Array.isArray(result.searchEntries), true);
  assert.equal(result.searchEntries.length > 0, true);
  await client.unbind();
  assert.equal(client.isConnected, false);
});

test('Client SASL bind supports GSSAPI entry point', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389', sasl: { mechanism: 'GSSAPI' } });
  await client.bind('GSSAPI');
  const whoami = await client.exop('1.3.6.1.4.1.4203.1.11.3');
  assert.equal(Buffer.isBuffer(whoami.value), true);
  await client.unbind();
});

test('Client saslBind forwards interactive SASL defaults', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  await client.saslBind({
    mechanism: 'PLAIN',
    user: 'test_user',
    password: 'secret',
    realm: 'EXAMPLE.COM',
    proxyUser: 'u:test_admin',
    securityProperties: 'none',
  });
  const state = mockNative.__getState(client.nativeHandle);
  assert.deepEqual(state.bind, {
    type: 'sasl',
    mechanism: 'PLAIN',
    user: 'test_user',
    password: 'secret',
    realm: 'EXAMPLE.COM',
    proxyUser: 'u:test_admin',
    securityProperties: 'none',
    controls: [],
  });
  await client.unbind();
});

test('Client saslBind accepts napi-ldap style aliases', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  await client.saslBind({
    mechanism: 'PLAIN',
    user: 'alias_user',
    password: 'alias_secret',
    proxyuser: 'u:alias_proxy',
    securityproperties: 'minssf=0,maxssf=0',
  });
  const state = mockNative.__getState(client.nativeHandle);
  assert.deepEqual(state.bind, {
    type: 'sasl',
    mechanism: 'PLAIN',
    user: 'alias_user',
    password: 'alias_secret',
    proxyUser: 'u:alias_proxy',
    securityProperties: 'minssf=0,maxssf=0',
    controls: [],
  });
  await client.unbind();
});

test('Client forwards Windows GSSAPI domain credentials', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  await client.saslBind({
    mechanism: 'GSSAPI',
    user: 'svc_ldap',
    password: 'secret',
    domain: 'EXAMPLE',
  });
  const state = mockNative.__getState(client.nativeHandle);
  assert.deepEqual(state.bind, {
    type: 'sasl',
    mechanism: 'GSSAPI',
    user: 'svc_ldap',
    password: 'secret',
    domain: 'EXAMPLE',
    controls: [],
  });
  await client.unbind();
});

test('Client prepares parsed Windows LDAP connection options', async () => {
  await withPlatform('win32', async () => {
    const client = new Client({ url: 'ldaps://dc01.example.com' });
    const state = mockNative.__getState(client.nativeHandle);
    assert.equal(state.options.host, 'dc01.example.com');
    assert.equal(state.options.port, 636);
    assert.equal(state.options.secure, true);
    await client.unbind();
  });
});

test('Client bind shorthand reuses configured SASL defaults', async () => {
  const client = new Client({
    url: 'ldap://127.0.0.1:389',
    sasl: {
      mechanism: 'GSSAPI',
      user: 'svc_ldap',
      realm: 'EXAMPLE.COM',
      proxyUser: 'u:svc_proxy',
    },
  });
  await client.bind('GSSAPI');
  const state = mockNative.__getState(client.nativeHandle);
  assert.deepEqual(state.bind, {
    type: 'sasl',
    mechanism: 'GSSAPI',
    user: 'svc_ldap',
    realm: 'EXAMPLE.COM',
    proxyUser: 'u:svc_proxy',
    controls: [],
  });
  await client.unbind();
});

test('Client startTLS accepts tls options', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  await client.startTLS({ ca: [Buffer.from('dummy-ca')] });
  await client.unbind();
});

test('Client searchPaginated yields multiple pages', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  const pages = [];
  for await (const page of client.searchPaginated('dc=example,dc=com', {
    filter: '(objectClass=*)',
    paged: { pageSize: 1 },
  })) {
    pages.push(page);
  }
  assert.equal(pages.length >= 1, true);
  await client.unbind();
});

test('Client search can flatten explicitly selected single-value attributes', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  const result = await client.search('dc=example,dc=com', {
    filter: '(uid=jdoe)',
    attributes: ['cn', 'uid', 'mail'],
    singleValueAttributes: ['cn', 'uid'],
  });

  const entry = result.searchEntries[0];
  assert.equal(entry.cn, 'John Doe');
  assert.equal(entry.uid, 'jdoe');
  assert.deepEqual(entry.mail, ['jdoe@example.com']);
  await client.unbind();
});

test('Client search can heuristically flatten all single-element attribute arrays', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  const result = await client.search('dc=example,dc=com', {
    filter: '(uid=jdoe)',
    singleValueAttributes: true,
  });

  const entry = result.searchEntries[0];
  assert.equal(entry.cn, 'John Doe');
  assert.equal(entry.uid, 'jdoe');
  assert.equal(entry.mail, 'jdoe@example.com');
  assert.equal(Buffer.isBuffer(entry.jpegPhoto), true);
  await client.unbind();
});

test('Client searchPaginated applies single-value attribute flattening to each page', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  const pages = [];
  for await (const page of client.searchPaginated('dc=example,dc=com', {
    filter: '(objectClass=*)',
    paged: { pageSize: 1 },
    singleValueAttributes: ['mail'],
  })) {
    pages.push(page);
  }

  assert.equal(typeof pages[0].searchEntries[0].mail, 'string');
  assert.deepEqual(pages[0].searchEntries[0].cn, ['John Doe']);
  await client.unbind();
});

test('Client search can trim selected string attribute values after flattening', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  const result = await client.search('dc=example,dc=com', {
    filter: '(uid=jdoe)',
    singleValueAttributes: ['displayName'],
    trimAttributeValues: ['displayName', 'entryLabel'],
  });

  const entry = result.searchEntries[0];
  assert.equal(entry.displayName, 'John Doe');
  assert.equal(entry.entryLabel, 'Primary User');
  assert.deepEqual(entry.memberOf, [
    ' cn=dev,ou=groups,dc=example,dc=com ',
    ' cn=ops,ou=groups,dc=example,dc=com ',
  ]);
  await client.unbind();
});

test('Client search can trim every returned string without mutating Buffers', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  const result = await client.search('dc=example,dc=com', {
    filter: '(uid=jdoe)',
    singleValueAttributes: true,
    trimAttributeValues: true,
  });

  const entry = result.searchEntries[0];
  assert.equal(entry.displayName, 'John Doe');
  assert.equal(entry.entryLabel, 'Primary User');
  assert.deepEqual(entry.memberOf, [
    'cn=dev,ou=groups,dc=example,dc=com',
    'cn=ops,ou=groups,dc=example,dc=com',
  ]);
  assert.equal(Buffer.isBuffer(entry.jpegPhoto), true);
  await client.unbind();
});

test('Client encodes controls for high-value compatibility cases', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  const controls = [
    new PagedResultsControl({ value: { size: 10, cookie: Buffer.alloc(0) } }),
    new ServerSideSortingRequestControl({ value: [{ attributeType: 'cn' }] }),
  ];
  const result = await client.search('dc=example,dc=com', {
    filter: '(objectClass=*)',
    attributes: ['cn'],
  }, controls);
  assert.equal(Array.isArray(result.searchEntries), true);
  await client.unbind();
});
