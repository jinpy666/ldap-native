import test from 'node:test';
import assert from 'node:assert/strict';
import { BerWriter } from '../../index.cjs';

test('upstream placeholder: BerWriter buffer exists', () => {
  const writer = new BerWriter();
  writer.writeInt(7);
  assert.equal(Buffer.isBuffer(writer.buffer()), true);
});
