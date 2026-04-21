import { Message, type MessageOptions } from './Message.js';
export interface AddRequestOptions extends MessageOptions { entry?: Record<string, unknown>; }
export declare class AddRequest extends Message { entry: Record<string, unknown>; constructor(options: AddRequestOptions); }
