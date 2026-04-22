'use strict';

const assert = require('node:assert/strict');
const pkg = require('../index.cjs');
const controls = require('ldap-native/controls');
const filters = require('ldap-native/filters');

assert.equal(typeof pkg.Client, 'function');
assert.equal(typeof pkg.Attribute, 'function');
assert.equal(typeof pkg.Change, 'function');
assert.equal(typeof pkg.PagedResultsControl, 'function');
assert.equal(typeof pkg.EqualityFilter, 'function');
assert.equal(typeof controls.Control, 'function');
assert.equal(typeof filters.EqualityFilter, 'function');
console.log('import.tests.cjs passed');
