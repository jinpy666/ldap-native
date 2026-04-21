import { Message, type MessageOptions } from './Message.js';
export interface ModifyRequestOptions extends MessageOptions { dn?: string; changes?: unknown[]; }
export declare class ModifyRequest extends Message { dn: string; changes: unknown[]; constructor(options?: ModifyRequestOptions); }
