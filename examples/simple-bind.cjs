'use strict';

const { Client } = require('../index.cjs');

async function main() {
  const client = new Client({
    url: process.env.LDAP_URL || 'ldap://127.0.0.1:389',
    connectTimeout: 5000,
    timeout: 5000,
  });
  try {
    if (process.env.LDAP_STARTTLS === '1') {
      await client.startTLS(process.env.LDAP_CA_FILE ? { caFile: process.env.LDAP_CA_FILE } : undefined);
    }
    await client.bind(process.env.LDAP_BIND_DN || 'cn=admin,dc=example,dc=com', process.env.LDAP_BIND_PASSWORD || 'admin');
    const result = await client.search(process.env.LDAP_BASE_DN || 'dc=example,dc=com', {
      filter: '(objectClass=*)',
      attributes: ['cn', 'uid', 'mail'],
      paged: { pageSize: 50 },
    });
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await client.unbind().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
