import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class S3StorageProvider implements StorageProvider, OnModuleInit {
  private readonly logger = new Logger(S3StorageProvider.name);
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly keyPrefix: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = configService.get('S3_ENDPOINT', 'http://localhost:9000');
    const region = configService.get('S3_REGION', 'us-east-1');
    const accessKeyId = configService.get('S3_ACCESS_KEY', 'minioadmin');
    const secretAccessKey = configService.get('S3_SECRET_KEY', 'minioadmin');

    this.bucket = configService.get('S3_BUCKET', 'citycom-blobs');
    this.keyPrefix = configService.get('S3_KEY_PREFIX', 'blobs/');

    this.s3Client = new S3Client({
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      forcePathStyle: true, // Required for MinIO
    });

    this.logger.log(`S3 storage initialized - endpoint: ${endpoint}, bucket: ${this.bucket}`);
  }

  async onModuleInit(): Promise<void> {
    // Ensure bucket exists on startup
    await this.ensureBucketExists();
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      this.logger.log(`Bucket ${this.bucket} exists`);
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        this.logger.log(`Creating bucket ${this.bucket}...`);
        await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Bucket ${this.bucket} created`);
      } else {
        this.logger.error(`Error checking bucket: ${error.message}`);
        throw error;
      }
    }
  }

  async store(key: string, content: Buffer): Promise<string> {
    const s3Key = `${this.keyPrefix}${key.substring(0, 2)}/${key}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: s3Key,
        Body: content,
      }),
    );

    this.logger.debug(`Stored blob to S3: ${s3Key}`);
    return s3Key;
  }

  async read(storagePath: string): Promise<Buffer> {
    const response = await this.s3Client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: storagePath,
      }),
    );

    // Convert stream to buffer
    const chunks: Uint8Array[] = [];
    const stream = response.Body as AsyncIterable<Uint8Array>;

    for await (const chunk of stream) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: storagePath,
        }),
      );
      this.logger.debug(`Deleted blob from S3: ${storagePath}`);
    } catch (error: any) {
      if (error.name !== 'NoSuchKey') {
        throw error;
      }
      // Object doesn't exist, ignore
    }
  }

  async exists(storagePath: string): Promise<boolean> {
    try {
      await this.s3Client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: storagePath,
        }),
      );
      return true;
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw error;
    }
  }
}
