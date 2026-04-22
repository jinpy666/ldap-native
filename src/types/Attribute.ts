export class Attribute {
  public type: string;
  public values: Array<string | Buffer>;

  public constructor(options: { type: string; values: Array<string | Buffer> }) {
    this.type = options.type;
    this.values = options.values;
  }
}
