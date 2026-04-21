export class RDN {
  public attributes: Array<{ name: string; value: string }>;

  public constructor(attributes: Array<{ name: string; value: string }>) {
    this.attributes = attributes;
  }

  public static parse(input: string): RDN {
    const parts = input.split('+').map((part) => part.trim());
    const attributes = parts.map((part) => {
      const index = part.indexOf('=');
      if (index === -1) throw new Error('Invalid RDN');
      return {
        name: part.slice(0, index).trim(),
        value: part.slice(index + 1).trim(),
      };
    });
    return new RDN(attributes);
  }

  public toString(): string {
    return this.attributes.map(({ name, value }) => `${name}=${value}`).join('+');
  }
}
