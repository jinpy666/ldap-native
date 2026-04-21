import { Message, type MessageOptions } from './Message.js';
export interface SearchRequestOptions extends MessageOptions {
  baseDN?: string;
  scope?: 'base' | 'children' | 'one' | 'sub' | 'subordinates';
  derefAliases?: 'always' | 'find' | 'never' | 'search';
  sizeLimit?: number;
  timeLimit?: number;
  returnAttributeValues?: boolean;
  filter?: unknown;
  attributes?: string[];
  explicitBufferAttributes?: string[];
}
export declare class SearchRequest extends Message {
  baseDN: string;
  scope: string;
  derefAliases: string;
  sizeLimit: number;
  timeLimit: number;
  returnAttributeValues: boolean;
  filter?: unknown;
  attributes: string[];
  explicitBufferAttributes: string[];
  constructor(options?: SearchRequestOptions);
}
