'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('../../index.cjs');

test('native smoke: client can be constructed', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  assert.equal(typeof client.bind, 'function');
  await client.unbind();
});
