import test from 'node:test';
import assert from 'node:assert/strict';
import { FilterParser } from '../index.cjs';

test('upstream placeholder: FilterParser parses equality filter', () => {
  const parser = new FilterParser();
  assert.equal(parser.parse('(cn=test)').toString(), '(cn=test)');
});
