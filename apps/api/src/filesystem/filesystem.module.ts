import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FilesystemController } from './filesystem.controller';
import { FilesystemService } from './filesystem.service';
import { DirectoryService, FileService, BlobService } from './services';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [FilesystemController],
  providers: [
    BlobService,
    DirectoryService,
    FileService,
    FilesystemService,
  ],
  exports: [FilesystemService, DirectoryService, FileService, BlobService],
})
export class FilesystemModule {}
