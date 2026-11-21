import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';
import { StockMovementType } from '@prisma/client';

export class AdjustStockDto {
  @ApiProperty({ description: 'ID de la déclinaison / variante de produit' })
  @IsString()
  @IsNotEmpty()
  variantId: string;

  @ApiProperty({ description: 'ID de l’entrepôt' })
  @IsString()
  @IsNotEmpty()
  warehouseId: string;

  @ApiProperty({
    description: 'Nouvelle quantité physique réelle comptée ou ajustée',
    example: 45,
  })
  @IsInt()
  @Min(0)
  newPhysicalQty: number;

  @ApiPropertyOptional({
    description: 'Type de mouvement d’ajustement',
    enum: StockMovementType,
    default: StockMovementType.COUNTING_CORRECTION,
  })
  @IsEnum(StockMovementType)
  @IsOptional()
  type?: StockMovementType = StockMovementType.COUNTING_CORRECTION;

  @ApiPropertyOptional({ example: 'Inventaire physique trimestriel', description: 'Motif de l’ajustement' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ example: 'Vérification effectuée en binôme', description: 'Notes internes' })
  @IsString()
  @IsOptional()
  notes?: string;
}
