import { Control } from './Control.js';

export class PersistentSearchControl extends Control {
  public constructor(options: { value?: any; criticality?: boolean } = {}) {
    super({ type: '2.16.840.1.113730.3.4.3', ...options });
  }
}
