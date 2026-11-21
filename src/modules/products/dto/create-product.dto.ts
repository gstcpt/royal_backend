import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductStatus } from '@royal/shared-types';

export class CreateVariantDto {
  @ApiProperty({ example: 'SKU-MARM-24-EM' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiPropertyOptional({ example: '123456789012' })
  @IsString()
  @IsOptional()
  barcode?: string;

  @ApiProperty({ example: 'Diamètre 24cm - Vert Émeraude' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  nameAr?: string;

  @ApiProperty({ example: { size: '24cm', color: 'Émeraude' } })
  @IsNotEmpty()
  attributesJson: Record<string, any>;

  @ApiPropertyOptional({ example: 185.0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  sellingPrice?: number;

  @ApiPropertyOptional({ example: 95.0 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  purchasePrice?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  imageUrl?: string;
}

export class CreateProductImageDto {
  @ApiProperty({ example: '/images/products/cocotte-emeraude-1.jpg' })
  @IsString()
  @IsNotEmpty()
  url: string;

  @ApiPropertyOptional({ example: 'Cocotte en fonte émaillée vert émeraude' })
  @IsString()
  @IsOptional()
  alt?: string;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isPrimary?: boolean = false;

  @ApiPropertyOptional({ default: 0 })
  @IsNumber()
  @IsOptional()
  sortOrder?: number = 0;
}

export class CreateProductDto {
  @ApiProperty({ example: 'PRD-COC-001', description: 'SKU maître du produit' })
  @IsString()
  @IsNotEmpty()
  sku: string;

  @ApiPropertyOptional({ example: '619123456789' })
  @IsString()
  @IsOptional()
  barcode?: string;

  @ApiProperty({ example: 'Cocotte Ronde en Fonte Émaillée Signée' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'قدر طهي من الحديد الزهر المصقول' })
  @IsString()
  @IsOptional()
  nameAr?: string;

  @ApiPropertyOptional({ example: 'cocotte-ronde-fonte-emaillee' })
  @IsString()
  @IsOptional()
  slug?: string;

  @ApiPropertyOptional({ example: 'Pièce maîtresse de la gastronomie, distribution thermique optimale.' })
  @IsString()
  @IsOptional()
  shortDescription?: string;

  @ApiPropertyOptional({ example: 'Conçue pour durer des générations, idéale pour mijoter à feu doux.' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ example: 'cuid_category_id' })
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @ApiPropertyOptional({ example: 'cuid_brand_id' })
  @IsString()
  @IsOptional()
  brandId?: string;

  @ApiPropertyOptional({ example: 'cuid_supplier_id' })
  @IsString()
  @IsOptional()
  supplierId?: string;

  @ApiProperty({ example: 120.0, description: 'Prix d’achat ou de base unitaire' })
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiProperty({ example: 220.0, description: 'Prix de vente public en TND' })
  @IsNumber()
  @Min(0)
  sellingPrice: number;

  @ApiPropertyOptional({ example: 185.0, description: 'Prix barré ou remisé' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  discountPrice?: number;

  @ApiPropertyOptional({ default: 0.19, description: 'Taux de TVA (ex: 0.19 pour 19%)' })
  @IsNumber()
  @IsOptional()
  taxRate?: number = 0.19;

  @ApiPropertyOptional({ example: 4.85, description: 'Poids net en kg' })
  @IsNumber()
  @IsOptional()
  weight?: number;

  @ApiPropertyOptional({ example: { length: 30, width: 25, height: 18 } })
  @IsOptional()
  dimensionsJson?: Record<string, any>;

  @ApiPropertyOptional({ enum: ProductStatus, default: ProductStatus.ACTIVE })
  @IsEnum(ProductStatus)
  @IsOptional()
  status?: ProductStatus = ProductStatus.ACTIVE;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  isFeatured?: boolean = false;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  isComparable?: boolean = true;

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

  @ApiPropertyOptional({ default: 10 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  initialStock?: number;

  @ApiPropertyOptional({ type: [CreateVariantDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateVariantDto)
  @IsOptional()
  variants?: CreateVariantDto[];

  @ApiPropertyOptional({ type: [CreateProductImageDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductImageDto)
  @IsOptional()
  images?: CreateProductImageDto[];
}
