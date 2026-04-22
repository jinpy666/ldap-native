'use strict';

// Detect OpenLDAP include/lib paths for binding.gyp.
// Outputs one path per line. Uses forward slashes on Windows because
// gyp treats backslashes as escape characters in <!@(...) expansion.
const path = require('path');

const fs = require('fs');

const type = process.argv[2]; // 'include' | 'lib' | 'libs'

if (process.platform === 'darwin') {
  const cp = require('child_process');
  try {
    const prefix = cp.execSync('brew --prefix openldap', { encoding: 'utf8' }).trim();
    if (type === 'include') {
      console.log(`${prefix}/include`);
    } else if (type === 'lib') {
      console.log(`${prefix}/lib`);
    } else if (type === 'libs') {
      const candidates = ['libldap.dylib', 'liblber.dylib']
        .map((name) => path.join(prefix, 'lib', name))
        .filter((filename) => fs.existsSync(filename));
      if (candidates.length > 0) {
        console.log(candidates.join('\n'));
      }
    }
  } catch {}
}
// On Linux, system paths are found automatically by the compiler.
// On Windows, the addon links against the system Wldap32 SDK via MSVC, so no
// OpenLDAP include/lib discovery is needed here.
