export class ExtensibleFilter {
  public attribute?: string;
  public matchingRule?: string;
  public value: string;
  public dnAttributes: boolean;

  public constructor(options: { attribute?: string; matchingRule?: string; value: string; dnAttributes?: boolean }) {
    this.attribute = options.attribute;
    this.matchingRule = options.matchingRule;
    this.value = options.value;
    this.dnAttributes = options.dnAttributes ?? false;
  }

  public toString(): string {
    const pieces = [];
    if (this.attribute) pieces.push(this.attribute);
    if (this.dnAttributes) pieces.push('dn');
    if (this.matchingRule) pieces.push(this.matchingRule);
    return `(${pieces.join(':')}:=${this.value})`;
  }
}
