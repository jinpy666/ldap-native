export class SubstringFilter {
  public attribute: string;
  public initial?: string;
  public any: string[];
  public final?: string;

  public constructor(options: { attribute: string; initial?: string; any?: string[]; final?: string }) {
    this.attribute = options.attribute;
    this.initial = options.initial;
    this.any = options.any ?? [];
    this.final = options.final;
  }

  public toString(): string {
    return `(${this.attribute}=${this.initial ?? ''}*${this.any.join('*')}*${this.final ?? ''})`;
  }
}
