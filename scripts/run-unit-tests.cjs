'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'tests', 'unit');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.test.cjs')).map((f) => path.join(dir, f));

if (files.length === 0) {
  console.error('No test files found in tests/unit/');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
  cwd: root,
  env: { ...process.env },
});

process.exit(result.status ?? 1);
