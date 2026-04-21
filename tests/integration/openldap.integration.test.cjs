'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('../../index.cjs');

const url = process.env.LDAP_URL;
const bindDN = process.env.LDAP_BIND_DN;
const bindPassword = process.env.LDAP_BIND_PASSWORD;
const baseDN = process.env.LDAP_BASE_DN;

test('integration: simple bind + search against real OpenLDAP', { skip: !url || !bindDN || !bindPassword || !baseDN }, async () => {
  const client = new Client({
    url,
    connectTimeout: Number(process.env.LDAP_CONNECT_TIMEOUT || 5000),
    timeout: Number(process.env.LDAP_TIMEOUT || 5000),
    tlsOptions: process.env.LDAP_CA_FILE ? { caFile: process.env.LDAP_CA_FILE } : undefined,
  });

  if (process.env.LDAP_STARTTLS === '1') {
    await client.startTLS(client.options.tlsOptions);
  }
  await client.bind(bindDN, bindPassword);
  const result = await client.search(baseDN, {
    filter: process.env.LDAP_TEST_FILTER || '(objectClass=*)',
    attributes: ['cn', 'uid', 'mail'],
    paged: { pageSize: 50 },
  });
  assert.equal(Array.isArray(result.searchEntries), true);
  await client.unbind();
});

test('integration: GSSAPI bind against real OpenLDAP', { skip: !url || process.env.LDAP_GSSAPI !== '1' }, async () => {
  const client = new Client({ url });
  if (process.env.LDAP_STARTTLS === '1') {
    await client.startTLS(process.env.LDAP_CA_FILE ? { caFile: process.env.LDAP_CA_FILE } : undefined);
  }
  await client.bind('GSSAPI');
  const whoami = await client.exop('1.3.6.1.4.1.4203.1.11.3');
  assert.equal(Buffer.isBuffer(whoami.value), true);
  await client.unbind();
});
