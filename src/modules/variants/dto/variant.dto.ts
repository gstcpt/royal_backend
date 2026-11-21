import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class VariantOptionInputDto {
  @IsString()
  @IsOptional()
  id?: string;

  @ApiProperty({ example: 'Noir Mat Onyx' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional({ example: 'أسود مطفي' })
  @IsString()
  @IsOptional()
  labelAr?: string;

  @ApiPropertyOptional({ example: 'noir_mat' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ example: '#18181b' })
  @IsString()
  @IsOptional()
  colorHex?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number = 0;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

export class CreateVariantFamilyDto {
  @ApiProperty({ example: 'Couleur & Finition' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'اللون والتشطيب' })
  @IsString()
  @IsOptional()
  nameAr?: string;

  @ApiPropertyOptional({ example: 'couleur' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: 'COLOR_SWATCH', default: 'TEXT_PILL' })
  @IsString()
  @IsOptional()
  visualType?: string = 'TEXT_PILL';

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number = 0;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @ApiPropertyOptional({ type: [VariantOptionInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantOptionInputDto)
  @IsOptional()
  values?: VariantOptionInputDto[];

  @ApiPropertyOptional({ type: [VariantOptionInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantOptionInputDto)
  @IsOptional()
  options?: VariantOptionInputDto[];
}

export class UpdateVariantFamilyDto {
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
  visualType?: string;

  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantOptionInputDto)
  @IsOptional()
  values?: VariantOptionInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VariantOptionInputDto)
  @IsOptional()
  options?: VariantOptionInputDto[];
}
