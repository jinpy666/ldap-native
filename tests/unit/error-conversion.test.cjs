'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { StatusCodeParser, InvalidCredentialsError, ResultCodeError, SizeLimitExceededError, NoSuchObjectError } = require('../../src/runtime.cjs');

describe('error conversion from native errors', () => {
  it('StatusCodeParser converts code 49 to InvalidCredentialsError', () => {
    const nativeErr = new Error('simple bind failed: Invalid credentials');
    nativeErr.code = 49;
    const converted = StatusCodeParser.parse({ status: nativeErr.code, errorMessage: nativeErr.message });
    assert.ok(converted instanceof InvalidCredentialsError);
    assert.ok(converted instanceof ResultCodeError);
    assert.equal(converted.code, 49);
    assert.equal(converted.name, 'InvalidCredentialsError');
  });

  it('StatusCodeParser converts code 32 to NoSuchObjectError', () => {
    const converted = StatusCodeParser.parse({ status: 32, errorMessage: 'No such object' });
    assert.ok(converted instanceof NoSuchObjectError);
    assert.equal(converted.code, 32);
  });

  it('StatusCodeParser converts code 4 to SizeLimitExceededError', () => {
    const converted = StatusCodeParser.parse({ status: 4, errorMessage: 'Size limit exceeded' });
    assert.ok(converted instanceof SizeLimitExceededError);
    assert.equal(converted.code, 4);
  });

  it('StatusCodeParser converts unknown code to UnknownStatusCodeError', () => {
    const converted = StatusCodeParser.parse({ status: 999, errorMessage: 'unknown' });
    assert.ok(converted instanceof ResultCodeError);
    assert.equal(converted.name, 'UnknownStatusCodeError');
    assert.equal(converted.code, 999);
  });

  it('StatusCodeParser returns NoResultError for no argument', () => {
    const converted = StatusCodeParser.parse();
    assert.equal(converted.name, 'NoResultError');
    assert.equal(converted.code, 248);
  });

  it('converted errors preserve error message', () => {
    const converted = StatusCodeParser.parse({ status: 49, errorMessage: 'bad password' });
    assert.equal(converted.message, 'bad password');
  });
});
