import test from 'node:test';
import assert from 'node:assert/strict';
import { NotFilter, EqualityFilter } from '../../index.cjs';

test('upstream placeholder: NotFilter toString', () => {
  assert.equal(new NotFilter({ filter: new EqualityFilter({ attribute: 'cn', value: 'a' }) }).toString(), '(!(cn=a))');
});
