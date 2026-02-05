export class Path {
  private readonly _value: string;

  private constructor(value: string) {
    this._value = value;
  }

  static create(path: string): Path {
    const normalized = Path.normalize(path);
    Path.validate(normalized);
    return new Path(normalized);
  }

  static normalize(path: string): string {
    if (!path || path === '') {
      return '/';
    }

    // Replace backslashes with forward slashes
    let normalized = path.replace(/\\/g, '/');

    // Remove duplicate slashes
    normalized = normalized.replace(/\/+/g, '/');

    // Ensure starts with /
    if (!normalized.startsWith('/')) {
      normalized = '/' + normalized;
    }

    // Remove trailing slash (except for root)
    if (normalized.length > 1 && normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }

    // Resolve . and ..
    const parts = normalized.split('/').filter(Boolean);
    const resolved: string[] = [];

    for (const part of parts) {
      if (part === '.') {
        continue;
      }
      if (part === '..') {
        resolved.pop();
      } else {
        resolved.push(part);
      }
    }

    return '/' + resolved.join('/');
  }

  private static validate(path: string): void {
    if (path.length > 4096) {
      throw new Error('Path exceeds maximum length of 4096 characters');
    }

    // Check for invalid characters
    const invalidChars = /[\x00-\x1f<>:"|?*]/;
    if (invalidChars.test(path)) {
      throw new Error('Path contains invalid characters');
    }

    // Check each segment
    const segments = path.split('/').filter(Boolean);
    for (const segment of segments) {
      if (segment.length > 255) {
        throw new Error('Path segment exceeds maximum length of 255 characters');
      }
    }
  }

  get value(): string {
    return this._value;
  }

  get name(): string {
    const parts = this._value.split('/');
    return parts[parts.length - 1] || '/';
  }

  get parent(): Path | null {
    if (this._value === '/') {
      return null;
    }
    const parentPath = this._value.substring(0, this._value.lastIndexOf('/')) || '/';
    return new Path(parentPath);
  }

  get segments(): string[] {
    return this._value.split('/').filter(Boolean);
  }

  get depth(): number {
    return this.segments.length;
  }

  isRoot(): boolean {
    return this._value === '/';
  }

  isChildOf(parent: Path): boolean {
    if (parent.isRoot()) {
      return this._value !== '/' && !this._value.slice(1).includes('/');
    }
    return (
      this._value.startsWith(parent.value + '/') &&
      !this._value.slice(parent.value.length + 1).includes('/')
    );
  }

  isDescendantOf(ancestor: Path): boolean {
    if (ancestor.isRoot()) {
      return this._value !== '/';
    }
    return this._value.startsWith(ancestor.value + '/');
  }

  join(segment: string): Path {
    if (this._value === '/') {
      return Path.create('/' + segment);
    }
    return Path.create(this._value + '/' + segment);
  }

  relativeTo(base: Path): string {
    if (!this.isDescendantOf(base) && !this.equals(base)) {
      throw new Error('Path is not a descendant of base');
    }
    if (this.equals(base)) {
      return '.';
    }
    return this._value.slice(base.value.length + 1);
  }

  equals(other: Path): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
