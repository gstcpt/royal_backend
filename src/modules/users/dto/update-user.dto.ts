import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MinLength,
  IsArray,
} from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'Jean' })
  @IsString()
  @MinLength(2)
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Dupont' })
  @IsString()
  @MinLength(2)
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: 'jean.dupont@royal.com.tn' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ example: '+216 20 123 456' })
  @IsString()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: 'NouveauMotDePasse2026!', description: 'Optionnel — min. 8 caractères si modification' })
  @IsString()
  @MinLength(8)
  @IsOptional()
  password?: string;

  @ApiPropertyOptional({ example: 'https://avatar.url/avatar.png' })
  @IsString()
  @IsOptional()
  avatar?: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ example: ['cuid_of_role'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  roleIds?: string[];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  warehouseId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  posId?: string;
}
