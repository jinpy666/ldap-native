export class Attribute {
  public type: string;
  public values: string[];

  public constructor(options: { type: string; values: string[] }) {
    this.type = options.type;
    this.values = options.values;
  }
}
