export class Control {
  public type: string;
  public criticality: boolean;
  public value: any;

  public constructor(type: string, criticality?: boolean, value?: any);
  public constructor(options: { type: string; criticality?: boolean; value?: any });
  public constructor(
    typeOrOptions: string | { type: string; criticality?: boolean; value?: any },
    criticality = false,
    value?: any,
  ) {
    if (typeof typeOrOptions === 'string') {
      this.type = typeOrOptions;
      this.criticality = criticality;
      this.value = value;
      return;
    }

    this.type = typeOrOptions.type;
    this.criticality = typeOrOptions.criticality ?? false;
    this.value = typeOrOptions.value;
  }
}
