'use strict';

const { Client } = require('../index.cjs');

async function main() {
  const client = new Client({
    url: process.env.LDAP_URL || 'ldap://127.0.0.1:389',
  });
  try {
    await client.bind(process.env.LDAP_BIND_DN || 'cn=admin,dc=example,dc=com', process.env.LDAP_BIND_PASSWORD || 'admin');
    for await (const page of client.searchPaginated(process.env.LDAP_BASE_DN || 'dc=example,dc=com', {
      filter: '(objectClass=*)',
      attributes: ['cn', 'uid', 'mail'],
      paged: { pageSize: 25 },
    })) {
      console.log('page entries', page.searchEntries.length);
    }
  } finally {
    await client.unbind().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
