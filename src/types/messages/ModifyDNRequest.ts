import { Message, type MessageOptions } from './Message.js';
export interface ModifyDNRequestOptions extends MessageOptions { dn?: string; newDN?: string; }
export declare class ModifyDNRequest extends Message { dn: string; newDN: string; constructor(options?: ModifyDNRequestOptions); }
