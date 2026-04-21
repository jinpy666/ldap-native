import { Control } from './Control.js';

export class PagedResultsControl extends Control {
  public constructor(options: { value?: { size?: number; cookie?: Buffer }; criticality?: boolean } = {}) {
    super({
      type: '1.2.840.113556.1.4.319',
      criticality: options.criticality ?? false,
      value: {
        size: options.value?.size ?? 100,
        cookie: options.value?.cookie ?? Buffer.alloc(0),
      },
    });
  }
}
