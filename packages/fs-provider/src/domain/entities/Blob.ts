import { v4 as uuidv4 } from 'uuid';
import { ContentHash } from '../value-objects/ContentHash.js';

export type StorageProvider = 'local' | 's3' | 'db';

export interface CreateBlobParams {
  contentHash: ContentHash;
  size: number;
  storageProvider: StorageProvider;
  storagePath: string;
}

export interface BlobProps {
  id: string;
  contentHash: ContentHash;
  size: number;
  storageProvider: StorageProvider;
  storagePath: string;
  referenceCount: number;
  createdAt: Date;
}

export class Blob {
  private readonly props: BlobProps;

  private constructor(props: BlobProps) {
    this.props = props;
  }

  static create(params: CreateBlobParams): Blob {
    return new Blob({
      id: uuidv4(),
      contentHash: params.contentHash,
      size: params.size,
      storageProvider: params.storageProvider,
      storagePath: params.storagePath,
      referenceCount: 1,
      createdAt: new Date(),
    });
  }

  static reconstitute(props: BlobProps): Blob {
    return new Blob(props);
  }

  get id(): string {
    return this.props.id;
  }

  get contentHash(): ContentHash {
    return this.props.contentHash;
  }

  get size(): number {
    return this.props.size;
  }

  get storageProvider(): StorageProvider {
    return this.props.storageProvider;
  }

  get storagePath(): string {
    return this.props.storagePath;
  }

  get referenceCount(): number {
    return this.props.referenceCount;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  incrementReferenceCount(): void {
    this.props.referenceCount++;
  }

  decrementReferenceCount(): void {
    if (this.props.referenceCount > 0) {
      this.props.referenceCount--;
    }
  }

  isOrphan(): boolean {
    return this.props.referenceCount === 0;
  }
}
