'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  ProtocolOperation,
  MessageResponseStatus,
  SearchFilter,
} = require('../../index.cjs');

describe('ProtocolOperation', () => {
  it('has LDAP_VERSION_3', () => assert.equal(ProtocolOperation.LDAP_VERSION_3, 0x03));
  it('has LBER_SET', () => assert.equal(ProtocolOperation.LBER_SET, 0x31));
  it('has LDAP_CONTROLS', () => assert.equal(ProtocolOperation.LDAP_CONTROLS, 0xa0));
  it('has all request operations', () => {
    assert.equal(ProtocolOperation.LDAP_REQ_BIND, 0x60);
    assert.equal(ProtocolOperation.LDAP_REQ_SEARCH, 0x63);
    assert.equal(ProtocolOperation.LDAP_REQ_MODIFY, 0x66);
    assert.equal(ProtocolOperation.LDAP_REQ_ADD, 0x68);
    assert.equal(ProtocolOperation.LDAP_REQ_DELETE, 0x4a);
    assert.equal(ProtocolOperation.LDAP_REQ_MODRDN, 0x6c);
    assert.equal(ProtocolOperation.LDAP_REQ_COMPARE, 0x6e);
    assert.equal(ProtocolOperation.LDAP_REQ_ABANDON, 0x50);
    assert.equal(ProtocolOperation.LDAP_REQ_EXTENSION, 0x77);
  });
  it('has all response operations', () => {
    assert.equal(ProtocolOperation.LDAP_RES_BIND, 0x61);
    assert.equal(ProtocolOperation.LDAP_RES_SEARCH_ENTRY, 0x64);
    assert.equal(ProtocolOperation.LDAP_RES_SEARCH_REF, 0x73);
    assert.equal(ProtocolOperation.LDAP_RES_SEARCH, 0x65);
    assert.equal(ProtocolOperation.LDAP_RES_MODIFY, 0x67);
    assert.equal(ProtocolOperation.LDAP_RES_ADD, 0x69);
    assert.equal(ProtocolOperation.LDAP_RES_DELETE, 0x6b);
    assert.equal(ProtocolOperation.LDAP_RES_MODRDN, 0x6d);
    assert.equal(ProtocolOperation.LDAP_RES_COMPARE, 0x6f);
    assert.equal(ProtocolOperation.LDAP_RES_EXTENSION, 0x78);
  });
  it('has 24 keys', () => assert.equal(Object.keys(ProtocolOperation).length, 24));
});

describe('MessageResponseStatus', () => {
  it('has Success = 0', () => assert.equal(MessageResponseStatus.Success, 0));
  it('has SizeLimitExceeded = 4', () => assert.equal(MessageResponseStatus.SizeLimitExceeded, 4));
});

describe('SearchFilter', () => {
  it('has all filter types', () => {
    assert.equal(SearchFilter.and, 0xa0);
    assert.equal(SearchFilter.or, 0xa1);
    assert.equal(SearchFilter.not, 0xa2);
    assert.equal(SearchFilter.equalityMatch, 0xa3);
    assert.equal(SearchFilter.substrings, 0xa4);
    assert.equal(SearchFilter.greaterOrEqual, 0xa5);
    assert.equal(SearchFilter.lessOrEqual, 0xa6);
    assert.equal(SearchFilter.present, 0x87);
    assert.equal(SearchFilter.approxMatch, 0xa8);
    assert.equal(SearchFilter.extensibleMatch, 0xa9);
  });
});
