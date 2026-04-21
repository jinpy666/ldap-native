'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  ResultCodeError,
  MessageParserError,
  OperationsError,
  ProtocolError,
  TimeLimitExceededError,
  SizeLimitExceededError,
  AuthMethodNotSupportedError,
  StrongAuthRequiredError,
  AdminLimitExceededError,
  UnavailableCriticalExtensionError,
  ConfidentialityRequiredError,
  SaslBindInProgressError,
  NoSuchAttributeError,
  UndefinedTypeError,
  InappropriateMatchingError,
  ConstraintViolationError,
  TypeOrValueExistsError,
  InvalidSyntaxError,
  NoSuchObjectError,
  AliasProblemError,
  InvalidDNSyntaxError,
  IsLeafError,
  AliasDerefProblemError,
  InappropriateAuthError,
  InvalidCredentialsError,
  InsufficientAccessError,
  BusyError,
  UnavailableError,
  UnwillingToPerformError,
  LoopDetectError,
  NamingViolationError,
  ObjectClassViolationError,
  NotAllowedOnNonLeafError,
  NotAllowedOnRDNError,
  AlreadyExistsError,
  NoObjectClassModsError,
  ResultsTooLargeError,
  AffectsMultipleDSAsError,
  MoreResultsToReturnError,
  TLSNotSupportedError,
  NoResultError,
  UnknownStatusCodeError,
} = require('../../index.cjs');

const errorClasses = [
  [OperationsError, 1],
  [ProtocolError, 2],
  [TimeLimitExceededError, 3],
  [SizeLimitExceededError, 4],
  [AuthMethodNotSupportedError, 7],
  [StrongAuthRequiredError, 8],
  [AdminLimitExceededError, 11],
  [UnavailableCriticalExtensionError, 12],
  [ConfidentialityRequiredError, 13],
  [SaslBindInProgressError, 14],
  [NoSuchAttributeError, 16],
  [UndefinedTypeError, 17],
  [InappropriateMatchingError, 18],
  [ConstraintViolationError, 19],
  [TypeOrValueExistsError, 20],
  [InvalidSyntaxError, 21],
  [NoSuchObjectError, 32],
  [AliasProblemError, 33],
  [InvalidDNSyntaxError, 34],
  [IsLeafError, 35],
  [AliasDerefProblemError, 36],
  [InappropriateAuthError, 48],
  [InvalidCredentialsError, 49],
  [InsufficientAccessError, 50],
  [BusyError, 51],
  [UnavailableError, 52],
  [UnwillingToPerformError, 53],
  [LoopDetectError, 54],
  [NamingViolationError, 64],
  [ObjectClassViolationError, 65],
  [NotAllowedOnNonLeafError, 66],
  [NotAllowedOnRDNError, 67],
  [AlreadyExistsError, 68],
  [NoObjectClassModsError, 69],
  [ResultsTooLargeError, 70],
  [AffectsMultipleDSAsError, 71],
  [MoreResultsToReturnError, 95],
  [TLSNotSupportedError, 112],
  [NoResultError, 248],
];

describe('error classes', () => {
  it('ResultCodeError is base class', () => {
    const err = new InvalidCredentialsError();
    assert.ok(err instanceof ResultCodeError);
    assert.ok(err instanceof Error);
  });

  for (const [Cls, code] of errorClasses) {
    const name = Cls.name;
    it(`${name} has code ${code}`, () => {
      const err = new Cls();
      assert.equal(err.code, code);
      assert.equal(err.name, name);
    });

    if (Cls !== SaslBindInProgressError) {
      it(`${name} accepts custom message`, () => {
        const err = new Cls('custom message');
        assert.equal(err.message, 'custom message');
      });
    }

    if (Cls !== SaslBindInProgressError) {
      it(`${name} instanceof ResultCodeError`, () => {
        assert.ok(new Cls() instanceof ResultCodeError);
      });
    }
  }

  it('SaslBindInProgressError takes response object', () => {
    const err = new SaslBindInProgressError({ status: 14, errorMessage: 'sasl in progress' });
    assert.equal(err.code, 14);
    assert.ok(err.response);
    assert.equal(err.response.status, 14);
  });

  it('UnknownStatusCodeError takes dynamic code', () => {
    const err = new UnknownStatusCodeError(999);
    assert.equal(err.code, 999);
    assert.equal(err.name, 'UnknownStatusCodeError');
  });

  it('MessageParserError has messageDetails', () => {
    const details = { messageId: 1, protocolOperation: 0x61 };
    const err = new MessageParserError('parse error', details);
    assert.equal(err.name, 'MessageParserError');
    assert.deepEqual(err.messageDetails, details);
  });
});
