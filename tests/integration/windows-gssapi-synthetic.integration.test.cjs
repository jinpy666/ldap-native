'use strict';

const net = require('node:net');
const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('../../index.cjs');

function envFlag(name) {
  const value = process.env[name];
  return value === '1' || value?.toLowerCase() === 'true';
}

function encodeLength(length) {
  if (length < 0x80) return Buffer.from([length]);
  if (length <= 0xff) return Buffer.from([0x81, length]);
  return Buffer.from([0x82, (length >> 8) & 0xff, length & 0xff]);
}

function tlv(tag, value) {
  return Buffer.concat([Buffer.from([tag]), encodeLength(value.length), value]);
}

function integer(value) {
  if (value <= 0x7f) return tlv(0x02, Buffer.from([value]));
  return tlv(0x02, Buffer.from([0x00, value]));
}

function enumerated(value) {
  return tlv(0x0a, Buffer.from([value]));
}

function octetString(value = Buffer.alloc(0)) {
  return tlv(0x04, Buffer.isBuffer(value) ? value : Buffer.from(String(value)));
}

function readLength(buffer, offset) {
  const first = buffer[offset];
  if (first < 0x80) return { length: first, bytes: 1 };
  const count = first & 0x7f;
  let length = 0;
  for (let i = 0; i < count; i += 1) {
    length = (length << 8) | buffer[offset + 1 + i];
  }
  return { length, bytes: 1 + count };
}

function readTlv(buffer, offset) {
  const length = readLength(buffer, offset + 1);
  const valueOffset = offset + 1 + length.bytes;
  return {
    tag: buffer[offset],
    value: buffer.subarray(valueOffset, valueOffset + length.length),
    valueOffset,
    end: valueOffset + length.length,
  };
}

function parseMessageId(buffer) {
  if (buffer[0] !== 0x30) return 1;
  const outerLength = readLength(buffer, 1);
  let offset = 1 + outerLength.bytes;
  if (buffer[offset] !== 0x02) return 1;
  const idLength = readLength(buffer, offset + 1);
  offset += 1 + idLength.bytes;
  let value = 0;
  for (let i = 0; i < idLength.length; i += 1) {
    value = (value << 8) | buffer[offset + i];
  }
  return value;
}

function hasSaslBindRequest(buffer) {
  return buffer.includes(Buffer.from([0x60])) && buffer.includes(Buffer.from([0xa3]));
}

function extractSaslCredentials(buffer) {
  const authIndex = buffer.indexOf(0xa3);
  if (authIndex === -1) {
    return Buffer.alloc(0);
  }

  const sasl = readTlv(buffer, authIndex);
  let offset = sasl.valueOffset;
  const mechanism = readTlv(buffer, offset);
  offset = mechanism.end;
  if (offset >= sasl.end || buffer[offset] !== 0x04) {
    return Buffer.alloc(0);
  }

  return readTlv(buffer, offset).value;
}

function makeBindResponse(messageId, resultCode, serverCreds = null) {
  const parts = [
    enumerated(resultCode),
    octetString(),
    octetString(),
  ];
  if (serverCreds) {
    parts.push(tlv(0x87, serverCreds));
  }
  const bindResponse = tlv(0x61, Buffer.concat(parts));
  return tlv(0x30, Buffer.concat([integer(messageId), bindResponse]));
}

function makeNtlmChallenge() {
  const challenge = Buffer.alloc(48);
  challenge.write('NTLMSSP\0', 0, 'ascii');
  challenge.writeUInt32LE(2, 8);
  challenge.writeUInt16LE(0, 12);
  challenge.writeUInt16LE(0, 14);
  challenge.writeUInt32LE(48, 16);
  challenge.writeUInt32LE(0x00088205, 20);
  Buffer.from('ldapnati').copy(challenge, 24);
  return challenge;
}

function makeSpnegoChallenge(ntlmChallenge) {
  const negState = tlv(0xa0, enumerated(1));
  const responseToken = tlv(0xa2, octetString(ntlmChallenge));
  return tlv(0xa1, tlv(0x30, Buffer.concat([negState, responseToken])));
}

async function startSyntheticLdapServer() {
  const requests = [];
  const server = net.createServer((socket) => {
    socket.on('data', (chunk) => {
      requests.push(chunk);
      const messageId = parseMessageId(chunk);
      const creds = extractSaslCredentials(chunk);
      const ntlmIndex = creds.indexOf(Buffer.from('NTLMSSP\0', 'ascii'));
      const ntlmToken = ntlmIndex === -1 ? Buffer.alloc(0) : creds.subarray(ntlmIndex);
      const isNtlmNegotiate = ntlmToken.length >= 12 && ntlmToken.readUInt32LE(8) === 1;

      if (isNtlmNegotiate) {
        const challenge = makeNtlmChallenge();
        const serverCreds = ntlmIndex === 0 ? challenge : makeSpnegoChallenge(challenge);
        socket.write(makeBindResponse(messageId, 14, serverCreds));
        return;
      }

      socket.write(makeBindResponse(messageId, 0));
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    requests,
    url: `ldap://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

test('integration: Windows GSSAPI reaches Wldap32 SSPI synthetic LDAP bind', {
  skip: process.platform !== 'win32' || !envFlag('LDAP_GSSAPI_WINDOWS_SYNTHETIC'),
}, async () => {
  const fixture = await startSyntheticLdapServer();
  const client = new Client({
    url: fixture.url,
    connectTimeout: 5000,
    timeout: 5000,
    sasl: { mechanism: 'GSSAPI' },
  });

  try {
    await client.saslBind();
    assert.ok(fixture.requests.length >= 1);
    assert.ok(fixture.requests.some(hasSaslBindRequest), 'expected at least one LDAP SASL bind request');
  } finally {
    await client.unbind().catch(() => {});
    await fixture.close();
  }
});
