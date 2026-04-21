import assert from 'node:assert/strict';
import pkg from '../index.mjs';

assert.equal(typeof pkg.Client, 'function');
assert.equal(typeof pkg.Attribute, 'function');
assert.equal(typeof pkg.Change, 'function');
console.log('import.tests.mjs passed');
