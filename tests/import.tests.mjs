import assert from 'node:assert/strict';
import pkg from '../index.mjs';
import { Control } from 'ldap-native/controls';

assert.equal(typeof pkg.Client, 'function');
assert.equal(typeof pkg.Attribute, 'function');
assert.equal(typeof pkg.Change, 'function');
assert.equal(typeof Control, 'function');
console.log('import.tests.mjs passed');
