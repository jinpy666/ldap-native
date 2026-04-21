import test from 'node:test';
import assert from 'node:assert/strict';
import { RDN } from '../../index.cjs';

test('upstream placeholder: RDN parse/toString', () => {
  const rdn = RDN.parse('cn=test');
  assert.equal(rdn.toString(), 'cn=test');
});
