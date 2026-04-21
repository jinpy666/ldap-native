export class BerReader {
  private readonly buffer: Buffer;
  private offset = 0;

  public constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  public readSequence(expectedTag = 0x30): number {
    const tag = this.readByte();
    if (tag !== expectedTag) throw new Error('Invalid sequence tag');
    return this.readLength();
  }

  public readString(expectedTag = 0x04): string {
    const tag = this.readByte();
    if (tag !== expectedTag) throw new Error('Invalid string tag');
    const length = this.readLength();
    const value = this.buffer.subarray(this.offset, this.offset + length).toString('utf8');
    this.offset += length;
    return value;
  }

  public readInt(): number {
    const tag = this.readByte();
    if (tag !== 0x02) throw new Error('Invalid integer tag');
    const length = this.readLength();
    let value = 0;
    for (let i = 0; i < length; i += 1) {
      value = (value << 8) | this.readByte();
    }
    return value;
  }

  private readByte(): number {
    if (this.offset >= this.buffer.length) throw new Error('Reader out of bounds');
    return this.buffer[this.offset++];
  }

  private readLength(): number {
    const first = this.readByte();
    if ((first & 0x80) === 0) return first;
    const count = first & 0x7f;
    let length = 0;
    for (let i = 0; i < count; i += 1) {
      length = (length << 8) | this.readByte();
    }
    return length;
  }
}
