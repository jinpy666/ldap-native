'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const [major] = process.versions.node.split('.').map(Number);
if (major < 22) {
  console.log('Skipping upstream tests: --experimental-strip-types requires Node >= 22');
  process.exit(0);
}

const root = path.resolve(__dirname, '..');
const tests = [
  'upstream/Controls.test.ts',
  'upstream/FilterParser.test.ts',
  'upstream/PostalAddress.test.ts',
  'upstream/ber/BerReader.test.ts',
  'upstream/ber/BerWriter.test.ts',
  'upstream/dn/DN.test.ts',
  'upstream/dn/RDN.test.ts',
  'upstream/filters/EqualityFilter.test.ts',
  'upstream/filters/ExtensibleFilter.test.ts',
  'upstream/filters/NotFilter.test.ts',
  'upstream/filters/OrFilter.test.ts',
];

const env = { ...process.env, LDAP_NATIVE_USE_MOCK: process.env.LDAP_NATIVE_USE_MOCK || '1' };
const args = ['--experimental-strip-types', '--test', ...tests.map((testFile) => path.join(root, testFile))];
const result = spawnSync(process.execPath, args, { stdio: 'inherit', env });
process.exit(result.status ?? 1);
