'use strict';

process.env.LDAP_NATIVE_USE_MOCK = '1';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  Attribute,
  Client,
  Control,
  EqualityFilter,
} = require('../../index.cjs');

test('Control accepts ldapts-style constructor arguments', () => {
  const control = new Control('1.2.840.113556.1.4.417', true, Buffer.from('value'));
  assert.equal(control.type, '1.2.840.113556.1.4.417');
  assert.equal(control.criticality, true);
  assert.equal(Buffer.isBuffer(control.value), true);
});

test('search with paged options aggregates all pages', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  const result = await client.search('dc=example,dc=com', {
    filter: new EqualityFilter({ attribute: 'objectClass', value: '*' }),
    paged: { pageSize: 1 },
    attributes: ['uid'],
  });
  assert.equal(result.searchEntries.length, 3);
  await client.unbind();
});

test('add accepts Attribute[] and compare accepts Buffer', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  const dn = 'uid=binary,ou=people,dc=example,dc=com';

  await client.add(dn, [
    new Attribute({ type: 'objectClass', values: ['inetOrgPerson'] }),
    new Attribute({ type: 'cn', values: ['Binary User'] }),
    new Attribute({ type: 'sn', values: ['User'] }),
    new Attribute({ type: 'uid', values: ['binary'] }),
    new Attribute({ type: 'jpegPhoto', values: [Buffer.from([0x01, 0x02, 0x03])] }),
  ]);

  const match = await client.compare(dn, 'jpegPhoto', Buffer.from([0x01, 0x02, 0x03]));
  assert.equal(match, true);
  await client.unbind();
});
