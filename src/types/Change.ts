import type { Attribute } from './Attribute.js';

export type ChangeOperation = 'add' | 'delete' | 'replace';

export class Change {
  public operation: ChangeOperation;
  public modification: Attribute;

  public constructor(options: { operation: ChangeOperation; modification: Attribute }) {
    this.operation = options.operation;
    this.modification = options.modification;
  }
}
