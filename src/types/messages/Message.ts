export interface MessageOptions {
  messageId: number;
  controls?: unknown[];
}

export declare class Message {
  messageId: number;
  controls?: unknown[];
  constructor(options: MessageOptions);
}
