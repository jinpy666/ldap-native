import { ResultCodeError } from './ResultCodeError.js';

export declare class SaslBindInProgressError extends ResultCodeError {
  constructor(response?: { status?: number; errorMessage?: string });
}
