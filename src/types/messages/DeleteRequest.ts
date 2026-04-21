import { Message, type MessageOptions } from './Message.js';
export interface DeleteRequestOptions extends MessageOptions { dn?: string; }
export declare class DeleteRequest extends Message { dn: string; constructor(options?: DeleteRequestOptions); }
