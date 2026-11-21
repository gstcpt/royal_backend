import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export enum PosPaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  CHECK = 'CHECK',
  VOUCHER = 'VOUCHER',
}

export class PosSaleItemDto {
  @ApiProperty({ description: 'ID de la variante de produit' })
  @IsString()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty({ example: 1, description: 'Quantité vendue' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiProperty({ example: 289.0, description: 'Prix unitaire appliqué en TND' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional({ example: 0, description: 'Remise éventuelle en TND' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  discount?: number = 0;
}

export class PosPaymentPartDto {
  @ApiProperty({ enum: PosPaymentMethod, example: PosPaymentMethod.CASH })
  @IsEnum(PosPaymentMethod)
  method: PosPaymentMethod;

  @ApiProperty({ example: 200.0, description: 'Montant réglé avec ce mode en TND' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  amount: number;

  @ApiPropertyOptional({ description: 'Référence transaction TPE / N° Chèque' })
  @IsString()
  @IsOptional()
  reference?: string;
}

export class PosCheckoutDto {
  @ApiProperty({ description: 'ID de la caisse enregistreuse' })
  @IsString()
  @IsNotEmpty()
  registerId: string;

  @ApiPropertyOptional({ description: 'ID du client fidélité (facultatif)' })
  @IsString()
  @IsOptional()
  customerId?: string;

  @ApiPropertyOptional({ example: 'Passant Comptoir', description: 'Nom du client comptoir si anonyme' })
  @IsString()
  @IsOptional()
  customerName?: string;

  @ApiPropertyOptional({ example: '+216 98 123 456' })
  @IsString()
  @IsOptional()
  customerPhone?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  customerEmail?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  deliveryAddress?: string;

  @ApiPropertyOptional({ enum: ['IN_STORE_PICKUP', 'PENDING_PICKUP', 'DELIVERY'] })
  @IsString()
  @IsOptional()
  fulfillmentMode?: 'IN_STORE_PICKUP' | 'PENDING_PICKUP' | 'DELIVERY';

  @ApiProperty({ type: [PosSaleItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosSaleItemDto)
  items: PosSaleItemDto[];

  @ApiProperty({ type: [PosPaymentPartDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PosPaymentPartDto)
  payments: PosPaymentPartDto[];

  @ApiPropertyOptional({ example: 300.0, description: 'Montant espèces remis par le client (pour calcul monnaie rendue)' })
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  amountTendered?: number;

  @ApiPropertyOptional({ example: 'Ticket imprimé avec carte privilège' })
  @IsString()
  @IsOptional()
  notes?: string;
}
