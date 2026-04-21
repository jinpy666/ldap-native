import test from 'node:test';
import assert from 'node:assert/strict';
import { EqualityFilter } from '../../index.cjs';

test('upstream placeholder: EqualityFilter toString', () => {
  assert.equal(new EqualityFilter({ attribute: 'cn', value: 'a' }).toString(), '(cn=a)');
});
