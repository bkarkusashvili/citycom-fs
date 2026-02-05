import { Blob } from '../entities/Blob.js';
import { ContentHash } from '../value-objects/ContentHash.js';

export interface IBlobRepository {
  findById(id: string): Promise<Blob | null>;
  findByContentHash(hash: ContentHash): Promise<Blob | null>;

  save(blob: Blob): Promise<void>;

  delete(id: string): Promise<void>;

  incrementReferenceCount(id: string): Promise<void>;
  decrementReferenceCount(id: string): Promise<number>; // Returns new count

  findOrphans(): Promise<Blob[]>;
  deleteOrphans(): Promise<number>; // Returns number deleted
}
