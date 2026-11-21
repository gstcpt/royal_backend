import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'analytics' })
  @IsString()
  @IsNotEmpty()
  module: string;

  @ApiPropertyOptional({ example: 'analytics' })
  @IsOptional()
  @IsString()
  resource?: string;

  @ApiProperty({ example: 'export' })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;
}
