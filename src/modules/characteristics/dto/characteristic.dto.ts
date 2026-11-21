import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCharacteristicDto {
  @ApiProperty({ example: 'Puissance Nominale' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'القدرة الكهربائية' })
  @IsString()
  @IsOptional()
  nameAr?: string;

  @ApiPropertyOptional({ example: 'puissance_watts' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'NUMBER', default: 'TEXT' })
  @IsString()
  @IsOptional()
  type?: string = 'TEXT';

  @ApiPropertyOptional({ example: 'W' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isRequired?: boolean = false;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isFilterable?: boolean = true;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  iconUrl?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  options?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  optionsJson?: any;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  categoryIds?: string[];

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number = 0;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

export class UpdateCharacteristicDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  nameAr?: string;

  @IsString()
  @IsOptional()
  code?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsOptional()
  unit?: string;

  @IsBoolean()
  @IsOptional()
  isRequired?: boolean;

  @IsBoolean()
  @IsOptional()
  isFilterable?: boolean;

  @IsString()
  @IsOptional()
  iconUrl?: string;

  @IsArray()
  @IsOptional()
  options?: string[];

  @IsOptional()
  optionsJson?: any;

  @IsArray()
  @IsOptional()
  categoryIds?: string[];

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
