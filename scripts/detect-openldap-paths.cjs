'use strict';

// Detect OpenLDAP include/lib paths for binding.gyp.
// Outputs one path per line; used via <!@(node scripts/detect-openldap-paths.cjs include)
const cp = require('child_process');
const path = require('path');
const type = process.argv[2]; // 'include' or 'lib'

if (process.platform === 'win32') {
  // msys2 UCRT64 paths
  try {
    const base = type === 'include' ? '/ucrt64/include' : '/ucrt64/lib';
    const winPath = cp.execSync(`cygpath -w ${base}`, { encoding: 'utf8' }).trim();
    console.log(winPath);
  } catch {}
} else if (process.platform === 'darwin') {
  try {
    const prefix = cp.execSync('brew --prefix openldap', { encoding: 'utf8' }).trim();
    console.log(type === 'include' ? `${prefix}/include` : `${prefix}/lib`);
  } catch {}
} else {
  // Linux: standard paths, nothing extra needed
}
