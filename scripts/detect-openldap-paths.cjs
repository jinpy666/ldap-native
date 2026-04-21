'use strict';

// Detect OpenLDAP include/lib paths for binding.gyp.
// Outputs one path per line. Uses forward slashes on Windows because
// gyp treats backslashes as escape characters in <!@(...) expansion.
const path = require('path');

const type = process.argv[2]; // 'include' or 'lib'

if (process.platform === 'win32') {
  const fs = require('fs');
  const candidates = [
    'D:/a/_temp/msys64',      // GitHub Actions
    'C:/msys64',               // Default msys2 install
    (process.env.LOCALAPPDATA || '').replace(/\\/g, '/') + '/msys64',
    (process.env.MSYS2_ROOT || '').replace(/\\/g, '/'),
  ];
  for (const root of candidates) {
    if (!root) continue;
    const subdir = type === 'include' ? 'ucrt64/include' : 'ucrt64/lib';
    const full = root + '/' + subdir;
    // Check with native path for existsSync
    const nativePath = full.replace(/\//g, '\\');
    if (fs.existsSync(nativePath)) {
      // Output with forward slashes — gyp/MSBuild accept them
      console.log(full);
      break;
    }
  }
} else if (process.platform === 'darwin') {
  const cp = require('child_process');
  try {
    const prefix = cp.execSync('brew --prefix openldap', { encoding: 'utf8' }).trim();
    console.log(type === 'include' ? `${prefix}/include` : `${prefix}/lib`);
  } catch {}
} else {
  // Linux: standard system paths, nothing extra needed
}
