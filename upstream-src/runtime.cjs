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
  constructor(options) {
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
  SearchRequest: 0x63,
  SearchResultEntry: 0x64,
  SearchResultDone: 0x65,
  SearchResultReference: 0x73,
};

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
};
