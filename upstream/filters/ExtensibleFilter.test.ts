import test from 'node:test';
import assert from 'node:assert/strict';
import { ExtensibleFilter } from '../../index.cjs';

test('upstream placeholder: ExtensibleFilter toString', () => {
  assert.equal(new ExtensibleFilter({ attribute: 'cn', value: 'a' }).toString(), '(cn:=a)');
});
