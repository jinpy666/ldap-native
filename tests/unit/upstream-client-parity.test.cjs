'use strict';

process.env.LDAP_NATIVE_USE_MOCK = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Client, PagedResultsControl } = require('../../index.cjs');

test('upstream parity: constructor keeps option values', async () => {
  const client = new Client({
    url: 'ldap:///dc=example,dc=com',
    timeout: 1234,
    connectTimeout: 5678,
    strictDN: false,
  });
  assert.equal(client.options.timeout, 1234);
  assert.equal(client.options.connectTimeout, 5678);
  assert.equal(client.options.strictDN, false);
  await client.unbind();
});

test('upstream parity: bind with DN + password resolves', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  await client.bind('cn=admin,dc=example,dc=com', 'secret');
  await client.unbind();
});

test('upstream parity: bind with EXTERNAL mechanism resolves', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  await client.bind('EXTERNAL');
  await client.unbind();
});

test('upstream parity: saslBind with default credentials resolves', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389', sasl: { mechanism: 'GSSAPI' } });
  await client.saslBind();
  await client.unbind();
});

test('upstream parity: saslBind accepts explicit SASL options object', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  await client.saslBind({
    mechanism: 'PLAIN',
    user: 'test_user',
    password: 'secret',
  });
  await client.unbind();
});

test('upstream parity: search returns searchEntries/searchReferences shape', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  const result = await client.search('dc=example,dc=com', {
    scope: 'sub',
    filter: '(objectClass=*)',
    attributes: ['cn'],
  });
  assert.equal(Array.isArray(result.searchEntries), true);
  assert.equal(Array.isArray(result.searchReferences), true);
  await client.unbind();
});

test('upstream parity: searchPaginated produces iterable pages', async () => {
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

test('upstream parity: explicit paged control still reaches search path', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  const result = await client.search('dc=example,dc=com', {
    filter: '(objectClass=*)',
    attributes: ['cn'],
  }, [new PagedResultsControl({ value: { size: 5, cookie: Buffer.alloc(0) } })]);
  assert.equal(Array.isArray(result.searchEntries), true);
  await client.unbind();
});
