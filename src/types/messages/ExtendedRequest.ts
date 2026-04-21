import { Message, type MessageOptions } from './Message.js';
export interface ExtendedRequestOptions extends MessageOptions { oid?: string; value?: unknown; }
export declare class ExtendedRequest extends Message { oid: string; value?: unknown; constructor(options?: ExtendedRequestOptions); }
