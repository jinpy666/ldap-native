'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { detectLibc, platformTriples } = require('../../lib/native-loader.cjs');

test('native loader exposes libc and platform triples helpers', async () => {
  assert.equal(typeof detectLibc(), 'string');
  assert.equal(Array.isArray(platformTriples()), true);
  assert.equal(platformTriples().length >= 1, true);
});
