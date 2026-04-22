'use strict';

const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { formatInstallGuidance } = require('../src/install-guidance.cjs');
const { platformTriples, resolveNativePath } = require('../src/native-loader.cjs');

const root = path.resolve(__dirname, '..');

function log(message) {
  console.log(`ldap-native: ${message}`);
}

function error(message) {
  console.error(`ldap-native: ${message}`);
}

function shouldSkipInstall() {
  return process.env.LDAP_NATIVE_SKIP_INSTALL === '1' || process.env.LDAP_NATIVE_USE_MOCK === '1';
}

function shouldForceBuild() {
  const value = process.env.npm_config_build_from_source;
  return process.env.LDAP_NATIVE_FORCE_BUILD === '1' || value === '1' || value === 'true';
}

function describeCurrentPlatform() {
  return platformTriples().join(', ');
}

function tryLoadAddon(filename) {
  try {
    require(filename);
    return null;
  } catch (err) {
    return err;
  }
}

function isDynamicLinkFailure(err) {
  if (!err) return false;
  const message = String(err.message || '');
  return (
    err.code === 'ERR_DLOPEN_FAILED' ||
    message.includes('cannot open shared object file') ||
    message.includes('Library not loaded') ||
    message.includes('The specified module could not be found')
  );
}

function printGuidance(context, err) {
  error(context);
  if (err) {
    error(`Underlying error: ${err.message}`);
  }
  console.error(formatInstallGuidance({ includeGssapi: true }));
  console.error('See README.md for per-platform install details and GSSAPI notes.');
}

if (shouldSkipInstall()) {
  log('skipping native install because LDAP_NATIVE_SKIP_INSTALL=1 or LDAP_NATIVE_USE_MOCK=1');
  process.exit(0);
}

if (!shouldForceBuild()) {
  const nativePath = resolveNativePath();
  if (nativePath) {
    const loadError = tryLoadAddon(nativePath);
    if (!loadError) {
      log(`using native addon ${path.relative(root, nativePath)}`);
      process.exit(0);
    }

    if (isDynamicLinkFailure(loadError)) {
      printGuidance(`found ${path.relative(root, nativePath)} but could not load its native dependencies`, loadError);
      process.exit(1);
    }

    printGuidance(`found ${path.relative(root, nativePath)} but failed to load it`, loadError);
    process.exit(1);
  }
}

log(`no compatible prebuild found for ${describeCurrentPlatform()}; attempting source build`);
const result = spawnSync(process.execPath, [path.join(__dirname, 'build-native.cjs')], {
  cwd: root,
  stdio: 'inherit',
  shell: false,
  env: process.env,
});

if ((result.status ?? 1) === 0) {
  log('native addon built successfully');
  process.exit(0);
}

printGuidance('source build failed', result.error);
process.exit(result.status ?? 1);
