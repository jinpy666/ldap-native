'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('../../index.cjs');

function envFlag(name) {
  const value = process.env[name];
  return value === '1' || value?.toLowerCase() === 'true';
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required environment variable: ${name}`);
  }
  return value;
}

function shouldStartTLS(url) {
  if (process.env.LDAP_STARTTLS) {
    return envFlag('LDAP_STARTTLS');
  }
  return url.startsWith('ldap://');
}

function buildTlsOptions() {
  if (process.env.LDAP_REJECT_UNAUTHORIZED === '0' || process.env.LDAP_REJECT_UNAUTHORIZED === 'false') {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

function buildSaslOptions() {
  const sasl = { mechanism: 'GSSAPI' };
  const user = process.env.LDAP_GSSAPI_USER || process.env.LDAP_SASL_USER;
  const password = process.env.LDAP_GSSAPI_PASSWORD || process.env.LDAP_SASL_PASSWORD;
  const domain = process.env.LDAP_GSSAPI_DOMAIN || process.env.LDAP_SASL_DOMAIN;
  const realm = process.env.LDAP_GSSAPI_REALM || process.env.LDAP_SASL_REALM;

  if (user) sasl.user = user;
  if (password) sasl.password = password;
  if (domain) sasl.domain = domain;
  if (realm) sasl.realm = realm;

  return sasl;
}

function parseAttributes() {
  return (process.env.LDAP_ATTRIBUTES || 'dn,cn,mail')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

test('integration: Windows GSSAPI bind through Wldap32 SSPI/Negotiate', {
  skip: process.platform !== 'win32' || !envFlag('LDAP_GSSAPI_WINDOWS'),
}, async () => {
  const url = requireEnv('LDAP_URL');
  const baseDN = requireEnv('LDAP_BASE_DN');
  const sasl = buildSaslOptions();
  const client = new Client({
    url,
    connectTimeout: Number(process.env.LDAP_CONNECT_TIMEOUT || 10000),
    timeout: Number(process.env.LDAP_TIMEOUT || 10000),
    sasl,
    tlsOptions: buildTlsOptions(),
  });

  try {
    if (shouldStartTLS(url)) {
      await client.startTLS(client.options.tlsOptions);
    }

    await client.saslBind(sasl);

    const whoami = await client.exop('1.3.6.1.4.1.4203.1.11.3');
    assert.ok(whoami.value == null || Buffer.isBuffer(whoami.value));

    const result = await client.search(baseDN, {
      scope: process.env.LDAP_SCOPE || 'sub',
      filter: process.env.LDAP_FILTER || '(objectClass=*)',
      attributes: parseAttributes(),
      paged: { pageSize: Number(process.env.LDAP_PAGE_SIZE || 100) },
      sizeLimit: Number(process.env.LDAP_SIZE_LIMIT || 10),
    });
    assert.ok(Array.isArray(result.searchEntries));
  } finally {
    await client.unbind().catch(() => {});
  }
});
