export class PresenceFilter {
  public attribute: string;

  public constructor(options: { attribute: string }) {
    this.attribute = options.attribute;
  }

  public toString(): string {
    return `(${this.attribute}=*)`;
  }
}
