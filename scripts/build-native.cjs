'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const execPath = process.execPath;
const nodedir = process.env.npm_config_nodedir || path.resolve(execPath, '..', '..');
const args = ['node-gyp', 'rebuild', `--nodedir=${nodedir}`];
const result = spawnSync(/^win/.test(process.platform) ? 'npx.cmd' : 'npx', args, {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
  shell: false,
});

process.exit(result.status ?? 1);
