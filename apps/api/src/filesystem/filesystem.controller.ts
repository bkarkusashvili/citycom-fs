import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../common/decorators/current-user.decorator';
import { FilesystemService } from './filesystem.service';
import { VersionService } from './services';
import {
  CreateDirectoryDto,
  CopyMoveDto,
  WriteFileDto,
  ListDirectoryQueryDto,
} from './dto/filesystem.dto';

@ApiTags('filesystem')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('fs')
export class FilesystemController {
  constructor(
    private readonly fsService: FilesystemService,
    private readonly versionService: VersionService,
  ) {}

  // Directory operations

  @Post('directory')
  @ApiOperation({ summary: 'Create a directory' })
  async createDirectory(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateDirectoryDto,
  ) {
    return this.fsService.createDirectory(user.id, dto.path);
  }

  @Delete('directory')
  @ApiOperation({ summary: 'Delete a directory recursively' })
  async deleteDirectory(
    @CurrentUser() user: CurrentUserData,
    @Query('path') path: string,
  ) {
    await this.fsService.deleteDirectory(user.id, path);
    return { success: true };
  }

  @Post('directory/copy')
  @ApiOperation({ summary: 'Copy a directory recursively' })
  async copyDirectory(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CopyMoveDto,
  ) {
    return this.fsService.copyDirectory(user.id, dto.from, dto.to);
  }

  @Post('directory/move')
  @ApiOperation({ summary: 'Move/rename a directory' })
  async moveDirectory(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CopyMoveDto,
  ) {
    return this.fsService.moveDirectory(user.id, dto.from, dto.to);
  }

  @Get('list')
  @ApiOperation({ summary: 'List directory contents with pagination' })
  async listDirectory(
    @CurrentUser() user: CurrentUserData,
    @Query() query: ListDirectoryQueryDto,
  ) {
    return this.fsService.listDirectory(user.id, query.path ?? '/', {
      limit: query.limit,
      cursor: query.cursor,
    });
  }

  // File operations

  @Post('file')
  @ApiOperation({ summary: 'Write file content (text)' })
  async writeFile(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: WriteFileDto,
  ) {
    const content = Buffer.from(dto.content, 'utf-8');
    return this.fsService.writeFile(user.id, dto.path, content);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        path: { type: 'string', description: 'Directory path to upload to (e.g., "/" or "/documents")' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async uploadFile(
    @CurrentUser() user: CurrentUserData,
    @UploadedFile() file: Express.Multer.File,
    @Body('path') path: string,
  ) {
    if (!file) {
      throw new Error('No file uploaded');
    }
    // Default to root if no path provided
    const targetDir = path || '/';
    // Always append filename to the directory path
    const filePath = targetDir === '/'
      ? '/' + file.originalname
      : targetDir + '/' + file.originalname;
    return this.fsService.writeFile(user.id, filePath, file.buffer);
  }

  @Get('file')
  @ApiOperation({ summary: 'Read file content' })
  async readFile(
    @CurrentUser() user: CurrentUserData,
    @Query('path') path: string,
  ) {
    const content = await this.fsService.readFile(user.id, path);
    return { content: content.toString('utf-8') };
  }

  @Get('download')
  @ApiOperation({ summary: 'Download a file' })
  async downloadFile(
    @CurrentUser() user: CurrentUserData,
    @Query('path') path: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const content = await this.fsService.readFile(user.id, path);
    const info = await this.fsService.getInfo(user.id, path);

    res.set({
      'Content-Type': info.mimeType,
      'Content-Disposition': `attachment; filename="${info.name}"`,
    });

    return new StreamableFile(content);
  }

  @Delete('file')
  @ApiOperation({ summary: 'Delete a file' })
  async deleteFile(
    @CurrentUser() user: CurrentUserData,
    @Query('path') path: string,
  ) {
    await this.fsService.deleteFile(user.id, path);
    return { success: true };
  }

  @Post('file/copy')
  @ApiOperation({ summary: 'Copy a file' })
  async copyFile(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CopyMoveDto,
  ) {
    return this.fsService.copyFile(user.id, dto.from, dto.to);
  }

  @Post('file/move')
  @ApiOperation({ summary: 'Move/rename a file' })
  async moveFile(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CopyMoveDto,
  ) {
    return this.fsService.moveFile(user.id, dto.from, dto.to);
  }

  // Common operations

  @Get('info')
  @ApiOperation({ summary: 'Get file or directory info' })
  async getInfo(
    @CurrentUser() user: CurrentUserData,
    @Query('path') path: string,
  ) {
    return this.fsService.getInfo(user.id, path);
  }

  @Get('exists')
  @ApiOperation({ summary: 'Check if path exists' })
  async exists(
    @CurrentUser() user: CurrentUserData,
    @Query('path') path: string,
  ) {
    const exists = await this.fsService.exists(user.id, path);
    return { exists };
  }

  // Version operations

  @Get('versions')
  @ApiOperation({ summary: 'List all versions of a file' })
  @ApiResponse({ status: 200, description: 'List of file versions' })
  async listVersions(
    @CurrentUser() user: CurrentUserData,
    @Query('path') path: string,
  ) {
    const info = await this.fsService.getInfo(user.id, path);
    if (info.mimeType === 'inode/directory') {
      throw new Error('Cannot get versions of a directory');
    }
    // Get fsNode id from path
    const fsNode = await this.fsService.getFsNodeByPath(user.id, path);
    return this.versionService.listVersions(fsNode.id);
  }

  @Get('versions/download')
  @ApiOperation({ summary: 'Download a specific version of a file' })
  async downloadVersion(
    @CurrentUser() user: CurrentUserData,
    @Query('path') path: string,
    @Query('version') version: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const info = await this.fsService.getInfo(user.id, path);
    const fsNode = await this.fsService.getFsNodeByPath(user.id, path);
    const content = await this.versionService.readVersionContent(fsNode.id, parseInt(version, 10));

    res.set({
      'Content-Type': info.mimeType,
      'Content-Disposition': `attachment; filename="${info.name}"`,
    });

    return new StreamableFile(content);
  }

  @Post('versions/restore')
  @ApiOperation({ summary: 'Restore a file to a specific version' })
  async restoreVersion(
    @CurrentUser() user: CurrentUserData,
    @Query('path') path: string,
    @Query('version') version: string,
  ) {
    const fsNode = await this.fsService.getFsNodeByPath(user.id, path);
    const restored = await this.versionService.restoreVersion(
      fsNode.id,
      parseInt(version, 10),
      user.id,
    );
    // Update the FsNode with the restored blob
    await this.fsService.updateFileBlob(user.id, path, restored.blobId, restored.size);
    return { success: true, message: `Restored to version ${version}` };
  }
}
