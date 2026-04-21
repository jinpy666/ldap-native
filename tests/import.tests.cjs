'use strict';

const assert = require('node:assert/strict');
const pkg = require('../index.cjs');
const controls = require('../lib/controls.cjs');
const filters = require('../lib/filters.cjs');

assert.equal(typeof pkg.Client, 'function');
assert.equal(typeof pkg.Attribute, 'function');
assert.equal(typeof pkg.Change, 'function');
assert.equal(typeof controls.PagedResultsControl, 'function');
assert.equal(typeof filters.EqualityFilter, 'function');
console.log('import.tests.cjs passed');
