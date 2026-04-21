import { type ResultCodeError } from './errors/index.js';
export declare class StatusCodeParser {
  public static parse(result?: { status?: number; errorMessage?: string }): ResultCodeError;
}
