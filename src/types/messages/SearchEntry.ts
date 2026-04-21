import { MessageResponse, type MessageResponseOptions } from './MessageResponse.js';
export interface Entry { dn: string; [index: string]: unknown; }
export interface SearchEntryOptions extends MessageResponseOptions { name?: string; attributes?: unknown[]; }
export declare class SearchEntry extends MessageResponse { name: string; attributes: unknown[]; constructor(options?: SearchEntryOptions); }
