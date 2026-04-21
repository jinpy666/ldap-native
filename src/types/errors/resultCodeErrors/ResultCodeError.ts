export declare abstract class ResultCodeError extends Error {
  code: number;
  protected constructor(code: number, message: string);
}
