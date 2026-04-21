export class Control {
  public type: string;
  public criticality: boolean;
  public value: any;

  public constructor(options: { type: string; criticality?: boolean; value?: any }) {
    this.type = options.type;
    this.criticality = options.criticality ?? false;
    this.value = options.value;
  }
}
