import { v4 as uuidv4 } from 'uuid';
import { FsNode, FsNodeProps } from './FsNode.js';
import { Path } from '../value-objects/Path.js';
import { MimeType } from '../value-objects/MimeType.js';

export interface CreateFileParams {
  tenantId: string;
  path: Path;
  parentId: string | null;
  blobId: string;
  size: number;
  mimeType?: MimeType;
}

export interface FileProps extends FsNodeProps {
  blobId: string;
}

export class File extends FsNode {
  private _blobId: string;

  private constructor(props: FileProps) {
    super(props);
    this._blobId = props.blobId;
  }

  static create(params: CreateFileParams): File {
    const now = new Date();
    const mimeType = params.mimeType ?? MimeType.fromExtension(params.path.name);
    return new File({
      id: uuidv4(),
      tenantId: params.tenantId,
      name: params.path.name,
      path: params.path,
      type: 'file',
      parentId: params.parentId,
      size: params.size,
      mimeType,
      blobId: params.blobId,
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: FileProps): File {
    if (props.type !== 'file') {
      throw new Error('Cannot reconstitute a non-file as File');
    }
    return new File(props);
  }

  get blobId(): string {
    return this._blobId;
  }

  updateContent(blobId: string, size: number): void {
    this._blobId = blobId;
    this.props.size = size;
    this.updateTimestamp();
  }

  rename(newName: string): void {
    const parentPath = this.props.path.parent;
    const newPath = parentPath ? parentPath.join(newName) : Path.create('/' + newName);
    this.props.name = newName;
    this.props.path = newPath;
    this.props.mimeType = MimeType.fromExtension(newName);
    this.updateTimestamp();
  }

  move(newPath: Path, newParentId: string | null): void {
    this.props.path = newPath;
    this.props.name = newPath.name;
    this.props.parentId = newParentId;
    this.props.mimeType = MimeType.fromExtension(newPath.name);
    this.updateTimestamp();
  }
}
