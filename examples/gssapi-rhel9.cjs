'use strict';

const { spawnSync } = require('node:child_process');

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

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    ...options,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    const stderr = result.stderr ? `\n${result.stderr.trim()}` : '';
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}${stderr}`);
  }
  return result;
}

function acquireKerberosTicket() {
  const principal = process.env.KRB5_PRINCIPAL;
  const keytab = process.env.KRB5_KEYTAB;
  const password = process.env.KRB5_PASSWORD;

  if (principal && keytab) {
    console.log(`[kerberos] kinit with keytab for ${principal}`);
    run('kinit', ['-kt', keytab, principal], { stdio: 'inherit' });
    return;
  }

  if (principal && password) {
    console.log(`[kerberos] kinit with password for ${principal}`);
    run('kinit', [principal], {
      input: `${password}\n`,
      stdio: ['pipe', 'inherit', 'pipe'],
    });
    return;
  }

  console.log('[kerberos] no KRB5_PASSWORD or KRB5_KEYTAB provided; reusing existing ticket cache');
}

function printTicketCache() {
  const result = spawnSync('klist', [], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status === 0) {
    console.log(result.stdout.trim());
    return;
  }

  const stderr = result.stderr ? result.stderr.trim() : 'klist failed';
  throw new Error(`Kerberos ticket cache is not usable: ${stderr}`);
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

async function main() {
  const { Client } = loadClient();
  const url = requireEnv('LDAP_URL');
  const baseDN = requireEnv('LDAP_BASE_DN');
  const tlsOptions = process.env.LDAP_CA_FILE ? { caFile: process.env.LDAP_CA_FILE } : undefined;

  acquireKerberosTicket();
  printTicketCache();

  const client = new Client({
    url,
    connectTimeout: Number(process.env.LDAP_CONNECT_TIMEOUT || 10000),
    timeout: Number(process.env.LDAP_TIMEOUT || 10000),
    sasl: {
      mechanism: 'GSSAPI',
      realm: process.env.LDAP_SASL_REALM,
      proxyUser: process.env.LDAP_SASL_AUTHZID,
      securityProperties: process.env.LDAP_SASL_SECPROPS,
    },
    tlsOptions,
  });

  try {
    if (shouldStartTLS(url)) {
      console.log('[ldap] startTLS');
      await client.startTLS(client.options.tlsOptions);
    }

    console.log('[ldap] saslBind GSSAPI');
    await client.saslBind({ mechanism: 'GSSAPI' });

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
