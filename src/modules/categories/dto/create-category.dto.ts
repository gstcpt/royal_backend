import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Batteries & Casseroles', description: 'Nom de la catégorie' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'أواني وقدور الطهي', description: 'Nom en arabe' })
  @IsString()
  @IsOptional()
  nameAr?: string;

  @ApiPropertyOptional({ example: 'batteries-et-casseroles', description: 'Slug SEO unique' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: 'Ensembles complets de casseroles et poêles professionnelles' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  descriptionAr?: string;

  @ApiPropertyOptional({ example: '/images/categories/cookware.jpg' })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiPropertyOptional({ example: null, description: 'ID de la catégorie parente' })
  @IsString()
  @IsOptional()
  parentId?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  sortOrder?: number = 0;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  showinmenu?: boolean = true;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  metaTitle?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  metaDesc?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  metaKeywords?: string;
}
