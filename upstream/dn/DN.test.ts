import test from 'node:test';
import assert from 'node:assert/strict';
import { DN } from '../../index.cjs';

test('upstream placeholder: DN parse/toString', () => {
  const dn = DN.parse('cn=test,dc=example,dc=com');
  assert.equal(dn.toString(), 'cn=test,dc=example,dc=com');
});
