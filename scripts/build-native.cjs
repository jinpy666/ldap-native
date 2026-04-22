'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const execPath = process.execPath;
const nodeGypCli = require.resolve('node-gyp/bin/node-gyp.js');
const nodedir = process.env.npm_config_nodedir || path.resolve(execPath, '..', '..');
const env = { ...process.env };
// node-addon-api requires C++ exceptions and RTTI, but Node's common.gypi
// adds -fno-exceptions -fno-rtti which override binding.gyp's cflags_cc!.
// Force them back via CXXFLAGS on non-Windows platforms where common.gypi uses
// GCC/Clang-style flags. MSVC gets the equivalent switches from binding.gyp.
if (process.platform !== 'win32') {
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

const args = ['rebuild'];
if (process.platform !== 'win32') {
  args.push(`--nodedir=${nodedir}`);
}

const result = runNodeGyp(args);
process.exit(result.status ?? 1);
