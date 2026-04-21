'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const pkg = require('../../index.cjs');

test('root API exports expected symbols', async () => {
  assert.equal(typeof pkg.Client, 'function');
  assert.equal(typeof pkg.Attribute, 'function');
  assert.equal(typeof pkg.Change, 'function');
  assert.equal(typeof pkg.PagedResultsControl, 'function');
  assert.equal(typeof pkg.EqualityFilter, 'function');
  assert.equal(typeof pkg.DN, 'function');
});
