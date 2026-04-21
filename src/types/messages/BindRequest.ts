import { Message, type MessageOptions } from './Message.js';
export interface BindRequestOptions extends MessageOptions { dn?: string; password?: string; mechanism?: string; }
export declare const SASL_MECHANISMS: readonly ['EXTERNAL', 'PLAIN', 'DIGEST-MD5', 'SCRAM-SHA-1'];
export type SaslMechanism = (typeof SASL_MECHANISMS)[number];
export declare class BindRequest extends Message { dn: string; password: string; mechanism?: string; constructor(options?: BindRequestOptions); }
