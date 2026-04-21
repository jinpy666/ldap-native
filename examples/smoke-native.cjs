'use strict';

const assert = require('node:assert/strict');
const { Client } = require('../index.cjs');

const client = new Client({ url: 'ldap://127.0.0.1:389' });
assert.equal(typeof client.bind, 'function');
console.log('ldap-native smoke OK');
