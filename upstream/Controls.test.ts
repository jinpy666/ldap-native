import test from 'node:test';
import assert from 'node:assert/strict';
import { PagedResultsControl } from '../index.cjs';

test('upstream placeholder: PagedResultsControl exists', () => {
  const control = new PagedResultsControl();
  assert.equal(typeof control.type, 'string');
});
