import { MessageResponse, type MessageResponseOptions } from './MessageResponse.js';
export interface SearchResponseOptions extends MessageResponseOptions { searchEntries?: unknown[]; searchReferences?: unknown[]; }
export declare class SearchResponse extends MessageResponse { searchEntries: unknown[]; searchReferences: unknown[]; constructor(options?: SearchResponseOptions); }
