import { MessageResponse, type MessageResponseOptions } from './MessageResponse.js';
export interface SearchReferenceOptions extends MessageResponseOptions { uris?: string[]; }
export declare class SearchReference extends MessageResponse { uris: string[]; constructor(options?: SearchReferenceOptions); }
