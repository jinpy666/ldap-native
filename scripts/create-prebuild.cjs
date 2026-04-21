'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { platformTriples } = require('../lib/native-loader.cjs');

const root = path.resolve(__dirname, '..');
const builtAddon = path.join(root, 'build', 'Release', 'ldap_native.node');
if (!fs.existsSync(builtAddon)) {
  console.error('native addon not built yet');
  process.exit(1);
}

for (const triple of platformTriples()) {
  const outDir = path.join(root, 'prebuilds', triple);
  fs.mkdirSync(outDir, { recursive: true });
  fs.copyFileSync(builtAddon, path.join(outDir, 'ldap_native.node'));
  console.log(`prebuild staged: ${path.relative(root, outDir)}`);
}
