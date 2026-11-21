import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ProductStatus } from '@royal/shared-types';

export class QueryProductsDto {
  @ApiPropertyOptional({ default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  brandId?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  supplierId?: string;

  @ApiPropertyOptional({ enum: ProductStatus })
  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus;

  @ApiPropertyOptional()
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean;
}
