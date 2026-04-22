'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const { Client } = require('../../index.cjs');

const ROOT = path.resolve(__dirname, '..', '..');

function getConfig() {
  if (process.env.LDAP_DOCKER === '1') {
    return {
      url: 'ldap://127.0.0.1:3890',
      ldapsUrl: 'ldaps://127.0.0.1:6360',
      bindDN: 'cn=admin,dc=example,dc=com',
      bindPassword: 'admin',
      baseDN: 'dc=example,dc=com',
      caFilePath: path.join(ROOT, 'docker', 'openldap', 'tls', 'ca.crt'),
      sasl: {
        mechanism: process.env.LDAP_SASL_MECHANISM || null,
        user: process.env.LDAP_SASL_USER || null,
        password: process.env.LDAP_SASL_PASSWORD || null,
        realm: process.env.LDAP_SASL_REALM || null,
        proxyUser: process.env.LDAP_SASL_PROXY_USER || null,
        securityProperties: process.env.LDAP_SASL_SECURITY_PROPERTIES || null,
      },
    };
  }
  return {
    url: process.env.LDAP_URL,
    ldapsUrl: process.env.LDAP_LDAPS_URL,
    bindDN: process.env.LDAP_BIND_DN,
    bindPassword: process.env.LDAP_BIND_PASSWORD,
    baseDN: process.env.LDAP_BASE_DN,
    caFilePath: process.env.LDAP_CA_FILE || null,
    sasl: {
      mechanism: process.env.LDAP_SASL_MECHANISM || null,
      user: process.env.LDAP_SASL_USER || null,
      password: process.env.LDAP_SASL_PASSWORD || null,
      realm: process.env.LDAP_SASL_REALM || null,
      proxyUser: process.env.LDAP_SASL_PROXY_USER || null,
      securityProperties: process.env.LDAP_SASL_SECURITY_PROPERTIES || null,
    },
  };
}

function createClient(options = {}) {
  const config = getConfig();
  return new Client({
    url: options.url || config.url,
    connectTimeout: options.connectTimeout ?? 5000,
    timeout: options.timeout ?? 5000,
    strictDN: options.strictDN ?? false,
  });
}

function uniqueDN(prefix, parent) {
  const suffix = crypto.randomBytes(4).toString('hex');
  return `cn=${prefix}-${suffix},${parent}`;
}

module.exports = { getConfig, createClient, uniqueDN };
