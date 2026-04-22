'use strict';

const { Client } = require('../index.cjs');

async function main() {
  const client = new Client({
    url: process.env.LDAP_URL || 'ldap://127.0.0.1:389',
    sasl: { mechanism: 'GSSAPI' },
  });
  try {
    if (process.env.LDAP_STARTTLS === '1') {
      await client.startTLS(process.env.LDAP_CA_FILE ? { caFile: process.env.LDAP_CA_FILE } : undefined);
    }
    await client.saslBind();
    const response = await client.exop('1.3.6.1.4.1.4203.1.11.3');
    console.log('whoami', Buffer.isBuffer(response.value) ? response.value.toString('utf8') : response.value);
  } finally {
    await client.unbind().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
