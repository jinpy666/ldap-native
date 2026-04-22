'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('../../index.cjs');

const url = process.env.LDAP_URL;
const bindDN = process.env.LDAP_BIND_DN;
const bindPassword = process.env.LDAP_BIND_PASSWORD;
const baseDN = process.env.LDAP_BASE_DN;
const saslMechanism = process.env.LDAP_SASL_MECHANISM;
const saslUser = process.env.LDAP_SASL_USER;
const saslPassword = process.env.LDAP_SASL_PASSWORD;
const saslRealm = process.env.LDAP_SASL_REALM;
const saslProxyUser = process.env.LDAP_SASL_PROXY_USER;
const saslSecurityProperties = process.env.LDAP_SASL_SECURITY_PROPERTIES;

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
  const client = new Client({ url, sasl: { mechanism: 'GSSAPI' } });
  if (process.env.LDAP_STARTTLS === '1') {
    await client.startTLS(process.env.LDAP_CA_FILE ? { caFile: process.env.LDAP_CA_FILE } : undefined);
  }
  await client.saslBind();
  const whoami = await client.exop('1.3.6.1.4.1.4203.1.11.3');
  assert.equal(Buffer.isBuffer(whoami.value), true);
  await client.unbind();
});

test('integration: configurable SASL bind against real LDAP', {
  skip: !url || !saslMechanism,
}, async () => {
  const client = new Client({
    url,
    sasl: {
      mechanism: saslMechanism,
      user: saslUser,
      password: saslPassword,
      realm: saslRealm,
      proxyUser: saslProxyUser,
      securityProperties: saslSecurityProperties,
    },
  });
  if (process.env.LDAP_STARTTLS === '1') {
    await client.startTLS(process.env.LDAP_CA_FILE ? { caFile: process.env.LDAP_CA_FILE } : undefined);
  }
  await client.saslBind();
  await client.unbind();
});
