'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { StatusCodeParser } = require('../../index.cjs');

const statusMappings = [
  [1, 'OperationsError'],
  [2, 'ProtocolError'],
  [3, 'TimeLimitExceededError'],
  [4, 'SizeLimitExceededError'],
  [7, 'AuthMethodNotSupportedError'],
  [8, 'StrongAuthRequiredError'],
  [11, 'AdminLimitExceededError'],
  [12, 'UnavailableCriticalExtensionError'],
  [13, 'ConfidentialityRequiredError'],
  [14, 'SaslBindInProgressError'],
  [16, 'NoSuchAttributeError'],
  [17, 'UndefinedTypeError'],
  [18, 'InappropriateMatchingError'],
  [19, 'ConstraintViolationError'],
  [20, 'TypeOrValueExistsError'],
  [21, 'InvalidSyntaxError'],
  [32, 'NoSuchObjectError'],
  [33, 'AliasProblemError'],
  [34, 'InvalidDNSyntaxError'],
  [35, 'IsLeafError'],
  [36, 'AliasDerefProblemError'],
  [48, 'InappropriateAuthError'],
  [49, 'InvalidCredentialsError'],
  [50, 'InsufficientAccessError'],
  [51, 'BusyError'],
  [52, 'UnavailableError'],
  [53, 'UnwillingToPerformError'],
  [54, 'LoopDetectError'],
  [64, 'NamingViolationError'],
  [65, 'ObjectClassViolationError'],
  [66, 'NotAllowedOnNonLeafError'],
  [67, 'NotAllowedOnRDNError'],
  [68, 'AlreadyExistsError'],
  [69, 'NoObjectClassModsError'],
  [70, 'ResultsTooLargeError'],
  [71, 'AffectsMultipleDSAsError'],
  [95, 'MoreResultsToReturnError'],
  [112, 'TLSNotSupportedError'],
];

describe('StatusCodeParser', () => {
  it('returns NoResultError for no argument', () => {
    const err = StatusCodeParser.parse();
    assert.equal(err.name, 'NoResultError');
    assert.equal(err.code, 248);
  });

  for (const [code, name] of statusMappings) {
    it(`status ${code} → ${name}`, () => {
      const err = StatusCodeParser.parse({ status: code });
      assert.equal(err.name, name);
      assert.equal(err.code, code);
    });
  }

  it('unknown status code returns UnknownStatusCodeError', () => {
    const err = StatusCodeParser.parse({ status: 999 });
    assert.equal(err.name, 'UnknownStatusCodeError');
    assert.equal(err.code, 999);
  });

  it('passes errorMessage through', () => {
    const err = StatusCodeParser.parse({ status: 49, errorMessage: 'bad password' });
    assert.equal(err.message, 'bad password');
  });
});
