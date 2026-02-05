import { createHash } from 'crypto';

export class ContentHash {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static fromContent(content: Buffer | string): ContentHash {
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    const hash = createHash('sha256').update(buffer).digest('hex');
    return new ContentHash(hash);
  }

  static fromHash(hash: string): ContentHash {
    if (!ContentHash.isValidHash(hash)) {
      throw new Error('Invalid SHA-256 hash format');
    }
    return new ContentHash(hash.toLowerCase());
  }

  static isValidHash(hash: string): boolean {
    return /^[a-fA-F0-9]{64}$/.test(hash);
  }

  get value(): string {
    return this._value;
  }

  equals(other: ContentHash): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
