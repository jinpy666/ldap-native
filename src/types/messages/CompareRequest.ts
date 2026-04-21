import { Message, type MessageOptions } from './Message.js';
export interface CompareRequestOptions extends MessageOptions { dn?: string; attribute?: string; value?: string; }
export declare class CompareRequest extends Message { dn: string; attribute: string; value: string; constructor(options?: CompareRequestOptions); }
