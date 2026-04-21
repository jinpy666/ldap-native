'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const execPath = process.execPath;
const nodedir = process.env.npm_config_nodedir || path.resolve(execPath, '..', '..');
const args = ['node-gyp', 'rebuild', `--nodedir=${nodedir}`];
const env = { ...process.env };
// node-addon-api requires C++ exceptions and RTTI, but Node's common.gypi
// adds -fno-exceptions -fno-rtti which override binding.gyp's cflags_cc!.
// Force them back via CXXFLAGS on non-Windows platforms.
if (process.platform !== 'win32') {
  env.CXXFLAGS = [env.CXXFLAGS, '-fexceptions', '-frtti'].filter(Boolean).join(' ');
}
const result = spawnSync(/^win/.test(process.platform) ? 'npx.cmd' : 'npx', args, {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
  shell: false,
  env,
});

process.exit(result.status ?? 1);
