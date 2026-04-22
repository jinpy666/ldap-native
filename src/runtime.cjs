'use strict';

class Attribute {
  constructor(options) {
    this.type = options.type;
    this.values = options.values;
  }
}

class Change {
  constructor(options) {
    this.operation = options.operation;
    this.modification = options.modification;
  }
}

class PostalAddress {
  static fromString(value) {
    return value
      .split('$')
      .map((part) => part.replace(/\\24/g, '$').replace(/\\5c/g, '\\').replace(/\\2c/g, ','));
  }

  static toString(parts) {
    return parts
      .map((part) => part.replace(/\\/g, '\\5c').replace(/\$/g, '\\24').replace(/,/g, '\\2c'))
      .join('$');
  }
}

class Ber {
  static Sequence = 0x30;
  static Integer = 0x02;
  static OctetString = 0x04;
  static Enumerated = 0x0a;
  static Boolean = 0x01;
}

class InvalidAsn1Error extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidAsn1Error';
  }
}

class BerReader {
  constructor(buffer) {
    this.buffer = buffer;
    this.offset = 0;
  }

  readSequence(expectedTag = 0x30) {
    const tag = this.readByte();
    if (tag !== expectedTag) throw new InvalidAsn1Error('Invalid sequence tag');
    return this.readLength();
  }

  readString(expectedTag = 0x04) {
    const tag = this.readByte();
    if (tag !== expectedTag) throw new InvalidAsn1Error('Invalid string tag');
    const length = this.readLength();
    const value = this.buffer.subarray(this.offset, this.offset + length).toString('utf8');
    this.offset += length;
    return value;
  }

  readInt() {
    const tag = this.readByte();
    if (tag !== 0x02) throw new InvalidAsn1Error('Invalid integer tag');
    const length = this.readLength();
    let value = 0;
    for (let i = 0; i < length; i += 1) value = (value << 8) | this.readByte();
    return value;
  }

  readByte() {
    if (this.offset >= this.buffer.length) throw new InvalidAsn1Error('Reader out of bounds');
    return this.buffer[this.offset++];
  }

  readLength() {
    const first = this.readByte();
    if ((first & 0x80) === 0) return first;
    const count = first & 0x7f;
    let length = 0;
    for (let i = 0; i < count; i += 1) length = (length << 8) | this.readByte();
    return length;
  }
}

class BerWriter {
  constructor() {
    this.chunks = [];
    this.stack = [];
  }

  startSequence(tag = 0x30) {
    this.chunks.push(tag, 0);
    this.stack.push(this.chunks.length - 1);
  }

  endSequence() {
    const start = this.stack.pop();
    if (start === undefined) throw new InvalidAsn1Error('Sequence stack underflow');
    const length = this.chunks.length - start - 1;
    this.chunks[start] = length;
  }

  writeString(value, tag = 0x04) {
    const buffer = Buffer.from(value, 'utf8');
    this.chunks.push(tag, buffer.length, ...buffer);
  }

  writeInt(value) {
    this.chunks.push(0x02, 1, value & 0xff);
  }

  buffer() {
    return Buffer.from(this.chunks);
  }
}

class Control {
  constructor(typeOrOptions, criticality = false, value) {
    if (typeof typeOrOptions === 'string') {
      this.type = typeOrOptions;
      this.criticality = criticality;
      this.value = value;
      return;
    }

    const options = typeOrOptions ?? {};
    this.type = options.type;
    this.criticality = options.criticality ?? false;
    this.value = options.value;
  }
}

class EntryChangeNotificationControl extends Control {
  constructor(options = {}) {
    super({ type: '2.16.840.1.113730.3.4.7', ...options });
  }
}

class PagedResultsControl extends Control {
  constructor(options = {}) {
    super({
      type: '1.2.840.113556.1.4.319',
      criticality: options.criticality ?? false,
      value: {
        size: options.value?.size ?? 100,
        cookie: options.value?.cookie ?? Buffer.alloc(0),
      },
    });
  }
}

class PersistentSearchControl extends Control {
  constructor(options = {}) {
    super({ type: '2.16.840.1.113730.3.4.3', ...options });
  }
}

class ServerSideSortingRequestControl extends Control {
  constructor(options = {}) {
    super({ type: '1.2.840.113556.1.4.473', ...options });
  }
}

class DN {
  constructor(rdns) {
    this.rdns = rdns;
  }

  static parse(input) {
    const parts = input.split(/,(?=(?:[^\\]|\\.)*$)/).map((part) => part.trim()).filter(Boolean);
    return new DN(parts.map((part) => RDN.parse(part)));
  }

  toString() {
    return this.rdns.map((rdn) => rdn.toString()).join(',');
  }

  equals(other) {
    return this.toString().toLowerCase() === other.toString().toLowerCase();
  }
}

class RDN {
  constructor(attributes) {
    this.attributes = attributes;
  }

  static parse(input) {
    const parts = input.split('+').map((part) => part.trim());
    const attributes = parts.map((part) => {
      const index = part.indexOf('=');
      if (index === -1) throw new Error('Invalid RDN');
      return { name: part.slice(0, index).trim(), value: part.slice(index + 1).trim() };
    });
    return new RDN(attributes);
  }

  toString() {
    return this.attributes.map(({ name, value }) => `${name}=${value}`).join('+');
  }
}

class AndFilter {
  constructor(options) { this.filters = options.filters; }
  toString() { return `(&${this.filters.map((filter) => filter.toString()).join('')})`; }
}
class ApproximateFilter {
  constructor(options) { this.attribute = options.attribute; this.value = options.value; }
  toString() { return `(${this.attribute}~=${this.value})`; }
}
class EqualityFilter {
  constructor(options) { this.attribute = options.attribute; this.value = options.value; }
  toString() { return `(${this.attribute}=${this.value})`; }
}
class ExtensibleFilter {
  constructor(options) {
    this.attribute = options.attribute;
    this.matchingRule = options.matchingRule;
    this.value = options.value;
    this.dnAttributes = options.dnAttributes ?? false;
  }
  toString() {
    const pieces = [];
    if (this.attribute) pieces.push(this.attribute);
    if (this.dnAttributes) pieces.push('dn');
    if (this.matchingRule) pieces.push(this.matchingRule);
    return `(${pieces.join(':')}:=${this.value})`;
  }
}
class GreaterThanEqualsFilter {
  constructor(options) { this.attribute = options.attribute; this.value = options.value; }
  toString() { return `(${this.attribute}>=${this.value})`; }
}
class LessThanEqualsFilter {
  constructor(options) { this.attribute = options.attribute; this.value = options.value; }
  toString() { return `(${this.attribute}<=${this.value})`; }
}
class NotFilter {
  constructor(options) { this.filter = options.filter; }
  toString() { return `(!${this.filter.toString()})`; }
}
class OrFilter {
  constructor(options) { this.filters = options.filters; }
  toString() { return `(|${this.filters.map((filter) => filter.toString()).join('')})`; }
}
class PresenceFilter {
  constructor(options) { this.attribute = options.attribute; }
  toString() { return `(${this.attribute}=*)`; }
}
class SubstringFilter {
  constructor(options) {
    this.attribute = options.attribute;
    this.initial = options.initial;
    this.any = options.any ?? [];
    this.final = options.final;
  }
  toString() { return `(${this.attribute}=${this.initial ?? ''}*${this.any.join('*')}*${this.final ?? ''})`; }
}

class FilterParser {
  parse(filter) {
    const input = filter.trim();
    if (!input.startsWith('(') || !input.endsWith(')')) throw new Error('Invalid filter string');
    return this.parseExpression(input);
  }

  parseExpression(filter) {
    const inner = filter.slice(1, -1);
    if (inner.startsWith('&')) return new AndFilter({ filters: this.parseGroup(inner.slice(1)) });
    if (inner.startsWith('|')) return new OrFilter({ filters: this.parseGroup(inner.slice(1)) });
    if (inner.startsWith('!')) return new NotFilter({ filter: this.parseExpression(inner.slice(1)) });
    if (inner.endsWith('=*') && !inner.includes('*', 0)) return new PresenceFilter({ attribute: inner.slice(0, inner.length - 2) });
    const eqIndex = inner.indexOf('=');
    if (eqIndex === -1) throw new Error('Invalid filter string');
    const attribute = inner.slice(0, eqIndex);
    const value = inner.slice(eqIndex + 1);
    if (value.includes('*')) {
      const parts = value.split('*');
      return new SubstringFilter({ attribute, initial: parts[0] || undefined, any: parts.slice(1, -1).filter(Boolean), final: parts.at(-1) || undefined });
    }
    return new EqualityFilter({ attribute, value });
  }

  parseGroup(input) {
    const filters = [];
    let depth = 0;
    let start = -1;
    for (let i = 0; i < input.length; i += 1) {
      if (input[i] === '(') {
        if (depth === 0) start = i;
        depth += 1;
      } else if (input[i] === ')') {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          filters.push(this.parseExpression(input.slice(start, i + 1)));
          start = -1;
        }
      }
    }
    return filters;
  }
}

const ProtocolOperation = {
  LDAP_VERSION_3: 0x03,
  LBER_SET: 0x31,
  LDAP_CONTROLS: 0xa0,
  LDAP_REQ_BIND: 0x60,
  LDAP_REQ_BIND_SASL: 0xa3,
  LDAP_REQ_UNBIND: 0x42,
  LDAP_REQ_SEARCH: 0x63,
  LDAP_REQ_MODIFY: 0x66,
  LDAP_REQ_ADD: 0x68,
  LDAP_REQ_DELETE: 0x4a,
  LDAP_REQ_MODRDN: 0x6c,
  LDAP_REQ_COMPARE: 0x6e,
  LDAP_REQ_ABANDON: 0x50,
  LDAP_REQ_EXTENSION: 0x77,
  LDAP_RES_BIND: 0x61,
  LDAP_RES_SEARCH_ENTRY: 0x64,
  LDAP_RES_SEARCH_REF: 0x73,
  LDAP_RES_SEARCH: 0x65,
  LDAP_RES_MODIFY: 0x67,
  LDAP_RES_ADD: 0x69,
  LDAP_RES_DELETE: 0x6b,
  LDAP_RES_MODRDN: 0x6d,
  LDAP_RES_COMPARE: 0x6f,
  LDAP_RES_EXTENSION: 0x78,
};

const MessageResponseStatus = {
  Success: 0,
  SizeLimitExceeded: 4,
};

const SearchFilter = {
  and: 0xa0,
  or: 0xa1,
  not: 0xa2,
  equalityMatch: 0xa3,
  substrings: 0xa4,
  greaterOrEqual: 0xa5,
  lessOrEqual: 0xa6,
  present: 0x87,
  approxMatch: 0xa8,
  extensibleMatch: 0xa9,
};

// --- Error classes ---

class ResultCodeError extends Error {
  constructor(code, message) {
    super(message ?? `Result code error (0x${code.toString(16)})`);
    this.name = 'ResultCodeError';
    this.code = code;
  }
}

class MessageParserError extends Error {
  constructor(message, messageDetails) {
    super(message);
    this.name = 'MessageParserError';
    this.messageDetails = messageDetails;
  }
}

class OperationsError extends ResultCodeError {
  constructor(message) { super(1, message ?? 'Operations error'); this.name = 'OperationsError'; }
}

class ProtocolError extends ResultCodeError {
  constructor(message) { super(2, message ?? 'Protocol error'); this.name = 'ProtocolError'; }
}

class TimeLimitExceededError extends ResultCodeError {
  constructor(message) { super(3, message ?? 'Time limit exceeded'); this.name = 'TimeLimitExceededError'; }
}

class SizeLimitExceededError extends ResultCodeError {
  constructor(message) { super(4, message ?? 'Size limit exceeded'); this.name = 'SizeLimitExceededError'; }
}

class AuthMethodNotSupportedError extends ResultCodeError {
  constructor(message) { super(7, message ?? 'Authentication method not supported'); this.name = 'AuthMethodNotSupportedError'; }
}

class StrongAuthRequiredError extends ResultCodeError {
  constructor(message) { super(8, message ?? 'Strong authentication required'); this.name = 'StrongAuthRequiredError'; }
}

class AdminLimitExceededError extends ResultCodeError {
  constructor(message) { super(11, message ?? 'Admin limit exceeded'); this.name = 'AdminLimitExceededError'; }
}

class UnavailableCriticalExtensionError extends ResultCodeError {
  constructor(message) { super(12, message ?? 'Unavailable critical extension'); this.name = 'UnavailableCriticalExtensionError'; }
}

class ConfidentialityRequiredError extends ResultCodeError {
  constructor(message) { super(13, message ?? 'Confidentiality required'); this.name = 'ConfidentialityRequiredError'; }
}

class SaslBindInProgressError extends ResultCodeError {
  constructor(response) {
    super(14, response?.errorMessage ?? 'SASL bind in progress');
    this.name = 'SaslBindInProgressError';
    this.response = response;
  }
}

class NoSuchAttributeError extends ResultCodeError {
  constructor(message) { super(16, message ?? 'No such attribute'); this.name = 'NoSuchAttributeError'; }
}

class UndefinedTypeError extends ResultCodeError {
  constructor(message) { super(17, message ?? 'Undefined type'); this.name = 'UndefinedTypeError'; }
}

class InappropriateMatchingError extends ResultCodeError {
  constructor(message) { super(18, message ?? 'Inappropriate matching'); this.name = 'InappropriateMatchingError'; }
}

class ConstraintViolationError extends ResultCodeError {
  constructor(message) { super(19, message ?? 'Constraint violation'); this.name = 'ConstraintViolationError'; }
}

class TypeOrValueExistsError extends ResultCodeError {
  constructor(message) { super(20, message ?? 'Type or value exists'); this.name = 'TypeOrValueExistsError'; }
}

class InvalidSyntaxError extends ResultCodeError {
  constructor(message) { super(21, message ?? 'Invalid syntax'); this.name = 'InvalidSyntaxError'; }
}

class NoSuchObjectError extends ResultCodeError {
  constructor(message) { super(32, message ?? 'No such object'); this.name = 'NoSuchObjectError'; }
}

class AliasProblemError extends ResultCodeError {
  constructor(message) { super(33, message ?? 'Alias problem'); this.name = 'AliasProblemError'; }
}

class InvalidDNSyntaxError extends ResultCodeError {
  constructor(message) { super(34, message ?? 'Invalid DN syntax'); this.name = 'InvalidDNSyntaxError'; }
}

class IsLeafError extends ResultCodeError {
  constructor(message) { super(35, message ?? 'Is leaf'); this.name = 'IsLeafError'; }
}

class AliasDerefProblemError extends ResultCodeError {
  constructor(message) { super(36, message ?? 'Alias dereferencing problem'); this.name = 'AliasDerefProblemError'; }
}

class InappropriateAuthError extends ResultCodeError {
  constructor(message) { super(48, message ?? 'Inappropriate authentication'); this.name = 'InappropriateAuthError'; }
}

class InvalidCredentialsError extends ResultCodeError {
  constructor(message) { super(49, message ?? 'Invalid credentials'); this.name = 'InvalidCredentialsError'; }
}

class InsufficientAccessError extends ResultCodeError {
  constructor(message) { super(50, message ?? 'Insufficient access'); this.name = 'InsufficientAccessError'; }
}

class BusyError extends ResultCodeError {
  constructor(message) { super(51, message ?? 'Busy'); this.name = 'BusyError'; }
}

class UnavailableError extends ResultCodeError {
  constructor(message) { super(52, message ?? 'Unavailable'); this.name = 'UnavailableError'; }
}

class UnwillingToPerformError extends ResultCodeError {
  constructor(message) { super(53, message ?? 'Unwilling to perform'); this.name = 'UnwillingToPerformError'; }
}

class LoopDetectError extends ResultCodeError {
  constructor(message) { super(54, message ?? 'Loop detect'); this.name = 'LoopDetectError'; }
}

class NamingViolationError extends ResultCodeError {
  constructor(message) { super(64, message ?? 'Naming violation'); this.name = 'NamingViolationError'; }
}

class ObjectClassViolationError extends ResultCodeError {
  constructor(message) { super(65, message ?? 'Object class violation'); this.name = 'ObjectClassViolationError'; }
}

class NotAllowedOnNonLeafError extends ResultCodeError {
  constructor(message) { super(66, message ?? 'Not allowed on non-leaf'); this.name = 'NotAllowedOnNonLeafError'; }
}

class NotAllowedOnRDNError extends ResultCodeError {
  constructor(message) { super(67, message ?? 'Not allowed on RDN'); this.name = 'NotAllowedOnRDNError'; }
}

class AlreadyExistsError extends ResultCodeError {
  constructor(message) { super(68, message ?? 'Already exists'); this.name = 'AlreadyExistsError'; }
}

class NoObjectClassModsError extends ResultCodeError {
  constructor(message) { super(69, message ?? 'No object class modifications'); this.name = 'NoObjectClassModsError'; }
}

class ResultsTooLargeError extends ResultCodeError {
  constructor(message) { super(70, message ?? 'Results too large'); this.name = 'ResultsTooLargeError'; }
}

class AffectsMultipleDSAsError extends ResultCodeError {
  constructor(message) { super(71, message ?? 'Affects multiple DSAs'); this.name = 'AffectsMultipleDSAsError'; }
}

class MoreResultsToReturnError extends ResultCodeError {
  constructor(message) { super(95, message ?? 'More results to return'); this.name = 'MoreResultsToReturnError'; }
}

class TLSNotSupportedError extends ResultCodeError {
  constructor(message) { super(112, message ?? 'TLS not supported'); this.name = 'TLSNotSupportedError'; }
}

class NoResultError extends ResultCodeError {
  constructor(message) { super(248, message ?? 'No result'); this.name = 'NoResultError'; }
}

class UnknownStatusCodeError extends ResultCodeError {
  constructor(code, message) {
    super(code, message ?? `Unknown status code: 0x${code.toString(16)}`);
    this.name = 'UnknownStatusCodeError';
  }
}

class StatusCodeParser {
  static parse(result) {
    if (!result) {
      return new NoResultError();
    }
    switch (result.status) {
      case 1: return new OperationsError(result.errorMessage);
      case 2: return new ProtocolError(result.errorMessage);
      case 3: return new TimeLimitExceededError(result.errorMessage);
      case 4: return new SizeLimitExceededError(result.errorMessage);
      case 7: return new AuthMethodNotSupportedError(result.errorMessage);
      case 8: return new StrongAuthRequiredError(result.errorMessage);
      case 11: return new AdminLimitExceededError(result.errorMessage);
      case 12: return new UnavailableCriticalExtensionError(result.errorMessage);
      case 13: return new ConfidentialityRequiredError(result.errorMessage);
      case 14: return new SaslBindInProgressError(result);
      case 16: return new NoSuchAttributeError(result.errorMessage);
      case 17: return new UndefinedTypeError(result.errorMessage);
      case 18: return new InappropriateMatchingError(result.errorMessage);
      case 19: return new ConstraintViolationError(result.errorMessage);
      case 20: return new TypeOrValueExistsError(result.errorMessage);
      case 21: return new InvalidSyntaxError(result.errorMessage);
      case 32: return new NoSuchObjectError(result.errorMessage);
      case 33: return new AliasProblemError(result.errorMessage);
      case 34: return new InvalidDNSyntaxError(result.errorMessage);
      case 35: return new IsLeafError(result.errorMessage);
      case 36: return new AliasDerefProblemError(result.errorMessage);
      case 48: return new InappropriateAuthError(result.errorMessage);
      case 49: return new InvalidCredentialsError(result.errorMessage);
      case 50: return new InsufficientAccessError(result.errorMessage);
      case 51: return new BusyError(result.errorMessage);
      case 52: return new UnavailableError(result.errorMessage);
      case 53: return new UnwillingToPerformError(result.errorMessage);
      case 54: return new LoopDetectError(result.errorMessage);
      case 64: return new NamingViolationError(result.errorMessage);
      case 65: return new ObjectClassViolationError(result.errorMessage);
      case 66: return new NotAllowedOnNonLeafError(result.errorMessage);
      case 67: return new NotAllowedOnRDNError(result.errorMessage);
      case 68: return new AlreadyExistsError(result.errorMessage);
      case 69: return new NoObjectClassModsError(result.errorMessage);
      case 70: return new ResultsTooLargeError(result.errorMessage);
      case 71: return new AffectsMultipleDSAsError(result.errorMessage);
      case 95: return new MoreResultsToReturnError(result.errorMessage);
      case 112: return new TLSNotSupportedError(result.errorMessage);
      case 248: return new NoResultError(result.errorMessage);
      default: return new UnknownStatusCodeError(result.status ?? 0, result.errorMessage);
    }
  }
}

class MessageParser {}
class ControlParser {}

// --- Message type stubs (lightweight, for API compatibility only) ---

class Message {
  constructor(options = {}) {
    this.messageId = options.messageId ?? 0;
    this.controls = options.controls;
  }
}

class MessageResponse extends Message {
  constructor(options = {}) {
    super(options);
    this.status = options.status ?? 0;
    this.matchedDN = options.matchedDN ?? '';
    this.errorMessage = options.errorMessage ?? '';
  }
}

class AbandonRequest extends Message {
  constructor(options = {}) { super(options); }
}

class AddRequest extends Message {
  constructor(options = {}) { super(options); this.entry = options.entry ?? {}; }
}

class AddResponse extends MessageResponse {}

class BindRequest extends Message {
  constructor(options = {}) { super(options); this.dn = options.dn ?? ''; this.password = options.password ?? ''; this.mechanism = options.mechanism; }
}

class BindResponse extends MessageResponse {}

class CompareRequest extends Message {
  constructor(options = {}) { super(options); this.dn = options.dn ?? ''; this.attribute = options.attribute ?? ''; this.value = options.value ?? ''; }
}

class CompareResponse extends MessageResponse {}

class DeleteRequest extends Message {
  constructor(options = {}) { super(options); this.dn = options.dn ?? ''; }
}

class DeleteResponse extends MessageResponse {}

class ExtendedRequest extends Message {
  constructor(options = {}) { super(options); this.oid = options.oid ?? ''; this.value = options.value; }
}

class ExtendedResponse extends MessageResponse {}

class ModifyDNRequest extends Message {
  constructor(options = {}) { super(options); this.dn = options.dn ?? ''; this.newDN = options.newDN ?? ''; }
}

class ModifyDNResponse extends MessageResponse {}

class ModifyRequest extends Message {
  constructor(options = {}) { super(options); this.dn = options.dn ?? ''; this.changes = options.changes ?? []; }
}

class ModifyResponse extends MessageResponse {}

class SearchRequest extends Message {
  constructor(options = {}) {
    super(options);
    this.baseDN = options.baseDN ?? '';
    this.scope = options.scope ?? 'sub';
    this.derefAliases = options.derefAliases ?? 'never';
    this.sizeLimit = options.sizeLimit ?? 0;
    this.timeLimit = options.timeLimit ?? 10;
    this.returnAttributeValues = options.returnAttributeValues !== false;
    this.filter = options.filter;
    this.attributes = options.attributes ?? [];
    this.explicitBufferAttributes = options.explicitBufferAttributes ?? [];
  }
}

class SearchEntry extends MessageResponse {
  constructor(options = {}) { super(options); this.name = options.name ?? ''; this.attributes = options.attributes ?? []; }
}

class SearchReference extends MessageResponse {
  constructor(options = {}) { super(options); this.uris = options.uris ?? []; }
}

class SearchResponse extends MessageResponse {
  constructor(options = {}) { super(options); this.searchEntries = options.searchEntries ?? []; this.searchReferences = options.searchReferences ?? []; }
}

class UnbindRequest extends Message {}

const CompareResult = { CompareTrue: true, CompareFalse: false };

const SASL_MECHANISMS = ['EXTERNAL', 'PLAIN', 'DIGEST-MD5', 'SCRAM-SHA-1'];

module.exports = {
  Attribute,
  Change,
  PostalAddress,
  Ber,
  BerReader,
  BerWriter,
  InvalidAsn1Error,
  Control,
  EntryChangeNotificationControl,
  PagedResultsControl,
  PersistentSearchControl,
  ServerSideSortingRequestControl,
  DN,
  RDN,
  AndFilter,
  ApproximateFilter,
  EqualityFilter,
  ExtensibleFilter,
  GreaterThanEqualsFilter,
  LessThanEqualsFilter,
  NotFilter,
  OrFilter,
  PresenceFilter,
  SubstringFilter,
  FilterParser,
  ProtocolOperation,
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
  MessageResponseStatus,
  SearchFilter,
  StatusCodeParser,
  MessageParser,
  ControlParser,
  Message,
  MessageResponse,
  AbandonRequest,
  AddRequest,
  AddResponse,
  BindRequest,
  BindResponse,
  CompareRequest,
  CompareResponse,
  CompareResult,
  DeleteRequest,
  DeleteResponse,
  ExtendedRequest,
  ExtendedResponse,
  ModifyDNRequest,
  ModifyDNResponse,
  ModifyRequest,
  ModifyResponse,
  SearchRequest,
  SearchEntry,
  SearchReference,
  SearchResponse,
  UnbindRequest,
  SASL_MECHANISMS,
};
