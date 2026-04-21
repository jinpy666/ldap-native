export class ApproximateFilter {
  public attribute: string;
  public value: string;

  public constructor(options: { attribute: string; value: string }) {
    this.attribute = options.attribute;
    this.value = options.value;
  }

  public toString(): string {
    return `(${this.attribute}~=${this.value})`;
  }
}
