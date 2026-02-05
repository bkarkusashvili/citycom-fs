import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FilesystemController } from './filesystem.controller';
import { FilesystemService } from './filesystem.service';
import { DirectoryService, FileService, BlobService } from './services';
import {
  STORAGE_PROVIDER,
  LocalStorageProvider,
  S3StorageProvider,
} from './services/storage';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [FilesystemController],
  providers: [
    // Storage provider - switch based on STORAGE_PROVIDER env var
    {
      provide: STORAGE_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const provider = configService.get('STORAGE_PROVIDER', 'local');
        if (provider === 's3') {
          return new S3StorageProvider(configService);
        }
        return new LocalStorageProvider(configService);
      },
      inject: [ConfigService],
    },
    BlobService,
    DirectoryService,
    FileService,
    FilesystemService,
  ],
  exports: [FilesystemService, DirectoryService, FileService, BlobService],
})
export class FilesystemModule {}
