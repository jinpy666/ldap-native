import { Control } from './Control.js';

export class ServerSideSortingRequestControl extends Control {
  public constructor(options: { value?: any; criticality?: boolean } = {}) {
    super({ type: '1.2.840.113556.1.4.473', ...options });
  }
}
