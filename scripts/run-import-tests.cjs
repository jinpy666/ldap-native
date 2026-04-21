'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const files = [
  path.join(root, 'tests', 'import.tests.cjs'),
  path.join(root, 'tests', 'import.tests.mjs'),
];

for (const file of files) {
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
