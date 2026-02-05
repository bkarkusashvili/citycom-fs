import { IBlobRepository } from '../../domain/repositories/IBlobRepository.js';
import { Blob, BlobProps } from '../../domain/entities/Blob.js';
import { ContentHash } from '../../domain/value-objects/ContentHash.js';

interface StoredBlob {
  id: string;
  contentHash: string;
  size: number;
  storageProvider: 'local' | 's3' | 'db';
  storagePath: string;
  referenceCount: number;
  createdAt: Date;
}

export class InMemoryBlobRepository implements IBlobRepository {
  private blobs: Map<string, StoredBlob> = new Map();
  private hashIndex: Map<string, string> = new Map(); // hash -> id

  private reconstitute(stored: StoredBlob): Blob {
    const props: BlobProps = {
      id: stored.id,
      contentHash: ContentHash.fromHash(stored.contentHash),
      size: stored.size,
      storageProvider: stored.storageProvider,
      storagePath: stored.storagePath,
      referenceCount: stored.referenceCount,
      createdAt: stored.createdAt,
    };
    return Blob.reconstitute(props);
  }

  private toStored(blob: Blob): StoredBlob {
    return {
      id: blob.id,
      contentHash: blob.contentHash.value,
      size: blob.size,
      storageProvider: blob.storageProvider,
      storagePath: blob.storagePath,
      referenceCount: blob.referenceCount,
      createdAt: blob.createdAt,
    };
  }

  async findById(id: string): Promise<Blob | null> {
    const stored = this.blobs.get(id);
    if (!stored) {
      return null;
    }
    return this.reconstitute(stored);
  }

  async findByContentHash(hash: ContentHash): Promise<Blob | null> {
    const id = this.hashIndex.get(hash.value);
    if (!id) {
      return null;
    }
    return this.findById(id);
  }

  async save(blob: Blob): Promise<void> {
    const stored = this.toStored(blob);
    this.blobs.set(blob.id, stored);
    this.hashIndex.set(blob.contentHash.value, blob.id);
  }

  async delete(id: string): Promise<void> {
    const stored = this.blobs.get(id);
    if (stored) {
      this.hashIndex.delete(stored.contentHash);
      this.blobs.delete(id);
    }
  }

  async incrementReferenceCount(id: string): Promise<void> {
    const stored = this.blobs.get(id);
    if (stored) {
      stored.referenceCount++;
      this.blobs.set(id, stored);
    }
  }

  async decrementReferenceCount(id: string): Promise<number> {
    const stored = this.blobs.get(id);
    if (stored && stored.referenceCount > 0) {
      stored.referenceCount--;
      this.blobs.set(id, stored);
      return stored.referenceCount;
    }
    return 0;
  }

  async findOrphans(): Promise<Blob[]> {
    const orphans: Blob[] = [];
    for (const stored of this.blobs.values()) {
      if (stored.referenceCount === 0) {
        orphans.push(this.reconstitute(stored));
      }
    }
    return orphans;
  }

  async deleteOrphans(): Promise<number> {
    const orphans = await this.findOrphans();
    for (const orphan of orphans) {
      await this.delete(orphan.id);
    }
    return orphans.length;
  }

  // Helper for tests
  clear(): void {
    this.blobs.clear();
    this.hashIndex.clear();
  }
}
