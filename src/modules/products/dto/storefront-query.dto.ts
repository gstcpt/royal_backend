import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class StorefrontQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 12 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 12;

  @ApiPropertyOptional({ description: 'Terme de recherche textuelle' })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Slug de la catégorie' })
  @IsString()
  @IsOptional()
  categorySlug?: string;

  @ApiPropertyOptional({ description: 'Alias slug de la catégorie' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Slug de la marque' })
  @IsString()
  @IsOptional()
  brandSlug?: string;

  @ApiPropertyOptional({ description: 'Alias slug de la marque' })
  @IsString()
  @IsOptional()
  brand?: string;

  @ApiPropertyOptional({ description: 'Prix minimum en TND' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Prix maximum en TND' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Filtrer uniquement les articles en stock' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  inStock?: boolean;

  @ApiPropertyOptional({ description: 'Options de variantes sélectionnées séparées par virgules' })
  @IsString()
  @IsOptional()
  variantOptions?: string;

  @ApiPropertyOptional({ description: 'Filtres caractéristiques JSON (clé -> tableau de valeurs)' })
  @IsString()
  @IsOptional()
  chars?: string;

  @ApiPropertyOptional({
    description: 'Ordre de tri',
    enum: ['newest', 'price_asc', 'price_desc', 'popular', 'featured'],
    default: 'newest',
  })
  @IsString()
  @IsOptional()
  sort?: string = 'newest';

  @ApiPropertyOptional({
    description: 'Alias ordre de tri',
    enum: ['newest', 'price_asc', 'price_desc', 'popular', 'featured'],
  })
  @IsString()
  @IsOptional()
  sortBy?: string;

  @ApiPropertyOptional({
    description: 'Collection d’affichage spéciale',
    enum: ['featured', 'new_arrivals', 'trending', 'all'],
    default: 'all',
  })
  @IsString()
  @IsOptional()
  collection?: string = 'all';
}
