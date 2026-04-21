export interface MessageParserErrorDetails {
  messageId: number;
  protocolOperation?: number;
}

export declare class MessageParserError extends Error {
  messageDetails?: MessageParserErrorDetails;
  constructor(message: string, messageDetails?: MessageParserErrorDetails);
}
