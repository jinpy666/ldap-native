import test from 'node:test';
import assert from 'node:assert/strict';
import { PostalAddress } from '../index.cjs';

test('upstream placeholder: PostalAddress roundtrip', () => {
  const value = PostalAddress.toString(['a','b']);
  assert.deepEqual(PostalAddress.fromString(value), ['a','b']);
});
