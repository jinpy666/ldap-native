import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '../index.cjs';

test('upstream placeholder: Client exists', async () => {
  const client = new Client({ url: 'ldap://127.0.0.1:389' });
  assert.equal(typeof client.bind, 'function');
  await client.unbind();
});
