export class BerWriter {
  private readonly chunks: number[] = [];
  private readonly stack: number[] = [];

  public startSequence(tag = 0x30): void {
    this.chunks.push(tag, 0);
    this.stack.push(this.chunks.length - 1);
  }

  public endSequence(): void {
    const start = this.stack.pop();
    if (start === undefined) throw new Error('Sequence stack underflow');
    const length = this.chunks.length - start - 1;
    this.chunks[start] = length;
  }

  public writeString(value: string, tag = 0x04): void {
    const buffer = Buffer.from(value, 'utf8');
    this.chunks.push(tag, buffer.length, ...buffer);
  }

  public writeInt(value: number): void {
    this.chunks.push(0x02, 1, value & 0xff);
  }

  public buffer(): Buffer {
    return Buffer.from(this.chunks);
  }
}
