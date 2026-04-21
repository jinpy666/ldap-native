import { RDN } from './RDN.js';

export class DN {
  public rdns: RDN[];

  public constructor(rdns: RDN[]) {
    this.rdns = rdns;
  }

  public static parse(input: string): DN {
    const parts = input.split(/,(?=(?:[^\\]|\\.)*$)/).map((part) => part.trim()).filter(Boolean);
    return new DN(parts.map((part) => RDN.parse(part)));
  }

  public toString(): string {
    return this.rdns.map((rdn) => rdn.toString()).join(',');
  }

  public equals(other: DN): boolean {
    return this.toString().toLowerCase() === other.toString().toLowerCase();
  }
}
