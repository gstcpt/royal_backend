import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class ReserveStockDto {
  @ApiProperty({ description: 'ID de la variante de produit' })
  @IsString()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty({ description: 'ID de l’entrepôt' })
  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @ApiProperty({ example: 2, description: 'Quantité à réserver' })
  @IsInt()
  @Min(1)
  quantity: number;

  @ApiPropertyOptional({ example: 'ORDER', description: 'Type de document de référence' })
  @IsString()
  @IsOptional()
  referenceType?: string = 'ORDER';

  @ApiPropertyOptional({ example: 'ORD-2026-0001', description: 'ID ou référence de commande' })
  @IsString()
  @IsOptional()
  referenceId?: string;

  @ApiPropertyOptional({ example: 'Réservation panier ou validation commande' })
  @IsString()
  @IsOptional()
  notes?: string;
}
