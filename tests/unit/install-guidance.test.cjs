'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  formatInstallGuidance,
  getPlatformInstallGuidance,
  parseOsRelease,
} = require('../../src/install-guidance.cjs');

test('parseOsRelease extracts quoted values', async () => {
  const parsed = parseOsRelease('ID="ubuntu"\nID_LIKE="debian"\nNAME="Ubuntu"\n');
  assert.equal(parsed.ID, 'ubuntu');
  assert.equal(parsed.ID_LIKE, 'debian');
  assert.equal(parsed.NAME, 'Ubuntu');
});

test('guidance maps Debian-family Linux to apt packages', async () => {
  const guidance = getPlatformInstallGuidance({
    platform: 'linux',
    linux: { id: 'ubuntu', idLike: 'debian' },
  });
  assert.equal(guidance.label, 'Debian/Ubuntu');
  assert.match(guidance.commands[0], /apt-get install -y libldap-dev libsasl2-dev/);
});

test('guidance maps macOS to Homebrew instructions', async () => {
  const rendered = formatInstallGuidance({ platform: 'darwin' });
  assert.match(rendered, /brew install openldap cyrus-sasl/);
  assert.match(rendered, /CPPFLAGS/);
});

test('guidance maps Windows to MSVC source-build instructions', async () => {
  const rendered = formatInstallGuidance({ platform: 'win32' });
  assert.match(rendered, /Windows \(MSVC\)/);
  assert.match(rendered, /Developer PowerShell for Visual Studio 2022/);
  assert.match(rendered, /Wldap32 SDK/);
  assert.doesNotMatch(rendered, /MSYS2|mingw-w64-ucrt/i);
});
