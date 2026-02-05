import { ContentHash } from '../value-objects/ContentHash.js';

export interface IBlobStorage {
  store(hash: ContentHash, content: Buffer): Promise<string>;
  retrieve(storagePath: string): Promise<Buffer>;
  delete(storagePath: string): Promise<void>;
  exists(storagePath: string): Promise<boolean>;
}
