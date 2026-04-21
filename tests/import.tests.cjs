'use strict';

const assert = require('node:assert/strict');
const pkg = require('../index.cjs');

assert.equal(typeof pkg.Client, 'function');
assert.equal(typeof pkg.Attribute, 'function');
assert.equal(typeof pkg.Change, 'function');
assert.equal(typeof pkg.PagedResultsControl, 'function');
assert.equal(typeof pkg.EqualityFilter, 'function');
console.log('import.tests.cjs passed');
