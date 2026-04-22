'use strict';

const fs = require('node:fs');

function parseOsRelease(text) {
  const values = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const equals = line.indexOf('=');
    if (equals === -1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function detectLinuxDistro() {
  if (fs.existsSync('/etc/alpine-release')) {
    return { id: 'alpine', idLike: '' };
  }

  try {
    const parsed = parseOsRelease(fs.readFileSync('/etc/os-release', 'utf8'));
    return {
      id: (parsed.ID || '').toLowerCase(),
      idLike: (parsed.ID_LIKE || '').toLowerCase(),
    };
  } catch {
    return { id: '', idLike: '' };
  }
}

function matchesDistro(details, names) {
  const fields = [details.id, details.idLike].filter(Boolean);
  return fields.some((field) => names.some((name) => field.split(/\s+/).includes(name)));
}

function getPlatformInstallGuidance(options = {}) {
  const platform = options.platform || process.platform;
  const linux = options.linux || (platform === 'linux' ? detectLinuxDistro() : { id: '', idLike: '' });

  if (platform === 'darwin') {
    return {
      label: 'macOS',
      commands: [
        'brew install openldap cyrus-sasl',
        'export CPPFLAGS="-I$(brew --prefix openldap)/include"',
        'export LDFLAGS="-L$(brew --prefix openldap)/lib"',
      ],
      notes: [
        'Homebrew openldap is keg-only, so headers and libraries may need explicit CPPFLAGS/LDFLAGS.',
      ],
    };
  }

  if (platform === 'win32') {
    return {
      label: 'Windows (MSVC)',
      commands: [
        'npm install',
      ],
      notes: [
        'Run source builds from Developer PowerShell for Visual Studio 2022, or install the Visual Studio Build Tools workload that provides cl.exe, MSBuild, and the Windows SDK.',
        'The Windows backend links against the system Wldap32 SDK, so no separate OpenLDAP or Cyrus SASL development packages are required for source builds.',
      ],
    };
  }

  if (platform === 'linux' && matchesDistro(linux, ['alpine'])) {
    return {
      label: 'Alpine',
      commands: [
        'apk add --no-cache openldap-dev cyrus-sasl-dev build-base python3',
      ],
      notes: [],
    };
  }

  if (platform === 'linux' && matchesDistro(linux, ['debian', 'ubuntu'])) {
    return {
      label: 'Debian/Ubuntu',
      commands: [
        'apt-get update && apt-get install -y libldap-dev libsasl2-dev python3 make g++',
      ],
      notes: [
        'If you only need runtime libraries for a prebuilt addon, the distro-specific libldap/libsasl runtime packages may be enough.',
      ],
    };
  }

  if (platform === 'linux' && matchesDistro(linux, ['rhel', 'fedora', 'centos', 'rocky', 'almalinux'])) {
    return {
      label: 'Fedora/RHEL/CentOS',
      commands: [
        'dnf install -y openldap-devel cyrus-sasl-devel python3 make gcc-c++',
      ],
      notes: [],
    };
  }

  if (platform === 'linux') {
    return {
      label: 'Linux',
      commands: [
        'Install the OpenLDAP and Cyrus SASL development packages for your distribution, plus Python 3 and a C/C++ toolchain.',
      ],
      notes: [],
    };
  }

  return {
    label: platform,
    commands: [
      'Install OpenLDAP client libraries, Cyrus SASL, Python 3, and a C/C++ toolchain for your platform.',
    ],
    notes: [],
  };
}

function formatInstallGuidance(options = {}) {
  const guidance = getPlatformInstallGuidance(options);
  const platform = options.platform || process.platform;
  const lines = [
    `ldap-native install guidance for ${guidance.label}:`,
    ...guidance.commands.map((command) => `  ${command}`),
  ];

  if (options.includeGssapi) {
    if (platform === 'win32') {
      lines.push('GSSAPI note: Windows uses the system security stack, so bind(\'GSSAPI\') depends on the machine or user Kerberos / integrated-auth configuration.');
    } else {
      lines.push('GSSAPI note: install the SASL GSSAPI plugin and a Kerberos client configuration if you use bind(\'GSSAPI\').');
    }
  }

  for (const note of guidance.notes) {
    lines.push(`Note: ${note}`);
  }

  return lines.join('\n');
}

module.exports = {
  detectLinuxDistro,
  formatInstallGuidance,
  getPlatformInstallGuidance,
  parseOsRelease,
};
