'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const dockerEnv = {
  ...process.env,
  LDAP_DOCKER: '1',
  LDAP_URL: 'ldap://127.0.0.1:3890',
  LDAP_LDAPS_URL: 'ldaps://127.0.0.1:6360',
  LDAP_BIND_DN: 'cn=admin,dc=example,dc=com',
  LDAP_BIND_PASSWORD: 'admin',
  LDAP_BASE_DN: 'dc=example,dc=com',
  LDAP_CA_FILE: path.join(root, 'docker', 'openldap', 'tls', 'ca.crt'),
};

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    cwd: root,
    env,
  });
  return result.status ?? 1;
}

let exitCode = 0;

try {
  exitCode = run('bash', ['docker/openldap/tls/generate-certs.sh']);
  if (exitCode !== 0) throw new Error('generate-certs failed');

  exitCode = run('docker', ['compose', 'up', '-d', '--wait']);
  if (exitCode !== 0) throw new Error('docker compose up failed');

  exitCode = run(process.execPath, [path.join(root, 'scripts', 'run-integration-tests.cjs')], dockerEnv);
} finally {
  if (process.env.LDAP_DOCKER_KEEP_RUNNING !== '1') {
    const downStatus = run('docker', ['compose', 'down', '-v']);
    if (exitCode === 0 && downStatus !== 0) {
      exitCode = downStatus;
    }
  }
}

process.exit(exitCode);
