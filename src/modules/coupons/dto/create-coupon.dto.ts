import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CouponType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateCouponDto {
  @ApiProperty({ description: 'Code promo unique (ex: BIENVENUE10, ROYALVIP)', example: 'ROYALVIP' })
  @IsString()
  code: string;

  @ApiPropertyOptional({ description: 'Description explicative du coupon' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: CouponType, example: CouponType.PERCENTAGE })
  @IsEnum(CouponType)
  type: CouponType;

  @ApiProperty({ description: 'Valeur de la réduction (% ou montant fixe TND)', example: 10 })
  @IsNumber()
  @Min(0)
  value: number;

  @ApiPropertyOptional({ description: 'Montant minimal de commande (TND) requis', example: 100 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  minOrderAmount?: number;

  @ApiPropertyOptional({ description: 'Plafond maximal de réduction en TND (pour pourcentage)' })
  @IsNumber()
  @Min(0)
  @IsOptional()
  maxDiscount?: number;

  @ApiPropertyOptional({ description: 'Nombre maximum d’utilisations globales', example: 500 })
  @IsInt()
  @Min(1)
  @IsOptional()
  usageLimit?: number;

  @ApiPropertyOptional({ description: 'Nombre d’utilisations par utilisateur', default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  perUserLimit?: number = 1;

  @ApiPropertyOptional({ description: 'Critère de ciblage (ALL, ARTICLE, CATEGORY, BRAND, CART_TOTAL, QUANTITY, CUSTOMER)', default: 'ALL' })
  @IsString()
  @IsOptional()
  targetType?: string = 'ALL';

  @ApiPropertyOptional({ description: 'Liste des cibles (IDs articles, catégories, marques ou emails)', type: [String] })
  @IsArray()
  @IsOptional()
  targetIds?: string[];

  @ApiPropertyOptional({ description: 'Quantité minimale requise d’articles ciblés' })
  @IsInt()
  @Min(1)
  @IsOptional()
  minQuantity?: number;

  @ApiPropertyOptional({ description: 'Date de début de validité' })
  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @ApiPropertyOptional({ description: 'Date d’expiration' })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Actif ou inactif', default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean = true;
}

export class CouponCartItemDto {
  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  variantId?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  unitPrice?: number;
}

export class ValidateCouponDto {
  @ApiProperty({ description: 'Code promo à tester', example: 'ROYALVIP' })
  @IsString()
  code: string;

  @ApiProperty({ description: 'Sous-total actuel du panier en TND', example: 289.000 })
  @IsNumber()
  @Min(0)
  orderAmount: number;

  @ApiPropertyOptional({ description: 'Identifiant du client si authentifié' })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ description: 'Email du client pour ciblage VIP' })
  @IsString()
  @IsOptional()
  customerEmail?: string;

  @ApiPropertyOptional({ type: [CouponCartItemDto], description: 'Articles présents dans le panier' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CouponCartItemDto)
  @IsOptional()
  items?: CouponCartItemDto[];
}
