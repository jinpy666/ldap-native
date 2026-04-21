import test from 'node:test';
import assert from 'node:assert/strict';
import { OrFilter, EqualityFilter } from '../../index.cjs';

test('upstream placeholder: OrFilter toString', () => {
  assert.equal(new OrFilter({ filters: [new EqualityFilter({ attribute: 'cn', value: 'a' })] }).toString(), '(|(cn=a))');
});
