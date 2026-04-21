import test from 'node:test';
import assert from 'node:assert/strict';
import { BerWriter, BerReader } from '../../index.cjs';

test('upstream placeholder: BER read/write int', () => {
  const writer = new BerWriter();
  writer.writeInt(7);
  const reader = new BerReader(writer.buffer());
  assert.equal(reader.readInt(), 7);
});
