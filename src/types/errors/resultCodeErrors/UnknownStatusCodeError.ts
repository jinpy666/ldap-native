import { ResultCodeError } from './ResultCodeError.js';

export declare class UnknownStatusCodeError extends ResultCodeError {
  constructor(code: number, message?: string);
}
