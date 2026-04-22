'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const execPath = process.execPath;
const nodedir = process.env.npm_config_nodedir || path.resolve(execPath, '..', '..');
const env = { ...process.env };
const isMsys2Windows = process.platform === 'win32' && Boolean(process.env.MSYSTEM);
const args = ['node-gyp', 'rebuild', `--nodedir=${nodedir}`];
if (isMsys2Windows) {
  args.push('--format=make');
  env.CC = env.CC || 'gcc';
  env.CXX = env.CXX || 'g++';
  env.MAKE = env.MAKE || 'make';
}
// node-addon-api requires C++ exceptions and RTTI, but Node's common.gypi
// adds -fno-exceptions -fno-rtti which override binding.gyp's cflags_cc!.
// Force them back via CXXFLAGS on non-Windows platforms and MSYS2/make builds.
if (process.platform !== 'win32' || isMsys2Windows) {
  env.CXXFLAGS = [env.CXXFLAGS, '-fexceptions', '-frtti'].filter(Boolean).join(' ');
}
const result = spawnSync(/^win/.test(process.platform) ? 'npx.cmd' : 'npx', args, {
  stdio: 'inherit',
  cwd: path.resolve(__dirname, '..'),
  shell: false,
  env,
});

process.exit(result.status ?? 1);
