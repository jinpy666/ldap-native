import { Message, type MessageOptions } from './Message.js';
export interface MessageResponseOptions extends MessageOptions {
  status?: number;
  matchedDN?: string;
  errorMessage?: string;
}
export declare class MessageResponse extends Message {
  status: number;
  matchedDN: string;
  errorMessage: string;
  constructor(options: MessageResponseOptions);
}
