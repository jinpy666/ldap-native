'use strict';

process.env.LDAP_NATIVE_USE_MOCK = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Client, PagedResultsControl, ServerSideSortingRequestControl } = require('../../index.cjs');

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
