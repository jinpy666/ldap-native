'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const execPath = process.execPath;
const nodeGypCli = require.resolve('node-gyp/bin/node-gyp.js');
const nodedir = process.env.npm_config_nodedir || path.resolve(execPath, '..', '..');
const env = { ...process.env };
const isMsys2Windows = process.platform === 'win32' && Boolean(process.env.MSYSTEM);
if (isMsys2Windows) {
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
const cwd = path.resolve(__dirname, '..');

function runNodeGyp(args) {
  const result = spawnSync(execPath, [nodeGypCli, ...args], {
    stdio: 'inherit',
    cwd,
    shell: false,
    env,
  });

  if (result.error) {
    console.error(result.error);
  }

  return result;
}

if (isMsys2Windows) {
  const steps = [
    ['clean'],
    ['configure', `--nodedir=${nodedir}`, '--', '-f', 'make'],
    ['build'],
  ];

  for (const stepArgs of steps) {
    const result = runNodeGyp(stepArgs);
    if ((result.status ?? 1) !== 0) {
      process.exit(result.status ?? 1);
    }
  }

  process.exit(0);
}

const result = runNodeGyp(['rebuild', `--nodedir=${nodedir}`]);
process.exit(result.status ?? 1);
