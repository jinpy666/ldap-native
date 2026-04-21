'use strict';

// Detect OpenLDAP include/lib paths for binding.gyp.
// Outputs one Windows-format path per line (or nothing if not found).
const path = require('path');

const type = process.argv[2]; // 'include' or 'lib'

if (process.platform === 'win32') {
  // msys2 UCRT64 is always at <msys2_root>/ucrt64/
  // Find msys2 root from common locations
  const fs = require('fs');
  const candidates = [
    'D:\\a\\_temp\\msys64',      // GitHub Actions
    'C:\\msys64',                 // Default msys2 install
    path.join(process.env.LOCALAPPDATA || '', 'msys64'),
    path.join(process.env.MSYS2_ROOT || '', ''),
  ];
  for (const root of candidates) {
    if (!root) continue;
    const subdir = type === 'include' ? 'ucrt64\\include' : 'ucrt64\\lib';
    const full = path.join(root, subdir);
    if (fs.existsSync(full)) {
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
