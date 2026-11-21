import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class StockTransferItemDto {
  @ApiProperty({ description: 'ID de la variante de produit à transférer' })
  @IsString()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty({ example: 10, description: 'Quantité demandée' })
  @IsInt()
  @Min(1)
  requestedQty: number;
}

export class CreateStockTransferDto {
  @ApiProperty({ description: 'ID de l’entrepôt d’origine' })
  @IsString()
  @IsNotEmpty()
  fromWarehouseId: string;

  @ApiProperty({ description: 'ID de l’entrepôt de destination' })
  @IsString()
  @IsNotEmpty()
  toWarehouseId: string;

  @ApiPropertyOptional({ example: 'Réassort boutique La Marsa pour le week-end' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ type: [StockTransferItemDto], description: 'Articles et quantités à transférer' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StockTransferItemDto)
  items: StockTransferItemDto[];
}
