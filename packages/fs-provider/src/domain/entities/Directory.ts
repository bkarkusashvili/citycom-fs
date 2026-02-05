import { v4 as uuidv4 } from 'uuid';
import { FsNode, FsNodeProps } from './FsNode.js';
import { Path } from '../value-objects/Path.js';
import { MimeType } from '../value-objects/MimeType.js';

export interface CreateDirectoryParams {
  tenantId: string;
  path: Path;
  parentId: string | null;
}

export class Directory extends FsNode {
  private constructor(props: FsNodeProps) {
    super(props);
  }

  static create(params: CreateDirectoryParams): Directory {
    const now = new Date();
    return new Directory({
      id: uuidv4(),
      tenantId: params.tenantId,
      name: params.path.name,
      path: params.path,
      type: 'directory',
      parentId: params.parentId,
      size: 0,
      mimeType: MimeType.directory(),
      createdAt: now,
      updatedAt: now,
    });
  }

  static reconstitute(props: FsNodeProps): Directory {
    if (props.type !== 'directory') {
      throw new Error('Cannot reconstitute a non-directory as Directory');
    }
    return new Directory(props);
  }

  rename(newName: string): void {
    const parentPath = this.props.path.parent;
    const newPath = parentPath ? parentPath.join(newName) : Path.create('/' + newName);
    this.props.name = newName;
    this.props.path = newPath;
    this.updateTimestamp();
  }

  move(newPath: Path, newParentId: string | null): void {
    this.props.path = newPath;
    this.props.name = newPath.name;
    this.props.parentId = newParentId;
    this.updateTimestamp();
  }
}
