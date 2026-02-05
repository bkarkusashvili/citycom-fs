import * as mimeTypes from 'mime-types';

export class MimeType {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static fromExtension(filename: string): MimeType {
    const mime = mimeTypes.lookup(filename);
    return new MimeType(mime || 'application/octet-stream');
  }

  static fromString(mimeType: string): MimeType {
    if (!MimeType.isValid(mimeType)) {
      return new MimeType('application/octet-stream');
    }
    return new MimeType(mimeType.toLowerCase());
  }

  static directory(): MimeType {
    return new MimeType('inode/directory');
  }

  static isValid(mimeType: string): boolean {
    // Basic MIME type validation: type/subtype
    return /^[\w\-+.]+\/[\w\-+.]+$/.test(mimeType);
  }

  get value(): string {
    return this._value;
  }

  get type(): string {
    return this._value.split('/')[0] ?? '';
  }

  get subtype(): string {
    return this._value.split('/')[1] ?? '';
  }

  isText(): boolean {
    return (
      this._value.startsWith('text/') ||
      this._value === 'application/json' ||
      this._value === 'application/xml' ||
      this._value === 'application/javascript'
    );
  }

  isImage(): boolean {
    return this._value.startsWith('image/');
  }

  isDirectory(): boolean {
    return this._value === 'inode/directory';
  }

  equals(other: MimeType): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
