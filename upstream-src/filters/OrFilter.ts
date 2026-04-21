import type { Filter } from './Filter.js';

export class OrFilter {
  public filters: Filter[];

  public constructor(options: { filters: Filter[] }) {
    this.filters = options.filters;
  }

  public toString(): string {
    return `(|${this.filters.map((filter) => filter.toString()).join('')})`;
  }
}
