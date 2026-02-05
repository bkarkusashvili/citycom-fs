import { Path } from '../value-objects/Path.js';
import { MimeType } from '../value-objects/MimeType.js';

export type FsNodeType = 'file' | 'directory';

export interface FsNodeProps {
  id: string;
  tenantId: string;
  name: string;
  path: Path;
  type: FsNodeType;
  parentId: string | null;
  size: number;
  mimeType: MimeType;
  createdAt: Date;
  updatedAt: Date;
}

export interface FsNodeData {
  name: string;
  path: string;
  size: number;
  mimeType: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
}

export abstract class FsNode {
  protected readonly props: FsNodeProps;

  protected constructor(props: FsNodeProps) {
    this.props = props;
  }

  get id(): string {
    return this.props.id;
  }

  get tenantId(): string {
    return this.props.tenantId;
  }

  get name(): string {
    return this.props.name;
  }

  get path(): Path {
    return this.props.path;
  }

  get type(): FsNodeType {
    return this.props.type;
  }

  get parentId(): string | null {
    return this.props.parentId;
  }

  get size(): number {
    return this.props.size;
  }

  get mimeType(): MimeType {
    return this.props.mimeType;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  isFile(): boolean {
    return this.props.type === 'file';
  }

  isDirectory(): boolean {
    return this.props.type === 'directory';
  }

  toData(): FsNodeData {
    return {
      name: this.props.name,
      path: this.props.path.value,
      size: this.props.size,
      mimeType: this.props.mimeType.value,
      createdAt: this.props.createdAt,
      updatedAt: this.props.updatedAt,
      ownerId: this.props.tenantId,
    };
  }

  protected updateTimestamp(): void {
    this.props.updatedAt = new Date();
  }
}
