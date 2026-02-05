import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

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
