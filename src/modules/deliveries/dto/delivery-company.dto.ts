import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DeliveryCalculationMethod } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PricingBracketDto {
  @ApiProperty({ example: 0 })
  @IsNumber()
  @Min(0)
  min: number;

  @ApiPropertyOptional({ example: 9.99, nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  max?: number | null;

  @ApiProperty({ example: 7 })
  @IsNumber()
  @Min(0)
  price: number;

  @ApiPropertyOptional({ example: 'Moins de 10 kg' })
  @IsOptional()
  @IsString()
  label?: string;
}

export class DeliveryMethodRuleInputDto {
  @ApiProperty({ enum: DeliveryCalculationMethod })
  @IsEnum(DeliveryCalculationMethod)
  method: DeliveryCalculationMethod;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean = true;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedPrice?: number;

  @ApiPropertyOptional({ type: [PricingBracketDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PricingBracketDto)
  brackets?: PricingBracketDto[];
}

export class UpsertDeliveryCompanyDto {
  @ApiProperty({ example: 'Royal Express Logistique' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'ROYAL-EXPRESS' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: '+216 48 091 914' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'contact@royal.com.tn' })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  logoUrl?: string;

  @ApiPropertyOptional({ default: 'TN' })
  @IsOptional()
  @IsString()
  originCountry?: string = 'TN';

  @ApiPropertyOptional({ default: 'Tunis' })
  @IsOptional()
  @IsString()
  originState?: string = 'Tunis';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  originCity?: string;

  @ApiPropertyOptional({ default: '24h - 48h' })
  @IsOptional()
  @IsString()
  estimatedDays?: string = '24h - 48h';

  @ApiPropertyOptional({ enum: DeliveryCalculationMethod, default: DeliveryCalculationMethod.DISTANCE })
  @IsOptional()
  @IsEnum(DeliveryCalculationMethod)
  defaultMethod?: DeliveryCalculationMethod = DeliveryCalculationMethod.DISTANCE;

  @ApiPropertyOptional({ default: 7 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  fixedPrice?: number = 7;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({ type: [DeliveryMethodRuleInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeliveryMethodRuleInputDto)
  methods?: DeliveryMethodRuleInputDto[];
}

export class QuoteItemDto {
  @ApiProperty()
  @IsString()
  variantId: string;

  @ApiProperty({ default: 1 })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CalculateDeliveryQuoteDto {
  @ApiPropertyOptional({ default: 'TN' })
  @IsOptional()
  @IsString()
  destinationCountry?: string = 'TN';

  @ApiProperty({ example: 'Mahdia' })
  @IsString()
  destinationState: string;

  @ApiPropertyOptional({ type: [QuoteItemDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items?: QuoteItemDto[];

  @ApiPropertyOptional({ description: 'Poids total explicite (kg) pour simulation' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  totalWeightKg?: number;

  @ApiPropertyOptional({ description: 'Sous-total commande pour vérifier éventuel seuil de gratuité' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  subtotalTnd?: number;

  @ApiPropertyOptional({ description: 'Inclure les sociétés inactives (test back-office ROOT)' })
  @IsOptional()
  @IsBoolean()
  includeInactive?: boolean = false;

  @ApiPropertyOptional({ description: 'Coupon livraison offerte appliqué au panier (FREE_SHIPPING)' })
  @IsOptional()
  @IsBoolean()
  freeShippingCoupon?: boolean = false;
}

export class CheckShowroomsAvailabilityDto {
  @ApiProperty({ type: [QuoteItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items: QuoteItemDto[];
}
