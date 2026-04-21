'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'lib'), { recursive: true });

for (const file of ['index.cjs', 'index.mjs', 'index.d.ts']) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}
fs.copyFileSync(path.join(root, 'index.d.ts'), path.join(dist, 'index.d.cts'));

copyDir(path.join(root, 'lib'), path.join(dist, 'lib'));
copyDir(path.join(root, 'compat-cjs'), path.join(dist, 'compat-cjs'));

console.log(`dist written to ${dist}`);
