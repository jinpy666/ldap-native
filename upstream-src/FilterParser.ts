import { AndFilter } from './filters/AndFilter.js';
import { EqualityFilter } from './filters/EqualityFilter.js';
import { NotFilter } from './filters/NotFilter.js';
import { OrFilter } from './filters/OrFilter.js';
import { PresenceFilter } from './filters/PresenceFilter.js';
import { SubstringFilter } from './filters/SubstringFilter.js';
import type { Filter } from './filters/Filter.js';

export class FilterParser {
  public parse(filter: string): Filter {
    const input = filter.trim();
    if (!input.startsWith('(') || !input.endsWith(')')) {
      throw new Error('Invalid filter string');
    }
    return this.parseExpression(input);
  }

  private parseExpression(filter: string): Filter {
    const inner = filter.slice(1, -1);
    if (inner.startsWith('&')) {
      return new AndFilter({ filters: this.parseGroup(inner.slice(1)) });
    }
    if (inner.startsWith('|')) {
      return new OrFilter({ filters: this.parseGroup(inner.slice(1)) });
    }
    if (inner.startsWith('!')) {
      return new NotFilter({ filter: this.parseExpression(inner.slice(1)) });
    }
    if (inner.endsWith('=*') && !inner.includes('*', 0)) {
      const attribute = inner.slice(0, inner.length - 2);
      return new PresenceFilter({ attribute });
    }
    const eqIndex = inner.indexOf('=');
    if (eqIndex === -1) {
      throw new Error('Invalid filter string');
    }
    const attribute = inner.slice(0, eqIndex);
    const value = inner.slice(eqIndex + 1);
    if (value.includes('*')) {
      const parts = value.split('*');
      return new SubstringFilter({
        attribute,
        initial: parts[0] || undefined,
        any: parts.slice(1, -1).filter(Boolean),
        final: parts.at(-1) || undefined,
      });
    }
    return new EqualityFilter({ attribute, value });
  }

  private parseGroup(input: string): Filter[] {
    const filters: Filter[] = [];
    let depth = 0;
    let start = -1;
    for (let i = 0; i < input.length; i += 1) {
      if (input[i] === '(') {
        if (depth === 0) start = i;
        depth += 1;
      } else if (input[i] === ')') {
        depth -= 1;
        if (depth === 0 && start >= 0) {
          filters.push(this.parseExpression(input.slice(start, i + 1)));
          start = -1;
        }
      }
    }
    return filters;
  }
}
