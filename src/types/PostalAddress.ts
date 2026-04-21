export class PostalAddress {
  public static fromString(value: string): string[] {
    return value
      .split('$')
      .map((part) => part.replace(/\\24/g, '$').replace(/\\5c/g, '\\').replace(/\\2c/g, ','));
  }

  public static toString(parts: string[]): string {
    return parts
      .map((part) => part.replace(/\\/g, '\\5c').replace(/\$/g, '\\24').replace(/,/g, '\\2c'))
      .join('$');
  }
}
