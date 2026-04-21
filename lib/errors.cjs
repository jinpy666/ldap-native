'use strict';

class LDAPNativeError extends Error {
  constructor(message, code, details) {
    super(message);
    this.name = 'LDAPNativeError';
    this.code = code;
    this.details = details;
  }
}

module.exports = { LDAPNativeError };
