'use strict';

function loadClient() {
  try {
    return require('ldap-native');
  } catch (_err) {
    return require('../index.cjs');
  }
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`missing required environment variable: ${name}`);
  }
  return value;
}

function parseAttributes() {
  return (process.env.LDAP_ATTRIBUTES || 'dn,cn,mail')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function shouldStartTLS(url) {
  if (process.env.LDAP_STARTTLS) {
    return process.env.LDAP_STARTTLS === '1' || process.env.LDAP_STARTTLS.toLowerCase() === 'true';
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
  const options = {
    mechanism: 'GSSAPI',
  };

  const user = process.env.LDAP_GSSAPI_USER || process.env.LDAP_SASL_USER;
  const password = process.env.LDAP_GSSAPI_PASSWORD || process.env.LDAP_SASL_PASSWORD;
  const domain = process.env.LDAP_GSSAPI_DOMAIN || process.env.LDAP_SASL_DOMAIN;
  const realm = process.env.LDAP_GSSAPI_REALM || process.env.LDAP_SASL_REALM;

  if (user) options.user = user;
  if (password) options.password = password;
  if (domain) options.domain = domain;
  if (realm) options.realm = realm;

  return options;
}

async function main() {
  if (process.platform !== 'win32') {
    throw new Error('examples/gssapi-windows.cjs must be run on Windows');
  }

  const { Client } = loadClient();
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
      console.log('[ldap] startTLS');
      await client.startTLS(client.options.tlsOptions);
    }

    console.log('[ldap] saslBind GSSAPI via Windows SSPI/Negotiate');
    await client.saslBind(sasl);

    const whoami = await client.exop('1.3.6.1.4.1.4203.1.11.3');
    const identity = Buffer.isBuffer(whoami.value) ? whoami.value.toString('utf8') : whoami.value;
    console.log(`[ldap] whoami: ${identity}`);

    const result = await client.search(baseDN, {
      scope: process.env.LDAP_SCOPE || 'sub',
      filter: process.env.LDAP_FILTER || '(objectClass=*)',
      attributes: parseAttributes(),
      paged: { pageSize: Number(process.env.LDAP_PAGE_SIZE || 100) },
      sizeLimit: Number(process.env.LDAP_SIZE_LIMIT || 10),
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
