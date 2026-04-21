'use strict';

// Detect OpenLDAP include/lib paths for binding.gyp.
// Outputs one path per line. Uses forward slashes on Windows because
// gyp treats backslashes as escape characters in <!@(...) expansion.
const path = require('path');

const type = process.argv[2]; // 'include' or 'lib'

if (process.platform === 'darwin') {
  const cp = require('child_process');
  try {
    const prefix = cp.execSync('brew --prefix openldap', { encoding: 'utf8' }).trim();
    console.log(type === 'include' ? `${prefix}/include` : `${prefix}/lib`);
  } catch {}
}
// On Linux and Windows, system paths are found automatically by the compiler.
// msys2 UCRT64 headers conflict with MSVC, so we don't add them here.
