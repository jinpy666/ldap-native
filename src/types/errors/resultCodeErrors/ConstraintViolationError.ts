import { ResultCodeError } from './ResultCodeError.js';

export declare class ConstraintViolationError extends ResultCodeError {
  constructor(message?: string);
}
