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
  constructor(private readonly fsService: FilesystemService) {}

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
        path: { type: 'string' },
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
    const targetPath = path || '/';
    const filePath = targetPath.endsWith('/') || targetPath === '/'
      ? (targetPath === '/' ? '/' + file.originalname : targetPath + file.originalname)
      : targetPath;
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
}
