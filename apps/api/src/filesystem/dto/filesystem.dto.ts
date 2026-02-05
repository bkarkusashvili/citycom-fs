import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDirectoryDto {
  @ApiProperty({ example: '/documents/projects' })
  @IsString()
  @IsNotEmpty()
  path: string;
}

export class CopyMoveDto {
  @ApiProperty({ example: '/documents/file.txt' })
  @IsString()
  @IsNotEmpty()
  from: string;

  @ApiProperty({ example: '/backup/file.txt' })
  @IsString()
  @IsNotEmpty()
  to: string;
}

export class WriteFileDto {
  @ApiProperty({ example: '/documents/notes.txt' })
  @IsString()
  @IsNotEmpty()
  path: string;

  @ApiProperty({ example: 'Hello, World!' })
  @IsString()
  content: string;
}

export class ListDirectoryQueryDto {
  @ApiPropertyOptional({ example: '/', default: '/' })
  @IsOptional()
  @IsString()
  path?: string = '/';

  @ApiPropertyOptional({ example: 100, default: 100, minimum: 1, maximum: 1000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 100;

  @ApiPropertyOptional({ example: 'abc123', description: 'Cursor for pagination' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
}
