import type { ConnectionOptions as TlsConnectionOptions } from 'node:tls';
import type { Attribute } from './Attribute.js';
import type { Change } from './Change.js';
import type { Control } from './controls/Control.js';
import type { Filter } from './filters/Filter.js';

export type SearchScope = 'base' | 'children' | 'one' | 'sub' | 'subordinates';
export type DerefAliases = 'always' | 'find' | 'never' | 'search';

export interface SearchPageOptions {
  pageSize?: number;
  cookie?: Buffer;
}

export interface SearchOptions {
  scope?: SearchScope;
  filter?: string | Filter;
  derefAliases?: DerefAliases;
  returnAttributeValues?: boolean;
  attributes?: string[];
  explicitBufferAttributes?: string[];
  singleValueAttributes?: boolean | string[];
  trimAttributeValues?: boolean | string[];
  sizeLimit?: number;
  timeLimit?: number;
  paged?: boolean | SearchPageOptions;
}

export interface SearchEntryObject {
  dn: string;
  [attribute: string]: string | Buffer | Array<string | Buffer>;
}

export interface SearchResult {
  searchEntries: SearchEntryObject[];
  searchReferences: unknown[];
}

export interface SaslOptions {
  mechanism?: string;
  credential?: string | Buffer;
  user?: string;
  password?: string;
  domain?: string;
  realm?: string;
  proxyUser?: string;
  securityProperties?: string;
  [key: string]: unknown;
}

export interface ClientOptions {
  url: string;
  timeout?: number;
  connectTimeout?: number;
  tlsOptions?: TlsConnectionOptions & {
    caFile?: string;
    certFile?: string;
    keyFile?: string;
  };
  strictDN?: boolean;
  sasl?: SaslOptions;
}

export declare class Client {
  public readonly options: ClientOptions;
  public isConnected: boolean;

  public constructor(options: ClientOptions);
  public bind(dnOrSaslMechanism: string, password?: string | Buffer, controls?: Control | Control[]): Promise<void>;
  public saslBind(options?: SaslOptions, controls?: Control | Control[]): Promise<void>;
  public startTLS(options?: ClientOptions['tlsOptions'], controls?: Control | Control[]): Promise<void>;
  public search(baseDN: string, options?: SearchOptions, controls?: Control | Control[]): Promise<SearchResult>;
  public searchPaginated(
    baseDN: string,
    options?: SearchOptions,
    controls?: Control | Control[],
  ): AsyncGenerator<SearchResult, void, unknown>;
  public add(dn: string, entry: Record<string, unknown> | Attribute[], controls?: Control | Control[]): Promise<void>;
  public modify(dn: string, changes: Change | Change[], controls?: Control | Control[]): Promise<void>;
  public del(dn: string, controls?: Control | Control[]): Promise<void>;
  public compare(
    dn: string,
    attribute: string,
    value: string | Buffer,
    controls?: Control | Control[],
  ): Promise<boolean>;
  public modifyDN(dn: string, newDN: string, controls?: Control | Control[]): Promise<void>;
  public exop(
    oid: string,
    value?: string | Buffer | null,
    controls?: Control | Control[],
  ): Promise<{ oid?: string; value: Buffer | null }>;
  public unbind(): Promise<void>;
}
