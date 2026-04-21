import type { Filter } from './Filter.js';

export class NotFilter {
  public filter: Filter;

  public constructor(options: { filter: Filter }) {
    this.filter = options.filter;
  }

  public toString(): string {
    return `(!${this.filter.toString()})`;
  }
}
