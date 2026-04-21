'use strict';

const fs = require('node:fs');
const path = require('node:path');

function detectLibc() {
  if (process.platform !== 'linux') return '';
  const report = typeof process.report?.getReport === 'function' ? process.report.getReport() : null;
  if (report?.header?.glibcVersionRuntime) return 'gnu';
  return 'musl';
}

function projectRoots() {
  return [
    path.join(__dirname, '..'),
    path.join(__dirname, '..', '..'),
  ];
}

function platformTriples() {
  if (process.platform === 'linux') {
    return [`linux-${process.arch}-${detectLibc()}`, `linux-${process.arch}`];
  }
  return [`${process.platform}-${process.arch}`];
}

function resolveNativePath() {
  if (process.env.LDAP_NATIVE_NATIVE_PATH && fs.existsSync(process.env.LDAP_NATIVE_NATIVE_PATH)) {
    return process.env.LDAP_NATIVE_NATIVE_PATH;
  }

  const candidates = [];
  for (const root of projectRoots()) {
    candidates.push(path.join(root, 'build', 'Release', 'ldap_native.node'));
    candidates.push(path.join(root, 'build', 'Debug', 'ldap_native.node'));
    for (const triple of platformTriples()) {
      candidates.push(path.join(root, 'prebuilds', triple, 'ldap_native.node'));
      candidates.push(path.join(root, 'node_modules', `ldap-native-${triple}`, 'ldap_native.node'));
    }
  }

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function loadNative() {
  if (process.env.LDAP_NATIVE_USE_MOCK === '1') {
    return require('./mock-native.cjs');
  }

  const nativePath = resolveNativePath();
  if (!nativePath) {
    const err = new Error('Native addon not built. Run `npm run build` or set LDAP_NATIVE_USE_MOCK=1 for unit tests.');
    err.code = 'NATIVE_NOT_BUILT';
    throw err;
  }
  return require(nativePath);
}

module.exports = { loadNative, detectLibc, platformTriples, resolveNativePath };
